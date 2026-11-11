import { createHash } from 'node:crypto'
import { createSupabaseAdmin, createSupabaseServerClient } from '@/lib/supabase/server'
import type { saveConversationTurn, VerifiedTurn } from './conversations'

type Client = Awaited<ReturnType<typeof createSupabaseServerClient>>
type Reservation = { state: 'reserved' | 'processing' | 'completed' | 'conflict' | 'quota_denied'; lease_token?: string; turn_data?: VerifiedTurn; reason?: string; daily_remaining?: number | null }
export function conversationFingerprint(audio: ArrayBuffer) {
  return createHash('sha256').update(Buffer.from(audio)).digest('hex')
}
export async function reserveConversation(client: Client, profileId: string, conversationId: string, turnIndex: number, fingerprint: string, seconds: number): Promise<Reservation> {
  const { data, error } = await client.rpc('reserve_conversation_submission', { p_profile_id: profileId, p_conversation_id: conversationId, p_turn_index: turnIndex, p_fingerprint: fingerprint, p_seconds: seconds })
  if (error) throw error
  if (!data || !['reserved', 'processing', 'completed', 'conflict', 'quota_denied'].includes(data.state)) throw new Error('Invalid conversation reservation')
  return data
}
export async function finishConversation(lease: string, opts: Parameters<typeof saveConversationTurn>[0]): Promise<VerifiedTurn> {
  const { data, error } = await createSupabaseAdmin().rpc('finish_conversation_submission', {
    p_profile_id: opts.userId, p_conversation_id: opts.conversationId, p_turn_index: opts.turnIndex, p_lease_token: lease,
    p_turn: { user_text: opts.userText, ai_text: opts.aiText, errors: opts.errors, grammar_score: opts.scores.grammar, word_choice_score: opts.scores.word_choice,
      user_audio_duration_ms: opts.userAudioDurationMs, ai_response_latency_ms: opts.aiResponseLatencyMs,
      conversation_complete: opts.conversationComplete ?? false, encouragement: opts.encouragement ?? null },
  })
  if (error) throw error
  if (!data?.id) throw new Error('Conversation submission lease expired')
  return data as VerifiedTurn
}
export async function failConversation(profileId: string, conversationId: string, turnIndex: number, lease: string) {
  const { error } = await createSupabaseAdmin().rpc('fail_conversation_submission', { p_profile_id: profileId, p_conversation_id: conversationId, p_turn_index: turnIndex, p_lease_token: lease })
  if (error) throw error
}
