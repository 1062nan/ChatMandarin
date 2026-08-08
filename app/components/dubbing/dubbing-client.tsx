'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Mic, MicOff, Loader2, Volume2, Film, ChevronRight, RotateCcw, Check, Star, Home } from 'lucide-react'
import { AudioRecorder } from '@/lib/audio/wav-encoder'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils/cn'

interface DubLine {
  index: number
  start: number
  end: number
  speaker: string
  text: string
  pinyin: string
  translation: string
  emotion: string
}

interface Clip {
  id: string
  title: string
  category: string
  description: string | null
  duration_seconds: number
  hsk_level: number
  difficulty: string
  lines: DubLine[]
}

type Phase = 'select' | 'practice' | 'perform-ready' | 'performing' | 'perform-result'

export function DubbingClient({ clips, ttsVoice }: { clips: Clip[]; ttsVoice: string }) {
  const router = useRouter()
  const [phase, setPhase] = useState<Phase>('select')
  const [selectedClip, setSelectedClip] = useState<Clip | null>(null)
  const [lineIndex, setLineIndex] = useState(0)
  const [isRecording, setIsRecording] = useState(false)
  const [audioLevel, setAudioLevel] = useState(0)
  const [processing, setProcessing] = useState(false)
  const [demoLoading, setDemoLoading] = useState(false)
  const [score, setScore] = useState<any | null>(null)
  const [lineScores, setLineScores] = useState<any[]>([])
  const [performScore, setPerformScore] = useState<any | null>(null)
  const [audioRecorder] = useState(() => new AudioRecorder())
  const audioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    audioRecorder.onAudioLevel = setAudioLevel
    return () => audioRecorder.cancel()
  }, [audioRecorder])

  const currentLine = selectedClip?.lines[lineIndex]

  // TTS 示范
  const playDemo = useCallback(async (text: string) => {
    setDemoLoading(true)
    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, voice_type: ttsVoice })
      })
      if (!res.ok) throw new Error('TTS failed')
      const { audio } = await res.json()
      if (audio && audioRef.current) {
        audioRef.current.src = `data:audio/mp3;base64,${audio}`
        audioRef.current.play()
      }
    } catch {
      toast.error('Demo playback failed')
    } finally {
      setDemoLoading(false)
    }
  }, [ttsVoice])

  // 录音
  const startRecording = useCallback(async () => {
    try {
      await audioRecorder.start()
      setIsRecording(true)
    } catch {
      toast.error('Microphone access denied')
    }
  }, [audioRecorder])

  // 逐句练习评分
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
      formData.append('audio', result.blob, 'line.wav')
      formData.append('clip_id', selectedClip!.id)
      formData.append('line_index', String(lineIndex))
      formData.append('line_text', currentLine!.text)
      formData.append('expected_emotion', currentLine!.emotion)

      const res = await fetch('/api/dubbing/practice', { method: 'POST', body: formData })
      if (!res.ok) throw new Error('Scoring failed')
      const data = await res.json()
      setScore(data)
      setLineScores(prev => [...prev, { lineIndex, ...data }])
    } catch {
      toast.error('Failed to score')
    } finally {
      setProcessing(false)
    }
  }, [audioRecorder, selectedClip, lineIndex, currentLine])

  // 正式表演
  const stopAndPerform = useCallback(async () => {
    const result = await audioRecorder.stop()
    setIsRecording(false)
    if (!result || result.blob.size < 1000 || result.duration < 0.3) {
      toast.error('录音太短或没收到声音，请检查麦克风权限后重试')
      return
    }

    setProcessing(true)
    try {
      const formData = new FormData()
      formData.append('audio', result.blob, 'performance.wav')
      formData.append('clip_id', selectedClip!.id)

      const res = await fetch('/api/dubbing/perform', { method: 'POST', body: formData })
      if (!res.ok) throw new Error('Performance scoring failed')
      const data = await res.json()
      setPerformScore(data)
      setPhase('perform-result')
    } catch {
      toast.error('Performance scoring failed')
    } finally {
      setProcessing(false)
    }
  }, [audioRecorder, selectedClip])

  const nextLine = () => {
    setScore(null)
    if (selectedClip && lineIndex < selectedClip.lines.length - 1) {
      setLineIndex(prev => prev + 1)
    } else {
      setPhase('perform-ready')
      toast.success('All lines practiced! Ready for full performance.')
    }
  }

  const selectClip = (clip: Clip) => {
    setSelectedClip(clip)
    setLineIndex(0)
    setScore(null)
    setLineScores([])
    setPerformScore(null)
    setPhase('practice')
  }

  const resetAll = () => {
    setPhase('select')
    setSelectedClip(null)
    setLineIndex(0)
    setScore(null)
    setLineScores([])
    setPerformScore(null)
  }

  // ============ 片段选择 ============
  if (phase === 'select') {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="text-center">
          <h1 className="flex items-center justify-center gap-2 text-3xl font-bold tracking-tight">
            <Film className="h-7 w-7 text-vermilion" /> 影视配音
          </h1>
          <p className="mt-2 text-muted-foreground">
            Practice speaking Chinese by dubbing movie-style scenes
          </p>
        </div>

        <div className="grid gap-4">
          {clips.map(clip => (
            <Card key={clip.id} className="cursor-pointer transition-shadow hover:shadow-md" onClick={() => selectClip(clip)}>
              <CardContent className="flex items-center gap-4 p-5">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-vermilion/10">
                  <Film className="h-6 w-6 text-vermilion" />
                </div>
                <div className="flex-1">
                  <h3 className="font-bold">{clip.title}</h3>
                  <p className="text-sm text-muted-foreground">{clip.description}</p>
                  <div className="mt-1 flex gap-2">
                    <span className="rounded-full bg-vermilion/10 px-2 py-0.5 text-xs font-medium text-vermilion">HSK {clip.hsk_level}</span>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs capitalize text-muted-foreground">{clip.difficulty}</span>
                    <span className="text-xs text-muted-foreground">{clip.lines.length} lines · {clip.duration_seconds}s</span>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  // ============ 练习模式 ============
  if (phase === 'practice' && currentLine) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <audio ref={audioRef} />

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold">{selectedClip?.title}</h2>
          </div>
          <span className="text-sm text-muted-foreground">
            Line {lineIndex + 1}/{selectedClip?.lines.length}
          </span>
        </div>

        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-vermilion transition-all"
            style={{ width: `${((lineIndex + (score ? 1 : 0)) / selectedClip!.lines.length) * 100}%` }} />
        </div>

        {/* 台词卡片 */}
        <Card>
          <CardContent className="p-6">
            <div className="mb-4 flex items-center gap-2">
              <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">{currentLine.speaker}</span>
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground capitalize">{currentLine.emotion}</span>
            </div>
            <div className="mb-4 text-center">
              <p className="cn-font text-2xl leading-relaxed">{currentLine.text}</p>
              <p className="mt-2 text-sm italic text-muted-foreground">{currentLine.pinyin}</p>
              <p className="mt-1 text-sm text-muted-foreground">{currentLine.translation}</p>
            </div>
            <div className="flex justify-center">
              <Button variant="outline" size="sm" onClick={() => playDemo(currentLine.text)} disabled={demoLoading || isRecording}>
                {demoLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Volume2 className="h-4 w-4" />}
                Hear AI demo
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* 评分结果 */}
        {score && (
          <Card className="animate-fade-in">
            <CardContent className="p-6">
              <div className="mb-4 text-center">
                <div className={cn('text-4xl font-bold', score.total_score >= 85 ? 'text-jade' : score.total_score >= 70 ? 'text-gold' : 'text-vermilion')}>
                  {score.total_score}<span className="text-lg text-muted-foreground">/100</span>
                </div>
              </div>
              <div className="mb-4 grid grid-cols-3 gap-3">
                {[
                  { label: 'Pronunciation', value: score.pronunciation_score },
                  { label: 'Emotion', value: score.emotion_score },
                  { label: 'Fluency', value: score.fluency_score }
                ].map(s => (
                  <div key={s.label} className="text-center">
                    <div className={cn('text-lg font-bold', s.value >= 85 ? 'text-jade' : s.value >= 70 ? 'text-gold' : 'text-vermilion')}>{s.value}</div>
                    <div className="text-xs text-muted-foreground">{s.label}</div>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap justify-center gap-1 border-t pt-3">
                {score.char_comparison?.map((c: any, i: number) => (
                  <span key={i} className={cn('cn-font text-lg', c.correct ? 'text-jade' : c.userSaid === '_' ? 'text-muted-foreground/30' : 'text-vermilion line-through')}>{c.char}</span>
                ))}
              </div>
              <div className="mt-4 rounded-lg bg-muted/50 p-2 text-center text-sm">
                <span className="text-xs text-muted-foreground">You said: </span>
                <span className="cn-font">{score.transcript}</span>
              </div>
              <div className="mt-4 flex justify-center gap-3">
                <Button variant="outline" size="sm" onClick={() => setScore(null)}><RotateCcw className="h-4 w-4" /> Retry</Button>
                <Button variant="primary" size="sm" onClick={nextLine}>Next <ChevronRight className="h-4 w-4" /></Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 录音按钮 */}
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
            <button onClick={isRecording ? stopAndScore : startRecording}
              className={cn('flex h-16 w-16 items-center justify-center rounded-full shadow-lg transition-all',
                isRecording ? 'scale-110 animate-pulse bg-vermilion-deep text-white' : 'bg-vermilion text-white hover:scale-105')}>
              {isRecording ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
            </button>
            <p className="text-sm text-muted-foreground">{isRecording ? 'Click to stop' : 'Click to dub this line'}</p>
          </div>
        )}
        {processing && (
          <div className="flex flex-col items-center gap-3 py-8">
            <Loader2 className="h-8 w-8 animate-spin text-vermilion" />
            <p className="text-sm text-muted-foreground">Scoring your dub...</p>
          </div>
        )}
      </div>
    )
  }

  // ============ 正式配音准备 ============
  if (phase === 'perform-ready') {
    const avgScore = lineScores.length > 0
      ? Math.round(lineScores.reduce((sum, s) => sum + s.total_score, 0) / lineScores.length)
      : 0

    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <Card>
          <CardContent className="p-8 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-jade/10">
              <Star className="h-8 w-8 text-jade" />
            </div>
            <h2 className="mb-2 text-2xl font-bold">Practice Complete!</h2>
            <p className="mb-4 text-muted-foreground">
              Average practice score: <span className="font-bold text-vermilion">{avgScore}/100</span>
            </p>
            <p className="mb-6 text-sm text-muted-foreground">
              Ready for the full performance? Record the entire scene in one take.
            </p>
            <div className="flex justify-center gap-3">
              <Button variant="outline" onClick={resetAll}>Back</Button>
              <Button variant="primary" size="lg" onClick={() => { setPhase('performing'); setLineIndex(0) }}>
                <Mic className="h-4 w-4" /> Start full performance
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // ============ 正式配音 ============
  if (phase === 'performing' && selectedClip) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <audio ref={audioRef} />
        <h2 className="text-center text-xl font-bold">🎬 {selectedClip.title} — Full Performance</h2>

        {/* 台词列表 */}
        <Card>
          <CardContent className="space-y-3 p-6">
            {selectedClip.lines.map((line, i) => (
              <div key={i} className={cn('rounded-lg p-3 transition-all', i === lineIndex ? 'bg-vermilion/10 ring-2 ring-vermilion' : 'bg-muted/30')}>
                <div className="mb-1 flex items-center gap-2">
                  <span className="text-xs font-medium text-muted-foreground">{line.speaker}</span>
                </div>
                <p className="cn-font text-base">{line.text}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* 录音 */}
        <div className="flex flex-col items-center gap-3">
          {isRecording && (
            <div className="flex h-8 items-center gap-1">
              {[...Array(20)].map((_, i) => (
                <div key={i} className="w-1 rounded-full bg-vermilion transition-all"
                  style={{ height: `${Math.max(4, Math.min(32, audioLevel * 40 * (1 - Math.abs(i - 10) / 10)))}px` }} />
              ))}
            </div>
          )}
          <button onClick={isRecording ? stopAndPerform : startRecording}
            className={cn('flex h-16 w-16 items-center justify-center rounded-full shadow-lg transition-all',
              isRecording ? 'scale-110 animate-pulse bg-vermilion-deep text-white' : 'bg-vermilion text-white hover:scale-105')}>
            {isRecording ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
          </button>
          <p className="text-sm text-muted-foreground">
            {isRecording ? 'Recording... Click to finish' : 'Click to start full dub'}
          </p>
        </div>
        {processing && (
          <div className="flex flex-col items-center gap-3 py-8">
            <Loader2 className="h-8 w-8 animate-spin text-vermilion" />
            <p className="text-sm text-muted-foreground">Scoring full performance...</p>
          </div>
        )}
      </div>
    )
  }

  // ============ 表演结果 ============
  if (phase === 'perform-result' && performScore) {
    const s = performScore.scores
    const dims = [
      { label: 'Pronunciation', value: s.pronunciation, cn: '发音', weight: '30%' },
      { label: 'Tone', value: s.tone, cn: '声调', weight: '25%' },
      { label: 'Emotion', value: s.emotion, cn: '情感', weight: '20%' },
      { label: 'Rhythm', value: s.rhythm, cn: '节奏', weight: '15%' },
      { label: 'Fluency', value: s.fluency, cn: '流畅', weight: '10%' }
    ]
    const color = (v: number) => v >= 85 ? 'text-jade' : v >= 70 ? 'text-gold' : 'text-vermilion'
    const barColor = (v: number) => v >= 85 ? 'bg-jade' : v >= 70 ? 'bg-gold' : 'bg-vermilion'

    return (
      <div className="mx-auto max-w-2xl space-y-6">
        {/* Total */}
        <Card className={cn('border-2', performScore.total_score >= 80 ? 'border-jade/40 bg-jade/5' : 'border-vermilion/40 bg-vermilion/5')}>
          <CardContent className="p-8 text-center">
            <div className={cn('text-5xl font-bold', color(performScore.total_score))}>
              {performScore.total_score}<span className="text-2xl text-muted-foreground">/100</span>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">{performScore.clip_title}</p>
          </CardContent>
        </Card>

        {/* 5 dimensions */}
        <div className="grid gap-3 sm:grid-cols-5">
          {dims.map(d => (
            <Card key={d.label}>
              <CardContent className="p-3 text-center">
                <div className="mx-auto mb-2 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div className={cn('h-full rounded-full', barColor(d.value))} style={{ width: `${d.value}%` }} />
                </div>
                <div className={cn('text-xl font-bold', color(d.value))}>{d.value}</div>
                <div className="text-xs text-muted-foreground">{d.label}</div>
                <div className="cn-font text-xs text-muted-foreground">{d.cn}</div>
                <div className="text-xs text-muted-foreground">{d.weight}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Transcript */}
        <Card>
          <CardContent className="p-4">
            <p className="mb-1 text-xs font-medium text-muted-foreground">Your transcript</p>
            <p className="cn-font text-sm">{performScore.transcript}</p>
            <p className="mt-2 text-xs text-muted-foreground">
              {performScore.chars_correct}/{performScore.chars_total} characters correct
            </p>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex justify-center gap-3">
          <Button variant="outline" onClick={() => { setPhase('performing'); setPerformScore(null) }}>
            <RotateCcw className="h-4 w-4" /> Retry
          </Button>
          <Button variant="primary" onClick={resetAll}>
            <Film className="h-4 w-4" /> Choose another clip
          </Button>
          <Button variant="ghost" onClick={() => router.push('/dashboard')}>
            <Home className="h-4 w-4" /> Home
          </Button>
        </div>
      </div>
    )
  }

  return null
}
