import { guidedLearningQueue } from './daily-plan'
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

describe('two-lesson daily queue', () => {
  const now=new Date('2026-11-13T12:00:00Z')
  it('puts due recall before new content regardless of lesson order', () => {
    const queue=guidedLearningQueue([{lesson_id:'meeting-time-v1',next_review_at:'2026-11-13T10:00:00Z'}],false,now)
    expect(queue.map(c=>c.id)).toEqual(['meeting-time-v1','restaurant-order-v1'])
    expect(queue.map(c=>c.plan.status)).toEqual(['due','new'])
  })
  it('orders both due lessons by due time, independently', () => {
    const queue=guidedLearningQueue([{lesson_id:'restaurant-order-v1',next_review_at:'2026-11-13T11:00:00Z'},{lesson_id:'meeting-time-v1',next_review_at:'2026-11-12T10:00:00Z'}],false,now)
    expect(queue.map(c=>c.id)).toEqual(['meeting-time-v1','restaurant-order-v1'])
    expect(queue.every(c=>c.plan.status==='due')).toBe(true)
  })
  it('offers new content while earlier lesson waits for recall', () => {
    const queue=guidedLearningQueue([{lesson_id:'restaurant-order-v1',next_review_at:'2026-11-14T10:00:00Z'}],false,now)
    expect(queue.map(c=>c.plan.status)).toEqual(['new','scheduled'])
    expect(queue[0].id).toBe('meeting-time-v1')
  })
  it('keeps initial course order and never treats a failed read as new', () => {
    expect(guidedLearningQueue(null,false,now).map(c=>c.id)).toEqual(['restaurant-order-v1','meeting-time-v1'])
    expect(guidedLearningQueue(null,true,now).every(c=>c.plan.status==='unavailable')).toBe(true)
  })
})
