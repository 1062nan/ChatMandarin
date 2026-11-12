import { describe,it,expect,vi } from 'vitest'
import { collectCorrectionSchedule } from './review-summary'
const now=new Date('2026-11-13T03:00:00Z')
const due={correct:'private correct text',explanation:'private explanation',next_review_at:'2026-11-12T00:00:00Z'}
const upcoming={...due,next_review_at:'2026-11-14T00:00:00Z'}
const hint={...due,correct:'（更简单的表达）'}
const page=(rows:typeof due[])=>async()=>({data:rows,error:null})
describe('read-only correction schedule summary',()=>{
  it('returns only count/dates, never correction/answer content',async()=>{
    const result=await collectCorrectionSchedule(page([due]),page([upcoming]),now)
    expect(result).toEqual({status:'known',dueCount:1,hasMoreDue:false,earliestDueAt:'2026-11-12T00:00:00.000Z',nextReviewAt:'2026-11-14T00:00:00.000Z',incomplete:false})
    expect(JSON.stringify(result)).not.toContain('private')
  })
  it('reads past quarantined cards with bounded pages',async()=>{
    const fetch=vi.fn().mockResolvedValueOnce({data:Array(100).fill(hint),error:null}).mockResolvedValueOnce({data:[due],error:null})
    expect(await collectCorrectionSchedule(fetch,page([]),now)).toMatchObject({status:'known',dueCount:1,incomplete:false})
    expect(fetch).toHaveBeenLastCalledWith(100,199)
  })
  it('marks incomplete scans unknown rather than falsely empty',async()=>{
    const fetch=vi.fn().mockResolvedValue({data:Array(100).fill(hint),error:null})
    expect(await collectCorrectionSchedule(fetch,page([]),now)).toMatchObject({status:'known',dueCount:0,incomplete:true})
    expect(fetch).toHaveBeenCalledTimes(10)
  })
  it('detects incomplete upcoming-only scans without suggesting new work',async()=>{
    const futureHint={...hint,next_review_at:'2026-11-14T00:00:00Z'}
    const fetch=vi.fn().mockResolvedValue({data:Array(100).fill(futureHint),error:null})
    expect(await collectCorrectionSchedule(page([]),fetch,now)).toMatchObject({status:'known',dueCount:0,incomplete:true})
    expect(fetch).toHaveBeenCalledTimes(10)
  })
  it('flags valid legacy cards with no schedule, without mutating them',async()=>{
    const fetch=vi.fn().mockResolvedValue({data:[{...due,next_review_at:null}],error:null})
    expect(await collectCorrectionSchedule(page([]),page([]),now,fetch)).toMatchObject({status:'known',dueCount:0,incomplete:true})
    expect(fetch).toHaveBeenCalledTimes(1)
  })
  it('does not let unscheduled quarantined hints create a false review task',async()=>{
    expect(await collectCorrectionSchedule(page([]),page([]),now,async()=>({data:[{...hint,next_review_at:null}],error:null}))).toMatchObject({status:'known',dueCount:0,incomplete:false})
  })
  it('counts a bounded batch as lower bound, not exact total',async()=>{
    expect(await collectCorrectionSchedule(page(Array(60).fill(due)),page([]),now)).toMatchObject({status:'known',dueCount:10,hasMoreDue:true})
  })
  it('fails honest if either source cannot be read',async()=>{
    const fail=async()=>({data:null,error:'no connection'})
    expect(await collectCorrectionSchedule(fail,page([]),now)).toEqual({status:'unavailable'})
    expect(await collectCorrectionSchedule(page([due]),fail,now)).toEqual({status:'unavailable'})
  })
  it.each(['invalid','2026-11-14T00:00:00Z'])('rejects invalid/future dates from due query: %s',async next_review_at=>{
    expect(await collectCorrectionSchedule(page([{...due,next_review_at}]),page([]),now)).toEqual({status:'unavailable'})
  })
  it('rejects due dates from upcoming query and accepts the exact due deadline',async()=>{
    expect(await collectCorrectionSchedule(page([]),page([due]),now)).toEqual({status:'unavailable'})
    expect(await collectCorrectionSchedule(page([{...due,next_review_at:now.toISOString()}]),page([]),now)).toMatchObject({status:'known',dueCount:1})
  })
})
