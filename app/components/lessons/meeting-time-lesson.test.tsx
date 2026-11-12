import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MeetingTimeLesson } from './meeting-time-lesson'
import { RestaurantLesson } from './restaurant-lesson'
import { LessonIntro } from './restaurant-intro'
import { MEETING_TIME_LESSON } from '@/lib/lessons/meeting-time'
beforeEach(()=>vi.stubGlobal('React',React))
describe('lesson shell compatibility and isolation',()=>{
  it('renders the meeting goal without restaurant content',()=>{
    const html=renderToStaticMarkup(<MeetingTimeLesson />)
    expect(html).toContain('Suggest a meeting time')
    expect(html).toContain('today or tomorrow at 3 or 4 pm')
    expect(html).not.toContain('noodles')
    expect(html).not.toContain('我们明天下午三点见') // No model shown before starting.
  })
  it('preserves restaurant initial goal and route wrapper',()=>{
    const html=renderToStaticMarkup(<RestaurantLesson />)
    expect(html).toContain('Order a simple meal')
    expect(html).toContain('Ask for noodles and a drink')
    expect(html).not.toContain('Suggest a meeting time')
  })
  it('puts meeting recall ahead of model/relearning only with a verified due state',()=>{
    const props={lesson:MEETING_TIME_LESSON,nextReviewAt:'2026-11-12T10:00:00Z',due:true,loading:false,scheduleError:'',onLearn:vi.fn(),onReview:vi.fn(),onRefresh:vi.fn()}
    const html=renderToStaticMarkup(<LessonIntro {...props} />)
    expect(html.indexOf('Start 4 recall tasks')).toBeLessThan(html.indexOf('Your goal'))
    expect(renderToStaticMarkup(<LessonIntro {...props} scheduleError="Unavailable" />)).not.toContain('Start 4 recall tasks')
  })
})
