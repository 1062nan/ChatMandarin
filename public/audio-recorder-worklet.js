/**
 * AudioWorklet processor for microphone recording
 *
 * 在 audio thread 上跑（不阻塞主线程），比 ScriptProcessorNode 更稳定
 *
 * 收到音频就 postMessage 一个 Float32Array 给主线程
 * （copy buffer 避免 detach 问题）
 */
class AudioRecorderProcessor extends AudioWorkletProcessor {
  constructor() {
    super()
    this.isRecording = false

    this.port.onmessage = (e) => {
      if (e.data?.type === 'start') {
        this.isRecording = true
      } else if (e.data?.type === 'stop') {
        this.isRecording = false
      }
    }
  }

  process(inputs, outputs, parameters) {
    if (!this.isRecording) return true

    const input = inputs[0]
    if (!input || input.length === 0) return true

    // 取第一个 channel（mono 录音）
    const channel = input[0]
    if (!channel || channel.length === 0) return true

    // 复制数据（主线程不能直接访问 AudioWorkletGlobalScope 的 buffer）
    const copy = new Float32Array(channel.length)
    copy.set(channel)

    // 发送到主线程
    this.port.postMessage({
      type: 'audio',
      samples: copy,
    })

    return true
  }
}

registerProcessor('audio-recorder-processor', AudioRecorderProcessor)
