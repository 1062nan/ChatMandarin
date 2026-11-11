import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
const mocks = vi.hoisted(() => ({ client: vi.fn(), review: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createSupabaseServerClient: mocks.client }))
vi.mock('@/lib/db/mistakes', () => ({ reviewMistake: mocks.review, ReviewConflictError: class extends Error {} }))
import { ReviewConflictError } from '@/lib/db/mistakes'
import { GET, POST } from './route'
const id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
const payload = { mistake_id: id, quality: 4, expected_review_count: 0 }
function request(body: unknown) { return new NextRequest('http://localhost/api/mistakes/review', { method: 'POST', body: JSON.stringify(body) }) }
function setup(user: object | null = { id: 'auth' }, owner = 'profile') {
  const q: any = { select: () => q, eq: () => q, single: vi.fn()
    .mockResolvedValueOnce({ data: { id: 'profile' } }).mockResolvedValueOnce({ data: { user_id: owner } }) }
  mocks.client.mockResolvedValue({ auth: { getUser: async () => ({ data: { user } }) }, from: () => q })
  mocks.review.mockResolvedValue({ id, review_count: 1, consecutive_successes: 1 })
}
beforeEach(() => { vi.resetAllMocks(); setup() })
describe('recall review API', () => {
  it('rejects unauthenticated requests', async () => { setup(null); expect((await POST(request(payload))).status).toBe(401) })
  it.each([null, {}, { ...payload, quality: 3.5 }, { ...payload, expected_review_count: -1 }, { ...payload, mistake_id: 'bad' }])('rejects invalid payload', async body => {
    expect((await POST(request(body))).status).toBe(400); expect(mocks.review).not.toHaveBeenCalled()
  })
  it('rejects another owner', async () => { setup({ id: 'auth' }, 'other'); expect((await POST(request(payload))).status).toBe(404); expect(mocks.review).not.toHaveBeenCalled() })
  it('passes authenticated ownership and version to the write boundary', async () => {
    expect((await POST(request(payload))).status).toBe(200)
    expect(mocks.review).toHaveBeenCalledWith(id, 4, 'profile', 0)
  })
  it('returns a recoverable conflict for a stale review', async () => {
    mocks.review.mockRejectedValue(new ReviewConflictError('Already saved'))
    expect((await POST(request(payload))).status).toBe(409)
  })
})

describe('server-authoritative review queue', () => {
  it('requires authentication and never caches personal cards', async () => {
    setup(null)
    const response = await GET()
    expect(response.status).toBe(401)
    expect(response.headers.get('Cache-Control')).toBe('private, no-store')
  })
  it('uses one server timestamp and scopes both queue queries to the owner', async () => {
    const q: any = { single: async () => ({ data: { id: 'profile' }, error: null }), range: async () => ({ data: [], error: null }) }
    for (const method of ['select', 'eq', 'lte', 'gt', 'order']) q[method] = vi.fn(() => q)
    mocks.client.mockResolvedValue({ auth: { getUser: async () => ({ data: { user: { id: 'auth' } } }) }, from: () => q })
    const response = await GET()
    expect(response.status).toBe(200)
    expect(q.eq.mock.calls.filter(([name]: string[]) => name === 'user_id')).toEqual([['user_id', 'profile'], ['user_id', 'profile']])
    expect(q.lte.mock.calls[0][1]).toBe(q.gt.mock.calls[0][1])
    expect(await response.json()).toEqual({ due: { cards: [], hasMore: false }, upcoming: { cards: [], hasMore: false } })
  })
})
