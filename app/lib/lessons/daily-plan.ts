/** A schedule is a prompt to practise, never a claim of language mastery. */
export type GuidedLessonPlan =
  | { status: 'new' | 'unavailable'; checkedAt: string }
  | { status: 'due' | 'scheduled'; checkedAt: string; nextReviewAt: string }

export function guidedLessonPlan(
  progress: { next_review_at: string } | null,
  unavailable: boolean,
  now: Date,
): GuidedLessonPlan {
  const checkedAt = now.toISOString()
  if (unavailable) return { status: 'unavailable', checkedAt }
  if (!progress) return { status: 'new', checkedAt }
  const dueAt = Date.parse(progress.next_review_at)
  if (!Number.isFinite(dueAt)) return { status: 'unavailable', checkedAt }
  return { status: dueAt <= now.getTime() ? 'due' : 'scheduled', nextReviewAt: new Date(dueAt).toISOString(), checkedAt }
}
