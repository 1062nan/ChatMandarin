import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
import { DailyGuidedPlan } from './daily-guided-plan'
import type { GuidedLessonPlan } from '@/lib/lessons/daily-plan'
const checkedAt = '2026-11-12T10:00:00.000Z'
const nextReviewAt = '2026-11-13T03:09:03.000Z'
function render(plan: GuidedLessonPlan) { return renderToStaticMarkup(<DailyGuidedPlan plan={plan} />) }
beforeEach(() => vi.stubGlobal('React', React))
describe('daily learning card', () => {
  it('offers explicit memory-first practice when due', () => {
    const html = render({ status: 'due', checkedAt, nextReviewAt })
    expect(html).toContain('Open recall practice')
    expect(html).toContain('try from memory before using a hint')
    expect(html).toContain('href="/learn/restaurant"')
    expect(html).not.toContain('Start the lesson')
  })
  it('shows an honest future schedule, not an early review action', () => {
    const html = render({ status: 'scheduled', checkedAt, nextReviewAt })
    expect(html).toContain('dateTime="2026-11-13T03:09:03.000Z"')
    expect(html).toContain('2026-11-13 03:09 UTC')
    expect(html).toContain('Open the lesson')
    expect(html).not.toContain('Open recall practice')
  })
  it('offers a scoped introductory lesson for a new learner', () => {
    expect(render({ status: 'new', checkedAt })).toContain('Start the lesson')
  })
  it('does not erase learner progress in its error copy', () => {
    const html = render({ status: 'unavailable', checkedAt })
    expect(html).toContain('saved progress has not been reset')
    expect(html).toContain('Check schedule')
    expect(html).not.toContain('Start the lesson')
  })
  it.each(['new', 'due', 'scheduled', 'unavailable'] as const)('makes no proficiency or exam guarantee in %s state', status => {
    expect(render({ status, checkedAt, nextReviewAt })).toContain('not a proficiency certificate or exam score')
  })
})
