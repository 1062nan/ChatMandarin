/**
 * POST /api/tts
 * 文字转语音代理（用于 HSKK 题目播放、对话 TTS 复用）
 *
 * Request body: { text: string, voice_type?: string }
 * Response: { audio: "base64-encoded-mp3" }
 */
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { synthesizeSpeech, type VoiceType } from '@/lib/ai/volcengine-tts'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { text, voice_type } = await request.json()

    if (!text || typeof text !== 'string') {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 })
    }

    const result = await synthesizeSpeech(
      text.slice(0, 500),
      (voice_type as VoiceType) || 'BV700_streaming'
    )

    return NextResponse.json({
      audio: result.audioBase64,
      duration: result.duration
    })
  } catch (error) {
    console.error('TTS failed:', error)
    return NextResponse.json(
      { error: 'Text-to-speech failed' },
      { status: 500 }
    )
  }
}
