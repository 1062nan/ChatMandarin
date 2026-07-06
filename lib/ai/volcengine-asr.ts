/**
 * 火山引擎语音识别（ASR）客户端
 *
 * 严格按照 workstick 项目 + sauc_websocket_demo.py 实现：
 * - 认证：x-api-key header（workstick 方式）
 * - 协议：WebSocket 二进制（无 Gzip，参考 workstick protocol.rs）
 * - Endpoint：bigmodel_nostream（一次性识别，参考 sauc_websocket_demo.py）
 * - 音频：PCM raw bytes（参考 workstick build_audio_request）
 */

import WebSocket from 'ws'

const VOLC_API_KEY = process.env.VOLCENGINE_API_KEY || ''
const ASR_ENDPOINT = 'wss://openspeech.bytedance.com/api/v3/sauc/bigmodel_nostream'
const ASR_RESOURCE_ID = 'volc.seedasr.sauc.duration'

export interface ASRResult {
  text: string
  confidence: number
}

// ==================== 协议常量（workstick protocol.rs）====================

const MT_FULL_CLIENT_REQUEST = 0x01
const MT_AUDIO_CLIENT_REQUEST = 0x02
const MT_FULL_SERVER_RESPONSE = 0x09
const MT_ERROR = 0x0F

const SER_JSON = 0x01
const SER_RAW = 0x00
const COMP_NONE = 0x00

const FLAG_NO_SEQ = 0x00
const FLAG_LAST_NO_SEQ = 0x02

// ==================== 帧构建（workstick protocol.rs build_frame）====================

function buildFrame(msgType: number, flags: number, ser: number, comp: number, payload: Buffer): Buffer {
  const frame = Buffer.alloc(4 + 4 + payload.length)
  frame[0] = (1 << 4) | 1                    // protocol version | header size
  frame[1] = (msgType << 4) | flags          // message type | flags
  frame[2] = (ser << 4) | comp               // serialization | compression
  frame[3] = 0                                 // reserved
  frame.writeUInt32BE(payload.length, 4)        // payload size (big-endian)
  payload.copy(frame, 8)                       // payload
  return frame
}

function buildFullRequest(json: string): Buffer {
  return buildFrame(MT_FULL_CLIENT_REQUEST, FLAG_NO_SEQ, SER_JSON, COMP_NONE, Buffer.from(json, 'utf-8'))
}

function buildAudioRequest(pcm: Buffer, isLast: boolean): Buffer {
  return buildFrame(
    MT_AUDIO_CLIENT_REQUEST,
    isLast ? FLAG_LAST_NO_SEQ : FLAG_NO_SEQ,
    SER_RAW,
    COMP_NONE,
    pcm
  )
}

// ==================== 响应解析（workstick protocol.rs parse_server_frame）====================

function parseServerFrame(data: Buffer): { msgType: number; flags: number; payload: Buffer } | null {
  if (data.length < 4) return null

  const msgType = data[1] >> 4
  const flags = data[1] & 0x0f

  // 错误帧
  if (msgType === MT_ERROR) {
    if (data.length < 12) return null
    const errorCode = data.readUInt32BE(4)
    const msgSize = data.readUInt32BE(8)
    const safeSize = Math.min(msgSize, data.length - 12)
    return {
      msgType,
      flags,
      payload: Buffer.from(JSON.stringify({ code: errorCode, message: data.slice(12, 12 + safeSize).toString('utf-8') }))
    }
  }

  // 正常帧
  const hasSeq = (flags & 0x01) !== 0
  const offset = 4 + (hasSeq ? 4 : 0)
  if (data.length < offset + 4) return null

  const payloadSize = data.readUInt32BE(offset)
  const payloadStart = offset + 4
  return { msgType, flags, payload: data.slice(payloadStart, payloadStart + payloadSize) }
}

// ==================== WAV → PCM ====================

function wavToPcm(wavBuffer: Buffer): Buffer {
  if (wavBuffer.length < 44) throw new Error('Invalid WAV')
  if (wavBuffer.slice(0, 4).toString() !== 'RIFF') throw new Error('Not RIFF format')

  let pos = 12
  while (pos < wavBuffer.length - 8) {
    const chunkId = wavBuffer.slice(pos, pos + 4).toString('ascii')
    const chunkSize = wavBuffer.readUInt32LE(pos + 4)
    if (chunkId === 'data') return wavBuffer.slice(pos + 8, pos + 8 + chunkSize)
    pos += 8 + chunkSize + (chunkSize % 2)
  }
  return wavBuffer.slice(44)
}

// ==================== 核心识别（WebSocket bigmodel_nostream）====================

