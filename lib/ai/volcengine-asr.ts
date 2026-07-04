/**
 * 火山引擎语音识别（ASR）客户端
 *
 * 认证：x-api-key + X-Api-Resource-Id（API Key 方式）
 * 协议：WebSocket 二进制（非 HTTP）
 *
 * 参考：workstick 项目 src-tauri/src/asr/
 * Endpoint：wss://openspeech.bytedance.com/api/v3/sauc/bigmodel
 */

import WebSocket from 'ws'

const VOLC_API_KEY = process.env.VOLCENGINE_API_KEY || ''
const ASR_ENDPOINT = process.env.VOLCENGINE_ASR_ENDPOINT || 'wss://openspeech.bytedance.com/api/v3/sauc/bigmodel'
const ASR_RESOURCE_ID = process.env.VOLCENGINE_ASR_RESOURCE_ID || 'volc.seedasr.sauc.duration'

export interface ASRResult {
  text: string
  confidence: number
}

// ==================== 二进制协议常量 ====================

const MT_FULL_CLIENT_REQUEST = 0x01
const MT_AUDIO_CLIENT_REQUEST = 0x02
const MT_FULL_SERVER_RESPONSE = 0x09
const MT_ERROR = 0x0F

const SER_JSON = 0x01
const SER_RAW = 0x00
const COMP_NONE = 0x00

const FLAG_NO_SEQ = 0x00
const FLAG_LAST_NO_SEQ = 0x02

// ==================== 帧构建 ====================

function buildHeader(msgType: number, flags: number, serialization: number, compression: number): Buffer {
  const header = Buffer.alloc(4)
  header[0] = (1 << 4) | 1
  header[1] = (msgType << 4) | flags
  header[2] = (serialization << 4) | compression
  header[3] = 0
  return header
}

function buildFullRequest(jsonPayload: string): Buffer {
  const payloadBuf = Buffer.from(jsonPayload, 'utf-8')
  const header = buildHeader(MT_FULL_CLIENT_REQUEST, FLAG_NO_SEQ, SER_JSON, COMP_NONE)
  const sizeBuf = Buffer.alloc(4)
  sizeBuf.writeUInt32BE(payloadBuf.length, 0)
  return Buffer.concat([header, sizeBuf, payloadBuf])
}

function buildAudioRequest(pcmData: Buffer, isLast: boolean): Buffer {
  const flags = isLast ? FLAG_LAST_NO_SEQ : FLAG_NO_SEQ
  const header = buildHeader(MT_AUDIO_CLIENT_REQUEST, flags, SER_RAW, COMP_NONE)
  const sizeBuf = Buffer.alloc(4)
  sizeBuf.writeUInt32BE(pcmData.length, 0)
  return Buffer.concat([header, sizeBuf, pcmData])
}

// ==================== 响应解析 ====================

interface ServerFrame {
  msgType: number
  flags: number
  payload: Buffer
}

function parseServerFrame(data: Buffer): ServerFrame | null {
  if (data.length < 4) return null

  const msgType = data[1] >> 4
  const flags = data[1] & 0x0f

  if (msgType === MT_ERROR) {
    if (data.length < 12) return null
    const errorCode = data.readUInt32BE(4)
    const msgSize = data.readUInt32BE(8)
    const errorMsg = data.slice(12, 12 + msgSize).toString('utf-8')
    const payload = Buffer.from(JSON.stringify({ code: errorCode, message: errorMsg }))
    return { msgType, flags, payload }
  }

  const hasSeq = (flags & 0x01) !== 0
  const seqSize = hasSeq ? 4 : 0
  const offset = 4 + seqSize

  if (data.length < offset + 4) return null

  const payloadSize = data.readUInt32BE(offset)
  const payloadStart = offset + 4

  if (data.length < payloadStart + payloadSize) return null

  return { msgType, flags, payload: data.slice(payloadStart, payloadStart + payloadSize) }
}

// ==================== WAV → PCM ====================

function wavToPcm(wavBuffer: Buffer): Buffer {
  if (wavBuffer.length < 44) throw new Error('Invalid WAV: too short')
  if (wavBuffer.slice(0, 4).toString() !== 'RIFF') throw new Error('Invalid WAV: not RIFF')

  let pos = 12
  while (pos < wavBuffer.length - 8) {
    const chunkId = wavBuffer.slice(pos, pos + 4).toString('ascii')
    const chunkSize = wavBuffer.readUInt32LE(pos + 4)
    if (chunkId === 'data') return wavBuffer.slice(pos + 8, pos + 8 + chunkSize)
    // chunk size 是奇数时需要 padding byte
    pos += 8 + chunkSize + (chunkSize % 2)
  }
  return wavBuffer.slice(44)
}

// ==================== 核心识别函数 ====================

