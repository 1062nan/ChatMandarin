'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Mic, MicOff, Loader2, Clock, Camera, BookOpen, MessageSquare, CheckCircle2, ChevronRight, RotateCcw, Volume2 } from 'lucide-react'
import { AudioRecorder } from '@/lib/audio/wav-encoder'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils/cn'
import type { HSKKLevel, HSKKTestContent } from '@/lib/hskk/content'

type Phase = 'select' | 'read-prep' | 'read-record' | 'qa-intro' | 'qa-record' | 'picture-prep' | 'picture-record' | 'submitting' | 'result'

interface HSKKResult {
  test_id: string
  transcripts: { read: string; qa: string; picture: string }
  scores: {
    pronunciation: number
    fluency: number
    grammar: number
    vocabulary: number
    content: number
  }
  total_score: number
  predicted_pass: boolean
  major_issues: Array<{
    dimension: string
    issue: string
    example: string
    correction: string
  }>
  strengths: string[]
  overall_feedback: string
}

export function HSKKClient({ tests }: { tests: HSKKTestContent[] }) {
  const router = useRouter()
  const [phase, setPhase] = useState<Phase>('select')
  const [selectedTest, setSelectedTest] = useState<HSKKTestContent | null>(null)
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [audioRecorder] = useState(() => new AudioRecorder())
  const [isRecording, setIsRecording] = useState(false)
  const [audioLevel, setAudioLevel] = useState(0)
  const [countdown, setCountdown] = useState(0)
  const [recordings, setRecordings] = useState<{
    read?: Blob
    qa: Blob[]
    picture?: Blob
  }>({ qa: [] })
  const [result, setResult] = useState<HSKKResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const countdownRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    audioRecorder.onAudioLevel = setAudioLevel
    return () => {
      audioRecorder.cancel()
      if (countdownRef.current) clearInterval(countdownRef.current)
    }
  }, [audioRecorder])

  // 倒计时
  const startCountdown = useCallback((seconds: number, onComplete: () => void) => {
    setCountdown(seconds)
    if (countdownRef.current) clearInterval(countdownRef.current)
    countdownRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          if (countdownRef.current) clearInterval(countdownRef.current)
          onComplete()
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }, [])

  // 开始录音
  const startRecording = useCallback(async () => {
    try {
      await audioRecorder.start()
      setIsRecording(true)
    } catch {
      toast.error('Microphone access denied')
      setError('Please allow microphone access')
    }
  }, [audioRecorder])

  // 停止录音
  const stopRecording = useCallback(async (): Promise<Blob | null> => {
    const result = await audioRecorder.stop()
    setIsRecording(false)
    if (!result || result.blob.size < 1000 || result.duration < 0.3) {
      toast.error('录音太短或没收到声音，请检查麦克风权限后重试')
      return null
    }
    return result.blob
  }, [audioRecorder])

  // 选择级别
  const handleSelectLevel = (level: HSKKLevel) => {
    const test = tests.find(t => t.level === level)
    if (!test) return
    setSelectedTest(test)
    setRecordings({ qa: [] })
    setCurrentQuestionIndex(0)
    setResult(null)
    setError(null)
    setPhase('read-prep')
    startCountdown(test.readAloud.preparationTime, () => setPhase('read-record'))
  }

  // 朗读部分：录音完成
  const handleReadRecorded = async () => {
    const blob = await stopRecording()
    if (!blob) return
    setRecordings(prev => ({ ...prev, read: blob }))
    setPhase('qa-intro')
  }

  // 问答部分
  const handleQaRecorded = async () => {
    const blob = await stopRecording()
    if (!blob) return
    setRecordings(prev => ({ ...prev, qa: [...prev.qa, blob] }))

    if (selectedTest && currentQuestionIndex < selectedTest.qa.questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1)
    } else {
      setPhase('picture-prep')
      if (selectedTest) {
        startCountdown(selectedTest.pictureDescription.preparationTime, () => setPhase('picture-record'))
      }
    }
  }

  // 看图说话：录音完成
  const handlePictureRecorded = async () => {
    const blob = await stopRecording()
    if (!blob) return
    setRecordings(prev => ({ ...prev, picture: blob }))
    handleSubmit()
  }

  // 提交评分
  const handleSubmit = async () => {
    if (!selectedTest || !recordings.read || !recordings.picture || recordings.qa.length === 0) {
      toast.error('Missing recordings')
      return
    }

    setPhase('submitting')

    try {
      // 合并 Q&A 录音：提取 PCM 数据后合并，保留第一个 WAV 头
      const qaBlob = recordings.qa.length === 1
        ? recordings.qa[0]
        : await mergeWavBlobs(recordings.qa)

      const formData = new FormData()
      formData.append('section_read', recordings.read, 'read.wav')
      formData.append('section_qa', qaBlob, 'qa.wav')
      formData.append('section_picture', recordings.picture, 'picture.wav')
      formData.append('level', selectedTest.level)
      formData.append('reference_text', selectedTest.readAloud.passage)
      formData.append('qa_questions', JSON.stringify(selectedTest.qa.questions.map(q => q.question)))
      formData.append('picture_prompt', selectedTest.pictureDescription.prompt)

      const res = await fetch('/api/hskk/submit', {
        method: 'POST',
        body: formData
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        if (errData.upgrade_required) {
          toast.error('Free tier limit reached. Upgrade for unlimited HSKK tests.')
          router.push('/settings')
          return
        }
        throw new Error(errData.error || 'Scoring failed')
      }

      const data = await res.json()
      setResult(data)
      setPhase('result')
    } catch (err) {
      setError((err as Error).message)
      setPhase('read-prep')
      startCountdown(selectedTest!.readAloud.preparationTime, () => setPhase('read-record'))
    }
  }

  // 重置
  const handleReset = () => {
    setPhase('select')
    setSelectedTest(null)
    setRecordings({ qa: [] })
    setCurrentQuestionIndex(0)
    setResult(null)
    setError(null)
  }

  // ============ 渲染 ============

  if (phase === 'select') {
    return <LevelSelect tests={tests} onSelect={handleSelectLevel} />
  }

  if (phase === 'result' && result) {
    return <ResultView result={result} onReset={handleReset} />
  }

  if (!selectedTest) return null

  // 朗读准备
  if (phase === 'read-prep') {
    return (
      <PrepScreen
        title="Section 1: Read Aloud"
        icon={<BookOpen className="h-6 w-6" />}
        countdown={countdown}
        content={
          <div>
            <p className="mb-4 text-sm text-muted-foreground">请朗读下面这段文字。准备时间结束后会自动开始录音。</p>
            <div className="rounded-lg bg-rice p-6 cn-font text-lg leading-relaxed">
              {selectedTest.readAloud.passage}
            </div>
          </div>
        }
      />
    )
  }

  // 朗读录音
  if (phase === 'read-record') {
    return (
      <RecordScreen
        title="Reading Aloud"
        icon={<BookOpen className="h-6 w-6" />}
        isRecording={isRecording}
        audioLevel={audioLevel}
        onStart={startRecording}
        onStop={handleReadRecorded}
        instruction="Read the passage aloud clearly"
        showPassage={selectedTest.readAloud.passage}
      />
    )
  }

  // Q&A 介绍
  if (phase === 'qa-intro') {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <Card>
          <CardContent className="p-8 text-center">
            <MessageSquare className="mx-auto mb-4 h-12 w-12 text-vermilion" />
            <h2 className="mb-2 text-2xl font-bold">Section 2: Q&A</h2>
            <p className="mb-6 text-muted-foreground">
              You will hear {selectedTest.qa.questions.length} questions. Answer each one in Chinese.
            </p>
            <Button
              variant="primary"
              size="lg"
              onClick={() => {
                setCurrentQuestionIndex(0)
                setPhase('qa-record')
              }}
            >
              Start Q&A <ChevronRight className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Q&A 录音
  if (phase === 'qa-record') {
    const question = selectedTest.qa.questions[currentQuestionIndex]
    return (
      <RecordScreen
        title={`Q&A ${currentQuestionIndex + 1}/${selectedTest.qa.questions.length}`}
        icon={<MessageSquare className="h-6 w-6" />}
        isRecording={isRecording}
        audioLevel={audioLevel}
        onStart={startRecording}
        onStop={handleQaRecorded}
        instruction="Answer the question in Chinese"
        showQuestion={question.question}
        ttsText={question.question}
        progress={`Question ${currentQuestionIndex + 1} of ${selectedTest.qa.questions.length}`}
      />
    )
  }

  // 看图准备
  if (phase === 'picture-prep') {
    return (
      <PrepScreen
        title="Section 3: Picture Description"
        icon={<Camera className="h-6 w-6" />}
        countdown={countdown}
        content={
          <div>
            <p className="mb-4 text-sm text-muted-foreground">请看图片，描述你看到的内容。准备时间结束后会自动开始录音。</p>
            <img
              src={selectedTest.pictureDescription.imageUrl}
              alt="Picture to describe"
              className="mx-auto max-h-80 rounded-lg shadow-md"
            />
            <p className="mt-4 text-center text-sm text-muted-foreground">{selectedTest.pictureDescription.prompt}</p>
          </div>
        }
      />
    )
  }

  // 看图录音
  if (phase === 'picture-record') {
    return (
      <RecordScreen
        title="Picture Description"
        icon={<Camera className="h-6 w-6" />}
        isRecording={isRecording}
        audioLevel={audioLevel}
        onStart={startRecording}
        onStop={handlePictureRecorded}
        instruction="Describe the picture in Chinese"
        showImage={selectedTest.pictureDescription.imageUrl}
      />
    )
  }

  // 提交中
  if (phase === 'submitting') {
    return (
      <div className="mx-auto max-w-md py-20 text-center">
        <Loader2 className="mx-auto mb-4 h-12 w-12 animate-spin text-vermilion" />
        <h2 className="mb-2 text-xl font-bold">Scoring your test...</h2>
        <p className="text-muted-foreground">
          AI is analyzing your pronunciation, fluency, grammar, vocabulary, and content.
          This takes about 20-30 seconds.
        </p>
        <div className="mt-8 space-y-2 text-left text-sm text-muted-foreground">
          <p>✓ Transcribing speech...</p>
          <p>✓ Analyzing pronunciation...</p>
          <p>✓ Evaluating grammar...</p>
          <p>✓ Scoring content...</p>
        </div>
      </div>
    )
  }

  return null
}

// ============ 级别选择 ============

function LevelSelect({ tests, onSelect }: { tests: HSKKTestContent[]; onSelect: (level: HSKKLevel) => void }) {
  const levels: { id: HSKKLevel; name: string; description: string; hskRange: string }[] = [
    { id: 'beginner', name: 'Beginner', description: 'Basic daily conversation', hskRange: 'HSK 1-2' },
    { id: 'intermediate', name: 'Intermediate', description: 'Express opinions on familiar topics', hskRange: 'HSK 3-4' },
    { id: 'advanced', name: 'Advanced', description: 'Discuss complex topics fluently', hskRange: 'HSK 5-6' }
  ]

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold tracking-tight">HSKK Mock Test</h1>
        <p className="mt-2 text-muted-foreground">
          Full simulation of the official HSKK oral exam. Get scored on 5 dimensions.
        </p>
      </div>

      <div className="grid gap-4">
        {levels.map(level => {
          const testCount = tests.filter(t => t.level === level.id).length
          return (
            <Card
              key={level.id}
              className="cursor-pointer transition-shadow hover:shadow-md"
              onClick={() => onSelect(level.id)}
            >
              <CardContent className="flex items-center justify-between p-6">
                <div>
                  <div className="mb-1 flex items-center gap-2">
                    <h3 className="text-xl font-bold">{level.name}</h3>
                    <span className="rounded-full bg-vermilion/10 px-2 py-0.5 text-xs font-medium text-vermilion">
                      {level.hskRange}
                    </span>
                  </div>
                  <p className="text-muted-foreground">{level.description}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{testCount} test variants available</p>
                </div>
                <ChevronRight className="h-6 w-6 text-muted-foreground" />
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Card className="border-dashed">
        <CardContent className="p-4 text-center text-sm text-muted-foreground">
          <Clock className="mx-auto mb-2 h-5 w-5" />
          Each test takes about 15 minutes (3 sections: read aloud, Q&A, picture description)
        </CardContent>
      </Card>
    </div>
  )
}

// ============ 准备画面 ============

function PrepScreen({ title, icon, countdown, content }: { title: string; icon: React.ReactNode; countdown: number; content: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-vermilion/10 text-vermilion">
          {icon}
        </div>
        <h2 className="text-2xl font-bold">{title}</h2>
      </div>

      <Card>
        <CardContent className="p-6">
          {content}
        </CardContent>
      </Card>

      <div className="text-center">
        <p className="mb-2 text-sm text-muted-foreground">Recording starts in</p>
        <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-vermilion text-2xl font-bold text-white">
          {countdown}
        </div>
      </div>
    </div>
  )
}

// ============ 录音画面 ============

function RecordScreen({ title, icon, isRecording, audioLevel, onStart, onStop, instruction, showPassage, showQuestion, showImage, progress, ttsText }: {
  title: string
  icon: React.ReactNode
  isRecording: boolean
  audioLevel: number
  onStart: () => void
  onStop: () => void
  instruction: string
  showPassage?: string
  showQuestion?: string
  showImage?: string
  progress?: string
  ttsText?: string
}) {
  const [ttsState, setTtsState] = useState<'loading' | 'ready' | 'playing' | 'done' | 'error'>(ttsText ? 'loading' : 'done')
  const audioRef = useRef<HTMLAudioElement | null>(null)

  // 加载 TTS 音频
  useEffect(() => {
    if (!ttsText) {
      setTtsState('done')
      return
    }

    let cancelled = false
    setTtsState('loading')

    async function fetchTTS() {
      try {
        const res = await fetch('/api/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: ttsText })
        })

        if (!res.ok) throw new Error('TTS failed')
        const data = await res.json()

        if (cancelled) return

        if (data.audio) {
          if (audioRef.current) {
            audioRef.current.src = `data:audio/mp3;base64,${data.audio}`
          }
          setTtsState('ready')
          // 自动播放
          setTimeout(() => {
            if (audioRef.current && !cancelled) {
              audioRef.current.play()
                .then(() => setTtsState('playing'))
                .catch(() => setTtsState('ready')) // 自动播放被拦截，显示手动播放按钮
            }
          }, 300)
        } else {
          setTtsState('done')
        }
      } catch {
        if (!cancelled) setTtsState('error')
      }
    }

    fetchTTS()
    return () => { cancelled = true }
  }, [ttsText])

  // 音频播放结束
  function handleAudioEnded() {
    setTtsState('done')
  }

  // 手动重播
  function replayAudio() {
    if (audioRef.current) {
      audioRef.current.play()
        .then(() => setTtsState('playing'))
        .catch(() => {})
    }
  }

  // TTS 未完成时不允许录音
  const canRecord = ttsState === 'done' || ttsState === 'error'

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-vermilion/10 text-vermilion">
            {icon}
          </div>
          <h2 className="text-xl font-bold">{title}</h2>
        </div>
        {progress && <span className="text-sm text-muted-foreground">{progress}</span>}
      </div>

      {showPassage && (
        <div className="rounded-lg bg-rice p-4 cn-font text-base leading-relaxed">
          {showPassage}
        </div>
      )}

      {showQuestion && (
        <Card className="border-vermilion/30 bg-vermilion/5">
          <CardContent className="p-6 text-center">
            <p className="text-lg font-medium">{showQuestion}</p>
            {/* TTS 播放状态 */}
            {ttsText && ttsState === 'loading' && (
              <div className="mt-3 flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading audio...
              </div>
            )}
            {ttsText && (ttsState === 'ready' || ttsState === 'playing' || ttsState === 'done') && (
              <button
                onClick={replayAudio}
                className="mt-3 flex items-center gap-1 text-sm text-vermilion hover:underline"
              >
                <Volume2 className="h-4 w-4" />
                {ttsState === 'playing' ? 'Playing...' : 'Replay question'}
              </button>
            )}
            {ttsText && ttsState === 'error' && (
              <p className="mt-3 text-xs text-muted-foreground">Audio unavailable. Please read the question above.</p>
            )}
          </CardContent>
        </Card>
      )}

      {showImage && (
        <img src={showImage} alt="Describe this" className="mx-auto max-h-60 rounded-lg shadow-md" />
      )}

      <div className="flex flex-col items-center gap-4 py-8">
        {/* 音量波形 */}
        {isRecording && (
          <div className="flex h-8 items-center gap-1">
            {[...Array(20)].map((_, i) => (
              <div
                key={i}
                className="w-1 rounded-full bg-vermilion transition-all"
                style={{
                  height: `${Math.max(4, Math.min(32, audioLevel * 40 * (1 - Math.abs(i - 10) / 10)))}px`
                }}
              />
            ))}
          </div>
        )}

        {/* 录音按钮 */}
        <button
          onClick={isRecording ? onStop : (canRecord ? onStart : undefined)}
          disabled={!canRecord && !isRecording}
          className={cn(
            'flex h-20 w-20 items-center justify-center rounded-full shadow-lg transition-all',
            isRecording
              ? 'scale-110 animate-pulse bg-vermilion-deep text-white'
              : canRecord
                ? 'bg-vermilion text-white hover:scale-105'
                : 'bg-muted text-muted-foreground cursor-not-allowed'
          )}
        >
          {isRecording ? <MicOff className="h-8 w-8" /> : <Mic className="h-8 w-8" />}
        </button>

        <p className="text-sm text-muted-foreground">
          {isRecording
            ? 'Click to stop recording'
            : !canRecord
              ? 'Listen to the question first...'
              : instruction}
        </p>
      </div>

      {/* 隐藏的 audio 元素 */}
      <audio ref={audioRef} onEnded={handleAudioEnded} />
    </div>
  )
}

// ============ 结果展示 ============

function ResultView({ result, onReset }: { result: HSKKResult; onReset: () => void }) {
  const dimensions = [
    { label: 'Pronunciation', value: result.scores.pronunciation, cn: '发音' },
    { label: 'Fluency', value: result.scores.fluency, cn: '流利度' },
    { label: 'Grammar', value: result.scores.grammar, cn: '语法' },
    { label: 'Vocabulary', value: result.scores.vocabulary, cn: '词汇' },
    { label: 'Content', value: result.scores.content, cn: '内容' }
  ]

  const scoreColor = (v: number) => v >= 80 ? 'text-jade' : v >= 60 ? 'text-gold' : 'text-vermilion'
  const barColor = (v: number) => v >= 80 ? 'bg-jade' : v >= 60 ? 'bg-gold' : 'bg-vermilion'

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* 总分 */}
      <Card className={cn(
        'border-2',
        result.predicted_pass ? 'border-jade/40 bg-jade/5' : 'border-vermilion/40 bg-vermilion/5'
      )}>
        <CardContent className="p-8 text-center">
          {result.predicted_pass ? (
            <CheckCircle2 className="mx-auto mb-3 h-12 w-12 text-jade" />
          ) : null}
          <div className={cn('text-5xl font-bold', scoreColor(result.total_score))}>
            {result.total_score}
            <span className="text-2xl text-muted-foreground">/100</span>
          </div>
          <p className="mt-2 text-lg font-semibold">
            {result.predicted_pass ? 'Predicted: PASS ✓' : 'Predicted: Not yet passing'}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">{result.overall_feedback}</p>
        </CardContent>
      </Card>

      {/* 5 维度分数 */}
      <div className="grid gap-4 sm:grid-cols-5">
        {dimensions.map(dim => (
          <Card key={dim.label}>
            <CardContent className="p-4 text-center">
              <div className="mx-auto mb-2 h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className={cn('h-full rounded-full transition-all', barColor(dim.value))}
                  style={{ width: `${dim.value}%` }}
                />
              </div>
              <div className={cn('text-2xl font-bold', scoreColor(dim.value))}>{dim.value}</div>
              <div className="text-xs text-muted-foreground">{dim.label}</div>
              <div className="cn-font text-xs text-muted-foreground">{dim.cn}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 主要问题 */}
      {result.major_issues.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Areas to Improve</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {result.major_issues.map((issue, i) => (
              <div key={i} className="border-l-2 border-vermilion/40 pl-3">
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-vermilion/10 px-2 py-0.5 text-xs font-medium text-vermilion">
                    {issue.dimension}
                  </span>
                </div>
                <p className="mt-1 text-sm font-medium">{issue.issue}</p>
                <p className="text-sm text-muted-foreground">
                  You said: <span className="text-vermilion">{issue.example}</span>
                </p>
                <p className="text-sm text-jade">
                  Better: {issue.correction}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* 优点 */}
      {result.strengths.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg text-jade">Your Strengths ✓</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1">
              {result.strengths.map((s, i) => (
                <li key={i} className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-jade" />
                  {s}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* 转录 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Your Transcripts</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <p className="text-xs font-medium text-muted-foreground">Section 1: Read Aloud</p>
            <p className="cn-font text-sm">{result.transcripts.read}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground">Section 2: Q&A</p>
            <p className="cn-font text-sm">{result.transcripts.qa}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground">Section 3: Picture Description</p>
            <p className="cn-font text-sm">{result.transcripts.picture}</p>
          </div>
        </CardContent>
      </Card>

      {/* 操作 */}
      <div className="flex gap-3">
        <Button variant="primary" size="lg" className="flex-1" onClick={onReset}>
          <RotateCcw className="h-4 w-4" />
          Take Another Test
        </Button>
      </div>
    </div>
  )
}

// ============ WAV 合并工具 ============

/**
 * 合并多个 WAV Blob：保留第一个 WAV 头，拼接后续的 PCM 数据
 */
async function mergeWavBlobs(blobs: Blob[]): Promise<Blob> {
  const arrays = await Promise.all(blobs.map(b => b.arrayBuffer()))
  const buffers = arrays.map(a => new Uint8Array(a))

  // 第一个 WAV 的头（44 字节）
  const header = buffers[0].slice(0, 44)

  // 提取所有 PCM 数据（跳过 44 字节头）
  const pcmChunks: Uint8Array[] = [buffers[0].slice(44)]
  for (let i = 1; i < buffers.length; i++) {
    pcmChunks.push(buffers[i].slice(44))
  }

  const totalPcmLength = pcmChunks.reduce((sum, chunk) => sum + chunk.length, 0)

  // 更新 WAV 头中的 data size
  const result = new Uint8Array(44 + totalPcmLength)
  result.set(header, 0)
  // data chunk size at offset 40 (4 bytes LE)
  const view = new DataView(result.buffer)
  view.setUint32(40, totalPcmLength, true)

  let offset = 44
  for (const chunk of pcmChunks) {
    result.set(chunk, offset)
    offset += chunk.length
  }

  return new Blob([result], { type: 'audio/wav' })
}

