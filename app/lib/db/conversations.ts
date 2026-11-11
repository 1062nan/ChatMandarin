/** Trusted conversation writes are atomic, server-only database operations. */
import { createSupabaseAdmin } from '@/lib/supabase/server'
import type { Conversation, ConversationTurn, MistakeEntry } from '@/lib/db/types'

export type VerifiedTurn = ConversationTurn & { duplicate?: boolean; conversation_complete?: boolean; encouragement?: string | null }
export interface VerifiedConversation {
  conversation_id: string; user_id: string; scenario_id: string; hsk_level: number;
  correction_mode: string; completed_at: string | null; verified: boolean;
}

// Callers first authenticate with getUser and resolve the owned profile.
export async function createConversation(opts: { userId: string; scenario: string; hskLevel: number; correctionMode: string }): Promise<Conversation> {
  const { data, error } = await createSupabaseAdmin().rpc('start_verified_conversation', {
    p_profile_id: opts.userId, p_scenario: opts.scenario, p_hsk_level: opts.hskLevel, p_correction_mode: opts.correctionMode
  })
  if (error) throw error
  if (!data?.id) throw new Error('Conversation was not created')
  return data as Conversation
}

export async function getVerifiedConversation(conversationId: string, userId: string): Promise<VerifiedConversation | null> {
  const { data, error } = await createSupabaseAdmin().from('verified_conversation_sessions')
    .select('*').eq('conversation_id', conversationId).eq('user_id', userId).eq('verified', true).maybeSingle()
  if (error) throw error
  return data as VerifiedConversation | null
}

/** One ownership check supplies both the immutable session and its protected history. */
export async function getConversationContext(conversationId: string, userId: string): Promise<{ session: VerifiedConversation; turns: VerifiedTurn[] } | null> {
  const session = await getVerifiedConversation(conversationId, userId)
  if (!session) return null
  const { data, error } = await createSupabaseAdmin().from('verified_conversation_turns')
    .select('turn_data').eq('conversation_id', conversationId).order('turn_index', { ascending: true })
  if (error) throw error
  return { session, turns: (data || []).map((row: { turn_data: unknown }) => row.turn_data as VerifiedTurn) }
}

export async function getConversationTurns(conversationId: string, userId: string): Promise<VerifiedTurn[]> {
  const context = await getConversationContext(conversationId, userId)
  if (!context) throw new Error('Verified conversation not owned')
  return context.turns
}

export async function saveConversationTurn(opts: {
  userId: string; conversationId: string; turnIndex: number; userText: string; aiText: string; errors: MistakeEntry[];
  scores: { pronunciation: number | null; grammar: number | null; fluency: number | null; word_choice: number | null };
  userAudioDurationMs?: number; aiResponseLatencyMs?: number; conversationComplete?: boolean; encouragement?: string | null;
}): Promise<VerifiedTurn> {
  const { data, error } = await createSupabaseAdmin().rpc('save_verified_conversation_turn', {
    p_profile_id: opts.userId, p_conversation_id: opts.conversationId, p_turn_index: opts.turnIndex,
    p_turn: { user_text: opts.userText, ai_text: opts.aiText, errors: opts.errors,
      grammar_score: opts.scores.grammar, word_choice_score: opts.scores.word_choice,
      user_audio_duration_ms: opts.userAudioDurationMs, ai_response_latency_ms: opts.aiResponseLatencyMs,
      conversation_complete: opts.conversationComplete ?? false, encouragement: opts.encouragement ?? null }
  })
  if (error) throw error
  if (!data?.id) throw new Error('Conversation turn was not saved')
  return data as VerifiedTurn
}

export async function endConversation(conversationId: string, userId: string): Promise<{ ended: boolean; progress?: unknown }> {
  const { data, error } = await createSupabaseAdmin().rpc('end_verified_conversation', { p_profile_id: userId, p_conversation_id: conversationId })
  if (error) throw error
  if (typeof data?.ended !== 'boolean') throw new Error('Completion was not confirmed')
  return data
}
