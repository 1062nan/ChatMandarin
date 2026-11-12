-- Standalone free audio anti-abuse budget, separate from purchased/practice quotas.
-- No text/audio is stored. Only the application service can reserve usage.
CREATE TABLE public.tts_usage (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  usage_date date NOT NULL,
  characters integer NOT NULL DEFAULT 0 CHECK (characters >= 0),
  minute_start timestamptz NOT NULL,
  requests integer NOT NULL DEFAULT 0 CHECK (requests >= 0)
);
ALTER TABLE public.tts_usage ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.tts_usage FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.tts_usage TO service_role;
CREATE FUNCTION public.reserve_free_tts(p_profile_id uuid, p_characters integer)
RETURNS TABLE(allowed boolean, reason text, retry_after integer)
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  v_now timestamptz := clock_timestamp();
  v_day date := (v_now AT TIME ZONE 'UTC')::date;
  v_minute timestamptz := date_trunc('minute', v_now);
  v public.tts_usage%ROWTYPE;
BEGIN
  IF p_characters IS NULL OR p_characters < 1 OR p_characters > 500 THEN
    RAISE EXCEPTION 'Invalid character count' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.tts_usage(user_id, usage_date, minute_start)
    VALUES(p_profile_id,v_day,v_minute) ON CONFLICT DO NOTHING;
  SELECT * INTO v FROM public.tts_usage WHERE user_id=p_profile_id FOR UPDATE;
  v_now := clock_timestamp();
  v_day := (v_now AT TIME ZONE 'UTC')::date;
  v_minute := date_trunc('minute', v_now);
  IF v.usage_date <> v_day THEN v.characters := 0; END IF;
  IF v.minute_start <> v_minute THEN v.requests := 0; END IF;
  IF v.characters + p_characters > 10000 THEN
    RETURN QUERY SELECT false,'daily_limit'::text,
      greatest(1,ceil(extract(epoch FROM ((v_day+1)::timestamp AT TIME ZONE 'UTC')-v_now))::integer);
    RETURN;
  END IF;
  IF v.requests >= 20 THEN
    RETURN QUERY SELECT false,'rate_limit'::text,
      greatest(1,ceil(extract(epoch FROM v_minute+interval '1 minute'-v_now))::integer);
    RETURN;
  END IF;
  UPDATE public.tts_usage SET usage_date=v_day, characters=v.characters+p_characters,
    minute_start=v_minute, requests=v.requests+1 WHERE user_id=p_profile_id;
  RETURN QUERY SELECT true,NULL::text,0;
END;
$$;
REVOKE ALL ON FUNCTION public.reserve_free_tts(uuid,integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_free_tts(uuid,integer) TO service_role;
