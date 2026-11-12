import { describe,it,expect } from 'vitest'
import { claimTaskAdvance,LEARN_TASKS,REVIEW_TASKS,matchesTask,gradeLesson,reviewIntervalDays,normalizeAnswer } from './restaurant'
const task=(id:string)=>LEARN_TASKS.find(t=>t.id===id)!
const answers=()=>LEARN_TASKS.map(t=>({id:t.id,value:t.options?String(t.correctOption):t.example,hintUsed:false,firstTry:true}))
describe('restaurant lesson',()=>{
 it('has clear stages and unique tasks',()=>{expect(LEARN_TASKS).toHaveLength(8);expect(new Set(LEARN_TASKS.map(t=>t.id)).size).toBe(8);expect(REVIEW_TASKS).toHaveLength(4)})
 it('accepts taught model answers',()=>{expect(gradeLesson('learn',answers())).toMatchObject({matched:8,unaided:8,total:8})})
 it('accepts supported natural variants and punctuation',()=>{expect(matchesTask(task('order'),'请给我一碗面条，谢谢！')).toBe(true);expect(matchesTask(task('transfer-two'),'我们要两碗面条。')).toBe(true);expect(matchesTask(task('water'),'我想要１杯水')).toBe(true)})
 it('does not accept wrong item or quantity',()=>{expect(matchesTask(task('water'),'我想要一杯茶')).toBe(false);expect(matchesTask(task('transfer-two'),'我想要一碗面条')).toBe(false)})
 it('does not accept negatives by substring',()=>{expect(matchesTask(task('order'),'我不要一碗面条')).toBe(false);expect(matchesTask(task('order'),'我想要一碗面条还是米饭')).toBe(false)})
 it('separates supported practice from first unaided pattern match',()=>{const a=answers();a[0].hintUsed=true;a[1].firstTry=false;a[2].value='0';expect(gradeLesson('learn',a)).toMatchObject({matched:7,unaided:5})})
 it('rejects incomplete duplicate and oversized inputs',()=>{expect(()=>gradeLesson('learn',answers().slice(1))).toThrow();const a=answers();a[1]=a[0];expect(()=>gradeLesson('learn',a)).toThrow();const b=answers();b[0].value='x'.repeat(301);expect(()=>gradeLesson('learn',b)).toThrow()})
 it('keeps only outcomes in saved summary, not user text',()=>{expect(JSON.stringify(gradeLesson('learn',answers()))).not.toContain('value');expect(JSON.stringify(gradeLesson('learn',answers()))).not.toContain('面条')})
 it('schedules initial and supported attempts soon, independent reviews gradually',()=>{expect(reviewIntervalDays('learn',0,8,8)).toBe(1);expect(reviewIntervalDays('review',0,4,4)).toBe(3);expect(reviewIntervalDays('review',1,4,4)).toBe(7);expect(reviewIntervalDays('review',10,4,4)).toBe(30);expect(reviewIntervalDays('review',10,3,4)).toBe(1)})
 it('normalizes typography without losing negation',()=>{expect(normalizeAnswer(' 我不要一杯水！ ')).toBe('我不要一杯水')})
})

it('claims a task once before React batches rapid Continue events',()=>{const claimed=new Set<string>();expect(claimTaskAdvance(claimed,'a',false)).toBe(false);expect(claimTaskAdvance(claimed,'a',true)).toBe(true);expect(claimTaskAdvance(claimed,'a',true)).toBe(false);expect(claimTaskAdvance(claimed,'b',true)).toBe(true);claimed.clear();expect(claimTaskAdvance(claimed,'a',true)).toBe(true)})
it('accepts common safe request alternatives',()=>{expect(matchesTask(task('water'),'我要喝一杯水')).toBe(true);expect(matchesTask(task('order'),'请给我来一碗面条')).toBe(true)})
