'use client'

import { useState, useCallback, useRef } from 'react'
import { toast } from 'sonner'
import { Eye, Check, X, Sparkles } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils/cn'
import type { Mistake } from '@/lib/db/types'

interface ReviewSessionProps {
  mistakes: Mistake[]
  onComplete: () => void
}

type CardState = 'question' | 'revealed' | 'done'

export function ReviewSession({ mistakes, onComplete }: ReviewSessionProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [cardState, setCardState] = useState<CardState>('question')
  const pending = useRef(false)
  const [attempt, setAttempt] = useState('')
  const [saveError, setSaveError] = useState<string | null>(null)
  const [nextReviewAt, setNextReviewAt] = useState<string | null>(null)
  const [reviewing, setReviewing] = useState(false)
  const [results, setResults] = useState<{ remembered: number; total: number }>({ remembered: 0, total: 0 })

  const current = mistakes[currentIndex]

  const handleReveal = useCallback(() => {
    setCardState('revealed')
  }, [])

  const handleRate = useCallback(async (quality: number) => {
    if (!current || pending.current || cardState !== 'revealed') return
    pending.current = true
    setSaveError(null)
    setReviewing(true)

    try {
      const res = await fetch('/api/mistakes/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mistake_id: current.id, quality, expected_review_count: current.review_count || 0 })
      })

      const data = await res.json()
      if (!res.ok) throw new Error(res.status === 409 ? 'This card was already reviewed or is not due. Return to the list to refresh.' : 'Your review was not saved. Please try again.')
      setNextReviewAt(prev => !prev || data.next_review_at < prev ? data.next_review_at : prev)

      setResults(prev => ({
        remembered: prev.remembered + (quality >= 4 ? 1 : 0),
        total: prev.total + 1
      }))

      if (currentIndex < mistakes.length - 1) {
        setCurrentIndex(prev => prev + 1)
        setCardState('question')
        setAttempt('')
      } else {
        setCardState('done')
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Your review was not saved. Please try again.'
      setSaveError(message)
      toast.error(message)
    } finally {
      pending.current = false
      setReviewing(false)
    }
  }, [current, currentIndex, mistakes.length, cardState])

  // 完成
  if (cardState === 'done' || !current) {
    const pct = results.total > 0 ? Math.round((results.remembered / results.total) * 100) : 0
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-jade/10">
            <Sparkles className="h-8 w-8 text-jade" />
          </div>
          <h2 className="mb-2 text-2xl font-bold">Review Complete!</h2>
          <p className="mb-4 text-muted-foreground">
            You reviewed {results.total} mistakes.<br />
            You rated {results.remembered} as independently recalled ({pct}%).
          </p>
          <p className="mb-4 text-sm text-muted-foreground">
            This is self-assessed recall, not a language proficiency score.
            {nextReviewAt && <> Your earliest next review is {new Date(nextReviewAt).toLocaleDateString()}.</>}
          </p>
          <Button variant="primary" onClick={onComplete}>
            Back to Mistakes
          </Button>
        </CardContent>
      </Card>
    )
  }

  const typeColors: Record<string, string> = {
    tone: 'bg-vermilion/10 text-vermilion',
    grammar: 'bg-gold/10 text-gold',
    word: 'bg-blue-100 text-blue-700',
    fluency: 'bg-purple-100 text-purple-700'
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* 进度 */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>Card {currentIndex + 1} of {mistakes.length}</span>
        <span>{Math.round((currentIndex / mistakes.length) * 100)}% complete</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-vermilion transition-all"
          style={{ width: `${(currentIndex / mistakes.length) * 100}%` }}
        />
      </div>

      {/* 错题卡片 */}
      <Card className="min-h-[300px]">
        <CardContent className="p-8">
          {/* 类型标签 */}
          <div className="mb-6 flex items-center gap-2">
            <span className={cn('rounded-full px-3 py-1 text-xs font-medium capitalize', typeColors[current.type])}>
              {current.type}
            </span>
            {current.hsk_level && (
              <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
                HSK {current.hsk_level}
              </span>
            )}
            {current.scenario && (
              <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground capitalize">
                {current.scenario}
              </span>
            )}
          </div>

          {/* 你说的 */}
          <div className="mb-6">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">You said</p>
            <p className="cn-font text-xl text-vermilion line-through">{current.user_said}</p>
          </div>

          {/* 正确答案（翻牌后显示） */}
          {cardState === 'revealed' ? (
            <>
              {attempt.trim() && <div className="mb-4 rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Your recalled answer (not saved)</p>
                <p lang="zh" className="mt-1 whitespace-pre-wrap">{attempt}</p>
              </div>}
              <div className="mb-6 animate-fade-in">
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Correct</p>
                <p className="cn-font text-2xl font-bold text-jade">{current.correct}</p>
              </div>

              {current.explanation && (
                <div className="mb-6 rounded-lg bg-muted/50 p-4">
                  <p className="text-sm text-muted-foreground">{current.explanation}</p>
                </div>
              )}

              {/* 回忆评分 */}
              <div>
                <p className="mb-3 text-center text-sm text-muted-foreground">Rate your recall before you saw the answer. Using the answer is practice, not independent recall.</p>
                <div className="grid grid-cols-4 gap-2">
                  <button
                    onClick={() => handleRate(0)}
                    disabled={reviewing}
                    className="flex flex-col items-center gap-1 rounded-lg border border-vermilion/30 p-3 text-vermilion transition-colors hover:bg-vermilion/10"
                  >
                    <X className="h-5 w-5" />
                    <span className="text-xs font-medium">Forgot</span>
                  </button>
                  <button
                    onClick={() => handleRate(2)}
                    disabled={reviewing}
                    className="flex flex-col items-center gap-1 rounded-lg border border-gold/30 p-3 text-gold transition-colors hover:bg-gold/10"
                  >
                    <span className="text-lg">😕</span>
                    <span className="text-xs font-medium">Hard</span>
                  </button>
                  <button
                    onClick={() => handleRate(4)}
                    disabled={reviewing}
                    className="flex flex-col items-center gap-1 rounded-lg border border-jade/30 p-3 text-jade transition-colors hover:bg-jade/10"
                  >
                    <Check className="h-5 w-5" />
                    <span className="text-xs font-medium">Good</span>
                  </button>
                  <button
                    onClick={() => handleRate(5)}
                    disabled={reviewing}
                    className="flex flex-col items-center gap-1 rounded-lg border border-jade/30 p-3 text-jade transition-colors hover:bg-jade/10"
                  >
                    <Sparkles className="h-5 w-5" />
                    <span className="text-xs font-medium">Easy</span>
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-12">
              <p className="mb-4 text-center text-muted-foreground">
                Correct this sentence from memory. Say it aloud or type your attempt before revealing the answer.
              </p>
              <label htmlFor="recall-attempt" className="mb-2 self-start text-sm">Your attempt (optional, not saved)</label>
              <textarea id="recall-attempt" value={attempt} onChange={event => setAttempt(event.target.value)}
                className="mb-4 min-h-24 w-full rounded-md border bg-background p-3" lang="zh" />
              <Button variant="outline" size="lg" onClick={handleReveal}>
                <Eye className="h-4 w-4" />
                Show answer
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {saveError && <p role="alert" className="text-sm text-vermilion">{saveError}</p>}
      <p className="text-xs text-muted-foreground">Spaced recall: a lapse returns the card to a short interval. Well-reviewed cards still return for maintenance.</p>
      {/* 跳过 */}
      <div className="text-center">
        <Button variant="ghost" size="sm" onClick={onComplete} disabled={reviewing}>
          End review session
        </Button>
      </div>
    </div>
  )
}
