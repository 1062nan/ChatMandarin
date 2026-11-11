/**
 * 错题数据访问层 + SRS 算法
 */
import { createSupabaseServerClient } from '@/lib/supabase/server'
import type { Mistake, MistakeEntry, MistakeType } from '@/lib/db/types'
import { getSubscriptionContext } from '@/lib/subscription/tier'
import { isReviewableMistake } from '@/lib/ai/conversation-feedback'
import { calculateSRS } from '@/lib/practice/review-schedule'
export { calculateSRS } from '@/lib/practice/review-schedule'

/**
 * 批量创建错题（从一轮对话的 errors 中提取）
 *
 * 配额规则：
 * - free: 未掌握错题上限 20 条，超出时不再保存新错题（但不中断对话）
 * - plus/pro: 无限
 */
export async function createMistakesFromErrors(opts: {
  userId: string
  errors: MistakeEntry[]
  conversationId: string
  hskLevel: number
  scenario: string
}): Promise<void> {
  opts = { ...opts, errors: (opts.errors || []).filter(isReviewableMistake) }
  if (opts.errors.length === 0) return

  const supabase = await createSupabaseServerClient()

  // 检查容量
  const subCtx = await getSubscriptionContext(opts.userId)
  let allowedNew = opts.errors.length
  if (subCtx.features.mistakeCapacity !== null) {
    // Quarantined legacy tutor hints must not consume the learner's capacity.
    // Scan bounded pages, stopping as soon as the plan limit is reached.
    let current = 0
    for (let offset = 0; current < subCtx.features.mistakeCapacity; offset += 100) {
      const { data: existing, error: capacityError } = await supabase
        .from('mistakes')
        .select('correct, explanation')
        .eq('user_id', opts.userId)
        .eq('mastered', false)
        .order('id')
        .range(offset, offset + 99)
      if (capacityError) throw capacityError
      const rows = existing || []
      current += rows.filter(isReviewableMistake).length
      if (rows.length < 100) break
    }
    const remaining = Math.max(0, subCtx.features.mistakeCapacity - current)
    allowedNew = Math.min(opts.errors.length, remaining)
    if (allowedNew === 0) {
      console.warn(
        `[mistakes] User ${opts.userId} hit free capacity (${current}/${subCtx.features.mistakeCapacity}), skipping save`
      )
      return
    }
  }

  const records = opts.errors.slice(0, allowedNew).map((err) => ({
    user_id: opts.userId,
    type: err.type as MistakeType,
    user_said: err.user_said,
    correct: err.correct,
    explanation: err.explanation || null,
    hsk_level: opts.hskLevel,
    scenario: opts.scenario,
    source_conversation_id: opts.conversationId,
    next_review_at: new Date().toISOString(),
    ease_factor: 2.5,
    interval_days: 1,
    mastered: false,
    review_count: 0,
    consecutive_successes: 0
  }))

  const { error } = await supabase.from('mistakes').insert(records)
  if (error) {
    console.error('Failed to save mistakes:', error)
    // The conversation route preserves the saved turn and exposes a warning.
    throw error
  }
}

/**
 * 获取今天待复习的错题
 */
export async function getPendingMistakes(userId: string, limit: number = 20): Promise<Mistake[]> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from('mistakes')
    .select('*')
    .eq('user_id', userId)
    .lte('next_review_at', new Date().toISOString())
    .order('next_review_at', { ascending: true })
    .limit(limit)

  if (error) throw error
  return ((data || []) as Mistake[]).filter(isReviewableMistake)
}

export class ReviewConflictError extends Error {}

/** Owner-scoped, due-only compare-and-swap: repeat clicks cannot advance a card. */
export async function reviewMistake(
  mistakeId: string, quality: number, userId: string, expectedReviewCount: number
): Promise<Mistake> {
  const supabase = await createSupabaseServerClient()
  const { data: mistake, error: fetchError } = await supabase.from('mistakes')
    .select('*').eq('id', mistakeId).eq('user_id', userId).single()
  if (fetchError || !mistake) throw fetchError || new Error('Mistake not found')
  const now = new Date()
  if (!isReviewableMistake(mistake) || (mistake.review_count || 0) !== expectedReviewCount
    || !mistake.next_review_at || new Date(mistake.next_review_at).getTime() > now.getTime()) {
    throw new ReviewConflictError('This card has changed or is not due. Refresh your review list.')
  }
  const updated = calculateSRS(mistake as Mistake, quality, now)
  let query = supabase.from('mistakes').update({ ...updated, last_reviewed_at: now.toISOString() })
    .eq('id', mistakeId).eq('user_id', userId)
    .eq('next_review_at', mistake.next_review_at)
    .lte('next_review_at', now.toISOString())
  query = mistake.review_count === null ? query.is('review_count', null) : query.eq('review_count', mistake.review_count)
  const { data, error } = await query.select().maybeSingle()
  if (error) throw error
  if (!data) throw new ReviewConflictError('This review was already saved. Refresh your review list.')
  return data as Mistake
}
