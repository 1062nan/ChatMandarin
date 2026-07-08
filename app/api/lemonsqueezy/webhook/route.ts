/**
 * POST /api/lemonsqueezy/webhook
 *
 * Lemon Squeezy 订阅 webhook 回调
 * 处理订阅创建、更新、取消
 */

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase/server'
import { verifyWebhookSignature, parseWebhookEvent } from '@/lib/payment/lemonsqueezy'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const body = await request.text()
    const signature = request.headers.get('X-Signature') || ''

    // 验证签名
    const isValid = verifyWebhookSignature(body, signature)
    if (!isValid) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    const event = JSON.parse(body)
    const parsed = parseWebhookEvent(event)

    const supabase = createSupabaseAdmin()

    // 重放保护：独立 webhook_events 表，event_id 唯一约束
    const eventId =
      event.meta?.event_id || `${parsed.eventName}_${parsed.subscriptionId}_${Date.now()}`
    if (eventId) {
      const { data: inserted, error: insertErr } = await supabase
        .from('webhook_events')
        .insert({
          event_id: String(eventId),
          event_name: parsed.eventName || '',
          subscription_id: parsed.subscriptionId || '',
        })
        .select('event_id')
        .maybeSingle()

      // 唯一约束冲突 = 已处理过 = 重放
      if (insertErr || !inserted) {
        console.log(`Webhook duplicate event_id: ${eventId}`)
        return NextResponse.json({ received: true, duplicate: true })
      }
    }

    if (!parsed.userId) {
      console.warn('Webhook missing user_id in custom_data')
      return NextResponse.json({ error: 'Missing user_id' }, { status: 400 })
    }

    // 根据事件类型处理
    switch (parsed.eventName) {
      case 'subscription_created':
      case 'subscription_updated': {
        // 更新或创建订阅记录
        const { error } = await supabase
          .from('subscriptions')
          .upsert({
            user_id: parsed.userId,
            lemon_squeezy_id: parsed.subscriptionId,
            plan: parsed.plan || 'plus',
            status: mapStatus(parsed.status),
            current_period_end: parsed.renewsAt?.toISOString() || null,
            cancel_at_period_end: !!parsed.endsAt,
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'lemon_squeezy_id'
          })

        if (error) {
          console.error('Failed to update subscription:', error)
        }
        break
      }

      case 'subscription_cancelled': {
        await supabase
          .from('subscriptions')
          .update({
            status: 'canceled',
            cancel_at_period_end: true,
            current_period_end: parsed.endsAt?.toISOString() || null,
            updated_at: new Date().toISOString()
          })
          .eq('lemon_squeezy_id', parsed.subscriptionId)

        // 订阅到期后降级为 free
        if (parsed.endsAt && parsed.endsAt < new Date()) {
          await supabase
            .from('subscriptions')
            .update({ plan: 'free', status: 'expired' })
            .eq('lemon_squeezy_id', parsed.subscriptionId)
        }
        break
      }

      case 'subscription_expired': {
        await supabase
          .from('subscriptions')
          .update({
            status: 'expired',
            plan: 'free',
            updated_at: new Date().toISOString()
          })
          .eq('lemon_squeezy_id', parsed.subscriptionId)
        break
      }

      case 'subscription_payment_failed': {
        await supabase
          .from('subscriptions')
          .update({
            status: 'past_due',
            updated_at: new Date().toISOString()
          })
          .eq('lemon_squeezy_id', parsed.subscriptionId)
        break
      }

      default:
        console.log(`Unhandled webhook event: ${parsed.eventName}`)
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('Webhook processing failed:', error)
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    )
  }
}

function mapStatus(lsStatus: string | undefined): string {
  if (!lsStatus) return 'active'
  const map: Record<string, string> = {
    'active': 'active',
    'on_trial': 'trialing',
    'cancelled': 'canceled',
    'expired': 'expired',
    'paused': 'past_due',
    'past_due': 'past_due'
  }
  return map[lsStatus] || 'active'
}
