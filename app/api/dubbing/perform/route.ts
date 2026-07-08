/**
 * POST /api/dubbing/perform
 * 完整配音表演：用户录制完整片段 → ASR 全文 → 逐句对比 → 5 维度评分
 *
 * Body (multipart): audio (WAV), clip_id
 */
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { recognizeSpeech } from '@/lib/ai/volcengine-asr'
import { getHSKKScore } from '@/lib/ai/deepseek'
import { getSubscriptionContext } from '@/lib/subscription/tier'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, hsk_level, tts_voice_type')
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
    const clipId = formData.get('clip_id') as string

    if (!audioFile || !clipId) {
      return NextResponse.json({ error: 'Missing audio or clip_id' }, { status: 400 })
    }

    // 获取片段数据
    const { data: clip } = await supabase
      .from('dubbing_clips')
      .select('*')
      .eq('id', clipId)
      .single()

    if (!clip) return NextResponse.json({ error: 'Clip not found' }, { status: 404 })

    const lines = clip.lines as any[]

    // ASR 全文
    const audioBuffer = await audioFile.arrayBuffer()
    const format = (audioFile.name.split('.').pop() || 'wav').toLowerCase()
    const asrResult = await recognizeSpeech(audioBuffer, format, 16000)

    // 全文 vs 原文逐字对比
    const allOriginal = lines.map(l => l.text).join('')
    const allOriginalClean = allOriginal.replace(/[\s，。！？、,.!?]/g, '')
    const userClean = asrResult.text.replace(/[\s，。！？、,.!?]/g, '')

    let correct = 0
    const origChars = [...allOriginalClean]
    const userChars = [...userClean]
    const maxLen = Math.max(origChars.length, userChars.length)

    for (let i = 0; i < origChars.length; i++) {
      if (origChars[i] === userChars[i]) correct++
    }

    const pronunciation = Math.round((correct / Math.max(origChars.length, 1)) * 100)

    // 音频时长 vs 片段标准时长（节奏适当性）
    const audioDuration = audioBuffer.byteLength / (16000 * 2) // WAV 16kHz 16bit mono
    const clipDuration = clip.duration_seconds
    const durationRatio = audioDuration / clipDuration
    let rhythmScore: number
    if (durationRatio >= 0.8 && durationRatio <= 1.2) {
      rhythmScore = 90
    } else if (durationRatio >= 0.6 && durationRatio <= 1.5) {
      rhythmScore = 70
    } else {
      rhythmScore = 50
    }

    // 流畅度（完成度）
    const completionRate = Math.min(1, userChars.length / origChars.length)
    const fluency = Math.round(completionRate * 100)

    // 用 DeepSeek 评估情感匹配
    let emotionScore = 75
    try {
      const emotionPrompt = `Score a movie dubbing performance.

Clip: "${clip.title}"
Lines (original):
${lines.map((l, i) => `${i + 1}. ${l.speaker}: "${l.text}" (${l.emotion})`).join('\n')}

Student's full transcript: "${asrResult.text}"

Score pronunciation (0-100), emotion match (0-100), and give feedback.
Return JSON: { "scores": { "pronunciation": N, "word_choice": N }, "errors": [] }`

      const aiResult = await getHSKKScore(emotionPrompt)
      emotionScore = aiResult.scores?.content || 75
    } catch {}

    const toneScore = Math.max(60, pronunciation - 10) // V1 简化
    const total = Math.round(
      pronunciation * 0.3 + toneScore * 0.25 + emotionScore * 0.2 + rhythmScore * 0.15 + fluency * 0.1
    )

    // 保存到数据库
    const { data: performance } = await supabase
      .from('dubbing_performances')
      .insert({
        user_id: profile.id,
        clip_id: clipId,
        total_score: total,
        pronunciation_score: pronunciation,
        tone_score: toneScore,
        emotion_score: emotionScore,
        rhythm_score: rhythmScore,
        fluency_score: fluency,
        transcript: asrResult.text,
        mode: 'perform'
      })
      .select()
      .single()

    return NextResponse.json({
      performance_id: performance?.id,
      transcript: asrResult.text,
      scores: {
        pronunciation,
        tone: toneScore,
        emotion: emotionScore,
        rhythm: rhythmScore,
        fluency
      },
      total_score: total,
      clip_title: clip.title,
      line_count: lines.length,
      chars_correct: correct,
      chars_total: origChars.length
    })
  } catch (error) {
    console.error('Dubbing perform failed:', error)
    return NextResponse.json({ error: 'Performance scoring failed' }, { status: 500 })
  }
}
