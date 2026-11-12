import React from 'react'
import { LEARN_TASKS } from '@/lib/lessons/restaurant'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
const { client } = vi.hoisted(() => ({ client: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createSupabaseServerClient: client }))
vi.mock('@/lib/db/learning-path', () => ({ getLearningPath: async () => ({ units: [], progress: new Map(), recommendation: null }) }))
vi.mock('./journey-view', () => ({ JourneyView: () => null }))
import DashboardPage from './page'
import { GuidedLearningPath } from '@/components/lessons/guided-learning-path'
function query(data: unknown, error: unknown = null) {
  const q: any = { then: (resolve: (v: unknown) => unknown) => Promise.resolve({ data:typeof data==='function'?data(q):data, error }).then(resolve) }
  for (const method of ['select', 'in', 'eq', 'gt', 'lte', 'order', 'limit', 'single', 'maybeSingle','range','is']) q[method] = vi.fn(() => q)
  q.lte=vi.fn(()=>{q.phase='due';return q})
  q.gt=vi.fn(()=>{q.phase='future';return q})
  return q
}
function setup(progress: unknown = null, error: unknown = null, mistakes:unknown=[], mistakeError:unknown=null) {
  const lesson = query(progress, error)
  const review=query(mistakes,mistakeError)
  const from = vi.fn((table: string) => table === 'profiles' ? query({ id: 'owner', display_name: 'Learner' }) : table === 'lesson_progress' ? lesson : table==='mistakes'?review:query([]))
  client.mockResolvedValue({ auth: { getUser: async () => ({ data: { user: { id: 'auth' } } }) }, from })
  return { lesson, from, review }
}
function findCard(element: any): any {
  if (!element) return null
  if (element.type === GuidedLearningPath) return element
  for (const child of React.Children.toArray(element.props?.children)) { const found = findCard(child); if (found) return found }
  return null
}
beforeEach(() => { vi.resetAllMocks(); vi.stubGlobal('React', React); vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-13T03:09:03Z')) })
afterEach(() => vi.useRealTimers())
describe('authenticated dashboard learning plan', () => {
  it('reads only the owner and lesson schedule, without answers or privileged writes', async () => {
    const { lesson } = setup([{lesson_id:'restaurant-order-v1', next_review_at: '2026-11-13T03:09:03Z' }])
    const card = findCard(await DashboardPage())
    expect(lesson.select).toHaveBeenCalledWith('lesson_id,next_review_at,review_count,last_summary')
    expect(lesson.eq).toHaveBeenCalledWith('user_id', 'owner')
    expect(lesson.in).toHaveBeenCalledWith('lesson_id', ['restaurant-order-v1','meeting-time-v1'])
    expect(card.props.cards[0].plan.status).toBe('due')
  })
  it('passes only reduced public evidence to the client, not the stored receipt or task payload', async () => {
    setup([{lesson_id:'restaurant-order-v1',next_review_at:'2026-11-14T03:09:03Z',review_count:0,last_summary:{mode:'learn',matched:8,unaided:6,total:8,submission_id:'receipt-private',outcomes:Array.from({length:8},(_,i)=>({id:LEARN_TASKS[i].id,matched:true,unaided:i<6})),answers:'never serialize stored extras'}}])
    const cards=findCard(await DashboardPage()).props.cards
    const serialized=JSON.stringify(cards)
    expect(serialized).not.toContain('receipt-private')
    expect(serialized).not.toContain('private-task')
    expect(serialized).not.toContain('never serialize')
    expect(cards.find((card:any)=>card.id==='restaurant-order-v1').evidence.latest).toEqual({activity:'practice',matched:8,unaided:6,total:8})
  })
  it('preserves unavailable state rather than falsely offering a first lesson', async () => {
    setup(null, { message: 'unavailable' })
    expect(findCard(await DashboardPage()).props.cards[0].plan.status).toBe('unavailable')
  })
  it('bounds both correction reads and scopes each to the authenticated owner',async()=>{
    let reads=0
    const {review}=setup([],null,()=>reads++===0?[{correct:'private correction',explanation:'private explanation',next_review_at:'2026-11-12T00:00:00Z'}]:[])
    const card=findCard(await DashboardPage())
    expect(review.select).toHaveBeenCalledWith('correct,explanation,next_review_at')
    expect(review.eq).toHaveBeenCalledWith('user_id','owner')
    expect(review.range).toHaveBeenCalledWith(0,99)
    expect(review.is).toHaveBeenCalledWith('next_review_at',null)
    expect(review.eq).not.toHaveBeenCalledWith('mastered',false)
    expect(review.lte).toHaveBeenCalledWith('next_review_at','2026-11-13T03:09:03.000Z')
    expect(review.gt).toHaveBeenCalledWith('next_review_at','2026-11-13T03:09:03.000Z')
    expect(card.props.dailySession.action).toMatchObject({kind:'corrections',intent:'recall',count:1})
    expect(JSON.stringify(card.props)).not.toContain('private correction')
    expect(JSON.stringify(card.props)).not.toContain('private explanation')
  })
  it('does not recommend new content when correction reads fail',async()=>{
    setup([],null,null,{message:'unavailable'})
    expect(findCard(await DashboardPage()).props.dailySession).toMatchObject({unknown:true,action:{kind:'check'}})
  })
  it('has no progress reads without an authenticated user', async () => {
    const { from } = setup()
    client.mockResolvedValue({ auth: { getUser: async () => ({ data: { user: null } }) }, from })
    expect(await DashboardPage()).toBeNull()
    expect(from).not.toHaveBeenCalled()
  })
})
