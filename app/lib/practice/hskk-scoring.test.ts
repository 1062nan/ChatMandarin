import { describe, expect, it } from 'vitest'
import { isScorableTranscript, validateHSKKContentAssessment } from './hskk-scoring'
const valid = { scores: { grammar: 60, vocabulary: 70, content: 80 }, major_issues: [], strengths: [], overall_feedback: 'Transcript content feedback.' }
describe('HSKK transcript-only assessment', () => {
  it('rejects failed, silent and punctuation-only transcription', () => {
    for (const text of ['', '  ', '！？……', '[ASR failed]', null]) expect(isScorableTranscript(text)).toBe(false)
    expect(isScorableTranscript('你好')).toBe(true)
  })
  it('does not preserve fabricated acoustic scores or pass predictions', () => {
    const result = validateHSKKContentAssessment({ ...valid, scores: { ...valid.scores, pronunciation: 100, fluency: 100 }, total_score: 99, predicted_pass: true })
    expect(result.total_score).toBe(70)
    expect(result.scores.pronunciation).toBeNull()
    expect(result.scores.fluency).toBeNull()
    expect(result.predicted_pass).toBeNull()
  })
  it('rejects missing, nonnumeric, nonfinite and out-of-range scores', () => {
    for (const value of [undefined, '80', NaN, Infinity, -1, 101]) {
      expect(() => validateHSKKContentAssessment({ ...valid, scores: { ...valid.scores, grammar: value } })).toThrow()
    }
  })
  it('rejects acoustic issues and malformed feedback', () => {
    expect(() => validateHSKKContentAssessment({ ...valid, major_issues: [{ dimension: 'pronunciation', issue: 'Tone', example: '', correction: '' }] })).toThrow()
    expect(() => validateHSKKContentAssessment({ ...valid, strengths: 'good' })).toThrow()
  })
})
