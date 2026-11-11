import { beforeEach, describe, expect, it, vi } from 'vitest'
const { rpc, from } = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createSupabaseAdmin: () => ({ rpc, from }) }))
import { createConversation, endConversation, saveConversationTurn, getConversationTurns } from './conversations'
beforeEach(() => vi.resetAllMocks())
describe('atomic conversation persistence boundary', () => {
  it('starts the public row and trusted snapshot in one RPC', async () => {
    rpc.mockResolvedValue({ data: { id: 'session' } })
    await createConversation({ userId: 'owner', scenario: 'intro', hskLevel: 1, correctionMode: 'friendly' })
    expect(rpc).toHaveBeenCalledWith('start_verified_conversation', { p_profile_id:'owner',p_scenario:'intro',p_hsk_level:1,p_correction_mode:'friendly' })
    expect(from).not.toHaveBeenCalled()
  })
  it('completes stats, counters and progress in one owner-scoped transaction', async () => {
    rpc.mockResolvedValue({ data: { ended: true, progress: { credited: true } } })
    expect(await endConversation('session','owner')).toMatchObject({ ended: true })
    expect(rpc).toHaveBeenCalledWith('end_verified_conversation',{p_profile_id:'owner',p_conversation_id:'session'})
    expect(from).not.toHaveBeenCalled()
  })
  it('preserves duplicate completion and propagates transaction failure', async () => {
    rpc.mockResolvedValueOnce({ data: { ended: false } }).mockResolvedValueOnce({ error: new Error('rollback') })
    expect(await endConversation('session','owner')).toEqual({ended:false})
    await expect(endConversation('session','owner')).rejects.toThrow('rollback')
  })
  it('never saves acoustic scores and returns the canonical duplicate', async () => {
    rpc.mockResolvedValue({ data: { id:'existing',duplicate:true } })
    const result=await saveConversationTurn({userId:'owner',conversationId:'session',turnIndex:0,userText:'你好',aiText:'您好',errors:[],scores:{grammar:80,word_choice:null,pronunciation:99,fluency:99}})
    expect(result).toEqual({id:'existing',duplicate:true})
    const args=rpc.mock.calls[0][1]
    expect(args.p_turn).not.toHaveProperty('pronunciation_score')
    expect(args.p_turn).not.toHaveProperty('fluency_score')
    expect(args.p_profile_id).toBe('owner')
  })
  it('does not read trusted turns before verifying the session owner', async () => {
    const q:any={select:()=>q,eq:vi.fn(()=>q),maybeSingle:async()=>({data:null})}
    from.mockReturnValue(q)
    await expect(getConversationTurns('session','other')).rejects.toThrow('not owned')
    expect(q.eq).toHaveBeenCalledWith('user_id','other')
    expect(from).not.toHaveBeenCalledWith('verified_conversation_turns')
  })
})
