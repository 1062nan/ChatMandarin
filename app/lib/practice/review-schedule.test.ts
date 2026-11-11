import { describe, expect, it } from 'vitest'
import { calculateSRS } from './review-schedule'
const now = new Date('2026-01-01T12:00:00Z')
const fresh = { review_count: 0, ease_factor: 2.5, interval_days: 1, consecutive_successes: 0 }
describe('spaced recall schedule', () => {
  it('does not turn four failures and one success into mastery', () => {
    let state = calculateSRS(fresh, 0, now)
    for (let n = 0; n < 3; n++) state = calculateSRS(state, 0, now)
    const result = calculateSRS(state, 4, now)
    expect(result).toMatchObject({ review_count: 5, consecutive_successes: 1, interval_days: 1, mastered: false })
  })
  it('does not infer success from a legacy total review count', () => {
    expect(calculateSRS({ review_count: 25, ease_factor: 2.5, interval_days: 80 }, 5, now))
      .toMatchObject({ review_count: 26, consecutive_successes: 1, interval_days: 1, mastered: false })
  })
  it('progresses successful recalls and retains future maintenance', () => {
    let state = calculateSRS(fresh, 4, now)
    expect(state.interval_days).toBe(1)
    state = calculateSRS(state, 4, now)
    expect(state.interval_days).toBe(6)
    for (let n = 0; n < 3; n++) state = calculateSRS(state, 4, now)
    expect(state.mastered).toBe(true)
    expect(state.consecutive_successes).toBe(5)
    expect(new Date(state.next_review_at).getTime()).toBeGreaterThan(now.getTime())
  })
  it.each([0, 1, 2, 3])('resets streak on difficult/failed recall %s', quality => {
    expect(calculateSRS({ ...fresh, review_count: 20, consecutive_successes: 6, interval_days: 80 }, quality, now))
      .toMatchObject({ review_count: 21, consecutive_successes: 0, interval_days: 1, mastered: false, next_review_at: '2026-01-02T12:00:00.000Z' })
  })
  it('bounds long intervals and ease', () => {
    expect(calculateSRS({ ...fresh, consecutive_successes: 30, interval_days: 900, ease_factor: 5 }, 5, now))
      .toMatchObject({ interval_days: 180, ease_factor: 3 })
  })
  it.each([-1, 6, 4.5, NaN, Infinity])('rejects invalid quality %s', quality => {
    expect(() => calculateSRS(fresh, quality, now)).toThrow('Invalid recall quality')
  })
})
