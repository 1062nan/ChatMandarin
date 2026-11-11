INSERT INTO public.mistakes(id,user_id,type,user_said,correct,review_count,next_review_at,mastered)
VALUES('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','22222222-2222-2222-2222-222222222222','grammar','我去昨天','我昨天去',4,now()-interval '1 day',true),
('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','44444444-4444-4444-4444-444444444444','grammar','他去昨天','他昨天去',0,now()-interval '1 day',false);
DO $$ BEGIN
 IF (SELECT consecutive_successes FROM mistakes WHERE id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') <> 0 THEN RAISE EXCEPTION 'legacy history must not infer successes'; END IF;
END $$;
SELECT set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE affected integer; BEGIN
 IF (SELECT count(*) FROM public.mistakes) <> 1 THEN RAISE EXCEPTION 'owner RLS failed'; END IF;
 UPDATE public.mistakes SET review_count=5,consecutive_successes=1,next_review_at=now()+interval '1 day',mastered=false
 WHERE id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' AND user_id='22222222-2222-2222-2222-222222222222' AND review_count=4 AND next_review_at<=now();
 GET DIAGNOSTICS affected=ROW_COUNT;
 IF affected <> 1 THEN RAISE EXCEPTION 'due update failed'; END IF;
 UPDATE public.mistakes SET review_count=6,consecutive_successes=2
 WHERE id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' AND review_count=4 AND next_review_at<=now();
 GET DIAGNOSTICS affected=ROW_COUNT;
 IF affected <> 0 THEN RAISE EXCEPTION 'duplicate review advanced state'; END IF;
 UPDATE public.mistakes SET review_count=1 WHERE id='bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
 GET DIAGNOSTICS affected=ROW_COUNT;
 IF affected <> 0 THEN RAISE EXCEPTION 'other user update permitted'; END IF;
END $$;
RESET ROLE;
SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claim.sub','',true);
DO $$ BEGIN
 BEGIN
   IF EXISTS(SELECT 1 FROM public.mistakes) THEN RAISE EXCEPTION 'anonymous read permitted'; END IF;
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
