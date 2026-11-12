import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach,describe,it,expect,vi } from 'vitest'
vi.mock('next/navigation',()=>({useRouter:()=>({refresh:vi.fn()})}))
import { GuidedLearningPath, EvidenceSummary } from './guided-learning-path'
import { guidedPathway } from '@/lib/lessons/pathway'
beforeEach(()=>vi.stubGlobal('React',React))
const now=new Date('2026-11-13T03:00:00Z')
const row=(id='restaurant-order-v1',date='2026-11-14T03:00:00Z')=>({lesson_id:id,next_review_at:date,review_count:0,last_summary:null})
const render=(rows:ReturnType<typeof row>[],unavailable=false)=>renderToStaticMarkup(<GuidedLearningPath cards={guidedPathway(rows,unavailable,now)} />)
describe('cohesive guided learning pathway',()=>{
  it('has one next action with both lessons available, not two competing start cards',()=>{
    const html=render([])
    expect(html.match(/Start the lesson/g)).toHaveLength(1)
    expect(html.match(/View lesson/g)).toHaveLength(2)
    expect(html).toContain('href="/learn/restaurant"')
    expect(html).toContain('href="/learn/meeting-time"')
    expect(html).toContain('nothing is locked')
  })
  it('puts due recall ahead of roadmap and does not expose answer models',()=>{
    const html=render([row('meeting-time-v1','2026-11-12T03:00:00Z')])
    expect(html.indexOf('Open recall practice')).toBeLessThan(html.indexOf('Practice records, not a proficiency assessment'))
    expect(html).not.toContain('Start the lesson')
    expect(html).not.toContain('我们明天下午三点见')
  })
  it('shows a dated future step without implying early recall or completion',()=>{
    const html=render([row(),row('meeting-time-v1')])
    expect(html).toContain('Next recall:')
    expect(html).not.toContain('Open recall practice')
    expect(html).not.toContain('all finished')
    expect(html).toContain('No delayed recall recorded yet')
  })
  it('shows unknown schedule warning instead of a first-lesson recommendation',()=>{
    const html=render([],true)
    expect(html).toContain('Some schedules could not be confirmed')
    expect(html).toContain('saved progress has not been reset')
    expect(html).not.toContain('Start the lesson')
    expect(html).toContain('Check schedule')
  })
  it('keeps the partial-error caveat even when known due work can be recommended',()=>{
    const html=render([row('restaurant-order-v1','invalid'),row('meeting-time-v1','2026-11-12T00:00:00Z')])
    expect(html).toContain('only known records')
    expect(html).toContain('Open recall practice')
  })
  it('labels assisted recall honestly instead of declaring mastery',()=>{
    const html=renderToStaticMarkup(<EvidenceSummary evidence={{kind:'recall-recorded',reviewCount:2,latest:{activity:'recall',matched:4,unaided:1,total:4}}} />)
    expect(html).toContain('2 saved recall attempts')
    expect(html).toContain('includes attempts with support')
    expect(html).toContain('1/4')
    expect(html).not.toContain('mastered')
  })
})
