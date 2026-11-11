-- One durable reservation per validated audio/content fingerprint. Audio itself is
-- never stored here. Quota, test creation and reservation commit atomically.
CREATE TABLE public.hskk_submission_requests (
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  fingerprint text NOT NULL CHECK (fingerprint ~ '^[0-9a-f]{64}$'),
  test_id uuid NOT NULL UNIQUE REFERENCES public.hskk_tests(id) ON DELETE CASCADE,
  state text NOT NULL CHECK (state IN ('processing','failed','completed')),
  lease_token uuid NOT NULL,
  lease_expires_at timestamptz NOT NULL,
  response jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (profile_id, fingerprint)
);
ALTER TABLE public.hskk_submission_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.hskk_submission_requests FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.hskk_submission_requests TO service_role;

-- Authenticated users can reserve only their own quota. They cannot mark a
-- server-generated result complete or read the private reservation table.
CREATE FUNCTION public.reserve_hskk_submission(p_profile_id uuid, p_fingerprint text, p_level text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_request public.hskk_submission_requests%ROWTYPE;
  v_quota record;
  v_test_id uuid;
  v_token uuid := gen_random_uuid();
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id=p_profile_id AND auth_id=auth.uid()) THEN
    RAISE EXCEPTION 'profile is not owned by current user' USING ERRCODE='42501';
  END IF;
  IF p_fingerprint IS NULL OR p_fingerprint !~ '^[0-9a-f]{64}$'
    OR p_level IS NULL OR p_level NOT IN ('beginner','intermediate','advanced') THEN
    RAISE EXCEPTION 'invalid submission identity' USING ERRCODE='22023';
  END IF;
  -- Handles absent-row races as well as existing retries. Hash collisions merely
  -- serialize unrelated requests; identity is still the full composite key.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_profile_id::text || ':' || p_fingerprint,0));
  SELECT * INTO v_request FROM public.hskk_submission_requests
    WHERE profile_id=p_profile_id AND fingerprint=p_fingerprint FOR UPDATE;
  IF FOUND THEN
    IF NOT EXISTS (SELECT 1 FROM public.hskk_tests WHERE id=v_request.test_id AND user_id=p_profile_id AND level=p_level) THEN
      RAISE EXCEPTION 'submission identity mismatch' USING ERRCODE='22023';
    END IF;
    IF v_request.state='completed' THEN
      RETURN jsonb_build_object('state','completed','test_id',v_request.test_id,'response',v_request.response);
    END IF;
    IF v_request.state='processing' AND v_request.lease_expires_at > now() THEN
      RETURN jsonb_build_object('state','processing','test_id',v_request.test_id);
    END IF;
    UPDATE public.hskk_submission_requests SET state='processing',lease_token=v_token,
      lease_expires_at=now()+interval '5 minutes',updated_at=now()
      WHERE profile_id=p_profile_id AND fingerprint=p_fingerprint;
    UPDATE public.hskk_tests SET status='processing' WHERE id=v_request.test_id AND user_id=p_profile_id;
    RETURN jsonb_build_object('state','reserved','test_id',v_request.test_id,'lease_token',v_token);
  END IF;
  SELECT * INTO v_quota FROM public.consume_practice_quota(p_profile_id,'hskk');
  IF NOT v_quota.allowed THEN
    RETURN jsonb_build_object('state','quota_denied','reason',v_quota.reason,
      'daily_remaining',v_quota.daily_remaining,'monthly_remaining',v_quota.monthly_remaining);
  END IF;
  INSERT INTO public.hskk_tests(user_id,level,status) VALUES(p_profile_id,p_level,'processing') RETURNING id INTO v_test_id;
  INSERT INTO public.hskk_submission_requests(profile_id,fingerprint,test_id,state,lease_token,lease_expires_at)
    VALUES(p_profile_id,p_fingerprint,v_test_id,'processing',v_token,now()+interval '5 minutes');
  RETURN jsonb_build_object('state','reserved','test_id',v_test_id,'lease_token',v_token);
END;
$$;

-- Service role already owns scoring authority; no new client authority is added.
CREATE FUNCTION public.finish_hskk_submission(p_profile_id uuid,p_fingerprint text,p_lease_token uuid,p_response jsonb,p_qa_answers jsonb DEFAULT '[]'::jsonb)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE v_request public.hskk_submission_requests%ROWTYPE;
BEGIN
  SELECT * INTO v_request FROM public.hskk_submission_requests
    WHERE profile_id=p_profile_id AND fingerprint=p_fingerprint FOR UPDATE;
  IF NOT FOUND OR v_request.state <> 'processing' OR v_request.lease_token IS DISTINCT FROM p_lease_token THEN RETURN false; END IF;
  IF jsonb_typeof(p_response) IS DISTINCT FROM 'object'
    OR p_response->>'test_id' IS DISTINCT FROM v_request.test_id::text
    OR jsonb_typeof(p_response->'scores') IS DISTINCT FROM 'object'
    OR jsonb_typeof(p_response->'transcripts') IS DISTINCT FROM 'object'
    OR jsonb_typeof(p_qa_answers) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'invalid completed response' USING ERRCODE='22023';
  END IF;
  UPDATE public.hskk_tests SET
    section_read_text=p_response->'transcripts'->>'read',
    section_qa_text=p_qa_answers,
    section_picture_text=p_response->'transcripts'->>'picture',
    total_score=(p_response->>'total_score')::smallint,
    pronunciation_score=(p_response->'scores'->>'pronunciation')::smallint,
    fluency_score=(p_response->'scores'->>'fluency')::smallint,
    grammar_score=(p_response->'scores'->>'grammar')::smallint,
    vocabulary_score=(p_response->'scores'->>'vocabulary')::smallint,
    content_score=(p_response->'scores'->>'content')::smallint,
    feedback=p_response - 'test_id' - 'transcripts' - 'latency_ms',
    status='completed',completed_at=now()
    WHERE id=v_request.test_id AND user_id=p_profile_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'test no longer exists'; END IF;
  UPDATE public.hskk_submission_requests SET state='completed',response=p_response,updated_at=now()
    WHERE profile_id=p_profile_id AND fingerprint=p_fingerprint;
  RETURN true;
END;
$$;

CREATE FUNCTION public.fail_hskk_submission(p_profile_id uuid,p_fingerprint text,p_lease_token uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE v_test_id uuid;
BEGIN
  UPDATE public.hskk_submission_requests SET state='failed',updated_at=now()
    WHERE profile_id=p_profile_id AND fingerprint=p_fingerprint AND state='processing' AND lease_token=p_lease_token
    RETURNING test_id INTO v_test_id;
  IF NOT FOUND THEN RETURN false; END IF;
  UPDATE public.hskk_tests SET status='failed' WHERE id=v_test_id AND user_id=p_profile_id;
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.reserve_hskk_submission(uuid,text,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.finish_hskk_submission(uuid,text,uuid,jsonb,jsonb) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.fail_hskk_submission(uuid,text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_hskk_submission(uuid,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finish_hskk_submission(uuid,text,uuid,jsonb,jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.fail_hskk_submission(uuid,text,uuid) TO service_role;

