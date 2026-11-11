import { createHash } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase/server'
import { parseCreemEvent, verifyCreemWebhookSignature } from '@/lib/payment/creem'
import { subscriptionEventState } from '@/lib/payment/lifecycle'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const body = await request.text()
    if (!verifyCreemWebhookSignature(body, request.headers.get('creem-signature') || '')) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }
    let payload: unknown
    try { payload = JSON.parse(body) } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }
    const parsed = parseCreemEvent(payload)
    if (!parsed.eventId || !parsed.eventType) {
      return NextResponse.json({ error: 'Invalid event' }, { status: 400 })
    }
    const state = subscriptionEventState(parsed)
    if (!state) return NextResponse.json({ received: true, ignored: true })
    if (!parsed.subscriptionId || !parsed.eventCreatedAt) {
      return NextResponse.json({ error: 'Missing ordering metadata' }, { status: 400 })
    }
    // Do not let test-mode events alter production entitlement (or vice versa).
    const testMode = /^(true|1)$/i.test((process.env.CREEM_TEST_MODE || '').replace(/^['"]|['"]$/g, '').trim())
    if (parsed.mode && parsed.mode !== (testMode ? 'test' : 'prod')) {
      return NextResponse.json({ error: 'Payment environment mismatch' }, { status: 400 })
    }
    const supabase = createSupabaseAdmin()
    let userId = parsed.userId
    if (!userId && parsed.customerEmail) {
      const { data, error } = await supabase.from('profiles').select('id').eq('email', parsed.customerEmail).maybeSingle()
      if (error) throw error
      userId = data?.id || null
    }
    const { data, error } = await supabase.rpc('apply_creem_subscription_event', {
      p_event_id: parsed.eventId,
      p_event_type: parsed.eventType,
      p_event_hash: createHash('sha256').update(body).digest('hex'),
      p_event_created_at: new Date(parsed.eventCreatedAt).toISOString(),
      p_profile_id: userId,
      p_subscription_id: parsed.subscriptionId,
      p_plan: state.plan,
      p_status: state.status,
      p_period_end: parsed.currentPeriodEnd,
      p_cancel_at_period_end: state.cancelAtPeriodEnd,
    })
    if (error) throw error
    const result = Array.isArray(data) ? data[0] : data
    if (!result || !['applied', 'duplicate', 'stale', 'conflict'].includes(result.outcome)) throw new Error('Invalid billing result')
    if (result.outcome === 'conflict') {
      return NextResponse.json({ error: 'Subscription reconciliation required' }, { status: 409 })
    }
    return NextResponse.json({ received: true, outcome: result.outcome })
  } catch {
    // Do not log signed payloads, customer details, or provider credentials.
    console.error('Creem webhook processing failed; reconciliation/retry required')
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
  }
}
