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
 *   - test_variant: number
 *   - reference_text: string (朗读参考文本)
 *   - qa_questions: JSON string (问答题目数组)
 *   - picture_prompt: string (看图说明)
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

    // 3. 订阅 + 配额检查（free: 1/天 + 1/月；plus: 3/月；pro: 无限）
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

    // 4. 解析请求
    const formData = await request.formData()
    const level = formData.get('level') as string
    const referenceText = formData.get('reference_text') as string
    const qaQuestionsStr = formData.get('qa_questions') as string
    const picturePrompt = formData.get('picture_prompt') as string

    const sectionReadAudio = formData.get('section_read') as File
    const sectionQaAudio = formData.get('section_qa') as File
    const sectionPictureAudio = formData.get('section_picture') as File

    if (!sectionReadAudio || !sectionQaAudio || !sectionPictureAudio) {
      return NextResponse.json(
        { error: 'All 3 audio sections are required' },
        { status: 400 }
      )
    }

    // 5. 创建 hskk_test 记录
    const { data: hskkTest, error: dbError } = await supabase
      .from('hskk_tests')
      .insert({
        user_id: profile.id,
        level,
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
        section_qa_text: JSON.parse(qaQuestionsStr || '[]').map((q: string, i: number) => ({
          question: q,
          answer: extractAnswer(qaResult.text, i)
        })),
        section_picture_text: pictureResult.text
      })
      .eq('id', hskkTest.id)

    // 7. DeepSeek 评分（综合 3 部分）
    const scoringPrompt = buildHSKKPrompt({
      level: level as 'beginner' | 'intermediate' | 'advanced',
      section: 'read', // 综合评分
      transcript: `Section 1 (Read Aloud):\nReference: "${referenceText}"\nStudent said: "${readResult.text}"\n\nSection 2 (Q&A):\nQuestions: ${qaQuestionsStr}\nStudent answered: "${qaResult.text}"\n\nSection 3 (Picture Description):\nPrompt: ${picturePrompt}\nStudent described: "${pictureResult.text}"`,
      referenceText,
      questions: JSON.parse(qaQuestionsStr || '[]'),
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

    // 更新使用统计
    const today = new Date().toISOString().split('T')[0]
    const { data: existingUsage } = await supabase
      .from('usage_stats')
      .select('*')
      .eq('user_id', profile.id)
      .eq('date', today)
      .single()

    if (existingUsage) {
      await supabase
        .from('usage_stats')
        .update({
          hskk_count: (existingUsage.hskk_count || 0) + 1
        })
        .eq('user_id', profile.id)
        .eq('date', today)
    } else {
      await supabase
        .from('usage_stats')
        .insert({
          user_id: profile.id,
          date: today,
          hskk_count: 1
        })
    }

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
