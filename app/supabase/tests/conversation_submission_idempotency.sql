-- Local disposable fixtures, entire caller transaction rolled back.
SELECT set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',true);
-- Demonstrate old independent quota calls charged identical retries twice.
SAVEPOINT old_quota_baseline;
SET LOCAL ROLE authenticated;
SELECT * FROM public.consume_conversation_seconds('22222222-2222-2222-2222-222222222222',4);
SELECT * FROM public.consume_conversation_seconds('22222222-2222-2222-2222-222222222222',4);
RESET ROLE;
DO $$ BEGIN
 ASSERT (SELECT conversation_seconds=8 AND conversation_count=2 FROM public.usage_stats WHERE user_id='22222222-2222-2222-2222-222222222222'),'old retry charged twice';
END $$;
ROLLBACK TO SAVEPOINT old_quota_baseline;
DO $$ BEGIN
 ASSERT NOT has_function_privilege('anon','public.reserve_conversation_submission(uuid,uuid,integer,text,integer)','EXECUTE');
 ASSERT NOT has_function_privilege('authenticated','public.finish_conversation_submission(uuid,uuid,integer,uuid,jsonb)','EXECUTE');
 ASSERT NOT has_function_privilege('authenticated','public.fail_conversation_submission(uuid,uuid,integer,uuid)','EXECUTE');
 ASSERT NOT has_table_privilege('authenticated','public.conversation_submission_requests','SELECT');
END $$;
SET LOCAL ROLE service_role;
SELECT set_config('test.conv',(public.start_verified_conversation('22222222-2222-2222-2222-222222222222','introduction',1,'friendly')->>'id'),true);
RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT set_config('test.a',public.reserve_conversation_submission('22222222-2222-2222-2222-222222222222',current_setting('test.conv')::uuid,0,repeat('a',64),4)::text,true);
DO $$ DECLARE r jsonb; blocked boolean:=false; BEGIN
 ASSERT current_setting('test.a')::jsonb->>'state'='reserved';
 r:=public.reserve_conversation_submission('22222222-2222-2222-2222-222222222222',current_setting('test.conv')::uuid,0,repeat('a',64),4);
 ASSERT r->>'state'='processing','same audio in-flight blocked';
 r:=public.reserve_conversation_submission('22222222-2222-2222-2222-222222222222',current_setting('test.conv')::uuid,0,repeat('b',64),6);
 ASSERT r->>'state'='processing','different audio in-flight blocked';
 BEGIN
  PERFORM public.reserve_conversation_submission('44444444-4444-4444-4444-444444444444',current_setting('test.conv')::uuid,0,repeat('a',64),4);
 EXCEPTION WHEN insufficient_privilege THEN blocked:=true; END;
 ASSERT blocked,'cross-profile reserve blocked';
END $$;
RESET ROLE;
SET LOCAL ROLE service_role;
SELECT public.fail_conversation_submission('22222222-2222-2222-2222-222222222222',current_setting('test.conv')::uuid,0,(current_setting('test.a')::jsonb->>'lease_token')::uuid);
RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT set_config('test.retry',public.reserve_conversation_submission('22222222-2222-2222-2222-222222222222',current_setting('test.conv')::uuid,0,repeat('a',64),4)::text,true);
RESET ROLE;
DO $$ BEGIN
 ASSERT current_setting('test.retry')::jsonb->>'state'='reserved';
 ASSERT (SELECT conversation_seconds=4 AND conversation_count=1 FROM public.usage_stats WHERE user_id='22222222-2222-2222-2222-222222222222'),'same failed recording only charged once';
END $$;
SET LOCAL ROLE service_role;
SELECT public.fail_conversation_submission('22222222-2222-2222-2222-222222222222',current_setting('test.conv')::uuid,0,(current_setting('test.retry')::jsonb->>'lease_token')::uuid);
RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT set_config('test.b',public.reserve_conversation_submission('22222222-2222-2222-2222-222222222222',current_setting('test.conv')::uuid,0,repeat('b',64),6)::text,true);
RESET ROLE;
DO $$ BEGIN
 ASSERT current_setting('test.b')::jsonb->>'state'='reserved','new recording after failure allowed';
 ASSERT (SELECT conversation_seconds=10 AND conversation_count=2 FROM public.usage_stats WHERE user_id='22222222-2222-2222-2222-222222222222'),'new recording charged once';
