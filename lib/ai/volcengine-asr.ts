/**
 * 火山引擎 SAUC ASR WebSocket 客户端
 *
 * 严格按官方 demo `sauc_websocket_demo.py` 1:1 实现
 * （之前的版本完全错误：错误的认证、缺 seq 字段、没 gzip、错 flag）
 *
 * 关键变更 vs 旧版：
 * 1. 认证改为 X-Api-Access-Key + X-Api-App-Key + X-Api-Request-Id
 * 2. Resource id 改为 volc.bigasr.sauc.duration
 * 3. Frame 增加 4 字节 seq 字段
 * 4. Payload 必须 gzip 压缩
 * 5. Flags: POS_SEQUENCE (0x01) / NEG_WITH_SEQUENCE (0x03, last, seq 取负)
 * 6. JSON: format=wav, codec=raw, enable_itn/punc/ddc/show_utterances, enable_nonstream=false
 */

import WebSocket from 'ws'
import { gzipSync, gunzipSync } from 'zlib'
import { randomUUID } from 'crypto'

const VOLC_ACCESS_KEY = process.env.VOLCENGINE_API_KEY || ''
const VOLC_APP_KEY = process.env.VOLCENGINE_APP_ID || ''
const ASR_ENDPOINT = 'wss://openspeech.bytedance.com/api/v3/sauc/bigmodel_nostream'
// 注意：账户注册的资源是 seedasr（不是 demo 的 bigasr）
const ASR_RESOURCE_ID = 'volc.seedasr.sauc.duration'

export interface ASRResult {
  text: string
  confidence: number
}

// ==================== 协议常量（官方 demo）====================

const PROTOCOL_VERSION_V1 = 0x01
const HEADER_SIZE = 0x01

const MSG_CLIENT_FULL_REQUEST = 0x01
const MSG_CLIENT_AUDIO_ONLY = 0x02
const MSG_SERVER_FULL_RESPONSE = 0x09
const MSG_SERVER_ERROR_RESPONSE = 0x0F

const FLAG_NO_SEQUENCE = 0x00
const FLAG_POS_SEQUENCE = 0x01
const FLAG_NEG_SEQUENCE = 0x02
const FLAG_NEG_WITH_SEQUENCE = 0x03

const SER_NO_SERIALIZATION = 0x00
const SER_JSON = 0x01

const COMP_NO = 0x00
const COMP_GZIP = 0x01

// ==================== 帧构建（官方 demo RequestBuilder）====================

/**
 * 构建 4 字节 header
 */
function buildHeader(messageType: number, flags: number, ser: number, comp: number): Buffer {
  const header = Buffer.alloc(4)
  header[0] = (PROTOCOL_VERSION_V1 << 4) | HEADER_SIZE
  header[1] = (messageType << 4) | flags
  header[2] = (ser << 4) | comp
  header[3] = 0x00 // reserved
  return header
}

/**
 * 构建完整客户端请求（JSON 配置，gzip 压缩，带 seq）
 */
function buildFullClientRequest(jsonPayload: string, seq: number): Buffer {
  const header = buildHeader(
    MSG_CLIENT_FULL_REQUEST,
    FLAG_POS_SEQUENCE,
    SER_JSON,
    COMP_GZIP
  )
  const compressed = gzipSync(Buffer.from(jsonPayload, 'utf-8'))

  return Buffer.concat([
    header,                                  // 4 bytes
    writeInt32BE(seq),                       // 4 bytes seq
    writeUInt32BE(compressed.length),        // 4 bytes payload size
    compressed,                              // gzip(json)
  ])
}

/**
 * 构建纯音频请求（gzip 压缩，带 seq，last 时 flag 改为 NEG_WITH_SEQUENCE 且 seq 取负）
 */
function buildAudioOnlyRequest(pcm: Buffer, seq: number, isLast: boolean): Buffer {
  const flags = isLast ? FLAG_NEG_WITH_SEQUENCE : FLAG_POS_SEQUENCE
  const actualSeq = isLast ? -seq : seq

  const header = buildHeader(
    MSG_CLIENT_AUDIO_ONLY,
    flags,
    SER_NO_SERIALIZATION,
    COMP_GZIP
  )
  const compressed = gzipSync(pcm)

  return Buffer.concat([
    header,
    writeInt32BE(actualSeq),
    writeUInt32BE(compressed.length),
    compressed,
  ])
}

function writeInt32BE(value: number): Buffer {
  const buf = Buffer.alloc(4)
  buf.writeInt32BE(value, 0)
  return buf
}

