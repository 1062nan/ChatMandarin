-- Snapshot trusted session settings and turns. Mutable legacy records never unlock units.
ALTER TABLE public.verified_conversation_sessions
  ADD COLUMN hsk_level smallint,
  ADD COLUMN correction_mode text,
  ADD COLUMN verified boolean NOT NULL DEFAULT false;
CREATE TABLE public.verified_conversation_turns (
  conversation_id uuid NOT NULL REFERENCES public.verified_conversation_sessions(conversation_id) ON DELETE CASCADE,
  turn_index integer NOT NULL CHECK(turn_index>=0),
  turn_data jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(conversation_id,turn_index)
);
ALTER TABLE public.verified_conversation_turns ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.verified_conversation_turns FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.verified_conversation_turns TO service_role;

CREATE OR REPLACE FUNCTION public.start_verified_conversation(p_profile_id uuid,p_scenario text,p_hsk_level integer,p_correction_mode text)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE v_conversation public.conversations;
BEGIN
  IF p_hsk_level IS NULL OR p_hsk_level NOT BETWEEN 1 AND 6 OR p_correction_mode NOT IN ('friendly','strict','tutor') THEN RAISE EXCEPTION 'Invalid settings'; END IF;
  PERFORM public.ensure_learning_progress(p_profile_id);
  IF NOT EXISTS(SELECT 1 FROM public.scenarios WHERE id=p_scenario AND is_active) THEN RAISE EXCEPTION 'Scenario unavailable'; END IF;
  INSERT INTO public.conversations(user_id,scenario,hsk_level,correction_mode)
    VALUES(p_profile_id,p_scenario,p_hsk_level,p_correction_mode) RETURNING * INTO v_conversation;
  INSERT INTO public.verified_conversation_sessions(conversation_id,user_id,scenario_id,hsk_level,correction_mode,verified)
    VALUES(v_conversation.id,p_profile_id,p_scenario,p_hsk_level,p_correction_mode,true);
  RETURN to_jsonb(v_conversation);
