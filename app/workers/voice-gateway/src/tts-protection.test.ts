import {it,expect,vi,afterEach} from 'vitest'
import gateway from './index'
import {createHash,createHmac} from 'node:crypto'
const env={VOICE_GATEWAY_SECRET:'fixture-only',VOLCENGINE_API_KEY:'fixture-only',VOLCENGINE_APP_ID:'fixture-only'} as any
function request(body:string,signed=true){const timestamp=String(Math.floor(Date.now()/1000));const nonce='fixture';const hash=createHash('sha256').update(body).digest('hex');return new Request('https://gateway.example/v1/tts',{method:'POST',headers:signed?{'x-voice-timestamp':timestamp,'x-voice-nonce':nonce,'x-voice-signature':createHmac('sha256',env.VOICE_GATEWAY_SECRET).update(`${timestamp}.${nonce}.POST./v1/tts.${hash}`).digest('hex')}:{},body})}
afterEach(()=>vi.unstubAllGlobals())
it('rejects unsigned requests, no provider bypass',async()=>{const fetch=vi.fn();vi.stubGlobal('fetch',fetch);expect((await gateway.fetch(request('{"text":"你好"}',false) as any,env)).status).toBe(401);expect(fetch).not.toHaveBeenCalled()})
it('bounds chunked TTS body before upstream',async()=>{const fetch=vi.fn();vi.stubGlobal('fetch',fetch);expect((await gateway.fetch(request('x'.repeat(16385)) as any,env)).status).toBe(413);expect(fetch).not.toHaveBeenCalled()})
it.each(['{bad',JSON.stringify({text:'x'.repeat(1001)}),JSON.stringify({text:' '})])('rejects signed invalid content',async body=>{const fetch=vi.fn();vi.stubGlobal('fetch',fetch);expect((await gateway.fetch(request(body) as any,env)).status).toBe(400);expect(fetch).not.toHaveBeenCalled()})
it('retains signed valid internal synthesis',async()=>{const fetch=vi.fn().mockResolvedValue(new Response(JSON.stringify({code:3000,data:'YQ==',duration:'1'}),{status:200}));vi.stubGlobal('fetch',fetch);expect((await gateway.fetch(request(JSON.stringify({text:'你好'})) as any,env)).status).toBe(200);expect(fetch).toHaveBeenCalledTimes(1)})
