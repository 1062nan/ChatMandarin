/** Limit bytes while reading, including chunked requests without Content-Length. */
export async function readBoundedBytes(request: Request, limit: number): Promise<Uint8Array> {
  if (Number(request.headers.get('content-length')) > limit) throw new RangeError('Request body too large')
  const reader = request.body?.getReader()
  if (!reader) return new Uint8Array()
  const chunks: Uint8Array[] = []; let length = 0
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      length += value.byteLength
      if (length > limit) { await reader.cancel(); throw new RangeError('Request body too large') }
      chunks.push(value)
    }
  } finally { reader.releaseLock() }
  const result = new Uint8Array(length); let offset = 0
  for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.byteLength }
  return result
}
