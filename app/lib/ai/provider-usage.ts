/** Aggregate operational telemetry, NOT an invoice or a learner entitlement ledger.
 * Only this explicit allowlist reaches logs. Never pass bodies, errors, URLs or IDs.
 * Shared with the voice worker: no Node-only imports or database dependencies.
 */
export type ProviderAttempt = {
  provider: 'deepseek' | 'volcengine'
  operation: 'conversation' | 'hskk_score' | 'asr' | 'tts'
  transport: 'direct' | 'cloudflare_worker'
  endpointClass: 'official' | 'compatible' | 'unknown'
  resource: 'deepseek-chat' | 'volc.seedasr.sauc.duration' | 'legacy_tts' | 'custom'
  inputCharacters?: number
  offeredAudioSeconds?: number
}

function nonnegative(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null
}
function tokens(value: unknown): number | null {
  const number = nonnegative(value)
  return number !== null && Number.isSafeInteger(number) ? number : null
}
export function endpointClass(base: string, officialHost: string): ProviderAttempt['endpointClass'] {
  try { return new URL(base).hostname === officialHost ? 'official' : 'compatible' }
  catch { return 'unknown' }
}
export function safeModel(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const known = new Set(['deepseek-chat', 'deepseek-reasoner', 'deepseek-flash',
    'deepseek-v4-flash', 'deepseek-v4-pro', 'deepseek-v4.1-flash',
    'deepseek-v4.1-flash-1017', 'deepseek-v4-pro-0813'])
  return known.has(value.toLowerCase()) ? value.toLowerCase() : 'other'
}
export function tokenEvidence(raw: unknown) {
  const usage = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {}
  return {
    prompt_tokens: tokens(usage.prompt_tokens),
    completion_tokens: tokens(usage.completion_tokens),
    total_tokens: tokens(usage.total_tokens),
    prompt_cache_hit_tokens: tokens(usage.prompt_cache_hit_tokens),
    prompt_cache_miss_tokens: tokens(usage.prompt_cache_miss_tokens),
  }
}

type Evidence = { model?: unknown; usage?: unknown; httpStatus?: number }
export async function observeProviderAttempt<T>(
  input: ProviderAttempt,
  run: (observe: (evidence: Evidence) => void) => Promise<T>,
): Promise<T> {
  const started = Date.now()
  // Random attempt ID is never derived from learner data and is not sent to providers.
  let attemptId: string | null = null
  try { attemptId = crypto.randomUUID() } catch { /* optional diagnostic correlation */ }
  let status: 'completed' | 'failed' = 'failed'
  let evidence: Evidence = {}
  try {
    const result = await run(value => { evidence = { ...evidence, ...value } })
    status = 'completed'
    return result
  } finally {
    try {
      const event = {
        event: 'provider_usage_attempt', schema_version: 1,
        attempt_id: attemptId, timestamp: new Date().toISOString(),
        provider: input.provider, operation: input.operation, transport: input.transport,
        endpoint_class: input.endpointClass, requested_resource: input.resource,
        status, elapsed_ms: Math.max(0, Date.now() - started),
        http_status: tokens(evidence.httpStatus), returned_model: safeModel(evidence.model),
        ...tokenEvidence(evidence.usage),
        input_characters: tokens(input.inputCharacters),
        offered_audio_seconds: nonnegative(input.offeredAudioSeconds),
        // Unknown charge is not zero. Even failures/timeouts may be billed.
        billed_cost: null, currency: null,
      }
      console.info(JSON.stringify(event))
    } catch { /* telemetry must not break learning */ }
  }
}
