import { beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ client: vi.fn(), context: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createSupabaseServerClient: mocks.client }))
vi.mock('@/lib/subscription/tier', () => ({ getSubscriptionContext: mocks.context }))
import { createMistakesFromErrors } from './mistakes'
const options = { userId: 'user', conversationId: 'conv', hskLevel: 1, scenario: 'test', errors: [{ type: 'grammar' as const, user_said: '我去昨天', correct: '我昨天去' }] }
function setup(existing: Array<{ correct: string; explanation?: string }>, error: Error | null = null) {
  const insert = vi.fn().mockResolvedValue({ error })
  const query: any = { insert }
  for (const method of ['select', 'eq', 'order']) query[method] = vi.fn(() => query)
  query.range = vi.fn().mockResolvedValue({ data: existing, error: null })
  mocks.client.mockResolvedValue({ from: vi.fn(() => query) })
  return query
}
beforeEach(() => { vi.resetAllMocks(); mocks.context.mockResolvedValue({ features: { mistakeCapacity: 20 } }) })
describe('mistake journal capacity', () => {
  it('does not let quarantined tutor hints consume the free capacity', async () => {
    const query = setup(Array.from({ length: 20 }, () => ({ correct: '（更简单的表达）' })))
    await createMistakesFromErrors(options)
    expect(query.insert).toHaveBeenCalledTimes(1)
  })
  it('still respects capacity for valid cards', async () => {
    const query = setup(Array.from({ length: 20 }, () => ({ correct: '正确表达' })))
    await createMistakesFromErrors(options)
    expect(query.insert).not.toHaveBeenCalled()
  })
  it('propagates failed saves so the durable turn can expose a journal warning', async () => {
    setup([], new Error('Journal write failed'))
    await expect(createMistakesFromErrors(options)).rejects.toThrow('Journal write failed')
  })
  it('checks later pages when an entire page is quarantined', async () => {
    const query = setup([])
    query.range.mockResolvedValueOnce({ data: Array.from({ length: 100 }, () => ({ correct: '（更简单的表达）' })), error: null })
    await createMistakesFromErrors(options)
    expect(query.range).toHaveBeenCalledTimes(2)
    expect(query.insert).toHaveBeenCalledTimes(1)
  })
})
