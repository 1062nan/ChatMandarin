import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient, createSupabaseAdmin } from '@/lib/supabase/server'
import { gradeLesson, reviewIntervalDays, RESTAURANT_LESSON_ID, type TaskAnswer } from '@/lib/lessons/restaurant'
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
const headers = { 'Cache-Control': 'no-store' }
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const reply = (body: unknown, status=200) => NextResponse.json(body,{status,headers})
function savedReply(summary:ReturnType<typeof gradeLesson>, progress:{next_review_at:string}, alreadySaved=false) {
  const now=new Date()
  return reply({summary,progress,already_saved:alreadySaved,server_now:now.toISOString(),due:Date.parse(progress.next_review_at)<=now.getTime()})
}
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
    if(body.submission_id !== undefined && (typeof body.submission_id !== 'string' || !uuid.test(body.submission_id))) return reply({error:'Invalid attempt identifier.'},400)
    let summary
    try {summary=gradeLesson(body.mode,body.answers as TaskAnswer[])} catch {return reply({error:'Complete each task before saving.'},400)}
    const db=createSupabaseAdmin()
    const {data:prior,error:readError}=await db.from('lesson_progress').select('*').eq('user_id',profile.id).eq('lesson_id',RESTAURANT_LESSON_ID).maybeSingle()
    if(readError) throw readError
    const replay = (row:typeof prior) => {
      if(!body.submission_id || row?.last_summary?.submission_id !== body.submission_id) return null
      const saved = row.last_summary
      // JSONB reorders object keys: compare only the known, compact grading fields.
      const sameOutcomes = Array.isArray(saved.outcomes) && saved.outcomes.length === summary.outcomes.length && summary.outcomes.every((outcome, index) => {
        const stored = saved.outcomes[index]
        return stored?.id === outcome.id && stored.matched === outcome.matched && stored.unaided === outcome.unaided
      })
      if(saved.mode !== body.mode || saved.matched !== summary.matched || saved.unaided !== summary.unaided || saved.total !== summary.total || !sameOutcomes) return reply({error:'This attempt was already saved with different results. Start a new attempt.'},409)
      return savedReply(summary,row,true)
    }
    const existingReceipt=replay(prior)
    if(existingReceipt) return existingReceipt
    const now=new Date()
    if(body.mode==='review' && (!prior || Date.parse(prior.next_review_at)>now.getTime() || body.expected_updated_at!==prior.updated_at)) return reply({error:'This review is not due or was already saved. Refresh the schedule.'},409)
    // Repeating the lesson may help learning, but must not postpone an existing review.
    if(body.mode==='learn' && prior) return savedReply(summary,prior,true)
    const days=reviewIntervalDays(body.mode,prior?.recall_streak||0,summary.unaided,summary.total)
    const record={user_id:profile.id,lesson_id:RESTAURANT_LESSON_ID,next_review_at:new Date(now.getTime()+days*86400000).toISOString(),review_count:(prior?.review_count||0)+(body.mode==='review'?1:0),recall_streak:body.mode==='review' && summary.unaided===summary.total?(prior?.recall_streak||0)+1:0,last_summary:body.submission_id?{...summary,submission_id:body.submission_id,mode:body.mode}:summary,updated_at:now.toISOString()}
    const query=prior ? db.from('lesson_progress').update(record).eq('user_id',profile.id).eq('lesson_id',RESTAURANT_LESSON_ID).eq('updated_at',prior.updated_at) : db.from('lesson_progress').insert(record)
    const {data,error}=await query.select('completed_at,next_review_at,review_count,last_summary,updated_at').maybeSingle()
    if(error?.code==='23505' || (!error && !data)) {
      // A concurrent retry may lose the write race after the first request saved.
      const {data:current,error:receiptError}=await db.from('lesson_progress').select('*').eq('user_id',profile.id).eq('lesson_id',RESTAURANT_LESSON_ID).maybeSingle()
      if(receiptError) throw receiptError
      return replay(current) || reply({error:'This lesson was already saved. Refresh the schedule.'},409)
    }
    if(error) throw error
    return savedReply(summary,data)
  } catch { return reply({error:'Could not save. Your answers remain on this page; please retry.'},503) }
}
