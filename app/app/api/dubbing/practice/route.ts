/**
 * POST /api/dubbing/practice
 * 配音逐句练习：用户读一句台词 → ASR → 对比原文 → 评分
 *
 * Body (multipart): audio (WAV), clip_id, line_index
 */
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { recognizeSpeech } from '@/lib/ai/volcengine-asr'
import { getSubscriptionContext } from '@/lib/subscription/tier'
import { comparePracticeTexts, normalizePracticeText } from '@/lib/practice/scoring'
import { validateAudioFile } from '@/lib/practice/request'
import { validateConversationWav } from '@/lib/audio/conversation-wav'

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
    if (!normalizePracticeText(lineText)) {
      return NextResponse.json({ error: 'Clip line not found' }, { status: 404 })
    }

    // ASR
    const audioBuffer = await audio.file.arrayBuffer()
    if (audio.format === 'wav') {
      const validation = validateConversationWav(audioBuffer)
      if (!validation.ok) return NextResponse.json({ error: validation.error }, { status: 400 })
    }
    const asrResult = await recognizeSpeech(audioBuffer, audio.format, 16000)

    if (!normalizePracticeText(asrResult.text)) {
      return NextResponse.json({ error: 'Could not understand audio' }, { status: 422 })
    }

    const comparison = comparePracticeTexts(asrResult.text, lineText)

    return NextResponse.json({
      transcript: asrResult.text,
      original: lineText,
      pronunciation_score: null,
      emotion_score: null,
      fluency_score: null,
      total_score: comparison.accuracyScore,
      transcript_match_score: comparison.accuracyScore,
      assessment_basis: 'transcript_match',
      char_comparison: comparison.charByChar,
      errors: comparison.errors,
      feedback: 'Transcript matching only. Speech recognition may be inaccurate; pronunciation, tone, emotion and fluency are not assessed.'
    })
  } catch (error) {
    console.error('Dubbing practice failed:', error)
    return NextResponse.json({ error: 'Scoring failed' }, { status: 500 })
  }
}
