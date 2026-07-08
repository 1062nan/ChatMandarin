/**
 * POST /api/dubbing/practice
 * 配音逐句练习：用户读一句台词 → ASR → 对比原文 → 评分
 *
 * Body (multipart): audio (WAV), clip_id, line_index, line_text, expected_emotion
 */
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { recognizeSpeech } from '@/lib/ai/volcengine-asr'
import { getConversationResponse } from '@/lib/ai/deepseek'
import { getSubscriptionContext } from '@/lib/subscription/tier'

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
    const audioFile = formData.get('audio') as File
    const lineText = formData.get('line_text') as string
    const expectedEmotion = formData.get('expected_emotion') as string || 'neutral'
    const clipId = formData.get('clip_id') as string
    const lineIndex = parseInt(formData.get('line_index') as string, 10)

    if (!audioFile || !lineText) {
      return NextResponse.json({ error: 'Missing audio or line_text' }, { status: 400 })
    }

    // ASR
    const audioBuffer = await audioFile.arrayBuffer()
    const format = (audioFile.name.split('.').pop() || 'wav').toLowerCase()
    const asrResult = await recognizeSpeech(audioBuffer, format, 16000)

    if (!asrResult.text.trim()) {
      return NextResponse.json({ error: 'Could not understand audio' }, { status: 422 })
    }

    // 逐字对比
    const userClean = asrResult.text.replace(/[\s，。！？、,.!?]/g, '')
    const origClean = lineText.replace(/[\s，。！？、,.!?]/g, '')
    const userChars = [...userClean]
    const origChars = [...origClean]

    let correct = 0
    const charByChar = origChars.map((char, i) => {
      const userChar = userChars[i] || '_'
      const isCorrect = char === userChar
      if (isCorrect) correct++
      return { char, userSaid: userChar, correct: isCorrect }
    })

    const pronunciationScore = Math.round((correct / origChars.length) * 100)

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
          fluency: Math.min(100, Math.round(userClean.length / origClean.length * 100))
        },
        conversation_complete: false
      }
    }

    const pronunciation = aiScore.scores?.pronunciation || pronunciationScore
    const emotion = aiScore.scores?.word_choice || 75
    const fluency = aiScore.scores?.fluency || Math.min(100, Math.round(userClean.length / origClean.length * 100))
    const total = Math.round((pronunciation + emotion + fluency) / 3)

    // 收集错误
    const errors: any[] = []
    for (const c of charByChar) {
      if (!c.correct && c.userSaid !== '_') {
        errors.push({
          type: 'pronunciation',
          user_said: c.userSaid,
          correct: c.char,
          explanation: `Said "${c.userSaid}" instead of "${c.char}"`
        })
      }
    }

    return NextResponse.json({
      transcript: asrResult.text,
      original: lineText,
      pronunciation_score: pronunciation,
      emotion_score: emotion,
      fluency_score: fluency,
      total_score: total,
      char_comparison: charByChar,
      errors,
      feedback: (aiScore as any).errors?.[0]?.explanation || ''
    })
  } catch (error) {
    console.error('Dubbing practice failed:', error)
    return NextResponse.json({ error: 'Scoring failed' }, { status: 500 })
  }
}
