import Link from 'next/link'
import type { DailySessionPlan } from '@/lib/lessons/daily-session'
import type { PathwayCard } from '@/lib/lessons/pathway'
import { GuidedPlanDetails,ScheduleTime } from './daily-guided-plan'
export function DailySessionAction({plan,cards,refreshing,onRefresh}:{plan:DailySessionPlan;cards:PathwayCard[];refreshing:boolean;onRefresh:()=>void}) {
  const action=plan.action
  const lesson=action.kind==='lesson'?cards.find(card=>card.id===action.lessonId):undefined
  return <div className="space-y-3">
    {plan.unknown && <p role="status" className="rounded-lg border p-3 text-sm">Some review schedules could not be confirmed. This is only the next known step; check schedules before assuming no reviews are due.</p>}
    {lesson ? <GuidedPlanDetails plan={lesson.plan} lesson={lesson} refreshing={refreshing} onRefresh={onRefresh} /> :
      <section aria-labelledby="daily-session-action-title" className="space-y-3 rounded-lg border border-jade/30 bg-jade/5 p-5">
        <h3 id="daily-session-action-title" className="text-lg font-semibold">{action.kind==='corrections'&&action.intent==='recall'?'先回忆，再继续 · Recall before moving on':'今日下一步 · Your next step'}</h3>
        {action.kind==='corrections' ? <>
          <h4 className="font-medium">对话纠错回忆 · Conversation correction recall</h4>
          {action.intent==='recall'?<p className="text-sm">{action.hasMore?'At least ':''}{action.count} correction {action.count===1?'card is':'cards are'} due. Start a batch of up to 10. Recall before revealing corrections; other due work remains available afterward.</p>:<p className="text-sm">Next correction recall: <ScheduleTime value={action.at} />. You can view the schedule now; recall is not due yet.</p>}
          <Link className="inline-block font-medium text-vermilion underline" href="/mistakes">{action.intent==='recall'?'开始纠错回忆 / Open correction recall':'查看复习安排 / View review schedule'}</Link>
        </>:<p className="text-sm">We cannot confirm your next learning step. A missing schedule is not the same as no reviews due; please retry.</p>}
        <button disabled={refreshing} onClick={onRefresh} className="block min-h-10 text-sm underline">{refreshing?'Checking…':'刷新安排 / Check schedule'}</button>
      </section>}
  </div>
}
