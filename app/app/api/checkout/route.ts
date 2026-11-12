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
import { createSupabaseServerClient, createSupabaseAdmin } from '@/lib/supabase/server'
import { createCheckoutSession, isCreemPaymentsAvailable, productIdForPlan, getCreemApiBaseUrl, type PlanType } from '@/lib/payment/creem'

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
    const body = await request.json().catch(() => null)
    const plan = body?.plan

    if (plan !== 'plus' && plan !== 'pro') {
      return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })
    }

    // Validate all local configuration before reserving. No provider call may be
    // retried blindly after timeout or persistence failure.
    const appUrl = new URL(process.env.NEXT_PUBLIC_APP_URL || '')
    if (appUrl.protocol !== 'https:' || appUrl.username || appUrl.password
      || appUrl.hostname === 'localhost' || appUrl.hostname === '127.0.0.1') {
      throw new Error('Invalid checkout callback origin')
    }
    const apiOrigin = getCreemApiBaseUrl()
    if (!['https://api.creem.io/v1', 'https://test-api.creem.io/v1'].includes(apiOrigin)) {
      throw new Error('Unsupported payment API origin')
    }
    const admin = createSupabaseAdmin()
    const { data: reservation, error: reserveError } = await admin.rpc('reserve_creem_checkout', {
      p_profile_id: profile.id, p_plan: plan, p_product_id: productIdForPlan(plan), p_api_origin: apiOrigin,
    })
    if (reserveError) throw reserveError
    if (reservation?.outcome === 'ready' && reservation.url) {
      return NextResponse.json({ url: reservation.url }, { headers: { 'Cache-Control': 'no-store' } })
    }
    if (reservation?.outcome !== 'created' || !reservation.attempt_id) {
      return NextResponse.json({ error: 'An existing checkout or subscription must be resolved before creating another. Please retry to retrieve a ready checkout, or contact support.' }, { status: 409 })
    }
    const session = await createCheckoutSession({
      plan: plan as PlanType, userEmail: profile.email, userId: profile.id,
      successUrl: `${appUrl.origin}/settings?upgraded=true`, requestId: reservation.attempt_id,
    })
    const { data: saved, error: saveError } = await admin.rpc('finish_creem_checkout', {
      p_profile_id: profile.id, p_attempt_id: reservation.attempt_id, p_checkout_id: session.id, p_checkout_url: session.url,
    })
    if (saveError || saved !== true) throw new Error('Checkout result requires reconciliation')

    return NextResponse.json({ url: session.url }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('Checkout creation failed:', error)
    return NextResponse.json(
      { error: 'Failed to create checkout' },
      { status: 500 }
    )
  }
}
