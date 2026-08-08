'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { toast } from 'sonner'
import { Mic, MicOff, Loader2, Volume2, ChevronRight, RotateCcw, Check, X } from 'lucide-react'
import { AudioRecorder } from '@/lib/audio/wav-encoder'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils/cn'
import { MicPermissionBanner } from '@/components/audio/mic-permission-banner'

interface Sentence {
  id: string
  text_zh: string
  text_pinyin: string
  text_en: string
  hsk_level: number
  category: string
}

interface ScoreResult {
  transcript: string
  original: string
  pronunciation_score: number
  tone_score: number
  fluency_score: number
  char_comparison: Array<{ char: string; userSaid: string; correct: boolean }>
  errors: any[]
}

export function ShadowingClient({ sentences, ttsVoice }: { sentences: Sentence[]; ttsVoice: string }) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isRecording, setIsRecording] = useState(false)
  const [audioLevel, setAudioLevel] = useState(0)
  const [processing, setProcessing] = useState(false)
  const [demoLoading, setDemoLoading] = useState(false)
  const [score, setScore] = useState<ScoreResult | null>(null)
  const [audioRecorder] = useState(() => new AudioRecorder())
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const current = sentences[currentIndex]

  useEffect(() => {
    audioRecorder.onAudioLevel = setAudioLevel
    return () => audioRecorder.cancel()
  }, [audioRecorder])

  const playDemo = useCallback(async () => {
    if (!current) return
    setDemoLoading(true)
    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: current.text_zh, voice_type: ttsVoice })
      })
      if (!res.ok) throw new Error('TTS failed')
      const { audio } = await res.json()
      if (audio && audioRef.current) {
        audioRef.current.src = `data:audio/mp3;base64,${audio}`
        audioRef.current.play()
      }
    } catch {
      toast.error('Failed to play demo')
    } finally {
      setDemoLoading(false)
    }
  }, [current, ttsVoice])

  const startRecording = useCallback(async () => {
    try {
      await audioRecorder.start()
      setIsRecording(true)
    } catch {
      toast.error('Microphone access denied')
    }
  }, [audioRecorder])

  const stopAndScore = useCallback(async () => {
    const result = await audioRecorder.stop()
    setIsRecording(false)
    if (!result || result.blob.size < 1000 || result.duration < 0.3) {
      toast.error('录音太短或没收到声音，请检查麦克风权限后重试')
      return
    }

    setProcessing(true)
    try {
      const formData = new FormData()
      formData.append('audio', result.blob, 'recording.wav')
      formData.append('sentence_id', current.id)
      formData.append('original_text', current.text_zh)

      const res = await fetch('/api/shadowing/score', { method: 'POST', body: formData })
      if (!res.ok) throw new Error('Scoring failed')
      const data: ScoreResult = await res.json()
      setScore(data)
    } catch {
      toast.error('Failed to score')
    } finally {
      setProcessing(false)
    }
  }, [audioRecorder, current])

  const nextSentence = useCallback(() => {
    setScore(null)
    if (currentIndex < sentences.length - 1) {
      setCurrentIndex(prev => prev + 1)
    } else {
      toast.success('All sentences completed!')
    }
  }, [currentIndex, sentences.length])

  const retrySentence = useCallback(() => {
    setScore(null)
  }, [])

  if (!current) {
    return (
      <div className="mx-auto max-w-2xl py-20 text-center">
        <p className="text-muted-foreground">No sentences available. Try changing your HSK level in settings.</p>
      </div>
    )
  }

  const avgScore = score
    ? Math.round((score.pronunciation_score + score.tone_score + score.fluency_score) / 3)
    : 0

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <audio ref={audioRef} />

      <MicPermissionBanner />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">影子跟读</h1>
          <p className="text-sm text-muted-foreground">Shadowing Practice</p>
        </div>
        <span className="text-sm text-muted-foreground">
          {currentIndex + 1} / {sentences.length}
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-vermilion transition-all" style={{ width: `${((currentIndex + (score ? 1 : 0)) / sentences.length) * 100}%` }} />
      </div>

      {/* Sentence card */}
      <Card>
        <CardContent className="p-6">
          {/* Chinese text */}
          <div className="mb-4 text-center">
            <p className="cn-font text-2xl leading-relaxed">{current.text_zh}</p>
            <p className="mt-2 text-sm text-muted-foreground italic">{current.text_pinyin}</p>
            <p className="mt-1 text-sm text-muted-foreground">{current.text_en}</p>
          </div>

          {/* Tags */}
          <div className="mb-4 flex justify-center gap-2">
            <span className="rounded-full bg-vermilion/10 px-2 py-0.5 text-xs font-medium text-vermilion">HSK {current.hsk_level}</span>
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground capitalize">{current.category}</span>
          </div>

          {/* Demo play button */}
          <div className="flex justify-center">
            <Button variant="outline" size="sm" onClick={playDemo} disabled={demoLoading || isRecording}>
              {demoLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Volume2 className="h-4 w-4" />}
              Play demo
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Score result */}
      {score && (
        <Card className="animate-fade-in">
          <CardContent className="p-6">
            <div className="mb-4 text-center">
              <div className={cn('text-4xl font-bold', avgScore >= 85 ? 'text-jade' : avgScore >= 70 ? 'text-gold' : 'text-vermilion')}>
                {avgScore}<span className="text-lg text-muted-foreground">/100</span>
              </div>
            </div>

            {/* 3 scores */}
            <div className="mb-4 grid grid-cols-3 gap-3">
              {[
                { label: 'Pronunciation', value: score.pronunciation_score },
                { label: 'Tone', value: score.tone_score },
                { label: 'Fluency', value: score.fluency_score }
              ].map(s => (
                <div key={s.label} className="text-center">
                  <div className="mx-auto mb-1 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div className={cn('h-full rounded-full', s.value >= 85 ? 'bg-jade' : s.value >= 70 ? 'bg-gold' : 'bg-vermilion')} style={{ width: `${s.value}%` }} />
                  </div>
                  <div className="text-lg font-bold">{s.value}</div>
                  <div className="text-xs text-muted-foreground">{s.label}</div>
                </div>
              ))}
            </div>

            {/* Char comparison */}
            <div className="flex flex-wrap justify-center gap-1 border-t pt-4">
              {score.char_comparison.map((c, i) => (
                <span key={i} className={cn('cn-font text-xl', c.correct ? 'text-jade' : c.userSaid === '_' ? 'text-muted-foreground/30' : 'text-vermilion line-through')}>
                  {c.char}
                </span>
              ))}
            </div>

            {/* Transcript */}
            <div className="mt-4 rounded-lg bg-muted/50 p-3 text-center">
              <p className="text-xs text-muted-foreground">You said:</p>
              <p className="cn-font text-sm">{score.transcript}</p>
            </div>

            {/* Actions */}
            <div className="mt-4 flex justify-center gap-3">
              <Button variant="outline" size="sm" onClick={retrySentence}>
                <RotateCcw className="h-4 w-4" /> Retry
              </Button>
              <Button variant="primary" size="sm" onClick={nextSentence}>
                Next <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Record button */}
      {!score && !processing && (
        <div className="flex flex-col items-center gap-3">
          {isRecording && (
            <div className="flex h-8 items-center gap-1">
              {[...Array(20)].map((_, i) => (
                <div key={i} className="w-1 rounded-full bg-vermilion transition-all"
                  style={{ height: `${Math.max(4, Math.min(32, audioLevel * 40 * (1 - Math.abs(i - 10) / 10)))}px` }} />
              ))}
            </div>
          )}
          <button
            onClick={isRecording ? stopAndScore : startRecording}
            className={cn(
              'flex h-16 w-16 items-center justify-center rounded-full shadow-lg transition-all',
              isRecording ? 'scale-110 animate-pulse bg-vermilion-deep text-white' : 'bg-vermilion text-white hover:scale-105'
            )}
          >
            {isRecording ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
          </button>
          <p className="text-sm text-muted-foreground">
            {isRecording ? 'Click to stop and score' : 'Click to record your repetition'}
          </p>
        </div>
      )}

      {/* Processing */}
      {processing && (
        <div className="flex flex-col items-center gap-3 py-8">
          <Loader2 className="h-8 w-8 animate-spin text-vermilion" />
          <p className="text-sm text-muted-foreground">Scoring your pronunciation...</p>
        </div>
      )}
    </div>
  )
}
