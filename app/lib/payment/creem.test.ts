import { afterEach, describe, expect, it, vi } from 'vitest'
import { createHmac } from 'crypto'
import { parseCreemEvent, verifyCreemWebhookSignature } from './creem'

afterEach(() => vi.unstubAllEnvs())

describe('Creem webhook handling', () => {
  it('verifies the exact raw payload signature', () => {
    vi.stubEnv('CREEM_WEBHOOK_SECRET', 'test-secret')
    const payload = '{"id":"evt_1"}'
    const signature = createHmac('sha256', 'test-secret').update(payload).digest('hex')
    expect(verifyCreemWebhookSignature(payload, signature)).toBe(true)
    expect(verifyCreemWebhookSignature(`${payload} `, signature)).toBe(false)
    expect(verifyCreemWebhookSignature(payload, 'bad')).toBe(false)
  })

  it('extracts canonical subscription metadata from nested events', () => {
    vi.stubEnv('CREEM_PRO_PRODUCT_ID', 'prod_pro')
    expect(parseCreemEvent({
      id: 'evt_2',
      eventType: 'subscription.active',
      eventCreatedAt: null,
      object: {
        customer: { email: 'learner@example.com' },
        subscription: {
          id: 'sub_1',
          product: 'prod_pro',
          status: 'active',
          current_period_end_date: '2026-09-01T00:00:00Z',
          metadata: { user_id: 'profile_1', plan: 'pro' },
        },
      },
    })).toMatchObject({
      eventId: 'evt_2',
      eventType: 'subscription.active',
      userId: 'profile_1',
      customerEmail: 'learner@example.com',
      subscriptionId: 'sub_1',
      plan: 'pro',
      status: 'active',
    })
  })

  it('rejects unknown plan metadata', () => {
    expect(parseCreemEvent({
      id: 'evt_3',
      eventType: 'subscription.active',
      object: { metadata: { plan: 'enterprise' } },
    }).plan).toBeNull()
  })

  it('finds the subscription referenced by refund transactions', () => {
    expect(parseCreemEvent({
      id: 'evt_refund',
      eventType: 'refund.created',
      created_at: 1_728_734_351_631,
      object: { transaction: { subscription: 'sub_refunded' } },
    })).toMatchObject({
      subscriptionId: 'sub_refunded',
      eventCreatedAt: 1_728_734_351_631,
    })
  })
})


describe('product validation', () => {
  it('never grants a plan from metadata alone', () => {
    expect(parseCreemEvent({ object: { metadata: { plan: 'pro' } } }).plan).toBeNull()
  })
  it('rejects inconsistent product and metadata', () => {
    vi.stubEnv('CREEM_PLUS_PRODUCT_ID', 'prod_plus')
    expect(parseCreemEvent({ object: { product: 'prod_plus', metadata: { plan: 'pro' } } }).plan).toBeNull()
  })
})
