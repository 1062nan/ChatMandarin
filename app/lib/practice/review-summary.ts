import { collectReviewQueue } from './review-queue'
import type { CorrectionSchedule } from '@/lib/lessons/daily-session'
export interface ReviewSummaryRow { correct:string; explanation:string|null; next_review_at:string|null }
type PageReader=(from:number,to:number)=>Promise<{data:ReviewSummaryRow[]|null;error:unknown}>
/** Only derived counts/dates leave this server read. At most 10 pages of 100 for each of due, upcoming and legacy unscheduled sources. */
export async function collectCorrectionSchedule(duePage:PageReader,upcomingPage:PageReader,now:Date,unscheduledPage:PageReader=async()=>({data:[],error:null})):Promise<CorrectionSchedule> {
  try {
    const [due,upcoming,unscheduled]=await Promise.all([collectReviewQueue(duePage,10),collectReviewQueue(upcomingPage,1),collectReviewQueue(unscheduledPage,1)])
    const dueDates=due.cards.map(row=>typeof row.next_review_at==='string'?Date.parse(row.next_review_at):NaN)
    const futureDates=upcoming.cards.map(row=>typeof row.next_review_at==='string'?Date.parse(row.next_review_at):NaN)
    if(dueDates.some(date=>!Number.isFinite(date)||date>now.getTime())||futureDates.some(date=>!Number.isFinite(date)||date<=now.getTime())) return {status:'unavailable'}
    return {status:'known',dueCount:due.cards.length,hasMoreDue:due.hasMore,earliestDueAt:dueDates.length?new Date(Math.min(...dueDates)).toISOString():null,nextReviewAt:futureDates.length?new Date(Math.min(...futureDates)).toISOString():null,incomplete:(!due.cards.length&&due.hasMore)||(!upcoming.cards.length&&upcoming.hasMore)||unscheduled.cards.length>0||unscheduled.hasMore}
  } catch {return {status:'unavailable'}}
}
