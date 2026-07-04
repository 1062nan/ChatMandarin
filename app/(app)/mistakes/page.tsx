'use client'

import { useState, useEffect } from 'react'
import { getSupabaseClient } from '@/lib/supabase/client'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { BookOpen, CheckCircle2, AlertCircle, Play, RotateCcw } from 'lucide-react'
import type { Mistake } from '@/lib/db/types'
import { ReviewSession } from '@/components/mistakes/review-session'

export const dynamic = 'force-dynamic'

export default function MistakesPage() {
  const supabase = getSupabaseClient()
  const [pendingMistakes, setPendingMistakes] = useState<Mistake[]>([])
  const [masteredMistakes, setMasteredMistakes] = useState<Mistake[]>([])
  const [loading, setLoading] = useState(true)
  const [reviewMode, setReviewMode] = useState(false)

  async function loadMistakes() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('auth_id', user.id)
      .single()

    if (!profile) return

    const [pendingRes, masteredRes] = await Promise.all([
      supabase
        .from('mistakes')
        .select('*')
        .eq('user_id', profile.id)
        .lte('next_review_at', new Date().toISOString())
        .eq('mastered', false)
        .order('next_review_at', { ascending: true }),
      supabase
        .from('mistakes')
        .select('*')
        .eq('user_id', profile.id)
        .eq('mastered', true)
        .order('last_reviewed_at', { ascending: false })
        .limit(20)
    ])

    setPendingMistakes((pendingRes.data || []) as Mistake[])
    setMasteredMistakes((masteredRes.data || []) as Mistake[])
    setLoading(false)
  }

  useEffect(() => {
    loadMistakes()
  }, [])

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl">
        <div className="h-8 w-48 animate-pulse rounded bg-muted" />
        <div className="mt-4 space-y-3">
          <div className="h-20 animate-pulse rounded-lg bg-muted" />
          <div className="h-20 animate-pulse rounded-lg bg-muted" />
        </div>
      </div>
    )
  }

  // 复习模式
  if (reviewMode && pendingMistakes.length > 0) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <h1 className="text-2xl font-bold tracking-tight">Review Session</h1>
        <ReviewSession
          mistakes={pendingMistakes}
          onComplete={() => {
            setReviewMode(false)
            loadMistakes()
          }}
        />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Mistake Journal</h1>
        <p className="mt-1 text-muted-foreground">
          Your personal 错题本 with spaced repetition.
        </p>
      </div>

      {/* 待复习 */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <AlertCircle className="h-5 w-5 text-vermilion" />
            To review ({pendingMistakes.length})
          </h2>
          {pendingMistakes.length > 0 && (
            <Button variant="primary" size="sm" onClick={() => setReviewMode(true)}>
              <Play className="h-3 w-3" />
              Start review ({pendingMistakes.length})
            </Button>
          )}
        </div>

        {pendingMistakes.length > 0 ? (
          <div className="space-y-3">
            {pendingMistakes.map((m) => (
              <MistakeCard key={m.id} mistake={m} />
            ))}
          </div>
        ) : (
          <Card className="border-dashed">
            <CardContent className="py-12 text-center">
              <BookOpen className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
              <p className="text-muted-foreground">
                No mistakes to review. Great job!
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Practice conversations to build your journal.
              </p>
            </CardContent>
          </Card>
        )}
      </section>

      {/* 已掌握 */}
      {masteredMistakes.length > 0 && (
        <section>
          <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
            <CheckCircle2 className="h-5 w-5 text-jade" />
            Mastered ({masteredMistakes.length})
          </h2>
          <Card>
            <CardContent className="divide-y p-0">
              {masteredMistakes.map((m) => (
                <div key={m.id} className="flex items-center justify-between p-3 text-sm">
                  <div>
                    <span className="text-muted-foreground">{m.user_said}</span>
                    <span className="mx-2 text-muted-foreground">→</span>
                    <span className="font-medium text-jade">{m.correct}</span>
                  </div>
                  <span className="text-xs capitalize text-muted-foreground">{m.type}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>
      )}
    </div>
  )
}

function MistakeCard({ mistake }: { mistake: Mistake }) {
  const typeColors: Record<string, string> = {
    tone: 'bg-vermilion/10 text-vermilion',
    grammar: 'bg-gold/10 text-gold',
    word: 'bg-blue-100 text-blue-700',
    fluency: 'bg-purple-100 text-purple-700'
  }

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium capitalize ${typeColors[mistake.type] || 'bg-muted text-muted-foreground'}`}>
              {mistake.type}
            </span>
            <p className="mt-2 text-sm">
              <span className="text-muted-foreground line-through">{mistake.user_said}</span>
            </p>
            <p className="mt-1 text-sm">
              <span className="font-medium text-jade">{mistake.correct}</span>
            </p>
            {mistake.explanation && (
              <p className="mt-2 text-xs text-muted-foreground">{mistake.explanation}</p>
            )}
            <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
              {mistake.hsk_level && <span>HSK {mistake.hsk_level}</span>}
              {mistake.review_count > 0 && <span>Reviewed {mistake.review_count}x</span>}
              <span>Next: {new Date(mistake.next_review_at).toLocaleDateString()}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
