import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
const mocks = vi.hoisted(() => ({ client: vi.fn(), asr: vi.fn(), quota: vi.fn(), context: vi.fn(), validate: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createSupabaseServerClient: mocks.client }))
vi.mock('@/lib/ai/volcengine-asr', () => ({ recognizeSpeech: mocks.asr }))
vi.mock('@/lib/subscription/tier', () => ({ getSubscriptionContext: mocks.context, consumeQuota: mocks.quota }))
vi.mock('@/lib/practice/request', () => ({ validateAudioFile: mocks.validate }))
import { POST } from '../../app/api/shadowing/score/route'
function setup(saveError: Error | null = null) {
  const insert = vi.fn().mockResolvedValue({ error: saveError })
  const query = (result: unknown) => { const q: Record<string, any> = {}; for (const method of ['select', 'eq']) q[method] = vi.fn(() => q); q.single = q.maybeSingle = vi.fn().mockResolvedValue(result); return q }
  mocks.client.mockResolvedValue({ auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'auth' } } }) }, from: vi.fn((table: string) => table === 'profiles' ? query({ data: { id: 'profile' } }) : table === 'shadowing_sentences' ? query({ data: { id: 's001', text_zh: '你好' } }) : { insert }) })
  return insert
}
function request() { const body = new FormData(); body.set('sentence_id', 's001'); body.set('original', '伪造目标'); return new NextRequest('https://example.test/api/shadowing/score', { method: 'POST', body }) }
beforeEach(() => { vi.resetAllMocks(); mocks.validate.mockReturnValue({ ok: true, format: 'wav', file: { arrayBuffer: async () => new ArrayBuffer(100) } }); mocks.context.mockResolvedValue({ plan: 'free' }); mocks.quota.mockResolvedValue({ ok: true }); mocks.asr.mockResolvedValue({ text: '你好' }) })
describe('shadowing transcript assessment', () => {
  it('uses canonical text and never reports acoustic scores', async () => {
    const insert = setup(); const response = await POST(request()); const result = await response.json()
    expect(response.status).toBe(200); expect(result.original).toBe('你好'); expect(result.transcript_match_score).toBe(100)
    expect(result.pronunciation_score).toBeNull(); expect(result.tone_score).toBeNull(); expect(result.fluency_score).toBeNull()
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ pronunciation_score: null, fluency_score: null }))
  })
  it('does not save or score silence', async () => { const insert = setup(); mocks.asr.mockResolvedValue({ text: ' ' }); expect((await POST(request())).status).toBe(422); expect(insert).not.toHaveBeenCalled() })
  it('does not claim success after save failure', async () => { setup(new Error('test save failure')); expect((await POST(request())).status).toBe(500) })
  it('does not call ASR when quota is exhausted', async () => { setup(); mocks.quota.mockResolvedValue({ ok: false }); expect((await POST(request())).status).toBe(429); expect(mocks.asr).not.toHaveBeenCalled() })
})
