-- Additive prelaunch gate. Existing total usage is never reset or retrocharged
-- as bonus usage. Keep this OFF until the cost/plan launch review is complete.
ALTER TABLE public.usage_monthly ADD COLUMN plus_hskk_bonus_count integer NOT NULL DEFAULT 0
  CHECK (plus_hskk_bonus_count >= 0);
CREATE TABLE public.plus_speaking_allowance_config (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  enabled boolean NOT NULL DEFAULT false
);
INSERT INTO public.plus_speaking_allowance_config(singleton,enabled) VALUES(true,false);
ALTER TABLE public.plus_speaking_allowance_config ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.plus_speaking_allowance_config FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT,UPDATE ON public.plus_speaking_allowance_config TO service_role;

CREATE FUNCTION public.plus_speaking_allowance_enabled()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT COALESCE((SELECT enabled FROM public.plus_speaking_allowance_config WHERE singleton),false)
$$;
REVOKE ALL ON FUNCTION public.plus_speaking_allowance_enabled() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.plus_speaking_allowance_enabled() TO authenticated,service_role;

CREATE OR REPLACE FUNCTION public.consume_practice_quota(
  p_profile_id UUID,
  p_feature TEXT
)
RETURNS TABLE (
  allowed BOOLEAN,
  reason TEXT,
  daily_remaining INT,
  monthly_remaining INT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_plan TEXT := 'free';
  v_now timestamptz;
  v_today DATE;
  v_year_month TEXT;
  v_bonus_enabled boolean := false;
  v_bonus_used integer := 0;
  v_use_bonus boolean := false;
  v_daily_limit INT;
  v_monthly_limit INT;
  v_daily_used INT := 0;
  v_monthly_used INT := 0;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = p_profile_id AND auth_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'profile is not owned by the current user'
      USING ERRCODE = '42501';
  END IF;

  IF p_feature IS NULL OR p_feature NOT IN ('hskk', 'shadowing', 'dubbing') THEN
    RAISE EXCEPTION 'unsupported quota feature'
      USING ERRCODE = '22023';
  END IF;

  -- Serialize ownership/quota transitions, including absent daily/monthly rows.
  -- Sample UTC time only after this lock so a waiter crossing midnight is charged
  -- to the day on which its reservation is actually made.
  PERFORM 1 FROM public.profiles WHERE id=p_profile_id FOR UPDATE;
  v_now := clock_timestamp();
  v_today := (v_now AT TIME ZONE 'UTC')::date;
  v_year_month := to_char(v_now AT TIME ZONE 'UTC','YYYY-MM');

  SELECT CASE
    WHEN plan IN ('plus', 'pro') AND status IN ('active', 'trialing')
      AND (NOT COALESCE(cancel_at_period_end,FALSE) OR current_period_end > v_now) THEN plan
    WHEN plan IN ('plus', 'pro') AND status = 'canceled'
      AND current_period_end > v_now THEN plan
    ELSE 'free'
  END
  INTO v_plan
  FROM public.subscriptions
  WHERE user_id = p_profile_id;

  v_plan := COALESCE(v_plan, 'free');

  IF p_feature = 'dubbing' AND v_plan = 'free' THEN
    RETURN QUERY SELECT FALSE, 'not_in_plan'::TEXT, NULL::INT, NULL::INT;
    RETURN;
  END IF;

  IF p_feature = 'shadowing' AND v_plan = 'free' THEN
    v_daily_limit := 5;
  ELSIF p_feature = 'hskk' AND v_plan = 'free' THEN
    v_daily_limit := 1;
  ELSIF p_feature = 'hskk' AND v_plan = 'plus' THEN
    v_bonus_enabled := public.plus_speaking_allowance_enabled();
    IF NOT v_bonus_enabled THEN v_monthly_limit := 3; END IF;
  END IF;

  INSERT INTO public.usage_stats (user_id, date)
  VALUES (p_profile_id, v_today)
  ON CONFLICT (user_id, date) DO NOTHING;

  SELECT CASE p_feature
    WHEN 'hskk' THEN COALESCE(hskk_count, 0)
    WHEN 'shadowing' THEN COALESCE(shadowing_count, 0)
    ELSE COALESCE(dubbing_count, 0)
  END
  INTO v_daily_used
  FROM public.usage_stats
  WHERE user_id = p_profile_id AND date = v_today
  FOR UPDATE;

  IF p_feature = 'hskk' THEN
    INSERT INTO public.usage_monthly (user_id, year_month)
    VALUES (p_profile_id, v_year_month)
    ON CONFLICT (user_id, year_month) DO NOTHING;

    SELECT COALESCE(hskk_count, 0), plus_hskk_bonus_count
    INTO v_monthly_used, v_bonus_used
    FROM public.usage_monthly
    WHERE user_id = p_profile_id AND year_month = v_year_month
    FOR UPDATE;
  END IF;

  IF v_bonus_enabled THEN
    v_use_bonus := v_daily_used >= 1;
    IF v_use_bonus AND v_bonus_used >= 10 THEN
      RETURN QUERY SELECT FALSE, 'monthly_exceeded'::text, 0, 0;
      RETURN;
    END IF;
  END IF;

  IF v_daily_limit IS NOT NULL AND v_daily_used >= v_daily_limit THEN
    RETURN QUERY SELECT FALSE, 'daily_exceeded'::TEXT, 0, NULL::INT;
    RETURN;
  END IF;

  IF v_monthly_limit IS NOT NULL AND v_monthly_used >= v_monthly_limit THEN
    RETURN QUERY SELECT FALSE, 'monthly_exceeded'::TEXT,
      CASE WHEN v_daily_limit IS NULL THEN NULL ELSE GREATEST(0, v_daily_limit - v_daily_used) END,
      0;
    RETURN;
  END IF;

  IF p_feature = 'hskk' THEN
    UPDATE public.usage_stats SET hskk_count = v_daily_used + 1
    WHERE user_id = p_profile_id AND date = v_today;
    UPDATE public.usage_monthly SET hskk_count = v_monthly_used + 1,
      plus_hskk_bonus_count = v_bonus_used + CASE WHEN v_use_bonus THEN 1 ELSE 0 END
    WHERE user_id = p_profile_id AND year_month = v_year_month;
  ELSIF p_feature = 'shadowing' THEN
    UPDATE public.usage_stats SET shadowing_count = v_daily_used + 1
    WHERE user_id = p_profile_id AND date = v_today;
  ELSE
    UPDATE public.usage_stats SET dubbing_count = v_daily_used + 1
    WHERE user_id = p_profile_id AND date = v_today;
  END IF;

  RETURN QUERY SELECT TRUE, NULL::TEXT,
    CASE WHEN v_bonus_enabled THEN 0 WHEN v_daily_limit IS NULL THEN NULL ELSE GREATEST(0, v_daily_limit - v_daily_used - 1) END,
    CASE WHEN v_bonus_enabled THEN GREATEST(0,10-v_bonus_used-CASE WHEN v_use_bonus THEN 1 ELSE 0 END)
      WHEN v_monthly_limit IS NULL THEN NULL ELSE GREATEST(0, v_monthly_limit - v_monthly_used - 1) END;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_practice_quota(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.consume_practice_quota(uuid,text) TO authenticated;
