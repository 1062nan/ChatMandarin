export const MAX_AUDIO_BYTES = 8 * 1024 * 1024

const SUPPORTED_AUDIO_EXTENSIONS = new Set(['wav', 'mp3', 'mpeg', 'ogg', 'webm', 'm4a'])

export function validateAudioFile(value: FormDataEntryValue | null):
  | { ok: true; file: File; format: string }
  | { ok: false; error: string } {
  if (
    !value
    || typeof value === 'string'
    || typeof value.arrayBuffer !== 'function'
    || typeof value.size !== 'number'
    || value.size === 0
  ) {
    return { ok: false, error: 'A non-empty audio file is required' }
  }
  if (value.size > MAX_AUDIO_BYTES) {
    return { ok: false, error: 'Audio file is too large' }
  }

  const extension = value.name.split('.').pop()?.toLowerCase() || 'wav'
  if (!SUPPORTED_AUDIO_EXTENSIONS.has(extension)) {
    return { ok: false, error: 'Unsupported audio format' }
  }

  return { ok: true, file: value, format: extension }
}
