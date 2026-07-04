import { createSupabaseServerClient } from '@/lib/supabase/server'
import { SettingsClient } from '@/components/settings/settings-client'
import { UpgradeSection } from '@/components/settings/upgrade-section'
import { VoicePicker } from '@/components/settings/voice-picker'

export const metadata = { title: 'Settings' }

export default async function SettingsPage() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, hsk_level, correction_mode, audio_speed, tts_voice_type')
    .eq('auth_id', user.id)
    .single()

  if (!profile) {
    return <div>Loading...</div>
  }

  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('plan, status, current_period_end')
    .eq('user_id', profile.id)
    .eq('status', 'active')
    .single()

  return (
    <div className="max-w-3xl space-y-6">
      <SettingsClient profile={profile} />
      <VoicePicker currentVoice={profile.tts_voice_type || 'BV700_streaming'} profileId={profile.id} />
      <UpgradeSection currentPlan={subscription?.plan || 'free'} />
    </div>
  )
}
