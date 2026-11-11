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

import { reviewMistake, ReviewConflictError } from './mistakes'
const due = { id: 'card', user_id: 'user', correct: '我昨天去', explanation: '', review_count: 4, consecutive_successes: 0, ease_factor: 2.5, interval_days: 1, next_review_at: '2020-01-01T00:00:00.000Z' }
function reviewSetup(row = due, saved: object | null = { ...due, review_count: 5 }) {
  const q: any = {}
  for (const name of ['select', 'eq', 'lte', 'is', 'update']) q[name] = vi.fn(() => q)
  q.single = vi.fn().mockResolvedValue({ data: row, error: null })
  q.maybeSingle = vi.fn().mockResolvedValue({ data: saved, error: null })
  mocks.client.mockResolvedValue({ from: vi.fn(() => q) })
  return q
}
describe('due review write boundary', () => {
  it('scopes read and compare-and-swap to owner and previous version', async () => {
    const q = reviewSetup()
    await reviewMistake('card', 4, 'user', 4)
    expect(q.eq.mock.calls.filter(([key]: string[]) => key === 'user_id')).toEqual([['user_id', 'user'], ['user_id', 'user']])
    expect(q.eq).toHaveBeenCalledWith('review_count', 4)
    expect(q.eq).toHaveBeenCalledWith('next_review_at', due.next_review_at)
    expect(q.update).toHaveBeenCalledWith(expect.objectContaining({ consecutive_successes: 1, mastered: false }))
  })
  it('rejects stale or future reviews without updating', async () => {
    const q = reviewSetup({ ...due, next_review_at: '2099-01-01T00:00:00Z' })
    await expect(reviewMistake('card', 4, 'user', 4)).rejects.toBeInstanceOf(ReviewConflictError)
    expect(q.update).not.toHaveBeenCalled()
    reviewSetup()
    await expect(reviewMistake('card', 4, 'user', 3)).rejects.toBeInstanceOf(ReviewConflictError)
  })
  it('rejects a race loser instead of counting another success', async () => {
    reviewSetup(due, null)
    await expect(reviewMistake('card', 5, 'user', 4)).rejects.toBeInstanceOf(ReviewConflictError)
  })
})
