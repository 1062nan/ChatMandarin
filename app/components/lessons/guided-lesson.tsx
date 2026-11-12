'use client'
import { ttsErrorMessage } from '@/lib/audio/tts-error'
import Link from 'next/link'
import { AttemptFeedback } from './attempt-feedback'
import { LessonIntro } from './restaurant-intro'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { claimTaskAdvance, gradeLessonTasks, matchesTask, tasksForLesson, type LessonDefinition, type LessonMode, type TaskAnswer } from '@/lib/lessons/core'
interface Progress { next_review_at:string; updated_at:string; review_count:number }
export function GuidedLesson({ lesson }: { lesson: LessonDefinition }) {
  const endpoint = `/api/lessons/${lesson.slug}`
  const MODEL_LINES = lesson.modelLines
  const [screen,setScreen]=useState<'intro'|'model'|'task'|'result'>('intro')
  const [mode,setMode]=useState<LessonMode>('learn')
  const [progress,setProgress]=useState<Progress|null>(null)
  const [due,setDue]=useState(false)
  const [loading,setLoading]=useState(true)
  const [scheduleError,setScheduleError]=useState('')
  const [index,setIndex]=useState(0)
  const [answers,setAnswers]=useState<TaskAnswer[]>([])
  const [value,setValue]=useState('')
  const [hintUsed,setHintUsed]=useState(false)
  const [tries,setTries]=useState(0)
  const [feedback,setFeedback]=useState<'matched'|'unmatched'|null>(null)
  const [saveState,setSaveState]=useState<'idle'|'saving'|'saved'>('idle')
  const [saveError,setSaveError]=useState('')
  const [audioIndex,setAudioIndex]=useState<number|null>(null)
  const [audioError,setAudioError]=useState('')
  const audioRef=useRef<HTMLAudioElement|null>(null)
  const audioBusy=useRef(false)
  const audioCache=useRef(new Map<string,string>())
  const audioRequest=useRef<AbortController|null>(null)
  const saveBusy=useRef(false)
  const submissionId=useRef<string|null>(null)
  const advancedTasks=useRef(new Set<string>())
  const tasks=tasksForLesson(lesson, mode)
  const task=tasks[index]
  const loadSchedule = useCallback(async () => {
    setLoading(true);setScheduleError('')
    try {
      const response=await fetch(endpoint,{cache:'no-store'})
      const data=await response.json()
      if(!response.ok) throw new Error(data.error)
      setProgress(data.progress);setDue(data.due)
    } catch {setScheduleError('Your saved schedule is unavailable. You may practise; saving can be retried later.')}
    finally {setLoading(false)}
  }, [endpoint])
  useEffect(()=>{void loadSchedule();return()=>{audioRequest.current?.abort();audioRef.current?.pause()}},[loadSchedule])
  function stopAudio(){audioRequest.current?.abort();audioRef.current?.pause();audioBusy.current=false;setAudioIndex(null)}
  async function playLine(i:number){
    if(audioBusy.current) return
    stopAudio();audioBusy.current=true;setAudioIndex(i);setAudioError('')
    const controller=new AbortController();audioRequest.current=controller
    try {
      const text=MODEL_LINES[i].zh
      let source=audioCache.current.get(text)
      if(!source){
        const response=await fetch('/api/tts',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text}),signal:controller.signal})
        const data=await response.json()
        if(!response.ok || !data.audio) throw new Error(ttsErrorMessage(data))
        source=`data:audio/mp3;base64,${data.audio}`;audioCache.current.set(text,source)
      }
      if(controller.signal.aborted)return
      const audio=new Audio(source);audioRef.current=audio
      audio.onended=()=>{if(audioRef.current===audio){audioBusy.current=false;setAudioIndex(null)}}
      audio.onerror=()=>{if(audioRef.current!==audio)return;audioBusy.current=false;setAudioIndex(null);setAudioError('Audio could not play. You can retry or continue with the transcript.')}
      await audio.play()
    }catch(error){if(audioRequest.current===controller){if(!controller.signal.aborted)setAudioError(error instanceof Error?error.message:ttsErrorMessage(null));audioBusy.current=false;setAudioIndex(null)}}
  }
  function start(nextMode:LessonMode){
    stopAudio();submissionId.current=crypto.randomUUID();advancedTasks.current.clear();setMode(nextMode);setIndex(0);setAnswers([]);setValue('');setHintUsed(false);setTries(0);setFeedback(null);setSaveState('idle');setSaveError('');setScreen(nextMode==='learn'?'model':'task')
  }
  function check(){if(!value.trim())return;setTries(n=>n+1);setFeedback(matchesTask(task,value)?'matched':'unmatched')}
  function advance(){
    if(!claimTaskAdvance(advancedTasks.current,task.id,!!feedback))return
    const answer={id:task.id,value,hintUsed,firstTry:tries===1 && feedback==='matched'}
    setAnswers(previous=>[...previous,answer])
    if(index+1>=tasks.length){setScreen('result');return}
    setIndex(i=>i+1);setValue('');setHintUsed(false);setTries(0);setFeedback(null)
  }
  async function save(){
    if(saveBusy.current || saveState==='saved')return
    saveBusy.current=true;setSaveState('saving');setSaveError('')
    try{
      const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({mode,answers,submission_id:submissionId.current,expected_updated_at:progress?.updated_at})})
      const data=await response.json()
      if(!response.ok)throw new Error(data.error || 'Could not save.')
      setProgress(data.progress);setDue(data.due===true);setSaveState('saved')
    }catch(error){setSaveError(error instanceof Error?error.message:'Could not save.');setSaveState('idle')}
    finally{saveBusy.current=false}
  }
  const summary=screen==='result'?gradeLessonTasks(lesson,mode,answers):null
  return <div className="mx-auto max-w-3xl space-y-6">
    <Link href="/dashboard" className="text-sm underline">← Learning path</Link>
    <header><p className="text-sm font-medium text-vermilion">Guided beginner lesson · 入门小课</p><h1 className="mt-2 text-3xl font-bold">{lesson.title}</h1><p className="mt-2 text-muted-foreground">{lesson.subtitle}</p></header>
    {screen==='intro' && <LessonIntro lesson={lesson} nextReviewAt={progress?.next_review_at || null} due={due} loading={loading} scheduleError={scheduleError} onLearn={()=>start('learn')} onReview={()=>start('review')} onRefresh={()=>void loadSchedule()} />}
    {screen==='model' && <>
      <Card><CardContent className="space-y-5 p-6"><h2 className="text-xl font-semibold">1 · Notice the example</h2><p>Read, or play each line. Listen before looking if you want a listening challenge; the tasks below check meaning, not verified listening.</p>
        {MODEL_LINES.map((line,i)=><div key={line.zh} className="rounded-lg bg-muted/50 p-4"><p lang="zh" className="text-xl">{line.zh}</p><p className="mt-1 text-sm">{line.pinyin}</p><p className="mt-1 text-sm text-muted-foreground">{line.en}</p><Button className="mt-2" variant="outline" size="sm" disabled={audioIndex!==null} onClick={()=>void playLine(i)}>{audioIndex===i?'Playing / loading…':'Listen to this line'}</Button></div>)}
        {audioIndex!==null && <Button variant="ghost" onClick={stopAudio}>Stop audio</Button>}{audioError && <p role="alert">{audioError}</p>}
        <div className="rounded-lg border p-4"><h3 className="font-semibold">Useful chunks</h3><ul className="mt-2 list-inside list-disc space-y-2">{lesson.chunks.map(chunk=><li key={chunk}>{chunk}</li>)}</ul><p className="mt-3 text-sm">{lesson.chunkNote}</p></div>
        <Button variant="primary" onClick={()=>{stopAudio();setScreen('task')}}>Try it yourself</Button>
      </CardContent></Card>
    </>}
    {screen==='task' && <Card><CardContent className="space-y-5 p-6">
      <p className="text-sm text-muted-foreground">Task {index+1} of {tasks.length} · {task.stage}</p><progress className="w-full" value={index} max={tasks.length} aria-label="Lesson progress" />
      <h2 className="text-xl font-semibold">{task.prompt}</h2>
      {task.options?<fieldset className="space-y-2"><legend className="sr-only">Choose an answer</legend>{task.options.map((option,i)=><label key={option} className="flex cursor-pointer items-center gap-3 rounded-lg border p-3"><input type="radio" name={task.id} value={i} checked={value===String(i)} onChange={()=>{setValue(String(i));setFeedback(null)}}/>{option}</label>)}</fieldset>:<><label className="block text-sm" htmlFor="lesson-answer">Your Chinese answer (not stored)</label><textarea id="lesson-answer" lang="zh" maxLength={300} className="min-h-28 w-full rounded-lg border bg-background p-3 text-lg" value={value} onChange={event=>{setValue(event.target.value);setFeedback(null)}} /><p className="text-xs text-muted-foreground">You may say it aloud first. This text checker does not assess your pronunciation.</p></>}
      {hintUsed?<p className="rounded-lg bg-muted p-3">Hint: {task.hint}</p>:<Button variant="ghost" onClick={()=>setHintUsed(true)}>Show a hint (counts as supported practice)</Button>}
      {feedback && <div role="status" className="space-y-2 rounded-lg border p-4"><p className="font-semibold">{feedback==='matched'?'This matches a useful pattern for this task.':task.options?'Not this choice. Check the explanation and try again.':'This limited checker did not match your wording. Another phrasing may be valid; this is not a judgment of all your Chinese.'}</p><p>{task.explanation}</p>{feedback==='unmatched' && <p>One model: <span lang="zh">{task.example}</span></p>}</div>}
      <div className="flex flex-wrap gap-3"><Button disabled={!value.trim()} onClick={check}>Check my answer</Button>{feedback && <Button variant={feedback==='matched'?'primary':'outline'} onClick={advance}>{feedback==='matched'?'Continue':'Continue as supported practice'}</Button>}</div>
      <p className="text-xs text-muted-foreground">First-try and hint use are self-practice indicators, not exam marks. Your typed answers are checked for this request but not stored in your progress record.</p>
      <Button variant="ghost" size="sm" onClick={()=>{setScreen('intro');stopAudio()}}>Exit without saving this attempt</Button>
    </CardContent></Card>}
    {screen==='result' && summary && <Card><CardContent className="space-y-5 p-6"><h2 className="text-2xl font-bold">Practice completed · 练习完成</h2>
      <p>{summary.matched} of {summary.total} tasks matched the patterns checked here. {summary.unaided} matched on the first try without a hint.</p><p className="text-sm text-muted-foreground">This is a small, supported lesson, not proof that you have mastered Chinese. An unmatched alternative can still be valid. The next step is to recall it later and use it in a new situation.</p>
      <AttemptFeedback lesson={lesson} mode={mode} answers={answers} />
      {saveState==='saved'?<p role="status">Saved. Next recall: {progress && new Date(progress.next_review_at).toLocaleString()}.</p>:<Button variant="primary" disabled={saveState==='saving'} onClick={()=>void save()}>{saveState==='saving'?'Saving…':'Save practice & schedule recall'}</Button>}{saveError && <p role="alert">{saveError} Your answers are still here. Retry saving; this same attempt will not advance your schedule twice.</p>}
      <div className="space-y-2 border-t pt-4"><h3 className="font-semibold">Use it beyond this lesson</h3>{lesson.conversation && <p><Link href={lesson.conversation.href} className="text-vermilion underline">{lesson.conversation.label}</Link> when you are ready. Voice responses may take several seconds and use your plan’s allowance.</p>}<p><Link href="/mistakes" className="text-vermilion underline">Review corrections from your conversations</Link>. These are separate from this lesson’s recall schedule.</p></div>
      <Button variant="outline" disabled={saveState==='saving'} onClick={()=>{setScreen('intro');void loadSchedule()}}>Back to lesson start</Button>
    </CardContent></Card>}
  </div>
}
