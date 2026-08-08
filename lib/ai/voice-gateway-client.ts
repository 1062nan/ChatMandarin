import { createHmac, createHash, randomUUID } from 'crypto'

type VoiceRoute = 'direct' | 'cloudflare' | 'tokyo'

function configuredRoute(): VoiceRoute {
  const value = (process.env.VOLCENGINE_ROUTE || '').toLowerCase()
  if (value === 'cloudflare' || value === 'tokyo' || value === 'direct') return value
  return process.env.CLOUDFLARE_VOICE_GATEWAY_URL ? 'cloudflare' : 'direct'
}

export function usesVoiceGateway(): boolean {
  return configuredRoute() !== 'direct'
}

function gatewayUrls(): string[] {
  const route = configuredRoute()
  if (route === 'direct') return []

  const primary = route === 'cloudflare'
    ? process.env.CLOUDFLARE_VOICE_GATEWAY_URL
    : process.env.TOKYO_VOICE_GATEWAY_URL
  const fallback = route === 'cloudflare'
    ? process.env.TOKYO_VOICE_GATEWAY_URL
    : process.env.CLOUDFLARE_VOICE_GATEWAY_URL

  return [primary, fallback]
    .filter((value): value is string => Boolean(value))
    .map((value) => value.replace(/\/$/, ''))
}

export async function callVoiceGateway<T>(
  path: '/v1/asr' | '/v1/tts',
  body: Uint8Array,
  contentType: string
): Promise<T> {
  const secret = process.env.VOICE_GATEWAY_SECRET
  const urls = gatewayUrls()
  if (!secret) throw new Error('VOICE_GATEWAY_SECRET is not configured')
  if (urls.length === 0) throw new Error('Voice gateway URL is not configured')

  let lastError: Error | undefined
  for (const baseUrl of urls) {
    try {
      const timestamp = Math.floor(Date.now() / 1000).toString()
      const nonce = randomUUID()
      const bodyHash = createHash('sha256').update(body).digest('hex')
      const payload = `${timestamp}.${nonce}.POST.${path}.${bodyHash}`
      const signature = createHmac('sha256', secret).update(payload).digest('hex')
      const response = await fetch(`${baseUrl}${path}`, {
        method: 'POST',
        headers: {
          'content-type': contentType,
          'x-voice-timestamp': timestamp,
          'x-voice-nonce': nonce,
          'x-voice-signature': signature,
        },
        body: body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength) as ArrayBuffer,
        signal: AbortSignal.timeout(35_000),
      })

      const result = await response.json().catch(() => null) as T | { error?: string } | null
      if (!response.ok) {
        const message = result && typeof result === 'object' && 'error' in result ? result.error : undefined
        throw new Error(`Voice gateway ${response.status}${message ? `: ${message}` : ''}`)
      }
      return result as T
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
    }
  }

  throw lastError || new Error('Voice gateway request failed')
}
