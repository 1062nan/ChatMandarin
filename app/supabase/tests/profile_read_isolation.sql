-- Caller must wrap in BEGIN/ROLLBACK and set test.profile_id to the approved account.
-- This test reads only rows visible to that account after the owner-only policy.
SELECT set_config('request.jwt.claim.sub',(SELECT auth_id::text FROM public.profiles WHERE id=current_setting('test.profile_id')::uuid),true);
SET LOCAL ROLE authenticated;
DO $$
BEGIN
 ASSERT (SELECT count(*)=1 FROM public.profiles),'only current profile is visible';
 ASSERT (SELECT id=current_setting('test.profile_id')::uuid FROM public.profiles),'visible profile is owned';
 ASSERT NOT has_table_privilege('anon','public.profiles','SELECT'),'anonymous profile reads denied';
END $$;
RESET ROLE;
