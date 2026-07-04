import { createSupabaseServerClient } from '@/lib/supabase/server'
import { DubbingClient } from '@/components/dubbing/dubbing-client'

export const metadata = { title: 'Movie Dubbing' }

export default async function DubbingPage() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('hsk_level, tts_voice_type')
    .eq('auth_id', user.id)
    .single()

  const { data: clips } = await supabase
    .from('dubbing_clips')
    .select('*')
    .eq('is_active', true)
    .order('created_at')

  return <DubbingClient clips={clips || []} ttsVoice={profile?.tts_voice_type || 'BV700_streaming'} />
}
