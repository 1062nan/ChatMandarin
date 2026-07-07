/**
 * WAV 编码器 + 录音器
 *
 * 关键修复（v2）：
 * 1. 不在 AudioContext 强制 sampleRate:16000（很多浏览器会拒绝或 suspended）
 * 2. start 后立即 await audioContext.resume()（iOS/Chrome 自动播放策略）
 * 3. 录音用浏览器原生采样率 → 之后用 OfflineAudioContext 重采样到 16kHz
 * 4. 加录音时长 + 错误诊断字段，方便排查
 */

/**
 * 将 Float32Array PCM 数据编码为 WAV Blob（指定采样率）
 */
export function encodeWAV(samples: Float32Array, sampleRate: number = 16000): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2)
  const view = new DataView(buffer)

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i))
    }
  }

  writeString(0, 'RIFF')
  view.setUint32(4, 36 + samples.length * 2, true)
  writeString(8, 'WAVE')

  writeString(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)

  writeString(36, 'data')
  view.setUint32(40, samples.length * 2, true)

  let offset = 44
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]))
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true)
    offset += 2
  }

  return new Blob([buffer], { type: 'audio/wav' })
}

/**
 * 用 OfflineAudioContext 把任意采样率的 Float32 重采样到目标采样率
 */
async function resample(samples: Float32Array, fromRate: number, toRate: number): Promise<Float32Array> {
  if (fromRate === toRate) return samples

  const duration = samples.length / fromRate
  const offline = new OfflineAudioContext(1, Math.ceil(duration * toRate), toRate)
  const buffer = offline.createBuffer(1, samples.length, fromRate)
  // 复制到独立的 ArrayBuffer，避免 TypeScript ArrayBufferLike vs ArrayBuffer 不匹配
  const copy = new Float32Array(samples)
  buffer.copyToChannel(copy as Float32Array<ArrayBuffer>, 0)
  const src = offline.createBufferSource()
  src.buffer = buffer
  src.connect(offline.destination)
  src.start(0)
  const rendered = await offline.startRendering()
  return rendered.getChannelData(0)
}

export interface RecorderDiagnostics {
  chunks: number
  durationMs: number
  contextSampleRate: number
  contextState: string
  blobSize: number
}

/**
 * 浏览器麦克风录音器
 * - 用浏览器默认采样率录音（避免 suspended）
 * - 停止时重采样到 16kHz 再编码
 */
export class AudioRecorder {
  private audioContext: AudioContext | null = null
  private mediaStream: MediaStream | null = null
  private source: MediaStreamAudioSourceNode | null = null
  private processor: ScriptProcessorNode | null = null
  private chunks: Float32Array[] = []
  private isRecording = false
  private recordStartTs = 0
  private readonly targetSampleRate = 16000

  onAudioLevel?: (level: number) => void

  async start(): Promise<void> {
    if (this.isRecording) return

    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      throw new Error('Browser does not support microphone access (getUserMedia missing)')
    }

    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      })

      // 关键：不要在 AudioContext 强制 sampleRate，浏览器会更愿意 running
      const Ctx = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext
      this.audioContext = new Ctx()

      // iOS / 桌面自动播放策略：必须在用户手势内 resume
      if (this.audioContext.state === 'suspended') {
        try {
          await this.audioContext.resume()
        } catch {}
      }

      this.source = this.audioContext.createMediaStreamSource(this.mediaStream)

      // ScriptProcessor 已废弃但仍工作；bufferSize 4096 = 低延迟
      this.processor = this.audioContext.createScriptProcessor(4096, 1, 1)

      this.processor.onaudioprocess = (event) => {
        if (!this.isRecording) return
        const input = event.inputBuffer.getChannelData(0)
        const chunk = new Float32Array(input.length)
        chunk.set(input)
        this.chunks.push(chunk)

        if (this.onAudioLevel) {
          let sum = 0
          for (let i = 0; i < input.length; i++) sum += input[i] * input[i]
          const rms = Math.sqrt(sum / input.length)
          this.onAudioLevel(Math.min(1, rms * 5))
        }
      }

      // 关键：必须 connect destination，否则 onaudioprocess 不会触发
      this.source.connect(this.processor)
      this.processor.connect(this.audioContext.destination)

      this.isRecording = true
      this.chunks = []
      this.recordStartTs = Date.now()
    } catch (error) {
      this.cleanup()
      const msg = (error as Error)?.message || String(error)
      if (msg.includes('Permission') || msg.includes('denied') || msg.includes('NotAllowed')) {
        throw new Error('Microphone permission denied. Please allow mic access in browser settings.')
      }
      if (msg.includes('NotFound') || msg.includes('DevicesNotFoundError')) {
        throw new Error('No microphone found. Please connect a microphone.')
      }
      throw new Error(`Failed to access microphone: ${msg}`)
    }
  }

  async stop(): Promise<{ blob: Blob; duration: number; diagnostics: RecorderDiagnostics } | null> {
    if (!this.isRecording) {
      this.cleanup()
      return null
    }

    this.isRecording = false

    const contextSampleRate = this.audioContext?.sampleRate || this.targetSampleRate
    const contextState = this.audioContext?.state || 'unknown'
    const chunksCount = this.chunks.length
    const durationMs = Date.now() - this.recordStartTs

    if (this.chunks.length === 0) {
      this.cleanup()
      return {
        blob: new Blob([], { type: 'audio/wav' }),
        duration: 0,
        diagnostics: {
          chunks: 0,
          durationMs,
          contextSampleRate,
          contextState,
          blobSize: 0,
        },
      }
    }

    const totalLength = this.chunks.reduce((sum, chunk) => sum + chunk.length, 0)
    const merged = new Float32Array(totalLength)
    let offset = 0
    for (const chunk of this.chunks) {
      merged.set(chunk, offset)
      offset += chunk.length
    }

    // 重采样到 16kHz（火山引擎 ASR 要求）
    let finalSamples: Float32Array = merged
    try {
      finalSamples = await resample(merged, contextSampleRate, this.targetSampleRate)
    } catch {
      // 重采样失败就发原始数据
      finalSamples = merged
    }

    const blob = encodeWAV(finalSamples, this.targetSampleRate)
    const duration = finalSamples.length / this.targetSampleRate

    const diagnostics: RecorderDiagnostics = {
      chunks: chunksCount,
      durationMs,
      contextSampleRate,
      contextState,
      blobSize: blob.size,
    }

    this.cleanup()
    return { blob, duration, diagnostics }
  }

  cancel(): void {
    this.isRecording = false
    this.chunks = []
    this.cleanup()
  }

  get recording(): boolean {
    return this.isRecording
  }

  private cleanup(): void {
    if (this.processor) {
      try { this.processor.disconnect() } catch {}
      this.processor = null
    }
    if (this.source) {
      try { this.source.disconnect() } catch {}
      this.source = null
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((t) => t.stop())
      this.mediaStream = null
    }
    if (this.audioContext) {
      try { this.audioContext.close() } catch {}
      this.audioContext = null
    }
  }
}
