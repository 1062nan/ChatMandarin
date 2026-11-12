import { describe, expect, it } from 'vitest'
import { guidedLessonPlan } from './daily-plan'
const now = new Date('2026-11-13T03:09:03.000Z')
describe('guided daily learning plan', () => {
  it('offers a first lesson only after a successful empty read', () => {
    expect(guidedLessonPlan(null, false, now)).toEqual({ status: 'new', checkedAt: now.toISOString() })
  })
  it.each([null, { next_review_at: '2026-11-13T03:09:02Z' }])('never treats a read failure as no progress', progress => {
    expect(guidedLessonPlan(progress, true, now).status).toBe('unavailable')
  })
  it.each(['invalid', ''])('does not present invalid schedule %s as completed or due', next_review_at => {
    expect(guidedLessonPlan({ next_review_at }, false, now).status).toBe('unavailable')
  })
  it.each(['2026-11-13T03:09:02Z', '2026-11-13T11:09:03+08:00'])('prioritizes recall at or after the exact server deadline %s', next_review_at => {
    expect(guidedLessonPlan({ next_review_at }, false, now).status).toBe('due')
  })
  it('retains a future deadline without unlocking recall early', () => {
    expect(guidedLessonPlan({ next_review_at: '2026-11-13T11:09:04+08:00' }, false, now)).toEqual({ status: 'scheduled', checkedAt: now.toISOString(), nextReviewAt: '2026-11-13T03:09:04.000Z' })
  })
})
