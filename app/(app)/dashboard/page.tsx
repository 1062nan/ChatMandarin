import Link from 'next/link'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { Mic, ClipboardList, BookOpen, TrendingUp, Flame, Target } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

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

  // 获取最近对话
  const { data: recentConversations } = await supabase
    .from('conversations')
    .select('*')
    .order('started_at', { ascending: false })
    .limit(5)

  // 获取待复习错题数
  const { count: pendingMistakes } = await supabase
    .from('mistakes')
    .select('*', { count: 'exact', head: true })
    .lte('next_review_at', new Date().toISOString())
    .eq('mastered', false)

  // 获取场景列表
  const { data: scenarios } = await supabase
    .from('scenarios')
    .select('*')
    .eq('is_active', true)
    .order('sort_order')

  const hskLevel = profile?.hsk_level || 1
  const totalConv = profile?.total_conversations || 0
  const streak = profile?.current_streak || 0

  // 计算最近 10 次对话的平均分
  const { data: scoredConvs } = await supabase
    .from('conversations')
    .select('avg_pronunciation, avg_grammar, avg_fluency, avg_word_choice')
    .not('avg_pronunciation', 'is', null)
    .order('started_at', { ascending: false })
    .limit(10)

  const calcAvg = (field: string): number | null => {
    if (!scoredConvs || scoredConvs.length === 0) return null
    const valid = scoredConvs.filter((c: any) => c[field] !== null)
    if (valid.length === 0) return null
    return Math.round(valid.reduce((sum: number, c: any) => sum + c[field], 0) / valid.length)
  }

  const avgPron = calcAvg('avg_pronunciation')
  const avgGrammar = calcAvg('avg_grammar')

  return (
    <div className="space-y-8">
      {/* Greeting */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          你好{profile?.display_name ? `，${profile.display_name}` : ''}！
        </h1>
        <p className="mt-1 text-muted-foreground">
          HSK {hskLevel} · {totalConv} conversations · Streak: {streak} days
        </p>
      </div>

      {/* Progress Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pronunciation</CardTitle>
            <Mic className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{avgPron ? `${avgPron}%` : '—'}</div>
            <p className="text-xs text-muted-foreground">{avgPron ? 'Last 10 sessions' : 'Start practicing'}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Grammar</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{avgGrammar ? `${avgGrammar}%` : '—'}</div>
            <p className="text-xs text-muted-foreground">{avgGrammar ? 'Last 10 sessions' : 'Start practicing'}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Streak</CardTitle>
            <Flame className="h-4 w-4 text-vermilion" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{streak}</div>
            <p className="text-xs text-muted-foreground">days in a row</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Mistakes to review</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingMistakes || 0}</div>
            <Link href="/mistakes" className="text-xs text-vermilion hover:underline">
              Review now →
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Recommended Actions */}
      <div>
        <h2 className="mb-4 text-lg font-semibold">⚡ Today&apos;s recommendations</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {scenarios?.slice(0, 3).map((scenario) => (
            <Link key={scenario.id} href={`/conversation/${scenario.id}`}>
              <Card className="cursor-pointer transition-shadow hover:shadow-md">
                <CardContent className="p-5">
                  <div className="mb-2 flex items-center gap-2">
                    <Mic className="h-4 w-4 text-vermilion" />
                    <span className="text-xs font-medium text-muted-foreground">
                      HSK {(scenario.recommended_hsk as number[]).join('/')}
                    </span>
                  </div>
                  <h3 className="font-semibold">{(scenario.name as { en: string }).en}</h3>
                  <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                    {(scenario.description as { en: string }).en}
                  </p>
                  <p className="mt-3 text-xs text-muted-foreground">
                    ~{scenario.duration_minutes} min
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}

          <Link href="/hskk">
            <Card className="cursor-pointer border-vermilion/30 transition-shadow hover:shadow-md">
              <CardContent className="p-5">
                <div className="mb-2 flex items-center gap-2">
                  <ClipboardList className="h-4 w-4 text-vermilion" />
                  <span className="text-xs font-medium text-vermilion">NEW</span>
                </div>
                <h3 className="font-semibold">HSKK Mock Test</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Full oral exam simulation with AI scoring
                </p>
                <p className="mt-3 text-xs text-muted-foreground">~15 min</p>
              </CardContent>
            </Card>
          </Link>
        </div>
      </div>

      {/* Recent Activity */}
      {recentConversations && recentConversations.length > 0 && (
        <div>
          <h2 className="mb-4 text-lg font-semibold">📈 Recent activity</h2>
          <Card>
            <CardContent className="divide-y p-0">
              {recentConversations.map((conv) => (
                <div key={conv.id} className="flex items-center justify-between p-4">
                  <div>
                    <p className="font-medium capitalize">{conv.scenario}</p>
                    <p className="text-sm text-muted-foreground">
                      HSK {conv.hsk_level} · {conv.total_turns} turns
                    </p>
                  </div>
                  <div className="text-right text-sm text-muted-foreground">
                    {new Date(conv.started_at).toLocaleDateString()}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
