import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

beforeEach(() => { vi.resetModules(); vi.stubEnv('DEEPSEEK_API_KEY', 'test-key') })
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs() })
const completion = (content: string) => Response.json({ choices: [{ message: { content }, finish_reason: 'stop' }] })
async function respond(content: string) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(completion(content)))
  const { getConversationResponse } = await import('./deepseek')
  return getConversationResponse('system', [{ role: 'user', content: '你好' }])
}
describe('DeepSeek conversation response parsing', () => {
  it('preserves a plain language reply without manufacturing scores', async () => {
    const result = await respond('你好！欢迎你来学习中文！')
    expect(result.reply).toBe('你好！欢迎你来学习中文！')
    expect(Object.values(result.scores)).toEqual([null, null, null, null])
  })
  it('preserves a JSON-string reply without manufacturing scores', async () => {
    expect((await respond('"你好"')).reply).toBe('你好')
  })
  it('accepts fenced structured output and leaves omitted scores unavailable', async () => {
    const result = await respond('```json\n{"reply":"你好","scores":{"grammar":80}}\n```')
    expect(result.reply).toBe('你好')
    expect(result.scores).toEqual({ pronunciation: null, grammar: 80, word_choice: null, fluency: null })
  })
  it('retries empty response once without JSON mode', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(completion(' ')).mockResolvedValueOnce(completion('{"reply":"你好"}'))
    vi.stubGlobal('fetch', fetcher)
    const { getConversationResponse } = await import('./deepseek')
    expect((await getConversationResponse('system', [{ role: 'user', content: '你好' }])).reply).toBe('你好')
    expect(fetcher).toHaveBeenCalledTimes(2)
    expect(JSON.parse(fetcher.mock.calls[1][1].body).response_format).toBeUndefined()
  })
})
