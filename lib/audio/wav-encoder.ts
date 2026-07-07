/**
 * WAV 编码器 + AudioWorklet 录音器
 *
 * 关键设计：
 * 1. 用 AudioWorkletNode（替代废弃的 ScriptProcessorNode）
 * 2. AudioWorklet processor 文件在 /public/audio-recorder-worklet.js
 * 3. 不强制 sampleRate（让浏览器用默认），录音后 OfflineAudioContext 重采样到 16k
 * 4. start() 后立即 await audioContext.resume()
 * 5. 加详细 console.log 帮助排查
 */

let workletModulePromise: Promise<void> | null = null

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
  // 复制到独立的 ArrayBuffer，避免 TS ArrayBufferLike 不匹配
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
 * 浏览器麦克风录音器（基于 AudioWorklet）
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

  async start(): Promise<void> {
    if (this.isRecording) return

    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      throw new Error('Browser does not support microphone access')
    }

    try {
      console.log('[AudioRecorder] requesting getUserMedia...')
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      })
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

      // 加载 AudioWorklet 模块（缓存 Promise 避免重复加载）
      if (!workletModulePromise) {
        workletModulePromise = this.audioContext.audioWorklet.addModule('/audio-recorder-worklet.js')
      }
      try {
        await workletModulePromise
        console.log('[AudioRecorder] audioWorklet module loaded')
      } catch (e) {
        console.error('[AudioRecorder] audioWorklet addModule failed:', e)
        throw new Error('AudioWorklet load failed: ' + (e as Error).message)
      }

      this.source = this.audioContext.createMediaStreamSource(this.mediaStream)

      // AudioWorkletNode
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
        const input = msg.samples as Float32Array

        // 前 3 次回调打印诊断
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

      // 通知 worklet 开始录音
      this.workletNode.port.postMessage({ type: 'start' })

      // 连接：source → worklet → silentGain(0) → destination
      // silentGain=0 防止扬声器啸叫，但 worklet 仍能收到 input
      this.source.connect(this.workletNode)
      const silentGain = this.audioContext.createGain()
      silentGain.gain.value = 0
      this.workletNode.connect(silentGain)
      silentGain.connect(this.audioContext.destination)
      this.silentGain = silentGain

      this.isRecording = true
      this.chunks = []
      this.recordStartTs = Date.now()
      console.log('[AudioRecorder] recording started, waiting for audio data...')
    } catch (error) {
      this.cleanup()
      const msg = (error as Error)?.message || String(error)
      if (msg.includes('Permission') || msg.includes('denied') || msg.includes('NotAllowed')) {
        throw new Error('Microphone permission denied.')
      }
      if (msg.includes('NotFound') || msg.includes('DevicesNotFoundError')) {
        throw new Error('No microphone found.')
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

    // 通知 worklet 停止
    if (this.workletNode) {
      try {
        this.workletNode.port.postMessage({ type: 'stop' })
      } catch {}
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
    // 不重置 workletModulePromise —— 模块可以复用
  }
}
