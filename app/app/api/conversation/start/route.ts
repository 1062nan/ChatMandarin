/**
 * POST /api/conversation/start
 * 开始新对话，返回 conversation_id + AI 生成的开场白（含语音）
 */
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { createConversation } from '@/lib/db/conversations'
import { buildConversationPrompt } from '@/lib/ai/prompts'
import { getConversationResponse } from '@/lib/ai/deepseek'
import { synthesizeSpeech } from '@/lib/ai/volcengine-tts'
import { checkVocabularyLevel } from '@/lib/ai/vocab-filter'

export const runtime = 'nodejs'
export const maxDuration = 20

export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { scenario_id } = body
    const hskLevel = Number(body.hsk_level ?? 3)
    const correctionMode = body.correction_mode ?? 'friendly'

    if (
      typeof scenario_id !== 'string'
      || !scenario_id
      || !Number.isInteger(hskLevel)
      || hskLevel < 1
      || hskLevel > 6
      || !['friendly', 'strict', 'tutor'].includes(correctionMode)
    ) {
      return NextResponse.json({ error: 'Invalid conversation settings' }, { status: 400 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, tts_voice_type')
      .eq('auth_id', user.id)
      .single()

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    // Validate the active scenario before creating a conversation record.
    const { data: scenario } = await supabase
      .from('scenarios')
      .select('*')
      .eq('id', scenario_id)
      .eq('is_active', true)
      .maybeSingle()
    if (!scenario) {
      return NextResponse.json({ error: 'Scenario not found' }, { status: 404 })
    }

    const conversation = await createConversation({
      userId: profile.id,
      scenario: scenario_id,
      hskLevel,
      correctionMode
    })

    let openingMessage = ''
    let openingAudio: string | null = null

    if (scenario) {
      // AI 生成开场白
      const systemPrompt = buildConversationPrompt({
        hskLevel,
        scenarioId: scenario_id,
        scenarioName: (scenario.name as { en: string }).en,
        scenarioPrompt: scenario.scenario_prompt,
        aiPersona: scenario.ai_persona,
        correctionMode: correctionMode as 'friendly' | 'strict' | 'tutor'
      })

      try {
        // 用一个"虚拟用户输入"触发 AI 开场
        const openingResponse = await getConversationResponse(systemPrompt, [
          { role: 'user', content: '[CONVERSATION START - Please greet the student and begin the scenario]' }
        ])

        openingMessage = openingResponse.reply

        // 词汇检查（方案 C）
        const vocabCheck = checkVocabularyLevel(openingMessage, hskLevel)
        if (!vocabCheck.passed) {
          // 如果有超纲词，仍使用原文但记录（不阻断）
          console.log('Opening message has over-level words:', vocabCheck.overLevelWords)
        }

        // TTS 合成开场白语音
        try {
          const ttsResult = await synthesizeSpeech(openingMessage, profile.tts_voice_type as any || 'BV700_streaming')
          openingAudio = ttsResult.audioBase64
        } catch (ttsError) {
          console.error('Opening TTS failed:', ttsError)
        }
      } catch (aiError) {
        console.error('Opening AI generation failed:', aiError)
        // 降级：使用简单开场白
        openingMessage = getFallbackOpening(scenario_id)
      }
    }

    return NextResponse.json({
      conversation_id: conversation.id,
      started_at: conversation.started_at,
      opening_message: openingMessage,
      opening_audio: openingAudio
    })
  } catch (error) {
    console.error('Failed to start conversation:', error)
    return NextResponse.json(
      { error: 'Failed to start conversation' },
      { status: 500 }
    )
  }
}

function getFallbackOpening(scenarioId: string): string {
  const fallbacks: Record<string, string[]> = {
    restaurant: ['你好！欢迎光临！请问几位？', '您好！欢迎！请坐！'],
    taxi: ['您好！请问去哪儿？', '你好！去哪里？'],
    introduction: ['你好！很高兴认识你！你叫什么名字？', '嗨！你好！你是哪国人？'],
    doctor: ['你好！请坐。哪里不舒服？', '您好！有什么问题？'],
    interview: ['你好！欢迎来面试。请先做自我介绍。', '您好！请介绍一下自己。']
  }
  const list = fallbacks[scenarioId] || ['你好！我们开始吧！']
  return list[Math.floor(Math.random() * list.length)]
}