function writeUInt32BE(value: number): Buffer {
  const buf = Buffer.alloc(4)
  buf.writeUInt32BE(value, 0)
  return buf
}

// ==================== 响应解析（官方 demo ResponseParser）====================

interface ParsedResponse {
  code: number
  isLastPackage: boolean
  payloadSequence: number
  payloadMsg: any
  messageType: number
  flags: number
}

function parseResponse(msg: Buffer): ParsedResponse {
  const headerSize = msg[0] & 0x0f
  const messageType = msg[1] >> 4
  const messageFlags = msg[1] & 0x0f
  const serializationMethod = msg[2] >> 4
  const messageCompression = msg[2] & 0x0f

  let payload = msg.slice(headerSize * 4)
  const resp: ParsedResponse = {
    code: 0,
    isLastPackage: false,
    payloadSequence: 0,
    payloadMsg: null,
    messageType,
    flags: messageFlags,
  }

  if (messageFlags & 0x01) {
    resp.payloadSequence = payload.readInt32BE(0)
    payload = payload.slice(4)
  }
  if (messageFlags & 0x02) {
    resp.isLastPackage = true
  }
  if (messageFlags & 0x04) {
    payload = payload.slice(4) // skip event
  }

  if (messageType === MSG_SERVER_FULL_RESPONSE) {
    payload = payload.slice(4) // skip size
  } else if (messageType === MSG_SERVER_ERROR_RESPONSE) {
    resp.code = payload.readInt32BE(0)
    payload = payload.slice(8) // skip code + size
  }

  if (payload.length === 0) return resp

  // 解压缩
  if (messageCompression === COMP_GZIP) {
    try {
      payload = gunzipSync(payload)
    } catch {
      return resp
    }
  }

  if (serializationMethod === SER_JSON) {
    try {
      resp.payloadMsg = JSON.parse(payload.toString('utf-8'))
    } catch {}
  }

  return resp
}

// ==================== WAV → PCM ====================

