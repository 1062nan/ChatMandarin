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
import { saveConversationTurn, getConversationTurns } from '@/lib/db/conversations'
import { createMistakesFromErrors } from '@/lib/db/mistakes'
import { analyzeAudio } from '@/lib/audio/analyze'
import { getSubscriptionContext, consumeConversationSeconds } from '@/lib/subscription/tier'
import { validateAudioFile } from '@/lib/practice/request'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(request: NextRequest) {
  const startTime = Date.now()

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

    // 验证 conversation 归属当前用户
    const { data: conv } = await supabase
      .from('conversations')
      .select('user_id, scenario, hsk_level, correction_mode, ended_at')
      .eq('id', conversationId)
      .maybeSingle()
    if (!conv || conv.user_id !== profile.id) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
    }
    if (conv.ended_at) {
      return NextResponse.json({ error: 'Conversation has already ended' }, { status: 409 })
    }

    // Scenario and learning controls are immutable properties of the server-side
    // conversation. Ignore browser-supplied copies that can be tampered with.
    const scenarioId = conv.scenario
    const hskLevel = conv.hsk_level
    const correctionMode = conv.correction_mode

    const subCtx = await getSubscriptionContext(profile.id)
    const audioBuffer = await audio.file.arrayBuffer()
    const audioDurationSeconds = Math.max(1, Math.ceil(Math.max(0, audioBuffer.byteLength - 44) / 32000))
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
      .single()

    if (!scenario) {
      return NextResponse.json({ error: 'Scenario not found' }, { status: 404 })
    }

    const scenarioData = scenario as Record<string, any>

    // 6. ASR：用户音频 → 文字
    const audioFormat = audio.format

    // 诊断：检查音频是否静音（16-bit PCM）
    const audioDiag = analyzeAudio(audioBuffer)
    console.log('[conversation/turn] audio received:', {
      size: audio.file.size,
      format: audioFormat,
      ...audioDiag,
    })

    let userText: string
    try {
      const asrResult = await recognizeSpeech(audioBuffer, audioFormat, 16000)
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
    const history = await getConversationTurns(conversationId)
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
      aiResponse = await getConversationResponse(systemPrompt, chatMessages)
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
    try {
      const ttsResult = await synthesizeSpeech(aiResponse.reply, profile.tts_voice_type as any || 'BV700_streaming')
      aiAudioBase64 = ttsResult.audioBase64
    } catch (ttsError) {
      console.error('TTS failed:', ttsError)
      // TTS 失败不阻断流程（用户还能看文字）
    }

    // 10. 保存到数据库
    const latencyMs = Date.now() - startTime

    let statsUpdateFailed = false
    try {
      const savedTurn = await saveConversationTurn({
        conversationId,
        turnIndex,
        userText,
        aiText: aiResponse.reply,
        errors: aiResponse.errors || [],
        scores: aiResponse.scores,
        userAudioDurationMs: audioDurationSeconds * 1000,
        aiResponseLatencyMs: latencyMs
      })

      statsUpdateFailed = savedTurn.statsUpdateFailed === true

    } catch (dbError) {
      console.error('Database save failed:', dbError)
      return NextResponse.json({ error: 'Could not save your practice. Please try again.' }, { status: 500 })
    }

    const warnings: string[] = []
    if (statsUpdateFailed) warnings.push('Your practice was saved, but the summary update is pending. It will retry when you end this conversation.')
    // Journal enrichment must not turn a durable practice save into a retry.
    if (aiResponse.errors && aiResponse.errors.length > 0) {
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

    // 11. 返回结果
    return NextResponse.json({
      user_text: userText,
      ai_reply: aiResponse.reply,
      ai_audio: aiAudioBase64,
      errors: aiResponse.errors || [],
      scores: aiResponse.scores,
      assessment_basis: 'transcript_only',
      ...(warnings.length ? { warning: warnings.join(' ') } : {}),
      conversation_complete: aiResponse.conversation_complete || false,
      encouragement: aiResponse.encouragement || null,
      latency_ms: latencyMs
    })
  } catch (error) {
    console.error('Conversation turn failed:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: (error as Error).message },
      { status: 500 }
    )
  }
}
