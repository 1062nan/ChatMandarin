import { randomBytes } from 'node:crypto'
import { spawn } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { setTimeout as delay } from 'node:timers/promises'

const localEnv = loadEnvFile('.env.local')
const apiKey = localEnv.VOLCENGINE_API_KEY || process.env.VOLCENGINE_API_KEY
const appId = localEnv.VOLCENGINE_APP_ID || process.env.VOLCENGINE_APP_ID
if (!apiKey || !appId) {
  console.error('VOLCENGINE_API_KEY and VOLCENGINE_APP_ID must be set in .env.local')
  process.exit(2)
}

const secret = randomBytes(32).toString('hex')
const port = String(8800 + (randomBytes(2).readUInt16BE(0) % 500))
const wrangler = spawn(process.execPath, [
  'node_modules/wrangler/bin/wrangler.js',
  'dev',
  '--local',
  '--port', port,
  '--config', 'workers/voice-gateway/wrangler.jsonc',
  '--var', `VOICE_GATEWAY_SECRET:${secret}`,
  '--var', `VOLCENGINE_API_KEY:${apiKey}`,
  '--var', `VOLCENGINE_APP_ID:${appId}`,
  '--var', `VOLCENGINE_TTS_CLUSTER:${localEnv.VOLCENGINE_TTS_CLUSTER || 'volcano_tts'}`,
], { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true })

for (const stream of [wrangler.stdout, wrangler.stderr]) {
  stream?.on('data', (chunk) => {
    const safe = String(chunk)
      .replaceAll(apiKey, '[redacted-api-key]')
      .replaceAll(appId, '[redacted-app-id]')
      .replaceAll(secret, '[redacted-gateway-secret]')
    for (const line of safe.split(/\r?\n/)) {
      if (line.includes('voice_gateway_error')) console.error(line)
    }
  })
}

let exitCode = 1
try {
  await waitUntilReady(`http://127.0.0.1:${port}/health`, wrangler)
  const forwardedArgs = process.argv.slice(2)
  const test = spawn(process.execPath, ['scripts/test-voice-gateway.mjs', ...forwardedArgs], {
    stdio: 'inherit',
    windowsHide: true,
    env: {
      ...process.env,
      VOICE_GATEWAY_TEST_URL: `http://127.0.0.1:${port}`,
      VOICE_GATEWAY_SECRET: secret,
    },
  })
  exitCode = await new Promise((resolve) => test.once('exit', (code) => resolve(code ?? 1)))
} finally {
  wrangler.kill()
}
process.exitCode = exitCode

async function waitUntilReady(url, child) {
  for (let attempt = 0; attempt < 30; attempt++) {
    if (child.exitCode !== null) throw new Error('Local Voice Worker exited before startup')
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(1000) })
      if (response.ok) return
    } catch {}
    await delay(500)
  }
  throw new Error('Local Voice Worker did not become ready within 15 seconds')
}

function loadEnvFile(path) {
  const values = {}
  if (!existsSync(path)) return values
  for (const rawLine of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const separator = line.indexOf('=')
    if (separator < 1) continue
    const key = line.slice(0, separator).trim()
    const value = line.slice(separator + 1).trim().replace(/^(['"])(.*)\1$/, '$2')
    values[key] = value
  }
  return values
}
