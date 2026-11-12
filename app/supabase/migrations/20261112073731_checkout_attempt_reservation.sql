-- Private, durable checkout reservation. Never automatically expire an uncertain
-- provider call: request_id is correlation, not a documented idempotency guarantee.
CREATE TABLE public.creem_checkout_attempts (
  profile_id uuid PRIMARY KEY REFERENCES public.profiles(id),
  attempt_id uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  plan text NOT NULL CHECK (plan IN ('plus','pro')),
  product_id text NOT NULL CHECK (length(product_id) BETWEEN 1 AND 255),
  api_origin text NOT NULL CHECK (api_origin IN ('https://api.creem.io/v1','https://test-api.creem.io/v1')),
  state text NOT NULL DEFAULT 'creating' CHECK (state IN ('creating','ready')),
  checkout_url text,
  checkout_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((state='ready') = (checkout_url IS NOT NULL)),
  CHECK ((state='ready') = (checkout_id IS NOT NULL))
);
ALTER TABLE public.creem_checkout_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.creem_checkout_attempts FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON public.creem_checkout_attempts TO service_role;

CREATE FUNCTION public.reserve_creem_checkout(p_profile_id uuid,p_plan text,p_product_id text,p_api_origin text)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE v_row public.creem_checkout_attempts%ROWTYPE;
BEGIN
  IF p_profile_id IS NULL OR p_plan IS NULL OR p_plan NOT IN ('plus','pro')
    OR p_product_id IS NULL OR length(p_product_id) NOT BETWEEN 1 AND 255
    OR p_api_origin IS NULL OR p_api_origin NOT IN ('https://api.creem.io/v1','https://test-api.creem.io/v1') THEN
    RAISE EXCEPTION 'Invalid checkout reservation' USING ERRCODE='22023';
  END IF;
  -- Same profile lock used by billing webhooks. Serializes both plans and tabs.
  PERFORM 1 FROM public.profiles WHERE id=p_profile_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Unknown profile' USING ERRCODE='22023'; END IF;
  IF EXISTS (SELECT 1 FROM public.subscriptions WHERE user_id=p_profile_id AND
      (provider_subscription_id IS NOT NULL OR (plan IN ('plus','pro') AND (status IN ('active','trialing')
        OR (status='canceled' AND current_period_end>now()))))) THEN
    RETURN jsonb_build_object('outcome','subscription_exists');
  END IF;
  SELECT * INTO v_row FROM public.creem_checkout_attempts WHERE profile_id=p_profile_id;
  IF FOUND THEN
    IF v_row.plan<>p_plan OR v_row.product_id<>p_product_id OR v_row.api_origin<>p_api_origin THEN
      RETURN jsonb_build_object('outcome','conflict');
    END IF;
    IF v_row.state='ready' THEN
      RETURN jsonb_build_object('outcome','ready','url',v_row.checkout_url,'attempt_id',v_row.attempt_id);
    END IF;
    RETURN jsonb_build_object('outcome','pending');
  END IF;
  INSERT INTO public.creem_checkout_attempts(profile_id,plan,product_id,api_origin)
    VALUES(p_profile_id,p_plan,p_product_id,p_api_origin) RETURNING * INTO v_row;
  RETURN jsonb_build_object('outcome','created','attempt_id',v_row.attempt_id);
END; $$;

CREATE FUNCTION public.finish_creem_checkout(p_profile_id uuid,p_attempt_id uuid,p_checkout_id text,p_checkout_url text)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE v_count integer;
BEGIN
  IF p_checkout_id IS NULL OR length(trim(p_checkout_id)) NOT BETWEEN 1 AND 255 THEN
    RAISE EXCEPTION 'Invalid provider checkout identity' USING ERRCODE='22023';
  END IF;
  IF p_checkout_url IS NULL OR length(p_checkout_url)>4096
    OR p_checkout_url !~ '^https://([a-z0-9-]+\.)?creem\.io/' THEN
    RAISE EXCEPTION 'Invalid provider checkout URL' USING ERRCODE='22023';
  END IF;
  UPDATE public.creem_checkout_attempts SET state='ready',checkout_id=p_checkout_id,checkout_url=p_checkout_url,updated_at=now()
    WHERE profile_id=p_profile_id AND attempt_id=p_attempt_id AND state='creating';
  GET DIAGNOSTICS v_count=ROW_COUNT;
  RETURN v_count=1;
END; $$;
REVOKE ALL ON FUNCTION public.reserve_creem_checkout(uuid,text,text,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.finish_creem_checkout(uuid,uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_creem_checkout(uuid,text,text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.finish_creem_checkout(uuid,uuid,text,text) TO service_role;
