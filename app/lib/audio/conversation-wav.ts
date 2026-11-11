/** Validate actual PCM bytes, not a caller-controlled extension or MIME type. */
export function validateConversationWav(buffer: ArrayBuffer):
  | { ok: true; durationSeconds: number }
  | { ok: false; error: string } {
  const fail = () => ({ ok: false as const, error: 'Use a valid WAV recording: 16 kHz, mono, 16-bit PCM, 0.3–120 seconds.' })
  if (buffer.byteLength < 44 || buffer.byteLength > 8 * 1024 * 1024) return fail()
  const view = new DataView(buffer)
  const tag = (offset: number) => String.fromCharCode(...new Uint8Array(buffer, offset, 4))
  if (tag(0) !== 'RIFF' || tag(8) !== 'WAVE' || view.getUint32(4, true) + 8 !== buffer.byteLength) return fail()
  let formatFound = false
  let dataBytes = 0
  let dataFound = false
  let offset = 12
  for (; offset + 8 <= buffer.byteLength;) {
    const name = tag(offset)
    const size = view.getUint32(offset + 4, true)
    const start = offset + 8
    if (start + size > buffer.byteLength) return fail()
    if (name === 'fmt ') {
      if (formatFound || size < 16 || view.getUint16(start, true) !== 1
        || view.getUint16(start + 2, true) !== 1 || view.getUint32(start + 4, true) !== 16000
        || view.getUint32(start + 8, true) !== 32000 || view.getUint16(start + 12, true) !== 2
        || view.getUint16(start + 14, true) !== 16) return fail()
      formatFound = true
    }
    if (name === 'data') {
      if (dataFound || !formatFound || size % 2 !== 0 || start + size !== buffer.byteLength) return fail()
      dataFound = true
      dataBytes = size
    }
    offset = start + size + (size % 2)
  }
  const durationSeconds = dataBytes / 32000
  if (offset !== buffer.byteLength || !formatFound || !dataFound || durationSeconds < 0.3 || durationSeconds > 120) return fail()
  return { ok: true, durationSeconds }
}
