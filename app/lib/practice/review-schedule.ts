/** A conservative recall schedule, not a proficiency or exam assessment. */
export const MAX_REVIEW_INTERVAL_DAYS = 180
export interface ReviewState {
  review_count: number
  ease_factor: number
  interval_days: number
  consecutive_successes?: number
}

export function calculateSRS(state: ReviewState, quality: number, now = new Date()) {
  if (!Number.isInteger(quality) || quality < 0 || quality > 5) throw new Error('Invalid recall quality')
  if (!Number.isFinite(now.getTime())) throw new Error('Invalid review date')
  const previousStreak = Math.max(0, Math.floor(state.consecutive_successes || 0))
  // Only independently recalled answers (Good/Easy) build a success streak.
  // Total review_count is historical activity, never evidence of retention.
  const consecutive_successes = quality >= 4 ? previousStreak + 1 : 0
  const oldEase = Math.max(1.3, Math.min(3, state.ease_factor || 2.5))
  const ease_factor = Math.round(Math.max(1.3, Math.min(3,
    oldEase + 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)
  )) * 100) / 100
  const interval_days = consecutive_successes <= 1 ? 1
    : consecutive_successes === 2 ? 6
    : Math.min(MAX_REVIEW_INTERVAL_DAYS, Math.max(1, Math.round((state.interval_days || 1) * oldEase)))
  return {
    review_count: Math.max(0, Math.floor(state.review_count || 0)) + 1,
    consecutive_successes,
    ease_factor,
    interval_days,
    next_review_at: new Date(now.getTime() + interval_days * 86_400_000).toISOString(),
    // Keep maintenance reviews due even after this threshold.
    mastered: consecutive_successes >= 5,
  }
}
