-- Disposable local fixtures only; caller wraps in a transaction and rolls back.
SELECT set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',true);
DO $$ BEGIN
 ASSERT NOT has_function_privilege('anon','public.reserve_hskk_submission(uuid,text,text)','EXECUTE');
 ASSERT NOT has_function_privilege('authenticated','public.finish_hskk_submission(uuid,text,uuid,jsonb,jsonb)','EXECUTE');
 ASSERT NOT has_function_privilege('authenticated','public.fail_hskk_submission(uuid,text,uuid)','EXECUTE');
 ASSERT NOT has_table_privilege('authenticated','public.hskk_submission_requests','SELECT');
END $$;
SET LOCAL ROLE authenticated;
SELECT set_config('test.first',public.reserve_hskk_submission('22222222-2222-2222-2222-222222222222',repeat('a',64),'beginner')::text,true);
DO $$ DECLARE r jsonb; blocked boolean:=false; BEGIN
 ASSERT current_setting('test.first')::jsonb->>'state'='reserved';
 r:=public.reserve_hskk_submission('22222222-2222-2222-2222-222222222222',repeat('a',64),'beginner');
 ASSERT r->>'state'='processing','in flight duplicate blocked';
 BEGIN
   PERFORM public.reserve_hskk_submission('44444444-4444-4444-4444-444444444444',repeat('a',64),'beginner');
 EXCEPTION WHEN insufficient_privilege THEN blocked:=true;
 END;
 ASSERT blocked,'cannot reserve another profile';
END $$;
RESET ROLE;
DO $$ BEGIN
 ASSERT (SELECT count(*)=1 FROM public.hskk_tests),'one test only';
 ASSERT (SELECT hskk_count=1 FROM public.usage_stats WHERE user_id='22222222-2222-2222-2222-222222222222'),'quota once';
END $$;
SET LOCAL ROLE service_role;
DO $$ BEGIN
 ASSERT public.fail_hskk_submission('22222222-2222-2222-2222-222222222222',repeat('a',64),(current_setting('test.first')::jsonb->>'lease_token')::uuid),'fail owner lease';
END $$;
RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT set_config('test.retry',public.reserve_hskk_submission('22222222-2222-2222-2222-222222222222',repeat('a',64),'beginner')::text,true);
DO $$ BEGIN
 ASSERT current_setting('test.retry')::jsonb->>'state'='reserved','failed retry allowed';
 ASSERT current_setting('test.retry')::jsonb->>'test_id'=current_setting('test.first')::jsonb->>'test_id','same test';
 ASSERT current_setting('test.retry')::jsonb->>'lease_token'<>current_setting('test.first')::jsonb->>'lease_token','new fencing token';
END $$;
RESET ROLE;
UPDATE public.hskk_submission_requests SET lease_expires_at=now()-interval '1 second' WHERE fingerprint=repeat('a',64);
SET LOCAL ROLE authenticated;
SELECT set_config('test.final',public.reserve_hskk_submission('22222222-2222-2222-2222-222222222222',repeat('a',64),'beginner')::text,true);
RESET ROLE;
SET LOCAL ROLE service_role;
DO $$ DECLARE response jsonb; BEGIN
 response:=jsonb_build_object('test_id',current_setting('test.final')::jsonb->>'test_id','total_score',80,
   'transcripts',jsonb_build_object('read','你好','qa','很好','picture','公园'),
   'scores',jsonb_build_object('pronunciation',null,'fluency',null,'grammar',80,'vocabulary',80,'content',80));
 PERFORM set_config('test.response',response::text,true);
 ASSERT NOT public.finish_hskk_submission('22222222-2222-2222-2222-222222222222',repeat('a',64),(current_setting('test.retry')::jsonb->>'lease_token')::uuid,response),'expired previous lease fenced';
 ASSERT NOT public.fail_hskk_submission('22222222-2222-2222-2222-222222222222',repeat('a',64),(current_setting('test.first')::jsonb->>'lease_token')::uuid),'stale failure fenced';
 ASSERT public.finish_hskk_submission('22222222-2222-2222-2222-222222222222',repeat('a',64),(current_setting('test.final')::jsonb->>'lease_token')::uuid,response,'[{"question":"好吗","answer":"很好"}]'),'finish succeeds';
END $$;
RESET ROLE;
SET LOCAL ROLE authenticated;
DO $$ DECLARE r jsonb; BEGIN
 r:=public.reserve_hskk_submission('22222222-2222-2222-2222-222222222222',repeat('a',64),'beginner');
 ASSERT r->>'state'='completed','completed replay';
 ASSERT r->'response'=current_setting('test.response')::jsonb,'exact response replay';
 r:=public.reserve_hskk_submission('22222222-2222-2222-2222-222222222222',repeat('b',64),'beginner');
 ASSERT r->>'state'='quota_denied' AND r->>'reason'='daily_exceeded','new attempt quota enforced';
END $$;
RESET ROLE;
DO $$ BEGIN
 ASSERT (SELECT count(*)=1 FROM public.hskk_tests),'no retry duplicates';
 ASSERT (SELECT count(*)=1 FROM public.hskk_submission_requests),'denied request not persisted';
 ASSERT (SELECT hskk_count=1 FROM public.usage_stats WHERE user_id='22222222-2222-2222-2222-222222222222'),'daily charged once';
 ASSERT (SELECT hskk_count=1 FROM public.usage_monthly WHERE user_id='22222222-2222-2222-2222-222222222222'),'monthly charged once';
 ASSERT (SELECT status='completed' AND total_score=80 AND pronunciation_score IS NULL AND section_qa_text->0->>'answer'='很好' FROM public.hskk_tests),'canonical report stored';
END $$;
