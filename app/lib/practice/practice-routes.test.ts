import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { NextRequest } from 'next/server'
const { createClient, recognize, model } = vi.hoisted(() => ({ createClient: vi.fn(), recognize: vi.fn(), model: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createSupabaseServerClient: createClient }))
vi.mock('@/lib/ai/volcengine-asr', () => ({ recognizeSpeech: recognize }))
vi.mock('@/lib/ai/deepseek', () => ({ getHSKKScore: model }))
vi.mock('@/lib/ai/prompts', () => ({ buildHSKKPrompt: () => 'Transcript-only assessment' }))
vi.mock('@/lib/subscription/tier', () => ({ getSubscriptionContext: async () => ({ features: { dubbing: { allowed: true } } }), consumeQuota: async () => ({ ok: true }) }))
vi.mock('@/lib/practice/request', () => ({ validateAudioFile: () => ({ ok: true, format: 'wav', file: { arrayBuffer: async () => new ArrayBuffer(100) } }) }))
vi.mock('@/lib/practice/scoring', () => import('./scoring'))
vi.mock('@/lib/practice/hskk-scoring', () => import('./hskk-scoring'))
vi.mock('@/lib/hskk/content', () => ({ HSKK_CONTENT: [{ level: 'beginner', variant: 1, readAloud: { passage: '你好' }, qa: { questions: [{ question: '你好？' }] }, pictureDescription: { prompt: '描述' } }] }))
import { POST as perform } from '../../app/api/dubbing/perform/route'
import { POST as practice } from '../../app/api/dubbing/practice/route'
import { POST as submit } from '../../app/api/hskk/submit/route'

function query(data: unknown, error: unknown = null) {
  const chain: any = { then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data, error }).then(resolve) }
  for (const method of ['select', 'eq', 'insert', 'update', 'single', 'maybeSingle']) chain[method] = vi.fn(() => chain)
  return chain
}
function setup(failedSave = -1) {
  const saves = [0, 1, 2].map(i => query({ id: 'saved' }, i === failedSave ? new Error('DB unavailable') : null))
  let writes = 0
  const from = vi.fn((table: string) => {
    if (table === 'profiles') return query({ id: 'profile' })
    if (table === 'dubbing_clips') return query({ id: 'clip', title: 'Clip', lines: [{ text: '你好' }] })
    return saves[writes++] || query(null)
  })
  createClient.mockResolvedValue({ from, auth: { getUser: async () => ({ data: { user: { id: 'user' } } }) } })
  return { saves, from }
}
const request = () => ({ formData: async () => new Map<string, unknown>([['clip_id', 'clip'], ['line_index', '0'], ['level', 'beginner'], ['test_variant', '1']]) }) as unknown as NextRequest
beforeEach(() => {
  vi.clearAllMocks()
  recognize.mockResolvedValue({ text: '你好' })
  model.mockResolvedValue({ scores: { grammar: 60, vocabulary: 70, content: 80 }, major_issues: [], strengths: [], overall_feedback: 'Transcript feedback' })
})
describe('dubbing transcript matching routes', () => {
  it.each([practice, perform])('returns transcript matching without acoustic scores', async route => {
    setup()
    const response = await route(request())
    const body = await response.json()
    expect(response.status).toBe(200)
    expect(body.transcript_match_score).toBe(100)
    expect(body.assessment_basis).toBe('transcript_match')
    expect(body.scores?.pronunciation ?? body.pronunciation_score ?? null).toBeNull()
    expect(model).not.toHaveBeenCalled()
  })
  it.each([practice, perform])('rejects silence instead of granting default points', async route => {
    const db = setup()
    recognize.mockResolvedValue({ text: '……！' })
    expect((await route(request())).status).toBe(422)
    expect(db.from).not.toHaveBeenCalledWith('dubbing_performances')
  })
  it('does not report successful performance when save fails', async () => {
    setup(0)
    expect((await perform(request())).status).toBe(500)
  })
})
describe('HSKK submission failure handling', () => {
  it.each(['', '[ASR failed]', '……'])('never scores an unscorable section: %s', async text => {
    const db = setup()
    recognize.mockResolvedValueOnce({ text })
    expect((await submit(request())).status).toBe(422)
    expect(model).not.toHaveBeenCalled()
    expect(db.from).not.toHaveBeenCalledWith('hskk_tests')
  })
  it('does not turn ASR outages into scoreable placeholder text', async () => {
    setup()
    recognize.mockRejectedValueOnce(new Error('ASR outage'))
    expect((await submit(request())).status).toBe(500)
    expect(model).not.toHaveBeenCalled()
  })
  it.each([0, 1, 2])('propagates database failure at write %i', async failedSave => {
    setup(failedSave)
    expect((await submit(request())).status).toBe(500)
  })
  it('rejects out-of-range model output and marks test failed', async () => {
    const db = setup()
    model.mockResolvedValue({ scores: { grammar: 999 } })
    expect((await submit(request())).status).toBe(500)
    expect(db.saves[2].update).toHaveBeenCalledWith({ status: 'failed' })
  })
  it('saves and returns only validated content dimensions', async () => {
    const db = setup()
    const response = await submit(request())
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.scores).toEqual({ grammar: 60, vocabulary: 70, content: 80, pronunciation: null, fluency: null })
    expect(body.total_score).toBe(70)
    expect(body.predicted_pass).toBeNull()
    expect(db.saves[2].update).toHaveBeenCalledWith(expect.objectContaining({ pronunciation_score: null, fluency_score: null, status: 'completed' }))
  })
})
