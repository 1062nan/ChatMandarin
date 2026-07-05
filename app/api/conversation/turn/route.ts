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
import { checkVocabularyLevel, enhanceErrorsWithVocab } from '@/lib/ai/vocab-filter'

export const runtime = 'nodejs'
export const maxDuration = 30

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
    const audioFile = formData.get('audio') as File
    const conversationId = formData.get('conversation_id') as string
    const turnIndex = parseInt(formData.get('turn_index') as string, 10)
    const scenarioId = formData.get('scenario_id') as string
    const hskLevel = parseInt(formData.get('hsk_level') as string, 10) || 3
    const correctionMode = (formData.get('correction_mode') as string) || 'friendly'

    if (!audioFile || !conversationId) {
      return NextResponse.json(
        { error: 'Missing required fields: audio, conversation_id' },
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
      .select('user_id')
      .eq('id', conversationId)
      .single()
    if (!conv || conv.user_id !== profile.id) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
    }

    // 4. 检查免费额度
    const { data: sub } = await supabase
      .from('subscriptions')
      .select('plan, status')
      .eq('user_id', profile.id)
      .eq('status', 'active')
      .single()

    const plan = sub?.plan || 'free'
    if (plan === 'free') {
      const today = new Date().toISOString().split('T')[0]
      const { data: usage } = await supabase
        .from('usage_stats')
        .select('conversation_seconds')
        .eq('user_id', profile.id)
        .eq('date', today)
        .single()

      if (usage && usage.conversation_seconds >= 300) {
        return NextResponse.json(
          { error: 'Daily limit reached', upgrade_required: true },
          { status: 429 }
        )
      }
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
    const audioBuffer = await audioFile.arrayBuffer()
    const audioFormat = (audioFile.name.split('.').pop() || 'wav').toLowerCase()

    let userText: string
    try {
      const asrResult = await recognizeSpeech(audioBuffer, audioFormat, 16000)
      userText = asrResult.text
    } catch (asrError) {
      console.error('ASR failed:', asrError)
      return NextResponse.json(
        { error: 'Speech recognition failed. Please try again.' },
        { status: 500 }
      )
    }

    if (!userText || userText.trim().length === 0) {
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

    // 8.5 HSK 词汇后处理检查（方案 C）
    const vocabCheck = checkVocabularyLevel(aiResponse.reply, hskLevel)
    if (!vocabCheck.passed) {
      aiResponse.errors = enhanceErrorsWithVocab(aiResponse.errors || [], vocabCheck)
    }

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

    try {
      await saveConversationTurn({
        conversationId,
        turnIndex,
        userText,
        aiText: aiResponse.reply,
        errors: aiResponse.errors || [],
        scores: aiResponse.scores,
        userAudioDurationMs: Math.round(audioBuffer.byteLength / 32), // 粗略估算
        aiResponseLatencyMs: latencyMs
      })

      // 保存错题
      if (aiResponse.errors && aiResponse.errors.length > 0) {
        await createMistakesFromErrors({
          userId: profile.id,
          errors: aiResponse.errors,
          conversationId,
          hskLevel,
          scenario: scenarioId
        })
      }

      // 更新使用统计（先读后写避免双重计数）
      const today = new Date().toISOString().split('T')[0]
      const { data: existingUsage } = await supabase
        .from('usage_stats')
        .select('conversation_seconds, conversation_count')
        .eq('user_id', profile.id)
        .eq('date', today)
        .single()

      if (existingUsage) {
        await supabase
          .from('usage_stats')
          .update({
            conversation_seconds: (existingUsage.conversation_seconds || 0) + Math.round(latencyMs / 1000),
            conversation_count: (existingUsage.conversation_count || 0) + 1
          })
          .eq('user_id', profile.id)
          .eq('date', today)
      } else {
        await supabase
          .from('usage_stats')
          .insert({
            user_id: profile.id,
            date: today,
            conversation_seconds: Math.round(latencyMs / 1000),
            conversation_count: 1
          })
      }
    } catch (dbError) {
      console.error('Database save failed:', dbError)
      // 数据库失败不阻断用户体验
    }

    // 11. 返回结果
    return NextResponse.json({
      user_text: userText,
      ai_reply: aiResponse.reply,
      ai_audio: aiAudioBase64,
      errors: aiResponse.errors || [],
      scores: aiResponse.scores,
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
