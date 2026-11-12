export const RESTAURANT_LESSON_ID = 'restaurant-order-v1'
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
export const MODEL_LINES = [
  { zh: '你好，请问你想吃什么？', pinyin: 'Nǐ hǎo, qǐngwèn nǐ xiǎng chī shénme?', en: 'Hello. What would you like to eat?' },
  { zh: '我想要一碗面条。', pinyin: 'Wǒ xiǎng yào yì wǎn miàntiáo.', en: 'I would like a bowl of noodles.' },
  { zh: '好的。你想喝什么？', pinyin: 'Hǎo de. Nǐ xiǎng hē shénme?', en: 'Sure. What would you like to drink?' },
  { zh: '请给我一杯水，谢谢。', pinyin: 'Qǐng gěi wǒ yì bēi shuǐ, xièxie.', en: 'Please give me a glass of water. Thank you.' },
]
const bowl = /^(我)?(想要|要)(一|1)碗面条(谢谢)?$|^请(给我来|给我|来)(一|1)碗面条(谢谢)?$/u
const water = /^(我)?(想要|要|想喝|要喝)(一|1)杯水(谢谢)?$|^请(给我来|给我|来)(一|1)杯水(谢谢)?$/u
const twoBowls = /^(我|我们)?(想要|要)(两|2)碗面条(谢谢)?$|^请(给我|给我们|来)(两|2)碗面条(谢谢)?$/u
const tea = /^(我)?(想要|要|想喝|要喝)(一|1)杯茶(谢谢)?$|^请(给我来|给我|来)(一|1)杯茶(谢谢)?$/u
const twoWater = /^(我|我们)?(想要|要)(两|2)杯水(谢谢)?$|^请(给我|给我们|来)(两|2)杯水(谢谢)?$/u
export const LEARN_TASKS: LessonTask[] = [
  { id:'meaning', stage:'Understand · 理解', prompt:'In the example, what does the customer want to eat?', options:['A bowl of noodles','A cup of tea','Two bowls of rice'], correctOption:0, hint:'Look at 一碗面条 in the dialogue.', example:'一碗面条 = a bowl of noodles', explanation:'碗 is the measure word for a bowl. 面条 means noodles.' },
  { id:'drink', stage:'Understand · 理解', prompt:'Which phrase means “a glass of water”?', options:['一碗面条','一杯水','两杯茶'], correctOption:1, hint:'Water is 水; 杯 counts cups or glasses.', example:'一杯水', explanation:'Use 杯 for a cup or glass, and 碗 for a bowl.' },
  { id:'bowl', stage:'Build · 组句', prompt:'Choose the missing measure word: 我想要一___面条。', options:['杯','碗','人'], correctOption:1, hint:'The noodles are served in a bowl.', example:'我想要一碗面条。', explanation:'Number + measure word + noun: 一 + 碗 + 面条.' },
  { id:'two', stage:'Build · 组句', prompt:'Choose the natural quantity for “two bowls”: ___碗面条。', options:['二','两','第二'], correctOption:1, hint:'Before a measure word such as 碗, use 两 for two.', example:'两碗面条', explanation:'两碗 means two bowls. 二 is used in counting; 第二 means second.' },
  { id:'order', stage:'Say with support · 带提示表达', prompt:'Order one bowl of noodles. Type a complete request in Chinese.', hint:'我想要 + 一碗 + 面条。', example:'我想要一碗面条。', accepts:[bowl], explanation:'我想要… expresses what you would like. 请给我… is another useful request.' },
  { id:'water', stage:'Say with support · 带提示表达', prompt:'Ask for one glass of water.', hint:'请给我 + 一杯 + 水。', example:'请给我一杯水，谢谢。', accepts:[water], explanation:'请 makes the request polite; 谢谢 is optional in this practice.' },
  { id:'transfer-two', stage:'Try a new situation · 换个情景', prompt:'You and a friend each want noodles. Order TWO bowls. Try without a hint.', hint:'Change 一碗 to 两碗.', example:'我们想要两碗面条。', accepts:[twoBowls], explanation:'Keep the request pattern, but change the quantity to 两碗.' },
  { id:'transfer-tea', stage:'Try a new situation · 换个情景', prompt:'Now you want a cup of TEA, not water. 茶 (chá) means tea. Make the request without a model.', hint:'Use 一杯茶 with 我想要 or 请给我.', example:'我想要一杯茶。', accepts:[tea], explanation:'The same pattern works with a different drink: 一杯茶.' },
]
export const REVIEW_TASKS: LessonTask[] = [
  { id:'recall-water', stage:'Recall · 先回忆', prompt:'Ask for one glass of water. Try from memory.', hint:'请给我一杯水。', example:'请给我一杯水。', accepts:[water], explanation:'Number + 杯 + drink. A supported answer is useful practice, but not unaided recall.' },
  { id:'recall-two', stage:'Recall · 先回忆', prompt:'Order two bowls of noodles for you and a friend.', hint:'我们想要两碗面条。', example:'我们想要两碗面条。', accepts:[twoBowls], explanation:'Use 两 before the measure word 碗.' },
  { id:'recall-tea', stage:'Transfer · 换词运用', prompt:'Ask for one cup of tea. 茶 means tea.', hint:'我想要一杯茶。', example:'我想要一杯茶。', accepts:[tea], explanation:'茶 replaces 水; 杯 stays the same.' },
  { id:'recall-new', stage:'Transfer · 换个数量', prompt:'A friend joins you. Ask for TWO glasses of water.', hint:'请给我们两杯水。', example:'请给我们两杯水。', accepts:[twoWater], explanation:'Apply the quantity 两 to a different measure word: 两杯水.' },
]
export interface TaskAnswer { id: string; value: string; hintUsed: boolean; firstTry: boolean }
export function normalizeAnswer(value: string) { return value.normalize('NFKC').replace(/[\s\p{P}]/gu,'').trim() }
export function matchesTask(task: LessonTask, value: string) {
  if (task.options) return value === String(task.correctOption)
  return (task.accepts || []).some(pattern => pattern.test(normalizeAnswer(value)))
}
export function tasksFor(mode: LessonMode) { return mode === 'learn' ? LEARN_TASKS : REVIEW_TASKS }
export function gradeLesson(mode: LessonMode, answers: TaskAnswer[]) {
  const tasks = tasksFor(mode)
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
