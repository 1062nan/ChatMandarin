import { randomBytes } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'

const WORKER_CONFIG = 'workers/voice-gateway/wrangler.jsonc'
const GATEWAY_URL = 'https://chatmandarin-voice.wangyn-80.workers.dev'
const localEnv = loadEnvFile('.env.local')

const apiKey = required(localEnv.VOLCENGINE_API_KEY, 'VOLCENGINE_API_KEY')
const appId = required(localEnv.VOLCENGINE_APP_ID, 'VOLCENGINE_APP_ID')
const gatewaySecret = randomBytes(48).toString('base64url')

console.log('Configuring Cloudflare Worker secrets...')
putCloudflareSecret('VOLCENGINE_API_KEY', apiKey)
putCloudflareSecret('VOLCENGINE_APP_ID', appId)
putCloudflareSecret('VOICE_GATEWAY_SECRET', gatewaySecret)

console.log('Configuring Vercel Production and Preview environments...')
putVercelEnv('VOLCENGINE_ROUTE', 'cloudflare', false)
putVercelEnv('CLOUDFLARE_VOICE_GATEWAY_URL', GATEWAY_URL, false)
putVercelEnv('VOICE_GATEWAY_SECRET', gatewaySecret, true)

console.log('Running the 2-minute remote voice verification...')
run(process.execPath, [
  'scripts/test-voice-gateway.mjs',
  '--duration-seconds', '120',
  '--interval-seconds', '30',
  '--asr-from-tts',
], undefined, {
  ...process.env,
  VOICE_GATEWAY_TEST_URL: GATEWAY_URL,
  VOICE_GATEWAY_SECRET: gatewaySecret,
})

console.log('Cloudflare and Vercel voice routing are configured. The shared secret was not printed or written to disk.')

function putCloudflareSecret(name, value) {
  run(process.execPath, [
    'node_modules/wrangler/bin/wrangler.js',
    'secret', 'put', name,
    '--config', WORKER_CONFIG,
  ], `${value}\n`)
}

function putVercelEnv(name, value, sensitive) {
  const sensitivity = sensitive ? '--sensitive' : '--no-sensitive'
  if (process.platform === 'win32') {
    const commandLine = `npx vercel env add ${name} production,preview --force --yes ${sensitivity}`
    run(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', commandLine], `${value}\n`)
    return
  }
  run('npx', [
    'vercel', 'env', 'add', name, 'production,preview',
    '--force', '--yes', sensitivity,
  ], `${value}\n`)
}

function run(command, args, input, env = process.env) {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    env,
    input,
    encoding: 'utf8',
    stdio: input === undefined ? 'inherit' : ['pipe', 'pipe', 'pipe'],
    windowsHide: true,
  })
  if (input !== undefined) {
    if (result.stdout) process.stdout.write(result.stdout)
    if (result.stderr) process.stderr.write(result.stderr)
  }
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error(`${command} exited with code ${result.status}`)
}

function required(value, name) {
  if (!value) throw new Error(`${name} is missing from .env.local`)
  return value
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
