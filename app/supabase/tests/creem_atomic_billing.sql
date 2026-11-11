-- All rows below are disposable in-memory fixtures. Never run on hosted user data.
DO $$ BEGIN
 IF has_function_privilege('anon','public.apply_creem_subscription_event(text,text,text,timestamptz,text,uuid,text,text,timestamptz,boolean)','EXECUTE')
 OR has_function_privilege('authenticated','public.apply_creem_subscription_event(text,text,text,timestamptz,text,uuid,text,text,timestamptz,boolean)','EXECUTE') THEN
 RAISE EXCEPTION 'Billing RPC publicly executable'; END IF;
 IF NOT has_function_privilege('service_role','public.apply_creem_subscription_event(text,text,text,timestamptz,text,uuid,text,text,timestamptz,boolean)','EXECUTE') THEN RAISE EXCEPTION 'Service cannot call'; END IF;
 IF has_table_privilege('authenticated','public.creem_subscription_event_state','SELECT') OR has_table_privilege('anon','public.webhook_events','INSERT') THEN RAISE EXCEPTION 'Billing table exposed'; END IF;
END $$;
SET LOCAL ROLE service_role;
DO $$ DECLARE r jsonb; t timestamptz:=now()-interval '1 minute'; p uuid:='22222222-2222-2222-2222-222222222222'; q uuid:='44444444-4444-4444-4444-444444444444'; BEGIN
 r:=public.apply_creem_subscription_event('evt1','subscription.paid',repeat('a',64),t,'sub1',p,'plus','active',now()+interval '30 days',false);
 IF r->>'outcome'<>'applied' THEN RAISE EXCEPTION 'Initial event failed: %',r; END IF;
 r:=public.apply_creem_subscription_event('evt1','subscription.paid',repeat('a',64),t,'sub1',p,'plus','active',now()+interval '30 days',false);
 IF r->>'outcome'<>'duplicate' THEN RAISE EXCEPTION 'Duplicate failed'; END IF;
 BEGIN
  PERFORM public.apply_creem_subscription_event('evt1','subscription.paid',repeat('b',64),t,'sub1',p,'plus','active',now()+interval '30 days',false);
  RAISE EXCEPTION 'Hash collision accepted';
 EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 r:=public.apply_creem_subscription_event('evt-cancel','subscription.canceled',repeat('c',64),t+interval '20 seconds','sub1',p,'plus','canceled',now()+interval '30 days',true);
 IF r->>'outcome'<>'applied' THEN RAISE EXCEPTION 'Cancel failed'; END IF;
 r:=public.apply_creem_subscription_event('evt-old','subscription.paid',repeat('d',64),t+interval '10 seconds','sub1',p,'plus','active',now()+interval '30 days',false);
 IF r->>'outcome'<>'stale' OR (SELECT status FROM public.subscriptions WHERE user_id=p)<>'canceled' THEN RAISE EXCEPTION 'Old event revived subscription'; END IF;
 r:=public.apply_creem_subscription_event('evt-tie','subscription.paid',repeat('e',64),t+interval '20 seconds','sub1',p,'plus','active',now()+interval '30 days',false);
 IF r->>'outcome'<>'conflict' OR EXISTS(SELECT 1 FROM public.webhook_events WHERE event_id='evt-tie') THEN RAISE EXCEPTION 'Tie acknowledged or applied'; END IF;
 r:=public.apply_creem_subscription_event('evt-same','subscription.update',repeat('f',64),t+interval '20 seconds','sub1',p,'plus','canceled',now()+interval '30 days',true);
 IF r->>'outcome'<>'duplicate' THEN RAISE EXCEPTION 'Same-timestamp identical state not safely accepted'; END IF;
 r:=public.apply_creem_subscription_event('evt-owner','subscription.paid',repeat('1',64),t+interval '25 seconds','sub1',q,'pro','active',now()+interval '30 days',false);
 IF r->>'outcome'<>'conflict' OR EXISTS(SELECT 1 FROM public.subscriptions WHERE user_id=q AND provider_subscription_id='sub1') THEN RAISE EXCEPTION 'Owner reassigned'; END IF;
 r:=public.apply_creem_subscription_event('evt-replace','subscription.paid',repeat('2',64),t+interval '30 seconds','sub2',p,'pro','active',now()+interval '30 days',false);
 IF r->>'outcome'<>'conflict' THEN RAISE EXCEPTION 'Unrelated subscription overwritten'; END IF;
 r:=public.apply_creem_subscription_event('evt-unpaid','subscription.unpaid',repeat('3',64),t+interval '40 seconds','sub1',NULL,NULL,'past_due',now()+interval '30 days',false);
 IF r->>'outcome'<>'applied' OR (SELECT status FROM public.subscriptions WHERE user_id=p)<>'past_due' THEN RAISE EXCEPTION 'Unpaid still active'; END IF;
 r:=public.apply_creem_subscription_event('evt-missing','subscription.expired',repeat('4',64),t,'missing-sub',NULL,NULL,'expired',NULL,false);
 IF r->>'outcome'<>'conflict' OR EXISTS(SELECT 1 FROM public.webhook_events WHERE event_id='evt-missing') THEN RAISE EXCEPTION 'Unknown revoke lost'; END IF;
