import { beforeEach,describe,it,expect,vi } from 'vitest'
import { readFocusPreference,readSpeakingAvailability } from './focus-server'
const now=new Date('2026-11-12T10:00:00Z')
function database(records:Record<string,unknown>={},failed?:string,flag:unknown=false) {
  const queries:Record<string,any>={}
  const db:any={from:vi.fn((table:string)=>{
    const q:any={};for(const method of ['select','eq'])q[method]=vi.fn(()=>q)
    q.maybeSingle=vi.fn().mockResolvedValue({data:records[table]??null,error:failed===table?'unavailable':null});queries[table]=q;return q
  }),rpc:vi.fn().mockResolvedValue({data:flag,error:failed==='flag'?'unavailable':null})}
  return {db,queries}
}
beforeEach(()=>{vi.useFakeTimers();vi.setSystemTime(now)})
describe('owner-scoped learning preferences and read-only speaking availability',()=>{
  it('preserves guided default for an absent preference without writing',async()=>{
    const {db,queries}=database()
    expect(await readFocusPreference(db,'owner')).toEqual({status:'known',focus:null})
    expect(queries.learning_preferences.eq).toHaveBeenCalledWith('user_id','owner')
    expect(Object.keys(queries.learning_preferences).sort()).toEqual(['eq','maybeSingle','select'])
  })
  it('never silently converts an invalid/failed preference into a saved choice',async()=>{
    expect(await readFocusPreference(database({learning_preferences:{focus:'admin'}}).db,'owner')).toEqual({status:'unavailable',focus:null})
    expect(await readFocusPreference(database({},'learning_preferences').db,'owner')).toEqual({status:'unavailable',focus:null})
  })
  it('Free has one daily speaking attempt with absent usage; reads cannot consume it',async()=>{
    const {db,queries}=database()
    expect(await readSpeakingAvailability(db,'owner',now)).toEqual({status:'available',dailyRemaining:1,monthlyRemaining:null,checkedAt:now.toISOString()})
    expect(queries.usage_stats.eq).toHaveBeenCalledWith('date','2026-11-12')
    expect(queries.usage_stats.eq).toHaveBeenCalledWith('user_id','owner')
    expect(db.rpc).not.toHaveBeenCalled()
  })
  it('exhausted Free falls back until UTC midnight, without upsell or subscription mutation',async()=>{
    expect(await readSpeakingAvailability(database({usage_stats:{hskk_count:1}}).db,'owner',now)).toEqual({status:'exhausted',resetsAt:'2026-11-13T00:00:00.000Z',checkedAt:now.toISOString()})
  })
  it('matches legacy Plus monthly allowance and current flag-gated additive allowance',async()=>{
    const records={subscriptions:{plan:'plus',status:'active'},usage_stats:{hskk_count:1},usage_monthly:{hskk_count:3,plus_hskk_bonus_count:2}}
    expect(await readSpeakingAvailability(database(records).db,'owner',now)).toMatchObject({status:'exhausted',resetsAt:'2026-12-01T00:00:00.000Z'})
    const {db}=database(records,undefined,true)
    expect(await readSpeakingAvailability(db,'owner',now)).toMatchObject({status:'available',dailyRemaining:0,monthlyRemaining:8})
    expect(db.rpc).toHaveBeenCalledExactlyOnceWith('plus_speaking_allowance_enabled')
  })
  it('resets exhausted gated Plus daily allowance next UTC day',async()=>{
    const {db}=database({subscriptions:{plan:'plus',status:'active'},usage_stats:{hskk_count:1},usage_monthly:{hskk_count:11,plus_hskk_bonus_count:10}},undefined,true)
    expect(await readSpeakingAvailability(db,'owner',now)).toMatchObject({status:'exhausted',resetsAt:'2026-11-13T00:00:00.000Z'})
  })
  it('preserves Pro unlimited policy and expired paid fallback',async()=>{
    expect(await readSpeakingAvailability(database({subscriptions:{plan:'pro',status:'active'}}).db,'owner',now)).toMatchObject({status:'available',dailyRemaining:null,monthlyRemaining:null})
    expect(await readSpeakingAvailability(database({subscriptions:{plan:'pro',status:'canceled',current_period_end:'2026-01-01'},usage_stats:{hskk_count:1}}).db,'owner',now)).toMatchObject({status:'exhausted'})
  })
  it.each(['subscriptions','usage_stats','usage_monthly','flag'])('does not claim allowance when %s read fails',async failed=>{
    expect(await readSpeakingAvailability(database({subscriptions:{plan:'plus',status:'active'}},failed).db,'owner',now)).toMatchObject({status:'unavailable'})
  })
  it('rejects malformed counters or flag instead of promising access',async()=>{
    expect(await readSpeakingAvailability(database({usage_stats:{hskk_count:-1}}).db,'owner',now)).toMatchObject({status:'unavailable'})
    expect(await readSpeakingAvailability(database({subscriptions:{plan:'plus',status:'active'}},undefined,null).db,'owner',now)).toMatchObject({status:'unavailable'})
  })
})
