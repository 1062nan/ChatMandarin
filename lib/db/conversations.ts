/**
 * 对话数据访问层
 */
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
    pronunciation: number
    grammar: number
    fluency: number
    word_choice: number
  }
  userAudioDurationMs?: number
  aiResponseLatencyMs?: number
}): Promise<ConversationTurn> {
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

  // 更新对话的 total_turns 和平均分
  await updateConversationStats(opts.conversationId)

  return data as ConversationTurn
}

/**
 * 更新对话统计（total_turns + 平均分）
 */
export async function updateConversationStats(conversationId: string): Promise<void> {
  const supabase = await createSupabaseServerClient()
  const { data: turns } = await supabase
    .from('conversation_turns')
    .select('pronunciation_score, grammar_score, fluency_score, word_choice_score')
    .eq('conversation_id', conversationId)

  if (!turns || turns.length === 0) return

  const count = turns.length
  const avg = (field: string) =>
    Math.round(turns.reduce((sum, t) => sum + ((t as any)[field] || 0), 0) / count)

  await supabase
    .from('conversations')
    .update({
      total_turns: count,
      avg_pronunciation: avg('pronunciation_score'),
      avg_grammar: avg('grammar_score'),
      avg_fluency: avg('fluency_score'),
      avg_word_choice: avg('word_choice_score')
    })
    .eq('id', conversationId)
}

/**
 * 结束对话
 */
export async function endConversation(conversationId: string): Promise<void> {
  const supabase = await createSupabaseServerClient()
  await supabase
    .from('conversations')
    .update({ ended_at: new Date().toISOString() })
    .eq('id', conversationId)

  // 更新用户 profile 的 total_conversations
  const { data: conv } = await supabase
    .from('conversations')
    .select('user_id, total_turns')
    .eq('id', conversationId)
    .single()

  if (conv) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('total_conversations, current_streak, longest_streak, last_practice_date')
      .eq('id', conv.user_id)
      .single()

    if (profile) {
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

      await supabase
        .from('profiles')
        .update({
          total_conversations: (profile.total_conversations || 0) + 1,
          current_streak: streak,
          longest_streak: Math.max(streak, profile.longest_streak || 0),
          last_practice_date: today
        })
        .eq('id', conv.user_id)
    }
  }
}
