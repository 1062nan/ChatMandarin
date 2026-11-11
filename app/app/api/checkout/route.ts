/**
 * POST /api/checkout
 *
 * 创建 Creem Checkout URL
 *
 * Request body:
 *   { plan: "plus" | "pro" }
 *
 * Response:
 *   { url: "https://checkout.creem.io/..." }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { createCheckoutUrl, isCreemPaymentsAvailable, type PlanType } from '@/lib/payment/creem'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!isCreemPaymentsAvailable()) {
      return NextResponse.json(
        { error: 'Subscriptions are temporarily unavailable.' },
        { status: 503 }
      )
    }

    // 获取 profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, email')
      .eq('auth_id', user.id)
      .single()

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    const { data: subscription, error: subscriptionError } = await supabase
      .from('subscriptions')
      .select('provider_subscription_id, status, plan')
      .eq('user_id', profile.id)
      .maybeSingle()
    if (subscriptionError) throw subscriptionError
    if (subscription?.provider_subscription_id) {
      return NextResponse.json({ error: 'An existing subscription must be managed before starting another checkout.' }, { status: 409 })
    }
    // New checkout remains feature-gated until provider sandbox tests and
    // cross-request checkout reservation/reuse have passed release review.
    const { plan } = await request.json()

    if (plan !== 'plus' && plan !== 'pro') {
      return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

    const url = await createCheckoutUrl({
      plan: plan as PlanType,
      userEmail: profile.email,
      userId: profile.id,
      successUrl: `${appUrl}/settings?upgraded=true`
    })

    return NextResponse.json({ url })
  } catch (error) {
    console.error('Checkout creation failed:', error)
    return NextResponse.json(
      { error: 'Failed to create checkout' },
      { status: 500 }
    )
  }
}
