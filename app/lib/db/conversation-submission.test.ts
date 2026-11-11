import { beforeEach, expect, it, vi } from 'vitest'
const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createSupabaseAdmin: () => ({ rpc }) }))
import { conversationFingerprint, reserveConversation, finishConversation, failConversation } from './conversation-submission'
beforeEach(() => vi.resetAllMocks())
it('fingerprints exact audio bytes consistently', () => {
  const a = new Uint8Array([1, 2]).buffer
  expect(conversationFingerprint(a)).toMatch(/^[0-9a-f]{64}$/)
  expect(conversationFingerprint(a)).toBe(conversationFingerprint(a.slice(0)))
  expect(conversationFingerprint(a)).not.toBe(conversationFingerprint(new Uint8Array([1, 3]).buffer))
})
it('reserves using authenticated identity plus canonical turn and audio', async () => {
  rpc.mockResolvedValue({ data: { state: 'reserved', lease_token: 'lease' } })
  await reserveConversation({ rpc } as never, 'profile', 'conv', 0, 'hash', 4)
  expect(rpc).toHaveBeenCalledWith('reserve_conversation_submission', { p_profile_id: 'profile', p_conversation_id: 'conv', p_turn_index: 0, p_fingerprint: 'hash', p_seconds: 4 })
  rpc.mockResolvedValue({ error: new Error('offline') })
  await expect(reserveConversation({ rpc } as never, 'p', 'c', 0, 'h', 4)).rejects.toThrow('offline')
})
it('rejects stale finish and never writes acoustic scores', async () => {
  const opts = { userId: 'p', conversationId: 'c', turnIndex: 0, userText: '你好', aiText: '您好', errors: [], scores: { grammar: 90, word_choice: 80, pronunciation: 99, fluency: 99 } }
  rpc.mockResolvedValue({ data: null })
  await expect(finishConversation('lease', opts)).rejects.toThrow('expired')
  rpc.mockResolvedValue({ data: { id: 'saved' } })
  await expect(finishConversation('lease', opts)).resolves.toEqual({ id: 'saved' })
  const payload = rpc.mock.calls[1][1]
  expect(payload.p_lease_token).toBe('lease')
  expect(payload.p_turn).not.toHaveProperty('pronunciation_score')
  expect(payload.p_turn).not.toHaveProperty('fluency_score')
})
it('releases only the matching lease and propagates RPC failure', async () => {
  rpc.mockResolvedValue({ data: false })
  await failConversation('p', 'c', 0, 'lease')
  expect(rpc).toHaveBeenCalledWith('fail_conversation_submission', { p_profile_id: 'p', p_conversation_id: 'c', p_turn_index: 0, p_lease_token: 'lease' })
  rpc.mockResolvedValue({ error: new Error('offline') })
  await expect(failConversation('p', 'c', 0, 'lease')).rejects.toThrow('offline')
})
