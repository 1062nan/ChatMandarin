/**
 * POST /api/hskk/submit
 *
 * 提交 HSKK 模考 3 个部分的录音 → ASR → DeepSeek 评分 → 返回报告
 *
 * Request body (multipart/form-data):
 *   - section_read: WAV audio (朗读部分)
 *   - section_qa: WAV audio (问答部分)
 *   - section_picture: WAV audio (看图说话)
 *   - level: beginner | intermediate | advanced
 *   - test_variant: number (the server resolves all canonical test content)
 *
 * Response:
 *   {
 *     "test_id": "uuid",
 *     "scores": { pronunciation, fluency, grammar, vocabulary, content },
 *     "total_score": 0-100,
 *     "predicted_pass": null,
 *     "major_issues": [...],
 *     "strengths": [...],
 *     "overall_feedback": "..."
 *   }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { recognizeSpeech } from '@/lib/ai/volcengine-asr'
import { getHSKKScore } from '@/lib/ai/deepseek'
import { buildHSKKPrompt } from '@/lib/ai/prompts'
import { hskkFingerprint, reserveHskk, finishHskk, failHskk } from '@/lib/db/hskk-submission'
import { HSKK_CONTENT } from '@/lib/hskk/content'
import { validateAudioFile } from '@/lib/practice/request'
import { validateConversationWav } from '@/lib/audio/conversation-wav'
import { isScorableTranscript, validateHSKKContentAssessment } from '@/lib/practice/hskk-scoring'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(request: NextRequest) {
  const startTime = Date.now()
  let activeLease: { profileId: string; fingerprint: string; lease: string } | null = null

  try {
    // 1. 鉴权
    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 2. 获取 profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('auth_id', user.id)
      .single()

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    // Validate the canonical test and uploads before reserving quota. Invalid
    // requests must not consume an attempt.
    const formData = await request.formData()
    const level = formData.get('level')
    const testVariant = Number(formData.get('test_variant'))
    if (
      (level !== 'beginner' && level !== 'intermediate' && level !== 'advanced')
      || !Number.isInteger(testVariant)
    ) {
      return NextResponse.json({ error: 'Invalid HSKK test' }, { status: 400 })
    }

    const test = HSKK_CONTENT.find(
      (candidate) => candidate.level === level && candidate.variant === testVariant
    )
    if (!test) {
      return NextResponse.json({ error: 'HSKK test not found' }, { status: 404 })
    }

    const readAudio = validateAudioFile(formData.get('section_read'))
    const qaAudio = validateAudioFile(formData.get('section_qa'))
    const pictureAudio = validateAudioFile(formData.get('section_picture'))
    const invalidAudio = [readAudio, qaAudio, pictureAudio].find((item) => !item.ok)
    if (invalidAudio && !invalidAudio.ok) {
      return NextResponse.json({ error: invalidAudio.error }, { status: 400 })
    }
    if (!readAudio.ok || !qaAudio.ok || !pictureAudio.ok) {
      return NextResponse.json({ error: 'All 3 audio sections are required' }, { status: 400 })
    }

    const sectionAudio = [readAudio, qaAudio, pictureAudio]
    const buffers = await Promise.all(sectionAudio.map(audio => audio.file.arrayBuffer()))
    for (let index = 0; index < sectionAudio.length; index++) {
      if (sectionAudio[index].format === 'wav') {
        const validation = validateConversationWav(buffers[index], index === 1 ? 260 : 120)
        if (!validation.ok) return NextResponse.json({ error: validation.error }, { status: 400 })
      }
    }
    const fingerprint = hskkFingerprint(level, testVariant, buffers)
    const reservation = await reserveHskk(supabase, profile.id, fingerprint, level)
    if (reservation.state === 'completed' && reservation.response) return NextResponse.json(reservation.response)
    if (reservation.state === 'processing') return NextResponse.json({ error: 'This recording is already being scored. Please retry shortly.' }, { status: 409, headers: { 'Retry-After': '5' } })
    if (reservation.state === 'quota_denied') return NextResponse.json({ error: 'HSKK practice limit reached. Upgrade for more.', upgrade_required: true, limit_type: reservation.reason }, { status: 429 })
    if (!reservation.test_id || !reservation.lease_token) throw new Error('Invalid HSKK reservation lease')
    activeLease = { profileId: profile.id, fingerprint, lease: reservation.lease_token }
    const referenceText = test.readAloud.passage
    const qaQuestions = test.qa.questions.map((question) => question.question)
    const picturePrompt = test.pictureDescription.prompt

    // All sections must transcribe successfully before completing the reserved test.
    const [readResult, qaResult, pictureResult] = await Promise.all([
      recognizeSpeech(buffers[0], readAudio.format, 16000),
      recognizeSpeech(buffers[1], qaAudio.format, 16000),
      recognizeSpeech(buffers[2], pictureAudio.format, 16000),
    ])
    if (![readResult, qaResult, pictureResult].every((result) => isScorableTranscript(result.text))) {
      await failHskk(profile.id, fingerprint, reservation.lease_token)
      activeLease = null
      return NextResponse.json({ error: 'Could not understand all three sections. Please record again.' }, { status: 422 })
    }
    // 7. DeepSeek 评分（综合 3 部分）
    const scoringPrompt = buildHSKKPrompt({
      level,
      section: 'read', // 综合评分
      transcript: `Section 1 (Read Aloud):\nReference: "${referenceText}"\nStudent said: "${readResult.text}"\n\nSection 2 (Q&A):\nQuestions: ${JSON.stringify(qaQuestions)}\nStudent answered: "${qaResult.text}"\n\nSection 3 (Picture Description):\nPrompt: ${picturePrompt}\nStudent described: "${pictureResult.text}"`,
      referenceText,
      questions: qaQuestions,
      pictureDescription: picturePrompt
    })

    const scoreResult = validateHSKKContentAssessment(await getHSKKScore(scoringPrompt))
    const latencyMs = Date.now() - startTime

    // 9. 返回结果
    const response = {
      test_id: reservation.test_id,
      transcripts: {
        read: readResult.text,
        qa: qaResult.text,
        picture: pictureResult.text
      },
      scores: scoreResult.scores,
      total_score: scoreResult.total_score,
      predicted_pass: null,
      assessment_basis: scoreResult.assessment_basis,
      major_issues: scoreResult.major_issues,
      strengths: scoreResult.strengths,
      overall_feedback: scoreResult.overall_feedback,
      latency_ms: latencyMs
    }
    await finishHskk(profile.id, fingerprint, reservation.lease_token, response, qaQuestions.map((question, index) => ({ question, answer: extractAnswer(qaResult.text, index) })))
    activeLease = null
    return NextResponse.json(response)
  } catch (error) {
    console.error('HSKK submission failed:', error)
    if (activeLease) {
      try { await failHskk(activeLease.profileId, activeLease.fingerprint, activeLease.lease) }
      catch (failureError) { console.error('HSKK failure state update failed:', failureError) }
    }
    return NextResponse.json(
      { error: 'Failed to process HSKK test. Please try again.' },
      { status: 500 }
    )
  }
}

// ============ 辅助函数 ============

function extractAnswer(fullTranscript: string, answerIndex: number): string {
  // 粗略分割多个答案（按句号或停顿）
  const parts = fullTranscript.split(/[。.！!？?]/).filter(s => s.trim().length > 0)
  return parts[answerIndex] || fullTranscript
}
