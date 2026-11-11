'use client'

import Link from 'next/link'
import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import type { Mistake } from '@/lib/db/types'
import { ReviewSession } from '@/components/mistakes/review-session'

export const dynamic = 'force-dynamic'

export default function MistakesPage() {
  const [due, setDue] = useState<Mistake[]>([])
  const [upcoming, setUpcoming] = useState<Mistake[]>([])
  const [hasMoreDue, setHasMoreDue] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reviewMode, setReviewMode] = useState(false)

  const loadMistakes = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/mistakes/review', { cache: 'no-store' })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Unable to load reviews. Please retry.')
      setDue(result.due.cards)
      setHasMoreDue(result.due.hasMore)
      setUpcoming(result.upcoming.cards)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load reviews.')
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { void loadMistakes() }, [loadMistakes])
  if (loading) return <p role="status" className="p-6">Loading your review schedule…</p>
  if (error) return <div className="space-y-4"><p role="alert">{error}</p><Button onClick={loadMistakes}>Retry</Button></div>
  if (reviewMode && due.length) return <div className="mx-auto max-w-3xl space-y-6">
    <h1 className="text-2xl font-bold">Recall practice</h1>
    <ReviewSession mistakes={due.slice(0, 10)} onComplete={() => { setReviewMode(false); void loadMistakes() }} />
  </div>
  return <div className="mx-auto max-w-3xl space-y-8">
    <header>
      <h1 className="text-3xl font-bold">Review & remember · 温故知新</h1>
      <p className="mt-2 text-muted-foreground">Recall first, check the correction, then return when it is due. Self-ratings guide your schedule; they are not exam scores.</p>
      <Button variant="outline" size="sm" className="mt-3" onClick={loadMistakes}>Refresh schedule</Button>
    </header>
    <section className="space-y-3">
      <h2 className="text-xl font-semibold">Due now ({due.length}{hasMoreDue ? '+' : ''})</h2>
      {due.length ? <>
        <Button variant="primary" onClick={() => setReviewMode(true)}>Review {Math.min(10, due.length)} cards</Button>
        <p className="text-sm text-muted-foreground">A short batch of up to 10 cards. Remaining cards stay due for another batch.</p>
        {due.map(card => <ReviewCard key={card.id} card={card} />)}
      </> : <Card><CardContent className="space-y-3 p-6">
        <p>{hasMoreDue ? 'Some older records need review before a complete queue can be shown.' : 'No reviews due right now.'}</p>
        <p className="text-sm text-muted-foreground">{upcoming.length ? `Your next review is ${new Date(upcoming[0].next_review_at).toLocaleString()}.` : 'Useful corrections from conversation practice will appear here.'}</p>
        <Link href="/dashboard" className="inline-block font-medium text-vermilion underline">Continue your learning path</Link>
      </CardContent></Card>}
    </section>
    {upcoming.length > 0 && <section className="space-y-3">
      <h2 className="text-xl font-semibold">Scheduled next</h2>
      <p className="text-sm text-muted-foreground">Showing the next {upcoming.length} scheduled cards. Even well-reviewed cards return for maintenance; you do not need to repeat them immediately.</p>
      {upcoming.map(card => <ReviewCard key={card.id} card={card} />)}
    </section>}
  </div>
}

function ReviewCard({ card }: { card: Mistake }) {
  return <Card><CardContent className="space-y-2 p-4">
    <p className="text-xs text-muted-foreground">{card.type} · {card.scenario || 'Practice'}{card.mastered ? ' · Maintenance review' : ''}</p>
    <p lang="zh" className="text-lg">{card.user_said}</p>
    <p className="text-xs text-muted-foreground">Due {new Date(card.next_review_at).toLocaleString()} · {card.consecutive_successes || 0} consecutive independent recalls</p>
    <details><summary className="cursor-pointer text-sm text-vermilion">Study correction (not a review)</summary>
      <p lang="zh" className="mt-2 font-medium">{card.correct}</p>
      {card.explanation && <p className="mt-1 text-sm text-muted-foreground">{card.explanation}</p>}
    </details>
  </CardContent></Card>
}
