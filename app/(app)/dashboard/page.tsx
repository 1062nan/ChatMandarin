import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getLearningPath } from '@/lib/db/learning-path'
import { JourneyView } from './journey-view'

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
  const { units, progress, recommendation } = await getLearningPath(profile.id, hskLevel)

  // 获取进度数组
  const progressArr = Array.from(progress.values()).map(p => ({
    unit_id: p.unit_id,
    status: p.status,
    best_score: p.best_score
  }))

  // 最近对话
  const { data: recentConvs } = await supabase
    .from('conversations')
    .select('scenario, hsk_level, started_at, total_turns, avg_pronunciation')
    .order('started_at', { ascending: false })
    .limit(3)

  // 错题数
  const { count: pendingMistakes } = await supabase
    .from('mistakes')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', profile.id)
    .lte('next_review_at', new Date().toISOString())
    .eq('mastered', false)

  return (
    <div className="space-y-8">
      {/* 问候 */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          你好{profile.display_name ? `，${profile.display_name}` : ''}！
        </h1>
        <p className="mt-1 text-muted-foreground">
          🔥 {streak} 天连续学习 · {totalConv} 次对话练习
          {pendingMistakes ? ` · ${pendingMistakes} 个错题待复习` : ''}
        </p>
      </div>

      {/* 推荐提示 */}
      {recommendation && (
        <div className="rounded-lg border border-vermilion/30 bg-vermilion/5 p-4">
          <p className="text-sm font-medium">{recommendation.reason}</p>
        </div>
      )}

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
                    {conv.avg_pronunciation ? ` · ${Math.round(conv.avg_pronunciation)}%` : ''}
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
