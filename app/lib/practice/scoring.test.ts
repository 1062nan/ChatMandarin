import { describe, expect, it } from 'vitest'
import {
  calculateCompletionScore,
  clampScore,
  comparePracticeTexts,
  normalizePracticeText,
} from './scoring'

describe('practice scoring', () => {
  it.each([['6', '六'], ['16', '十六'], ['100', '一百'], ['2026', '二零二六'], ['2', '两'], ['10000', '一万']])('accepts equivalent ASR numeral forms %s and %s', (digit, chinese) => {
    const result = comparePracticeTexts(`我每天早上${digit}点起床。`, `我每天早上${chinese}点起床。`)
    expect(result.accuracyScore).toBe(100)
    expect(result.errors).toEqual([])
    expect(result.charByChar.some(char => char.char === chinese && char.correct)).toBe(true)
  })
  it('still penalizes different spoken numbers', () => {
    expect(comparePracticeTexts('七点', '6点').accuracyScore).toBeLessThan(100)
  })
  it('does not grant full credit to an empty target', () => {
    expect(comparePracticeTexts('', '').accuracyScore).toBe(0)
    expect(comparePracticeTexts('你好', '……').accuracyScore).toBe(0)
    expect(normalizePracticeText('“你好”：……（！）')).toBe('你好')
  })

  it('ignores whitespace and Chinese punctuation', () => {
    expect(normalizePracticeText('你 好，世界！')).toBe('你好世界')
    expect(comparePracticeTexts('你 好，世界！', '你好世界。').accuracyScore).toBe(100)
  })

  it('reports substitutions without inventing errors for missing characters', () => {
    const result = comparePracticeTexts('你坏', '你好啊')
    expect(result.accuracyScore).toBe(33)
    expect(result.charByChar[0]).toEqual({ char: '你', userSaid: '你', correct: true })
    expect(result.charByChar.filter((entry) => !entry.correct)).toHaveLength(2)
    expect(result.charByChar.filter((entry) => entry.userSaid === '_')).toHaveLength(1)
    expect(result.errors).toHaveLength(1)
  })

  it('aligns insertions instead of shifting every later character', () => {
    const result = comparePracticeTexts('我你好', '你好')
    expect(result.accuracyScore).toBe(67)
    expect(result.charByChar.every((entry) => entry.correct)).toBe(true)
  })

  it('caps completion and model-provided scores', () => {
    expect(calculateCompletionScore('你好世界', '你好')).toBe(100)
    expect(calculateCompletionScore('你', '你好')).toBe(50)
    expect(clampScore(120, 50)).toBe(100)
    expect(clampScore(-2, 50)).toBe(0)
    expect(clampScore(Number.NaN, 50)).toBe(50)
  })
})
