import { describe, expect, it } from 'vitest'
import { encodeWAV } from './wav-encoder'
import { validateConversationWav } from './conversation-wav'

const wav = (seconds = 1) => encodeWAV(new Float32Array(16000 * seconds)).arrayBuffer()
describe('conversation upload WAV validation', () => {
  it('accepts recorder output and measures real PCM duration', async () => {
    expect(validateConversationWav(await wav())).toEqual({ ok: true, durationSeconds: 1 })
  })
  it('rejects a renamed non-audio file', () => {
    expect(validateConversationWav(new ArrayBuffer(32044)).ok).toBe(false)
  })
  it('rejects truncated and malformed chunks', async () => {
    const valid = await wav()
    expect(validateConversationWav(valid.slice(0, -2)).ok).toBe(false)
    new DataView(valid).setUint32(40, 0xffffffff, true)
    expect(validateConversationWav(valid).ok).toBe(false)
  })
  it.each([20, 22, 24, 28, 32, 34])('rejects invalid PCM format field %i', async (offset) => {
    const valid = await wav()
    new DataView(valid).setUint16(offset, 0, true)
    expect(validateConversationWav(valid).ok).toBe(false)
  })
  it('rejects trailing bytes and duplicate empty data chunks', async () => {
    const valid = new Uint8Array(await wav())
    const trailing = new Uint8Array(valid.length + 3)
    trailing.set(valid)
    new DataView(trailing.buffer).setUint32(4, trailing.length - 8, true)
    expect(validateConversationWav(trailing.buffer).ok).toBe(false)
    const duplicate = new Uint8Array(valid.length + 8)
    duplicate.set(valid.slice(0, 36))
    duplicate.set(new TextEncoder().encode('data'), 36)
    duplicate.set(valid.slice(36), 44)
    new DataView(duplicate.buffer).setUint32(4, duplicate.length - 8, true)
    expect(validateConversationWav(duplicate.buffer).ok).toBe(false)
  })
  it('rejects too short and too long files', async () => {
    expect(validateConversationWav(await wav(0.1)).ok).toBe(false)
    expect(validateConversationWav(await wav(121)).ok).toBe(false)
  })
})
