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

// Plain metadata only: no answer matchers cross the server/client boundary.
export const GUIDED_LESSONS = [
  { id:'restaurant-order-v1', slug:'restaurant', title:'点一份简单的餐 · Order a simple meal' },
  { id:'meeting-time-v1', slug:'meeting-time', title:'提议见面时间 · Suggest a meeting time' },
] as const
export type GuidedLessonCard = { id:string; slug:string; title:string; plan:GuidedLessonPlan }
export function guidedLearningQueue(progress: { lesson_id:string; next_review_at:string }[] | null, unavailable:boolean, now:Date): GuidedLessonCard[] {
  const cards=GUIDED_LESSONS.map(lesson=>({...lesson,plan:guidedLessonPlan(progress?.find(row=>row.lesson_id===lesson.id)||null, unavailable, now)}))
  const rank={due:0,unavailable:1,new:2,scheduled:3}
  return cards.sort((a,b)=> {
    const priority=rank[a.plan.status]-rank[b.plan.status]
    if(priority) return priority
    if('nextReviewAt' in a.plan && 'nextReviewAt' in b.plan) return Date.parse(a.plan.nextReviewAt)-Date.parse(b.plan.nextReviewAt)
    return 0
  })
}
