import { validateConversationWav } from '@/lib/audio/conversation-wav'

/** Merge recorder/upload WAV files by their data chunks, not a fixed header size. */
export async function mergeHskkWavBlobs(blobs: Blob[]): Promise<Blob> {
  if (!blobs.length) throw new Error('At least one Q&A recording is required')
  const chunks: Uint8Array[] = []
  let totalBytes = 0
  for (const blob of blobs) {
    if (blob.size > 8 * 1024 * 1024) throw new Error('Audio file is too large')
    const buffer = await blob.arrayBuffer()
    const validation = validateConversationWav(buffer)
    if (!validation.ok) throw new Error(validation.error)
    const view = new DataView(buffer)
    for (let offset = 12; offset + 8 <= buffer.byteLength;) {
      const size = view.getUint32(offset + 4, true)
      const tag = String.fromCharCode(...new Uint8Array(buffer, offset, 4))
      if (tag === 'data') {
        chunks.push(new Uint8Array(buffer, offset + 8, size))
        totalBytes += size
        break
      }
      offset += 8 + size + (size % 2)
    }
  }
  if (totalBytes / 32000 > 260 || 44 + totalBytes > 8 * 1024 * 1024) throw new Error('Combined Q&A recording is too large (maximum 260 seconds / 8 MB). Please use shorter answers.')
  const result = new Uint8Array(44 + totalBytes)
  const view = new DataView(result.buffer)
  const tag = (offset: number, text: string) => result.set(new TextEncoder().encode(text), offset)
  tag(0, 'RIFF'); view.setUint32(4, result.byteLength - 8, true); tag(8, 'WAVE')
  tag(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true)
  view.setUint16(22, 1, true); view.setUint32(24, 16000, true); view.setUint32(28, 32000, true)
  view.setUint16(32, 2, true); view.setUint16(34, 16, true)
  tag(36, 'data'); view.setUint32(40, totalBytes, true)
  let offset = 44
  for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.byteLength }
  return new Blob([result], { type: 'audio/wav' })
}
