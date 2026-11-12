# Provider usage observability, stage 1

This is **aggregate operational evidence, not an invoice, profit report, durable ledger,
or user quota system**. No price is calculated or inferred. `billed_cost` and currency
are null: unknown charges are never zero. No learner IDs, prompts, transcripts,
recordings, provider response bodies, credentials, or endpoint URLs enter the new event.
An ephemeral random attempt ID permits deduplication of exported log entries, not
learner identification. Existing logs elsewhere in the application are not audited.

## Coverage

`provider_usage_attempt` schema v1 emits once per actual upstream attempt completed or
failed in these paths:
- DeepSeek conversation, including the separate empty-answer retry, and HSKK scoring.
- Direct Volcengine TTS and WAV/PCM recognition.
- Cloudflare voice worker TTS and recognition.

App calls through the voice gateway are intentionally **not counted again**. Deploy
both app and worker code to cover that route. Tokyo fallback and the unused recording
file recognition helpers are **not instrumented**. Processes terminated before finally
can lose events; sampling, export completeness, retention, and deployed configuration
are unverified. Do not make complete-cost or profitability claims from partial logs.

`completed` means the provider interaction returned; downstream answer parsing or
learner workflow may still fail. `failed` includes uncertain/timeouts, which can still
be charged. HTTP status is null for WebSocket paths where it is unavailable.
Missing provider token usage remains null, not zero. Provider token counts are
allowlisted finite nonnegative integers. `offered_audio_seconds` is PCM bytes / 32000
for the actual configured 16 kHz, mono, 16-bit stream, not provider-confirmed billed
duration. TTS input characters are Unicode code points of the text actually submitted,
not UTF-8 bytes; the provider's own counting rules remain authoritative.

The configured DeepSeek endpoint is classified official/compatible/unknown without
logging its URL. The requested legacy model and safe returned DeepSeek model label
are separate. An official-host classification does not prove account rates, negotiated
pricing, or that aliases remain supported. Only known model labels are logged; other labels become `other`.

## Verification and operational acceptance

1. Run unit tests, app and worker type-checks, and production build.
2. Review diff for content/credential leakage. No provider calls needed for unit tests.
3. After authorized deployment, use one existing test-account learning flow; verify
   each expected upstream attempt appears in actual app and worker logs. Inspect only
   allowlisted event fields; never export raw logs containing learner text.
4. Confirm sampling and retention in the deployed services. Set up an authorized,
   access-restricted durable event sink before relying on monthly cost coverage.
5. Reconcile daily sums of prompt/completion/cache tokens, ASR offered seconds, TTS
   characters and attempt counts with the matching provider account's billing export.
   Identify credits, resource packages, rounding, retries and gaps explicitly.
6. Maintain effective-dated rate cards separately, record currency/FX assumptions,
   and keep estimated cost distinct from actual invoice amount.
7. Future per-cohort/per-user profitability requires a separately reviewed ledger,
   access policy and retention decision. This initial pass cannot compute it.

No provider credentials, prices, billing configuration, checkout gates or quotas are
changed by this feature. Telemetry sink failure must not break learning requests.

## Local validation (2026-11-12)

- 48 test files / 331 tests passed, including 10 new telemetry/privacy tests.
- App and voice worker TypeScript checks passed.
- ESLint: zero errors, 28 repository warnings.
- Production build passed with explicit fake public Supabase build-only placeholders.
  Build without those variables failed at signup prerender because this executor has
  no deployment environment configuration; this is not authenticated backend testing.
- Independent review corrected content-bearing error paths and fail-open telemetry
  handling before final checks. No deployment, live provider test or invoice access
  was performed. No production endpoint/model has been inferred from test fixtures.
