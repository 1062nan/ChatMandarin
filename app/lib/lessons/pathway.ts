import { LEARN_TASKS as restaurantLearn, REVIEW_TASKS as restaurantReview } from './restaurant'
import { LEARN_TASKS as meetingLearn, REVIEW_TASKS as meetingReview } from './meeting-time'
import { GUIDED_LESSONS, guidedLearningQueue, type GuidedLessonCard, type GuidedLessonPlan } from './daily-plan'

/** Read-only evidence, not proficiency. The server reduces JSONB to these public fields. */
export type PracticeEvidence =
  | { kind:'not-started' }
  | { kind:'unavailable' }
  | { kind:'practice-saved' | 'recall-recorded'; reviewCount:number; latest?: { activity:'practice' | 'recall'; matched:number; unaided:number; total:number } }
export interface LessonProgressEvidence {
  lesson_id:string
  next_review_at:string
  review_count:unknown
  last_summary:unknown
}
export type PathwayCard = GuidedLessonCard & { evidence:PracticeEvidence }
const lessonTasks:Record<string,{learn:readonly {id:string}[];review:readonly {id:string}[]}>={
  'restaurant-order-v1':{learn:restaurantLearn,review:restaurantReview},
  'meeting-time-v1':{learn:meetingLearn,review:meetingReview},
}
const integer=(value:unknown):value is number => typeof value==='number' && Number.isSafeInteger(value) && value>=0

export function practiceEvidence(progress:LessonProgressEvidence|null, plan:GuidedLessonPlan):PracticeEvidence {
  if(plan.status==='unavailable') return {kind:'unavailable'}
  if(!progress) return {kind:'not-started'}
  if(!integer(progress.review_count)) return {kind:'unavailable'}
  const reviewed=progress.review_count>0
  const evidence:PracticeEvidence={kind:reviewed?'recall-recorded':'practice-saved',reviewCount:progress.review_count}
  const summary=progress.last_summary
  if(!summary || typeof summary!=='object' || Array.isArray(summary)) return evidence
  const value=summary as Record<string,unknown>
  // Legacy rows have no mode. review_count is durable; a repeat lesson never replaces its saved review.
  const expectedMode=reviewed?'review':'learn'
  if(value.mode!==undefined && value.mode!==expectedMode) return evidence
  const expectedTasks=lessonTasks[progress.lesson_id]?.[expectedMode]
  if(!expectedTasks) return {kind:'unavailable'}
  const expectedTotal=expectedTasks.length
  if(!integer(value.matched)||!integer(value.unaided)||value.total!==expectedTotal||value.unaided>value.matched||value.matched>expectedTotal) return evidence
  if(!Array.isArray(value.outcomes)||value.outcomes.length!==expectedTotal) return evidence
  const outcomes=value.outcomes as Record<string,unknown>[]
  if(outcomes.some(outcome=>!outcome || typeof outcome.id!=='string' || !expectedTasks.some(task=>task.id===outcome.id) || typeof outcome.matched!=='boolean' || typeof outcome.unaided!=='boolean' || (outcome.unaided && !outcome.matched))) return evidence
  if(new Set(outcomes.map(outcome=>outcome.id)).size!==expectedTotal || outcomes.filter(outcome=>outcome.matched).length!==value.matched || outcomes.filter(outcome=>outcome.unaided).length!==value.unaided) return evidence
  evidence.latest={activity:reviewed?'recall':'practice',matched:value.matched,unaided:value.unaided,total:expectedTotal}
  return evidence
}

export function guidedPathway(progress:LessonProgressEvidence[]|null, unavailable:boolean, now:Date):PathwayCard[] {
  return guidedLearningQueue(progress,unavailable,now).map(card=>({...card,evidence:practiceEvidence(progress?.find(row=>row.lesson_id===card.id)||null,card.plan)}))
}

/** Keep the course map stable while the recommended action follows the due queue. */
export function pathwayCourseOrder(cards:PathwayCard[]) {
  return GUIDED_LESSONS.flatMap(lesson=>cards.filter(card=>card.id===lesson.id))
}

/** One watcher follows the earliest future deadline, even when a different lesson is already due. */
export function pathwayRefreshPlan(cards:PathwayCard[]):GuidedLessonPlan|null {
  const scheduled=cards.map(card=>card.plan).filter((plan):plan is Extract<GuidedLessonPlan,{status:'due'|'scheduled'}>=>plan.status==='scheduled')
  return scheduled.sort((a,b)=>Date.parse(a.nextReviewAt)-Date.parse(b.nextReviewAt))[0]||cards[0]?.plan||null
}
