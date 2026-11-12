DO $$
DECLARE r jsonb; a uuid; ok boolean;
BEGIN
  SET LOCAL ROLE service_role;
  r:=public.reserve_creem_checkout('22222222-2222-2222-2222-222222222222','plus','prod_test','https://test-api.creem.io/v1');
  IF r->>'outcome'<>'created' THEN RAISE EXCEPTION 'first must create'; END IF;
  a:=(r->>'attempt_id')::uuid;
  r:=public.reserve_creem_checkout('22222222-2222-2222-2222-222222222222','plus','prod_test','https://test-api.creem.io/v1');
  IF r->>'outcome'<>'pending' THEN RAISE EXCEPTION 'duplicate must not create'; END IF;
  r:=public.reserve_creem_checkout('22222222-2222-2222-2222-222222222222','pro','prod_pro','https://test-api.creem.io/v1');
  IF r->>'outcome'<>'conflict' THEN RAISE EXCEPTION 'other plan must not create'; END IF;
  r:=public.reserve_creem_checkout('22222222-2222-2222-2222-222222222222','plus','prod_test','https://api.creem.io/v1');
  IF r->>'outcome'<>'conflict' THEN RAISE EXCEPTION 'other mode must not reuse'; END IF;
  ok:=public.finish_creem_checkout('44444444-4444-4444-4444-444444444444',a,'ch_test','https://www.creem.io/test/payment/a');
  IF ok THEN RAISE EXCEPTION 'other profile must not finish'; END IF;
  ok:=public.finish_creem_checkout('22222222-2222-2222-2222-222222222222',gen_random_uuid(),'ch_test','https://www.creem.io/test/payment/a');
  IF ok THEN RAISE EXCEPTION 'wrong attempt must not finish'; END IF;
  BEGIN
    PERFORM public.finish_creem_checkout('22222222-2222-2222-2222-222222222222',a,'ch_test','https://creem.io.evil.example/a');
    RAISE EXCEPTION 'unsafe URL accepted';
  EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
  ok:=public.finish_creem_checkout('22222222-2222-2222-2222-222222222222',a,'ch_test','https://www.creem.io/test/payment/a');
  IF NOT ok THEN RAISE EXCEPTION 'finish failed'; END IF;
  r:=public.reserve_creem_checkout('22222222-2222-2222-2222-222222222222','plus','prod_test','https://test-api.creem.io/v1');
  IF r->>'outcome'<>'ready' OR r->>'url'<>'https://www.creem.io/test/payment/a' THEN RAISE EXCEPTION 'URL not reused'; END IF;
  IF (SELECT count(*) FROM public.creem_checkout_attempts)<>1 THEN RAISE EXCEPTION 'duplicate row'; END IF;
  RESET ROLE;
  -- Older uncertain attempts do not automatically unlock another charge.
  UPDATE public.creem_checkout_attempts SET state='creating',checkout_url=NULL,checkout_id=NULL,created_at=now()-interval '1 year';
  SET LOCAL ROLE service_role;
  r:=public.reserve_creem_checkout('22222222-2222-2222-2222-222222222222','plus','prod_test','https://test-api.creem.io/v1');
  IF r->>'outcome'<>'pending' THEN RAISE EXCEPTION 'uncertain attempt expired'; END IF;
  RESET ROLE;
  INSERT INTO public.subscriptions(user_id,plan,status,provider_subscription_id,payment_provider)
    VALUES('44444444-4444-4444-4444-444444444444','plus','active','sub_existing','creem');
  SET LOCAL ROLE service_role;
  r:=public.reserve_creem_checkout('44444444-4444-4444-4444-444444444444','plus','prod_test','https://test-api.creem.io/v1');
  IF r->>'outcome'<>'subscription_exists' THEN RAISE EXCEPTION 'existing subscription accepted'; END IF;
  RESET ROLE;
  UPDATE public.creem_checkout_attempts SET state='ready',checkout_id='ch_test',checkout_url='https://www.creem.io/test/payment/a';
  -- A paid webhook arriving after the URL was saved must prevent URL reuse.
  INSERT INTO public.subscriptions(user_id,plan,status,provider_subscription_id,payment_provider)
    VALUES('22222222-2222-2222-2222-222222222222','plus','active','sub_new','creem');
  SET LOCAL ROLE service_role;
  r:=public.reserve_creem_checkout('22222222-2222-2222-2222-222222222222','plus','prod_test','https://test-api.creem.io/v1');
  IF r->>'outcome'<>'subscription_exists' THEN RAISE EXCEPTION 'paid transition not protected'; END IF;
  RESET ROLE;
  UPDATE public.subscriptions SET provider_subscription_id=NULL,payment_provider=NULL,status='canceled',current_period_end=now()+interval '1 day'
    WHERE user_id='22222222-2222-2222-2222-222222222222';
  SET LOCAL ROLE service_role;
  r:=public.reserve_creem_checkout('22222222-2222-2222-2222-222222222222','plus','prod_test','https://test-api.creem.io/v1');
  IF r->>'outcome'<>'subscription_exists' THEN RAISE EXCEPTION 'paid canceled period not protected'; END IF;
  RESET ROLE;
  IF has_table_privilege('authenticated','public.creem_checkout_attempts','SELECT')
     OR has_table_privilege('anon','public.creem_checkout_attempts','UPDATE')
     OR has_function_privilege('authenticated','public.reserve_creem_checkout(uuid,text,text,text)','EXECUTE')
     OR has_function_privilege('anon','public.finish_creem_checkout(uuid,uuid,text,text)','EXECUTE') THEN
    RAISE EXCEPTION 'public permissions';
  END IF;
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid='public.creem_checkout_attempts'::regclass) THEN RAISE EXCEPTION 'RLS missing'; END IF;
END; $$;
