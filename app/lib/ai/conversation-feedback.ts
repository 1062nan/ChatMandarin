import type { MistakeEntry } from '../db/types'

export interface TranscriptScores {
  pronunciation: null
  grammar: number | null
  word_choice: number | null
  fluency: null
}

export function measuredScore(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, Math.min(100, Math.round(value)))
    : null
}

export function meanMeasuredScores(values: Array<number | null | undefined>): number | null {
  const measured = values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
  return measured.length ? Math.round(measured.reduce((sum, value) => sum + value, 0) / measured.length) : null
}

// Legacy vocabulary hints described words in the tutor's reply, not learner
// errors. Never present those rows or placeholder corrections as review cards.
export function isReviewableMistake(error: { correct: string; explanation?: string | null }): boolean {
  return typeof error.correct === 'string'
    && error.correct.trim().length > 0
    && !error.correct.includes('更简单的表达')
    && !/is an HSK \d+ word\. A simpler way to say this/.test(error.explanation || '')
}

export function normalizeConversationFeedback(value: unknown, fallbackReply: string, userText: string) {
  const record = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : {}
  const rawScores = record.scores && typeof record.scores === 'object'
    ? record.scores as Record<string, unknown> : {}
  const scores: TranscriptScores = {
    pronunciation: null,
    grammar: measuredScore(rawScores.grammar),
    word_choice: measuredScore(rawScores.word_choice),
    fluency: null,
  }
  const errors: MistakeEntry[] = Array.isArray(record.errors)
    ? record.errors.filter((error): error is MistakeEntry => {
      if (!error || typeof error !== 'object') return false
      const item = error as Record<string, unknown>
      return (item.type === 'grammar' || item.type === 'word')
        && typeof item.user_said === 'string' && item.user_said.trim().length > 0
        && userText.includes(item.user_said)
        && typeof item.correct === 'string' && item.correct !== item.user_said
        && (item.explanation === undefined || typeof item.explanation === 'string')
        && isReviewableMistake(item as unknown as MistakeEntry)
    }).map((item) => ({
      type: item.type,
      user_said: item.user_said,
      correct: item.correct,
      explanation: item.explanation,
      severity: ['low', 'medium', 'high'].includes(item.severity || '') ? item.severity : 'low',
    })) : []

  return {
    reply: typeof record.reply === 'string' && record.reply.trim() ? record.reply.trim() : fallbackReply,
    scores,
    errors,
    conversation_complete: record.conversation_complete === true,
    encouragement: typeof record.encouragement === 'string' ? record.encouragement : undefined,
  }
}
