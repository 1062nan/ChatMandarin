-- Server-verified practice only. Historical source records remain unchanged.
CREATE TABLE public.verified_conversation_sessions (
  conversation_id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  scenario_id text NOT NULL,
  completed_at timestamptz
);
ALTER TABLE public.verified_conversation_sessions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.verified_conversation_sessions FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.verified_conversation_sessions TO service_role;
CREATE INDEX verified_conversation_sessions_user ON public.verified_conversation_sessions(user_id);

CREATE TABLE public.verified_practice_credits (
  kind text NOT NULL CHECK(kind IN ('conversation','shadowing','dubbing')),
  source_id uuid NOT NULL,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  unit_id text REFERENCES public.learning_units(id),
  score integer CHECK(score BETWEEN 0 AND 100),
  credited boolean NOT NULL DEFAULT false,
  previous_progress jsonb,
  assessment jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(kind,source_id)
);
ALTER TABLE public.verified_practice_credits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.verified_practice_credits FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.verified_practice_credits TO service_role;
CREATE INDEX verified_practice_credits_user_unit ON public.verified_practice_credits(user_id,unit_id);
ALTER TABLE public.shadowing_records ADD COLUMN IF NOT EXISTS transcript_match_score smallint CHECK(transcript_match_score BETWEEN 0 AND 100);

