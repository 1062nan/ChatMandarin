# Voice gateway

ChatMandarin can route ASR and TTS through a dedicated Cloudflare Worker placed near Tokyo. The existing direct Volcengine connection remains available, and the existing Tokyo EC2 server can run a compatible gateway as a fallback.

## Routes

- `VOLCENGINE_ROUTE=cloudflare`: use `CLOUDFLARE_VOICE_GATEWAY_URL`, then retry once through `TOKYO_VOICE_GATEWAY_URL` when it is configured.
- `VOLCENGINE_ROUTE=tokyo`: use the Tokyo EC2 gateway first, then Cloudflare when configured.
- `VOLCENGINE_ROUTE=direct`: bypass both gateways and use the legacy direct clients.

If `VOLCENGINE_ROUTE` is absent, the application selects Cloudflare only when `CLOUDFLARE_VOICE_GATEWAY_URL` is configured; otherwise it stays on the direct route.

## Configure and deploy

Generate a random shared secret. Store it as `VOICE_GATEWAY_SECRET` on both the application Worker and the Voice Worker. Never commit the value.

```sh
npx wrangler secret put VOICE_GATEWAY_SECRET --config workers/voice-gateway/wrangler.jsonc
npx wrangler secret put VOLCENGINE_API_KEY --config workers/voice-gateway/wrangler.jsonc
npx wrangler secret put VOLCENGINE_APP_ID --config workers/voice-gateway/wrangler.jsonc
npm run voice:typegen
npm run voice:type-check
npm run voice:dry-run
npx wrangler deploy --config workers/voice-gateway/wrangler.jsonc
```

Set the main application Worker variables/secrets using the Cloudflare dashboard or Wrangler deployment environment:

```text
VOLCENGINE_ROUTE=cloudflare
CLOUDFLARE_VOICE_GATEWAY_URL=https://chatmandarin-voice.<account>.workers.dev
TOKYO_VOICE_GATEWAY_URL=https://<tokyo-gateway-host>
VOICE_GATEWAY_SECRET=<same-random-secret>
```

The gateway accepts only signed requests. Signatures expire after 60 seconds, request bodies are capped at 5 MiB, text is capped at 1,000 characters, and logs exclude audio, text, credentials, and signatures.

## Short verification

The smoke test defaults to 120 seconds and is capped at 300 seconds:

```sh
npm run voice:test
npm run voice:test:local
node scripts/run-local-voice-test.mjs --duration-seconds 120 --asr-from-tts
node scripts/test-voice-gateway.mjs --duration-seconds 300 --audio-file fixtures/sample-16k.wav
```

Without `--audio-file`, it tests health and real TTS. With a 16 kHz mono WAV file, it also tests real ASR. The report includes attempts, success rate, p50, and p95 latency. A 2–5 minute run verifies immediate behavior; it is not evidence of long-term stability.

Use `--asr-from-tts` when no WAV fixture is available. It requests WAV output from TTS and feeds that audio through ASR once before the timed checks.

`voice:test:local` reads Volcengine credentials from `.env.local`, generates an ephemeral gateway secret in memory, suppresses the local Wrangler binding output, and removes the local process when the test finishes.
