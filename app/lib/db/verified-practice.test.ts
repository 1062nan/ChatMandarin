import { beforeEach, describe, expect, it, vi } from 'vitest'
const { rpc, server } = vi.hoisted(() => ({ rpc: vi.fn(), server: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createSupabaseAdmin: () => ({ rpc }), createSupabaseServerClient: server }))
import { audioPracticeId, ensureOwnedLearningProgress, saveVerifiedAudioPractice } from './verified-practice'
const input = { profileId: 'profile', kind: 'shadowing' as const, contentId: 's1', audio: new Uint8Array([1,2,3]).buffer, score: 100, transcript: '你好' }
beforeEach(() => vi.resetAllMocks())
describe('verified practice boundary', () => {
  it('deduplicates exact audio retries but separates people, content and modes', () => {
    const id = audioPracticeId(input.profileId,input.kind,input.contentId,input.audio)
    expect(id).toMatch(/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/)
    expect(audioPracticeId(input.profileId,input.kind,input.contentId,input.audio.slice(0))).toBe(id)
    expect(audioPracticeId('other',input.kind,input.contentId,input.audio)).not.toBe(id)
    expect(audioPracticeId(input.profileId,'dubbing',input.contentId,input.audio)).not.toBe(id)
    expect(audioPracticeId(input.profileId,input.kind,'s2',input.audio)).not.toBe(id)
    expect(audioPracticeId(input.profileId,input.kind,input.contentId,new Uint8Array([4]).buffer)).not.toBe(id)
  })
  it('uses an atomic service RPC with canonical content and no client unit', async () => {
    rpc.mockResolvedValue({ data: { source_id: 'saved', credited: true, duplicate: false }, error: null })
    expect((await saveVerifiedAudioPractice(input)).credited).toBe(true)
    expect(rpc).toHaveBeenCalledWith('save_verified_audio_practice',expect.objectContaining({ p_profile_id:'profile',p_kind:'shadowing',p_content_id:'s1',p_score:100,p_transcript:'你好',p_errors:[] }))
    expect(rpc.mock.calls[0][1]).not.toHaveProperty('p_unit_id')
  })
  it.each([NaN,-1,101,1.2])('rejects invalid score %s before RPC',async score => {
    await expect(saveVerifiedAudioPractice({...input,score})).rejects.toThrow('Invalid assessment')
    expect(rpc).not.toHaveBeenCalled()
  })
  it('rejects silence and preserves save failure',async () => {
    await expect(saveVerifiedAudioPractice({...input,transcript:' '})).rejects.toThrow('Invalid assessment')
    rpc.mockResolvedValue({ error: new Error('DB unavailable') })
    await expect(saveVerifiedAudioPractice(input)).rejects.toThrow('DB unavailable')
  })
  it('never initializes another profile through admin',async () => {
    const q:any={eq:()=>q,select:()=>q,maybeSingle:async()=>({data:null,error:null})}
    server.mockResolvedValue({auth:{getUser:async()=>({data:{user:{id:'auth'}}})},from:()=>q})
    await expect(ensureOwnedLearningProgress('other')).rejects.toThrow('Profile not owned')
    expect(rpc).not.toHaveBeenCalled()
  })
})
