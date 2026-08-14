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
 *     "predicted_pass": boolean,
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
import { getSubscriptionContext, consumeQuota } from '@/lib/subscription/tier'
import { HSKK_CONTENT, type HSKKLevel } from '@/lib/hskk/content'
import { validateAudioFile } from '@/lib/practice/request'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(request: NextRequest) {
  const startTime = Date.now()

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

    const subCtx = await getSubscriptionContext(profile.id)
    const quotaCheck = await consumeQuota(subCtx, profile.id, 'hskk')
    if (!quotaCheck.ok) {
      const messages: Record<string, string> = {
        daily_exceeded: 'Daily HSKK limit reached. Upgrade for more.',
        monthly_exceeded: 'Monthly HSKK limit reached. Upgrade to Pro for unlimited.',
      }
      return NextResponse.json(
        {
          error: messages[quotaCheck.reason || 'daily_exceeded'],
          upgrade_required: true,
          limit_type: quotaCheck.reason,
          remaining: quotaCheck.remaining,
          plan: subCtx.plan,
        },
        { status: 429 }
      )
    }

    const sectionReadAudio = readAudio.file
    const sectionQaAudio = qaAudio.file
    const sectionPictureAudio = pictureAudio.file
    const referenceText = test.readAloud.passage
    const qaQuestions = test.qa.questions.map((question) => question.question)
    const picturePrompt = test.pictureDescription.prompt

    // 5. 创建 hskk_test 记录
    const { data: hskkTest, error: dbError } = await supabase
      .from('hskk_tests')
      .insert({
        user_id: profile.id,
        level: level as HSKKLevel,
        status: 'processing'
      })
      .select()
      .single()

    if (dbError) throw dbError

    // 6. ASR 3 个部分
    const [readResult, qaResult, pictureResult] = await Promise.all([
      safeASR(sectionReadAudio),
      safeASR(sectionQaAudio),
      safeASR(sectionPictureAudio)
    ])

    // 保存转录到数据库
    await supabase
      .from('hskk_tests')
      .update({
        section_read_text: readResult.text,
        section_qa_text: qaQuestions.map((q, i) => ({
          question: q,
          answer: extractAnswer(qaResult.text, i)
        })),
        section_picture_text: pictureResult.text
      })
      .eq('id', hskkTest.id)

    // 7. DeepSeek 评分（综合 3 部分）
    const scoringPrompt = buildHSKKPrompt({
      level,
      section: 'read', // 综合评分
      transcript: `Section 1 (Read Aloud):\nReference: "${referenceText}"\nStudent said: "${readResult.text}"\n\nSection 2 (Q&A):\nQuestions: ${JSON.stringify(qaQuestions)}\nStudent answered: "${qaResult.text}"\n\nSection 3 (Picture Description):\nPrompt: ${picturePrompt}\nStudent described: "${pictureResult.text}"`,
      referenceText,
      questions: qaQuestions,
      pictureDescription: picturePrompt
    })

    let scoreResult
    try {
      scoreResult = await getHSKKScore(scoringPrompt)
    } catch (scoringError) {
      console.error('DeepSeek scoring failed:', scoringError)
      // 降级：返回基础结果
      await supabase
        .from('hskk_tests')
        .update({ status: 'failed' })
        .eq('id', hskkTest.id)

      return NextResponse.json(
        { error: 'Scoring failed. Please try again.' },
        { status: 500 }
      )
    }

    // 8. 保存评分到数据库
    const latencyMs = Date.now() - startTime
    await supabase
      .from('hskk_tests')
      .update({
        total_score: scoreResult.total_score,
        pronunciation_score: scoreResult.scores.pronunciation,
        fluency_score: scoreResult.scores.fluency,
        grammar_score: scoreResult.scores.grammar,
        vocabulary_score: scoreResult.scores.vocabulary,
        content_score: scoreResult.scores.content,
        feedback: scoreResult,
        status: 'completed',
        completed_at: new Date().toISOString()
      })
      .eq('id', hskkTest.id)

    // 9. 返回结果
    return NextResponse.json({
      test_id: hskkTest.id,
      transcripts: {
        read: readResult.text,
        qa: qaResult.text,
        picture: pictureResult.text
      },
      scores: scoreResult.scores,
      total_score: scoreResult.total_score,
      predicted_pass: scoreResult.predicted_pass,
      major_issues: scoreResult.major_issues,
      strengths: scoreResult.strengths,
      overall_feedback: scoreResult.overall_feedback,
      latency_ms: latencyMs
    })
  } catch (error) {
    console.error('HSKK submission failed:', error)
    return NextResponse.json(
      { error: 'Failed to process HSKK test', details: (error as Error).message },
      { status: 500 }
    )
  }
}

// ============ 辅助函数 ============

async function safeASR(audioFile: File): Promise<{ text: string; confidence: number }> {
  try {
    const audioBuffer = await audioFile.arrayBuffer()
    const format = (audioFile.name.split('.').pop() || 'wav').toLowerCase()
    return await recognizeSpeech(audioBuffer, format, 16000)
  } catch (error) {
    console.error('ASR failed for section:', error)
    return { text: '[ASR failed]', confidence: 0 }
  }
}

function extractAnswer(fullTranscript: string, answerIndex: number): string {
  // 粗略分割多个答案（按句号或停顿）
  const parts = fullTranscript.split(/[。.！!？?]/).filter(s => s.trim().length > 0)
  return parts[answerIndex] || fullTranscript
}