export async function recognizeSpeech(
  audioData: ArrayBuffer,
  _format?: string,
  _sampleRate?: number
): Promise<ASRResult> {
  if (!VOLC_API_KEY) throw new Error('VOLCENGINE_API_KEY is not configured')

  const pcmData = wavToPcm(Buffer.from(audioData))
  if (pcmData.length === 0) throw new Error('No PCM data in WAV')

  // 初始化配置（workstick build_init_json）
  const initJson = JSON.stringify({
    user: { uid: 'chatmandarin-user' },
    audio: { format: 'pcm', rate: 16000, bits: 16, channel: 1 },
    request: { model_name: 'bigmodel', enable_punc: true, result_type: 'single' }
  })

  return new Promise<ASRResult>((resolve, reject) => {
    // 连接（workstick client.rs:75-78）
    const ws = new WebSocket(ASR_ENDPOINT, {
      headers: {
        'x-api-key': VOLC_API_KEY,
        'X-Api-Resource-Id': ASR_RESOURCE_ID
      }
    })

    let resolved = false
    let lastText = ''

    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true
        try { ws.close() } catch {}
        reject(new Error('ASR timeout (15s)'))
      }
    }, 15000)

    ws.on('open', () => {
      // 1. 发送配置（workstick: build_full_request）
      ws.send(buildFullRequest(initJson))

      // 2. 发送音频 PCM（workstick: build_audio_request, isLast=false）
      const SEGMENT_SIZE = 6400 // 200ms @ 16kHz 16bit
      let offset = 0
      while (offset < pcmData.length) {
        const end = Math.min(offset + SEGMENT_SIZE, pcmData.length)
        const isLast = end >= pcmData.length
        ws.send(buildAudioRequest(pcmData.slice(offset, end), isLast))
        offset = end
      }

      // 3. 发送空结束包（workstick: build_audio_request with isLast=true, empty data）
      if (pcmData.length === 0) {
        ws.send(buildAudioRequest(Buffer.alloc(0), true))
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
            reject(new Error(`ASR error (code ${err.code}): ${err.message}`))
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
          if (text) lastText = text

          // 检查是否最后一包（flags bit 1 = last）
          const isLast = (frame.flags & 0x02) !== 0
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
        if (lastText) resolve({ text: lastText, confidence: 1.0 })
        else reject(new Error('ASR closed without result'))
      }
    })
  })
}

// ==================== 文本提取（workstick extract_text_from_result）====================

function extractText(json: any): string | null {
  // v3 bigmodel: result.text
  if (json.result?.text && typeof json.result.text === 'string') return json.result.text
  // v2 legacy: result[0].text
  if (Array.isArray(json.result) && json.result[0]?.text) return json.result[0].text
  if (typeof json.result === 'string') return json.result
  return null
}

// ==================== 录音文件识别（HSKK 用） ====================

const VOLC_APP_ID = process.env.VOLCENGINE_APP_ID || ''
const FILE_ASR_BASE = 'https://openspeech.bytedance.com/api/v1/auc'

export async function submitFileRecognition(audioUrl: string, format: string = 'wav'): Promise<string> {
  if (!VOLC_API_KEY) throw new Error('VOLCENGINE_API_KEY is not configured')
  const res = await fetch(`${FILE_ASR_BASE}/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer;${VOLC_API_KEY}` },
    body: JSON.stringify({
      app: { appid: VOLC_APP_ID, token: VOLC_API_KEY, cluster: process.env.VOLCENGINE_ASR_FILE_CLUSTER || 'volcengine_bigasr' },
      user: { uid: 'chatmandarin-hskk' },
      audio: { format, url: audioUrl },
      additions: { with_speaker_info: 'False' }
    })
  })
  if (!res.ok) throw new Error(`File ASR submit failed: ${res.status}`)
  const data = await res.json()
  return data.resp?.id || ''
}

export async function queryFileRecognition(taskId: string): Promise<ASRResult> {
  const res = await fetch(`${FILE_ASR_BASE}/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer;${VOLC_API_KEY}` },
    body: JSON.stringify({ appid: VOLC_APP_ID, token: VOLC_API_KEY, id: taskId, cluster: process.env.VOLCENGINE_ASR_FILE_CLUSTER || 'volcengine_bigasr' })
  })
  const data = await res.json()
  if (data.resp?.code === 1000) return { text: data.resp?.text || '', confidence: 1.0 }
  if (data.resp?.code < 2000) throw new Error(`ASR failed: ${data.resp?.message}`)
  return { text: '', confidence: 0 }
}

export async function recognizeAudioFile(audioUrl: string, format: string = 'wav', maxWait: number = 120): Promise<ASRResult> {
  const taskId = await submitFileRecognition(audioUrl, format)
  const start = Date.now()
  while (Date.now() - start < maxWait * 1000) {
    await new Promise(r => setTimeout(r, 2000))
    const result = await queryFileRecognition(taskId)
    if (result.text) return result
  }
  throw new Error(`File ASR timeout after ${maxWait}s`)
}
