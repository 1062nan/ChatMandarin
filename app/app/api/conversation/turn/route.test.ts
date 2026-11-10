import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
const mocks = vi.hoisted(() => ({ client: vi.fn(), save: vi.fn(), history: vi.fn(), asr: vi.fn(), response: vi.fn(), mistakes: vi.fn(), prompt: vi.fn(), quota: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createSupabaseServerClient: mocks.client }))
vi.mock('@/lib/db/conversations', () => ({ saveConversationTurn: mocks.save, getConversationTurns: mocks.history }))
vi.mock('@/lib/ai/volcengine-asr', () => ({ recognizeSpeech: mocks.asr }))
vi.mock('@/lib/ai/volcengine-tts', () => ({ synthesizeSpeech: async () => ({ audioBase64: null }) }))
vi.mock('@/lib/ai/deepseek', () => ({ getConversationResponse: mocks.response }))
vi.mock('@/lib/ai/prompts', () => ({ buildConversationPrompt: mocks.prompt }))
vi.mock('@/lib/db/mistakes', () => ({ createMistakesFromErrors: mocks.mistakes }))
vi.mock('@/lib/audio/analyze', () => ({ analyzeAudio: () => ({ silent: false }) }))
vi.mock('@/lib/subscription/tier', () => ({ getSubscriptionContext: async () => ({ plan: 'plus' }), consumeConversationSeconds: mocks.quota }))
vi.mock('@/lib/practice/request', async () => import('../../../../lib/practice/request'))
import { POST } from './route'
function query(data: unknown) {
  const chain: any = {}
  for (const method of ['select', 'eq']) chain[method] = () => chain
  chain.single = chain.maybeSingle = async () => ({ data })
  return chain
}
function client(ended = false) {
  return { auth: { getUser: async () => ({ data: { user: { id: 'auth' } } }) }, from: (table: string) => query(table === 'profiles' ? { id: 'owner' } : table === 'conversations' ? { user_id: 'owner', scenario: 'real-scenario', hsk_level: 2, correction_mode: 'friendly', ended_at: ended ? 'yesterday' : null } : { name: { en: 'Real scenario' } }) }
}
function request() {
  const form = new FormData()
  form.append('audio', new Blob([new Uint8Array(1200)], { type: 'audio/wav' }), 'recording.wav')
  form.append('conversation_id', 'session')
  form.append('turn_index', '0')
  form.append('scenario_id', 'tampered')
  form.append('hsk_level', '6')
  return new NextRequest('http://localhost/api/conversation/turn', { method: 'POST', body: form })
}
beforeEach(() => {
  vi.clearAllMocks()
  mocks.client.mockResolvedValue(client())
  mocks.save.mockResolvedValue({ id: 'turn' })
  mocks.history.mockResolvedValue([])
  mocks.asr.mockResolvedValue({ text: '你好' })
  mocks.response.mockResolvedValue({ reply: '你好', errors: [], scores: { pronunciation: null, grammar: null, fluency: null, word_choice: null } })
  mocks.mistakes.mockResolvedValue(undefined)
  mocks.quota.mockResolvedValue({ ok: true })
})
describe('conversation turn persistence contract', () => {
  it('preserves unavailable scores and uses server-side learning settings', async () => {
    const response = await POST(request())
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(Object.values(body.scores)).toEqual([null, null, null, null])
    expect(mocks.prompt).toHaveBeenCalledWith(expect.objectContaining({ scenarioId: 'real-scenario', hskLevel: 2 }))
  })
  it('returns failure when the learner turn was not saved', async () => {
    mocks.save.mockRejectedValueOnce(new Error('insert failed'))
    expect((await POST(request())).status).toBe(500)
    expect(mocks.mistakes).not.toHaveBeenCalled()
  })
  it('returns success and warning when only the derived summary failed', async () => {
    mocks.save.mockResolvedValueOnce({ id: 'turn', statsUpdateFailed: true })
    const response = await POST(request())
    expect(response.status).toBe(200)
    expect((await response.json()).warning).toContain('summary update is pending')
    expect(mocks.save).toHaveBeenCalledOnce()
  })
  it('does not invite duplicate practice when journal enrichment fails', async () => {
    mocks.response.mockResolvedValueOnce({ reply: '你好', errors: [{ type: 'grammar', user_said: '你好', correct: '您好' }], scores: {} })
    mocks.mistakes.mockRejectedValueOnce(new Error('subscription unavailable'))
    const response = await POST(request())
    expect(response.status).toBe(200)
    expect((await response.json()).warning).toContain('mistake journal')
  })
  it('rejects a closed session before consuming quota or saving another turn', async () => {
    mocks.client.mockResolvedValueOnce(client(true))
    expect((await POST(request())).status).toBe(409)
    expect(mocks.quota).not.toHaveBeenCalled()
    expect(mocks.save).not.toHaveBeenCalled()
  })
})
