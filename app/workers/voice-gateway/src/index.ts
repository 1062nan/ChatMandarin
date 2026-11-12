import { endpointClass, observeProviderAttempt } from '../../../lib/ai/provider-usage'
import { readBoundedBytes } from '../../../lib/http/bounded-json'
const ASR_ENDPOINT = 'wss://openspeech.bytedance.com/api/v3/sauc/bigmodel_nostream'
const TTS_ENDPOINT = 'https://openspeech.bytedance.com/api/v1/tts'
const DEFAULT_RESOURCE_ID = 'volc.seedasr.sauc.duration'
const MAX_AUDIO_BYTES = 5 * 1024 * 1024
const MAX_TEXT_LENGTH = 1000

interface VoiceGatewaySecrets {
  VOICE_GATEWAY_SECRET?: string
  VOLCENGINE_API_KEY?: string
  VOLCENGINE_APP_ID?: string
  VOLCENGINE_ASR_ENDPOINT?: string
  VOLCENGINE_ASR_RESOURCE_ID?: string
  VOLCENGINE_TTS_CLUSTER?: string
}

type Env = VoiceGatewayEnv & VoiceGatewaySecrets

const MSG_CLIENT_FULL_REQUEST = 0x01
const MSG_CLIENT_AUDIO_ONLY = 0x02
const MSG_SERVER_FULL_RESPONSE = 0x09
const MSG_SERVER_ERROR_RESPONSE = 0x0f

interface AsrResult {
  text: string
  confidence: number
}

interface TtsRequest {
  text?: unknown
  voiceType?: unknown
  speedRatio?: unknown
  encoding?: unknown
}

interface ParsedResponse {
  code: number
  isLastPackage: boolean
  payload: unknown
  messageType: number
}

export default {
  async fetch(request, env): Promise<Response> {
    const startedAt = Date.now()
    const url = new URL(request.url)
    const colo = request.cf?.colo || 'unknown'
    let status = 500

    try {
      if (request.method === 'GET' && url.pathname === '/health') {
        status = 200
        return json({ ok: true, colo, placement: 'aws:ap-northeast-1' })
      }

      if (request.method !== 'POST' || !['/v1/asr', '/v1/tts'].includes(url.pathname)) {
        status = 404
        return json({ error: 'Not found' }, 404)
      }

      const bodyLimit = url.pathname === '/v1/tts' ? 16384 : MAX_AUDIO_BYTES
      const contentLength = Number(request.headers.get('content-length') || 0)
      if (contentLength > bodyLimit) {
        status = 413
        return json({ error: 'Request body too large' }, 413)
      }

      const body = await readBoundedBytes(request, bodyLimit)
      if (body.byteLength > bodyLimit) {
        status = 413
        return json({ error: 'Request body too large' }, 413)
      }
      if (!(await verifyRequest(request, url.pathname, body, env.VOICE_GATEWAY_SECRET))) {
        status = 401
        return json({ error: 'Unauthorized' }, 401)
      }

      if (!env.VOLCENGINE_API_KEY || !env.VOLCENGINE_APP_ID) {
        throw new Error('Volcengine credentials are not configured')
      }

      if (url.pathname === '/v1/asr') {
        const result = await recognizeSpeech(body, env)
        status = 200
        return json(result)
      }

      let input: TtsRequest
      try { input = JSON.parse(new TextDecoder('utf-8', { fatal: true, ignoreBOM: false }).decode(body)) }
      catch { status = 400; return json({ error: 'Invalid JSON' }, 400) }
      if (!input || typeof input.text !== 'string' || !input.text.trim() || input.text.length > MAX_TEXT_LENGTH) {
        status = 400; return json({ error: 'Invalid TTS text length' }, 400)
      }
      const result = await synthesizeSpeech(input, env)
      status = 200
      return json(result)
    } catch (error) {
      if (error instanceof RangeError) { status = 413; return json({ error: 'Request body too large' }, 413) }
      console.error(JSON.stringify({ event: 'voice_gateway_error', path: url.pathname, colo }))
      status = 502
      return json({ error: 'Voice upstream request failed' }, 502)
    } finally {
      console.log(JSON.stringify({
        event: 'voice_gateway_request',
        method: request.method,
        path: url.pathname,
        status,
        colo,
        durationMs: Date.now() - startedAt,
      }))
    }
  },
} satisfies ExportedHandler<Env>