END $$;
REVOKE ALL ON FUNCTION public.start_verified_conversation(uuid,text,integer,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.start_verified_conversation(uuid,text,integer,text) TO service_role;

CREATE OR REPLACE FUNCTION public.save_verified_conversation_turn(p_profile_id uuid,p_conversation_id uuid,p_turn_index integer,p_turn jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE v_session public.verified_conversation_sessions; v_existing jsonb; v_turn public.conversation_turns; v_count integer; v_grammar integer; v_word integer;
BEGIN
  PERFORM public.ensure_learning_progress(p_profile_id);
  SELECT * INTO v_session FROM public.verified_conversation_sessions WHERE conversation_id=p_conversation_id FOR UPDATE;
  IF NOT FOUND OR v_session.user_id<>p_profile_id OR NOT v_session.verified THEN RAISE EXCEPTION 'Verified conversation not owned'; END IF;
  SELECT turn_data INTO v_existing FROM public.verified_conversation_turns WHERE conversation_id=p_conversation_id AND turn_index=p_turn_index;
  IF FOUND THEN RETURN v_existing || jsonb_build_object('duplicate',true); END IF;
  IF v_session.completed_at IS NOT NULL THEN RAISE EXCEPTION 'Conversation has ended'; END IF;
  SELECT count(*) INTO v_count FROM public.verified_conversation_turns WHERE conversation_id=p_conversation_id;
  IF p_turn_index IS NULL OR p_turn_index<>v_count THEN RAISE EXCEPTION 'Unexpected turn index'; END IF;
  IF length(trim(coalesce(p_turn->>'user_text','')))=0 THEN RAISE EXCEPTION 'Empty practice'; END IF;
  v_grammar:=(p_turn->>'grammar_score')::integer; v_word:=(p_turn->>'word_choice_score')::integer;
  IF v_grammar NOT BETWEEN 0 AND 100 OR v_word NOT BETWEEN 0 AND 100 THEN RAISE EXCEPTION 'Invalid score'; END IF;
  INSERT INTO public.conversation_turns(conversation_id,turn_index,user_text,ai_text,errors,grammar_score,word_choice_score,pronunciation_score,fluency_score,user_audio_duration_ms,ai_response_latency_ms)
    VALUES(p_conversation_id,p_turn_index,p_turn->>'user_text',p_turn->>'ai_text',coalesce(p_turn->'errors','[]'::jsonb),v_grammar,v_word,NULL,NULL,(p_turn->>'user_audio_duration_ms')::integer,(p_turn->>'ai_response_latency_ms')::integer)
    RETURNING * INTO v_turn;
  v_existing:=to_jsonb(v_turn) || jsonb_build_object('conversation_complete',coalesce((p_turn->>'conversation_complete')::boolean,false),'encouragement',p_turn->>'encouragement');
  INSERT INTO public.verified_conversation_turns(conversation_id,turn_index,turn_data) VALUES(p_conversation_id,p_turn_index,v_existing);
  UPDATE public.conversations SET total_turns=v_count+1,avg_pronunciation=NULL,avg_fluency=NULL,
    avg_grammar=(SELECT round(avg((turn_data->>'grammar_score')::numeric)) FROM public.verified_conversation_turns WHERE conversation_id=p_conversation_id),
    avg_word_choice=(SELECT round(avg((turn_data->>'word_choice_score')::numeric)) FROM public.verified_conversation_turns WHERE conversation_id=p_conversation_id)
    WHERE id=p_conversation_id AND user_id=p_profile_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Conversation not owned'; END IF;
  RETURN v_existing || jsonb_build_object('duplicate',false);
END $$;
REVOKE ALL ON FUNCTION public.save_verified_conversation_turn(uuid,uuid,integer,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_verified_conversation_turn(uuid,uuid,integer,jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.end_verified_conversation(p_profile_id uuid,p_conversation_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE v_session public.verified_conversation_sessions; v_legacy public.conversations; v_count integer; v_score integer; v_grammar numeric; v_word numeric; v_streak integer; v_today date:=(now() AT TIME ZONE 'UTC')::date; v_profile public.profiles; v_progress jsonb;
BEGIN
  -- All practice writers lock profile before session: consistent ordering and no lost increments.
  SELECT * INTO v_profile FROM public.profiles WHERE id=p_profile_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Profile not found'; END IF;
  SELECT * INTO v_session FROM public.verified_conversation_sessions WHERE conversation_id=p_conversation_id FOR UPDATE;
  IF NOT FOUND THEN
    SELECT * INTO v_legacy FROM public.conversations WHERE id=p_conversation_id AND user_id=p_profile_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Conversation not owned'; END IF;
    INSERT INTO public.verified_conversation_sessions(conversation_id,user_id,scenario_id,hsk_level,correction_mode,verified,completed_at)
      VALUES(p_conversation_id,p_profile_id,v_legacy.scenario,v_legacy.hsk_level,v_legacy.correction_mode,false,v_legacy.ended_at) RETURNING * INTO v_session;
  END IF;
  IF v_session.user_id<>p_profile_id THEN RAISE EXCEPTION 'Conversation not owned'; END IF;
  IF v_session.completed_at IS NOT NULL THEN RETURN jsonb_build_object('ended',false); END IF;
  IF v_session.verified THEN
    SELECT count(*),round(avg((turn_data->>'grammar_score')::numeric)),round(avg((turn_data->>'word_choice_score')::numeric))
      INTO v_count,v_grammar,v_word FROM public.verified_conversation_turns WHERE conversation_id=p_conversation_id;
    SELECT round(avg(score)) INTO v_score FROM (
      SELECT (turn_data->>'grammar_score')::numeric score FROM public.verified_conversation_turns WHERE conversation_id=p_conversation_id
      UNION ALL SELECT (turn_data->>'word_choice_score')::numeric FROM public.verified_conversation_turns WHERE conversation_id=p_conversation_id
    ) measured WHERE score IS NOT NULL;
    UPDATE public.conversations SET total_turns=v_count,avg_grammar=v_grammar,avg_word_choice=v_word,avg_pronunciation=NULL,avg_fluency=NULL
      WHERE id=p_conversation_id AND user_id=p_profile_id;
  ELSE
    -- Legacy sessions may finish but their client-editable scores cannot award progression.
    SELECT count(*) INTO v_count FROM public.conversation_turns WHERE conversation_id=p_conversation_id AND length(trim(coalesce(user_text,'')))>0;
  END IF;
  UPDATE public.conversations SET ended_at=now() WHERE id=p_conversation_id AND user_id=p_profile_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Conversation not owned'; END IF;
  UPDATE public.verified_conversation_sessions SET completed_at=now() WHERE conversation_id=p_conversation_id;
  IF v_count=0 THEN RETURN jsonb_build_object('ended',true,'credited',false); END IF;
  v_streak:=CASE WHEN v_profile.last_practice_date=v_today THEN coalesce(v_profile.current_streak,0) WHEN v_profile.last_practice_date=v_today-1 THEN coalesce(v_profile.current_streak,0)+1 ELSE 1 END;
  UPDATE public.profiles SET total_conversations=coalesce(total_conversations,0)+1,current_streak=v_streak,longest_streak=greatest(coalesce(longest_streak,0),v_streak),last_practice_date=v_today WHERE id=p_profile_id;
  IF v_session.verified THEN v_progress:=public.credit_verified_practice(p_profile_id,'conversation',p_conversation_id,v_score); END IF;
  RETURN jsonb_build_object('ended',true,'progress',v_progress);
END $$;
REVOKE ALL ON FUNCTION public.end_verified_conversation(uuid,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.end_verified_conversation(uuid,uuid) TO service_role;
