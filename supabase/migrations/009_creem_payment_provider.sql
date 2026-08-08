-- 009: migrate subscriptions from a provider-specific schema to Creem.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'subscriptions'
      AND column_name = 'lemon_squeezy_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'subscriptions'
      AND column_name = 'provider_subscription_id'
  ) THEN
    ALTER TABLE public.subscriptions
      RENAME COLUMN lemon_squeezy_id TO provider_subscription_id;
  END IF;
END $$;

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS payment_provider TEXT;

UPDATE public.subscriptions
SET payment_provider = 'lemon_squeezy'
WHERE provider_subscription_id IS NOT NULL AND payment_provider IS NULL;

WITH ranked AS (
  SELECT id,
    ROW_NUMBER() OVER (
      PARTITION BY user_id
      ORDER BY
        CASE plan WHEN 'pro' THEN 3 WHEN 'plus' THEN 2 ELSE 1 END DESC,
        updated_at DESC NULLS LAST,
        created_at DESC NULLS LAST
    ) AS row_number
  FROM public.subscriptions
)
DELETE FROM public.subscriptions
WHERE id IN (SELECT id FROM ranked WHERE row_number > 1);

CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_user_id_unique
  ON public.subscriptions(user_id);

CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_provider_id_unique
  ON public.subscriptions(provider_subscription_id)
  WHERE provider_subscription_id IS NOT NULL;
