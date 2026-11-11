-- Audio requests are distinct from saved turns: a failed recording can be replaced,
-- but retrying identical bytes must not consume the seconds quota again.
CREATE TABLE public.conversation_submission_requests (
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES public.verified_conversation_sessions(conversation_id) ON DELETE CASCADE,
  turn_index integer NOT NULL CHECK(turn_index>=0),
  fingerprint text NOT NULL CHECK(fingerprint ~ '^[0-9a-f]{64}$'),
  audio_seconds integer NOT NULL CHECK(audio_seconds BETWEEN 1 AND 600),
  state text NOT NULL CHECK(state IN ('processing','failed','completed')),
  lease_token uuid NOT NULL,
  lease_expires_at timestamptz NOT NULL,
  turn_data jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(conversation_id,turn_index,fingerprint)
);
CREATE INDEX conversation_submission_profile_idx ON public.conversation_submission_requests(profile_id);
ALTER TABLE public.conversation_submission_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.conversation_submission_requests FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON public.conversation_submission_requests TO service_role;

CREATE FUNCTION public.reserve_conversation_submission(p_profile_id uuid,p_conversation_id uuid,p_turn_index integer,p_fingerprint text,p_seconds integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
 v_session public.verified_conversation_sessions%ROWTYPE;
 v_request public.conversation_submission_requests%ROWTYPE;
 v_quota record; v_turn jsonb; v_count integer; v_token uuid:=gen_random_uuid(); v_exists boolean;
BEGIN
 -- All conversation writers lock profile before session, then request rows.
 PERFORM 1 FROM public.profiles WHERE id=p_profile_id AND auth_id=auth.uid() FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Profile not owned' USING ERRCODE='42501'; END IF;
 IF p_turn_index IS NULL OR p_turn_index<0 OR p_fingerprint IS NULL OR p_fingerprint !~ '^[0-9a-f]{64}$'
   OR p_seconds IS NULL OR p_seconds NOT BETWEEN 1 AND 600 THEN
   RAISE EXCEPTION 'Invalid audio request' USING ERRCODE='22023';
 END IF;
 SELECT * INTO v_session FROM public.verified_conversation_sessions WHERE conversation_id=p_conversation_id FOR UPDATE;
 IF NOT FOUND OR v_session.user_id<>p_profile_id OR NOT v_session.verified THEN
   RAISE EXCEPTION 'Verified conversation not owned' USING ERRCODE='42501';
 END IF;
 SELECT turn_data INTO v_turn FROM public.verified_conversation_turns WHERE conversation_id=p_conversation_id AND turn_index=p_turn_index;
 IF FOUND THEN RETURN jsonb_build_object('state','completed','turn_data',v_turn); END IF;
 IF v_session.completed_at IS NOT NULL THEN RETURN jsonb_build_object('state','conflict','reason','ended'); END IF;
 SELECT count(*) INTO v_count FROM public.verified_conversation_turns WHERE conversation_id=p_conversation_id;
 IF p_turn_index<>v_count THEN RETURN jsonb_build_object('state','conflict','reason','unexpected_turn'); END IF;
 SELECT * INTO v_request FROM public.conversation_submission_requests
   WHERE conversation_id=p_conversation_id AND turn_index=p_turn_index AND fingerprint=p_fingerprint FOR UPDATE;
 v_exists:=FOUND;
 IF v_exists AND v_request.audio_seconds<>p_seconds THEN
   RETURN jsonb_build_object('state','conflict','reason','audio_mismatch');
 END IF;
 -- Only one active recording can own this turn, including different audio hashes.
 IF EXISTS(SELECT 1 FROM public.conversation_submission_requests WHERE conversation_id=p_conversation_id
   AND turn_index=p_turn_index AND state='processing' AND lease_expires_at>now()) THEN
   RETURN jsonb_build_object('state','processing');
 END IF;
 IF NOT v_exists THEN
   SELECT * INTO v_quota FROM public.consume_conversation_seconds(p_profile_id,p_seconds);
   IF NOT v_quota.allowed THEN RETURN jsonb_build_object('state','quota_denied','daily_remaining',v_quota.daily_remaining); END IF;
 END IF;
 -- Fence every expired attempt before handing the turn to this request.
 UPDATE public.conversation_submission_requests SET state='failed',updated_at=now()
   WHERE conversation_id=p_conversation_id AND turn_index=p_turn_index AND state='processing';
 IF v_exists THEN
   UPDATE public.conversation_submission_requests SET state='processing',lease_token=v_token,
     lease_expires_at=now()+interval '5 minutes',updated_at=now()
     WHERE conversation_id=p_conversation_id AND turn_index=p_turn_index AND fingerprint=p_fingerprint;
 ELSE
   INSERT INTO public.conversation_submission_requests(profile_id,conversation_id,turn_index,fingerprint,audio_seconds,state,lease_token,lease_expires_at)
     VALUES(p_profile_id,p_conversation_id,p_turn_index,p_fingerprint,p_seconds,'processing',v_token,now()+interval '5 minutes');
 END IF;
 RETURN jsonb_build_object('state','reserved','lease_token',v_token);
END;
$$;

CREATE FUNCTION public.finish_conversation_submission(p_profile_id uuid,p_conversation_id uuid,p_turn_index integer,p_lease_token uuid,p_turn jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE v_session public.verified_conversation_sessions%ROWTYPE; v_request public.conversation_submission_requests%ROWTYPE; v_turn jsonb;
BEGIN
 PERFORM 1 FROM public.profiles WHERE id=p_profile_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Profile not found'; END IF;
 SELECT * INTO v_session FROM public.verified_conversation_sessions WHERE conversation_id=p_conversation_id FOR UPDATE;
 IF NOT FOUND OR v_session.user_id<>p_profile_id OR NOT v_session.verified THEN RAISE EXCEPTION 'Verified conversation not owned'; END IF;
 SELECT * INTO v_request FROM public.conversation_submission_requests WHERE profile_id=p_profile_id
   AND conversation_id=p_conversation_id AND turn_index=p_turn_index AND lease_token=p_lease_token FOR UPDATE;
 IF NOT FOUND THEN RETURN NULL; END IF;
 IF v_request.state='completed' THEN RETURN v_request.turn_data; END IF;
 IF v_request.state<>'processing' THEN RETURN NULL; END IF;
 v_turn:=public.save_verified_conversation_turn(p_profile_id,p_conversation_id,p_turn_index,p_turn);
 UPDATE public.conversation_submission_requests SET state='completed',turn_data=v_turn,updated_at=now()
   WHERE conversation_id=p_conversation_id AND turn_index=p_turn_index AND fingerprint=v_request.fingerprint;
 RETURN v_turn;
END;
$$;

CREATE FUNCTION public.fail_conversation_submission(p_profile_id uuid,p_conversation_id uuid,p_turn_index integer,p_lease_token uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 UPDATE public.conversation_submission_requests SET state='failed',updated_at=now()
   WHERE profile_id=p_profile_id AND conversation_id=p_conversation_id AND turn_index=p_turn_index
     AND lease_token=p_lease_token AND state='processing';
 RETURN FOUND;
END;
$$;
REVOKE ALL ON FUNCTION public.reserve_conversation_submission(uuid,uuid,integer,text,integer) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.finish_conversation_submission(uuid,uuid,integer,uuid,jsonb) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.fail_conversation_submission(uuid,uuid,integer,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_conversation_submission(uuid,uuid,integer,text,integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finish_conversation_submission(uuid,uuid,integer,uuid,jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.fail_conversation_submission(uuid,uuid,integer,uuid) TO service_role;
