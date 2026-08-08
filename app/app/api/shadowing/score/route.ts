/**
 * POST /api/shadowing/score
 * 用户跟读一句话 → ASR → 对比原文 → 评分
 *
 * Body (multipart): audio (WAV), sentence_id, original_text
 */
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { recognizeSpeech } from '@/lib/ai/volcengine-asr'
import { synthesizeSpeech } from '@/lib/ai/volcengine-tts'
import { getSubscriptionContext, consumeQuota } from '@/lib/subscription/tier'

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

    // 订阅 + 配额检查（free: 5/天；plus/pro 无限）
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

    const formData = await request.formData()
    const audioFile = formData.get('audio') as File
    const sentenceId = formData.get('sentence_id') as string
    const originalText = formData.get('original_text') as string

    if (!audioFile || !originalText) {
      return NextResponse.json({ error: 'Missing audio or original_text' }, { status: 400 })
    }

    // ASR
    const audioBuffer = await audioFile.arrayBuffer()
    const format = (audioFile.name.split('.').pop() || 'wav').toLowerCase()
    const asrResult = await recognizeSpeech(audioBuffer, format, 16000)

    if (!asrResult.text.trim()) {
      return NextResponse.json({ error: 'Could not understand audio' }, { status: 422 })
    }

    // 逐字对比
    const comparison = compareTexts(asrResult.text, originalText)
    const toneErrors = detectToneErrors(asrResult.text, originalText)

    const pronunciationScore = comparison.accuracyScore
    const toneScore = Math.max(0, 100 - toneErrors.length * 15)
    const fluencyScore = Math.min(100, Math.round((asrResult.text.length / originalText.length) * 100))

    // 保存记录
    await supabase.from('shadowing_records').insert({
      user_id: profile.id,
      sentence_id: sentenceId,
      pronunciation_score: pronunciationScore,
      tone_score: toneScore,
      fluency_score: fluencyScore,
      transcript: asrResult.text,
      errors: [...comparison.errors, ...toneErrors]
    })

    return NextResponse.json({
      transcript: asrResult.text,
      original: originalText,
      pronunciation_score: pronunciationScore,
      tone_score: toneScore,
      fluency_score: fluencyScore,
      char_comparison: comparison.charByChar,
      errors: [...comparison.errors, ...toneErrors]
    })
  } catch (error) {
    console.error('Shadowing score failed:', error)
    return NextResponse.json({ error: 'Scoring failed' }, { status: 500 })
  }
}

// 逐字对比
function compareTexts(userText: string, original: string) {
  const userChars = [...userText.replace(/[\s，。！？、,.!?]/g, '')]
  const origChars = [...original.replace(/[\s，。！？、,.!?]/g, '')]

  let correct = 0
  const charByChar: Array<{ char: string; userSaid: string; correct: boolean }> = []
  const maxLen = Math.max(userChars.length, origChars.length)

  for (let i = 0; i < maxLen; i++) {
    const origChar = origChars[i] || ''
    const userChar = userChars[i] || '_'
    const isCorrect = origChar === userChar
    if (isCorrect) correct++
    if (origChar) {
      charByChar.push({ char: origChar, userSaid: userChar, correct: isCorrect })
    }
  }

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

  return {
    accuracyScore: Math.round((correct / Math.max(origChars.length, 1)) * 100),
    charByChar,
    errors
  }
}

// 简化声调检测（基于拼音对比）
function detectToneErrors(userText: string, original: string): any[] {
  // V1 简化版：不实现声调检测（需要 pinyin-pro 库）
  // V2 用 pinyin-pro 做精确声调对比
  return []
}
