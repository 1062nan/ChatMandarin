import { afterEach, describe, expect, it, vi } from 'vitest'
import { endpointClass, observeProviderAttempt, safeModel, tokenEvidence } from './provider-usage'
const attempt = { provider: 'deepseek', operation: 'conversation', transport: 'direct', endpointClass: 'official', resource: 'deepseek-chat' } as const
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs() })
describe('privacy-preserving aggregate provider telemetry', () => {
  it('allowlists usage and never logs provider content, URLs or arbitrary metadata', async () => {
    const log = vi.spyOn(console, 'info').mockImplementation(() => {})
    const value = await observeProviderAttempt(attempt, async observe => {
      observe({ model: 'deepseek-chat', usage: { prompt_tokens: 42, completion_tokens: 12, secret: 'private', content: 'transcript' } })
      return { audio: 'raw audio' }
    })
    expect(value).toEqual({ audio: 'raw audio' })
    const serialized = log.mock.calls[0][0] as string
    const event = JSON.parse(serialized)
    expect(event).toMatchObject({ status: 'completed', prompt_tokens: 42, completion_tokens: 12, billed_cost: null, returned_model: 'deepseek-chat' })
    for (const privateValue of ['private', 'transcript', 'raw audio']) expect(serialized).not.toContain(privateValue)
  })
  it('records failed attempts as unknown charge and preserves the original error without logging it', async () => {
    const log = vi.spyOn(console, 'info').mockImplementation(() => {})
    const error = new Error('secret URL and user text')
    await expect(observeProviderAttempt(attempt, async () => { throw error })).rejects.toBe(error)
    expect(JSON.parse(log.mock.calls[0][0] as string)).toMatchObject({ status: 'failed', billed_cost: null, prompt_tokens: null })
    expect(log.mock.calls[0][0]).not.toContain(error.message)
  })
  it('does not break requests when telemetry UUID/logging fails', async () => {
    vi.stubGlobal('crypto', { randomUUID: () => { throw new Error('unavailable') } })
    vi.spyOn(console, 'info').mockImplementation(() => { throw new Error('logging down') })
    await expect(observeProviderAttempt(attempt, async () => 42)).resolves.toBe(42)
  })
  it('rejects invalid usage rather than silently treating it as zero', () => {
    expect(tokenEvidence({ prompt_tokens: -1, completion_tokens: '7', total_tokens: Infinity, prompt_cache_hit_tokens: 1.5 })).toEqual({ prompt_tokens: null, completion_tokens: null, total_tokens: null, prompt_cache_hit_tokens: null, prompt_cache_miss_tokens: null })
    expect(tokenEvidence({ prompt_tokens: 0 }).prompt_tokens).toBe(0)
  })
  it('maps unrecognized model labels to other rather than logging arbitrary text', () => {
    expect(safeModel('deepseek-secret-or-user-text')).toBe('other')
    expect(safeModel('DeepSeek-V4.1-Flash-1017')).toBe('deepseek-v4.1-flash-1017')
  })
  it('classifies the configured host without emitting any URL', () => {
    expect(endpointClass('https://api.deepseek.com/v1', 'api.deepseek.com')).toBe('official')
    expect(endpointClass('https://user:secret@proxy.example/custom?key=secret', 'api.deepseek.com')).toBe('compatible')
    expect(endpointClass('not a URL', 'api.deepseek.com')).toBe('unknown')
  })
  it('meters both empty-response retry attempts and returned model, with real unit evidence', async () => {
    vi.resetModules(); vi.stubEnv('DEEPSEEK_API_KEY', 'test-only'); vi.stubEnv('DEEPSEEK_BASE_URL', 'https://proxy.example')
    const log = vi.spyOn(console, 'info').mockImplementation(() => {})
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(Response.json({ model: 'deepseek-flash', usage: { prompt_tokens: 10, completion_tokens: 1 }, choices: [{ message: { content: ' ' } }] }))
      .mockResolvedValueOnce(Response.json({ model: 'deepseek-flash', usage: { prompt_tokens: 10, completion_tokens: 2 }, choices: [{ message: { content: '{"reply":"你好"}' } }] })))
    const { getConversationResponse } = await import('./deepseek')
    await getConversationResponse('private system', [{ role: 'user', content: 'private user' }])
    expect(log).toHaveBeenCalledTimes(2)
    const events = log.mock.calls.map(call => JSON.parse(call[0] as string))
    expect(events[0]).toMatchObject({ endpoint_class: 'compatible', returned_model: 'deepseek-flash', completion_tokens: 1 })
    expect(events[1]).toMatchObject({ completion_tokens: 2 })
    expect(events[0].attempt_id).not.toBe(events[1].attempt_id)
    expect(JSON.stringify(events)).not.toContain('private')
  })
  it('meters HSKK usage even when downstream result is empty, without raw response errors', async () => {
    vi.resetModules(); vi.stubEnv('DEEPSEEK_API_KEY', 'test-only')
    const log = vi.spyOn(console, 'info').mockImplementation(() => {})
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ model: 'deepseek-chat', usage: { prompt_tokens: 5 }, choices: [{ message: { content: '' } }] })))
    const { getHSKKScore } = await import('./deepseek')
    await expect(getHSKKScore('private prompt')).rejects.toThrow('DeepSeek returned empty response')
    expect(log).toHaveBeenCalledTimes(1)
    expect(log.mock.calls[0][0]).not.toContain('private')
  })
})
