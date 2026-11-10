/**
 * POST /api/shadowing/score
 * 用户跟读一句话 → ASR → 对比原文 → 评分
 *
 * Body (multipart): audio (WAV), sentence_id
 */
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { recognizeSpeech } from '@/lib/ai/volcengine-asr'
import { getSubscriptionContext, consumeQuota } from '@/lib/subscription/tier'
import { comparePracticeTexts } from '@/lib/practice/scoring'
import { validateAudioFile } from '@/lib/practice/request'

export const runtime = 'nodejs'

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

    const formData = await request.formData()
    const audio = validateAudioFile(formData.get('audio'))
    const sentenceId = formData.get('sentence_id')
    if (!audio.ok) {
      return NextResponse.json({ error: audio.error }, { status: 400 })
    }
    if (typeof sentenceId !== 'string' || !sentenceId) {
      return NextResponse.json({ error: 'Missing sentence_id' }, { status: 400 })
    }

    // Never trust the target sentence sent by the browser. Scores and stored
    // results must use the canonical active sentence from the database.
    const { data: sentence, error: sentenceError } = await supabase
      .from('shadowing_sentences')
      .select('id, text_zh')
      .eq('id', sentenceId)
      .eq('is_active', true)
      .maybeSingle()
    if (sentenceError) throw sentenceError
    if (!sentence) {
      return NextResponse.json({ error: 'Sentence not found' }, { status: 404 })
    }

    const subCtx = await getSubscriptionContext(profile.id)
    const quotaCheck = await consumeQuota(subCtx, profile.id, 'shadowing')
    if (!quotaCheck.ok) {
      return NextResponse.json(
        {
          error: 'Daily shadowing limit reached. Upgrade for unlimited practice.',
          upgrade_required: true,
          remaining: quotaCheck.remaining,
          plan: subCtx.plan,
        },
        { status: 429 }
      )
    }

    // ASR
    const audioBuffer = await audio.file.arrayBuffer()
    const asrResult = await recognizeSpeech(audioBuffer, audio.format, 16000)

    if (!asrResult.text.trim()) {
      return NextResponse.json({ error: 'Could not understand audio' }, { status: 422 })
    }

    // 逐字对比
    const originalText = sentence.text_zh
    const comparison = comparePracticeTexts(asrResult.text, originalText)

    // 保存记录
    const { error: saveError } = await supabase.from('shadowing_records').insert({
      user_id: profile.id,
      sentence_id: sentenceId,
      pronunciation_score: null,
      tone_score: null,
      fluency_score: null,
      transcript: asrResult.text,
      errors: comparison.errors
    })
    if (saveError) throw saveError

    return NextResponse.json({
      transcript: asrResult.text,
      original: originalText,
      transcript_match_score: comparison.accuracyScore,
      assessment_basis: 'transcript_only',
      pronunciation_score: null,
      tone_score: null,
      fluency_score: null,
      char_comparison: comparison.charByChar,
      errors: comparison.errors
    })
  } catch (error) {
    console.error('Shadowing score failed:', error)
    return NextResponse.json({ error: 'Scoring failed' }, { status: 500 })
  }
}
