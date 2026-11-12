import { createSupabaseServerClient } from '@/lib/supabase/server'
import { featuresForPlan } from '@/lib/subscription/tier'
import { getEffectivePlan } from '@/lib/subscription/access'
import { isLearningFocus,type FocusPreference,type SpeakingAvailability } from './focus'
type Database=Awaited<ReturnType<typeof createSupabaseServerClient>>
export async function readFocusPreference(db:Database,profileId:string):Promise<FocusPreference> {
  try {
    const {data,error}=await db.from('learning_preferences').select('focus').eq('user_id',profileId).maybeSingle()
    if(error || (data && !isLearningFocus(data.focus))) return {status:'unavailable',focus:null}
    return {status:'known',focus:data?.focus||null}
  } catch {return {status:'unavailable',focus:null}}
}
const count=(value:unknown)=>value==null?0:typeof value==='number'&&Number.isSafeInteger(value)&&value>=0?value:NaN
/** A non-reserving snapshot only. Submission still performs atomic quota enforcement. */
export async function readSpeakingAvailability(db:Database,profileId:string,now:Date):Promise<SpeakingAvailability> {
  const checkedAt=now.toISOString()
  try {
    const {data:subscription,error:subError}=await db.from('subscriptions').select('plan,status,current_period_end,cancel_at_period_end').eq('user_id',profileId).maybeSingle()
    if(subError) throw subError
    const plan=getEffectivePlan(subscription)
    let bonus=false
    if(plan==='plus') {
      const {data,error}=await db.rpc('plus_speaking_allowance_enabled')
      if(error || typeof data!=='boolean') throw new Error('Plan configuration unavailable')
      bonus=data
    }
    const limits=featuresForPlan(plan,bonus).hskk
    const today=checkedAt.slice(0,10),month=checkedAt.slice(0,7)
    const {data:daily,error:dailyError}=await db.from('usage_stats').select('hskk_count').eq('user_id',profileId).eq('date',today).maybeSingle()
    if(dailyError) throw dailyError
    const dailyUsed=count(daily?.hskk_count)
    if(!Number.isFinite(dailyUsed)) throw new Error('Usage unavailable')
    let monthlyUsed=0,bonusUsed=0
    if(limits.monthlyLimit!==null || limits.monthlyBonusLimit!==undefined) {
      const {data:monthly,error}=await db.from('usage_monthly').select('hskk_count,plus_hskk_bonus_count').eq('user_id',profileId).eq('year_month',month).maybeSingle()
      if(error) throw error
      monthlyUsed=count(monthly?.hskk_count);bonusUsed=count(monthly?.plus_hskk_bonus_count)
      if(!Number.isFinite(monthlyUsed)||!Number.isFinite(bonusUsed)) throw new Error('Usage unavailable')
    }
    const dailyRemaining=limits.dailyLimit===null?null:Math.max(0,limits.dailyLimit-dailyUsed)
    const monthlyRemaining=limits.monthlyBonusLimit!==undefined?Math.max(0,limits.monthlyBonusLimit-bonusUsed):limits.monthlyLimit===null?null:Math.max(0,limits.monthlyLimit-monthlyUsed)
    const exhausted=limits.monthlyBonusLimit!==undefined?dailyRemaining===0&&monthlyRemaining===0:dailyRemaining===0||monthlyRemaining===0
    if(exhausted) {
      const dailyReset=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate()+1))
      const monthlyReset=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth()+1,1))
      return {status:'exhausted',checkedAt,resetsAt:(limits.monthlyBonusLimit!==undefined||dailyRemaining===0?dailyReset:monthlyReset).toISOString()}
    }
    return {status:'available',dailyRemaining,monthlyRemaining,checkedAt}
  } catch {return {status:'unavailable',checkedAt}}
}