function wavToPcm(wavBuffer: Buffer): Buffer {
  if (wavBuffer.length < 44) throw new Error('Invalid WAV: too short')
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

// ==================== 核心识别 ====================

export async function recognizeSpeech(
  audioData: ArrayBuffer,
  _format?: string,
  _sampleRate?: number
): Promise<ASRResult> {
  if (!VOLC_ACCESS_KEY || !VOLC_APP_KEY) {
    throw new Error('VOLCENGINE_API_KEY or VOLCENGINE_APP_ID not configured')
  }

  const pcmData = wavToPcm(Buffer.from(audioData))
  if (pcmData.length === 0) throw new Error('No PCM data in WAV')

  // init payload：format=pcm（实际发的是去掉 WAV header 的纯 PCM）
  // 其他字段按官方 demo
  const initJson = JSON.stringify({
    user: { uid: 'chatmandarin-user' },
    audio: {
      format: 'pcm',
      codec: 'raw',
      rate: 16000,
      bits: 16,
      channel: 1,
    },
    request: {
      model_name: 'bigmodel',
      enable_itn: true,
      enable_punc: true,
      enable_ddc: true,
      show_utterances: true,
      enable_nonstream: false,
    },
  })

  return new Promise<ASRResult>((resolve, reject) => {
    const requestId = randomUUID()
    let ws: WebSocket
    try {
      // 简化版认证（账户实际支持的方式）+ 同时把 demo 的 headers 也带上做容错
      ws = new WebSocket(ASR_ENDPOINT, {
        headers: {
          'x-api-key': VOLC_ACCESS_KEY,
          'X-Api-Resource-Id': ASR_RESOURCE_ID,
          'X-Api-Request-Id': requestId,
          'X-Api-Access-Key': VOLC_ACCESS_KEY,
          'X-Api-App-Key': VOLC_APP_KEY,
        },
      })
    } catch (err) {
      reject(new Error(`WebSocket init failed: ${(err as Error).message}`))
      return
    }

    let resolved = false
    let seq = 1
    let lastText = ''
    let opened = false

    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true
        try { ws.close() } catch {}
        reject(
          new Error(
            `ASR timeout (30s, opened=${opened}, requestId=${requestId})`
          )
        )
      }
    }, 30000)

    ws.on('unexpected-response', (req, res) => {
      if (!resolved) {
        resolved = true
        clearTimeout(timeout)
        reject(new Error(`ASR HTTP ${res.statusCode} ${res.statusMessage}`))
      }
    })

    ws.on('open', () => {
      opened = true
      try {
        // 1. 发送 full client request（配置）
        ws.send(buildFullClientRequest(initJson, seq))
        seq += 1

        // 2. 切片发送音频（200ms 一段 = 6400 bytes）
        const SEGMENT_SIZE = 6400 // 1 * 2 * 16000 * 200 / 1000
        const segments: Buffer[] = []
        for (let i = 0; i < pcmData.length; i += SEGMENT_SIZE) {
          segments.push(pcmData.slice(i, i + SEGMENT_SIZE))
        }
        if (segments.length === 0) segments.push(Buffer.alloc(0))

        segments.forEach((seg, idx) => {
          const isLast = idx === segments.length - 1
          ws.send(buildAudioOnlyRequest(seg, seq, isLast))
          if (!isLast) seq += 1
        })
      } catch (sendErr) {
        if (!resolved) {
          resolved = true
          clearTimeout(timeout)
          reject(new Error(`ASR ws.send failed: ${(sendErr as Error).message}`))
        }
      }
    })

    ws.on('message', (data: Buffer) => {
      try {
        const resp = parseResponse(data as Buffer)
        if (resp.messageType === MSG_SERVER_ERROR_RESPONSE) {
          if (!resolved) {
            resolved = true
            clearTimeout(timeout)
            try { ws.close() } catch {}
            reject(
              new Error(
                `ASR server error code=${resp.code}: ${
                  typeof resp.payloadMsg === 'string'
                    ? resp.payloadMsg
                    : JSON.stringify(resp.payloadMsg)
                }`
              )
            )
          }
          return
        }

        if (resp.messageType === MSG_SERVER_FULL_RESPONSE && resp.payloadMsg) {
          const text = extractText(resp.payloadMsg)
          if (text) lastText = text

          if (resp.isLastPackage && !resolved) {
            resolved = true
            clearTimeout(timeout)
            try { ws.close() } catch {}
            resolve({ text: text || lastText, confidence: 1.0 })
          }
        }
      } catch {}
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

/**
 * 从 ASR 响应 payload 中提取文本
 */
function extractText(payload: any): string | null {
  if (!payload || typeof payload !== 'object') return null

  // result.text（标准）
  if (typeof payload.result?.text === 'string') return payload.result.text

  // result 是数组
  if (Array.isArray(payload.result)) {
    const texts = payload.result
      .map((r: any) => r?.text || '')
      .filter(Boolean)
    if (texts.length > 0) return texts.join('')
  }

  // utterances 拼接
  if (Array.isArray(payload.utterances) && payload.utterances.length > 0) {
    const texts = payload.utterances
      .map((u: any) => u?.text || (typeof u === 'string' ? u : ''))
      .filter(Boolean)
    if (texts.length > 0) return texts.join('')
  }

  if (typeof payload.text === 'string') return payload.text
  return null
}

// ==================== 录音文件识别（HSKK 用，沿用旧 API）====================

const FILE_ASR_BASE = 'https://openspeech.bytedance.com/api/v1/auc'

export async function submitFileRecognition(audioUrl: string, format: string = 'wav'): Promise<string> {
  if (!VOLC_ACCESS_KEY) throw new Error('VOLCENGINE_API_KEY not configured')
  const res = await fetch(`${FILE_ASR_BASE}/submit`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Api-Access-Key': VOLC_ACCESS_KEY,
      'X-Api-App-Key': VOLC_APP_KEY,
      'X-Api-Resource-Id': ASR_RESOURCE_ID,
    },
    body: JSON.stringify({
      app: { appid: VOLC_APP_KEY, token: VOLC_ACCESS_KEY, cluster: 'volcengine_bigasr' },
      user: { uid: 'chatmandarin-hskk' },
      audio: { format, url: audioUrl },
      additions: { with_speaker_info: 'False' },
    }),
  })
  if (!res.ok) throw new Error(`File ASR submit failed: ${res.status}`)
  const data = await res.json()
  return data.resp?.id || ''
}

export async function queryFileRecognition(taskId: string): Promise<ASRResult> {
  const res = await fetch(`${FILE_ASR_BASE}/query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Api-Access-Key': VOLC_ACCESS_KEY,
      'X-Api-App-Key': VOLC_APP_KEY,
      'X-Api-Resource-Id': ASR_RESOURCE_ID,
    },
    body: JSON.stringify({
      appid: VOLC_APP_KEY,
      token: VOLC_ACCESS_KEY,
      id: taskId,
      cluster: 'volcengine_bigasr',
    }),
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
    await new Promise((r) => setTimeout(r, 2000))
    const result = await queryFileRecognition(taskId)
    if (result.text) return result
  }
  throw new Error(`File ASR timeout after ${maxWait}s`)
}
