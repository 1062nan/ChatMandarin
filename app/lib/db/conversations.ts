/**
 * 对话数据访问层
 */
import { meanMeasuredScores } from '../ai/conversation-feedback'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import type { Conversation, ConversationTurn, MistakeEntry } from '@/lib/db/types'

/**
 * 创建新对话
 */
export async function createConversation(opts: {
  userId: string
  scenario: string
  hskLevel: number
  correctionMode: string
}): Promise<Conversation> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from('conversations')
    .insert({
      user_id: opts.userId,
      scenario: opts.scenario,
      hsk_level: opts.hskLevel,
      correction_mode: opts.correctionMode as any
    })
    .select()
    .single()

  if (error) throw error
  return data as Conversation
}

/**
 * 获取对话历史（所有轮次）
 */
export async function getConversationTurns(conversationId: string): Promise<ConversationTurn[]> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from('conversation_turns')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('turn_index', { ascending: true })

  if (error) throw error
  return (data || []) as ConversationTurn[]
}

/**
 * 保存一轮对话
 */
export async function saveConversationTurn(opts: {
  conversationId: string
  turnIndex: number
  userText: string
  aiText: string
  errors: MistakeEntry[]
  scores: {
    pronunciation: number | null
    grammar: number | null
    fluency: number | null
    word_choice: number | null
  }
  userAudioDurationMs?: number
  aiResponseLatencyMs?: number
}): Promise<ConversationTurn & { statsUpdateFailed?: boolean }> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from('conversation_turns')
    .insert({
      conversation_id: opts.conversationId,
      turn_index: opts.turnIndex,
      user_text: opts.userText,
      ai_text: opts.aiText,
      errors: opts.errors,
      pronunciation_score: opts.scores.pronunciation,
      grammar_score: opts.scores.grammar,
      fluency_score: opts.scores.fluency,
      word_choice_score: opts.scores.word_choice,
      user_audio_duration_ms: opts.userAudioDurationMs,
      ai_response_latency_ms: opts.aiResponseLatencyMs
    })
    .select()
    .single()

  if (error) throw error

  // The turn is already durable. A derived-summary failure must not invite
  // the client to resubmit the same learner turn as a new practice attempt.
  try {
    await updateConversationStats(opts.conversationId)
  } catch (statsError) {
    console.error('Conversation saved but summary update failed:', statsError)
    return { ...(data as ConversationTurn), statsUpdateFailed: true }
  }

  return data as ConversationTurn
}

/**
 * 更新对话统计（total_turns + 平均分）
 */
export async function updateConversationStats(conversationId: string): Promise<void> {
  const supabase = await createSupabaseServerClient()
  const { data: turns, error: turnsError } = await supabase
    .from('conversation_turns')
    .select('pronunciation_score, grammar_score, fluency_score, word_choice_score')
    .eq('conversation_id', conversationId)

  if (turnsError) throw turnsError
  if (!turns || turns.length === 0) return

  const count = turns.length
  const avg = (field: string) =>
    meanMeasuredScores(turns.map(t => (t as any)[field]))

  const { error: updateError } = await supabase
    .from('conversations')
    .update({
      total_turns: count,
      avg_pronunciation: avg('pronunciation_score'),
      avg_grammar: avg('grammar_score'),
      avg_fluency: avg('fluency_score'),
      avg_word_choice: avg('word_choice_score')
    })
    .eq('id', conversationId)

  if (updateError) throw updateError
}

/**
 * 结束对话
 */
export async function endConversation(
  conversationId: string,
  userId: string
): Promise<{ ended: boolean }> {
  const supabase = await createSupabaseServerClient()

  // Count persisted learner input, not the denormalized total_turns cache.
  // A greeting or opening then closing the screen is not completed practice.
  const { data: turns, error: turnsError } = await supabase
    .from('conversation_turns')
    .select('user_text')
    .eq('conversation_id', conversationId)

  if (turnsError) throw turnsError
  const hasPractice = (turns || []).some(turn => Boolean(turn.user_text?.trim()))
  // Retry any derived summary that failed after the durable turn insert.
  // Do this before closing so a transient failure remains safely retryable.
  if (hasPractice) await updateConversationStats(conversationId)

  // 只允许结束当前用户尚未结束的对话。条件更新让重复点击、请求重试和
  // 并发请求保持幂等，避免 total_conversations 被重复累计。
  const { data: endedConversation, error: endError } = await supabase
    .from('conversations')
    .update({ ended_at: new Date().toISOString() })
    .eq('id', conversationId)
    .eq('user_id', userId)
    .is('ended_at', null)
    .select('user_id')
    .maybeSingle()

  if (endError) throw endError
  if (!endedConversation) return { ended: false }
  if (!hasPractice) return { ended: true }

  // 更新用户 profile 的 total_conversations
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('total_conversations, current_streak, longest_streak, last_practice_date')
    .eq('id', userId)
    .single()

  if (profileError) throw profileError

  const today = new Date().toISOString().split('T')[0]
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]
  const lastPractice = profile.last_practice_date

  let streak = profile.current_streak || 0
  if (lastPractice === today) {
    // 今天已练过，不增加
  } else if (lastPractice === yesterday) {
    streak += 1
  } else {
    streak = 1
  }

  const { error: updateError } = await supabase
    .from('profiles')
    .update({
      total_conversations: (profile.total_conversations || 0) + 1,
      current_streak: streak,
      longest_streak: Math.max(streak, profile.longest_streak || 0),
      last_practice_date: today
    })
    .eq('id', userId)

  if (updateError) throw updateError
  return { ended: true }
}
