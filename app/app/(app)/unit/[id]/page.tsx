import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { UnitClient } from './unit-client'
import { ChevronLeft } from 'lucide-react'

export const metadata = { title: 'Unit' }

export default async function UnitPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: unitId } = await params
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, hsk_level, display_mode')
    .eq('auth_id', user.id)
    .single()
  if (!profile) return null

  const { data: unit } = await supabase
    .from('learning_units')
    .select('*')
    .eq('id', unitId)
    .single()
  if (!unit) {
    notFound()
    return
  }

  // unlock_score belongs to the destination unit, not the current unit.
  const { data: nextUnit, error: nextUnitError } = await supabase
    .from('learning_units')
    .select('unlock_score')
    .eq('is_active', true)
    .gt('sort_order', unit.sort_order)
    .order('sort_order')
    .limit(1)
    .maybeSingle()
  if (nextUnitError) throw nextUnitError

  // 拉该单元下的所有内容
  const [{ data: scenarios }, { data: shadowing }, { data: dubbing }, { data: progress }] = await Promise.all([
    supabase
      .from('scenarios')
      .select('id, name, description, recommended_hsk, duration_minutes')
      .eq('unit_id', unitId)
      .eq('is_active', true)
      .order('sort_order'),
    supabase
      .from('shadowing_sentences')
      .select('id, text_zh, text_pinyin, text_en, hsk_level, category, difficulty')
      .eq('unit_id', unitId)
      .eq('is_active', true)
      .order('sort_order'),
    supabase
      .from('dubbing_clips')
      .select('id, title, category, description, duration_seconds, hsk_level, difficulty')
      .eq('unit_id', unitId)
      .eq('is_active', true)
      .order('sort_order'),
    supabase
      .from('user_progress')
      .select('status, best_score')
      .eq('user_id', profile.id)
      .eq('unit_id', unitId)
      .single(),
  ])

  return (
    <div className="space-y-6">
      <Link
        href="/dashboard"
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" />
        Back to dashboard
      </Link>

      <UnitClient
        unit={unit as any}
        nextUnlockScore={nextUnit?.unlock_score ?? null}
        scenarios={(scenarios as any[]) || []}
        shadowing={(shadowing as any[]) || []}
        dubbing={(dubbing as any[]) || []}
        progress={(progress as any) || null}
        displayMode={(profile.display_mode as 'journey' | 'exam') || 'journey'}
      />
    </div>
  )
}
