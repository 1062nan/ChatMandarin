import type { FocusPreference,SpeakingAvailability } from '@/lib/learning/focus'
import type { PathwayCard } from './pathway'
import type { GuidedLessonPlan } from './daily-plan'
export type CorrectionSchedule =
  | { status:'unavailable' }
  | { status:'known'; dueCount:number; hasMoreDue:boolean; earliestDueAt:string|null; nextReviewAt:string|null; incomplete:boolean }
export type DailyAction =
  | { kind:'lesson'; lessonId:string; intent:'recall'|'learn'|'revisit' }
  | { kind:'corrections'; intent:'recall'|'scheduled'; count:number; hasMore:boolean; at:string }
  | { kind:'speaking';availability:Extract<SpeakingAvailability,{status:'available'}> }
  | { kind:'check' }
export interface DailySessionPlan { action:DailyAction; unknown:boolean; checkedAt:string; nextRefreshAt:string|null; speakingNotice?:Exclude<SpeakingAvailability,{status:'available'}> }

/** The server passes one instant for all sources. No browser-clock due decisions. */
export function planDailySession(cards:PathwayCard[],corrections:CorrectionSchedule,now:Date,focus?:{preference:FocusPreference;speaking:SpeakingAvailability|null}):DailySessionPlan {
  const unknown=corrections.status==='unavailable'||corrections.incomplete||cards.some(card=>card.plan.status==='unavailable')
  const due:{action:DailyAction;at:string}[]=[]
  const future:{action:DailyAction;at:string}[]=[]
  // Stable equal-deadline tie: correction batch, then intended course order.
  if(corrections.status==='known') {
    if(corrections.dueCount>0 && corrections.earliestDueAt) due.push({action:{kind:'corrections',intent:'recall',count:corrections.dueCount,hasMore:corrections.hasMoreDue,at:corrections.earliestDueAt},at:corrections.earliestDueAt})
    if(corrections.nextReviewAt) future.push({action:{kind:'corrections',intent:'scheduled',count:0,hasMore:false,at:corrections.nextReviewAt},at:corrections.nextReviewAt})
  }
  for(const card of cards) {
    if(card.plan.status==='due') due.push({action:{kind:'lesson',lessonId:card.id,intent:'recall'},at:card.plan.nextReviewAt})
    if(card.plan.status==='scheduled') future.push({action:{kind:'lesson',lessonId:card.id,intent:'revisit'},at:card.plan.nextReviewAt})
  }
  const chronological=(a:{at:string},b:{at:string})=>Date.parse(a.at)-Date.parse(b.at)
  due.sort(chronological);future.sort(chronological)
  const nextNew=cards.find(card=>card.plan.status==='new')
  const speaking=focus?.preference.status==='known'&&focus.preference.focus==='speaking'?focus.speaking:null
  const speakingAction:DailyAction|null=speaking?.status==='available'?{kind:'speaking',availability:speaking}:null
  const action:DailyAction=due[0]?.action||(unknown?{kind:'check'}:speakingAction|| (nextNew?{kind:'lesson',lessonId:nextNew.id,intent:'learn'}:future[0]?.action||{kind:'check'}))
  const nextRefreshAt=focus?.preference.focus==='speaking'?new Date(Math.min(Date.parse(future[0]?.at||'')||Infinity,now.getTime()+60_000)).toISOString():future[0]?.at||null
  return {action,unknown,checkedAt:now.toISOString(),nextRefreshAt,...(speaking&&speaking.status!=='available'?{speakingNotice:speaking}:{})}
}
export function dailySessionRefreshPlan(plan:DailySessionPlan):GuidedLessonPlan {
  return plan.nextRefreshAt?{status:'scheduled',checkedAt:plan.checkedAt,nextReviewAt:plan.nextRefreshAt}:{status:'new',checkedAt:plan.checkedAt}
}
