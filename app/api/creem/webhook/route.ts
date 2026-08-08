import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase/server'
import { parseCreemEvent, verifyCreemWebhookSignature } from '@/lib/payment/creem'

export const runtime = 'nodejs'

const GRANT_EVENTS = new Set([
  'subscription.active',
  'subscription.paid',
  'subscription.trialing',
])

export async function POST(request: NextRequest) {
  try {
    const body = await request.text()
    const signature = request.headers.get('creem-signature') || ''

    if (!verifyCreemWebhookSignature(body, signature)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    const parsed = parseCreemEvent(JSON.parse(body))
    if (!parsed.eventId || !parsed.eventType) {
      return NextResponse.json({ error: 'Invalid event' }, { status: 400 })
    }

    const supabase = createSupabaseAdmin()
    const { data: existing, error: existingError } = await supabase
      .from('webhook_events')
      .select('event_id')
      .eq('event_id', parsed.eventId)
      .maybeSingle()
    if (existingError) throw existingError
    if (existing) return NextResponse.json({ received: true, duplicate: true })

    let userId = parsed.userId
    if (!userId && parsed.customerEmail) {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', parsed.customerEmail)
        .maybeSingle()
      if (profileError) throw profileError
      userId = profile?.id || null
    }

    if (GRANT_EVENTS.has(parsed.eventType)) {
      if (!userId || !parsed.subscriptionId || !parsed.plan) {
        return NextResponse.json({ error: 'Missing subscription metadata' }, { status: 400 })
      }

      const status = parsed.eventType === 'subscription.trialing' ? 'trialing' : 'active'
      const { error } = await supabase.from('subscriptions').upsert({
        user_id: userId,
        provider_subscription_id: parsed.subscriptionId,
        payment_provider: 'creem',
        plan: parsed.plan,
        status,
        current_period_end: parsed.currentPeriodEnd,
        cancel_at_period_end: false,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' })
      if (error) throw error
    } else if (parsed.eventType === 'subscription.update') {
      if (!userId || !parsed.subscriptionId || !parsed.plan) {
        return NextResponse.json({ error: 'Missing subscription metadata' }, { status: 400 })
      }
      const isScheduledCancel = parsed.status === 'scheduled_cancel'
      const status = parsed.status === 'trialing'
        ? 'trialing'
        : parsed.status === 'canceled'
          ? 'canceled'
          : parsed.status === 'past_due' || parsed.status === 'paused'
            ? 'past_due'
            : 'active'
      const { error } = await supabase.from('subscriptions').upsert({
        user_id: userId,
        provider_subscription_id: parsed.subscriptionId,
        payment_provider: 'creem',
        plan: parsed.plan,
        status,
        current_period_end: parsed.currentPeriodEnd,
        cancel_at_period_end: isScheduledCancel || status === 'canceled',
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' })
      if (error) throw error
    } else if (parsed.eventType === 'subscription.scheduled_cancel') {
      if (!parsed.subscriptionId) return missingSubscriptionId()
      const { error } = await supabase.from('subscriptions').update({
        status: 'active',
        cancel_at_period_end: true,
        current_period_end: parsed.currentPeriodEnd,
        updated_at: new Date().toISOString(),
      }).eq('provider_subscription_id', parsed.subscriptionId)
      if (error) throw error
    } else if (parsed.eventType === 'subscription.canceled') {
      if (!parsed.subscriptionId) return missingSubscriptionId()
      const { error } = await supabase.from('subscriptions').update({
        status: 'canceled',
        cancel_at_period_end: true,
        current_period_end: parsed.currentPeriodEnd,
        updated_at: new Date().toISOString(),
      }).eq('provider_subscription_id', parsed.subscriptionId)
      if (error) throw error
    } else if (
      parsed.eventType === 'subscription.past_due' ||
      parsed.eventType === 'subscription.paused' ||
      parsed.eventType === 'subscription.unpaid'
    ) {
      if (!parsed.subscriptionId) return missingSubscriptionId()
      const { error } = await supabase.from('subscriptions').update({
        status: 'past_due',
        updated_at: new Date().toISOString(),
      }).eq('provider_subscription_id', parsed.subscriptionId)
      if (error) throw error
    } else if (parsed.eventType === 'subscription.expired') {
      if (!parsed.subscriptionId) return missingSubscriptionId()
      const { error } = await supabase.from('subscriptions').update({
        plan: 'free',
        status: 'expired',
        cancel_at_period_end: false,
        updated_at: new Date().toISOString(),
      }).eq('provider_subscription_id', parsed.subscriptionId)
      if (error) throw error
    } else if (parsed.eventType === 'refund.created' || parsed.eventType === 'dispute.created') {
      if (!parsed.subscriptionId) return missingSubscriptionId()
      const { error } = await supabase.from('subscriptions').update({
        plan: 'free',
        status: 'expired',
        cancel_at_period_end: false,
        updated_at: new Date().toISOString(),
      }).eq('provider_subscription_id', parsed.subscriptionId)
      if (error) throw error
    }

    const { error: eventError } = await supabase.from('webhook_events').insert({
      event_id: parsed.eventId,
      event_name: parsed.eventType,
      subscription_id: parsed.subscriptionId || '',
    })
    if (eventError?.code !== '23505' && eventError) throw eventError

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('Creem webhook processing failed:', error)
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
  }
}

function missingSubscriptionId() {
  return NextResponse.json({ error: 'Missing subscription ID' }, { status: 400 })
}
