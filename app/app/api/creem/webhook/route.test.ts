import { createHmac } from 'crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), admin: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createSupabaseAdmin: mocks.admin }))
import { POST } from './route'
function request(overrides: Record<string, unknown> = {}, valid = true) {
  const body = JSON.stringify({ id: 'evt_1', eventType: 'subscription.paid', created_at: 1700000000000,
    object: { object: 'subscription', id: 'sub_1', product: 'prod_plus', mode: 'test', status: 'active', metadata: { user_id: 'profile_1', plan: 'plus' } }, ...overrides })
  return new NextRequest('https://example.test/api/creem/webhook', { method: 'POST', body,
    headers: { 'creem-signature': valid ? createHmac('sha256', 'test-secret').update(body).digest('hex') : 'invalid' } })
}
beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('CREEM_WEBHOOK_SECRET', 'test-secret')
  vi.stubEnv('CREEM_PLUS_PRODUCT_ID', 'prod_plus')
  vi.stubEnv('CREEM_TEST_MODE', 'true')
  mocks.admin.mockReturnValue({ rpc: mocks.rpc })
  mocks.rpc.mockResolvedValue({ data: { outcome: 'applied' }, error: null })
})
describe('Creem webhook transaction boundary', () => {
  it('rejects invalid signature before DB access', async () => {
    expect((await POST(request({}, false))).status).toBe(401)
    expect(mocks.admin).not.toHaveBeenCalled()
  })
  it('uses a single ordered transactional RPC instead of separate writes', async () => {
    expect((await POST(request())).status).toBe(200)
    expect(mocks.rpc).toHaveBeenCalledOnce()
    expect(mocks.rpc).toHaveBeenCalledWith('apply_creem_subscription_event', expect.objectContaining({ p_event_created_at: '2023-11-14T22:13:20.000Z', p_plan: 'plus', p_profile_id: 'profile_1', p_event_hash: expect.stringMatching(/^[a-f0-9]{64}$/) }))
  })
  it.each(['duplicate', 'stale'])('acknowledges safe %s outcome', async (outcome) => {
    mocks.rpc.mockResolvedValue({ data: { outcome }, error: null })
    expect((await POST(request())).status).toBe(200)
  })
  it('does not acknowledge an ordering/owner conflict as successful', async () => {
    mocks.rpc.mockResolvedValue({ data: { outcome: 'conflict' }, error: null })
    expect((await POST(request())).status).toBe(409)
  })
  it('requires ordering data', async () => {
    expect((await POST(request({ created_at: null }))).status).toBe(400)
    expect(mocks.rpc).not.toHaveBeenCalled()
  })
  it('rejects payment mode mismatch', async () => {
    vi.stubEnv('CREEM_TEST_MODE', 'false')
    expect((await POST(request())).status).toBe(400)
    expect(mocks.rpc).not.toHaveBeenCalled()
  })
  it('keeps failed persistence retryable', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: new Error('db failed') })
    expect((await POST(request())).status).toBe(500)
  })
})
