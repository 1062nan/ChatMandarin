import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AttemptFeedback } from './attempt-feedback'
import { RESTAURANT_LESSON } from '@/lib/lessons/restaurant'
import { MEETING_TIME_LESSON } from '@/lib/lessons/meeting-time'
import { gradeLessonTasks, tasksForLesson, type LessonMode } from '@/lib/lessons/core'
beforeEach(() => vi.stubGlobal('React', React))
describe('current attempt feedback', () => {
  for (const lesson of [RESTAURANT_LESSON, MEETING_TIME_LESSON]) for (const mode of ['learn', 'review'] as LessonMode[]) {
    it(`${lesson.id} ${mode}: revisit only supported tasks without changing evidence`, () => {
      const tasks = tasksForLesson(lesson, mode)
      const answers = tasks.map(t => ({ id:t.id, value:t.options ? String(t.correctOption) : t.example, hintUsed:false, firstTry:true }))
      answers[0].hintUsed = true
      const before = gradeLessonTasks(lesson, mode, answers)
      const html = renderToStaticMarkup(<AttemptFeedback lesson={lesson} mode={mode} answers={answers} />)
      expect(html).toContain(tasks[0].prompt)
      expect(html).toContain('A hint was shown.')
      expect(html).toContain(tasks[0].example)
      expect(html).toContain('not in your saved progress')
      expect(html).toContain('<details')
      expect(html).not.toContain('<details open')
      expect(html).not.toContain(tasks[1].prompt)
      if(tasks[0].options) expect(html).toContain(tasks[0].options[tasks[0].correctOption!])
      expect(gradeLessonTasks(lesson, mode, answers)).toEqual(before)
    })
  }
  it('gives a wrong choice specific feedback, not a valid-phrasing caveat', () => {
    const lesson = MEETING_TIME_LESSON
    const answers = lesson.learnTasks.map(t => ({id:t.id,value:t.options ? String(t.correctOption) : t.example,hintUsed:false,firstTry:true}))
    answers[1].value = '0'
    answers[1].firstTry = false
    const html = renderToStaticMarkup(<AttemptFeedback lesson={lesson} mode="learn" answers={answers} />)
    expect(html).toContain('This choice does not match the task')
    expect(html).not.toContain('another phrasing may still be valid')
  })
  it('escapes answers and distinguishes unmatched from incorrect Chinese', () => {
    const lesson = MEETING_TIME_LESSON
    const answers = lesson.reviewTasks.map(t => ({id:t.id,value:'<script>alert(1)</script>',hintUsed:false,firstTry:false}))
    const html = renderToStaticMarkup(<AttemptFeedback lesson={lesson} mode="review" answers={answers} />)
    expect(html).toContain('&lt;script&gt;')
    expect(html).not.toContain('<script>')
    expect(html).toContain('another phrasing may still be valid')
    expect(html).toContain('Not recorded as a first-try match')
    expect(html).not.toContain('A hint was shown')
  })
  it('does not invent support or permanent mastery for unaided results', () => {
    const lesson = MEETING_TIME_LESSON
    const answers = lesson.reviewTasks.map(t => ({id:t.id,value:t.example,hintUsed:false,firstTry:true}))
    const html = renderToStaticMarkup(<AttemptFeedback lesson={lesson} mode="review" answers={answers} />)
    expect(html).toContain('not permanent mastery')
    expect(html).not.toContain('<details')
  })
})
