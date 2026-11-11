import { createHash } from 'node:crypto'
import { createSupabaseAdmin, createSupabaseServerClient } from '@/lib/supabase/server'

export function audioPracticeId(profileId: string, kind: 'shadowing' | 'dubbing', contentId: string, audio: ArrayBuffer): string {
  const hash = createHash('sha256').update(JSON.stringify([profileId, kind, contentId])).update(new Uint8Array(audio)).digest('hex').slice(0, 32)
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}-${hash.slice(16, 20)}-${hash.slice(20)}`
}

export async function ensureOwnedLearningProgress(profileId: string): Promise<void> {
  const client = await createSupabaseServerClient()
  const { data: { user }, error: authError } = await client.auth.getUser()
  if (authError || !user) throw new Error('Unauthorized')
  const { data: profile, error } = await client.from('profiles').select('id').eq('id', profileId).eq('auth_id', user.id).maybeSingle()
  if (error) throw error
  if (!profile) throw new Error('Profile not owned')
  const { error: initError } = await createSupabaseAdmin().rpc('ensure_learning_progress', { p_profile_id: profileId })
  if (initError) throw initError
}

// Only call after server authentication and assessment. Never accept a client score.
export async function saveVerifiedAudioPractice(input: {
  profileId: string; kind: 'shadowing' | 'dubbing'; contentId: string;
  audio: ArrayBuffer; score: number; transcript: string; errors?: unknown[]; assessment?: Record<string, unknown>;
}): Promise<{ source_id: string; credited: boolean; unit_id?: string | null; duplicate: boolean; assessment: Record<string, unknown> }> {
  if (!Number.isInteger(input.score) || input.score < 0 || input.score > 100 || !input.transcript.trim()) throw new Error('Invalid assessment')
  const { data, error } = await createSupabaseAdmin().rpc('save_verified_audio_practice', {
    p_profile_id: input.profileId, p_kind: input.kind,
    p_source_id: audioPracticeId(input.profileId, input.kind, input.contentId, input.audio),
    p_content_id: input.contentId, p_score: input.score, p_transcript: input.transcript, p_errors: input.errors ?? [], p_assessment: input.assessment ?? {}
  })
  if (error) throw error
  if (!data?.source_id) throw new Error('Practice save did not return a result')
  return data
}
