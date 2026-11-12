'use client'
import { useEffect,useRef,useState } from 'react'
import { useRouter } from 'next/navigation'
import type { FocusPreference,LearningFocus } from '@/lib/learning/focus'
export function LearningFocusControl({preference}:{preference:FocusPreference}) {
  const router=useRouter()
  const [open,setOpen]=useState(false)
  const [focus,setFocus]=useState<LearningFocus>(preference.focus||'guided')
  const [saving,setSaving]=useState(false)
  const [error,setError]=useState('')
  const [saved,setSaved]=useState(false)
  const busy=useRef(false)
  useEffect(()=>{setFocus(preference.focus||'guided')},[preference.focus])
  async function save() {
    if(busy.current)return
    busy.current=true;setSaving(true);setError('');setSaved(false)
    try {
      const response=await fetch('/api/learning-focus',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({focus})})
      const result=await response.json()
      if(!response.ok)throw new Error(result.error||'Could not save. Retry.')
      setSaved(true);setOpen(false);router.refresh()
    }catch(err){setError(err instanceof Error?err.message:'Could not confirm your choice. Refresh or retry.')}
    finally{busy.current=false;setSaving(false)}
  }
  return <section aria-labelledby="learning-focus-title" className="space-y-3 rounded-lg border p-4 text-sm">
    <h3 id="learning-focus-title" className="font-medium">学习重点 · Learning focus (optional)</h3>
    <p>{preference.status==='unavailable'?'Your saved focus could not be checked. The default guided path remains available.':preference.focus==='speaking'?'Your choice: Speaking practice.':preference.focus==='guided'?'Your choice: Everyday guided lessons.':'Default: Everyday guided lessons. You can keep this without setting a preference.'}</p>
    <p className="text-muted-foreground">Due recall and uncertain schedules come first. Your choice only suggests new practice afterward; it is not a level assessment or a language setting.</p>
    {saved&&<p role="status">Choice saved.</p>}
    {error&&<p role="alert">{error}</p>}
    {!open?<button className="min-h-10 underline" onClick={()=>{setSaved(false);setOpen(true)}}>Choose or change focus</button>:<>
      <fieldset className="space-y-3" disabled={saving}><legend className="mb-2 font-medium">What would you like to practise?</legend>
        <label className="flex gap-2"><input type="radio" name="learning-focus" checked={focus==='guided'} onChange={()=>setFocus('guided')}/><span>Everyday guided lessons<br/><span className="text-muted-foreground">Understand, build and adapt useful phrases. Audio is optional.</span></span></label>
        <label className="flex gap-2"><input type="radio" name="learning-focus" checked={focus==='speaking'} onChange={()=>setFocus('speaking')}/><span>Speaking practice<br/><span className="text-muted-foreground">Recorded speaking exercises with transcript-based feedback, not live conversation or a full HSKK mock exam. Recording or audio upload is needed.</span></span></label>
      </fieldset>
      <div className="flex gap-5"><button disabled={saving} className="min-h-10 font-medium underline" onClick={()=>void save()}>{saving?'Saving…':'Save focus'}</button><button disabled={saving} className="min-h-10 underline" onClick={()=>{setOpen(false);setFocus(preference.focus||'guided');setError('')}}>Not now</button></div>
      <p className="text-xs text-muted-foreground">Saving a focus does not start practice or consume an allowance. You can change it later; no activities are locked.</p>
    </>}
  </section>
}
