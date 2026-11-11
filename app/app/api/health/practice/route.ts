/** Authenticated read-only readiness check. Never returns credentials or records. */
import { NextResponse } from 'next/server'
import { createSupabaseAdmin, createSupabaseServerClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const client = await createSupabaseServerClient()
  const { data: { user } } = await client.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: profile, error: profileError } = await client.from('profiles').select('id').eq('auth_id', user.id).maybeSingle()
  if (profileError || !profile) return NextResponse.json({ ready: false }, { status: 503 })
  try {
    const { error } = await createSupabaseAdmin().from('verified_practice_credits').select('source_id').eq('user_id', profile.id).limit(1)
    return NextResponse.json({ ready: !error }, { status: error ? 503 : 200 })
  } catch {
    return NextResponse.json({ ready: false }, { status: 503 })
  }
}
