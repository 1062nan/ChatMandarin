/**
 * 火山引擎语音识别（ASR）客户端
 *
 * 认证：x-api-key（API Key 方式）
 * 协议：HTTP POST（serverless 友好，无 WebSocket）
 *
 * 参考：workstick 项目 + tts_http_demo.py 认证方式
 */

const VOLC_API_KEY = process.env.VOLCENGINE_API_KEY || ''
const VOLC_APP_ID = process.env.VOLCENGINE_APP_ID || ''
const ASR_ENDPOINT = 'https://openspeech.bytedance.com/api/v1/auc'

export interface ASRResult {
  text: string
  confidence: number
}

/**
 * 语音识别（HTTP POST）
 * 音频 base64 编码后通过 JSON 发送
 */
export async function recognizeSpeech(
  audioData: ArrayBuffer,
  format: string = 'wav',
  sampleRate: number = 16000
): Promise<ASRResult> {
  if (!VOLC_API_KEY) throw new Error('VOLCENGINE_API_KEY is not configured')

  const base64Audio = arrayBufferToBase64(audioData)

  const response = await fetch(ASR_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer;${VOLC_API_KEY}`
    },
    body: JSON.stringify({
      app: {
        appid: VOLC_APP_ID,
        token: VOLC_API_KEY,
        cluster: process.env.VOLCENGINE_ASR_CLUSTER || 'volcengine_asr_common'
      },
      user: { uid: 'chatmandarin-user' },
      audio: {
        format,
        rate: sampleRate,
        bits: 16,
        channel: 1,
        data: base64Audio,
        language: 'zh-CN'
      },
      request: {
        reqid: generateRequestId(),
        nbest: 1,
        sequence: -1,
        additional: {
          enable_punc: true,
          enable_itn: true
        }
      },
      additions: { with_speech: false }
    })
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`ASR error (${response.status}): ${errorText}`)
  }

  const data = await response.json()

  if (data.code !== 1000 && data.code !== 0) {
    throw new Error(`ASR failed: ${data.message || 'unknown'} (code: ${data.code})`)
  }

  const text = data.result?.text || data.result || ''
  return {
    text: typeof text === 'string' ? text : JSON.stringify(text),
    confidence: data.result?.confidence ?? data.result?.text_prob ?? 1.0
  }
}

// ==================== 录音文件识别（异步，HSKK 用） ====================

const FILE_ASR_BASE = 'https://openspeech.bytedance.com/api/v1/auc'

export async function submitFileRecognition(audioUrl: string, format: string = 'wav'): Promise<string> {
  if (!VOLC_API_KEY) throw new Error('VOLCENGINE_API_KEY is not configured')

  const response = await fetch(`${FILE_ASR_BASE}/submit`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer;${VOLC_API_KEY}`
    },
    body: JSON.stringify({
      app: {
        appid: VOLC_APP_ID,
        token: VOLC_API_KEY,
        cluster: process.env.VOLCENGINE_ASR_FILE_CLUSTER || 'volcengine_bigasr'
      },
      user: { uid: 'chatmandarin-hskk' },
      audio: { format, url: audioUrl },
      additions: { with_speaker_info: 'False' }
    })
  })

  if (!response.ok) throw new Error(`File ASR submit failed: ${response.status}`)
  const data = await response.json()
  return data.resp?.id || ''
}

export async function queryFileRecognition(taskId: string): Promise<ASRResult> {
  const response = await fetch(`${FILE_ASR_BASE}/query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer;${VOLC_API_KEY}`
    },
    body: JSON.stringify({
      appid: VOLC_APP_ID,
      token: VOLC_API_KEY,
      id: taskId,
      cluster: process.env.VOLCENGINE_ASR_FILE_CLUSTER || 'volcengine_bigasr'
    })
  })

  const data = await response.json()
  if (data.resp?.code === 1000) return { text: data.resp?.text || '', confidence: 1.0 }
  if (data.resp?.code < 2000) throw new Error(`ASR task failed: ${data.resp?.message}`)
  return { text: '', confidence: 0 }
}

export async function recognizeAudioFile(audioUrl: string, format: string = 'wav', maxWaitSeconds: number = 120): Promise<ASRResult> {
  const taskId = await submitFileRecognition(audioUrl, format)
  const startTime = Date.now()
  while (Date.now() - startTime < maxWaitSeconds * 1000) {
    await new Promise(r => setTimeout(r, 2000))
    const result = await queryFileRecognition(taskId)
    if (result.text) return result
  }
  throw new Error(`ASR file recognition timed out after ${maxWaitSeconds}s`)
}

// ==================== 工具函数 ====================

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  const chunkSize = 8192
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize)
    binary += String.fromCharCode.apply(null, Array.from(chunk))
  }
  return btoa(binary)
}

function generateRequestId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 10)
}