END $$;
RESET ROLE;
-- Reject unsupported event types and inconsistent canonical states, without receipts.
SET LOCAL ROLE service_role;
DO $$ DECLARE x record; BEGIN
 FOR x IN SELECT * FROM (VALUES
  ('checkout.completed','active',false,now()),
  ('subscription.unpaid','active',false,now()),
  ('subscription.paid','active',true,now()),
  ('subscription.canceled','canceled',false,now()),
  ('subscription.scheduled_cancel','active',true,NULL::timestamptz),
  ('subscription.update','expired',true,now())
 ) AS cases(event_type,status,cancel_flag,period_end) LOOP
  BEGIN
   PERFORM public.apply_creem_subscription_event('evt-invalid',x.event_type,repeat('a',64),now(),'sub1',NULL,'plus',x.status,x.period_end,x.cancel_flag);
   RAISE EXCEPTION 'Invalid event was accepted: %',x.event_type;
  EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 END LOOP;
 IF EXISTS(SELECT 1 FROM public.webhook_events WHERE event_id='evt-invalid') THEN RAISE EXCEPTION 'Invalid event receipted'; END IF;
END $$;
INSERT INTO public.webhook_events(event_id,event_name,subscription_id) VALUES('evt-legacy','subscription.paid','sub1');
DO $$ DECLARE r jsonb; BEGIN
 r:=public.apply_creem_subscription_event('evt-legacy','subscription.paid',repeat('b',64),now(),'sub1',NULL,'plus','active',NULL,false);
 IF r->>'outcome'<>'duplicate' THEN RAISE EXCEPTION 'Legacy receipt replayed'; END IF;
 r:=public.apply_creem_subscription_event('evt-stale-no-plan','subscription.expired',repeat('c',64),now()-interval '1 day','sub1',NULL,NULL,'expired',NULL,false);
 IF r->>'outcome'<>'stale' THEN RAISE EXCEPTION 'Stale planless revocation not ignored'; END IF;
END $$;
RESET ROLE;
-- A receipt insertion failure must roll back the entitlement mutation in the same call.
CREATE FUNCTION public.fail_billing_fixture() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN IF NEW.event_id='evt-crash' THEN RAISE EXCEPTION 'simulated receipt failure'; END IF; RETURN NEW; END$$;
CREATE TRIGGER billing_fixture_failure BEFORE INSERT ON public.webhook_events FOR EACH ROW EXECUTE FUNCTION public.fail_billing_fixture();
SET LOCAL ROLE service_role;
DO $$ BEGIN
 BEGIN
  PERFORM public.apply_creem_subscription_event('evt-crash','subscription.paid',repeat('5',64),now(),'sub1','22222222-2222-2222-2222-222222222222','pro','active',now()+interval '30 days',false);
  RAISE EXCEPTION 'Expected failure';
 EXCEPTION WHEN raise_exception THEN
  IF SQLERRM<>'simulated receipt failure' THEN RAISE; END IF;
 END;
 IF (SELECT status FROM public.subscriptions WHERE provider_subscription_id='sub1')<>'past_due'
 OR EXISTS(SELECT 1 FROM public.webhook_events WHERE event_id='evt-crash') THEN RAISE EXCEPTION 'Partial mutation persisted'; END IF;
END $$;
RESET ROLE;
DROP TRIGGER billing_fixture_failure ON public.webhook_events;
DROP FUNCTION public.fail_billing_fixture();
-- Scheduled cancellation expiry must match application access rules.
UPDATE public.subscriptions SET plan='plus',status='active',cancel_at_period_end=true,current_period_end=now()-interval '1 second' WHERE provider_subscription_id='sub1';
INSERT INTO public.usage_stats(user_id,date,hskk_count,conversation_seconds) VALUES('22222222-2222-2222-2222-222222222222',(now() AT TIME ZONE 'UTC')::date,1,300);
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',true);
DO $$ DECLARE r record; BEGIN
 SELECT * INTO r FROM public.consume_practice_quota('22222222-2222-2222-2222-222222222222','hskk');
 IF r.allowed THEN RAISE EXCEPTION 'Expired scheduled-cancel keeps paid HSKK'; END IF;
 SELECT * INTO r FROM public.consume_conversation_seconds('22222222-2222-2222-2222-222222222222',1);
 IF r.allowed THEN RAISE EXCEPTION 'Expired scheduled-cancel keeps unlimited audio'; END IF;
END $$;
RESET ROLE;
UPDATE public.subscriptions SET current_period_end=now()+interval '1 day' WHERE provider_subscription_id='sub1';
SET LOCAL ROLE authenticated;
DO $$ DECLARE r record; BEGIN
 SELECT * INTO r FROM public.consume_conversation_seconds('22222222-2222-2222-2222-222222222222',1);
 IF NOT r.allowed THEN RAISE EXCEPTION 'Future scheduled cancellation lost paid access early'; END IF;
END $$;
RESET ROLE;