async function verifyRequest(
  request: Request,
  path: string,
  body: Uint8Array,
  secret?: string
): Promise<boolean> {
  if (!secret) return false
  const timestamp = request.headers.get('x-voice-timestamp') || ''
  const nonce = request.headers.get('x-voice-nonce') || ''
  const signature = request.headers.get('x-voice-signature') || ''
  if (!/^\d{10}$/.test(timestamp) || !nonce || !/^[a-f0-9]{64}$/.test(signature)) return false
  if (Math.abs(Math.floor(Date.now() / 1000) - Number(timestamp)) > 60) return false

  const bodyHash = await sha256Hex(body)
  const payload = `${timestamp}.${nonce}.${request.method}.${path}.${bodyHash}`
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify']
  )
  return crypto.subtle.verify(
    'HMAC',
    key,
    hexToBytes(signature),
    new TextEncoder().encode(payload)
  )
}

async function recognizeSpeech(wav: Uint8Array, env: Env): Promise<AsrResult> {
  const apiKey = env.VOLCENGINE_API_KEY
  const appId = env.VOLCENGINE_APP_ID
  if (!apiKey || !appId) throw new Error('Volcengine credentials are not configured')
  const pcm = wavToPcm(wav)
  if (pcm.byteLength === 0) throw new Error('WAV contains no PCM data')

  const websocketEndpoint = env.VOLCENGINE_ASR_ENDPOINT || ASR_ENDPOINT
  const upgradeEndpoint = websocketEndpoint.replace(/^wss:/, 'https:').replace(/^ws:/, 'http:')
  return observeProviderAttempt({ provider: 'volcengine', operation: 'asr', transport: 'cloudflare_worker',
    endpointClass: endpointClass(websocketEndpoint, 'openspeech.bytedance.com'),
    resource: !env.VOLCENGINE_ASR_RESOURCE_ID || env.VOLCENGINE_ASR_RESOURCE_ID === DEFAULT_RESOURCE_ID ? 'volc.seedasr.sauc.duration' : 'custom',
    offeredAudioSeconds: pcm.byteLength / 32000,
  }, async observe => {
  const response = await fetch(upgradeEndpoint, {
    headers: {
      Upgrade: 'websocket',
      'x-api-key': apiKey,
      'X-Api-Access-Key': apiKey,
      'X-Api-App-Key': appId,
      'X-Api-Resource-Id': env.VOLCENGINE_ASR_RESOURCE_ID || DEFAULT_RESOURCE_ID,
      'X-Api-Request-Id': crypto.randomUUID(),
    },
  })
  observe({ httpStatus: response.status })
  const ws = response.webSocket
  if (!ws) throw new Error(`ASR upgrade failed with HTTP ${response.status}`)
  ws.accept()

  const init = JSON.stringify({
    user: { uid: 'chatmandarin-user' },
    audio: { format: 'pcm', codec: 'raw', rate: 16000, bits: 16, channel: 1 },
    request: {
      model_name: 'bigmodel',
      enable_itn: true,
      enable_punc: true,
      enable_ddc: true,
      show_utterances: true,
      enable_nonstream: false,
    },
  })

  return new Promise<AsrResult>((resolve, reject) => {
    let finished = false
    let lastText = ''
    const timeout = setTimeout(() => finish(new Error('ASR timed out after 30 seconds')), 30_000)

    const finish = (error?: Error, text = lastText) => {
      if (finished) return
      finished = true
      clearTimeout(timeout)
      try { ws.close(1000, 'complete') } catch {}
      if (error) reject(error)
      else resolve({ text, confidence: 1 })
    }

    ws.addEventListener('message', (event) => {
      void (async () => {
        try {
          const bytes = await messageBytes(event.data)
          const parsed = await parseResponse(bytes)
          if (parsed.messageType === MSG_SERVER_ERROR_RESPONSE) {
            finish(new Error(`ASR server error ${parsed.code}`))
            return
          }
          if (parsed.messageType === MSG_SERVER_FULL_RESPONSE) {
            const text = extractText(parsed.payload)
            if (text) lastText = text
            if (parsed.isLastPackage) finish(undefined, text || lastText)
          }
        } catch (error) {
          finish(error instanceof Error ? error : new Error(String(error)))
        }
      })()
    })
    ws.addEventListener('error', () => finish(new Error('ASR WebSocket error')))
    ws.addEventListener('close', () => {
      if (!finished) {
        if (lastText) finish()
        else finish(new Error('ASR closed without a result'))
      }
    })

    void (async () => {
      try {
        let sequence = 1
        ws.send(await buildFullRequest(init, sequence++))
        const segmentSize = 6400
        for (let offset = 0; offset < pcm.byteLength; offset += segmentSize) {
          const end = Math.min(offset + segmentSize, pcm.byteLength)
          const isLast = end === pcm.byteLength
          ws.send(await buildAudioRequest(pcm.slice(offset, end), sequence, isLast))
          if (!isLast) sequence++
        }
      } catch (error) {
        finish(error instanceof Error ? error : new Error(String(error)))
      }
    })()
  })
  })
}

