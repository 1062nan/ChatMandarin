import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach,describe,it,expect,vi } from 'vitest'
vi.mock('next/navigation',()=>({useRouter:()=>({refresh:vi.fn()})}))
import { GuidedLearningPath } from './guided-learning-path'
import { guidedPathway } from '@/lib/lessons/pathway'
import { planDailySession,type CorrectionSchedule } from '@/lib/lessons/daily-session'
const now=new Date('2026-11-13T03:00:00Z')
const cards=guidedPathway([],false,now)
const known:CorrectionSchedule={status:'known',dueCount:3,hasMoreDue:false,earliestDueAt:'2026-11-12T00:00:00Z',nextReviewAt:null,incomplete:false}
const render=(schedule:CorrectionSchedule)=>renderToStaticMarkup(<GuidedLearningPath cards={cards} dailySession={planDailySession(cards,schedule,now)} />)
beforeEach(()=>vi.stubGlobal('React',React))
describe('one daily action across practice types',()=>{
  it('offers one correction action rather than competing new-lesson recommendation',()=>{
    const html=render(known)
    expect(html.match(/Open correction recall/g)).toHaveLength(1)
    expect(html).not.toContain('Start the lesson')
    expect(html.match(/View lesson/g)).toHaveLength(2)
    expect(html).toContain('href="/mistakes"')
  })
  it('uses a lower-bound count for incomplete large batches',()=>{
    expect(render({...known,dueCount:10,hasMoreDue:true})).toContain('At least 10 correction cards')
  })
  it('shows unknown state and retry, not an empty/new conclusion',()=>{
    const html=render({status:'unavailable'})
    expect(html).toContain('Some review schedules could not be confirmed')
    expect(html).toContain('Check schedule')
    expect(html).not.toContain('Start the lesson')
    expect(html).not.toContain('Open correction recall')
  })
})
