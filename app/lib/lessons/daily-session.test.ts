import { describe,it,expect } from 'vitest'
import { guidedPathway } from './pathway'
import { planDailySession,dailySessionRefreshPlan,type CorrectionSchedule } from './daily-session'
const now=new Date('2026-11-13T03:00:00Z')
const empty:CorrectionSchedule={status:'known',dueCount:0,hasMoreDue:false,earliestDueAt:null,nextReviewAt:null,incomplete:false}
const correction=(at:string):CorrectionSchedule=>({...empty,dueCount:3,earliestDueAt:at})
const row=(id:string,date:string)=>({lesson_id:id,next_review_at:date,review_count:0,last_summary:null})
const cards=(date?:string)=>guidedPathway(date?[row('restaurant-order-v1',date)]:[],false,now)
describe('unified daily next-action policy',()=>{
  it('chooses earliest due item across correction and lesson queues',()=>{
    expect(planDailySession(cards('2026-11-12T12:00:00Z'),correction('2026-11-12T00:00:00Z'),now).action.kind).toBe('corrections')
    expect(planDailySession(cards('2026-11-11T00:00:00Z'),correction('2026-11-12T00:00:00Z'),now).action).toMatchObject({kind:'lesson',intent:'recall'})
  })
  it('keeps correction batch first at equal normalized deadlines',()=>{
    expect(planDailySession(cards('2026-11-12T08:00:00+08:00'),correction('2026-11-12T00:00:00Z'),now).action.kind).toBe('corrections')
  })
  it('never recommends new work when either source is unknown or incompletely scanned',()=>{
    for(const c of [{status:'unavailable'} as CorrectionSchedule,{...empty,incomplete:true}]) expect(planDailySession(cards(),c,now)).toMatchObject({unknown:true,action:{kind:'check'}})
    expect(planDailySession(guidedPathway(null,true,now),empty,now)).toMatchObject({unknown:true,action:{kind:'check'}})
  })
  it('can recommend known due work despite a partial error, with an explicit warning',()=>{
    expect(planDailySession(cards('2026-11-12T00:00:00Z'),{status:'unavailable'},now)).toMatchObject({unknown:true,action:{kind:'lesson',intent:'recall'}})
    expect(planDailySession(guidedPathway(null,true,now),correction('2026-11-12T00:00:00Z'),now)).toMatchObject({unknown:true,action:{kind:'corrections',intent:'recall'}})
  })
  it('recommends first new lesson only after both sources are known',()=>{
    expect(planDailySession(cards(),empty,now).action).toEqual({kind:'lesson',lessonId:'restaurant-order-v1',intent:'learn'})
  })
  it('selects the earliest upcoming source without enabling early recall',()=>{
    const lessons=guidedPathway([row('restaurant-order-v1','2026-11-15T00:00:00Z'),row('meeting-time-v1','2026-11-16T00:00:00Z')],false,now)
    const plan=planDailySession(lessons,{...empty,nextReviewAt:'2026-11-14T00:00:00Z'},now)
    expect(plan.action).toMatchObject({kind:'corrections',intent:'scheduled'})
    expect(dailySessionRefreshPlan(plan)).toMatchObject({status:'scheduled',checkedAt:now.toISOString(),nextReviewAt:'2026-11-14T00:00:00Z'})
  })
  it('watches upcoming correction deadline even while a lesson remains due',()=>{
    const plan=planDailySession(cards('2026-11-12T00:00:00Z'),{...empty,nextReviewAt:'2026-11-14T00:00:00Z'},now)
    expect(plan.action).toMatchObject({kind:'lesson',intent:'recall'})
    expect(plan.nextRefreshAt).toBe('2026-11-14T00:00:00Z')
  })
  it('refresh without a future date still retains visibility revalidation',()=>{
    expect(dailySessionRefreshPlan(planDailySession(cards(),empty,now))).toEqual({status:'new',checkedAt:now.toISOString()})
  })
})

describe('optional focus never replaces recall obligations',()=>{
  const focus={preference:{status:'known' as const,focus:'speaking' as const},speaking:{status:'available' as const,dailyRemaining:1,monthlyRemaining:null,checkedAt:now.toISOString()}}
  it('selects Free-accessible speaking only with known no-due schedules',()=>{
    expect(planDailySession(cards(),empty,now,focus).action.kind).toBe('speaking')
    expect(planDailySession(cards('2026-11-12T00:00:00Z'),empty,now,focus).action).toMatchObject({kind:'lesson',intent:'recall'})
    expect(planDailySession(cards(),correction('2026-11-12T00:00:00Z'),now,focus).action.kind).toBe('corrections')
    expect(planDailySession(cards(),{status:'unavailable'},now,focus).action.kind).toBe('check')
  })
  it('falls back honestly when speaking is exhausted or availability unknown',()=>{
    const exhausted={...focus,speaking:{status:'exhausted' as const,resetsAt:'2026-11-14T00:00:00Z',checkedAt:now.toISOString()}}
    expect(planDailySession(cards(),empty,now,exhausted)).toMatchObject({action:{kind:'lesson',intent:'learn'},speakingNotice:{status:'exhausted'}})
    expect(planDailySession(cards(),empty,now,{...focus,speaking:{status:'unavailable',checkedAt:now.toISOString()}})).toMatchObject({action:{kind:'lesson'},speakingNotice:{status:'unavailable'}})
  })
  it('preserves default behavior for existing users and failed preference reads',()=>{
    const prior=planDailySession(cards(),empty,now)
    expect(planDailySession(cards(),empty,now,{preference:{status:'known',focus:null},speaking:null})).toEqual(prior)
    expect(planDailySession(cards(),empty,now,{preference:{status:'unavailable',focus:null},speaking:null})).toEqual(prior)
  })
  it('rechecks speaking snapshots within one minute while retaining earlier recall deadlines',()=>{
    expect(planDailySession(cards(),empty,now,focus).nextRefreshAt).toBe('2026-11-13T03:01:00.000Z')
    expect(planDailySession(cards(),{...empty,nextReviewAt:'2026-11-13T03:00:10Z'},now,focus).nextRefreshAt).toBe('2026-11-13T03:00:10.000Z')
  })
})
