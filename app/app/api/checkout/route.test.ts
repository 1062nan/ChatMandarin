import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
const mocks = vi.hoisted(() => ({ client: vi.fn(), available: vi.fn(), checkout: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createSupabaseServerClient: mocks.client }))
vi.mock('@/lib/payment/creem', () => ({ isCreemPaymentsAvailable: mocks.available, createCheckoutUrl: mocks.checkout }))
import { POST } from './route'
function query(data: unknown) {
  const q: any = {}
  for (const m of ['select', 'eq']) q[m] = () => q
  q.single = q.maybeSingle = async () => ({ data, error: null })
  return q
}
const request = () => new NextRequest('https://example.test/api/checkout', { method: 'POST', body: JSON.stringify({ plan: 'plus' }) })
beforeEach(() => {
  vi.clearAllMocks()
  mocks.available.mockReturnValue(false)
  mocks.client.mockResolvedValue({ auth: { getUser: async () => ({ data: { user: { id: 'auth' } } }) }, from: (table: string) => query(table === 'profiles' ? { id: 'profile', email: 'test@example.invalid' } : { provider_subscription_id: 'existing', status: 'active', plan: 'plus' }) })
})
describe('checkout safety gate', () => {
  it('never calls provider while checkout is disabled', async () => {
    expect((await POST(request())).status).toBe(503)
    expect(mocks.checkout).not.toHaveBeenCalled()
  })
  it('blocks another checkout for an existing provider subscription', async () => {
    mocks.available.mockReturnValue(true)
    expect((await POST(request())).status).toBe(409)
    expect(mocks.checkout).not.toHaveBeenCalled()
  })
  it('rejects anonymous checkout without provider calls', async () => {
    mocks.client.mockResolvedValue({ auth: { getUser: async () => ({ data: { user: null } }) } })
    expect((await POST(request())).status).toBe(401)
    expect(mocks.checkout).not.toHaveBeenCalled()
  })
})
