import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
const mocks = vi.hoisted(() => ({ client: vi.fn(), save: vi.fn(), history: vi.fn(), asr: vi.fn(), response: vi.fn(), mistakes: vi.fn(), prompt: vi.fn(), quota: vi.fn(), release: vi.fn(), session: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createSupabaseServerClient: mocks.client }))
vi.mock('@/lib/db/conversations', () => ({ getConversationContext: async (...args: unknown[]) => { const session = await mocks.session(...args); return session ? { session, turns: await mocks.history(...args) } : null } }))
vi.mock('@/lib/db/conversation-submission', () => ({ conversationFingerprint: () => 'hash', reserveConversation: mocks.quota, finishConversation: (_lease: string, args: unknown) => mocks.save(args), failConversation: mocks.release }))
vi.mock('@/lib/ai/volcengine-asr', () => ({ recognizeSpeech: mocks.asr }))
vi.mock('@/lib/ai/volcengine-tts', () => ({ synthesizeSpeech: async () => ({ audioBase64: null }) }))
vi.mock('@/lib/ai/deepseek', () => ({ getConversationResponse: mocks.response }))
vi.mock('@/lib/ai/prompts', () => ({ buildConversationPrompt: mocks.prompt }))
vi.mock('@/lib/db/mistakes', () => ({ createMistakesFromErrors: mocks.mistakes }))
vi.mock('@/lib/audio/analyze', () => ({ analyzeAudio: () => ({ silent: false }) }))
vi.mock('@/lib/subscription/tier', () => ({ getSubscriptionContext: async () => ({ plan: 'plus' }), consumeConversationSeconds: vi.fn(() => { throw new Error('Legacy non-idempotent quota must not run') }) }))
vi.mock('@/lib/practice/request', async () => import('../../../../lib/practice/request'))
import { POST } from './route'
import { encodeWAV } from '@/lib/audio/wav-encoder'
function query(data: unknown) {
  const chain: any = {}
  for (const method of ['select', 'eq']) chain[method] = () => chain
  chain.single = chain.maybeSingle = async () => ({ data })
  return chain
}
function client(ended = false) {
  return { auth: { getUser: async () => ({ data: { user: { id: 'auth' } } }) }, from: (table: string) => query(table === 'profiles' ? { id: 'owner' } : table === 'conversations' ? { user_id: 'owner', scenario: 'real-scenario', hsk_level: 2, correction_mode: 'friendly', ended_at: ended ? 'yesterday' : null } : { name: { en: 'Real scenario' } }) }
}
function request(audio: Blob = encodeWAV(new Float32Array(16000))) {
  const form = new FormData()
  form.append('audio', audio, 'recording.wav')
  form.append('conversation_id', 'session')
  form.append('turn_index', '0')
  form.append('scenario_id', 'tampered')
  form.append('hsk_level', '6')
  return new NextRequest('http://localhost/api/conversation/turn', { method: 'POST', body: form })
}
beforeEach(() => {
  vi.clearAllMocks()
  mocks.client.mockResolvedValue(client())
  mocks.save.mockResolvedValue({ id: 'turn', user_text: '你好', ai_text: '你好', errors: [], grammar_score: null, word_choice_score: null })
  mocks.session.mockResolvedValue({ scenario_id: 'real-scenario', hsk_level: 2, correction_mode: 'friendly', completed_at: null })
  mocks.history.mockResolvedValue([])
  mocks.asr.mockResolvedValue({ text: '你好' })
  mocks.response.mockResolvedValue({ reply: '你好', errors: [], scores: { pronunciation: null, grammar: null, fluency: null, word_choice: null } })
  mocks.mistakes.mockResolvedValue(undefined)
  mocks.quota.mockResolvedValue({ state: 'reserved', lease_token: 'lease' })
  mocks.release.mockResolvedValue(true)
})
describe('conversation turn persistence contract', () => {
  it('releases failed leases so identical audio can retry through the durable reservation', async () => {
    mocks.asr.mockRejectedValue(new Error('simulated ASR failure'))
    expect((await POST(request())).status).toBe(500)
    expect((await POST(request())).status).toBe(500)
    expect(mocks.quota).toHaveBeenCalledTimes(2)
    expect(mocks.quota.mock.calls[0].slice(1)).toEqual(mocks.quota.mock.calls[1].slice(1))
    expect(mocks.release).toHaveBeenCalledTimes(2)
    expect(mocks.save).not.toHaveBeenCalled()
  })
  it('rejects disguised non-audio before charging quota or calling ASR', async () => {
    const response = await POST(request(new Blob([new Uint8Array(32044)])))
    expect(response.status).toBe(400)
    expect(mocks.quota).not.toHaveBeenCalled()
    expect(mocks.asr).not.toHaveBeenCalled()
  })
  it('preserves unavailable scores and uses server-side learning settings', async () => {
    const response = await POST(request())
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(Object.values(body.scores)).toEqual([null, null, null, null])
    expect(Object.keys(body.timing).sort()).toEqual(['asr_ms', 'auth_ms', 'context_ms', 'persistence_ms', 'profile_ms', 'quota_scenario_ms', 'reply_ms', 'server_ms', 'tts_ms'])
    for (const value of Object.values(body.timing)) expect(value).toEqual(expect.any(Number))
    expect(body.timing.server_ms).toBeGreaterThanOrEqual(body.timing.asr_ms)
    expect(mocks.prompt).toHaveBeenCalledWith(expect.objectContaining({ scenarioId: 'real-scenario', hskLevel: 2 }))
  })
  it('returns failure when the learner turn was not saved', async () => {
    mocks.save.mockRejectedValueOnce(new Error('insert failed'))
    expect((await POST(request())).status).toBe(500)
    expect(mocks.mistakes).not.toHaveBeenCalled()
  })
  it('replays a persisted turn before ASR or quota consumption', async () => {
    mocks.history.mockResolvedValueOnce([{ turn_index: 0, user_text: '之前', ai_text: '保存的回复', grammar_score: 80, word_choice_score: null }])
    const response = await POST(request())
    expect(response.status).toBe(200)
    expect((await response.json()).ai_reply).toBe('保存的回复')
    expect(mocks.quota).not.toHaveBeenCalled()
    expect(mocks.asr).not.toHaveBeenCalled()
    expect(mocks.save).not.toHaveBeenCalled()
  })
  it('does not duplicate journal entries after a concurrent replay', async () => {
    mocks.save.mockResolvedValueOnce({ id: 'turn', duplicate: true, ai_text: 'Existing reply', errors: [], grammar_score: 70 })
    mocks.response.mockResolvedValueOnce({ reply: 'New reply', errors: [{ type: 'grammar', user_said: '你好', correct: '您好' }], scores: {} })
    const response = await POST(request())
    expect((await response.json()).ai_reply).toBe('Existing reply')
    expect(mocks.mistakes).not.toHaveBeenCalled()
  })
  it('does not invite duplicate practice when journal enrichment fails', async () => {
    mocks.response.mockResolvedValueOnce({ reply: '你好', errors: [{ type: 'grammar', user_said: '你好', correct: '您好' }], scores: {} })
    mocks.mistakes.mockRejectedValueOnce(new Error('subscription unavailable'))
    const response = await POST(request())
    expect(response.status).toBe(200)
    expect((await response.json()).warning).toContain('mistake journal')
  })
  it('rejects unowned context before quota or recognition', async () => {
    mocks.session.mockResolvedValueOnce(null)
    expect((await POST(request())).status).toBe(409)
    expect(mocks.quota).not.toHaveBeenCalled()
    expect(mocks.asr).not.toHaveBeenCalled()
  })
  it('denies exhausted quota without recognition or persistence', async () => {
    mocks.quota.mockResolvedValueOnce({ state: 'quota_denied', daily_remaining: 0 })
    expect((await POST(request())).status).toBe(429)
    expect(mocks.asr).not.toHaveBeenCalled()
    expect(mocks.save).not.toHaveBeenCalled()
  })
  it.each(['processing', 'conflict'])('does not recognize or release someone else reservation: %s', async state => {
    mocks.quota.mockResolvedValueOnce({ state })
    expect((await POST(request())).status).toBe(409)
    expect(mocks.asr).not.toHaveBeenCalled()
    expect(mocks.release).not.toHaveBeenCalled()
  })
  it('replays a concurrent completed reservation without recognition', async () => {
    mocks.quota.mockResolvedValueOnce({ state: 'completed', turn_data: { id: 'turn', ai_text: 'Saved' } })
    const response = await POST(request())
    expect((await response.json()).ai_reply).toBe('Saved')
    expect(mocks.asr).not.toHaveBeenCalled()
    expect(mocks.release).not.toHaveBeenCalled()
  })
  it('clears a successful lease before optional journal work', async () => {
    expect((await POST(request())).status).toBe(200)
    expect(mocks.release).not.toHaveBeenCalled()
  })
  it('rejects a closed session before consuming quota or saving another turn', async () => {
    mocks.session.mockResolvedValueOnce({ completed_at: 'yesterday' })
    expect((await POST(request())).status).toBe(409)
    expect(mocks.quota).not.toHaveBeenCalled()
    expect(mocks.save).not.toHaveBeenCalled()
  })
})
