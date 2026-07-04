/**
 * 火山引擎语音合成（TTS）客户端
 *
 * 认证：x-api-key（API Key 方式）
 * 参考 demo：tts_http_demo.py
 */

const VOLC_API_KEY = process.env.VOLCENGINE_API_KEY || ''
const VOLC_APP_ID = process.env.VOLCENGINE_APP_ID || ''
const TTS_ENDPOINT = 'https://openspeech.bytedance.com/api/v1/tts'

// 可用音色（豆包语音大模型）
export const VOICE_TYPES = {
  BV700_streaming: '灿灿（女，亲切自然）',
  BV701_streaming: '擎苍（男，沉稳磁性）',
  BV704_streaming: '棉米（女，软萌甜）',
  BV405_streaming: '奶绿（女，温柔知性）',
  BV406_streaming: '超人（男，活力标准）',
  BV123_streaming: '阳光青年（男，阳光活力）',
  BV104_streaming: '儒雅青年（男，儒雅温和）',
  BV120_streaming: '活力女生（女，活泼热情）'
} as const

export type VoiceType = keyof typeof VOICE_TYPES

export interface TTSResult {
  audioBuffer: ArrayBuffer
  audioBase64: string
  duration: number
}

/**
 * 文本转语音
 */
export async function synthesizeSpeech(
  text: string,
  voiceType: VoiceType = 'BV700_streaming',
  speedRatio: number = 1.0,
  encoding: 'mp3' | 'wav' | 'pcm' | 'ogg_opus' = 'mp3'
): Promise<TTSResult> {
  if (!VOLC_API_KEY) throw new Error('VOLCENGINE_API_KEY is not configured')
  if (!text || text.trim().length === 0) throw new Error('TTS text is empty')

  const truncatedText = text.slice(0, 1000)

  const response = await fetch(TTS_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': VOLC_API_KEY
    },
    body: JSON.stringify({
      app: {
        appid: VOLC_APP_ID,
        token: VOLC_API_KEY,
        cluster: process.env.VOLCENGINE_TTS_CLUSTER || 'volcano_tts'
      },
      user: { uid: 'chatmandarin-user' },
      audio: {
        voice_type: voiceType,
        encoding,
        speed_ratio: speedRatio,
        volume_ratio: 1.0,
        pitch_ratio: 1.0
      },
      request: {
        reqid: generateRequestId(),
        text: truncatedText,
        text_type: 'plain',
        operation: 'query',
        with_frontend: 1,
        frontend_type: 'unitTson'
      }
    })
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`TTS error (${response.status}): ${errorText}`)
  }

  const data = await response.json()

  if (data.code !== 3000) {
    throw new Error(`TTS failed: ${data.message || 'unknown'} (code: ${data.code})`)
  }
  if (!data.data) throw new Error('TTS returned no audio data')

  return {
    audioBuffer: base64ToArrayBuffer(data.data),
    audioBase64: data.data,
    duration: parseFloat(data.duration) || estimateDuration(text, speedRatio)
  }
}

/**
 * 获取音色列表
 */
export function getAvailableVoices(): Array<{ id: VoiceType; name: string; gender: string }> {
  return [
    { id: 'BV700_streaming', name: '灿灿', gender: 'female' },
    { id: 'BV701_streaming', name: '擎苍', gender: 'male' },
    { id: 'BV704_streaming', name: '棉米', gender: 'female' },
    { id: 'BV405_streaming', name: '奶绿', gender: 'female' },
    { id: 'BV406_streaming', name: '超人', gender: 'male' },
    { id: 'BV123_streaming', name: '阳光青年', gender: 'male' },
    { id: 'BV104_streaming', name: '儒雅青年', gender: 'male' },
    { id: 'BV120_streaming', name: '活力女生', gender: 'female' }
  ]
}

// ==================== 工具函数 ====================

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes.buffer
}

function generateRequestId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 10)
}

function estimateDuration(text: string, speedRatio: number): number {
  return (text.length * 0.3) / speedRatio
}
