-- Add one lesson without modifying any existing progress, ownership or grants.
ALTER TABLE public.lesson_progress
  DROP CONSTRAINT lesson_progress_lesson_id_check,
  ADD CONSTRAINT lesson_progress_lesson_id_check
    CHECK (lesson_id IN ('restaurant-order-v1', 'meeting-time-v1'));
