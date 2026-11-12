import { createSupabaseServerClient } from '@/lib/supabase/server'
import { SettingsClient } from '@/components/settings/settings-client'
import { UpgradeSection } from '@/components/settings/upgrade-section'
import { VoicePicker } from '@/components/settings/voice-picker'
import { isPlusSpeakingAllowanceEnabled } from '@/lib/subscription/tier'
import { getEffectivePlan } from '@/lib/subscription/access'
import { isCreemPaymentsAvailable } from '@/lib/payment/creem'

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
    .select('plan, status, current_period_end, cancel_at_period_end, provider_subscription_id, payment_provider')
    .eq('user_id', profile.id)
    .maybeSingle()

  const effectivePlan = getEffectivePlan(subscription)
  const plusSpeakingEnabled = await isPlusSpeakingAllowanceEnabled()

  return (
    <div className="max-w-3xl space-y-6">
      <SettingsClient profile={profile} />
      <VoicePicker
        currentVoice={profile.tts_voice_type || 'BV700_streaming'}
        profileId={profile.id}
        plan={effectivePlan}
      />
      <UpgradeSection
        currentPlan={effectivePlan}
        plusSpeakingEnabled={plusSpeakingEnabled}
        hasPaidSubscription={Boolean(subscription?.provider_subscription_id && subscription?.payment_provider === 'creem' && subscription?.status !== 'expired')}
        paymentsAvailable={isCreemPaymentsAvailable()}
        cancelAtPeriodEnd={subscription?.cancel_at_period_end || false}
        currentPeriodEnd={subscription?.current_period_end || null}
      />
    </div>
  )
}
