import { LEARN_TASKS, REVIEW_TASKS } from './restaurant'
import { LEARN_TASKS as MEETING_LEARN } from './meeting-time'
import { describe,it,expect } from 'vitest'
import { guidedPathway,practiceEvidence,pathwayCourseOrder,pathwayRefreshPlan, type LessonProgressEvidence } from './pathway'
const now=new Date('2026-11-13T03:00:00Z')
const future='2026-11-14T03:00:00Z'
function summary(total=8,unaided=6,mode?:string) {return {total,matched:total,unaided,...(mode?{mode}:{}),outcomes:Array.from({length:total},(_,i)=>({id:(total===4?REVIEW_TASKS:LEARN_TASKS)[i]?.id||`task-${i}`,matched:true,unaided:i<unaided})),submission_id:'private-receipt-not-for-client'}}
const row=(changes:Partial<LessonProgressEvidence>={}):LessonProgressEvidence=>({lesson_id:'restaurant-order-v1',next_review_at:future,review_count:0,last_summary:summary(),...changes})
const evidence=(progress:LessonProgressEvidence)=>guidedPathway([progress],false,now).find(card=>card.id===progress.lesson_id)!.evidence

describe('honest practice evidence',()=>{
  it('distinguishes saved initial practice from delayed recall, including legacy no-mode summaries',()=>{
    expect(evidence(row())).toEqual({kind:'practice-saved',reviewCount:0,latest:{activity:'practice',matched:8,unaided:6,total:8}})
    expect(evidence(row({review_count:1,last_summary:summary(4,2)}))).toEqual({kind:'recall-recorded',reviewCount:1,latest:{activity:'recall',matched:4,unaided:2,total:4}})
  })
  it('records assisted recall even when the unrelated successful-recall streak is zero',()=>{
    const progress={...row({review_count:5,last_summary:summary(4,0,'review')}),recall_streak:0}
    expect(evidence(progress)).toMatchObject({kind:'recall-recorded',reviewCount:5,latest:{unaided:0}})
  })
  it('does not relabel an inconsistent latest learn as a delayed recall',()=>{
    expect(evidence(row({review_count:2,last_summary:summary(8,8,'learn')}))).toEqual({kind:'recall-recorded',reviewCount:2})
  })
  it('does not invent earlier scores from a missing latest summary',()=>{
    expect(evidence(row({review_count:3,last_summary:null}))).toEqual({kind:'recall-recorded',reviewCount:3})
  })
  it.each([-1,1.2,'1',null,Number.NaN])('marks invalid review count %s unavailable',review_count=>{
    expect(evidence(row({review_count}))).toEqual({kind:'unavailable'})
  })
  it.each([{},[],{...summary(),unaided:9},{...summary(),matched:-1},{...summary(),total:4},{...summary(),mode:'review'},{...summary(),outcomes:[]},{...summary(),outcomes:Array(8).fill({id:'same',matched:true,unaided:true})}])('never displays malformed score evidence %j',last_summary=>{
    expect(evidence(row({last_summary}))).toEqual({kind:'practice-saved',reviewCount:0})
  })
  it('hides counts for another lesson or arbitrary task IDs',()=>{
    const wrongLesson={...summary(),outcomes:MEETING_LEARN.map((task,i)=>({id:task.id,matched:true,unaided:i<6}))}
    expect(evidence(row({last_summary:wrongLesson}))).toEqual({kind:'practice-saved',reviewCount:0})
    const unknown={...summary(),outcomes:LEARN_TASKS.map((_,i)=>({id:`unknown-${i}`,matched:true,unaided:i<6}))}
    expect(evidence(row({last_summary:unknown}))).toEqual({kind:'practice-saved',reviewCount:0})
  })
  it('reduces JSONB to counts, never passing task answers or receipt identifiers to the client',()=>{
    const cards=guidedPathway([row()],false,now)
    expect(JSON.stringify(cards)).not.toContain('private-receipt')
    expect(JSON.stringify(cards)).not.toContain('outcomes')
    expect(JSON.stringify(cards)).not.toContain('task-')
  })
  it('never calls a failed read not-started, even if it returned partial data',()=>{
    expect(guidedPathway([row()],true,now).every(card=>card.evidence.kind==='unavailable'&&card.plan.status==='unavailable')).toBe(true)
  })
})

describe('one next action and a stable course map',()=>{
  it('orders overdue work by time and keeps equal deadlines in intended course order',()=>{
    const cards=guidedPathway([row({next_review_at:'2026-11-12T03:00:00Z'}),row({lesson_id:'meeting-time-v1',next_review_at:'2026-11-12T11:00:00+08:00'})],false,now)
    expect(cards.map(card=>card.id)).toEqual(['restaurant-order-v1','meeting-time-v1'])
    expect(cards.every(card=>card.plan.status==='due')).toBe(true)
  })
  it('prioritizes recall at exact server deadline and stable map despite queue reorder',()=>{
    const cards=guidedPathway([row({lesson_id:'meeting-time-v1',next_review_at:now.toISOString()})],false,now)
    expect(cards[0]).toMatchObject({id:'meeting-time-v1',plan:{status:'due'}})
    expect(pathwayCourseOrder(cards).map(card=>card.id)).toEqual(['restaurant-order-v1','meeting-time-v1'])
  })
  it('recommends first new lesson only after known schedules show no due recall',()=>{
    expect(guidedPathway([],false,now)[0].id).toBe('restaurant-order-v1')
    expect(guidedPathway([row()],false,now)[0]).toMatchObject({id:'meeting-time-v1',plan:{status:'new'}})
  })
  it('prioritizes unknown schedules over recommending new content',()=>{
    const cards=guidedPathway([row({next_review_at:'invalid'})],false,now)
    expect(cards[0]).toMatchObject({id:'restaurant-order-v1',plan:{status:'unavailable'},evidence:{kind:'unavailable'}})
  })
  it('shows earliest upcoming date when both lessons wait, not an early recall',()=>{
    const cards=guidedPathway([row(),row({lesson_id:'meeting-time-v1',next_review_at:'2026-11-13T10:00:00Z'})],false,now)
    expect(cards[0]).toMatchObject({id:'meeting-time-v1',plan:{status:'scheduled'}})
  })
  it('watches earliest future schedule even when primary is already due',()=>{
    const cards=guidedPathway([row({next_review_at:'2026-11-12T03:00:00Z'}),row({lesson_id:'meeting-time-v1'})],false,now)
    expect(pathwayRefreshPlan(cards)).toMatchObject({status:'scheduled',nextReviewAt:new Date(future).toISOString()})
    expect(pathwayRefreshPlan([])).toBeNull()
  })
  it('uses no client time or successful-streak inference for due/evidence decisions',()=>{
    expect(practiceEvidence(null,{status:'new',checkedAt:now.toISOString()})).toEqual({kind:'not-started'})
  })
})
