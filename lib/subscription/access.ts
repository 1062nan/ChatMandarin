import type { Plan } from '@/lib/subscription/tier'

interface SubscriptionAccessRecord {
  plan?: string | null
  status?: string | null
  current_period_end?: string | null
}

export function getEffectivePlan(subscription: SubscriptionAccessRecord | null): Plan {
  if (!subscription || subscription.plan === 'free') return 'free'
  if (subscription.status === 'active' || subscription.status === 'trialing') {
    return subscription.plan === 'pro' ? 'pro' : 'plus'
  }
  if (
    subscription.status === 'canceled'
    && subscription.current_period_end
    && new Date(subscription.current_period_end).getTime() > Date.now()
  ) {
    return subscription.plan === 'pro' ? 'pro' : 'plus'
  }
  return 'free'
}
