/**
 * POST /api/subscription/cancel
 * 取消当前订阅（在当前计费周期结束时失效）
 */
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('auth_id', user.id)
      .single()

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    // 获取当前活跃订阅
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', profile.id)
      .eq('status', 'active')
      .not('plan', 'eq', 'free')
      .single()

    if (!subscription || !subscription.lemon_squeezy_id) {
      return NextResponse.json({ error: 'No active paid subscription found' }, { status: 404 })
    }

    // 调用 Lemon Squeezy API 取消
    const lsApiKey = process.env.LEMONSQUEEZY_API_KEY
    if (!lsApiKey) {
      return NextResponse.json({ error: 'Payment system not configured' }, { status: 500 })
    }

    const lsResponse = await fetch(`https://api.lemonsqueezy.com/v1/subscriptions/${subscription.lemon_squeezy_id}`, {
      method: 'DELETE',
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${lsApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        data: {
          type: 'subscriptions',
          id: subscription.lemon_squeezy_id,
          attributes: {
            cancelled: true
          }
        }
      })
    })

    if (!lsResponse.ok) {
      const errorData = await lsResponse.json().catch(() => ({}))
      console.error('Lemon Squeezy cancel failed:', errorData)
      return NextResponse.json(
        { error: 'Failed to cancel subscription with payment provider' },
        { status: 500 }
      )
    }

    // 更新数据库：保持 active 状态，标记 cancel_at_period_end
    // webhook 会在周期结束时将 status 改为 expired
    await supabase
      .from('subscriptions')
      .update({
        cancel_at_period_end: true,
        updated_at: new Date().toISOString()
      })
      .eq('id', subscription.id)

    return NextResponse.json({
      success: true,
      message: 'Subscription canceled. You\'ll keep access until the end of your billing period.',
      current_period_end: subscription.current_period_end
    })
  } catch (error) {
    console.error('Cancel subscription failed:', error)
    return NextResponse.json(
      { error: 'Failed to cancel subscription' },
      { status: 500 }
    )
  }
}
