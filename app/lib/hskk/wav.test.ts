import { describe, expect, it } from 'vitest'
import { encodeWAV } from '@/lib/audio/wav-encoder'
import { validateConversationWav } from '@/lib/audio/conversation-wav'
import { mergeHskkWavBlobs } from './wav'

function wav(seconds = 1, value = 0.25) { return encodeWAV(new Float32Array(16000 * seconds).fill(value)) }
async function withMetadata(blob: Blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer())
  const result = new Uint8Array(bytes.length + 12)
  result.set(bytes.slice(0, 36))
  result.set(new TextEncoder().encode('LIST'), 36)
  new DataView(result.buffer).setUint32(40, 4, true)
  result.set(new TextEncoder().encode('INFO'), 44)
  result.set(bytes.slice(36), 48)
  new DataView(result.buffer).setUint32(4, result.length - 8, true)
  return new Blob([result], { type: 'audio/wav' })
}

describe('HSKK WAV merging', () => {
  it('updates RIFF and PCM sizes and preserves both recordings', async () => {
    const merged = await (await mergeHskkWavBlobs([wav(1, 0.25), wav(1, 0.5)])).arrayBuffer()
    expect(validateConversationWav(merged)).toEqual({ ok: true, durationSeconds: 2 })
    const view = new DataView(merged)
    expect(view.getInt16(44, true)).toBe(8191)
    expect(view.getInt16(44 + 32000, true)).toBe(16383)
  })
  it('handles metadata before the data chunk without treating it as PCM', async () => {
    const merged = await (await mergeHskkWavBlobs([await withMetadata(wav()), wav()])).arrayBuffer()
    expect(validateConversationWav(merged)).toEqual({ ok: true, durationSeconds: 2 })
    expect(new DataView(merged).getInt16(44, true)).toBe(8191)
  })
  it('rejects malformed recordings and empty input', async () => {
    await expect(mergeHskkWavBlobs([])).rejects.toThrow('At least one')
    await expect(mergeHskkWavBlobs([new Blob(['invalid'])])).rejects.toThrow('valid WAV')
  })
  it('allows multiple answers longer than 120 seconds combined but limits total bytes', async () => {
    const merged = await mergeHskkWavBlobs([wav(70), wav(70)])
    expect(merged.size).toBe(44 + 140 * 32000)
    await expect(mergeHskkWavBlobs([wav(100), wav(100), wav(100)])).rejects.toThrow('Combined Q&A')
  })
})
