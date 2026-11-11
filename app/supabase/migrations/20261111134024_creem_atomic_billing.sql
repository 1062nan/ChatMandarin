-- Additive billing state. Existing event receipts and subscriptions are not rewritten.
-- Only a service-role server that verified the raw webhook signature may call this RPC.
ALTER TABLE public.webhook_events ADD COLUMN IF NOT EXISTS payload_hash text;
ALTER TABLE public.webhook_events ADD COLUMN IF NOT EXISTS provider_created_at timestamptz;
ALTER TABLE public.webhook_events ADD COLUMN IF NOT EXISTS outcome text;
CREATE TABLE public.creem_subscription_event_state (
  subscription_id text PRIMARY KEY,
  profile_id uuid NOT NULL REFERENCES public.profiles(id),
  last_event_at timestamptz NOT NULL,
  last_event_id text NOT NULL,
  plan text NOT NULL CHECK(plan IN ('free','plus','pro')),
  status text NOT NULL CHECK(status IN ('active','trialing','past_due','canceled','expired')),
  period_end timestamptz,
  cancel_at_period_end boolean NOT NULL
);
ALTER TABLE public.creem_subscription_event_state ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.creem_subscription_event_state FROM PUBLIC,anon,authenticated;
REVOKE ALL ON public.webhook_events FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON public.creem_subscription_event_state,public.webhook_events TO service_role;

