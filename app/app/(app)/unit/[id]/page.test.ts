import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
const { createClient } = vi.hoisted(() => ({ createClient: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createSupabaseServerClient: createClient }))
vi.mock('@/lib/db/verified-practice', () => ({ ensureOwnedLearningProgress: vi.fn().mockResolvedValue(undefined) }))
vi.mock('./unit-client', () => ({ UnitClient: () => null }))
import UnitPage from './page'
function query(data: unknown) {
  const chain: any = { then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data, error: null }).then(resolve) }
  for (const method of ['select', 'eq', 'gt', 'order', 'limit', 'single', 'maybeSingle']) chain[method] = vi.fn(() => chain)
  return chain
}
beforeEach(() => { vi.clearAllMocks(); vi.stubGlobal('React', React) })
describe('unit destination threshold', () => {
  it.each([60, null])('uses next unit threshold %s instead of current entry threshold 0', async threshold => {
    const current = query({ id: 'unit', hsk_level: 1, sort_order: 1, unlock_score: 0 })
    const next = query(threshold === null ? null : { unlock_score: threshold })
    let units = 0
    createClient.mockResolvedValue({
      auth: { getUser: async () => ({ data: { user: { id: 'user' } } }) },
      from: (table: string) => table === 'profiles' ? query({ id: 'profile' }) : table === 'learning_units' ? units++ === 0 ? current : next : query([]),
    })
    const result = await UnitPage({ params: Promise.resolve({ id: 'unit' }) })
    const client = result?.props.children[1]
    expect(client.props.nextUnlockScore).toBe(threshold)
    expect(next.eq).toHaveBeenCalledWith('hsk_level', 1)
    expect(next.gt).toHaveBeenCalledWith('sort_order', 1)
    expect(next.eq).toHaveBeenCalledWith('is_active', true)
  })
})
