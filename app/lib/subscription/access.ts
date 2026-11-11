import type { Plan } from '@/lib/subscription/tier'

interface SubscriptionAccessRecord {
  plan?: string | null
  status?: string | null
  current_period_end?: string | null
  cancel_at_period_end?: boolean | null
}

export function getEffectivePlan(subscription: SubscriptionAccessRecord | null): Plan {
  if (!subscription || (subscription.plan !== 'plus' && subscription.plan !== 'pro')) return 'free'
  if (subscription.cancel_at_period_end && (!subscription.current_period_end
    || new Date(subscription.current_period_end).getTime() <= Date.now()
    || !Number.isFinite(new Date(subscription.current_period_end).getTime()))) return 'free'
  if (subscription.status === 'active' || subscription.status === 'trialing') {
    return subscription.plan
  }
  if (
    subscription.status === 'canceled'
    && subscription.current_period_end
    && new Date(subscription.current_period_end).getTime() > Date.now()
  ) {
    return subscription.plan
  }
  return 'free'
}
