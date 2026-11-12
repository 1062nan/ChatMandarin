import {beforeEach,afterEach,describe,it,expect,vi} from 'vitest'
import {NextRequest} from 'next/server'
const m=vi.hoisted(()=>({server:vi.fn(),admin:vi.fn()}))
vi.mock('@/lib/supabase/server',()=>({createSupabaseServerClient:m.server,createSupabaseAdmin:m.admin}))
import {GET,POST} from './route'
import {LEARN_TASKS,REVIEW_TASKS,gradeLesson} from '@/lib/lessons/restaurant'
const submissionId='55555555-5555-4555-8555-555555555555'
const clock='2026-11-11T10:00:00.000Z'
const prior={user_id:'profile',lesson_id:'restaurant-order-v1',review_count:4,recall_streak:0,next_review_at:'2026-11-10T10:00:00.000Z',updated_at:'2026-11-10T09:00:00.000Z'}
const answers=(review=false)=>(review?REVIEW_TASKS:LEARN_TASKS).map(t=>({id:t.id,value:t.options?String(t.correctOption):t.example,hintUsed:false,firstTry:true}))
const req=(body:unknown)=>new NextRequest('http://localhost/api/lessons/restaurant',{method:'POST',body:JSON.stringify(body)})
function query(){const q:any={};for(const key of ['select','eq','update','insert'])q[key]=vi.fn(()=>q);q.single=vi.fn().mockResolvedValue({data:{id:'profile'}});q.maybeSingle=vi.fn();return q}
let owner:any,write:any
beforeEach(()=>{vi.resetAllMocks();vi.useFakeTimers();vi.setSystemTime(new Date(clock));owner=query();owner.maybeSingle.mockResolvedValue({data:null});m.server.mockResolvedValue({auth:{getUser:async()=>({data:{user:{id:'auth'}}})},from:()=>owner});write=query();write.maybeSingle.mockResolvedValueOnce({data:null}).mockResolvedValueOnce({data:{...prior,next_review_at:'2026-11-12T10:00:00.000Z'}});m.admin.mockReturnValue({from:()=>write})})
afterEach(()=>vi.useRealTimers())
describe('restaurant lesson API',()=>{
 it('requires authentication for read and write',async()=>{m.server.mockResolvedValue({auth:{getUser:async()=>({data:{user:null}})}});expect((await GET()).status).toBe(401);expect((await POST(req({mode:'learn',answers:answers()}))).status).toBe(401);expect(m.admin).not.toHaveBeenCalled()})
 it('reads only authenticated profile and uses server due time/no-store',async()=>{owner.maybeSingle.mockResolvedValue({data:prior});const response=await GET();expect(response.headers.get('cache-control')).toBe('no-store');expect(await response.json()).toMatchObject({due:true,server_now:clock});expect(owner.eq).toHaveBeenCalledWith('user_id','profile')})
 it('validates every task before admin writes',async()=>{expect((await POST(req({mode:'learn',answers:[]}))).status).toBe(400);expect(m.admin).not.toHaveBeenCalled()})
 it('initial save stores outcomes not raw answers and ignores body user id',async()=>{const response=await POST(req({user_id:'other',mode:'learn',answers:answers()}));expect(response.status).toBe(200);const row=write.insert.mock.calls[0][0];expect(row.user_id).toBe('profile');expect(row.next_review_at).toBe('2026-11-12T10:00:00.000Z');expect(JSON.stringify(row)).not.toContain('value');expect(row.recall_streak).toBe(0)})
 it('repeating learn cannot postpone an existing review',async()=>{write.maybeSingle.mockReset().mockResolvedValue({data:prior});const response=await POST(req({mode:'learn',answers:answers()}));expect(response.status).toBe(200);expect(await response.json()).toMatchObject({due:true,server_now:clock});expect(write.update).not.toHaveBeenCalled();expect(write.insert).not.toHaveBeenCalled()})
 it.each([{...prior,next_review_at:'2027-01-01T00:00:00Z'},null,prior])('rejects premature, absent or stale-version review',async row=>{write.maybeSingle.mockReset().mockResolvedValue({data:row});expect((await POST(req({mode:'review',answers:answers(true),expected_updated_at:'stale'}))).status).toBe(409);expect(write.update).not.toHaveBeenCalled()})
 it('due review uses compare-and-swap and streak not historical count',async()=>{write.maybeSingle.mockReset().mockResolvedValueOnce({data:prior}).mockResolvedValueOnce({data:prior});expect((await POST(req({mode:'review',answers:answers(true),expected_updated_at:prior.updated_at}))).status).toBe(200);expect(write.eq).toHaveBeenCalledWith('updated_at',prior.updated_at);expect(write.update.mock.calls[0][0]).toMatchObject({recall_streak:1,review_count:5,next_review_at:'2026-11-14T10:00:00.000Z'})})
 it('supported recall resets streak',async()=>{write.maybeSingle.mockReset().mockResolvedValueOnce({data:{...prior,recall_streak:3}}).mockResolvedValueOnce({data:prior});const a=answers(true);a[0].hintUsed=true;await POST(req({mode:'review',answers:a,expected_updated_at:prior.updated_at}));expect(write.update.mock.calls[0][0]).toMatchObject({recall_streak:0,next_review_at:'2026-11-12T10:00:00.000Z'})})
 it('rejects race loser without duplicate progress',async()=>{write.maybeSingle.mockReset().mockResolvedValueOnce({data:prior}).mockResolvedValueOnce({data:null}).mockResolvedValueOnce({data:prior});expect((await POST(req({mode:'review',answers:answers(true),expected_updated_at:prior.updated_at}))).status).toBe(409)})
 it('persists a compact receipt without raw answer text',async()=>{
   await POST(req({mode:'learn',answers:answers(),submission_id:submissionId}))
   const row=write.insert.mock.calls[0][0]
   expect(row.last_summary).toMatchObject({submission_id:submissionId,mode:'learn',matched:8})
   expect(JSON.stringify(row)).not.toContain('我想要')
 })
 it('replays a review after response loss without postponing or incrementing',async()=>{
   const summary=gradeLesson('review',answers(true))
   const saved={...prior,review_count:5,next_review_at:'2026-11-14T10:00:00Z',last_summary:{...summary,submission_id:submissionId,mode:'review'}}
   write.maybeSingle.mockReset().mockResolvedValue({data:saved})
   const response=await POST(req({mode:'review',answers:answers(true),submission_id:submissionId,expected_updated_at:'stale'}))
   expect(response.status).toBe(200);expect(await response.json()).toMatchObject({already_saved:true,summary,progress:saved,due:false})
   expect(write.update).not.toHaveBeenCalled()
 })
 it('replays JSONB receipts regardless of object key order',async()=>{
   const summary=gradeLesson('review',answers(true))
   const last_summary={mode:'review',submission_id:submissionId,total:summary.total,unaided:summary.unaided,matched:summary.matched,outcomes:summary.outcomes.map(o=>({unaided:o.unaided,matched:o.matched,id:o.id}))}
   write.maybeSingle.mockReset().mockResolvedValue({data:{...prior,last_summary}})
   expect((await POST(req({mode:'review',answers:answers(true),submission_id:submissionId}))).status).toBe(200)
   expect(write.update).not.toHaveBeenCalled()
 })
 it('replays an initial insert that lost a concurrent uniqueness race',async()=>{
   const saved={...prior,last_summary:{...gradeLesson('learn',answers()),submission_id:submissionId,mode:'learn'}}
   write.maybeSingle.mockReset().mockResolvedValueOnce({data:null}).mockResolvedValueOnce({error:{code:'23505'}}).mockResolvedValueOnce({data:saved})
   expect((await POST(req({mode:'learn',answers:answers(),submission_id:submissionId}))).status).toBe(200)
   expect(write.insert).toHaveBeenCalledTimes(1)
 })
 it('keeps a failed write retryable with the same receipt',async()=>{
   write.maybeSingle.mockReset().mockResolvedValueOnce({data:prior}).mockResolvedValueOnce({error:{code:'unavailable'}}).mockResolvedValueOnce({data:prior}).mockResolvedValueOnce({data:prior})
   const body={mode:'review',answers:answers(true),submission_id:submissionId,expected_updated_at:prior.updated_at}
   expect((await POST(req(body))).status).toBe(503)
   expect((await POST(req(body))).status).toBe(200)
 })
 it('rejects reusing a receipt with changed outcome',async()=>{
   const saved={...prior,last_summary:{...gradeLesson('review',answers(true)),submission_id:submissionId,mode:'review'}}
   write.maybeSingle.mockReset().mockResolvedValue({data:saved})
   const a=answers(true);a[0].hintUsed=true
   expect((await POST(req({mode:'review',answers:a,submission_id:submissionId}))).status).toBe(409)
   expect(write.update).not.toHaveBeenCalled()
 })
 it('does not replay another attempt or bypass due validation',async()=>{
   write.maybeSingle.mockReset().mockResolvedValue({data:{...prior,next_review_at:'2027-01-01',last_summary:{submission_id:submissionId}}})
   expect((await POST(req({mode:'review',answers:answers(true),submission_id:'66666666-6666-4666-8666-666666666666',expected_updated_at:prior.updated_at}))).status).toBe(409)
   expect(write.update).not.toHaveBeenCalled()
 })
 it('replays a concurrent identical race winner',async()=>{
   const saved={...prior,last_summary:{...gradeLesson('review',answers(true)),submission_id:submissionId,mode:'review'}}
   write.maybeSingle.mockReset().mockResolvedValueOnce({data:prior}).mockResolvedValueOnce({data:null}).mockResolvedValueOnce({data:saved})
   const response=await POST(req({mode:'review',answers:answers(true),submission_id:submissionId,expected_updated_at:prior.updated_at}))
   expect(response.status).toBe(200);expect(await response.json()).toMatchObject({already_saved:true})
   expect(write.update).toHaveBeenCalledTimes(1)
 })
 it('rejects malformed attempt ids before persistence',async()=>{
   expect((await POST(req({mode:'learn',answers:answers(),submission_id:'bad'}))).status).toBe(400)
   expect(m.admin).not.toHaveBeenCalled()
 })
 it('returns recoverable error for unavailable persistence',async()=>{write.maybeSingle.mockReset().mockResolvedValue({error:{message:'db down'}});expect((await POST(req({mode:'learn',answers:answers()}))).status).toBe(503)})
})
