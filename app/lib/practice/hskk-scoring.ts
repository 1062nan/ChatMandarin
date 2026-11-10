import { z } from 'zod'
import { normalizePracticeText } from './scoring'

const score = z.number().finite().min(0).max(100).transform(Math.round)
const contentAssessment = z.object({
  scores: z.object({ grammar: score, vocabulary: score, content: score }),
  major_issues: z.array(z.object({
    dimension: z.enum(['grammar', 'vocabulary', 'content']),
    issue: z.string(), example: z.string(), correction: z.string(),
  })).max(20),
  strengths: z.array(z.string()).max(20),
  overall_feedback: z.string().min(1),
})

export function isScorableTranscript(text: unknown): text is string {
  return typeof text === 'string' && normalizePracticeText(text).length > 0
    && !/^\s*\[ASR failed\]\s*$/i.test(text)
}

/** Validate the model's text assessment; never infer acoustic or exam scores. */
export function validateHSKKContentAssessment(value: unknown) {
  const result = contentAssessment.parse(value)
  return {
    ...result,
    scores: { ...result.scores, pronunciation: null, fluency: null },
    total_score: Math.round((result.scores.grammar + result.scores.vocabulary + result.scores.content) / 3),
    predicted_pass: null,
    assessment_basis: 'transcript_content' as const,
  }
}
