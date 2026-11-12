import { GuidedLearningPath } from '@/components/lessons/guided-learning-path'
import { guidedPathway } from '@/lib/lessons/pathway'
import { GUIDED_LESSONS } from '@/lib/lessons/daily-plan'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getLearningPath } from '@/lib/db/learning-path'
import { JourneyView } from './journey-view'
import { collectCorrectionSchedule } from '@/lib/practice/review-summary'
import { planDailySession } from '@/lib/lessons/daily-session'

export const metadata = { title: 'Dashboard' }

export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('auth_id', user.id)
    .single()

  if (!profile) return null

  const hskLevel = profile.hsk_level || 1
  const streak = profile.current_streak || 0
  const totalConv = profile.total_conversations || 0

  // 获取学习路径
  const { units, progress } = await getLearningPath(profile.id, hskLevel)

  // 获取进度数组
  const progressArr = Array.from(progress.values()).map(p => ({
    unit_id: p.unit_id,
    status: p.status,
    best_score: p.best_score
  }))

  // 最近对话
  const { data: recentConvs } = await supabase
    .from('conversations')
    .select('scenario, hsk_level, started_at, total_turns')
    .eq('user_id', profile.id)
    .gt('total_turns', 0)
    .order('started_at', { ascending: false })
    .limit(3)

  // One server instant across both recall sources, including bounded legacy-card filtering.
  const planNow=new Date()
  const correctionSchedule=await collectCorrectionSchedule(
    async (from,to)=>await supabase.from('mistakes').select('correct,explanation,next_review_at').eq('user_id',profile.id)
      .lte('next_review_at',planNow.toISOString()).order('next_review_at').order('id').range(from,to),
    async (from,to)=>await supabase.from('mistakes').select('correct,explanation,next_review_at').eq('user_id',profile.id)
      .gt('next_review_at',planNow.toISOString()).order('next_review_at').order('id').range(from,to),
    planNow,
    async (from,to)=>await supabase.from('mistakes').select('correct,explanation,next_review_at').eq('user_id',profile.id)
      .is('next_review_at',null).order('id').range(from,to),
  )

  // Read only the authenticated learner's schedule. A read error is not "not started".
  const { data: guidedProgress, error: guidedError } = await supabase
    .from('lesson_progress')
    .select('lesson_id,next_review_at,review_count,last_summary')
    .eq('user_id', profile.id)
    .in('lesson_id', GUIDED_LESSONS.map(lesson=>lesson.id))
  const dailyPlans = guidedPathway(guidedProgress, !!guidedError, planNow)
  const dailySession=planDailySession(dailyPlans,correctionSchedule,planNow)


  return (
    <div className="space-y-8">
      {/* 问候 */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          你好{profile.display_name ? `，${profile.display_name}` : ''}！
        </h1>
        <p className="mt-1 text-muted-foreground">
          🔥 {streak} 天连续学习 · {totalConv} 次对话练习
          {correctionSchedule.status==='known' && correctionSchedule.dueCount>0 ? ` · ${correctionSchedule.dueCount}${correctionSchedule.hasMoreDue?'+':''} 个错题待复习` : ''}
        </p>
      </div>

      <GuidedLearningPath cards={dailyPlans} dailySession={dailySession} />

      <div><h2 className="text-xl font-semibold">练习库 · Browse more practice</h2><p className="mt-1 text-sm text-muted-foreground">Choose optional practice below. Your recommended next step is shown above; these activities do not replace it.</p></div>

      {/* 学习路径 */}
      <JourneyView
        units={units as any}
        progress={progressArr}
        displayMode={(profile.display_mode as 'journey' | 'exam') || 'journey'}
        profileId={profile.id}
      />

      {/* 最近活动 */}
      {recentConvs && recentConvs.length > 0 && (
        <div>
          <h2 className="mb-3 text-lg font-semibold">最近练习</h2>
          <div className="space-y-2">
            {recentConvs.map((conv: any, i: number) => (
              <div key={i} className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <p className="font-medium capitalize">{conv.scenario}</p>
                  <p className="text-xs text-muted-foreground">
                    HSK {conv.hsk_level} · {conv.total_turns} 轮
                  </p>
                </div>
                <span className="text-xs text-muted-foreground">
                  {new Date(conv.started_at).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
