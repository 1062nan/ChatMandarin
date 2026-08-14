/**
 * POST /api/dubbing/practice
 * 配音逐句练习：用户读一句台词 → ASR → 对比原文 → 评分
 *
 * Body (multipart): audio (WAV), clip_id, line_index
 */
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { recognizeSpeech } from '@/lib/ai/volcengine-asr'
import { getConversationResponse } from '@/lib/ai/deepseek'
import { getSubscriptionContext } from '@/lib/subscription/tier'
import { clampScore, comparePracticeTexts, calculateCompletionScore, normalizePracticeText } from '@/lib/practice/scoring'
import { validateAudioFile } from '@/lib/practice/request'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, hsk_level')
      .eq('auth_id', user.id)
      .single()
    if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

    // 配音是 Plus 专属功能
    const subCtx = await getSubscriptionContext(profile.id)
    if (!subCtx.features.dubbing.allowed) {
      return NextResponse.json(
        {
          error: 'Dubbing is a Plus feature. Upgrade to unlock.',
          upgrade_required: true,
          plan: subCtx.plan,
        },
        { status: 403 }
      )
    }

    const formData = await request.formData()
    const audio = validateAudioFile(formData.get('audio'))
    const clipId = formData.get('clip_id')
    const lineIndex = Number(formData.get('line_index'))
    if (!audio.ok) {
      return NextResponse.json({ error: audio.error }, { status: 400 })
    }
    if (typeof clipId !== 'string' || !clipId || !Number.isInteger(lineIndex) || lineIndex < 0) {
      return NextResponse.json({ error: 'Invalid clip or line' }, { status: 400 })
    }

    // Resolve the authoritative line on the server so a caller cannot submit
    // an easier target text or emotion and manufacture a high score.
    const { data: clip, error: clipError } = await supabase
      .from('dubbing_clips')
      .select('id, lines')
      .eq('id', clipId)
      .eq('is_active', true)
      .maybeSingle()
    if (clipError) throw clipError
    const lines = Array.isArray(clip?.lines) ? clip.lines as Array<Record<string, unknown>> : []
    const line = lines[lineIndex]
    const lineText = typeof line?.text === 'string' ? line.text : ''
    const expectedEmotion = typeof line?.emotion === 'string' ? line.emotion : 'neutral'
    if (!lineText) {
      return NextResponse.json({ error: 'Clip line not found' }, { status: 404 })
    }

    // ASR
    const audioBuffer = await audio.file.arrayBuffer()
    const asrResult = await recognizeSpeech(audioBuffer, audio.format, 16000)

    if (!asrResult.text.trim()) {
      return NextResponse.json({ error: 'Could not understand audio' }, { status: 422 })
    }

    // 逐字对比
    const userClean = normalizePracticeText(asrResult.text)
    const comparison = comparePracticeTexts(asrResult.text, lineText)
    const pronunciationScore = comparison.accuracyScore

    // 用 DeepSeek 评估语气匹配 + 给建议
    const emotionPrompt = `You are scoring a student's movie dubbing attempt.

Original line: "${lineText}"
Student said: "${asrResult.text}"
Expected emotion: ${expectedEmotion}

Score pronunciation accuracy (0-100) and emotion match (0-100).
Give specific feedback on what was wrong.

Return JSON: {
  "pronunciation_score": number,
  "emotion_score": number,
  "feedback": "short specific feedback in English"
}`

    let aiScore
    try {
      aiScore = await getConversationResponse(emotionPrompt, [
        { role: 'user', content: asrResult.text }
      ])
    } catch {
      // 降级：不用 AI，纯字面对比
      aiScore = {
        reply: '',
        errors: [],
        scores: {
          pronunciation: pronunciationScore,
          grammar: pronunciationScore,
          word_choice: pronunciationScore,
          fluency: calculateCompletionScore(userClean, lineText)
        },
        conversation_complete: false
      }
    }

    const pronunciation = clampScore(aiScore.scores?.pronunciation, pronunciationScore)
    const emotion = clampScore(aiScore.scores?.word_choice, 75)
    const fluency = clampScore(
      aiScore.scores?.fluency,
      calculateCompletionScore(userClean, lineText)
    )
    const total = Math.round((pronunciation + emotion + fluency) / 3)

    // 收集错误
    const errors = comparison.errors

    return NextResponse.json({
      transcript: asrResult.text,
      original: lineText,
      pronunciation_score: pronunciation,
      emotion_score: emotion,
      fluency_score: fluency,
      total_score: total,
      char_comparison: comparison.charByChar,
      errors,
      feedback: (aiScore as any).errors?.[0]?.explanation || ''
    })
  } catch (error) {
    console.error('Dubbing practice failed:', error)
    return NextResponse.json({ error: 'Scoring failed' }, { status: 500 })
  }
}
