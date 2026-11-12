import { NextRequest,NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { isLearningFocus } from '@/lib/learning/focus'
export const runtime='nodejs'
export const dynamic='force-dynamic'
const reply=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'private, no-store'}})
export async function POST(request:NextRequest) {
  try {
    const db=await createSupabaseServerClient()
    const {data:{user},error:authError}=await db.auth.getUser()
    if(authError||!user)return reply({error:'Please sign in.'},401)
    const body=await request.json().catch(()=>null)
    if(!body||!isLearningFocus(body.focus))return reply({error:'Choose guided lessons or speaking practice.'},400)
    const {data:profile,error:profileError}=await db.from('profiles').select('id').eq('auth_id',user.id).single()
    if(profileError||!profile)return reply({error:'Your learning profile is unavailable. Please retry.'},503)
    const {data,error}=await db.from('learning_preferences').upsert({user_id:profile.id,focus:body.focus,updated_at:new Date().toISOString()},{onConflict:'user_id'}).select('focus,updated_at').single()
    if(error||!data)return reply({error:'Could not confirm your saved choice. Refresh or retry.'},503)
    return reply({focus:data.focus,updated_at:data.updated_at})
  } catch {return reply({error:'Could not confirm your saved choice. Refresh or retry.'},503)}
}
