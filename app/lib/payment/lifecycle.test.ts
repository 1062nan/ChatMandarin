import { describe, expect, it } from 'vitest'
import { subscriptionEventState } from './lifecycle'
import type { ParsedCreemEvent } from './creem'
const event: ParsedCreemEvent = {
  eventId: 'evt1', eventType: 'subscription.update', eventCreatedAt: 1,
  userId: 'user', customerEmail: null, plan: 'plus', subscriptionId: 'sub',
  status: 'active', currentPeriodEnd: '2027-01-01T00:00:00Z', productId: 'prod', mode: 'test',
}
describe('billing state mapping', () => {
  it.each(['unpaid', 'past_due', 'paused'])('%s never grants active access', (status) => {
    expect(subscriptionEventState({ ...event, status })?.status).toBe('past_due')
  })
  it('rejects unknown and absent update status', () => {
    expect(() => subscriptionEventState({ ...event, status: 'unknown' })).toThrow()
    expect(() => subscriptionEventState({ ...event, status: null })).toThrow()
  })
  it('requires verified product to grant', () => {
    expect(() => subscriptionEventState({ ...event, plan: null })).toThrow()
  })
  it('requires known period end for scheduled cancellation', () => {
    expect(subscriptionEventState({ ...event, status: 'scheduled_cancel' })).toMatchObject({ status: 'active', cancelAtPeriodEnd: true })
    expect(() => subscriptionEventState({ ...event, status: 'scheduled_cancel', currentPeriodEnd: null })).toThrow()
  })
  it.each(['refund.created', 'dispute.created'])('does not blindly revoke on %s', (eventType) => {
    expect(() => subscriptionEventState({ ...event, eventType })).toThrow('reconciliation')
  })
  it('ignores non-subscription checkout notifications', () => {
    expect(subscriptionEventState({ ...event, eventType: 'checkout.completed' })).toBeNull()
  })
})
