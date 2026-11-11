-- Profiles contain email and private account settings. No public profile surface exists.
-- Keep own-profile settings and service-role webhook lookups working.
DROP POLICY IF EXISTS "Public profiles are viewable" ON public.profiles;
CREATE POLICY "Users can read own profile" ON public.profiles
  FOR SELECT TO authenticated USING (auth_id = (SELECT auth.uid()));
REVOKE SELECT ON public.profiles FROM PUBLIC, anon;
GRANT SELECT ON public.profiles TO authenticated;
