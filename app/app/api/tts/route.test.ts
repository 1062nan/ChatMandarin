import {beforeEach,describe,it,expect,vi} from 'vitest'
import {NextRequest} from 'next/server'
const m=vi.hoisted(()=>({server:vi.fn(),admin:vi.fn(),speak:vi.fn(),rpc:vi.fn()}))
vi.mock('@/lib/supabase/server',()=>({createSupabaseServerClient:m.server,createSupabaseAdmin:m.admin}))
vi.mock('@/lib/ai/volcengine-tts',()=>({synthesizeSpeech:m.speak,VOICE_TYPES:{BV700_streaming:'default'}}))
import {POST} from './route'
let plan:unknown=null
let lookupError=false
const req=(body:unknown)=>new NextRequest('http://localhost/api/tts',{method:'POST',body:JSON.stringify(body)})
beforeEach(()=>{vi.resetAllMocks();plan=null;lookupError=false;m.server.mockResolvedValue({auth:{getUser:async()=>({data:{user:{id:'auth'}}})},from:(table:string)=>{const q:any={select:()=>q,eq:()=>q,single:async()=>({data:{id:'owner'}}),maybeSingle:async()=>({data:plan,error:lookupError?{message:"down"}:null})};return q}});m.admin.mockReturnValue({rpc:m.rpc});m.rpc.mockResolvedValue({data:[{allowed:true}]});m.speak.mockResolvedValue({audioBase64:'audio',duration:1})})
describe('standalone TTS protection',()=>{
 it('denies unauthenticated before body/provider',async()=>{m.server.mockResolvedValue({auth:{getUser:async()=>({data:{user:null}})}});expect((await POST(req({text:'你好'}))).status).toBe(401);expect(m.rpc).not.toHaveBeenCalled();expect(m.speak).not.toHaveBeenCalled()})
 it.each([{text:''},{text:'  '},{text:'x'.repeat(501)},{text:'你好',voice_type:'toString'},{text:'你好',voice_type:{}},null])('rejects invalid text/voice',async body=>{expect((await POST(req(body))).status).toBe(400);expect(m.speak).not.toHaveBeenCalled()})
 it('bounds body without content length',async()=>{expect((await POST(req({text:'好',extra:'x'.repeat(9000)}))).status).toBe(413);expect(m.rpc).not.toHaveBeenCalled()})
 it('reserves only authenticated identity before provider',async()=>{expect((await POST(req({text:'你好',user_id:'other'}))).status).toBe(200);expect(m.rpc).toHaveBeenCalledWith('reserve_free_tts',{p_profile_id:'owner',p_characters:2});expect(m.rpc.mock.invocationCallOrder[0]).toBeLessThan(m.speak.mock.invocationCallOrder[0])})
 it('returns transparent limit and retry header without provider',async()=>{m.rpc.mockResolvedValue({data:[{allowed:false,reason:'daily_limit',retry_after:60}]});const r=await POST(req({text:'你好'}));expect(r.status).toBe(429);expect(r.headers.get('retry-after')).toBe('60');expect(m.speak).not.toHaveBeenCalled()})
 it('fails closed on quota outage',async()=>{m.rpc.mockResolvedValue({error:{message:'down'}});expect((await POST(req({text:'你好'}))).status).toBe(503);expect(m.speak).not.toHaveBeenCalled()})
 it.each(['plus','pro'])('preserves paid %s with no new daily quota',async p=>{plan={plan:p,status:'active'};expect((await POST(req({text:'你好'}))).status).toBe(200);expect(m.rpc).not.toHaveBeenCalled()})
 it('keeps unexpired cancellation access',async()=>{plan={plan:'plus',status:'canceled',current_period_end:'2099-01-01'};expect((await POST(req({text:'你好'}))).status).toBe(200);expect(m.rpc).not.toHaveBeenCalled()})
 it('provider failure is bounded and not refunded',async()=>{m.speak.mockRejectedValue(new Error('secret'));const r=await POST(req({text:'你好'}));expect(r.status).toBe(502);expect(JSON.stringify(await r.json())).not.toContain('secret');expect(m.rpc).toHaveBeenCalledTimes(1)})
})

it('expired paid access gets Free protection',async()=>{plan={plan:'plus',status:'canceled',current_period_end:'2000-01-01'};expect((await POST(req({text:'你好'}))).status).toBe(200);expect(m.rpc).toHaveBeenCalledTimes(1)})
it('subscription lookup outage never consumes quota or calls provider',async()=>{lookupError=true;expect((await POST(req({text:'你好'}))).status).toBe(503);expect(m.rpc).not.toHaveBeenCalled();expect(m.speak).not.toHaveBeenCalled()})
it('malformed UTF8 returns400 before quota',async()=>{const r=new NextRequest('http://localhost/api/tts',{method:'POST',body:new Uint8Array([255])});expect((await POST(r)).status).toBe(400);expect(m.rpc).not.toHaveBeenCalled()})
it('profile lookup outage never consumes quota',async()=>{m.server.mockResolvedValue({auth:{getUser:async()=>({data:{user:{id:'auth'}}})},from:()=>{const q:any={select:()=>q,eq:()=>q,single:async()=>({error:{message:'down'}})};return q}});expect((await POST(req({text:'你好'}))).status).toBe(503);expect(m.rpc).not.toHaveBeenCalled()})
