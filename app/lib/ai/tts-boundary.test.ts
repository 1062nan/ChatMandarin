import {it,expect,vi} from 'vitest'
const m=vi.hoisted(()=>({call:vi.fn()}))
vi.mock('./voice-gateway-client',()=>({usesVoiceGateway:()=>true,callVoiceGateway:m.call}))
import {synthesizeSpeech} from './volcengine-tts'
it('preserves internal truncation before signed gateway boundary',async()=>{m.call.mockResolvedValue({audioBase64:'YQ==',duration:1});await synthesizeSpeech('好'.repeat(1500));const body=JSON.parse(new TextDecoder().decode(m.call.mock.calls[0][1]));expect(body.text).toHaveLength(1000)})
