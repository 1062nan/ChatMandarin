import { beforeEach, describe, expect, it, vi } from 'vitest'
const { server, admin } = vi.hoisted(() => ({ server: vi.fn(), admin: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createSupabaseServerClient: server, createSupabaseAdmin: admin }))
import { GET } from './route'
function query(result: unknown) {
  const q: any = { select: () => q, eq: vi.fn(() => q), limit: async () => result, maybeSingle: async () => result }
  return q
}
beforeEach(() => {
  vi.resetAllMocks()
  server.mockResolvedValue({ auth: { getUser: async () => ({ data: { user: { id: 'auth' } } }) }, from: () => query({ data: { id: 'profile' } }) })
  admin.mockReturnValue({ from: () => query({ error: null }) })
})
describe('practice deployment readiness', () => {
  it('requires sign-in before checking private database access', async () => {
    server.mockResolvedValue({ auth: { getUser: async () => ({ data: { user: null } }) } })
    expect((await GET()).status).toBe(401)
    expect(admin).not.toHaveBeenCalled()
  })
  it('returns only a readiness boolean, never a key or record', async () => {
    const result = await GET()
    expect(result.status).toBe(200)
    expect(await result.json()).toEqual({ ready: true })
  })
  it.each(['missing key', 'permission denied'])('fails closed on %s', async cause => {
    if (cause === 'missing key') admin.mockImplementation(() => { throw new Error('secret details') })
    else admin.mockReturnValue({ from: () => query({ error: new Error('secret details') }) })
    const result=await GET()
    expect(result.status).toBe(503)
    expect(await result.json()).toEqual({ ready: false })
  })
})
