/**
 * POST /api/dubbing/perform
 * 完整配音表演：用户录制完整片段 → ASR 全文 → 逐句对比 → 转录文本匹配
 *
 * Body (multipart): audio (WAV), clip_id
 */
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { recognizeSpeech } from '@/lib/ai/volcengine-asr'
import { getSubscriptionContext } from '@/lib/subscription/tier'
import { comparePracticeTexts, normalizePracticeText } from '@/lib/practice/scoring'
import { validateAudioFile } from '@/lib/practice/request'

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
    const audio = validateAudioFile(formData.get('audio'))
    const clipId = formData.get('clip_id')

    if (!audio.ok) {
      return NextResponse.json({ error: audio.error }, { status: 400 })
    }
    if (typeof clipId !== 'string' || !clipId) {
      return NextResponse.json({ error: 'Missing clip_id' }, { status: 400 })
    }

    // 获取片段数据
    const { data: clip, error: clipError } = await supabase
      .from('dubbing_clips')
      .select('*')
      .eq('id', clipId)
      .eq('is_active', true)
      .maybeSingle()

    if (clipError) throw clipError
    if (!clip) return NextResponse.json({ error: 'Clip not found' }, { status: 404 })

    const lines = Array.isArray(clip.lines) ? clip.lines as Array<Record<string, unknown>> : []
    if (lines.length === 0 || lines.some((line) => typeof line.text !== 'string')) {
      return NextResponse.json({ error: 'Clip content is invalid' }, { status: 422 })
    }

    // ASR 全文
    const audioBuffer = await audio.file.arrayBuffer()
    const asrResult = await recognizeSpeech(audioBuffer, audio.format, 16000)

    if (!normalizePracticeText(asrResult.text)) {
      return NextResponse.json({ error: 'Could not understand audio' }, { status: 422 })
    }
    const allOriginal = lines.map((line) => line.text as string).join('')
    if (!normalizePracticeText(allOriginal)) {
      return NextResponse.json({ error: 'Clip content is invalid' }, { status: 422 })
    }
    const comparison = comparePracticeTexts(asrResult.text, allOriginal)
    const total = comparison.accuracyScore

    // 保存到数据库
    const { data: performance, error: saveError } = await supabase
      .from('dubbing_performances')
      .insert({
        user_id: profile.id,
        clip_id: clipId,
        total_score: total,
        pronunciation_score: null,
        tone_score: null,
        emotion_score: null,
        rhythm_score: null,
        fluency_score: null,
        transcript: asrResult.text,
        mode: 'perform'
      })
      .select()
      .single()
    if (saveError) throw saveError

    return NextResponse.json({
      performance_id: performance?.id,
      transcript: asrResult.text,
      scores: {
        pronunciation: null,
        tone: null,
        emotion: null,
        rhythm: null,
        fluency: null
      },
      total_score: total,
      transcript_match_score: total,
      assessment_basis: 'transcript_match',
      clip_title: clip.title,
      line_count: lines.length,
      chars_correct: comparison.charByChar.filter((entry) => entry.correct).length,
      chars_total: comparison.charByChar.length
    })
  } catch (error) {
    console.error('Dubbing perform failed:', error)
    return NextResponse.json({ error: 'Performance scoring failed' }, { status: 500 })
  }
}
