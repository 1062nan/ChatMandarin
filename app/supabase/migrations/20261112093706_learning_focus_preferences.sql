-- Optional preferences only. No backfill, placement, entitlement or progress changes.
CREATE TABLE public.learning_preferences (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  focus text NOT NULL CHECK (focus IN ('guided', 'speaking')),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.learning_preferences ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.learning_preferences FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.learning_preferences TO authenticated;
GRANT ALL ON public.learning_preferences TO service_role;
CREATE POLICY learning_preferences_owner_read ON public.learning_preferences FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=user_id AND p.auth_id=auth.uid()));
CREATE POLICY learning_preferences_owner_insert ON public.learning_preferences FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=user_id AND p.auth_id=auth.uid()));
CREATE POLICY learning_preferences_owner_update ON public.learning_preferences FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=user_id AND p.auth_id=auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=user_id AND p.auth_id=auth.uid()));
