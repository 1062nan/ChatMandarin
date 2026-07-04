/**
 * WAV 编码器
 * 将 AudioContext 的 raw PCM 数据编码为 WAV Blob
 * 火山引擎 ASR 需要 WAV 或 PCM 格式
 */

/**
 * 将 Float32Array PCM 数据编码为 WAV Blob
 */
export function encodeWAV(samples: Float32Array, sampleRate: number = 16000): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2)
  const view = new DataView(buffer)

  // WAV 文件头
  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i))
    }
  }

  // RIFF header
  writeString(0, 'RIFF')
  view.setUint32(4, 36 + samples.length * 2, true)
  writeString(8, 'WAVE')

  // fmt chunk
  writeString(12, 'fmt ')
  view.setUint32(16, 16, true)           // chunk size
  view.setUint16(20, 1, true)             // audio format (PCM)
  view.setUint16(22, 1, true)             // num channels (mono)
  view.setUint32(24, sampleRate, true)    // sample rate
  view.setUint32(28, sampleRate * 2, true) // byte rate
  view.setUint16(32, 2, true)             // block align
  view.setUint16(34, 16, true)            // bits per sample

  // data chunk
  writeString(36, 'data')
  view.setUint32(40, samples.length * 2, true)

  // 写入 PCM 数据（float32 → int16）
  let offset = 44
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]))
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true)
    offset += 2
  }

  return new Blob([buffer], { type: 'audio/wav' })
}

/**
 * 从 MediaStream 录制音频
 * 返回一个控制器对象，可以开始/停止录制
 */
export class AudioRecorder {
  private audioContext: AudioContext | null = null
  private mediaStream: MediaStream | null = null
  private source: MediaStreamAudioSourceNode | null = null
  private processor: ScriptProcessorNode | null = null
  private chunks: Float32Array[] = []
  private isRecording = false
  private sampleRate = 16000

  onAudioLevel?: (level: number) => void

  async start(): Promise<void> {
    if (this.isRecording) return

    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: this.sampleRate
        }
      })

      this.audioContext = new AudioContext({ sampleRate: this.sampleRate })
      this.source = this.audioContext.createMediaStreamSource(this.mediaStream)

      // 使用 ScriptProcessorNode 录制原始 PCM
      // bufferSize=4096 → 低延迟
      this.processor = this.audioContext.createScriptProcessor(4096, 1, 1)

      this.processor.onaudioprocess = (event) => {
        if (!this.isRecording) return

        const input = event.inputBuffer.getChannelData(0)
        // 复制数据（原始 buffer 会被重用）
        const chunk = new Float32Array(input.length)
        chunk.set(input)
        this.chunks.push(chunk)

        // 计算音量（用于 UI 显示）
        if (this.onAudioLevel) {
          let sum = 0
          for (let i = 0; i < input.length; i++) {
            sum += input[i] * input[i]
          }
          const rms = Math.sqrt(sum / input.length)
          this.onAudioLevel(Math.min(1, rms * 5))
        }
      }

      this.source.connect(this.processor)
      this.processor.connect(this.audioContext.destination)

      this.isRecording = true
      this.chunks = []
    } catch (error) {
      this.cleanup()
      throw new Error(`Failed to access microphone: ${(error as Error).message}`)
    }
  }

  stop(): { blob: Blob; duration: number } | null {
    if (!this.isRecording || this.chunks.length === 0) {
      this.cleanup()
      return null
    }

    this.isRecording = false

    // 合并所有 chunk
    const totalLength = this.chunks.reduce((sum, chunk) => sum + chunk.length, 0)
    const merged = new Float32Array(totalLength)
    let offset = 0
    for (const chunk of this.chunks) {
      merged.set(chunk, offset)
      offset += chunk.length
    }

    const blob = encodeWAV(merged, this.sampleRate)
    const duration = merged.length / this.sampleRate

    this.cleanup()
    return { blob, duration }
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
      this.processor.disconnect()
      this.processor = null
    }
    if (this.source) {
      this.source.disconnect()
      this.source = null
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(t => t.stop())
      this.mediaStream = null
    }
    if (this.audioContext) {
      this.audioContext.close()
      this.audioContext = null
    }
  }
}
