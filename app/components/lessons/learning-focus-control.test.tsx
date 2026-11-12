import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach,describe,it,expect,vi } from 'vitest'
vi.mock('next/navigation',()=>({useRouter:()=>({refresh:vi.fn()})}))
import { LearningFocusControl } from './learning-focus-control'
import { DailySessionAction } from './daily-session-action'
beforeEach(()=>vi.stubGlobal('React',React))
describe('honest optional focus UI',()=>{
  it('is collapsed and skippable by default, not a blocking placement test',()=>{
    const html=renderToStaticMarkup(<LearningFocusControl preference={{status:'known',focus:null}} />)
    expect(html).toContain('Default: Everyday guided lessons')
    expect(html).toContain('optional')
    expect(html).toContain('not a level assessment or a language setting')
    expect(html).not.toContain('Save focus')
  })
  it('does not claim a missing preference read erased a saved choice',()=>{
    expect(renderToStaticMarkup(<LearningFocusControl preference={{status:'unavailable',focus:null}} />)).toContain('could not be checked')
  })
  it('does not auto-start media or present paid access as required',()=>{
    const html=renderToStaticMarkup(<DailySessionAction cards={[]} refreshing={false} onRefresh={vi.fn()} plan={{action:{kind:'speaking',availability:{status:'available',dailyRemaining:1,monthlyRemaining:null,checkedAt:'2026-11-12T10:00:00Z'}},unknown:false,checkedAt:'2026-11-12T10:00:00Z',nextRefreshAt:null}} />)
    expect(html).toContain('href="/hskk"')
    expect(html).toContain('1 daily')
    expect(html).toContain('not a reservation')
    expect(html).toContain('not live conversation')
    expect(html).toContain('separate usage limits')
    expect(html).toContain('Completing the final recording or upload submits the exercise')
    expect(html).toContain('audio loads automatically')
    expect(html).not.toContain('only your deliberate submission')
    expect(html).not.toContain('<audio')
    expect(html).not.toContain('Upgrade')
  })
})
