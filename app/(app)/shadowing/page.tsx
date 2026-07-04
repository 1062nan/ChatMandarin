import { createSupabaseServerClient } from '@/lib/supabase/server'
import { ShadowingClient } from '@/components/shadowing/shadowing-client'

export const metadata = { title: 'Shadowing Practice' }

export default async function ShadowingPage() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('hsk_level')
    .eq('auth_id', user.id)
    .single()

  const hskLevel = profile?.hsk_level || 3

  const { data: sentences } = await supabase
    .from('shadowing_sentences')
    .select('*')
    .lte('hsk_level', hskLevel)
    .eq('is_active', true)
    .order('hsk_level', { ascending: true })
    .order('sort_order', { ascending: true })
    .limit(20)

  return <ShadowingClient sentences={sentences || []} ttsVoice={profile?.tts_voice_type || 'BV700_streaming'} />
}
