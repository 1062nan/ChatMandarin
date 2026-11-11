-- Historical review_count cannot prove successful recall. Preserve all records,
-- dates and legacy mastered flags; establish a new conservative streak at zero.
ALTER TABLE public.mistakes
  ADD COLUMN IF NOT EXISTS consecutive_successes integer NOT NULL DEFAULT 0
  CHECK (consecutive_successes >= 0);
COMMENT ON COLUMN public.mistakes.consecutive_successes IS
  'Consecutive due reviews rated Good/Easy since this field was introduced; reset by a lapse.';
-- No new grants, RPCs or RLS policy changes. Existing owner RLS remains in effect.
