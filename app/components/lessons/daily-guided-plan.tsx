'use client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useTransition } from 'react'
import { watchGuidedPlan } from '@/lib/lessons/plan-refresh'
import { GUIDED_LESSONS, type GuidedLessonPlan } from '@/lib/lessons/daily-plan'

export function ScheduleTime({ value }: { value: string }) {
  // The server cannot know the learner's timezone. Keep initial markup identical.
  const [local, setLocal] = useState<string | null>(null)
  useEffect(() => { setLocal(new Date(value).toLocaleString()) }, [value])
  return <time dateTime={value}>{local || `${value.slice(0, 16).replace('T', ' ')} UTC`}</time>
}

export function DailyGuidedPlan({ plan, lesson = GUIDED_LESSONS[0] }: { plan: GuidedLessonPlan; lesson?: { id:string; slug:string; title:string } }) {
  const router = useRouter()
  const [refreshing, startTransition] = useTransition()
  // Cached client navigation must revalidate the schedule immediately on mount.
  useEffect(() => { router.refresh() }, [router])
  useEffect(() => watchGuidedPlan(plan, () => router.refresh(), {
    visibility: document,
    setTimer: (callback, delay) => window.setTimeout(callback, delay),
    clearTimer: id => window.clearTimeout(id),
  }), [router, plan])

  return <GuidedPlanDetails plan={plan} lesson={lesson} refreshing={refreshing} onRefresh={() => startTransition(() => router.refresh())} />
}

export function GuidedPlanDetails({ plan, lesson, refreshing, onRefresh }: {
  plan:GuidedLessonPlan; lesson:{id:string;slug:string;title:string}; refreshing:boolean; onRefresh:()=>void
}) {
  const due = plan.status === 'due'
  const heading = due ? '先回忆，再继续 · Recall before moving on' : '下一步学习 · Your next learning step'
  return <section aria-labelledby={`guided-plan-${lesson.slug}`} className={`rounded-lg border p-5 ${due ? 'border-jade/30 bg-jade/5' : 'border-vermilion/30 bg-vermilion/5'}`}>
    <h2 id={`guided-plan-${lesson.slug}`} className="text-lg font-semibold">{heading}</h2>
    <h3 className="mt-2 font-medium">{lesson.title}</h3>
    {plan.status === 'new' && <p className="mt-2 text-sm text-muted-foreground">先理解例句，再组句、独立表达，最后安排隔天回忆。约 8–10 分钟，无需实时对话。Understand a model, build an answer, then try a new situation. Save the lesson to schedule later recall; audio is optional.</p>}
    {due && <p className="mt-2 text-sm text-muted-foreground">这节小课已到复习时间。先不看例句，试着完成 4 个表达任务；需要时再看提示。先回忆，再核对和换情景运用。Your recall practice is ready: try from memory before using a hint.</p>}
    {plan.status === 'scheduled' && <>
      <p className="mt-2 text-sm">下次回忆 / Next recall: <ScheduleTime value={plan.nextReviewAt} />.</p>
      <p className="mt-2 text-sm text-muted-foreground">现在可以重练，但不会推迟复习时间。间隔后再回忆，才能检查是否还记得。You can revisit the lesson now; return at the scheduled time to try recall.</p>
    </>}
    {plan.status === 'unavailable' && <p role="status" className="mt-2 text-sm">暂时无法确认复习安排，不代表你还没学过。打开小课或刷新重试。Your schedule could not be checked; your saved progress has not been reset.</p>}
    <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-3">
      {plan.status !== 'unavailable' && <Link href={`/learn/${lesson.slug}`} className="font-medium text-vermilion underline">{due ? '开始回忆 / Open recall practice' : plan.status === 'new' ? '开始小课 / Start the lesson' : '打开小课 / Open the lesson'}</Link>}
      <button type="button" disabled={refreshing} onClick={onRefresh} className="min-h-10 text-sm underline disabled:opacity-50">{refreshing ? 'Checking…' : '刷新安排 / Check schedule'}</button>
    </div>
    <p className="mt-3 text-xs text-muted-foreground">这是自我练习安排，不代表已掌握汉语，也不是 HSK / HSKK 考试成绩。Self-practice, not a proficiency certificate or exam score.</p>
  </section>
}
