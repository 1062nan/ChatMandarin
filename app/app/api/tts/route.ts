import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient, createSupabaseAdmin } from '@/lib/supabase/server'
import { synthesizeSpeech, VOICE_TYPES, type VoiceType } from '@/lib/ai/volcengine-tts'
import { getEffectivePlan } from '@/lib/subscription/access'
import { readBoundedBytes } from '@/lib/http/bounded-json'
export const runtime = 'nodejs'
const reply = (body: unknown, status=200, headers: Record<string,string>={}) => NextResponse.json(body,{status,headers:{'Cache-Control':'no-store',...headers}})
export async function POST(request: NextRequest) {
  try {
    const db = await createSupabaseServerClient()
    const { data: { user } } = await db.auth.getUser()
    if (!user) return reply({error:'Unauthorized'},401)
    let input
    try { input=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(await readBoundedBytes(request,8192))) }
    catch(error) {return reply({error:error instanceof RangeError?'Request body too large':'Invalid JSON'},error instanceof RangeError?413:400)}
    if (!input || typeof input.text !== 'string' || !input.text.trim() || input.text.length>500) return reply({error:'Text must contain 1–500 characters.'},400)
    if(input.voice_type!==undefined && (typeof input.voice_type!=='string' || !Object.hasOwn(VOICE_TYPES,input.voice_type))) return reply({error:'Invalid voice type'},400)
    const {data:profile,error:profileError}=await db.from('profiles').select('id').eq('auth_id',user.id).single()
    if(profileError || !profile) return reply({error:'Unable to verify audio access. Please retry.'},503)
    const {data:subscription,error:subscriptionError}=await db.from('subscriptions').select('plan,status,current_period_end,cancel_at_period_end').eq('user_id',profile.id).maybeSingle()
    if(subscriptionError) return reply({error:'Unable to verify audio access. Please retry.'},503)
    if(getEffectivePlan(subscription)==='free') {
      const {data,error}=await createSupabaseAdmin().rpc('reserve_free_tts',{p_profile_id:profile.id,p_characters:input.text.length})
      const budget=data?.[0]
      if(error || !budget) return reply({error:'Audio protection is unavailable. Please retry shortly; text practice remains available.'},503)
      if(!budget.allowed) return reply({error:budget.reason==='daily_limit'?'Free standalone audio has a protective limit of 10,000 requested characters per UTC day. Text practice remains available.':'Too many audio requests. Free standalone audio allows 20 requests per minute. Please wait and retry.',code:budget.reason},429,{'Retry-After':String(budget.retry_after)})
    }
    // Reserve before provider call. Failed/uncertain provider attempts still count;
    // never refund automatically and permit an attacker to repeatedly spend upstream.
    const result=await synthesizeSpeech(input.text,(input.voice_type||'BV700_streaming') as VoiceType)
    return reply({audio:result.audioBase64,duration:result.duration})
  } catch {
    return reply({error:'Text-to-speech failed. Please retry later; requested characters may count toward the protective audio limit.'},502)
  }
}
