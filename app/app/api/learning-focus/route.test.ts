import { beforeEach,describe,it,expect,vi } from 'vitest'
import { NextRequest } from 'next/server'
const m=vi.hoisted(()=>({server:vi.fn()}))
vi.mock('@/lib/supabase/server',()=>({createSupabaseServerClient:m.server}))
import { POST } from './route'
const req=(body:unknown)=>new NextRequest('https://example.test/api/learning-focus',{method:'POST',body:JSON.stringify(body)})
let db:any,profile:any,preference:any
function query(data:unknown){const q:any={};for(const method of ['select','eq','upsert'])q[method]=vi.fn(()=>q);q.single=vi.fn().mockResolvedValue({data,error:null});return q}
beforeEach(()=>{vi.resetAllMocks();profile=query({id:'owner'});preference=query({focus:'speaking',updated_at:'now'});db={auth:{getUser:async()=>({data:{user:{id:'auth'}},error:null})},from:vi.fn((table:string)=>table==='profiles'?profile:preference)};m.server.mockResolvedValue(db)})
describe('authenticated learning-focus save',()=>{
  it('rejects anonymous writes without any database calls',async()=>{
    db.auth.getUser=async()=>({data:{user:null}})
    expect((await POST(req({focus:'guided'}))).status).toBe(401)
    expect(db.from).not.toHaveBeenCalled()
  })
  it.each([{},null,{focus:'HSK6'},{focus:4}])('validates only the supported choice before writes: %j',async body=>{
    expect((await POST(req(body))).status).toBe(400);expect(preference.upsert).not.toHaveBeenCalled()
  })
  it('pins owner from authenticated profile and ignores foreign ownership/level values',async()=>{
    const result=await POST(req({focus:'speaking',user_id:'other',hsk_level:6,plan:'pro'}))
    expect(result.status).toBe(200)
    expect(result.headers.get('cache-control')).toBe('private, no-store')
    expect(profile.eq).toHaveBeenCalledWith('auth_id','auth')
    expect(preference.upsert.mock.calls[0][0]).toMatchObject({user_id:'owner',focus:'speaking'})
    expect(Object.keys(preference.upsert.mock.calls[0][0]).sort()).toEqual(['focus','updated_at','user_id'])
    expect(db.from.mock.calls.map((call:any[])=>call[0])).toEqual(['profiles','learning_preferences'])
  })
  it('uses idempotent owner upsert, not increments or practice writes',async()=>{
    await POST(req({focus:'speaking'}));await POST(req({focus:'speaking'}))
    expect(preference.upsert).toHaveBeenCalledTimes(2)
    expect(preference.upsert.mock.calls.every((call:any[])=>call[1].onConflict==='user_id')).toBe(true)
  })
  it('returns honest uncertainty on save failure and permits retry',async()=>{
    preference.single.mockResolvedValueOnce({error:'lost'}).mockResolvedValueOnce({data:{focus:'speaking'}})
    expect((await POST(req({focus:'speaking'}))).status).toBe(503)
    expect((await POST(req({focus:'speaking'}))).status).toBe(200)
  })
})
