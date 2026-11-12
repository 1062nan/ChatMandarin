import { beforeEach, describe, expect, it, vi } from 'vitest'
const mocks=vi.hoisted(()=>({client:vi.fn()}))
vi.mock('@/lib/supabase/server',()=>({createSupabaseServerClient:mocks.client}))
import { featuresForPlan, PLAN_FEATURES, checkQuota, isPlusSpeakingAllowanceEnabled, type SubscriptionContext } from './tier'
const context:SubscriptionContext={plan:'plus',status:'active',features:featuresForPlan('plus',true),currentPeriodEnd:null,cancelAtPeriodEnd:false}
function query(data:unknown,error:unknown=null){const q={select:()=>q,eq:()=>q,maybeSingle:async()=>({data,error})};return q}
beforeEach(()=>vi.clearAllMocks())
describe('additive Plus allowance',()=>{
 it('retains current plans when gate is off',()=>{
   expect(featuresForPlan('plus',false).hskk).toEqual({dailyLimit:null,monthlyLimit:3})
   expect(featuresForPlan('free',true)).toBe(PLAN_FEATURES.free)
   expect(featuresForPlan('pro',true)).toBe(PLAN_FEATURES.pro)
 })
 it('inherits daily Free allowance plus a separate flexible bonus',()=>{
   expect(featuresForPlan('plus',true).hskk).toEqual({dailyLimit:1,monthlyLimit:null,monthlyBonusLimit:10})
 })
 it('defaults gate to disabled on missing migration or database error',async()=>{
   mocks.client.mockResolvedValue({rpc:async()=>({error:new Error('missing')})})
   expect(await isPlusSpeakingAllowanceEnabled()).toBe(false)
   mocks.client.mockRejectedValue(new Error('offline'))
   expect(await isPlusSpeakingAllowanceEnabled()).toBe(false)
 })
 it('only enables from exact server true',async()=>{
   mocks.client.mockResolvedValue({rpc:async()=>({data:true,error:null})})
   expect(await isPlusSpeakingAllowanceEnabled()).toBe(true)
 })
 it('daily allowance still works when bonus is exhausted',async()=>{
   mocks.client.mockResolvedValue({from:()=>query({hskk_count:0})})
   expect(await checkQuota(context,'owner','hskk')).toMatchObject({ok:true,remaining:{daily:1}})
 })
 it('uses bonus balance, never historical monthly total, after daily is used',async()=>{
   mocks.client.mockResolvedValue({from:(table:string)=>query(table==='usage_stats'?{hskk_count:1}:{hskk_count:100,plus_hskk_bonus_count:9})})
   expect(await checkQuota(context,'owner','hskk')).toMatchObject({ok:true,remaining:{daily:0,monthly:1}})
 })
 it('exhaustion blocks only once both pools are used',async()=>{
   mocks.client.mockResolvedValue({from:(table:string)=>query(table==='usage_stats'?{hskk_count:1}:{plus_hskk_bonus_count:10})})
   expect(await checkQuota(context,'owner','hskk')).toMatchObject({ok:false,reason:'monthly_exceeded'})
 })
 it('does not silently display fresh daily allowance after read failure',async()=>{
   mocks.client.mockResolvedValue({from:()=>query(null,new Error('daily offline'))})
   await expect(checkQuota(context,'owner','hskk')).rejects.toThrow('daily offline')
 })
 it('does not silently display fresh bonus after read failure',async()=>{
   mocks.client.mockResolvedValue({from:(table:string)=>table==='usage_stats'?query({hskk_count:1}):query(null,new Error('offline'))})
   await expect(checkQuota(context,'owner','hskk')).rejects.toThrow('offline')
 })
})
