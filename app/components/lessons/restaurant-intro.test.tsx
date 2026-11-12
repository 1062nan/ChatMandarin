import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { RestaurantIntro } from './restaurant-intro'
const props = { nextReviewAt: '2026-11-13T03:09:03Z', due: true, loading: false, scheduleError: '', onLearn: vi.fn(), onReview: vi.fn(), onRefresh: vi.fn() }
beforeEach(() => vi.stubGlobal('React', React))
describe('memory-first lesson destination', () => {
  it('puts due recall before the model and repeat-lesson action', () => {
    const html = renderToStaticMarkup(<RestaurantIntro {...props} />)
    expect(html.indexOf('Start 4 recall tasks')).toBeLessThan(html.indexOf('Your goal'))
    expect(html.indexOf('Start 4 recall tasks')).toBeLessThan(html.indexOf('Practise the lesson again'))
  })
  it.each([{ due: false }, { loading: true }, { scheduleError: 'Could not check' }, { nextReviewAt: null }])('does not offer recall without a confirmed due schedule: %j', changes => {
    const html = renderToStaticMarkup(<RestaurantIntro {...props} {...changes} />)
    expect(html).not.toContain('Start 4 recall tasks')
  })
})