async function synthesizeSpeech(input: TtsRequest, env: Env) {
  const apiKey = env.VOLCENGINE_API_KEY
  const appId = env.VOLCENGINE_APP_ID
  if (!apiKey || !appId) throw new Error('Volcengine credentials are not configured')
  if (typeof input.text !== 'string' || !input.text.trim()) throw new Error('TTS text is empty')
  const text = input.text.slice(0, MAX_TEXT_LENGTH)
  const voiceType = typeof input.voiceType === 'string' ? input.voiceType : 'BV700_streaming'
  const speedRatio = typeof input.speedRatio === 'number'
    ? Math.min(2, Math.max(0.5, input.speedRatio))
    : 1
  const allowedEncodings = ['mp3', 'wav', 'pcm', 'ogg_opus']
  const encoding = typeof input.encoding === 'string' && allowedEncodings.includes(input.encoding)
    ? input.encoding
    : 'mp3'

  return observeProviderAttempt({ provider: 'volcengine', operation: 'tts', transport: 'cloudflare_worker',
    endpointClass: 'official', resource: 'legacy_tts', inputCharacters: [...text].length,
  }, async observe => {
  const response = await fetch(TTS_ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': apiKey },
    body: JSON.stringify({
      app: {
        appid: appId,
        token: apiKey,
        cluster: env.VOLCENGINE_TTS_CLUSTER || 'volcano_tts',
      },
      user: { uid: 'chatmandarin-user' },
      audio: { voice_type: voiceType, encoding, speed_ratio: speedRatio, volume_ratio: 1, pitch_ratio: 1 },
      request: {
        reqid: crypto.randomUUID(),
        text,
        text_type: 'plain',
        operation: 'query',
        with_frontend: 1,
        frontend_type: 'unitTson',
      },
    }),
  })
  observe({ httpStatus: response.status })
  if (!response.ok) throw new Error(`TTS upstream returned HTTP ${response.status}`)
  const data = await response.json() as { code?: number; message?: string; data?: string; duration?: string | number }
  if (data.code !== 3000 || !data.data) throw new Error('TTS upstream rejected synthesis')
  return {
    audioBase64: data.data,
    duration: Number(data.duration) || (text.length * 0.3) / speedRatio,
  }
  })
}

async function buildFullRequest(jsonPayload: string, sequence: number): Promise<Uint8Array> {
  const compressed = await gzip(new TextEncoder().encode(jsonPayload))
  return concat(
    header(MSG_CLIENT_FULL_REQUEST, 0x01, 0x01, 0x01),
    int32(sequence),
    uint32(compressed.byteLength),
    compressed
  )
}

async function buildAudioRequest(pcm: Uint8Array, sequence: number, isLast: boolean): Promise<Uint8Array> {
  const compressed = await gzip(pcm)
  return concat(
    header(MSG_CLIENT_AUDIO_ONLY, isLast ? 0x03 : 0x01, 0x00, 0x01),
    int32(isLast ? -sequence : sequence),
    uint32(compressed.byteLength),
    compressed
  )
}

