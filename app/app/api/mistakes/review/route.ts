/**
 * POST /api/mistakes/review
 *
 * 用户复习一个错题，提交回忆质量 → 更新 SRS
 *
 * Request body:
 *   { mistake_id: "uuid", quality: 0-5 }
 *
 * Response:
 *   { updated mistake object }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { reviewMistake, ReviewConflictError } from '@/lib/db/mistakes'
import { collectReviewQueue } from '@/lib/practice/review-queue'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => null)
    const { mistake_id, quality, expected_review_count } = body || {}

    if (typeof mistake_id !== 'string' || !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(mistake_id)
      || !Number.isInteger(quality) || quality < 0 || quality > 5
      || !Number.isInteger(expected_review_count) || expected_review_count < 0) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
    }

    // 验证错题属于当前用户
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('auth_id', user.id)
      .single()

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    const { data: mistake } = await supabase
      .from('mistakes')
      .select('user_id')
      .eq('id', mistake_id)
      .single()

    if (!mistake || mistake.user_id !== profile.id) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const updated = await reviewMistake(mistake_id, quality, profile.id, expected_review_count)

    return NextResponse.json({
      id: updated.id,
      review_count: updated.review_count,
      consecutive_successes: updated.consecutive_successes,
      next_review_at: updated.next_review_at,
      ease_factor: updated.ease_factor,
      interval_days: updated.interval_days,
      mastered: updated.mastered
    })
  } catch (error) {
    if (error instanceof ReviewConflictError) return NextResponse.json({ error: error.message }, { status: 409 })
    console.error('Mistake review failed:', error)
    return NextResponse.json(
      { error: 'Failed to review mistake' },
      { status: 500 }
    )
  }
}

/** Server time determines due cards, not a learner device's potentially skewed clock. */
export async function GET() {
  const headers = { 'Cache-Control': 'private, no-store' }
  try {
    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Please sign in to load your reviews.' }, { status: 401, headers })
    const { data: profile, error } = await supabase.from('profiles').select('id').eq('auth_id', user.id).single()
    if (error || !profile) return NextResponse.json({ error: 'Unable to load your learning profile.' }, { status: 404, headers })
    const now = new Date().toISOString()
    const [due, upcoming] = await Promise.all([
      collectReviewQueue(async (from, to) => await supabase.from('mistakes').select('*').eq('user_id', profile.id)
        .lte('next_review_at', now).order('next_review_at').order('id').range(from, to)),
      collectReviewQueue(async (from, to) => await supabase.from('mistakes').select('*').eq('user_id', profile.id)
        .gt('next_review_at', now).order('next_review_at').order('id').range(from, to)),
    ])
    return NextResponse.json({ due, upcoming }, { headers })
  } catch {
    return NextResponse.json({ error: 'Unable to load reviews. Please retry.' }, { status: 503, headers })
  }
}
