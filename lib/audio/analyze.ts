/**
 * 音频诊断：分析 WAV 字节流是否静音、是否过短
 * 用于 ASR 返回空时给用户更精准的反馈
 */

export interface AudioAnalysis {
  bytes: number
  durationSec: number
  sampleRate: number
  channels: number
  silent: boolean
  rms: number         // 0-32768 (16-bit scale)
  peak: number        // 0-32768
  /** 平均音量百分比（0-100，对 RMS 做感知缩放） */
  levelPercent: number
}

/**
 * 分析 16-bit PCM WAV 数据
 */
export function analyzeAudio(wav: ArrayBuffer): AudioAnalysis {
  const view = new DataView(wav)
  const bytes = wav.byteLength

  // WAV header 默认值
  let sampleRate = 16000
  let channels = 1
  let dataStart = 44
  let bitsPerSample = 16

  // RIFF 校验
  if (bytes >= 44) {
    const riff = String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3))
    if (riff === 'RIFF') {
      // 找 fmt chunk
      let pos = 12
      while (pos < bytes - 8) {
        const chunkId = String.fromCharCode(
          view.getUint8(pos),
          view.getUint8(pos + 1),
          view.getUint8(pos + 2),
          view.getUint8(pos + 3)
        )
        const chunkSize = view.getUint32(pos + 4, true)
        if (chunkId === 'fmt ') {
          channels = view.getUint16(pos + 10, true)
          sampleRate = view.getUint32(pos + 12, true)
          bitsPerSample = view.getUint16(pos + 22, true)
        } else if (chunkId === 'data') {
          dataStart = pos + 8
          break
        }
        pos += 8 + chunkSize + (chunkSize % 2)
      }
    }
  }

  // 计算 RMS + peak
  let sumSq = 0
  let peak = 0
  let sampleCount = 0
  let audioFormat = 1 // PCM
  for (let i = dataStart; i + 1 < bytes; i += 2) {
    const s = view.getInt16(i, true)
    const abs = Math.abs(s)
    sumSq += s * s
    if (abs > peak) peak = abs
    sampleCount++
  }

  const rms = sampleCount > 0 ? Math.sqrt(sumSq / sampleCount) : 0
  // 16-bit 安静阈值：RMS < 300 大概率是静音/噪声
  const silent = rms < 300
  const durationSec = sampleCount / sampleRate
  // 感知缩放：把 RMS (0~32768) 映射到 0-100
  const levelPercent = Math.min(100, Math.round((rms / 32768) * 600))

  return {
    bytes,
    durationSec,
    sampleRate,
    channels,
    silent,
    rms: Math.round(rms),
    peak,
    levelPercent,
  }
}
