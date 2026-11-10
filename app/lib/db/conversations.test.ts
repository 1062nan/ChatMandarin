import { beforeEach, describe, expect, it, vi } from 'vitest'

const { createClient } = vi.hoisted(() => ({ createClient: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createSupabaseServerClient: createClient }))
import { endConversation, updateConversationStats, saveConversationTurn } from './conversations'

function query(result: unknown) {
  const chain: any = { then: (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve) }
  for (const method of ['select', 'eq', 'is', 'insert', 'update', 'single', 'maybeSingle']) chain[method] = vi.fn(() => chain)
  return chain
}

function setup(texts: Array<string | null>, ended = true, turnError: unknown = null) {
  const turns = query({ data: texts.map(user_text => ({ user_text })), error: turnError })
  const conversation = query({ data: ended ? { user_id: 'owner' } : null, error: null })
  const profile = query({ data: { total_conversations: 4, current_streak: 2, longest_streak: 3, last_practice_date: '2026-01-09' }, error: null })
  const update = query({ error: null })
  let profileCalls = 0
  const from = vi.fn((table: string) => table === 'conversation_turns' ? turns : table === 'conversations' ? conversation : profileCalls++ === 0 ? profile : update)
  createClient.mockResolvedValue({ from })
  return { turns, conversation, profile, update, from }
}

beforeEach(() => { vi.clearAllMocks(); vi.useRealTimers() })

describe('conversation completion', () => {
  for (const texts of [[], [''], ['  ', null]]) {
    it(`does not credit empty practice ${JSON.stringify(texts)}`, async () => {
      const db = setup(texts)
      expect(await endConversation('session', 'owner')).toEqual({ ended: true })
      expect(db.conversation.update).toHaveBeenCalledOnce()
      expect(db.from).not.toHaveBeenCalledWith('profiles')
    })
  }

  it('credits persisted input and enforces owner and unfinished-session filters', async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-01-10T12:00:00Z'))
    const db = setup(['你好'])
    expect(await endConversation('session', 'owner')).toEqual({ ended: true })
    expect(db.conversation.eq).toHaveBeenCalledWith('user_id', 'owner')
    expect(db.conversation.is).toHaveBeenCalledWith('ended_at', null)
    expect(db.update.update).toHaveBeenCalledWith({ total_conversations: 5, current_streak: 3, longest_streak: 3, last_practice_date: '2026-01-10' })
  })

  it('does not credit repeats or a session belonging to another owner', async () => {
    const db = setup(['你好'], false)
    expect(await endConversation('session', 'owner')).toEqual({ ended: false })
    expect(db.from).not.toHaveBeenCalledWith('profiles')
  })

  it('does not close or credit a session if reading persisted turns fails', async () => {
    const db = setup([], true, new Error('Read failed'))
    await expect(endConversation('session', 'owner')).rejects.toThrow('Read failed')
    expect(db.from).not.toHaveBeenCalledWith('conversations')
    expect(db.from).not.toHaveBeenCalledWith('profiles')
  })
})


describe('conversation statistics', () => {
  it('excludes unmeasured scores rather than treating them as zero', async () => {
    const turns = query({ data: [
      { pronunciation_score: null, grammar_score: 80, fluency_score: null, word_choice_score: null },
      { pronunciation_score: null, grammar_score: null, fluency_score: null, word_choice_score: 60 },
    ], error: null })
    const update = query({ error: null })
    createClient.mockResolvedValue({ from: (table: string) => table === 'conversation_turns' ? turns : update })
    await updateConversationStats('session')
    expect(update.update).toHaveBeenCalledWith({ total_turns: 2, avg_pronunciation: null, avg_grammar: 80, avg_fluency: null, avg_word_choice: 60 })
  })

  it.each(['read', 'update'])('surfaces statistics %s failures', async stage => {
    const turns = query({ data: [{ grammar_score: 80 }], error: stage === 'read' ? new Error('read failed') : null })
    const update = query({ error: stage === 'update' ? new Error('update failed') : null })
    createClient.mockResolvedValue({ from: (table: string) => table === 'conversation_turns' ? turns : update })
    await expect(updateConversationStats('session')).rejects.toThrow(`${stage} failed`)
  })
})


describe('completion summary retry', () => {
  it('leaves completion open when summary refresh fails so ending can be retried', async () => {
    const meaningful = query({ data: [{ user_text: '你好' }], error: null })
    const failedStats = query({ data: null, error: new Error('summary read failed') })
    const from = vi.fn().mockReturnValueOnce(meaningful).mockReturnValueOnce(failedStats)
    createClient.mockResolvedValue({ from })
    await expect(endConversation('session', 'owner')).rejects.toThrow('summary read failed')
    expect(from).not.toHaveBeenCalledWith('conversations')
    expect(from).not.toHaveBeenCalledWith('profiles')
  })
})

describe('durable conversation turn saves', () => {
  const input = { conversationId: 'session', turnIndex: 0, userText: '你好', aiText: '你好', errors: [], scores: { pronunciation: null, grammar: null, fluency: null, word_choice: null } }
  it('returns a warning rather than failing a durable insert when summary update fails', async () => {
    const insert = query({ data: { id: 'turn' }, error: null })
    const stats = query({ data: null, error: new Error('summary unavailable') })
    let calls = 0
    createClient.mockResolvedValue({ from: () => calls++ === 0 ? insert : stats })
    await expect(saveConversationTurn(input)).resolves.toMatchObject({ id: 'turn', statsUpdateFailed: true })
    expect(insert.insert).toHaveBeenCalledOnce()
  })
  it('still fails when the turn itself was not persisted', async () => {
    const insert = query({ data: null, error: new Error('insert failed') })
    createClient.mockResolvedValue({ from: () => insert })
    await expect(saveConversationTurn(input)).rejects.toThrow('insert failed')
    expect(insert.insert).toHaveBeenCalledOnce()
  })
})
