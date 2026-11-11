'use client'

import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { validateConversationWav } from '@/lib/audio/conversation-wav'

/** Accessible alternative to microphone capture; it follows the same scoring path. */
export function RecordingUpload({ id, disabled = false, onUpload, help }: {
  id: string
  disabled?: boolean
  onUpload: (file: File) => Promise<void> | void
  help?: string
}) {
  const busy = useRef(false)
  const [uploading, setUploading] = useState(false)
  return <div className="text-center text-sm">
    <label htmlFor={id} className="block text-muted-foreground">No microphone? Upload a recording</label>
    <input id={id} type="file" accept=".wav,audio/wav" disabled={disabled || uploading}
      className="mt-2 max-w-full text-xs"
      onChange={async event => {
        const file = event.target.files?.[0]
        event.target.value = ''
        if (!file || busy.current || disabled) return
        busy.current = true
        setUploading(true)
        try {
          if (file.size > 8 * 1024 * 1024) throw new Error('Audio file is too large (maximum 8 MB).')
          const validation = validateConversationWav(await file.arrayBuffer())
          if (!validation.ok) throw new Error(validation.error)
          await onUpload(file)
        } catch (error) {
          toast.error(error instanceof Error ? error.message : 'Could not read recording')
        } finally { busy.current = false; setUploading(false) }
      }} />
    <p className="mt-1 text-xs text-muted-foreground">{help || 'WAV · 16 kHz · mono · 16-bit PCM · 0.3–120 seconds. Selecting a file sends it for speech recognition and uses your practice allowance.'}</p>
  </div>
}
