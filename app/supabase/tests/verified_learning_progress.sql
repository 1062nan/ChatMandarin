-- Run inside an explicit transaction and ROLLBACK. The caller sets test.profile_id
-- to an authorized disposable test profile. Never run against another account.
DO $$
DECLARE
 p uuid:=current_setting('test.profile_id')::uuid;
 a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); c uuid:=gen_random_uuid();
 conv uuid; empty_conv uuid; result jsonb; before_count integer; before_attempts integer; caught boolean;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=p) THEN RAISE EXCEPTION 'Test profile missing'; END IF;
 IF EXISTS(SELECT 1 FROM public.verified_practice_credits WHERE user_id=p) THEN RAISE EXCEPTION 'Use a test profile without previous verified credits'; END IF;
 UPDATE public.profiles SET hsk_level=1 WHERE id=p;
 PERFORM public.ensure_learning_progress(p);
 ASSERT (SELECT status='available' FROM public.user_progress WHERE user_id=p AND unit_id='hsk1-unit1'),'first unit initializes';
 UPDATE public.user_progress SET best_score=100,attempts=50,status='available' WHERE user_id=p AND unit_id='hsk1-unit1';
 UPDATE public.user_progress SET status='locked' WHERE user_id=p AND unit_id='hsk1-unit2';
 result:=public.save_verified_audio_practice(p,'shadowing',a,'s001',59,'你好','[]');
 ASSERT (result->>'credited')::boolean,'valid audio credit';
 ASSERT (SELECT best_score=59 AND attempts=1 FROM public.user_progress WHERE user_id=p AND unit_id='hsk1-unit1'),'ignore forged legacy score';
 ASSERT (SELECT status='locked' FROM public.user_progress WHERE user_id=p AND unit_id='hsk1-unit2'),'threshold below boundary';
 ASSERT (SELECT (previous_progress->>'best_score')::int=100 FROM public.verified_practice_credits WHERE source_id=a),'retain previous progress snapshot';
 result:=public.save_verified_audio_practice(p,'shadowing',a,'s001',100,'retry','[]');
 ASSERT (result->>'duplicate')::boolean,'duplicate identified';
 ASSERT result->'assessment'->>'transcript_match_score'='59' AND result->'assessment'->>'transcript'='你好','replay returns stored assessment';
 ASSERT (SELECT attempts=1 AND best_score=59 FROM public.user_progress WHERE user_id=p AND unit_id='hsk1-unit1'),'retry cannot change score';
 PERFORM public.save_verified_audio_practice(p,'shadowing',b,'s001',60,'你好','[]');
 ASSERT (SELECT status='available' FROM public.user_progress WHERE user_id=p AND unit_id='hsk1-unit2'),'exact destination threshold unlocks';
 PERFORM public.save_verified_audio_practice(p,'shadowing',c,'s001',20,'你好','[]');
 ASSERT (SELECT best_score=60 AND attempts=3 FROM public.user_progress WHERE user_id=p AND unit_id='hsk1-unit1'),'best is monotonic';
 -- Legacy available rows above the current HSK level must not earn credit.
 INSERT INTO public.user_progress(user_id,unit_id,status) VALUES(p,'hsk2-unit1','available') ON CONFLICT(user_id,unit_id) DO UPDATE SET status='available';
 result:=public.save_verified_audio_practice(p,'dubbing',gen_random_uuid(),'lost-tourist',100,'你好','[]');
 ASSERT NOT (result->>'credited')::boolean,'higher-level legacy availability ignored';
 SELECT total_conversations INTO before_count FROM public.profiles WHERE id=p;
 empty_conv:=(public.start_verified_conversation(p,'introduction',1,'friendly')->>'id')::uuid;
 result:=public.end_verified_conversation(p,empty_conv);
 ASSERT (result->>'ended')::boolean,'empty closes';
 ASSERT (SELECT total_conversations=before_count FROM public.profiles WHERE id=p),'empty never counts';
 result:=public.end_verified_conversation(p,empty_conv);
 ASSERT NOT (result->>'ended')::boolean,'empty retry idempotent';
 conv:=(public.start_verified_conversation(p,'introduction',1,'friendly')->>'id')::uuid;
 result:=public.save_verified_conversation_turn(p,conv,0,'{"user_text":"你好","ai_text":"你好","grammar_score":80,"word_choice_score":null}');
 ASSERT result->>'grammar_score'='80' AND result->>'pronunciation_score' IS NULL,'only measured scores';
 result:=public.save_verified_conversation_turn(p,conv,0,'{"user_text":"duplicate","grammar_score":100}');
 ASSERT (result->>'duplicate')::boolean AND result->>'user_text'='你好','same turn replays canonical data';
 ASSERT (SELECT count(*)=1 FROM public.conversation_turns WHERE conversation_id=conv),'exactly one public turn';
 -- Public source rows remain editable for compatibility. Protected settings/scores win.
 UPDATE public.conversations SET scenario='interview' WHERE id=conv;
 UPDATE public.conversation_turns SET grammar_score=100,word_choice_score=100 WHERE conversation_id=conv;
 result:=public.end_verified_conversation(p,conv);
 ASSERT (result->>'ended')::boolean,'nonempty completes';
 ASSERT (SELECT total_conversations=before_count+1 FROM public.profiles WHERE id=p),'completed increments once';
 ASSERT (SELECT unit_id='hsk1-unit1' AND score=80 AND credited FROM public.verified_practice_credits WHERE source_id=conv),'trusted snapshot and scores determine progress';
 ASSERT (SELECT avg_grammar=80 AND avg_word_choice IS NULL FROM public.conversations WHERE id=conv),'trusted summary excludes null';
 result:=public.end_verified_conversation(p,conv);
 ASSERT NOT (result->>'ended')::boolean,'repeat completion is idempotent';
 ASSERT (SELECT total_conversations=before_count+1 FROM public.profiles WHERE id=p),'repeat does not increment';
 -- No fabricated zero: a valid but unscored turn counts practice, not an achievement.
 conv:=(public.start_verified_conversation(p,'introduction',1,'friendly')->>'id')::uuid;
 PERFORM public.save_verified_conversation_turn(p,conv,0,'{"user_text":"谢谢","ai_text":"不客气"}');
 PERFORM public.end_verified_conversation(p,conv);
 ASSERT (SELECT score IS NULL AND NOT credited FROM public.verified_practice_credits WHERE source_id=conv),'null scores never unlock';
 ASSERT (SELECT attempts=4 FROM public.user_progress WHERE user_id=p AND unit_id='hsk1-unit1'),'unscored no progress attempt';
 -- Subtransaction failure leaves no partial source or achievement.
 a:=gen_random_uuid();
 SELECT attempts INTO before_attempts FROM public.user_progress WHERE user_id=p AND unit_id='hsk1-unit1';
 caught:=false;
 BEGIN
   PERFORM public.save_verified_audio_practice(p,'shadowing',a,'s001',100,'你好','[]');
   RAISE EXCEPTION 'Forced rollback';
 EXCEPTION WHEN OTHERS THEN caught:=true;
 END;
 ASSERT caught AND NOT EXISTS(SELECT 1 FROM public.shadowing_records WHERE id=a),'source rolled back';
 ASSERT NOT EXISTS(SELECT 1 FROM public.verified_practice_credits WHERE source_id=a),'credit rolled back';
 ASSERT (SELECT attempts=before_attempts FROM public.user_progress WHERE user_id=p AND unit_id='hsk1-unit1'),'progress rolled back';
 ASSERT NOT has_function_privilege('authenticated','public.end_verified_conversation(uuid,uuid)','EXECUTE'),'client cannot invoke completion';
 ASSERT NOT has_function_privilege('anon','public.credit_verified_practice(uuid,text,uuid,integer)','EXECUTE'),'anonymous cannot credit';
 ASSERT NOT has_table_privilege('authenticated','public.user_progress','UPDATE'),'client cannot forge progress';
 ASSERT NOT has_table_privilege('authenticated','public.verified_conversation_turns','SELECT'),'private trusted turns';
END $$;
