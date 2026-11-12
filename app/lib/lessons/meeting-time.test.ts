import { describe, it, expect } from 'vitest'
import { MEETING_TIME_LESSON, LEARN_TASKS, REVIEW_TASKS, gradeLesson } from './meeting-time'
import { matchesTask } from './core'
import { LEARN_TASKS as restaurantTasks } from './restaurant'
const task = (id: string) => [...LEARN_TASKS, ...REVIEW_TASKS].find(t => t.id === id)!
describe('meeting time lesson', () => {
  it('has 8 learning and 4 recall tasks whose models match their goals', () => {
    expect(LEARN_TASKS).toHaveLength(8); expect(REVIEW_TASKS).toHaveLength(4)
    for (const t of [...LEARN_TASKS, ...REVIEW_TASKS]) expect(matchesTask(t, t.options ? String(t.correctOption) : t.example)).toBe(true)
  })
  it.each(['我们明天下午四点见。','明天下午4点见面吧！','明天下午四点我们见面','我们 明天 下午４点 见吧','明天下午四点钟见面吧'])('accepts bounded natural variants: %s', value => expect(matchesTask(task('transfer-hour'), value)).toBe(true))
  it.each(['我们今天下午四点见','我们明天下午三点见','我们明天上午四点见','我们明天下午四点不见','我们不明天下午四点见','我们明天下午四点见不见','我们明天下午四点见不了','我想要两碗面条','明天下午四点','我们明天下午十四点见','明天下午四点见今天下午三点见'])('rejects a missing or changed goal: %s', value => expect(matchesTask(task('transfer-hour'), value)).toBe(false))
  it.each(['我们几点见？','请问我们几点见面呢？','几点见面？'])('accepts question variants: %s', value => expect(matchesTask(task('ask'), value)).toBe(true))
  it.each(['我们不见面','我们几点不见','我们见面','我们三点见'])('does not treat another message as asking the time: %s', value => expect(matchesTask(task('ask'), value)).toBe(false))
  it('does not count hints or retries as unaided; persists only compact outcomes', () => {
    const answers=REVIEW_TASKS.map(t=>({id:t.id,value:t.example,hintUsed:false,firstTry:true}))
    answers[0].hintUsed=true; answers[1].firstTry=false
    const summary=gradeLesson('review',answers)
    expect(summary).toMatchObject({matched:4,unaided:2,total:4})
    expect(JSON.stringify(summary)).not.toContain('value')
  })
  it('rejects restaurant task submissions and never mixes task lists', () => {
    expect(()=>gradeLesson('learn',restaurantTasks.map(t=>({id:t.id,value:t.example,hintUsed:false,firstTry:true})))).toThrow()
  })
  it('teaches changed days and numbers before transfer, with no 3am production', () => {
    const taught=MEETING_TIME_LESSON.chunks.join(' ')
    for (const text of ['今天','明天','三','四','下午']) expect(taught).toContain(text)
    for (const t of [...LEARN_TASKS,...REVIEW_TASKS].filter(t=>!t.options)) expect(t.example).not.toContain('上午')
  })
})
