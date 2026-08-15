import { createReadStream, createWriteStream, existsSync, statSync } from 'node:fs'
import { createServer } from 'node:http'
import { dirname, extname, join, normalize } from 'node:path'
import { pipeline } from 'node:stream/promises'
import { fileURLToPath } from 'node:url'

const sourceDir = dirname(fileURLToPath(import.meta.url))
const root = normalize(join(sourceDir, '..', '..', '..'))
const output = join(root, 'launch', 'assets', '07-conversation-demo-20s.webm')
const outputMp4 = join(root, 'launch', 'assets', '07-conversation-demo-23s.mp4')
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm'
}

createServer(async (request, response) => {
  if (request.method === 'POST' && request.url === '/save-video') {
    await pipeline(request, createWriteStream(output))
    response.writeHead(204)
    response.end()
    return
  }

  if (request.method === 'POST' && request.url === '/save-video-mp4') {
    await pipeline(request, createWriteStream(outputMp4))
    response.writeHead(204)
    response.end()
    return
  }

  const rawPath = decodeURIComponent((request.url || '/').split('?')[0])
  const relative = rawPath === '/' ? 'launch/assets/source/video-renderer.html' : rawPath.replace(/^\/+/, '')
  const file = normalize(join(root, relative))
  if (!file.startsWith(root) || !existsSync(file) || !statSync(file).isFile()) {
    response.writeHead(404)
    response.end('Not found')
    return
  }

  response.writeHead(200, { 'Content-Type': mime[extname(file)] || 'application/octet-stream' })
  createReadStream(file).pipe(response)
}).listen(48766, '127.0.0.1', () => {
  console.log('Marketing asset renderer: http://127.0.0.1:48766/')
})
