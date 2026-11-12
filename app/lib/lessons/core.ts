export type LessonMode = 'learn' | 'review'
export interface LessonTask {
  id: string
  stage: string
  prompt: string
  hint: string
  example: string
  explanation: string
  options?: string[]
  correctOption?: number
  accepts?: RegExp[]
}
export interface LessonDefinition {
  id: string
  slug: string
  title: string
  subtitle: string
  goal: string
  productionStep: string
  modelLines: { zh: string; pinyin: string; en: string }[]
  chunks: string[]
  chunkNote: string
  learnTasks: LessonTask[]
  reviewTasks: LessonTask[]
  conversation?: { href: string; label: string }
}
export interface TaskAnswer { id: string; value: string; hintUsed: boolean; firstTry: boolean }
export function normalizeAnswer(value: string) { return value.normalize('NFKC').replace(/[\s\p{P}]/gu,'').trim() }
export function matchesTask(task: LessonTask, value: string) {
  if (task.options) return value === String(task.correctOption)
  return (task.accepts || []).some(pattern => pattern.test(normalizeAnswer(value)))
}
export function tasksForLesson(lesson: LessonDefinition, mode: LessonMode) { return mode === 'learn' ? lesson.learnTasks : lesson.reviewTasks }
export function gradeLessonTasks(lesson: LessonDefinition, mode: LessonMode, answers: TaskAnswer[]) {
  const tasks = tasksForLesson(lesson, mode)
  if (answers.length !== tasks.length || new Set(answers.map(a=>a.id)).size !== tasks.length) throw new Error('Complete every task once.')
  const outcomes = tasks.map(task => {
    const answer = answers.find(a=>a.id === task.id)
    if (!answer || typeof answer.value !== 'string' || answer.value.length > 300 || typeof answer.hintUsed !== 'boolean' || typeof answer.firstTry !== 'boolean') throw new Error('Invalid lesson answers.')
    const matched = matchesTask(task, answer.value)
    return { id: task.id, matched, unaided: matched && !answer.hintUsed && answer.firstTry }
  })
  return { matched: outcomes.filter(o=>o.matched).length, unaided: outcomes.filter(o=>o.unaided).length, total: tasks.length, outcomes }
}
export function reviewIntervalDays(mode: LessonMode, successfulReviewStreak: number, unaided: number, total: number) {
  if (mode === 'learn' || unaided < total) return 1
  return [3,7,14,30][Math.min(Math.max(0, successfulReviewStreak),3)]
}

/** Claim before state updates: repeated events for one rendered task cannot advance twice. */
export function claimTaskAdvance(completed: Set<string>, taskId: string, hasFeedback: boolean) {
  if (!hasFeedback || completed.has(taskId)) return false
  completed.add(taskId)
  return true
}
