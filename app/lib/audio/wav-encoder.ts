/**
 * WAV 编码 + AudioWorklet 录音器
 *
 * 唯一实现：AudioWorkletNode（替代废弃的 ScriptProcessorNode）
 * Worklet processor 文件：/public/audio-recorder-worklet.js
 */

/**
 * 将 Float32Array PCM 数据编码为 WAV Blob
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
 * 浏览器麦克风录音器（AudioWorklet）
 */
export class AudioRecorder {
  private audioContext: AudioContext | null = null
  private mediaStream: MediaStream | null = null
  private source: MediaStreamAudioSourceNode | null = null
  private workletNode: AudioWorkletNode | null = null
  private silentGain: GainNode | null = null
  private chunks: Float32Array[] = []
  private isRecording = false
  private recordStartTs = 0
  private readonly targetSampleRate = 16000

  onAudioLevel?: (level: number) => void

  /**
   * 预加载 worklet 模块（页面空闲时调用，避免首次录音卡顿）
   * 注意：每个 AudioContext 必须独立 addModule，浏览器内部会去重，所以这里只是 warm-up
   */
  static async preload(): Promise<boolean> {
    try {
      const Ctx = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext
      const ctx = new Ctx()
      await ctx.audioWorklet.addModule('/audio-recorder-worklet.js')
      console.log('[AudioRecorder] preload OK')
      ctx.close()
      return true
    } catch (e) {
      console.error('[AudioRecorder] preload FAILED:', e)
      return false
    }
  }

  async start(): Promise<void> {
    if (this.isRecording) return

    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      throw new Error('Browser does not support microphone access')
    }

    console.log('[AudioRecorder] start() called')

    // 1. getUserMedia —— 显式指定 channelCount:1，部分设备/浏览器
    //    在多通道默认配置下会返回静音 stream
    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 48000,  // 让浏览器用默认采样率，避免它降采样到 16k 时出问题
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      })
    } catch (err) {
      const msg = (err as Error)?.message || ''
      console.error('[AudioRecorder] getUserMedia failed:', err)
      if (msg.includes('denied') || msg.includes('NotAllowed') || msg.includes('Permission')) {
        throw new Error('Microphone permission denied')
      }
      if (msg.includes('NotFound') || msg.includes('DevicesNotFoundError')) {
        throw new Error('No microphone device found')
      }
      throw new Error(`getUserMedia failed: ${msg}`)
    }

    console.log(
      '[AudioRecorder] getUserMedia OK, tracks:',
      this.mediaStream.getTracks().map((t) => ({
        kind: t.kind,
        label: t.label,
        enabled: t.enabled,
        muted: t.muted,
        state: t.readyState,
      }))
    )

    // 2. AudioContext
    const Ctx = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext
    this.audioContext = new Ctx()
    console.log(
      '[AudioRecorder] AudioContext state:',
      this.audioContext.state,
      'sampleRate:',
      this.audioContext.sampleRate
    )

    if (this.audioContext.state === 'suspended') {
      try {
        await this.audioContext.resume()
        console.log('[AudioRecorder] resumed, state:', this.audioContext.state)
      } catch (e) {
        console.warn('[AudioRecorder] resume failed:', e)
      }
    }

    // 3. AudioWorklet 模块（每个 AudioContext 必须独立 addModule）
    try {
      await this.audioContext.audioWorklet.addModule('/audio-recorder-worklet.js')
      console.log('[AudioRecorder] audioWorklet module loaded')
    } catch (e) {
      console.error('[AudioRecorder] audioWorklet addModule FAILED:', e)
      this.cleanup()
      throw new Error(
        `AudioWorklet load failed (url=/audio-recorder-worklet.js): ${(e as Error).message}`
      )
    }

    // 4. 连接
    try {
      this.source = this.audioContext.createMediaStreamSource(this.mediaStream)
      this.workletNode = new AudioWorkletNode(this.audioContext, 'audio-recorder-processor', {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        channelCount: 1,
      })

      let processCount = 0
      this.workletNode.port.onmessage = (e: MessageEvent) => {
        if (!this.isRecording) return
        const msg = e.data
        if (msg?.type !== 'audio' || !(msg.samples instanceof Float32Array)) return

        processCount++
        const input = msg.samples

        if (processCount <= 3) {
          let max = 0
          let sum = 0
          for (let i = 0; i < input.length; i++) {
            const v = Math.abs(input[i])
            if (v > max) max = v
            sum += input[i] * input[i]
          }
          console.log(
            `[AudioRecorder] audio #${processCount}: len=${input.length} max=${max.toFixed(4)} rms=${Math.sqrt(sum / input.length).toFixed(4)}`
          )
        }

        this.chunks.push(input)

        if (this.onAudioLevel) {
          let sum = 0
          for (let i = 0; i < input.length; i++) sum += input[i] * input[i]
          const rms = Math.sqrt(sum / input.length)
          this.onAudioLevel(Math.min(1, rms * 5))
        }
      }

      this.workletNode.port.postMessage({ type: 'start' })

      // source → worklet → silentGain(0) → destination
      // silentGain=0 防啸叫但保持 worklet 处于活跃处理链
      this.source.connect(this.workletNode)
      this.silentGain = this.audioContext.createGain()
      this.silentGain.gain.value = 0
      this.workletNode.connect(this.silentGain)
      this.silentGain.connect(this.audioContext.destination)

      this.isRecording = true
      this.chunks = []
      this.recordStartTs = Date.now()
      console.log('[AudioRecorder] recording started')
    } catch (e) {
      console.error('[AudioRecorder] setup failed:', e)
      this.cleanup()
      throw new Error(`AudioWorklet setup failed: ${(e as Error).message}`)
    }
  }

  async stop(): Promise<{ blob: Blob; duration: number; diagnostics: RecorderDiagnostics } | null> {
    if (!this.isRecording) {
      this.cleanup()
      return null
    }

    this.isRecording = false

    if (this.workletNode) {
      try { this.workletNode.port.postMessage({ type: 'stop' }) } catch {}
    }

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

    let finalSamples: Float32Array = merged
    try {
      finalSamples = await resample(merged, contextSampleRate, this.targetSampleRate)
    } catch {
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
    if (this.workletNode) {
      try { this.workletNode.disconnect() } catch {}
      try { this.workletNode.port.close() } catch {}
      this.workletNode = null
    }
    if (this.silentGain) {
      try { this.silentGain.disconnect() } catch {}
      this.silentGain = null
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
