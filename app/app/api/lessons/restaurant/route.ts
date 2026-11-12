import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient, createSupabaseAdmin } from '@/lib/supabase/server'
import { gradeLesson, reviewIntervalDays, RESTAURANT_LESSON_ID, type TaskAnswer } from '@/lib/lessons/restaurant'
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
const headers = { 'Cache-Control': 'no-store' }
const reply = (body: unknown, status=200) => NextResponse.json(body,{status,headers})
async function currentProfile() {
  const db = await createSupabaseServerClient()
  const { data:{ user } } = await db.auth.getUser()
  if (!user) return { db, profile:null }
  const { data:profile, error } = await db.from('profiles').select('id').eq('auth_id',user.id).single()
  if (error) throw new Error('Profile unavailable')
  return { db, profile }
}
export async function GET() {
  try {
    const { db, profile } = await currentProfile()
    if (!profile) return reply({error:'Please sign in.'},401)
    const {data,error} = await db.from('lesson_progress').select('completed_at,next_review_at,review_count,last_summary,updated_at').eq('user_id',profile.id).eq('lesson_id',RESTAURANT_LESSON_ID).maybeSingle()
    if(error) throw error
    const now=new Date()
    return reply({progress:data,server_now:now.toISOString(),due:!!data && Date.parse(data.next_review_at)<=now.getTime()})
  } catch { return reply({error:'Unable to load your review schedule. You can still practise without saving.'},503) }
}
export async function POST(request:NextRequest) {
  try {
    const { profile } = await currentProfile()
    if (!profile) return reply({error:'Please sign in.'},401)
    const body = await request.json().catch(()=>null)
    if(!body || !['learn','review'].includes(body.mode) || !Array.isArray(body.answers)) return reply({error:'Invalid lesson submission.'},400)
    let summary
    try {summary=gradeLesson(body.mode,body.answers as TaskAnswer[])} catch {return reply({error:'Complete each task before saving.'},400)}
    const db=createSupabaseAdmin()
    const {data:prior,error:readError}=await db.from('lesson_progress').select('*').eq('user_id',profile.id).eq('lesson_id',RESTAURANT_LESSON_ID).maybeSingle()
    if(readError) throw readError
    const now=new Date()
    if(body.mode==='review' && (!prior || Date.parse(prior.next_review_at)>now.getTime() || body.expected_updated_at!==prior.updated_at)) return reply({error:'This review is not due or was already saved. Refresh the schedule.'},409)
    // Repeating the lesson may help learning, but must not postpone an existing review.
    if(body.mode==='learn' && prior) return reply({summary,progress:prior,already_saved:true})
    const days=reviewIntervalDays(body.mode,prior?.recall_streak||0,summary.unaided,summary.total)
    const record={user_id:profile.id,lesson_id:RESTAURANT_LESSON_ID,next_review_at:new Date(now.getTime()+days*86400000).toISOString(),review_count:(prior?.review_count||0)+(body.mode==='review'?1:0),recall_streak:body.mode==='review' && summary.unaided===summary.total?(prior?.recall_streak||0)+1:0,last_summary:summary,updated_at:now.toISOString()}
    const query=prior ? db.from('lesson_progress').update(record).eq('user_id',profile.id).eq('lesson_id',RESTAURANT_LESSON_ID).eq('updated_at',prior.updated_at) : db.from('lesson_progress').insert(record)
    const {data,error}=await query.select('completed_at,next_review_at,review_count,last_summary,updated_at').maybeSingle()
    if(error?.code==='23505' || (!error && !data)) return reply({error:'This lesson was already saved. Refresh the schedule.'},409)
    if(error) throw error
    return reply({summary,progress:data})
  } catch { return reply({error:'Could not save. Your answers remain on this page; please retry.'},503) }
}
