'use client'

import { useState, useCallback } from 'react'
import { toast } from 'sonner'
import { Loader2, Eye, Check, X, RefreshCw, Sparkles } from 'lucide-react'
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
  const [reviewing, setReviewing] = useState(false)
  const [results, setResults] = useState<{ remembered: number; total: number }>({ remembered: 0, total: 0 })

  const current = mistakes[currentIndex]

  const handleReveal = useCallback(() => {
    setCardState('revealed')
  }, [])

  const handleRate = useCallback(async (quality: number) => {
    if (!current) return
    setReviewing(true)

    try {
      const res = await fetch('/api/mistakes/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mistake_id: current.id, quality })
      })

      if (!res.ok) throw new Error('Review failed')

      setResults(prev => ({
        remembered: prev.remembered + (quality >= 3 ? 1 : 0),
        total: prev.total + 1
      }))

      if (currentIndex < mistakes.length - 1) {
        setCurrentIndex(prev => prev + 1)
        setCardState('question')
      } else {
        setCardState('done')
      }
    } catch (err) {
      toast.error('Failed to save review')
    } finally {
      setReviewing(false)
    }
  }, [current, currentIndex, mistakes.length])

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
            Remembered {results.remembered} correctly ({pct}%).
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
                <p className="mb-3 text-center text-sm text-muted-foreground">How well did you remember?</p>
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
                Try to remember the correct way to say this.
              </p>
              <Button variant="outline" size="lg" onClick={handleReveal}>
                <Eye className="h-4 w-4" />
                Show answer
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 跳过 */}
      <div className="text-center">
        <Button variant="ghost" size="sm" onClick={onComplete}>
          End review session
        </Button>
      </div>
    </div>
  )
}