END $$;
UPDATE public.conversation_submission_requests SET lease_expires_at=now()-interval '1 second' WHERE fingerprint=repeat('b',64);
SET LOCAL ROLE authenticated;
SELECT set_config('test.final',public.reserve_conversation_submission('22222222-2222-2222-2222-222222222222',current_setting('test.conv')::uuid,0,repeat('a',64),4)::text,true);
RESET ROLE;
SET LOCAL ROLE service_role;
DO $$ DECLARE r jsonb; payload jsonb:='{"user_text":"你好","ai_text":"你好呀","grammar_score":80,"word_choice_score":90,"user_audio_duration_ms":4000}'; BEGIN
 ASSERT public.finish_conversation_submission('22222222-2222-2222-2222-222222222222',current_setting('test.conv')::uuid,0,(current_setting('test.b')::jsonb->>'lease_token')::uuid,payload) IS NULL,'retired lease cannot save';
 ASSERT NOT public.fail_conversation_submission('22222222-2222-2222-2222-222222222222',current_setting('test.conv')::uuid,0,(current_setting('test.retry')::jsonb->>'lease_token')::uuid),'stale lease cannot fail current request';
 r:=public.finish_conversation_submission('22222222-2222-2222-2222-222222222222',current_setting('test.conv')::uuid,0,(current_setting('test.final')::jsonb->>'lease_token')::uuid,payload);
 ASSERT r->>'user_text'='你好','canonical save';
 PERFORM set_config('test.saved',r::text,true);
 ASSERT public.finish_conversation_submission('22222222-2222-2222-2222-222222222222',current_setting('test.conv')::uuid,0,(current_setting('test.final')::jsonb->>'lease_token')::uuid,payload)=r,'finish retry replays';
END $$;
RESET ROLE;
SET LOCAL ROLE authenticated;
DO $$ DECLARE r jsonb; BEGIN
 r:=public.reserve_conversation_submission('22222222-2222-2222-2222-222222222222',current_setting('test.conv')::uuid,0,repeat('c',64),100);
 ASSERT r->>'state'='completed' AND r->'turn_data'->>'user_text'='你好','saved turn replay no extra audio charge';
 r:=public.reserve_conversation_submission('22222222-2222-2222-2222-222222222222',current_setting('test.conv')::uuid,2,repeat('c',64),1);
 ASSERT r->>'reason'='unexpected_turn','skipped index not charged';
END $$;
SELECT set_config('test.last',public.reserve_conversation_submission('22222222-2222-2222-2222-222222222222',current_setting('test.conv')::uuid,1,repeat('d',64),290)::text,true);
RESET ROLE;
SET LOCAL ROLE service_role;
SELECT public.fail_conversation_submission('22222222-2222-2222-2222-222222222222',current_setting('test.conv')::uuid,1,(current_setting('test.last')::jsonb->>'lease_token')::uuid);
RESET ROLE;
SET LOCAL ROLE authenticated;
DO $$ DECLARE r jsonb; BEGIN
 r:=public.reserve_conversation_submission('22222222-2222-2222-2222-222222222222',current_setting('test.conv')::uuid,1,repeat('e',64),1);
 ASSERT r->>'state'='quota_denied','new recording enforces daily cap';
 r:=public.reserve_conversation_submission('22222222-2222-2222-2222-222222222222',current_setting('test.conv')::uuid,1,repeat('d',64),290);
 ASSERT r->>'state'='reserved','same recording can retry at cap';
 r:=public.reserve_conversation_submission('22222222-2222-2222-2222-222222222222',current_setting('test.conv')::uuid,1,repeat('d',64),291);
 ASSERT r->>'reason'='audio_mismatch','same hash duration immutable';
END $$;
RESET ROLE;
SET LOCAL ROLE service_role;
SELECT public.end_verified_conversation('22222222-2222-2222-2222-222222222222',current_setting('test.conv')::uuid);
RESET ROLE;
SET LOCAL ROLE authenticated;
DO $$ DECLARE r jsonb; BEGIN
 r:=public.reserve_conversation_submission('22222222-2222-2222-2222-222222222222',current_setting('test.conv')::uuid,1,repeat('f',64),1);
 ASSERT r->>'reason'='ended','ended sessions cannot charge';
END $$;
RESET ROLE;
DO $$ BEGIN
 ASSERT (SELECT conversation_seconds=300 AND conversation_count=3 FROM public.usage_stats WHERE user_id='22222222-2222-2222-2222-222222222222'),'only three distinct recordings charged';
 ASSERT (SELECT count(*)=1 FROM public.verified_conversation_turns WHERE conversation_id=current_setting('test.conv')::uuid),'exactly one trusted turn';
 ASSERT (SELECT count(*)=1 FROM public.conversation_turns WHERE conversation_id=current_setting('test.conv')::uuid),'exactly one public turn';
 ASSERT (SELECT count(*)=3 FROM public.conversation_submission_requests),'denied request not persisted';
END $$;