async function parseResponse(message: Uint8Array): Promise<ParsedResponse> {
  if (message.byteLength < 4) throw new Error(`Invalid ASR response (${message.byteLength} bytes)`)
  const headerSize = message[0] & 0x0f
  const messageType = message[1] >> 4
  const flags = message[1] & 0x0f
  const serialization = message[2] >> 4
  const compression = message[2] & 0x0f
  let offset = headerSize * 4
  let code = 0
  if (flags & 0x01) offset += 4
  if (flags & 0x04) offset += 4
  if (messageType === MSG_SERVER_FULL_RESPONSE) offset += 4
  if (messageType === MSG_SERVER_ERROR_RESPONSE) {
    code = new DataView(message.buffer, message.byteOffset + offset, 4).getInt32(0)
    offset += 8
  }

  let payloadBytes: Uint8Array<ArrayBufferLike> = message.slice(offset)
  if (compression === 0x01 && payloadBytes.byteLength) payloadBytes = await gunzip(payloadBytes)
  let payload: unknown = null
  if (serialization === 0x01 && payloadBytes.byteLength) {
    payload = JSON.parse(new TextDecoder().decode(payloadBytes))
  }
  return { code, isLastPackage: Boolean(flags & 0x02), payload, messageType }
}

function wavToPcm(wav: Uint8Array): Uint8Array {
  if (wav.byteLength < 44 || new TextDecoder().decode(wav.slice(0, 4)) !== 'RIFF') {
    throw new Error('Expected a RIFF WAV file')
  }
  const view = new DataView(wav.buffer, wav.byteOffset, wav.byteLength)
  let offset = 12
  while (offset + 8 <= wav.byteLength) {
    const id = new TextDecoder().decode(wav.slice(offset, offset + 4))
    const size = view.getUint32(offset + 4, true)
    if (id === 'data') return wav.slice(offset + 8, Math.min(offset + 8 + size, wav.byteLength))
    offset += 8 + size + (size % 2)
  }
  return wav.slice(44)
}

function extractText(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null
  const value = payload as Record<string, unknown>
  const result = value.result
  if (result && typeof result === 'object' && !Array.isArray(result)) {
    const text = (result as Record<string, unknown>).text
    if (typeof text === 'string') return text
  }
  if (Array.isArray(result)) {
    const text = result.map((item) => (
      item && typeof item === 'object' ? (item as Record<string, unknown>).text : ''
    )).filter((item): item is string => typeof item === 'string' && Boolean(item)).join('')
    if (text) return text
  }
  if (typeof value.text === 'string') return value.text
  return null
}

async function gzip(value: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([value]).stream().pipeThrough(new CompressionStream('gzip'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

async function gunzip(value: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([value]).stream().pipeThrough(new DecompressionStream('gzip'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

async function messageBytes(value: unknown): Promise<Uint8Array> {
  if (typeof value === 'string') return new TextEncoder().encode(value)
  if (value instanceof ArrayBuffer) return new Uint8Array(value)
  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength)
  }
  if (value instanceof Blob) return new Uint8Array(await value.arrayBuffer())
  throw new Error(`Unsupported ASR message type: ${typeof value}`)
}

function header(type: number, flags: number, serialization: number, compression: number): Uint8Array {
  return new Uint8Array([0x11, (type << 4) | flags, (serialization << 4) | compression, 0])
}

function int32(value: number): Uint8Array {
  const bytes = new Uint8Array(4)
  new DataView(bytes.buffer).setInt32(0, value)
  return bytes
}

function uint32(value: number): Uint8Array {
  const bytes = new Uint8Array(4)
  new DataView(bytes.buffer).setUint32(0, value)
  return bytes
}

function concat(...values: Uint8Array[]): Uint8Array {
  const output = new Uint8Array(values.reduce((sum, item) => sum + item.byteLength, 0))
  let offset = 0
  for (const value of values) {
    output.set(value, offset)
    offset += value.byteLength
  }
  return output
}

async function sha256Hex(value: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', value)
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

function hexToBytes(value: string): Uint8Array {
  return new Uint8Array(value.match(/.{2}/g)?.map((byte) => Number.parseInt(byte, 16)) || [])
}

function json(value: unknown, status = 200): Response {
  return Response.json(value, {
    status,
    headers: { 'cache-control': 'no-store', 'content-type': 'application/json; charset=utf-8' },
  })
}
