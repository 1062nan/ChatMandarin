SELECT set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',true);
DO $$
DECLARE
 p uuid := '22222222-2222-2222-2222-222222222222';
 today date := (clock_timestamp() AT TIME ZONE 'UTC')::date;
 month text := to_char(clock_timestamp() AT TIME ZONE 'UTC','YYYY-MM');
 r record; j jsonb; initial_total integer; i integer;
BEGIN
 IF public.plus_speaking_allowance_enabled() THEN RAISE EXCEPTION 'gate default must be off'; END IF;
 IF has_table_privilege('authenticated','public.plus_speaking_allowance_config','SELECT,UPDATE')
 OR has_table_privilege('anon','public.plus_speaking_allowance_config','SELECT,UPDATE')
 OR has_function_privilege('anon','public.plus_speaking_allowance_enabled()','EXECUTE') THEN
   RAISE EXCEPTION 'browser permission expansion';
 END IF;
 INSERT INTO public.subscriptions(user_id,plan,status) VALUES(p,'plus','active');
 SET LOCAL ROLE authenticated;
 FOR i IN 1..3 LOOP
  SELECT * INTO r FROM public.consume_practice_quota(p,'hskk');
  IF NOT r.allowed THEN RAISE EXCEPTION 'legacy Plus 3/month must remain with gate off'; END IF;
 END LOOP;
 SELECT * INTO r FROM public.consume_practice_quota(p,'hskk');
 IF r.allowed OR r.reason<>'monthly_exceeded' THEN RAISE EXCEPTION 'legacy fourth must deny'; END IF;
 BEGIN
  PERFORM public.consume_practice_quota('44444444-4444-4444-4444-444444444444','hskk');
  RAISE EXCEPTION 'cross-owner should fail';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 RESET ROLE;
 SELECT hskk_count INTO initial_total FROM public.usage_monthly WHERE user_id=p AND year_month=month;
 UPDATE public.plus_speaking_allowance_config SET enabled=true;
 SET LOCAL ROLE authenticated;
 UPDATE public.usage_monthly SET plus_hskk_bonus_count=0 WHERE user_id=p;
 IF FOUND THEN RAISE EXCEPTION 'browser can alter bonus accounting'; END IF;
 IF NOT public.plus_speaking_allowance_enabled() THEN RAISE EXCEPTION 'getter mismatch'; END IF;
 -- Historical usage has consumed today's daily opportunity but not new bonuses.
 FOR i IN 1..10 LOOP
  SELECT * INTO r FROM public.consume_practice_quota(p,'hskk');
  IF NOT r.allowed OR r.monthly_remaining<>10-i THEN RAISE EXCEPTION 'bonus boundary'; END IF;
 END LOOP;
 SELECT * INTO r FROM public.consume_practice_quota(p,'hskk');
 IF r.allowed OR r.monthly_remaining<>0 OR r.daily_remaining<>0 THEN RAISE EXCEPTION 'bonus eleventh denied'; END IF;
 RESET ROLE;
 IF (SELECT hskk_count FROM public.usage_monthly WHERE user_id=p AND year_month=month)<>initial_total+10
 OR (SELECT plus_hskk_bonus_count FROM public.usage_monthly WHERE user_id=p AND year_month=month)<>10
 THEN RAISE EXCEPTION 'usage totals lost or bonus retrocharged'; END IF;
 -- A fresh day remains available even after every monthly bonus is spent.
 UPDATE public.usage_stats SET hskk_count=0 WHERE user_id=p AND date=today;
 SET LOCAL ROLE authenticated;
 SELECT * INTO r FROM public.consume_practice_quota(p,'hskk');
 IF NOT r.allowed OR r.monthly_remaining<>0 THEN RAISE EXCEPTION 'daily inheritance after bonus exhaustion'; END IF;
 SELECT * INTO r FROM public.consume_practice_quota(p,'hskk');
 IF r.allowed THEN RAISE EXCEPTION 'second daily with exhausted bonus must deny'; END IF;
 RESET ROLE;
 -- A stale prior-month bucket does not reduce current-month availability.
 UPDATE public.usage_monthly SET year_month='1999-01' WHERE user_id=p AND year_month=month;
 UPDATE public.usage_stats SET hskk_count=0 WHERE user_id=p AND date=today;
 SET LOCAL TIME ZONE 'Pacific/Kiritimati';
 SET LOCAL ROLE authenticated;
 SELECT * INTO r FROM public.consume_practice_quota(p,'hskk');
 IF NOT r.allowed OR r.monthly_remaining<>10 THEN RAISE EXCEPTION 'fresh month daily first'; END IF;
 SELECT * INTO r FROM public.consume_practice_quota(p,'hskk');
 IF NOT r.allowed OR r.monthly_remaining<>9 THEN RAISE EXCEPTION 'first monthly bonus'; END IF;
 RESET ROLE;
 IF NOT EXISTS(SELECT 1 FROM public.usage_monthly WHERE user_id=p AND year_month=month AND plus_hskk_bonus_count=1)
 THEN RAISE EXCEPTION 'UTC month mismatch'; END IF;
 SET LOCAL TIME ZONE 'UTC';
 -- Effective canceled paid retains benefit; expired scheduled cancellation does not.
 UPDATE public.subscriptions SET status='canceled',current_period_end=clock_timestamp()+interval '1 day' WHERE user_id=p;
 SET LOCAL ROLE authenticated;
 SELECT * INTO r FROM public.consume_practice_quota(p,'hskk');
 IF NOT r.allowed OR r.monthly_remaining<>8 THEN RAISE EXCEPTION 'canceled paid access lost'; END IF;
 RESET ROLE;
 UPDATE public.subscriptions SET status='active',cancel_at_period_end=true,current_period_end=clock_timestamp()-interval '1 second' WHERE user_id=p;
 SET LOCAL ROLE authenticated;
 SELECT * INTO r FROM public.consume_practice_quota(p,'hskk');
 IF r.allowed OR r.reason<>'daily_exceeded' THEN RAISE EXCEPTION 'expired paid must be Free'; END IF;
 RESET ROLE;
 UPDATE public.subscriptions SET plan='pro',status='active',cancel_at_period_end=false WHERE user_id=p;
 SET LOCAL ROLE authenticated;
 SELECT * INTO r FROM public.consume_practice_quota(p,'hskk');
 IF NOT r.allowed OR r.monthly_remaining IS NOT NULL THEN RAISE EXCEPTION 'Pro must remain unlimited'; END IF;
 RESET ROLE;
 UPDATE public.subscriptions SET plan='free' WHERE user_id=p;
 UPDATE public.usage_stats SET hskk_count=0 WHERE user_id=p AND date=today;
 SET LOCAL ROLE authenticated;
 SELECT * INTO r FROM public.consume_practice_quota(p,'hskk');
 IF NOT r.allowed THEN RAISE EXCEPTION 'Free daily lost'; END IF;
 SELECT * INTO r FROM public.consume_practice_quota(p,'hskk');
 IF r.allowed THEN RAISE EXCEPTION 'Free got Plus bonus'; END IF;
 RESET ROLE;
 -- Reserve retries use existing identity without consuming an additional bonus.
 UPDATE public.subscriptions SET plan='plus' WHERE user_id=p;
 SET LOCAL ROLE authenticated;
 j:=public.reserve_hskk_submission(p,repeat('a',64),'beginner');
 IF j->>'state'<>'reserved' THEN RAISE EXCEPTION 'submission reservation failed'; END IF;
 j:=public.reserve_hskk_submission(p,repeat('a',64),'beginner');
 IF j->>'state'<>'processing' THEN RAISE EXCEPTION 'retry identity changed'; END IF;
 RESET ROLE;
 IF (SELECT plus_hskk_bonus_count FROM public.usage_monthly WHERE user_id=p AND year_month=month)<>3
 THEN RAISE EXCEPTION 'retry charged twice'; END IF;
END $$;
