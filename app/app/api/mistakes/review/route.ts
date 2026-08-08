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
import { reviewMistake } from '@/lib/db/mistakes'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { mistake_id, quality } = await request.json()

    if (!mistake_id || typeof quality !== 'number' || quality < 0 || quality > 5) {
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

    const updated = await reviewMistake(mistake_id, quality)

    return NextResponse.json({
      id: updated.id,
      review_count: updated.review_count,
      next_review_at: updated.next_review_at,
      ease_factor: updated.ease_factor,
      interval_days: updated.interval_days,
      mastered: updated.mastered
    })
  } catch (error) {
    console.error('Mistake review failed:', error)
    return NextResponse.json(
      { error: 'Failed to review mistake' },
      { status: 500 }
    )
  }
}
