import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getCreemApiBaseUrl } from '@/lib/payment/creem'

export const runtime = 'nodejs'

export async function POST() {
  try {
    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('auth_id', user.id)
      .single()
    if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', profile.id)
      .not('plan', 'eq', 'free')
      .maybeSingle()

    if (!subscription?.provider_subscription_id) {
      return NextResponse.json({ error: 'No active paid subscription found' }, { status: 404 })
    }
    if (subscription.cancel_at_period_end) {
      return NextResponse.json({ success: true, alreadyCanceled: true })
    }

    const apiKey = process.env.CREEM_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'Payment system not configured' }, { status: 500 })
    }

    const response = await fetch(
      `${getCreemApiBaseUrl()}/subscriptions/${subscription.provider_subscription_id}/cancel`,
      {
        method: 'POST',
        headers: { 'Accept': 'application/json', 'Content-Type': 'application/json', 'x-api-key': apiKey },
        body: JSON.stringify({ mode: 'scheduled', onExecute: 'cancel' }),
      }
    )

    if (!response.ok) {
      console.error('Creem cancel failed with status:', response.status)
      return NextResponse.json(
        { error: 'Failed to cancel subscription with payment provider' },
        { status: 502 }
      )
    }

    // The provider accepted the request. Only its verified webhook updates
    // canonical entitlement; a user-session UPDATE is forbidden by RLS and
    // would also race webhook ordering. Never report activation/cancellation
    // as persisted just because an unselected UPDATE returned no error.
    const { data: confirmed, error: readError } = await supabase.from('subscriptions')
      .select('cancel_at_period_end, current_period_end')
      .eq('id', subscription.id)
      .maybeSingle()
    const synced = !readError && confirmed?.cancel_at_period_end === true
    return NextResponse.json({
      success: true,
      pendingSync: !synced,
      message: synced ? 'Cancellation scheduled.' : 'Cancellation accepted; subscription status is syncing.',
      current_period_end: synced ? confirmed.current_period_end : subscription.current_period_end,
    }, { status: synced ? 200 : 202 })
  } catch (error) {
    console.error('Cancel subscription failed:', error)
    return NextResponse.json({ error: 'Failed to cancel subscription' }, { status: 500 })
  }
}
