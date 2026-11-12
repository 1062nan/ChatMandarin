'use client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useTransition } from 'react'
import { GuidedPlanDetails, ScheduleTime } from './daily-guided-plan'
import { pathwayCourseOrder, pathwayRefreshPlan, type PathwayCard, type PracticeEvidence } from '@/lib/lessons/pathway'
import { watchGuidedPlan } from '@/lib/lessons/plan-refresh'

export function EvidenceSummary({ evidence }: { evidence:PracticeEvidence }) {
  if(evidence.kind==='unavailable') return <p>练习记录暂不可确认 · Practice record unavailable. Your saved progress has not been reset.</p>
  if(evidence.kind==='not-started') return <p>尚未保存首次练习 · No first practice saved yet.</p>
  return <div className="space-y-1">
    <p>{evidence.kind==='practice-saved'?'首次练习已保存 · Initial practice saved':'延迟回忆已记录 · Delayed recall recorded'}</p>
    {evidence.kind==='practice-saved' ? <p>No delayed recall recorded yet. Return after the interval to check what you remember.</p> : <p>{evidence.reviewCount} saved recall {evidence.reviewCount===1?'attempt':'attempts'}. This count includes attempts with support.</p>}
    {evidence.latest && <p>{evidence.latest.activity==='recall'?'Last saved recall':'Saved initial practice'}: {evidence.latest.matched}/{evidence.latest.total} matched the patterns checked here; {evidence.latest.unaided}/{evidence.latest.total} on the first try without a hint.</p>}
  </div>
}

export function GuidedLearningPath({ cards }: { cards:PathwayCard[] }) {
  const router=useRouter()
  const [refreshing,startTransition]=useTransition()
  const refresh=()=>startTransition(()=>router.refresh())
  useEffect(()=>{router.refresh()},[router])
  useEffect(()=> {
    const plan=pathwayRefreshPlan(cards)
    if(!plan)return
    return watchGuidedPlan(plan,()=>router.refresh(),{
      visibility:document,
      setTimer:(callback,delay)=>window.setTimeout(callback,delay),
      clearTimer:id=>window.clearTimeout(id),
    })
  },[cards,router])
  const next=cards[0]
  const unknown=cards.some(card=>card.plan.status==='unavailable')
  const course=pathwayCourseOrder(cards)
  return <section aria-labelledby="guided-pathway-title" className="space-y-4">
    <header><h2 id="guided-pathway-title" className="text-xl font-semibold">入门学习路线 · Your beginner pathway</h2><p className="mt-2 text-sm text-muted-foreground">先理解和表达，隔一段时间再回忆。Study and try it, then return later to recall it. Two short lessons, with separate recall schedules.</p></header>
    {unknown && <p role="status" className="rounded-lg border p-3 text-sm">Some schedules could not be confirmed. The next step uses only known records; refresh before assuming there is no recall due.</p>}
    {next ? <GuidedPlanDetails plan={next.plan} lesson={next} refreshing={refreshing} onRefresh={refresh} /> : <p role="status">The pathway is unavailable. <button className="underline" onClick={refresh} disabled={refreshing}>Check schedule</button></p>}
    <div className="rounded-lg border p-5">
      <h3 className="font-semibold">练习记录，不是能力认证 · Practice records, not a proficiency assessment</h3>
      <ol className="mt-4 space-y-5">
        {course.map((card,index)=><li key={card.id} className="space-y-2 border-b pb-4 last:border-0 last:pb-0">
          <h4 className="font-medium">{index+1}. {card.title}</h4>
          <div className="space-y-2 text-sm text-muted-foreground"><EvidenceSummary evidence={card.evidence} />
            {card.plan.status==='due' && <p>回忆已到期 · Recall due. Try from memory before revisiting examples.</p>}
            {card.plan.status==='scheduled' && <p>下次回忆 / Next recall: <ScheduleTime value={card.plan.nextReviewAt} />.</p>}
            {card.plan.status==='unavailable' && <p>Schedule unknown. Open the lesson to check; this is not a new-start recommendation.</p>}
          </div>
          <Link className="inline-block min-h-10 py-2 text-sm underline" href={`/learn/${card.slug}`}>查看小课 / View lesson</Link>
        </li>)}
      </ol>
      <p className="mt-4 text-xs text-muted-foreground">A matched answer is limited evidence from a text checker, not mastery or an HSK / HSKK score. Hint use and retries are self-practice indicators. You can revisit either lesson; nothing is locked.</p>
    </div>
  </section>
}
