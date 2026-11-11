'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Mic, MicOff, Loader2, Volume2, AlertCircle, CheckCircle2, X, Sparkles } from 'lucide-react'
import { AudioRecorder } from '@/lib/audio/wav-encoder'
import { validateConversationWav } from '@/lib/audio/conversation-wav'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils/cn'
import { MicPermissionBanner } from '@/components/audio/mic-permission-banner'
import type { MistakeEntry } from '@/lib/db/types'
import { meanMeasuredScores, type TranscriptScores } from '@/lib/ai/conversation-feedback'

interface Message {
  role: 'user' | 'ai'
  text: string
  audio?: string // base64
  errors?: MistakeEntry[]
  scores?: TranscriptScores
}

interface ConversationClientProps {
  scenarioId: string
  scenarioName: string
  scenarioDescription: string
  hskLevel: number
  correctionMode: 'friendly' | 'strict' | 'tutor'
  recommendedHsk: number[]
  durationMinutes: number
}

type ConversationState = 'idle' | 'recording' | 'processing' | 'completed'

export function ConversationClient({
  scenarioId,
  scenarioName,
  scenarioDescription,
  hskLevel,
  correctionMode,
  recommendedHsk,
  durationMinutes
}: ConversationClientProps) {
  const router = useRouter()
  const [state, setState] = useState<ConversationState>('idle')
  const [messages, setMessages] = useState<Message[]>([])
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [turnIndex, setTurnIndex] = useState(0)
  const [isEnding, setIsEnding] = useState(false)
  const [audioLevel, setAudioLevel] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [audioRecorder] = useState(() => new AudioRecorder())
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const lastRecording = useRef<Blob | null>(null)
  const submitting = useRef(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // 录音期间累计最大音量（用于检测静音）
  const maxLevelRef = useRef(0)
  const silenceWarnedRef = useRef(false)
  const stateRef = useRef<ConversationState>('idle')

  useEffect(() => {
    stateRef.current = state
  }, [state])

  // 设置录音音量回调
  useEffect(() => {
    audioRecorder.onAudioLevel = (level) => {
      setAudioLevel(level)
      if (level > maxLevelRef.current) maxLevelRef.current = level
    }
  }, [audioRecorder])

  // 自动滚动到最新消息
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // 开始对话
  useEffect(() => {
    async function startConversation() {
      try {
        const res = await fetch('/api/conversation/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            scenario_id: scenarioId,
            hsk_level: hskLevel,
            correction_mode: correctionMode
          })
        })

        if (!res.ok) throw new Error('Failed to start conversation')
        const data = await res.json()
        setConversationId(data.conversation_id)

        // AI 开场白（从 API 返回）
        setMessages([{
          role: 'ai',
          text: data.opening_message || '你好！我们开始吧！',
          audio: data.opening_audio || undefined
        }])

        // 播放开场白语音
        if (data.opening_audio) {
          setTimeout(() => playAudio(data.opening_audio), 300)
        }
      } catch (err) {
        setError('Failed to start conversation. Please refresh.')
      }
    }

    startConversation()
  }, [scenarioId, hskLevel, correctionMode])

  // 开始录音
  const handleStartRecording = useCallback(async () => {
    if (!conversationId || state !== 'idle') return
    setError(null)
    maxLevelRef.current = 0
    silenceWarnedRef.current = false

    try {
      await audioRecorder.start()
      setState('recording')

      // 1.2 秒后如果一次都没收到音量 → 静默警告
      setTimeout(() => {
        if (
          stateRef.current === 'recording' &&
          maxLevelRef.current < 0.01 &&
          !silenceWarnedRef.current
        ) {
          silenceWarnedRef.current = true
          toast.error(
            '没收到麦克风声音。请检查浏览器地址栏左侧的麦克风权限，确认选择了正确的麦克风设备。'
          )
        }
      }, 1200)
    } catch (err) {
      const msg = (err as Error)?.message || ''
      console.error('[Conversation] start recording failed:', err)
      // 精准区分错误类型
      if (msg.includes('permission') || msg.includes('denied') || msg.includes('NotAllowed')) {
        toast.error('麦克风权限被拒绝。请到浏览器地址栏左侧 🔒 改权限。')
        setError(
          '麦克风权限被拒绝。请点击浏览器地址栏左侧 🔒 图标 → 允许麦克风 → 刷新页面。'
        )
      } else if (msg.includes('NotFound')) {
        toast.error('没找到麦克风设备。')
        setError('系统没检测到麦克风。请插上耳机/麦克风后重试。')
      } else if (msg.includes('AudioWorklet') || msg.includes('worklet')) {
        toast.error('浏览器音频模块加载失败，请刷新页面重试。')
        setError('音频模块加载失败，请打开 F12 Console 看错误，并刷新页面。')
      } else {
        toast.error('录音启动失败：' + msg)
        setError('录音启动失败：' + msg + '。请打开 F12 Console 查看详细错误。')
      }
    }
  }, [conversationId, state, audioRecorder])

  const submitAudio = useCallback(async (blob: Blob) => {
    if (!conversationId || submitting.current) return
    submitting.current = true
    lastRecording.current = blob
    setError(null)
    setState('processing')

    try {
      const formData = new FormData()
      formData.append('audio', blob, 'recording.wav')
      formData.append('conversation_id', conversationId!)
      formData.append('turn_index', String(turnIndex))
      formData.append('scenario_id', scenarioId)
      formData.append('hsk_level', String(hskLevel))
      formData.append('correction_mode', correctionMode)

      const requestStart = performance.now()
      const res = await fetch('/api/conversation/turn', {
        method: 'POST',
        body: formData
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        if (errData.upgrade_required) {
          toast.error('Daily free limit reached. Upgrade to continue.')
          router.push('/settings')
          return
        }
        throw new Error(errData.error || 'Failed to process speech')
      }

      const data = await res.json()

      lastRecording.current = null
      const requestMs = Math.round(performance.now() - requestStart)
      if (data.timing) console.info('[conversation-timing]', JSON.stringify({ ...data.timing, turn: turnIndex + 1, request_ms: requestMs, playback_start_ms: null }))
      if (data.warning) toast.info(data.warning)

      // 添加用户消息
      setMessages(prev => [...prev, {
        role: 'user',
        text: data.user_text,
        errors: data.errors,
        scores: data.scores
      }])

      // 添加 AI 消息
      setMessages(prev => [...prev, {
        role: 'ai',
        text: data.ai_reply,
        audio: data.ai_audio
      }])

      setTurnIndex(prev => prev + 1)
      setState('idle')

      // 播放 AI 音频
      if (data.ai_audio) {
        playAudio(data.ai_audio).then(started => {
          if (data.timing) console.info('[conversation-playback-timing]', JSON.stringify({ turn: turnIndex + 1, playback_start_ms: started ? Math.round(performance.now() - requestStart) : null }))
        })
      }

      // 对话完成
      if (data.conversation_complete) {
        setState('completed')
        toast.success('Conversation completed! Great job! 🎉')
      }

      // 鼓励
      if (data.encouragement) {
        toast(data.encouragement, { icon: '💡' })
      }
    } catch (err) {
      setState('idle')
      setError((err as Error).message || 'Something went wrong. Please try again.')
    } finally { submitting.current = false }
  }, [conversationId, turnIndex, scenarioId, hskLevel, correctionMode, router])

  // 停止录音 → 发送处理
  const handleStopRecording = useCallback(async () => {
    if (state !== 'recording') return

    let result: { blob: Blob; duration: number; diagnostics?: any } | null = null
    try {
      result = await audioRecorder.stop()
    } catch (err) {
      setState('idle')
      toast.error('录音失败：' + (err as Error).message)
      return
    }

    if (!result || result.blob.size < 1000 || result.duration < 0.3) {
      setState('idle')
      // 给出更有用的诊断
      const d = result?.diagnostics
      if (d?.chunks === 0) {
        toast.error('麦克风没有声音输入。请检查麦克风权限和设备。')
        console.error('[AudioRecorder] 0 chunks received', d)
      } else if (result && result.duration < 0.3) {
        toast.error(`录音太短（${Math.round(result.duration * 1000)}ms）。请按住按钮多说一会儿。`)
      } else {
        toast.error('Recording too short. Please try again.')
        console.error('[AudioRecorder] small blob', d)
      }
      return
    }

    // 整段音量都很低 → 静音检测
    if (maxLevelRef.current < 0.01) {
      setState('idle')
      toast.error(
        '麦克风未检测到声音输入。请检查：1) 浏览器地址栏左侧 🔒 麦克风权限；' +
          '2) 系统是否选对了麦克风设备；3) 麦克风是否被静音。'
      )
      return
    }

    await submitAudio(result.blob)
  }, [state, audioRecorder, submitAudio])

  const handleAudioUpload = async (file: File) => {
    if (!conversationId || state !== 'idle' || isEnding) return
    if (file.size > 8 * 1024 * 1024) {
      setError('Audio file is too large (maximum 8 MB).')
      return
    }
    setState('processing')
    try {
      const validation = validateConversationWav(await file.arrayBuffer())
      if (!validation.ok) {
        setState('idle')
        setError(validation.error)
        return
      }
      await submitAudio(file)
    } catch {
      setState('idle')
      setError('Could not read the audio file. Please try another WAV recording.')
    }
  }

  // 播放音频
  const playAudio = async (base64: string): Promise<boolean> => {
    if (!audioRef.current) return false
    audioRef.current.src = `data:audio/mp3;base64,${base64}`
    try { await audioRef.current.play(); return true } catch { return false }
  }

  // 结束对话并更新统计
  const handleEndConversation = useCallback(async () => {
    if (isEnding) return
    setIsEnding(true)

    try {
      if (conversationId) {
        const response = await fetch('/api/conversation/end', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ conversation_id: conversationId }),
          keepalive: true
        })

        if (!response.ok) throw new Error('Failed to save conversation progress')
      }
      audioRecorder.cancel()
      router.push('/dashboard')
      router.refresh()
    } catch (endError) {
      console.error('[Conversation] end failed:', endError)
      toast.error('Could not save your progress. Please try again.')
      setIsEnding(false)
    }
  }, [conversationId, isEnding, audioRecorder, router])

  // 取消录音
  const handleCancelRecording = useCallback(() => {
    audioRecorder.cancel()
    setState('idle')
  }, [audioRecorder])

  // 按住说话逻辑
  const handleMouseDown = () => handleStartRecording()
  const handleMouseUp = () => {
    if (state === 'recording') handleStopRecording()
  }
  const handleMouseLeave = () => {
    if (state === 'recording') handleStopRecording()
  }

  // 键盘支持（空格键）
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && state === 'idle' && !e.repeat && !(e.target instanceof HTMLElement && e.target.closest('button, input, textarea, select, a, [contenteditable]'))) {
        e.preventDefault()
        handleStartRecording()
      }
    }
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space' && state === 'recording') {
        e.preventDefault()
        handleStopRecording()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [state, handleStartRecording, handleStopRecording])

  // 清理
  useEffect(() => {
    return () => {
      audioRecorder.cancel()
    }
  }, [audioRecorder])

  const accuracyScore = meanMeasuredScores(messages.flatMap(message =>
    message.scores ? [message.scores.grammar, message.scores.word_choice] : []
  ))

  return (
    <div className="mx-auto flex min-h-[calc(100vh-200px)] max-w-3xl flex-col">
      {/* 隐藏的 audio 元素 */}
      <audio ref={audioRef} />

      {/* 头部 */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{scenarioName}</h1>
          <p className="text-sm text-muted-foreground">
            HSK {hskLevel} · {turnIndex} turns · {accuracyScore !== null ? `${accuracyScore}% text feedback` : 'Not scored'}
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleEndConversation}
          disabled={isEnding || state === 'processing'}
        >
          {isEnding ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
          {isEnding ? 'Saving...' : 'End'}
        </Button>
      </div>

      {/* 消息列表 */}
      <div className="flex-1 space-y-4 overflow-y-auto pb-4">
        {messages.map((msg, i) => (
          <MessageBubble key={i} message={msg} onReplay={() => msg.audio && playAudio(msg.audio)} />
        ))}

        {state === 'completed' && (
          <Card className="border-jade/30 bg-jade/5">
            <CardContent className="flex items-center gap-3 p-4">
              <CheckCircle2 className="h-6 w-6 text-jade" />
              <div>
                <p className="font-semibold">Conversation completed!</p>
                <p className="text-sm text-muted-foreground">
                  You completed {turnIndex} turns. {accuracyScore !== null ? `Transcript feedback: ${accuracyScore}/100.` : 'No score available.'}
                </p>
              </div>
              <Button
                size="sm"
                variant="primary"
                className="ml-auto"
                onClick={handleEndConversation}
                disabled={isEnding}
              >
                {isEnding ? 'Saving...' : 'Back to Dashboard'}
              </Button>
            </CardContent>
          </Card>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <div><p>{error}</p>
            {lastRecording.current && state === 'idle' && !isEnding && <Button variant="outline" size="sm" className="mt-2" onClick={() => { if (lastRecording.current) void submitAudio(lastRecording.current) }}>Retry last recording</Button>}
          </div>
        </div>
      )}

      {/* 麦克风权限提示（静音时尤其有用） */}
      <MicPermissionBanner className="mb-4" />

      {/* 录音控制区 */}
      {state !== 'completed' && (
        <div className="sticky bottom-0 border-t bg-background/80 backdrop-blur-md">
          <div className="flex flex-col items-center gap-3 py-4">
            {/* 音量指示器（录音中） */}
            {state === 'recording' && (
              <div className="flex flex-col items-center gap-1">
                <div className="flex h-8 items-center gap-1">
                  {[...Array(20)].map((_, i) => (
                    <div
                      key={i}
                      className={cn(
                        'w-1 rounded-full transition-all',
                        audioLevel < 0.01 ? 'bg-muted-foreground/30' : 'bg-vermilion'
                      )}
                      style={{
                        height: `${Math.max(4, Math.min(32, audioLevel * 40 * (1 - Math.abs(i - 10) / 10)))}px`
                      }}
                    />
                  ))}
                </div>
                {audioLevel < 0.01 && (
                  <p className="text-xs text-vermilion animate-pulse">
                    ⚠️ 麦克风没收到声音，请检查浏览器权限和设备
                  </p>
                )}
              </div>
            )}

            {/* 录音按钮 */}
            <button
              onMouseDown={handleMouseDown}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseLeave}
              onTouchStart={(e) => { e.preventDefault(); handleMouseDown() }}
              onTouchEnd={(e) => { e.preventDefault(); handleMouseUp() }}
              disabled={state === 'processing' || !conversationId}
              className={cn(
                'flex h-16 w-16 items-center justify-center rounded-full shadow-lg transition-all',
                'disabled:cursor-not-allowed disabled:opacity-50',
                state === 'idle' && 'bg-vermilion text-white hover:scale-105 hover:bg-vermilion-deep',
                state === 'recording' && 'scale-110 bg-vermilion-deep text-white animate-pulse',
                state === 'processing' && 'bg-muted text-muted-foreground'
              )}
            >
              {state === 'processing' ? (
                <Loader2 className="h-7 w-7 animate-spin" />
              ) : state === 'recording' ? (
                <MicOff className="h-7 w-7" />
              ) : (
                <Mic className="h-7 w-7" />
              )}
            </button>

            {/* 提示文字 */}
            <p className="text-sm text-muted-foreground">
              {state === 'idle' && (conversationId ? 'Press and hold to speak (or spacebar)' : 'Loading...')}
              {state === 'recording' && 'Release to send'}
              {state === 'processing' && 'Processing your speech...'}
            </p>

            <div className="text-center text-sm">
              <label htmlFor="conversation-audio-upload" className="block text-muted-foreground">
                No microphone? Upload a recording
              </label>
              <input
                id="conversation-audio-upload"
                type="file"
                accept=".wav,audio/wav"
                disabled={state !== 'idle' || !conversationId || isEnding}
                className="mt-2 max-w-full text-xs"
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  event.target.value = ''
                  if (file) void handleAudioUpload(file)
                }}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                WAV · 16 kHz · mono · 16-bit PCM · 0.3–120 seconds. Selecting a file sends it for speech recognition and uses your practice allowance.
              </p>
            </div>

            {/* 取消按钮（录音中） */}
            {state === 'recording' && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCancelRecording}
                className="text-muted-foreground"
              >
                Cancel
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ============ 消息气泡组件 ============

function MessageBubble({
  message,
  onReplay
}: {
  message: Message
  onReplay: () => void
}) {
  const isUser = message.role === 'user'

  return (
    <div className={cn('flex', isUser ? 'justify-end' : 'justify-start')}>
      <div className={cn('max-w-[80%] space-y-2', isUser ? 'items-end' : 'items-start')}>
        {/* 文字 */}
        <div
          className={cn(
            'rounded-2xl px-4 py-3 text-base',
            isUser
              ? 'bg-vermilion text-white'
              : 'bg-card border'
          )}
        >
          <p className={cn(isUser ? 'text-white' : 'text-foreground')}>
            {message.text}
          </p>
          {message.audio && (
            <button
              onClick={onReplay}
              className={cn(
                'mt-2 flex items-center gap-1 text-xs',
                isUser ? 'text-white/80 hover:text-white' : 'text-muted-foreground hover:text-vermilion'
              )}
            >
              <Volume2 className="h-3 w-3" />
              Replay audio
            </button>
          )}
        </div>

        {/* 反馈（仅用户消息） */}
        {isUser && message.scores && (
          <FeedbackCard scores={message.scores} errors={message.errors || []} />
        )}
      </div>
    </div>
  )
}

// ============ 反馈卡片 ============

function FeedbackCard({
  scores,
  errors
}: {
  scores: NonNullable<Message['scores']>
  errors: MistakeEntry[]
}) {
  const avg = meanMeasuredScores([scores.grammar, scores.word_choice])
  const scoreColor = avg === null ? 'text-muted-foreground' : avg >= 85 ? 'text-jade' : avg >= 70 ? 'text-gold' : 'text-vermilion'
  const dimensions = [
    { label: 'Grammar', value: scores.grammar },
    { label: 'Word Choice', value: scores.word_choice },
  ]

  return (
    <Card className="border-border/50 bg-background/50">
      <CardContent className="p-3">
        {/* 分数行 */}
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">Transcript feedback</span>
          <span className={cn('text-lg font-bold', scoreColor)}>{avg ?? 'Not scored'}{avg !== null && <span className="text-xs">/100</span>}</span>
        </div>

        {/* 4 维度条 */}
        <div className="grid grid-cols-2 gap-2">
          {dimensions.map((dim) => (
            <div key={dim.label} className="text-center">
              <div className="mx-auto mb-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className={cn(
                    'h-full rounded-full transition-all',
                    dim.value === null ? 'bg-muted' : dim.value >= 85 ? 'bg-jade' : dim.value >= 70 ? 'bg-gold' : 'bg-vermilion'
                  )}
                  style={{ width: `${dim.value ?? 0}%` }}
                />
              </div>
              <span className="text-[10px] text-muted-foreground">{dim.label}</span>
              <span className="block text-xs font-semibold">{dim.value ?? 'Not scored'}</span>
            </div>
          ))}
        </div>

        <p className="mt-2 text-xs text-muted-foreground">
          Based on recognized text. Pronunciation, tone, and spoken fluency are not assessed.
        </p>

        {/* 错误列表 */}
        {errors.length > 0 && (
          <div className="mt-3 space-y-1.5 border-t pt-2">
            {errors.map((err, i) => (
              <div key={i} className="flex items-start gap-2 text-xs">
                <span className={cn(
                  'mt-0.5 rounded px-1.5 py-0.5 font-medium',
                  err.type === 'tone' && 'bg-vermilion/10 text-vermilion',
                  err.type === 'grammar' && 'bg-gold/10 text-gold',
                  err.type === 'word' && 'bg-blue-100 text-blue-700',
                  err.type === 'fluency' && 'bg-purple-100 text-purple-700'
                )}>
                  {err.type}
                </span>
                <div className="flex-1">
                  <span className="text-muted-foreground line-through">{err.user_said}</span>
                  <span className="mx-1 text-muted-foreground">→</span>
                  <span className="font-medium text-jade">{err.correct}</span>
                  {err.explanation && (
                    <p className="mt-0.5 text-muted-foreground">{err.explanation}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 完美分数 */}
        {errors.length === 0 && avg !== null && avg >= 90 && (
          <div className="mt-2 flex items-center gap-1 text-xs text-jade">
            <Sparkles className="h-3 w-3" />
            No text corrections suggested.
          </div>
        )}
      </CardContent>
    </Card>
  )
}
