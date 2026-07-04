/**
 * POST /api/checkout
 *
 * 创建 Lemon Squeezy Checkout URL
 *
 * Request body:
 *   { plan: "plus" | "pro" }
 *
 * Response:
 *   { url: "https://chatmandarin.lemonsqueezy.com/checkout/..." }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { createCheckoutUrl, type PlanType } from '@/lib/payment/lemonsqueezy'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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

    const { plan } = await request.json()

    if (plan !== 'plus' && plan !== 'pro') {
      return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

    const url = await createCheckoutUrl({
      plan: plan as PlanType,
      userEmail: profile.email,
      userId: profile.id,
      redirectUrl: `${appUrl}/settings?upgraded=true`
    })

    return NextResponse.json({ url })
  } catch (error) {
    console.error('Checkout creation failed:', error)
    return NextResponse.json(
      { error: 'Failed to create checkout', details: (error as Error).message },
      { status: 500 }
    )
  }
}
