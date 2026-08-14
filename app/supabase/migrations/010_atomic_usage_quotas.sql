-- 010: enforce practice quotas atomically behind RLS.
-- The earlier application-side read/update sequence could lose increments under
-- concurrency, and authenticated clients had SELECT-only policies on usage rows.

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
SET search_path = public
AS $$
DECLARE
  v_plan TEXT := 'free';
  v_today DATE := (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::DATE;
  v_year_month TEXT := TO_CHAR((CURRENT_TIMESTAMP AT TIME ZONE 'UTC'), 'YYYY-MM');
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

  IF p_feature NOT IN ('hskk', 'shadowing', 'dubbing') THEN
    RAISE EXCEPTION 'unsupported quota feature'
      USING ERRCODE = '22023';
  END IF;

  SELECT CASE
    WHEN plan IN ('plus', 'pro') AND status IN ('active', 'trialing') THEN plan
    WHEN plan IN ('plus', 'pro') AND status = 'canceled'
      AND current_period_end > CURRENT_TIMESTAMP THEN plan
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
    v_monthly_limit := 3;
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

    SELECT COALESCE(hskk_count, 0)
    INTO v_monthly_used
    FROM public.usage_monthly
    WHERE user_id = p_profile_id AND year_month = v_year_month
    FOR UPDATE;
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
    UPDATE public.usage_monthly SET hskk_count = v_monthly_used + 1
    WHERE user_id = p_profile_id AND year_month = v_year_month;
  ELSIF p_feature = 'shadowing' THEN
    UPDATE public.usage_stats SET shadowing_count = v_daily_used + 1
    WHERE user_id = p_profile_id AND date = v_today;
  ELSE
    UPDATE public.usage_stats SET dubbing_count = v_daily_used + 1
    WHERE user_id = p_profile_id AND date = v_today;
  END IF;

  RETURN QUERY SELECT TRUE, NULL::TEXT,
    CASE WHEN v_daily_limit IS NULL THEN NULL ELSE GREATEST(0, v_daily_limit - v_daily_used - 1) END,
    CASE WHEN v_monthly_limit IS NULL THEN NULL ELSE GREATEST(0, v_monthly_limit - v_monthly_used - 1) END;
END;
$$;

CREATE OR REPLACE FUNCTION public.consume_conversation_seconds(
  p_profile_id UUID,
  p_seconds INT
)
RETURNS TABLE (allowed BOOLEAN, daily_remaining INT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan TEXT := 'free';
  v_today DATE := (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::DATE;
  v_used INT := 0;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = p_profile_id AND auth_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'profile is not owned by the current user'
      USING ERRCODE = '42501';
  END IF;

  IF p_seconds < 1 OR p_seconds > 600 THEN
    RAISE EXCEPTION 'invalid conversation duration'
      USING ERRCODE = '22023';
  END IF;

  SELECT CASE
    WHEN plan IN ('plus', 'pro') AND status IN ('active', 'trialing') THEN plan
    WHEN plan IN ('plus', 'pro') AND status = 'canceled'
      AND current_period_end > CURRENT_TIMESTAMP THEN plan
    ELSE 'free'
  END
  INTO v_plan
  FROM public.subscriptions
  WHERE user_id = p_profile_id;
  v_plan := COALESCE(v_plan, 'free');

  INSERT INTO public.usage_stats (user_id, date)
  VALUES (p_profile_id, v_today)
  ON CONFLICT (user_id, date) DO NOTHING;

  SELECT COALESCE(conversation_seconds, 0)
  INTO v_used
  FROM public.usage_stats
  WHERE user_id = p_profile_id AND date = v_today
  FOR UPDATE;

  IF v_plan = 'free' AND v_used + p_seconds > 300 THEN
    RETURN QUERY SELECT FALSE, GREATEST(0, 300 - v_used);
    RETURN;
  END IF;

  UPDATE public.usage_stats
  SET conversation_seconds = v_used + p_seconds,
      conversation_count = COALESCE(conversation_count, 0) + 1
  WHERE user_id = p_profile_id AND date = v_today;

  RETURN QUERY SELECT TRUE,
    CASE WHEN v_plan = 'free' THEN GREATEST(0, 300 - v_used - p_seconds) ELSE NULL END;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_practice_quota(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.consume_conversation_seconds(UUID, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.consume_practice_quota(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.consume_conversation_seconds(UUID, INT) TO authenticated;
