/**
 * 学习路径推荐引擎
 * 根据用户历史成绩推荐下一步学习内容
 */

import { createSupabaseServerClient } from '@/lib/supabase/server'

export interface LearningUnit {
  id: string
  hsk_level: number
  unit_number: number
  title: string
  description: string
  difficulty: string
  unlock_score: number
  content_config: any
  sort_order: number
  // HSK 大纲标签（migration 007）— 后端用，前端默认不展示
  grammar_points?: string[]
  vocab_topics?: string[]
  exam_skills?: string[]
  official_scenario_ids?: string[]
}

export interface UserUnitProgress {
  unit_id: string
  status: 'locked' | 'available' | 'in_progress' | 'completed' | 'mastered'
  best_score: number
  attempts: number
}

export interface Recommendation {
  type: 'unlock_next' | 'practice_more' | 'review' | 'try_harder' | 'all_done'
  unit_id: string
  reason: string
  suggested_scenarios: string[]
  suggested_shadowing: number
  suggested_dubbing?: string
}

/**
 * 获取用户的学习路径状态
 */
export async function getLearningPath(userId: string, hskLevel: number): Promise<{
  units: LearningUnit[]
  progress: Map<string, UserUnitProgress>
  recommendation: Recommendation | null
}> {
  const supabase = await createSupabaseServerClient()

  // 获取该 HSK 级别及以下的所有单元
  const { data: units } = await supabase
    .from('learning_units')
    .select('*')
    .lte('hsk_level', hskLevel)
    .eq('is_active', true)
    .order('sort_order')

  // 获取用户进度
  const { data: progress } = await supabase
    .from('user_progress')
    .select('*')
    .eq('user_id', userId)

  const progressMap = new Map<string, UserUnitProgress>()
  for (const p of progress || []) {
    progressMap.set(p.unit_id, p)
  }

  const typedUnits = (units || []) as unknown as LearningUnit[]

  // 生成推荐
  const recommendation = generateRecommendation(typedUnits, progressMap)

  return { units: typedUnits, progress: progressMap, recommendation }
}

/**
 * 推荐逻辑
 */
function generateRecommendation(
  units: LearningUnit[],
  progress: Map<string, UserUnitProgress>
): Recommendation | null {
  if (units.length === 0) return null

  // 找到第一个未完成/未掌握的单元
  for (const unit of units) {
    const p = progress.get(unit.id)

    // 单元未解锁
    if (!p || p.status === 'locked') {
      // 检查前置条件
      const prevUnit = units.find(u => u.sort_order === unit.sort_order - 1)
      if (prevUnit) {
        const prevProgress = progress.get(prevUnit.id)
        if (!prevProgress || prevProgress.best_score < unit.unlock_score) {
          // 前置未达标 → 复习
          return {
            type: 'review',
            unit_id: prevUnit.id,
            reason: `需要先在 "${prevUnit.title}" 中达到 ${unit.unlock_score} 分才能解锁 "${unit.title}"。当前最高分：${prevProgress?.best_score || 0}`,
            suggested_scenarios: [],
            suggested_shadowing: 5
          }
        }
      }
      // 前置已达标 → 解锁
      return {
        type: 'unlock_next',
        unit_id: unit.id,
        reason: `新单元已解锁：${unit.title}。开始学习吧！`,
        suggested_scenarios: [],
        suggested_shadowing: 0
      }
    }

    // 单元进行中
    if (p.status === 'available' || p.status === 'in_progress') {
      if (p.best_score < unit.unlock_score) {
        // 分数不够 → 继续练习
        return {
          type: 'practice_more',
          unit_id: unit.id,
          reason: `在 "${unit.title}" 中继续练习。当前最高分：${p.best_score}，需要 ${unit.unlock_score} 分解锁下一关。`,
          suggested_scenarios: [],
          suggested_shadowing: 3
        }
      }
    }

    // 单元已完成但未掌握
    if (p.status === 'completed' && p.best_score >= unit.unlock_score) {
      const nextUnit = units.find(u => u.sort_order === unit.sort_order + 1)
      if (nextUnit) {
        return {
          type: 'try_harder',
          unit_id: nextUnit.id,
          reason: `恭喜完成 "${unit.title}"！可以挑战 "${nextUnit.title}" 了。`,
          suggested_scenarios: [],
          suggested_shadowing: 0
        }
      }
    }
  }

  // 所有单元都掌握了
  return {
    type: 'all_done',
    unit_id: units[units.length - 1].id,
    reason: '太棒了！你已完成当前级别的所有单元。建议提高 HSK 等级挑战更高难度。',
    suggested_scenarios: [],
    suggested_shadowing: 0
  }
}

/**
 * 解锁用户的下一批单元
 */
export async function unlockNextUnits(userId: string): Promise<void> {
  const supabase = await createSupabaseServerClient()

  // 获取所有单元按顺序
  const { data: units } = await supabase
    .from('learning_units')
    .select('*')
    .eq('is_active', true)
    .order('sort_order')

  if (!units) return

  for (let i = 0; i < units.length; i++) {
    const unit = units[i]
    const { data: progress } = await supabase
      .from('user_progress')
      .select('*')
      .eq('user_id', userId)
      .eq('unit_id', unit.id)
      .single()

    if (!progress) {
      // 第一个单元或前置已达标 → 解锁
      if (i === 0) {
        await supabase.from('user_progress').upsert({
          user_id: userId,
          unit_id: unit.id,
          status: 'available'
        })
      } else {
        const prevUnit = units[i - 1]
        const { data: prevProgress } = await supabase
          .from('user_progress')
          .select('best_score')
          .eq('user_id', userId)
          .eq('unit_id', prevUnit.id)
          .single()

        if (prevProgress && prevProgress.best_score >= unit.unlock_score) {
          await supabase.from('user_progress').upsert({
            user_id: userId,
            unit_id: unit.id,
            status: 'available'
          })
        }
      }
    }
  }
}

/**
 * 更新用户在某个单元的分数
 */
export async function updateUnitScore(
  userId: string,
  unitId: string,
  score: number
): Promise<void> {
  const supabase = await createSupabaseServerClient()

  const { data: existing } = await supabase
    .from('user_progress')
    .select('*')
    .eq('user_id', userId)
    .eq('unit_id', unitId)
    .single()

  if (!existing) return

  const newBest = Math.max(existing.best_score, score)
  const newStatus = newBest >= 80 ? 'mastered' :
                     newBest >= 65 ? 'completed' : 'in_progress'

  await supabase
    .from('user_progress')
    .update({
      best_score: newBest,
      status: newStatus,
      attempts: (existing.attempts || 0) + 1,
      started_at: existing.started_at || new Date().toISOString(),
      completed_at: newStatus === 'completed' || newStatus === 'mastered'
        ? new Date().toISOString() : null,
      mastered_at: newStatus === 'mastered' ? new Date().toISOString() : null
    })
    .eq('user_id', userId)
    .eq('unit_id', unitId)
}
