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
        headers: { 'Accept': 'application/json', 'x-api-key': apiKey },
      }
    )

    if (!response.ok) {
      console.error('Creem cancel failed with status:', response.status)
      return NextResponse.json(
        { error: 'Failed to cancel subscription with payment provider' },
        { status: 502 }
      )
    }

    const result = await response.json().catch(() => ({})) as { current_period_end_date?: string }
    const { error: updateError } = await supabase.from('subscriptions').update({
      cancel_at_period_end: true,
      current_period_end: result.current_period_end_date || subscription.current_period_end,
      updated_at: new Date().toISOString(),
    }).eq('id', subscription.id)
    if (updateError) throw updateError

    return NextResponse.json({
      success: true,
      message: 'Subscription canceled. Access continues until the end of the billing period.',
      current_period_end: result.current_period_end_date || subscription.current_period_end,
    })
  } catch (error) {
    console.error('Cancel subscription failed:', error)
    return NextResponse.json({ error: 'Failed to cancel subscription' }, { status: 500 })
  }
}
