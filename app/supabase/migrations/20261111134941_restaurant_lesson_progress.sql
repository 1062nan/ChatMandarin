-- Separate self-practice progress. Does not grant XP, exam scores or unit unlocks.
CREATE TABLE IF NOT EXISTS public.lesson_progress (
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  lesson_id text NOT NULL CHECK (lesson_id = 'restaurant-order-v1'),
  completed_at timestamptz NOT NULL DEFAULT now(),
  next_review_at timestamptz NOT NULL,
  review_count integer NOT NULL DEFAULT 0 CHECK (review_count >= 0),
  recall_streak integer NOT NULL DEFAULT 0 CHECK (recall_streak >= 0),
  last_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, lesson_id)
);
ALTER TABLE public.lesson_progress ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.lesson_progress FROM anon, authenticated;
GRANT SELECT ON public.lesson_progress TO authenticated;
CREATE POLICY lesson_progress_owner_read ON public.lesson_progress FOR SELECT TO authenticated
 USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=user_id AND p.auth_id=auth.uid()));
-- Writes only through the authenticated application server; browser cannot advance due dates.
GRANT ALL ON public.lesson_progress TO service_role;
