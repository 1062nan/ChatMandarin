import type { GuidedLessonPlan } from './daily-plan'

interface RefreshEnvironment {
  visibility: { visibilityState: string; addEventListener(type: string, listener: () => void): void; removeEventListener(type: string, listener: () => void): void }
  setTimer(callback: () => void, delay: number): number
  clearTimer(id: number): void
}
/** Timers only request a fresh server plan; they never decide a learner is due. */
export function watchGuidedPlan(plan: GuidedLessonPlan, refresh: () => void, environment: RefreshEnvironment) {
  const checkVisible = () => { if (environment.visibility.visibilityState === 'visible') refresh() }
  environment.visibility.addEventListener('visibilitychange', checkVisible)
  // Bound stale/prefetched snapshots to one minute even if the client clock is wrong.
  // A server refresh supplies a new checkedAt and the component renews this watcher.
  const delay = plan.status === 'scheduled' ? Math.min(60_000, Math.max(1000, Date.parse(plan.nextReviewAt) - Date.parse(plan.checkedAt) + 1000)) : null
  const timer = delay === null ? null : environment.setTimer(checkVisible, delay)
  return () => {
    environment.visibility.removeEventListener('visibilitychange', checkVisible)
    if (timer !== null) environment.clearTimer(timer)
  }
}
