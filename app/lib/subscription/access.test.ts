import { describe, expect, it } from 'vitest'
import { getEffectivePlan } from './access'

describe('getEffectivePlan', () => {
  it('grants active and trialing subscriptions', () => {
    expect(getEffectivePlan({ plan: 'plus', status: 'active' })).toBe('plus')
    expect(getEffectivePlan({ plan: 'pro', status: 'trialing' })).toBe('pro')
  })

  it('keeps canceled access only through a future period end', () => {
    expect(getEffectivePlan({
      plan: 'pro',
      status: 'canceled',
      current_period_end: '2999-01-01T00:00:00.000Z',
    })).toBe('pro')
    expect(getEffectivePlan({
      plan: 'pro',
      status: 'canceled',
      current_period_end: '2000-01-01T00:00:00.000Z',
    })).toBe('free')
  })

  it('denies paid features for non-entitled states', () => {
    expect(getEffectivePlan(null)).toBe('free')
    expect(getEffectivePlan({ plan: 'plus', status: 'past_due' })).toBe('free')
    expect(getEffectivePlan({ plan: 'unexpected', status: 'active' })).toBe('free')
  })
})
