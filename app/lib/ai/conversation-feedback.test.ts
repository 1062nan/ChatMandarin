import { describe, expect, it } from 'vitest'
import { isReviewableMistake, meanMeasuredScores, normalizeConversationFeedback } from './conversation-feedback'

describe('transcript-only conversation feedback', () => {
  it('does not invent scores for plain-text fallback or malformed model values', () => {
    expect(normalizeConversationFeedback(null, '你好', '你好').scores).toEqual({
      pronunciation: null, grammar: null, word_choice: null, fluency: null,
    })
    const result = normalizeConversationFeedback({ scores: { pronunciation: 95, fluency: 90, grammar: '95', word_choice: NaN } }, '你好', '你好')
    expect(Object.values(result.scores).every(value => value === null)).toBe(true)
  })

  it('keeps bounded text dimensions but never acoustic or assistant-word corrections', () => {
    const result = normalizeConversationFeedback({ scores: { grammar: 120, word_choice: -3 }, errors: [
      { type: 'grammar', user_said: '我去昨天', correct: '我昨天去' },
      { type: 'tone', user_said: '我', correct: '我' },
      { type: 'word', user_said: '高兴', correct: '（更简单的表达）' },
      { type: 'word', user_said: '欢迎', correct: '你好' },
    ] }, '你好', '我去昨天，高兴')
    expect(result.scores).toEqual({ pronunciation: null, grammar: 100, word_choice: 0, fluency: null })
    expect(result.errors).toHaveLength(1)
  })

  it('excludes unavailable dimensions without reporting a zero score', () => {
    expect(meanMeasuredScores([null, undefined])).toBeNull()
    expect(meanMeasuredScores([90, null, 70])).toBe(80)
    expect(meanMeasuredScores([0, null])).toBe(0)
  })

  it('quarantines historical tutor hints without changing user records', () => {
    expect(isReviewableMistake({ correct: '（更简单的表达）' })).toBe(false)
    expect(isReviewableMistake({ correct: '高兴', explanation: '"满意" is an HSK 4 word. A simpler way to say this at HSK 1: "高兴".' })).toBe(false)
    expect(isReviewableMistake({ correct: '我昨天去了' })).toBe(true)
  })
})
