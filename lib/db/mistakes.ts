/**
 * 错题数据访问层 + SRS 算法
 */
import { createSupabaseServerClient } from '@/lib/supabase/server'
import type { Mistake, MistakeEntry, MistakeType } from '@/lib/db/types'

/**
 * 批量创建错题（从一轮对话的 errors 中提取）
 */
export async function createMistakesFromErrors(opts: {
  userId: string
  errors: MistakeEntry[]
  conversationId: string
  hskLevel: number
  scenario: string
}): Promise<void> {
  if (!opts.errors || opts.errors.length === 0) return

  const supabase = await createSupabaseServerClient()
  const records = opts.errors.map((err) => ({
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
    review_count: 0
  }))

  const { error } = await supabase.from('mistakes').insert(records)
  if (error) {
    console.error('Failed to save mistakes:', error)
    // 不 throw（错题保存失败不应中断对话）
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
    .eq('mastered', false)
    .order('next_review_at', { ascending: true })
    .limit(limit)

  if (error) throw error
  return (data || []) as Mistake[]
}

/**
 * 更新错题的 SRS 状态
 * @param quality 回忆质量 0-5（0=完全忘记，5=完美回忆）
 */
export async function reviewMistake(mistakeId: string, quality: number): Promise<Mistake> {
  const supabase = await createSupabaseServerClient()

  // 获取当前状态
  const { data: mistake, error: fetchError } = await supabase
    .from('mistakes')
    .select('*')
    .eq('id', mistakeId)
    .single()

  if (fetchError || !mistake) throw fetchError || new Error('Mistake not found')

  // SM-2 算法
  const updated = calculateSRS(mistake as unknown as Mistake, quality)

  const { data, error } = await supabase
    .from('mistakes')
    .update({
      review_count: updated.review_count,
      ease_factor: updated.ease_factor,
      interval_days: updated.interval_days,
      next_review_at: updated.next_review_at,
      last_reviewed_at: new Date().toISOString(),
      mastered: updated.mastered
    })
    .eq('id', mistakeId)
    .select()
    .single()

  if (error) throw error
  return data as Mistake
}

/**
 * SM-2 间隔重复算法
 */
export function calculateSRS(
  mistake: Pick<Mistake, 'review_count' | 'ease_factor' | 'interval_days'>,
  quality: number
): {
  review_count: number
  ease_factor: number
  interval_days: number
  next_review_at: string
  mastered: boolean
} {
  let { review_count, ease_factor, interval_days } = mistake
  review_count = (review_count || 0) + 1

  if (quality < 3) {
    // 回忆失败：重置间隔到 1 天
    interval_days = 1
  } else {
    // 回忆成功：根据次数增加间隔
    if (review_count === 1) {
      interval_days = 1
    } else if (review_count === 2) {
      interval_days = 6
    } else {
      interval_days = Math.round(interval_days * ease_factor)
    }

    // 更新难度因子
    ease_factor = Math.max(
      1.3,
      ease_factor + 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)
    )
  }

  // 计算 next_review_at
  const nextReview = new Date()
  nextReview.setDate(nextReview.getDate() + interval_days)

  // 连续 5 次高质量回忆 → 标记为已掌握
  const mastered = review_count >= 5 && quality >= 4

  return {
    review_count,
    ease_factor: Math.round(ease_factor * 100) / 100,
    interval_days,
    next_review_at: nextReview.toISOString(),
    mastered
  }
}
