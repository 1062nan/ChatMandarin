import type { ParsedCreemEvent } from './creem'

export type BillingState = {
  plan: 'plus' | 'pro' | null
  status: 'active' | 'trialing' | 'past_due' | 'canceled' | 'expired'
  cancelAtPeriodEnd: boolean
}

const updates: Record<string, BillingState['status']> = {
  active: 'active', trialing: 'trialing', scheduled_cancel: 'active',
  canceled: 'canceled', past_due: 'past_due', paused: 'past_due', unpaid: 'past_due', expired: 'expired',
}

/** Unknown/ambiguous payment states must never default to granting access. */
export function subscriptionEventState(event: ParsedCreemEvent): BillingState | null {
  let status: BillingState['status']
  let cancelAtPeriodEnd = false
  switch (event.eventType) {
    case 'subscription.active':
    case 'subscription.paid': status = 'active'; break
    case 'subscription.trialing': status = 'trialing'; break
    case 'subscription.update':
      if (!event.status || !updates[event.status]) throw new Error('Unsupported subscription status')
      status = updates[event.status]
      cancelAtPeriodEnd = event.status === 'scheduled_cancel' || event.status === 'canceled'
      break
    case 'subscription.scheduled_cancel': status = 'active'; cancelAtPeriodEnd = true; break
    case 'subscription.canceled': status = 'canceled'; cancelAtPeriodEnd = true; break
    case 'subscription.past_due':
    case 'subscription.paused':
    case 'subscription.unpaid': status = 'past_due'; break
    case 'subscription.expired': status = 'expired'; break
    // A partial refund or a dispute on an older invoice does not prove that the
    // current recurring entitlement should be revoked. Reconcile with provider.
    case 'refund.created':
    case 'dispute.created': throw new Error('Payment event requires reconciliation')
    default: return null
  }
  if (cancelAtPeriodEnd && (!event.currentPeriodEnd || !Number.isFinite(Date.parse(event.currentPeriodEnd)))) {
    throw new Error('Cancellation period end is required')
  }
  if ((status === 'active' || status === 'trialing') && !event.plan) {
    throw new Error('Verified product mapping is required')
  }
  return { plan: event.plan, status, cancelAtPeriodEnd }
}
