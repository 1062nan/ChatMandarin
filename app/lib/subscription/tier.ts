/**
 * 订阅等级 + 配额统一管理
 *
 * 所有需要判断用户 plan / 检查配额的地方都走这里，避免到处内联查询。
 *
 * 用法：
 *   const ctx = await getSubscriptionContext(profileId)
 *   if (!ctx.features.dubbing.allowed) return upgradeRequired()
 *   const check = await consumeQuota(ctx, 'hskk')
 *   if (!check.ok) return quotaExceeded()
 */

import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getEffectivePlan } from '@/lib/subscription/access'

export type Plan = 'free' | 'plus' | 'pro'
export type Feature = 'conversation' | 'hskk' | 'shadowing' | 'dubbing'

export interface PlanFeatures {
  /** 每天对话秒数上限，null = 无限 */
  conversation: { dailyLimitSec: number | null }
  /** 每天次数 + 每月次数，null = 无限 */
  hskk: { dailyLimit: number | null; monthlyLimit: number | null }
  /** 每天跟读次数，null = 无限 */
  shadowing: { dailyLimit: number | null }
  /** 配音是否可用 */
  dubbing: { allowed: boolean }
  /** 错题本容量（未掌握的），null = 无限 */
  mistakeCapacity: number | null
  /** 是否解锁自定义音色（Pro 独享） */
  customVoice: boolean
}

export const PLAN_FEATURES: Record<Plan, PlanFeatures> = {
  free: {
    conversation: { dailyLimitSec: 300 },  // 5 min/day
    hskk: { dailyLimit: 1, monthlyLimit: null },
    shadowing: { dailyLimit: 5 },
    dubbing: { allowed: false },
    mistakeCapacity: 20,
    customVoice: false,
  },
  plus: {
    conversation: { dailyLimitSec: null },
    hskk: { dailyLimit: null, monthlyLimit: 3 },
    shadowing: { dailyLimit: null },
    dubbing: { allowed: true },
    mistakeCapacity: null,
    customVoice: false,
  },
  pro: {
    conversation: { dailyLimitSec: null },
    hskk: { dailyLimit: null, monthlyLimit: null },
    shadowing: { dailyLimit: null },
    dubbing: { allowed: true },
    mistakeCapacity: null,
    customVoice: true,
  },
}

export interface SubscriptionContext {
  plan: Plan
  status: string
  features: PlanFeatures
  currentPeriodEnd: Date | null
  cancelAtPeriodEnd: boolean
}

/**
 * 获取用户的订阅上下文（plan + 功能配置）
 */
export async function getSubscriptionContext(
  profileId: string
): Promise<SubscriptionContext> {
  const supabase = await createSupabaseServerClient()

  const { data: sub } = await supabase
    .from('subscriptions')
    .select('plan, status, current_period_end, cancel_at_period_end')
    .eq('user_id', profileId)
    .maybeSingle()  // 用 maybeSingle 避免多记录时报错

  const plan = getEffectivePlan(sub)
  const features = PLAN_FEATURES[plan]

  return {
    plan,
    status: sub?.status || 'active',
    features,
    currentPeriodEnd: sub?.current_period_end
      ? new Date(sub.current_period_end)
      : null,
    cancelAtPeriodEnd: sub?.cancel_at_period_end || false,
  }
}

export interface QuotaCheck {
  ok: boolean
  reason?: 'daily_exceeded' | 'monthly_exceeded' | 'not_in_plan'
  remaining?: { daily?: number | null; monthly?: number | null }
}

/**
 * 检查配额（不消耗）。用于展示给用户"还能用多少次"。
 */
export async function checkQuota(
  ctx: SubscriptionContext,
  profileId: string,
  feature: Feature
): Promise<QuotaCheck> {
  const supabase = await createSupabaseServerClient()
  const today = new Date().toISOString().split('T')[0]
  const yearMonth = today.substring(0, 7)

  // daily counters
  const { data: todayUsage } = await supabase
    .from('usage_stats')
    .select('conversation_seconds, conversation_count, hskk_count, shadowing_count, dubbing_count')
    .eq('user_id', profileId)
    .eq('date', today)
    .maybeSingle()

  const u: Record<string, number> = (todayUsage as Record<string, number>) || {}

  switch (feature) {
    case 'conversation': {
      const limit = ctx.features.conversation.dailyLimitSec
      if (limit === null) return { ok: true }
      const used = u.conversation_seconds || 0
      return {
        ok: used < limit,
        reason: used >= limit ? 'daily_exceeded' : undefined,
        remaining: { daily: Math.max(0, limit - used) },
      }
    }

    case 'hskk': {
      const { dailyLimit, monthlyLimit } = ctx.features.hskk
      const dailyUsed = u.hskk_count || 0

      // 先检查日限
      if (dailyLimit !== null && dailyUsed >= dailyLimit) {
        return {
          ok: false,
          reason: 'daily_exceeded',
          remaining: { daily: Math.max(0, dailyLimit - dailyUsed) },
        }
      }

      // 再检查月限
      if (monthlyLimit !== null) {
        const { data: monthUsage } = await supabase
          .from('usage_monthly')
          .select('hskk_count')
          .eq('user_id', profileId)
          .eq('year_month', yearMonth)
          .maybeSingle()
        const monthUsed = (monthUsage?.hskk_count as number) || 0
        if (monthUsed >= monthlyLimit) {
          return {
            ok: false,
            reason: 'monthly_exceeded',
            remaining: {
              daily: dailyLimit !== null ? Math.max(0, dailyLimit - dailyUsed) : null,
              monthly: Math.max(0, monthlyLimit - monthUsed),
            },
          }
        }
      }

      return { ok: true }
    }

    case 'shadowing': {
      const limit = ctx.features.shadowing.dailyLimit
      if (limit === null) return { ok: true }
      const used = u.shadowing_count || 0
      return {
        ok: used < limit,
        reason: used >= limit ? 'daily_exceeded' : undefined,
        remaining: { daily: Math.max(0, limit - used) },
      }
    }

    case 'dubbing': {
      if (!ctx.features.dubbing.allowed) {
        return { ok: false, reason: 'not_in_plan' }
      }
      return { ok: true }
    }
  }
}

/**
 * 消耗一次配额（检查 + 递增）。返回是否成功。
 *
 * 注意：conversation 用秒数，不是次数，单独处理（见 conversation/turn 路由）。
 */
export async function consumeQuota(
  _ctx: SubscriptionContext,
  profileId: string,
  feature: 'hskk' | 'shadowing' | 'dubbing'
): Promise<QuotaCheck> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await (supabase as any).rpc('consume_practice_quota', {
    p_profile_id: profileId,
    p_feature: feature,
  })
  if (error) throw error

  const result = Array.isArray(data) ? data[0] : null
  if (!result) throw new Error('Quota service returned no result')
  return {
    ok: Boolean(result.allowed),
    reason: result.reason || undefined,
    remaining: {
      daily: result.daily_remaining,
      monthly: result.monthly_remaining,
    },
  }
}

export async function consumeConversationSeconds(
  profileId: string,
  seconds: number
): Promise<QuotaCheck> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await (supabase as any).rpc('consume_conversation_seconds', {
    p_profile_id: profileId,
    p_seconds: seconds,
  })
  if (error) throw error

  const result = Array.isArray(data) ? data[0] : null
  if (!result) throw new Error('Conversation quota service returned no result')
  return {
    ok: Boolean(result.allowed),
    reason: result.allowed ? undefined : 'daily_exceeded',
    remaining: { daily: result.daily_remaining },
  }
}
