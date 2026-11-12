import { afterEach, describe, expect, it, vi } from 'vitest'
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs() })
describe('direct voice provider metering', () => {
  it('counts submitted Unicode code points without recording text/audio', async () => {
    vi.resetModules(); vi.stubEnv('VOLCENGINE_ROUTE', 'direct'); vi.stubEnv('VOLCENGINE_API_KEY', 'test-only')
    const log = vi.spyOn(console, 'info').mockImplementation(() => {})
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ code: 3000, data: 'YXVkaW8=', duration: 2 })))
    const { synthesizeSpeech } = await import('./volcengine-tts')
    expect((await synthesizeSpeech('你😀')).duration).toBe(2)
    expect(log).toHaveBeenCalledTimes(1)
    expect(JSON.parse(log.mock.calls[0][0] as string)).toMatchObject({ operation: 'tts', input_characters: 2, billed_cost: null, status: 'completed' })
    expect(log.mock.calls[0][0]).not.toContain('YXVkaW8=')
    expect(log.mock.calls[0][0]).not.toContain('你😀')
  })
  it('logs rejected synthesis as a failed attempt, not a zero charge', async () => {
    vi.resetModules(); vi.stubEnv('VOLCENGINE_ROUTE', 'direct'); vi.stubEnv('VOLCENGINE_API_KEY', 'test-only')
    const log = vi.spyOn(console, 'info').mockImplementation(() => {})
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ code: 1, message: 'private text' })))
    const { synthesizeSpeech } = await import('./volcengine-tts')
    await expect(synthesizeSpeech('你好')).rejects.toThrow('TTS provider rejected synthesis')
    expect(JSON.parse(log.mock.calls[0][0] as string)).toMatchObject({ status: 'failed', billed_cost: null })
    expect(log.mock.calls[0][0]).not.toContain('private')
  })
})
