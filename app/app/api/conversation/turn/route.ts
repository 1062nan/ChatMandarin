/**
 * POST /api/conversation/turn
 *
 * 接收用户录音 → ASR → DeepSeek → TTS → 返回完整结果
 *
 * Request body (multipart/form-data):
 *   - audio: WAV audio file
 *   - conversation_id: UUID
 *   - turn_index: number
 *   - hsk_level: number (1-6)
 *   - correction_mode: friendly | strict | tutor
 *
 * Response (JSON):
 *   {
 *     "user_text": "用户说的话（转录）",
 *     "ai_reply": "AI 的中文回复",
 *     "ai_audio": "base64-encoded MP3",
 *     "errors": [...],
 *     "scores": {...},
 *     "conversation_complete": false
 *   }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { recognizeSpeech } from '@/lib/ai/volcengine-asr'
import { synthesizeSpeech } from '@/lib/ai/volcengine-tts'
import { getConversationResponse } from '@/lib/ai/deepseek'
import { buildConversationPrompt } from '@/lib/ai/prompts'
import type { ChatMessage } from '@/lib/ai/deepseek'
import { saveConversationTurn, getConversationTurns, getVerifiedConversation, type VerifiedTurn } from '@/lib/db/conversations'
import { createMistakesFromErrors } from '@/lib/db/mistakes'
import { analyzeAudio } from '@/lib/audio/analyze'
import { getSubscriptionContext, consumeConversationSeconds } from '@/lib/subscription/tier'
import { validateAudioFile } from '@/lib/practice/request'
import { validateConversationWav } from '@/lib/audio/conversation-wav'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(request: NextRequest) {
  const startTime = Date.now()
  const measuredStart = performance.now()
  const timing = { asr_ms: 0, reply_ms: 0, tts_ms: 0, persistence_ms: 0, server_ms: 0 }

  try {
    // 1. 鉴权
    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 2. 解析请求
    const formData = await request.formData()
    const audio = validateAudioFile(formData.get('audio'))
    const conversationId = formData.get('conversation_id')
    const turnIndex = Number(formData.get('turn_index'))

    if (!audio.ok) {
      return NextResponse.json({ error: audio.error }, { status: 400 })
    }
    if (typeof conversationId !== 'string' || !conversationId || !Number.isInteger(turnIndex) || turnIndex < 0) {
      return NextResponse.json(
        { error: 'Invalid conversation_id or turn_index' },
        { status: 400 }
      )
    }

    // 3. 获取用户 profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, tts_voice_type')
      .eq('auth_id', user.id)
      .single()

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    // Use protected settings and history, never the client-editable legacy rows.
    const conv = await getVerifiedConversation(conversationId, profile.id)
    if (!conv) return NextResponse.json({ error: 'Please start a new conversation.' }, { status: 409 })
    const history = await getConversationTurns(conversationId, profile.id)
    const existingTurn = history.find(turn => turn.turn_index === turnIndex)
    if (existingTurn) return NextResponse.json(turnResponse(existingTurn, null))
    if (conv.completed_at) return NextResponse.json({ error: 'Conversation has already ended' }, { status: 409 })
    if (turnIndex !== history.length) return NextResponse.json({ error: 'Unexpected turn index. Please start a new conversation.' }, { status: 409 })
    const scenarioId = conv.scenario_id
    const hskLevel = conv.hsk_level
    const correctionMode = conv.correction_mode

    const subCtx = await getSubscriptionContext(profile.id)
    const audioBuffer = await audio.file.arrayBuffer()
    const wav = validateConversationWav(audioBuffer)
    if (!wav.ok) return NextResponse.json({ error: wav.error }, { status: 400 })
    const audioDurationSeconds = Math.ceil(wav.durationSeconds)
    const convQuota = await consumeConversationSeconds(profile.id, audioDurationSeconds)
    if (!convQuota.ok) {
      return NextResponse.json(
        {
          error: 'Daily conversation limit reached (5 min for free tier). Upgrade for unlimited.',
          upgrade_required: true,
          remaining: convQuota.remaining,
          plan: subCtx.plan,
        },
        { status: 429 }
      )
    }

    // 5. 获取场景数据
    const { data: scenario } = await supabase
      .from('scenarios')
      .select('*')
      .eq('id', scenarioId)
      .eq('is_active', true)
      .single()

    if (!scenario) {
      return NextResponse.json({ error: 'Scenario not found' }, { status: 404 })
    }

    const scenarioData = scenario as Record<string, any>

    // 6. ASR：用户音频 → 文字
    const audioFormat = 'wav'

    // 诊断：检查音频是否静音（16-bit PCM）
    const audioDiag = analyzeAudio(audioBuffer)
    console.log('[conversation/turn] audio received:', {
      size: audio.file.size,
      format: audioFormat,
      ...audioDiag,
    })

    let userText: string
    try {
      const stageStart = performance.now()
      const asrResult = await recognizeSpeech(audioBuffer, audioFormat, 16000)
      timing.asr_ms = Math.round(performance.now() - stageStart)
      userText = asrResult.text
      console.log('[conversation/turn] ASR completed:', {
        textLength: userText.length,
        confidence: asrResult.confidence,
      })
    } catch (asrError) {
      console.error('ASR failed:', asrError)
      return NextResponse.json(
        { error: 'Speech recognition failed. Please try again.' },
        { status: 500 }
      )
    }

    if (!userText || userText.trim().length === 0) {
      // 根据音频诊断给出更精准的错误
      if (audioDiag.silent) {
        return NextResponse.json(
          {
            error:
              '录音中没检测到声音。请检查麦克风是否正确选择、并允许浏览器使用麦克风。',
          },
          { status: 422 }
        )
      }
      return NextResponse.json(
        { error: 'Could not understand audio. Please try again.' },
        { status: 422 }
      )
    }

    // 7. 获取对话历史（最近 5 轮）
    const recentHistory = history.slice(-5)

    const chatMessages: ChatMessage[] = recentHistory.map((turn) => [
      { role: 'user' as const, content: turn.user_text || '' },
      { role: 'assistant' as const, content: turn.ai_text || '' }
    ]).flat()

    // 添加当前轮
    chatMessages.push({ role: 'user', content: userText })

    // 8. DeepSeek：用户文字 → AI 回复 + 反馈
    const systemPrompt = buildConversationPrompt({
      hskLevel,
      scenarioId,
      scenarioName: (scenarioData.name as { en: string }).en,
      scenarioPrompt: scenarioData.scenario_prompt,
      aiPersona: scenarioData.ai_persona,
      correctionMode: correctionMode as 'friendly' | 'strict' | 'tutor'
    })

    let aiResponse
    try {
      const stageStart = performance.now()
      aiResponse = await getConversationResponse(systemPrompt, chatMessages)
      timing.reply_ms = Math.round(performance.now() - stageStart)
    } catch (llmError) {
      console.error('DeepSeek failed:', llmError)
      return NextResponse.json(
        { error: 'AI response failed', details: (llmError as Error).message },
        { status: 500 }
      )
    }

    // Only learner transcript corrections belong in feedback and the journal.
    // Vocabulary used by the tutor must never be attributed to the learner.

    // 9. TTS：AI 文字 → 语音
    let aiAudioBase64: string | null = null
    const ttsStart = performance.now()
    try {
      const ttsResult = await synthesizeSpeech(aiResponse.reply, profile.tts_voice_type as any || 'BV700_streaming')
      aiAudioBase64 = ttsResult.audioBase64
    } catch (ttsError) {
      console.error('TTS failed:', ttsError)
      // TTS 失败不阻断流程（用户还能看文字）
    }

    timing.tts_ms = Math.round(performance.now() - ttsStart)

    // 10. 保存到数据库
    const latencyMs = Date.now() - startTime

    const persistenceStart = performance.now()
    let savedTurn: VerifiedTurn
    try {
      savedTurn = await saveConversationTurn({
        userId: profile.id,
        conversationId,
        turnIndex,
        userText,
        aiText: aiResponse.reply,
        errors: aiResponse.errors || [],
        scores: aiResponse.scores,
        userAudioDurationMs: audioDurationSeconds * 1000,
        aiResponseLatencyMs: latencyMs,
        conversationComplete: aiResponse.conversation_complete,
        encouragement: aiResponse.encouragement
      })

    } catch (dbError) {
      console.error('Database save failed:', dbError)
      return NextResponse.json({ error: 'Could not save your practice. Please try again.' }, { status: 500 })
    }

    const warnings: string[] = []
    // Journal enrichment must not turn a durable practice save into a retry.
    if (!savedTurn.duplicate && aiResponse.errors && aiResponse.errors.length > 0) {
      try {
        await createMistakesFromErrors({
          userId: profile.id,
          errors: aiResponse.errors,
          conversationId,
          hskLevel,
          scenario: scenarioId
        })
      } catch (journalError) {
        console.error('Practice saved but mistake journal update failed:', journalError)
        warnings.push('Your practice was saved, but corrections could not be added to the mistake journal.')
      }
    }

    timing.persistence_ms = Math.round(performance.now() - persistenceStart)
    timing.server_ms = Math.round(performance.now() - measuredStart)
    // 11. 返回结果
    return NextResponse.json({
      ...turnResponse(savedTurn, savedTurn.duplicate ? null : aiAudioBase64),
      ...(warnings.length ? { warning: warnings.join(' ') } : {}),
      latency_ms: latencyMs,
      timing
    })
  } catch (error) {
    console.error('Conversation turn failed:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: (error as Error).message },
      { status: 500 }
    )
  }
}

function turnResponse(turn: VerifiedTurn, audio: string | null) {
  return {
    user_text: turn.user_text, ai_reply: turn.ai_text, ai_audio: audio,
    errors: turn.errors || [],
    scores: { pronunciation: null, grammar: turn.grammar_score ?? null, word_choice: turn.word_choice_score ?? null, fluency: null },
    assessment_basis: 'transcript_only', conversation_complete: turn.conversation_complete ?? false,
    encouragement: turn.encouragement ?? null
  }
}