CREATE FUNCTION public.apply_creem_subscription_event(
  p_event_id text,p_event_type text,p_event_hash text,p_event_created_at timestamptz,
  p_subscription_id text,p_profile_id uuid,p_plan text,p_status text,
  p_period_end timestamptz,p_cancel_at_period_end boolean
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE
  v_event public.webhook_events%ROWTYPE;
  v_state public.creem_subscription_event_state%ROWTYPE;
  v_sub public.subscriptions%ROWTYPE;
  v_profile uuid;
  v_plan text;
  v_state_exists boolean;
  v_sub_exists boolean;
  v_outcome text:='applied';
BEGIN
  IF p_event_id IS NULL OR length(p_event_id) NOT BETWEEN 1 AND 255
    OR p_event_type IS NULL OR length(p_event_type) NOT BETWEEN 1 AND 100
    OR p_event_hash IS NULL OR p_event_hash !~ '^[0-9a-f]{64}$'
    OR p_event_created_at IS NULL OR NOT isfinite(p_event_created_at)
    OR p_event_created_at<'2000-01-01'::timestamptz OR p_event_created_at>now()+interval '5 minutes'
    OR p_subscription_id IS NULL OR length(p_subscription_id) NOT BETWEEN 1 AND 255
    OR p_status IS NULL OR p_status NOT IN ('active','trialing','past_due','canceled','expired')
    OR (p_plan IS NOT NULL AND p_plan NOT IN ('free','plus','pro'))
    OR p_cancel_at_period_end IS NULL
    OR (p_period_end IS NOT NULL AND NOT isfinite(p_period_end)) THEN
    RAISE EXCEPTION 'Invalid billing event' USING ERRCODE='22023';
  END IF;
  -- Defense in depth: the service route must not grant access for unsupported events.
  IF p_event_type NOT IN ('subscription.active','subscription.paid','subscription.trialing',
    'subscription.update','subscription.scheduled_cancel','subscription.canceled',
    'subscription.past_due','subscription.paused','subscription.unpaid','subscription.expired')
    OR (p_event_type IN ('subscription.active','subscription.paid') AND (p_status <> 'active' OR p_cancel_at_period_end))
    OR (p_event_type = 'subscription.trialing' AND (p_status <> 'trialing' OR p_cancel_at_period_end))
    OR (p_event_type = 'subscription.scheduled_cancel' AND (p_status <> 'active' OR NOT p_cancel_at_period_end))
    OR (p_event_type = 'subscription.canceled' AND (p_status <> 'canceled' OR NOT p_cancel_at_period_end))
    OR (p_event_type IN ('subscription.past_due','subscription.paused','subscription.unpaid') AND (p_status <> 'past_due' OR p_cancel_at_period_end))
    OR (p_event_type = 'subscription.expired' AND (p_status <> 'expired' OR p_cancel_at_period_end))
    OR (p_status = 'canceled' AND NOT p_cancel_at_period_end)
    OR (p_cancel_at_period_end AND (p_status NOT IN ('active','canceled') OR p_period_end IS NULL)) THEN
    RAISE EXCEPTION 'Inconsistent billing event state' USING ERRCODE='22023';
  END IF;
  -- Serialize a repeated event before any mutation, not just when writing its receipt.
  PERFORM pg_advisory_xact_lock(hashtextextended('creem-event:'||p_event_id,0));
  SELECT * INTO v_event FROM public.webhook_events WHERE event_id=p_event_id;
  IF FOUND THEN
    IF v_event.payload_hash IS NOT NULL AND v_event.payload_hash<>p_event_hash THEN
      RAISE EXCEPTION 'Event payload conflicts with receipt' USING ERRCODE='22023';
    END IF;
    RETURN jsonb_build_object('outcome','duplicate');
  END IF;
  -- Serialize the provider subscription even when its immutable ownership row is new.
  PERFORM pg_advisory_xact_lock(hashtextextended('creem-sub:'||p_subscription_id,0));
  SELECT * INTO v_state FROM public.creem_subscription_event_state WHERE subscription_id=p_subscription_id FOR UPDATE;
  v_state_exists:=FOUND;
  SELECT * INTO v_sub FROM public.subscriptions WHERE provider_subscription_id=p_subscription_id;
  v_sub_exists:=FOUND;
  v_profile:=COALESCE(v_state.profile_id,v_sub.user_id,p_profile_id);
  IF v_profile IS NULL OR (p_profile_id IS NOT NULL AND p_profile_id<>v_profile)
    OR (v_sub_exists AND v_sub.payment_provider IS DISTINCT FROM 'creem') THEN
    RETURN jsonb_build_object('outcome','conflict');
  END IF;
  -- Every event for a user takes this lock, so different subscription IDs cannot race to replace it.
  PERFORM 1 FROM public.profiles WHERE id=v_profile FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('outcome','conflict'); END IF;
  SELECT * INTO v_sub FROM public.subscriptions WHERE user_id=v_profile FOR UPDATE;
  v_sub_exists:=FOUND;
  IF v_sub_exists AND v_sub.provider_subscription_id IS NOT NULL
    AND (v_sub.provider_subscription_id<>p_subscription_id OR v_sub.payment_provider IS DISTINCT FROM 'creem') THEN
    RETURN jsonb_build_object('outcome','conflict');
  END IF;
  IF NOT v_sub_exists AND p_status NOT IN ('active','trialing') THEN
    RETURN jsonb_build_object('outcome','conflict');
  END IF;
  v_plan:=COALESCE(p_plan,v_state.plan,v_sub.plan);
  IF v_plan IS NULL OR (p_status IN ('active','trialing') AND v_plan NOT IN ('plus','pro')) THEN
    RETURN jsonb_build_object('outcome','conflict');
  END IF;
  IF v_state_exists AND p_event_created_at<v_state.last_event_at THEN
    v_outcome:='stale';
  ELSIF v_state_exists AND p_event_created_at=v_state.last_event_at THEN
    IF v_state.plan IS DISTINCT FROM v_plan OR v_state.status IS DISTINCT FROM p_status
      OR v_state.period_end IS DISTINCT FROM p_period_end
      OR v_state.cancel_at_period_end IS DISTINCT FROM p_cancel_at_period_end THEN
      -- Do not invent an ordering for simultaneous conflicting provider events.
      RETURN jsonb_build_object('outcome','conflict');
    END IF;
    v_outcome:='duplicate';
  ELSE
    INSERT INTO public.subscriptions(user_id,provider_subscription_id,payment_provider,plan,status,current_period_end,cancel_at_period_end)
      VALUES(v_profile,p_subscription_id,'creem',v_plan,p_status,p_period_end,p_cancel_at_period_end)
      ON CONFLICT(user_id) DO UPDATE SET
        provider_subscription_id=EXCLUDED.provider_subscription_id,payment_provider='creem',
        plan=EXCLUDED.plan,status=EXCLUDED.status,current_period_end=EXCLUDED.current_period_end,
        cancel_at_period_end=EXCLUDED.cancel_at_period_end,updated_at=now();
    INSERT INTO public.creem_subscription_event_state(subscription_id,profile_id,last_event_at,last_event_id,plan,status,period_end,cancel_at_period_end)
      VALUES(p_subscription_id,v_profile,p_event_created_at,p_event_id,v_plan,p_status,p_period_end,p_cancel_at_period_end)
      ON CONFLICT(subscription_id) DO UPDATE SET
        last_event_at=EXCLUDED.last_event_at,last_event_id=EXCLUDED.last_event_id,
        plan=EXCLUDED.plan,status=EXCLUDED.status,period_end=EXCLUDED.period_end,cancel_at_period_end=EXCLUDED.cancel_at_period_end;
  END IF;
  INSERT INTO public.webhook_events(event_id,event_name,subscription_id,payload_hash,provider_created_at,outcome)
    VALUES(p_event_id,p_event_type,p_subscription_id,p_event_hash,p_event_created_at,v_outcome);
  RETURN jsonb_build_object('outcome',v_outcome);
END;
$$;
REVOKE ALL ON FUNCTION public.apply_creem_subscription_event(text,text,text,timestamptz,text,uuid,text,text,timestamptz,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.apply_creem_subscription_event(text,text,text,timestamptz,text,uuid,text,text,timestamptz,boolean) TO service_role;

-- Scheduled cancellation must expire even if the provider's final webhook is delayed.
-- Keep numeric quota policy unchanged; these are the same existing quota functions.
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
    WHEN plan IN ('plus', 'pro') AND status IN ('active', 'trialing')
      AND (NOT COALESCE(cancel_at_period_end,FALSE) OR current_period_end > CURRENT_TIMESTAMP) THEN plan
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
    WHEN plan IN ('plus', 'pro') AND status IN ('active', 'trialing')
      AND (NOT COALESCE(cancel_at_period_end,FALSE) OR current_period_end > CURRENT_TIMESTAMP) THEN plan
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

REVOKE ALL ON FUNCTION public.consume_practice_quota(UUID, TEXT) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.consume_conversation_seconds(UUID, INT) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.consume_practice_quota(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.consume_conversation_seconds(UUID, INT) TO authenticated;
