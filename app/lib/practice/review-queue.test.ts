import { describe, expect, it, vi } from 'vitest'
import { collectReviewQueue } from './review-queue'
import type { Mistake } from '@/lib/db/types'
const valid = { correct: '我昨天去', explanation: '' } as Mistake
const hint = { correct: '（更简单的表达）', explanation: '' } as Mistake
describe('review queue pagination', () => {
  it('does not hide valid cards behind quarantined hints', async () => {
    const fetch = vi.fn().mockResolvedValueOnce({ data: Array(100).fill(hint), error: null }).mockResolvedValueOnce({ data: [valid], error: null })
    expect(await collectReviewQueue(fetch)).toEqual({ cards: [valid], hasMore: false })
    expect(fetch).toHaveBeenLastCalledWith(100, 199)
  })
  it('bounds reads and exposes truncation', async () => {
    const fetch = vi.fn().mockResolvedValue({ data: Array(100).fill(hint), error: null })
    expect(await collectReviewQueue(fetch)).toEqual({ cards: [], hasMore: true })
    expect(fetch).toHaveBeenCalledTimes(10)
  })
  it('limits batches without claiming all cards are loaded', async () => {
    expect(await collectReviewQueue(async () => ({ data: Array(60).fill(valid), error: null }))).toMatchObject({ hasMore: true })
  })
})
