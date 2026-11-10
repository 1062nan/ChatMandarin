import { notFound } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { ShadowingClient } from '@/components/shadowing/shadowing-client'

export const metadata = { title: 'Shadowing Practice' }

export default async function ShadowingPage({
  searchParams,
}: {
  searchParams: Promise<{ sentence?: string | string[] }>
}) {
  const { sentence } = await searchParams
  const selectedId = typeof sentence === 'string' ? sentence : undefined
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('hsk_level, tts_voice_type')
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

  const practiceSentences = sentences || []
  if (selectedId && !practiceSentences.some(item => item.id === selectedId)) {
    // Unit links can target a sentence beyond the generic list's level/20-item limit.
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(selectedId)) notFound()
    const { data: selected, error } = await supabase
      .from('shadowing_sentences')
      .select('*')
      .eq('id', selectedId)
      .eq('is_active', true)
      .maybeSingle()
    if (error) throw error
    if (!selected) notFound()
    practiceSentences.unshift(selected)
  }

  return <ShadowingClient
    key={selectedId || 'all'}
    sentences={practiceSentences}
    initialSentenceId={selectedId}
    ttsVoice={profile?.tts_voice_type || 'BV700_streaming'}
  />
}
