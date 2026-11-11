import { beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ client: vi.fn(), fetch: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createSupabaseServerClient: mocks.client }))
import { POST } from './route'
function query(data: unknown) {
  const chain: any = {}
  for (const method of ['select', 'eq', 'not']) chain[method] = () => chain
  chain.single = chain.maybeSingle = async () => ({ data, error: null })
  return chain
}
beforeEach(() => {
  vi.clearAllMocks(); vi.stubEnv('CREEM_API_KEY', 'test-key'); vi.stubGlobal('fetch', mocks.fetch)
  mocks.fetch.mockResolvedValue({ ok: true })
  mocks.client.mockResolvedValue({ auth: { getUser: async () => ({ data: { user: { id: 'auth' } } }) },
    from: (table: string) => query(table === 'profiles' ? { id: 'profile' } : { id: 'local_sub', provider_subscription_id: 'sub_owned', cancel_at_period_end: false, current_period_end: '2027-01-01T00:00:00Z' }) })
})
describe('scheduled cancellation', () => {
  it('requests scheduled cancellation and reports pending canonical sync honestly', async () => {
    const response = await POST()
    expect(response.status).toBe(202)
    expect((await response.json()).pendingSync).toBe(true)
    expect(mocks.fetch).toHaveBeenCalledWith(expect.stringContaining('/subscriptions/sub_owned/cancel'), expect.objectContaining({ body: JSON.stringify({ mode: 'scheduled', onExecute: 'cancel' }) }))
  })
  it('does not call provider when signed out', async () => {
    mocks.client.mockResolvedValue({ auth: { getUser: async () => ({ data: { user: null } }) } })
    expect((await POST()).status).toBe(401)
    expect(mocks.fetch).not.toHaveBeenCalled()
  })
  it('reports provider failure without claiming cancellation', async () => {
    mocks.fetch.mockResolvedValue({ ok: false, status: 503 })
    expect((await POST()).status).toBe(502)
  })
})
