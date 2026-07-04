import { notFound } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { ConversationClient } from '@/components/conversation/conversation-client'
import type { CorrectionMode } from '@/lib/db/types'

export const metadata = { title: 'Conversation Practice' }

export default async function ConversationPage({
  params
}: {
  params: { scenario: string }
}) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return null

  // 获取场景 + 用户设置
  const [{ data: scenario }, { data: profile }] = await Promise.all([
    supabase
      .from('scenarios')
      .select('*')
      .eq('id', params.scenario)
      .eq('is_active', true)
      .single(),
    supabase
      .from('profiles')
      .select('hsk_level, correction_mode')
      .eq('auth_id', user.id)
      .single()
  ])

  if (!scenario) {
    notFound()
  }

  return (
    <ConversationClient
      scenarioId={scenario.id}
      scenarioName={(scenario.name as { en: string; zh: string }).en}
      scenarioDescription={(scenario.description as { en: string; zh: string }).en}
      hskLevel={profile?.hsk_level || 3}
      correctionMode={(profile?.correction_mode || 'friendly') as CorrectionMode}
      recommendedHsk={scenario.recommended_hsk as number[]}
      durationMinutes={scenario.duration_minutes}
    />
  )
}
