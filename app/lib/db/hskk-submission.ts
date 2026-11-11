import { createHash } from 'node:crypto'
import { createSupabaseAdmin, createSupabaseServerClient } from '@/lib/supabase/server'

type Client = Awaited<ReturnType<typeof createSupabaseServerClient>>
type Reservation = { state: 'reserved' | 'processing' | 'completed' | 'quota_denied'; test_id?: string; lease_token?: string; response?: Record<string, unknown>; reason?: string }
export function hskkFingerprint(level: string, variant: number, sections: ArrayBuffer[]) {
  const hashes = sections.map(section => createHash('sha256').update(Buffer.from(section)).digest('hex'))
  return createHash('sha256').update(JSON.stringify({ level, variant, sections: hashes })).digest('hex')
}
export async function reserveHskk(client: Client, profileId: string, fingerprint: string, level: string): Promise<Reservation> {
  const { data, error } = await client.rpc('reserve_hskk_submission', { p_profile_id: profileId, p_fingerprint: fingerprint, p_level: level })
  if (error) throw error
  if (!data || !['reserved', 'processing', 'completed', 'quota_denied'].includes(data.state)) throw new Error('Invalid HSKK reservation')
  return data
}
export async function finishHskk(profileId: string, fingerprint: string, lease: string, response: Record<string, unknown>, answers: Array<{ question: string; answer: string }>) {
  const { data, error } = await createSupabaseAdmin().rpc('finish_hskk_submission', { p_profile_id: profileId, p_fingerprint: fingerprint, p_lease_token: lease, p_response: response, p_qa_answers: answers })
  if (error) throw error
  if (data !== true) throw new Error('HSKK submission lease expired')
}
export async function failHskk(profileId: string, fingerprint: string, lease: string) {
  const { error } = await createSupabaseAdmin().rpc('fail_hskk_submission', { p_profile_id: profileId, p_fingerprint: fingerprint, p_lease_token: lease })
  if (error) throw error
}
