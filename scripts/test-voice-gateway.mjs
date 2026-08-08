import { createHash, createHmac, randomUUID } from 'node:crypto'
import { readFileSync, existsSync } from 'node:fs'

loadEnvFile('.env.local')

const durationSeconds = boundedNumber(argument('--duration-seconds'), 120, 120, 300)
const intervalSeconds = boundedNumber(argument('--interval-seconds'), 10, 2, 60)
const audioFile = argument('--audio-file')
const asrFromTts = process.argv.includes('--asr-from-tts')
const baseUrl = (process.env.VOICE_GATEWAY_TEST_URL || process.env.CLOUDFLARE_VOICE_GATEWAY_URL || '')
  .replace(/\/$/, '')
const secret = process.env.VOICE_GATEWAY_SECRET || ''

if (!baseUrl) fail('Set VOICE_GATEWAY_TEST_URL or CLOUDFLARE_VOICE_GATEWAY_URL')
if (!secret) fail('Set VOICE_GATEWAY_SECRET')

const results = []
const deadline = Date.now() + durationSeconds * 1000
console.log(`Voice gateway test: ${durationSeconds}s, interval ${intervalSeconds}s`)

await measure('auth-guard', async () => {
  const response = await fetch(`${baseUrl}/v1/tts`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{}',
    signal: AbortSignal.timeout(10_000),
  })
  if (response.status !== 401) throw new Error(`expected HTTP 401, received ${response.status}`)
})

if (asrFromTts) {
  await measure('asr-loopback', async () => {
    const ttsBody = Buffer.from(JSON.stringify({
      text: '你好，欢迎练习中文。',
      voiceType: 'BV700_streaming',
      encoding: 'wav',
    }))
    const ttsResponse = await signedFetch('/v1/tts', ttsBody, 'application/json')
    const ttsData = await ttsResponse.json()
    if (!ttsResponse.ok || !ttsData.audioBase64) {
      throw new Error(`TTS HTTP ${ttsResponse.status}: ${ttsData.error || 'no WAV audio'}`)
    }
    const wav = Buffer.from(ttsData.audioBase64, 'base64')
    const asrResponse = await signedFetch('/v1/asr', wav, 'audio/wav;rate=16000')
    const asrData = await asrResponse.json()
    if (!asrResponse.ok || typeof asrData.text !== 'string' || !asrData.text.trim()) {
      throw new Error(`ASR HTTP ${asrResponse.status}: ${asrData.error || 'empty transcript'}`)
    }
  })
}

while (Date.now() < deadline) {
  await measure('health', async () => {
    const response = await fetch(`${baseUrl}/health`, { signal: AbortSignal.timeout(10_000) })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
  })

  await measure('tts', async () => {
    const body = Buffer.from(JSON.stringify({ text: '你好，欢迎练习中文。', voiceType: 'BV700_streaming' }))
    const response = await signedFetch('/v1/tts', body, 'application/json')
    const data = await response.json()
    if (!response.ok || !data.audioBase64) throw new Error(`HTTP ${response.status}: ${data.error || 'no audio'}`)
  })

  if (audioFile) {
    await measure('asr', async () => {
      const body = readFileSync(audioFile)
      const response = await signedFetch('/v1/asr', body, 'audio/wav;rate=16000')
      const data = await response.json()
      if (!response.ok || typeof data.text !== 'string') throw new Error(`HTTP ${response.status}: ${data.error || 'no result'}`)
    })
  }

  const remaining = deadline - Date.now()
  if (remaining > 0) await new Promise((resolve) => setTimeout(resolve, Math.min(intervalSeconds * 1000, remaining)))
}

for (const name of [...new Set(results.map((item) => item.name))]) {
  const group = results.filter((item) => item.name === name)
  const successful = group.filter((item) => item.ok)
  const times = successful.map((item) => item.ms).sort((a, b) => a - b)
  console.log(JSON.stringify({
    check: name,
    attempts: group.length,
    successes: successful.length,
    successRate: `${((successful.length / group.length) * 100).toFixed(1)}%`,
    p50Ms: percentile(times, 0.5),
    p95Ms: percentile(times, 0.95),
  }))
}

if (results.some((item) => !item.ok)) process.exitCode = 1

async function signedFetch(path, body, contentType) {
  const timestamp = Math.floor(Date.now() / 1000).toString()
  const nonce = randomUUID()
  const bodyHash = createHash('sha256').update(body).digest('hex')
  const signature = createHmac('sha256', secret)
    .update(`${timestamp}.${nonce}.POST.${path}.${bodyHash}`)
    .digest('hex')
  return fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: {
      'content-type': contentType,
      'x-voice-timestamp': timestamp,
      'x-voice-nonce': nonce,
      'x-voice-signature': signature,
    },
    body,
    signal: AbortSignal.timeout(35_000),
  })
}

async function measure(name, operation) {
  const startedAt = performance.now()
  try {
    await operation()
    const ms = Math.round(performance.now() - startedAt)
    results.push({ name, ok: true, ms })
    console.log(`${name}: ok ${ms}ms`)
  } catch (error) {
    const ms = Math.round(performance.now() - startedAt)
    results.push({ name, ok: false, ms })
    console.error(`${name}: failed ${ms}ms (${error instanceof Error ? error.message : error})`)
  }
}

function loadEnvFile(path) {
  if (!existsSync(path)) return
  for (const rawLine of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const separator = line.indexOf('=')
    if (separator < 1) continue
    const key = line.slice(0, separator).trim()
    const value = line.slice(separator + 1).trim().replace(/^(['"])(.*)\1$/, '$2')
    if (!(key in process.env)) process.env[key] = value
  }
}

function argument(name) {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : undefined
}

function boundedNumber(value, fallback, minimum, maximum) {
  const parsed = Number(value || fallback)
  return Number.isFinite(parsed) ? Math.min(maximum, Math.max(minimum, parsed)) : fallback
}

function percentile(values, fraction) {
  if (!values.length) return null
  return values[Math.min(values.length - 1, Math.ceil(values.length * fraction) - 1)]
}

function fail(message) {
  console.error(message)
  process.exit(2)
}
