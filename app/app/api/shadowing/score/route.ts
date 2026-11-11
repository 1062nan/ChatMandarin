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
import { saveVerifiedAudioPractice } from '@/lib/db/verified-practice'
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

    // Reject malformed WAV bytes before charging quota or calling ASR.
    const audioBuffer = await audio.file.arrayBuffer()
    if (audio.format === 'wav') {
      const validation = validateConversationWav(audioBuffer)
      if (!validation.ok) return NextResponse.json({ error: validation.error }, { status: 400 })
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
    const asrResult = await recognizeSpeech(audioBuffer, audio.format, 16000)

    if (!asrResult.text.trim()) {
      return NextResponse.json({ error: 'Could not understand audio' }, { status: 422 })
    }

    // 逐字对比
    const originalText = sentence.text_zh
    const comparison = comparePracticeTexts(asrResult.text, originalText)

    const assessment = {
      transcript: asrResult.text, original: originalText,
      transcript_match_score: comparison.accuracyScore, assessment_basis: 'transcript_only',
      pronunciation_score: null, tone_score: null, fluency_score: null,
      char_comparison: comparison.charByChar, errors: comparison.errors
    }
    const progress = await saveVerifiedAudioPractice({ profileId: profile.id, kind: 'shadowing', contentId: sentence.id, audio: audioBuffer, score: comparison.accuracyScore, transcript: asrResult.text, errors: comparison.errors, assessment })
    return NextResponse.json({
      ...progress.assessment, record_id: progress.source_id,
      progress: { credited: progress.credited, unit_id: progress.unit_id, duplicate: progress.duplicate }
    })
  } catch (error) {
    console.error('Shadowing score failed:', error)
    return NextResponse.json({ error: 'Scoring failed' }, { status: 500 })
  }
}