CREATE OR REPLACE FUNCTION public.ensure_learning_progress(p_profile_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
  PERFORM 1 FROM public.profiles WHERE id=p_profile_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Profile not found'; END IF;
  INSERT INTO public.user_progress(user_id,unit_id,status)
  SELECT p.id,u.id,CASE WHEN NOT EXISTS (
    SELECT 1 FROM public.learning_units prev WHERE prev.is_active AND prev.hsk_level=u.hsk_level AND prev.sort_order<u.sort_order
  ) THEN 'available' ELSE 'locked' END
  FROM public.profiles p CROSS JOIN public.learning_units u
  WHERE p.id=p_profile_id AND u.is_active AND u.hsk_level<=p.hsk_level
  ON CONFLICT(user_id,unit_id) DO UPDATE SET status='available'
  WHERE user_progress.status='locked' AND EXCLUDED.status='available';
END $$;
REVOKE ALL ON FUNCTION public.ensure_learning_progress(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_learning_progress(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.credit_verified_practice(p_profile_id uuid,p_kind text,p_source_id uuid,p_score integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE v_owner uuid; v_unit text; v_next public.learning_units; v_status text; v_inserted integer; v_best integer; v_attempts integer;
BEGIN
  IF p_score IS NOT NULL AND (p_score<0 OR p_score>100) THEN RAISE EXCEPTION 'Invalid score'; END IF;
  PERFORM public.ensure_learning_progress(p_profile_id);
  IF p_kind='conversation' THEN
    SELECT s.user_id,c.unit_id INTO v_owner,v_unit FROM public.verified_conversation_sessions s
    LEFT JOIN public.scenarios c ON c.id=s.scenario_id AND c.is_active
    WHERE s.conversation_id=p_source_id AND s.completed_at IS NOT NULL;
  ELSIF p_kind='shadowing' THEN
    SELECT r.user_id,s.unit_id INTO v_owner,v_unit FROM public.shadowing_records r
    LEFT JOIN public.shadowing_sentences s ON s.id=r.sentence_id AND s.is_active WHERE r.id=p_source_id;
  ELSIF p_kind='dubbing' THEN
    SELECT r.user_id,c.unit_id INTO v_owner,v_unit FROM public.dubbing_performances r
    LEFT JOIN public.dubbing_clips c ON c.id=r.clip_id AND c.is_active WHERE r.id=p_source_id AND r.mode='perform';
  ELSE RAISE EXCEPTION 'Invalid practice kind'; END IF;
  IF v_owner IS DISTINCT FROM p_profile_id THEN RAISE EXCEPTION 'Practice not owned by profile'; END IF;
  INSERT INTO public.verified_practice_credits(kind,source_id,user_id,unit_id,score,previous_progress)
  VALUES(p_kind,p_source_id,p_profile_id,v_unit,p_score,(SELECT to_jsonb(up) FROM public.user_progress up WHERE up.user_id=p_profile_id AND up.unit_id=v_unit))
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_inserted=ROW_COUNT;
  IF v_inserted=0 THEN RETURN jsonb_build_object('credited',false,'reason','duplicate'); END IF;
  SELECT up.status INTO v_status FROM public.user_progress up
  JOIN public.learning_units u ON u.id=up.unit_id AND u.is_active
  JOIN public.profiles p ON p.id=up.user_id AND u.hsk_level<=p.hsk_level
  WHERE up.user_id=p_profile_id AND up.unit_id=v_unit FOR UPDATE OF up;
  IF p_score IS NULL OR v_status IS NULL OR v_status='locked' THEN
    RETURN jsonb_build_object('credited',false,'reason','unscored_or_unavailable','unit_id',v_unit);
  END IF;
  SELECT greatest(p_score,coalesce(max(score),0)),count(*)+1 INTO v_best,v_attempts
  FROM public.verified_practice_credits WHERE user_id=p_profile_id AND unit_id=v_unit AND credited;
  UPDATE public.user_progress SET best_score=v_best,attempts=v_attempts,
    status=CASE WHEN v_best>=80 THEN 'mastered' WHEN v_best>=65 THEN 'completed' ELSE 'in_progress' END,
    started_at=coalesce((SELECT min(created_at) FROM public.verified_practice_credits WHERE user_id=p_profile_id AND unit_id=v_unit AND credited),now()),
    completed_at=CASE WHEN v_best>=65 THEN coalesce((SELECT min(created_at) FROM public.verified_practice_credits WHERE user_id=p_profile_id AND unit_id=v_unit AND credited AND score>=65),now()) ELSE NULL END,
    mastered_at=CASE WHEN v_best>=80 THEN coalesce((SELECT min(created_at) FROM public.verified_practice_credits WHERE user_id=p_profile_id AND unit_id=v_unit AND credited AND score>=80),now()) ELSE NULL END
  WHERE user_id=p_profile_id AND unit_id=v_unit;
  SELECT n.* INTO v_next FROM public.learning_units u JOIN public.learning_units n
    ON n.hsk_level=u.hsk_level AND n.sort_order>u.sort_order AND n.is_active
    WHERE u.id=v_unit ORDER BY n.sort_order LIMIT 1;
  IF v_next.id IS NOT NULL AND v_best>=coalesce(v_next.unlock_score,65) THEN
    INSERT INTO public.user_progress(user_id,unit_id,status) VALUES(p_profile_id,v_next.id,'available')
    ON CONFLICT(user_id,unit_id) DO UPDATE SET status='available' WHERE user_progress.status='locked';
  END IF;
  UPDATE public.verified_practice_credits SET credited=true WHERE kind=p_kind AND source_id=p_source_id;
  RETURN jsonb_build_object('credited',true,'unit_id',v_unit);
END $$;
REVOKE ALL ON FUNCTION public.credit_verified_practice(uuid,text,uuid,integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.credit_verified_practice(uuid,text,uuid,integer) TO service_role;
DROP POLICY IF EXISTS "Users can CRUD own progress" ON public.user_progress;
CREATE POLICY "Users can read own progress" ON public.user_progress FOR SELECT TO authenticated USING(user_id IN(SELECT id FROM public.profiles WHERE auth_id=(SELECT auth.uid())));
REVOKE INSERT,UPDATE,DELETE ON public.user_progress FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.save_verified_audio_practice(p_profile_id uuid,p_kind text,p_source_id uuid,p_content_id text,p_score integer,p_transcript text,p_errors jsonb DEFAULT '[]'::jsonb,p_assessment jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE v_result jsonb; v_existing public.verified_practice_credits;
BEGIN
  IF p_kind NOT IN ('shadowing','dubbing') OR p_score IS NULL OR p_score<0 OR p_score>100 OR length(trim(coalesce(p_transcript,'')))=0 THEN RAISE EXCEPTION 'Invalid assessment'; END IF;
  PERFORM public.ensure_learning_progress(p_profile_id);
  SELECT * INTO v_existing FROM public.verified_practice_credits WHERE kind=p_kind AND source_id=p_source_id;
  IF FOUND THEN
    IF v_existing.user_id<>p_profile_id THEN RAISE EXCEPTION 'Practice not owned'; END IF;
    RETURN jsonb_build_object('source_id',p_source_id,'credited',v_existing.credited,'unit_id',v_existing.unit_id,'duplicate',true,'assessment',v_existing.assessment);
  END IF;
  IF p_kind='shadowing' THEN
    IF NOT EXISTS(SELECT 1 FROM public.shadowing_sentences WHERE id=p_content_id AND is_active) THEN RAISE EXCEPTION 'Sentence unavailable'; END IF;
    INSERT INTO public.shadowing_records(id,user_id,sentence_id,transcript_match_score,pronunciation_score,tone_score,fluency_score,transcript,errors)
    VALUES(p_source_id,p_profile_id,p_content_id,p_score,NULL,NULL,NULL,p_transcript,p_errors);
  ELSE
    IF NOT EXISTS(SELECT 1 FROM public.dubbing_clips WHERE id=p_content_id AND is_active) THEN RAISE EXCEPTION 'Clip unavailable'; END IF;
    INSERT INTO public.dubbing_performances(id,user_id,clip_id,total_score,pronunciation_score,tone_score,emotion_score,rhythm_score,fluency_score,transcript,mode)
    VALUES(p_source_id,p_profile_id,p_content_id,p_score,NULL,NULL,NULL,NULL,NULL,p_transcript,'perform');
  END IF;
  v_result:=public.credit_verified_practice(p_profile_id,p_kind,p_source_id,p_score);
  p_assessment:=p_assessment || jsonb_build_object('transcript',p_transcript,'transcript_match_score',p_score);
  UPDATE public.verified_practice_credits SET assessment=p_assessment WHERE kind=p_kind AND source_id=p_source_id;
  RETURN v_result || jsonb_build_object('source_id',p_source_id,'duplicate',false,'assessment',p_assessment);
END $$;
REVOKE ALL ON FUNCTION public.save_verified_audio_practice(uuid,text,uuid,text,integer,text,jsonb,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_verified_audio_practice(uuid,text,uuid,text,integer,text,jsonb,jsonb) TO service_role;