/**
 * 语音识别（WebSocket 大模型）
 * 接收 WAV 音频 → 转 PCM → WebSocket 发送 → 等待结果
 */
export async function recognizeSpeech(
  audioData: ArrayBuffer,
  _format?: string,
  _sampleRate?: number
): Promise<ASRResult> {
  if (!VOLC_API_KEY) throw new Error('VOLCENGINE_API_KEY is not configured')

  const wavBuffer = Buffer.from(audioData)
  const pcmData = wavToPcm(wavBuffer)
  if (pcmData.length === 0) throw new Error('No PCM data in WAV')

  const initJson = JSON.stringify({
    user: { uid: 'chatmandarin-user' },
    audio: { format: 'pcm', rate: 16000, bits: 16, channel: 1 },
    request: { model_name: 'bigmodel', enable_punc: true, result_type: 'single' }
  })

  return new Promise<ASRResult>((resolve, reject) => {
    const ws = new WebSocket(ASR_ENDPOINT, {
      headers: {
        'x-api-key': VOLC_API_KEY,
        'X-Api-Resource-Id': ASR_RESOURCE_ID
      }
    })

    let resolved = false
    let lastText = ''  // 保存最后一次非空识别结果

    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true
        try { ws.close() } catch {}
        reject(new Error('ASR timeout (30s)'))
      }
    }, 30000)

    ws.on('open', () => {
      // 发送配置
      ws.send(buildFullRequest(initJson))

      // 分段发送 PCM（每段 6400 字节 ≈ 200ms）
      const SEGMENT_SIZE = 6400
      let offset = 0
      while (offset < pcmData.length) {
        const end = Math.min(offset + SEGMENT_SIZE, pcmData.length)
        const isLast = end >= pcmData.length
        ws.send(buildAudioRequest(pcmData.slice(offset, end), isLast))
        offset = end
      }
    })

    ws.on('message', (data: Buffer) => {
      const frame = parseServerFrame(data as Buffer)
      if (!frame) return

      if (frame.msgType === MT_ERROR) {
        if (!resolved) {
          resolved = true
          clearTimeout(timeout)
          try { ws.close() } catch {}
          try {
            const err = JSON.parse(frame.payload.toString('utf-8'))
            reject(new Error(`ASR error: ${err.message} (code: ${err.code})`))
          } catch {
            reject(new Error(`ASR error: ${frame.payload.toString('utf-8')}`))
          }
        }
        return
      }

      if (frame.msgType === MT_FULL_SERVER_RESPONSE) {
        try {
          const json = JSON.parse(frame.payload.toString('utf-8'))
          const text = extractText(json)

          const isLast = (frame.flags & 0x02) !== 0

          // 保存最后一次非空结果（防止最终帧 text 为空）
          if (text) lastText = text

          if (isLast && !resolved) {
            resolved = true
            clearTimeout(timeout)
            try { ws.close() } catch {}
            resolve({ text: text || lastText, confidence: 1.0 })
          }
        } catch {}
      }
    })

    ws.on('error', (err: Error) => {
      if (!resolved) {
        resolved = true
        clearTimeout(timeout)
        reject(new Error(`WebSocket error: ${err.message}`))
      }
    })

    ws.on('close', () => {
      if (!resolved) {
        resolved = true
        clearTimeout(timeout)
        if (lastText) {
          resolve({ text: lastText, confidence: 1.0 })
        } else {
          reject(new Error('ASR connection closed without result'))
        }
      }
    })
  })
}

function extractText(json: any): string | null {
  if (json.result?.text && typeof json.result.text === 'string') return json.result.text
  if (Array.isArray(json.result) && json.result[0]?.text) return json.result[0].text
  if (typeof json.result === 'string') return json.result
  return null
}

// ==================== 录音文件识别（异步 HTTP，HSKK 用） ====================

const VOLC_APP_ID = process.env.VOLCENGINE_APP_ID || ''
const FILE_ASR_BASE = 'https://openspeech.bytedance.com/api/v1/auc'

export async function submitFileRecognition(audioUrl: string, format: string = 'wav'): Promise<string> {
  if (!VOLC_API_KEY) throw new Error('VOLCENGINE_API_KEY is not configured')

  const response = await fetch(`${FILE_ASR_BASE}/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer;${VOLC_API_KEY}` },
    body: JSON.stringify({
      app: { appid: VOLC_APP_ID, token: VOLC_API_KEY, cluster: process.env.VOLCENGINE_ASR_FILE_CLUSTER || 'volcengine_bigasr' },
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
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer;${VOLC_API_KEY}` },
    body: JSON.stringify({ appid: VOLC_APP_ID, token: VOLC_API_KEY, id: taskId, cluster: process.env.VOLCENGINE_ASR_FILE_CLUSTER || 'volcengine_bigasr' })
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
