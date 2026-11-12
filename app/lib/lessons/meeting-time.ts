import { gradeLessonTasks, tasksForLesson, type LessonDefinition, type LessonMode, type LessonTask, type TaskAnswer } from './core'
export const MEETING_TIME_LESSON_ID = 'meeting-time-v1'
// Anchored to the complete goal: no negation, different day or time can slip through.
const askTime = /^(请问)?(我们)?几点(钟)?(见|见面)(呢)?$/u
const proposal = (day: string, hour: string) => new RegExp(`^(我们)?${day}下午(${hour})点(钟)?(见|见面)(吧)?$|^${day}下午(${hour})点(钟)?我们(见|见面)(吧)?$`, 'u')
const tomorrowThree = proposal('明天', '三|3')
const tomorrowFour = proposal('明天', '四|4')
const todayThree = proposal('今天', '三|3')
const todayFour = proposal('今天', '四|4')
export const LEARN_TASKS: LessonTask[] = [
  { id:'meaning', stage:'Understand · 理解', prompt:'In the example, when do they propose meeting?', options:['Tomorrow at 3 pm','Today at 3 pm','Tomorrow at 4 pm'], correctOption:0, hint:'明天 = tomorrow; 下午三点 = 3 pm.', example:'我们明天下午三点见。', explanation:'明天 tells you the day; 下午三点 tells you the time: tomorrow at 3 pm.' },
  { id:'day', stage:'Understand · 理解', prompt:'Which complete message proposes meeting TODAY at 3 pm?', options:['我们明天下午三点见。','我们今天下午三点见。','我们今天下午四点见。'], correctOption:1, hint:'今天 means today; 三点 means three o’clock.', example:'我们今天下午三点见。', explanation:'Change 明天 (tomorrow) to 今天 (today), keeping 下午三点 (3 pm).' },
  { id:'clock', stage:'Build · 组句', prompt:'Choose the missing word: 我们明天下午三___见。', options:['天','杯','点'], correctOption:2, hint:'Number + 点 tells the hour.', example:'我们明天下午三点见。', explanation:'三点 means three o’clock. 下午 tells you it is in the afternoon: 3 pm.' },
  { id:'afternoon', stage:'Understand · 理解', prompt:'Which word in 我们明天下午三点见 marks AFTERNOON?', options:['明天','下午','见'], correctOption:1, hint:'下午 means afternoon.', example:'下午', explanation:'下午 tells you the time is in the afternoon. 明天 tells you the day; 见 means meet.' },
  { id:'ask', stage:'Say with support · 带提示表达', prompt:'Ask “What time shall we meet?” in Chinese.', hint:'我们 + 几点 + 见？', example:'我们几点见？', accepts:[askTime], explanation:'几点 asks the time; 见 or 见面 means meet. 我们 means we.' },
  { id:'suggest', stage:'Say with support · 带提示表达', prompt:'Suggest meeting tomorrow at 3 pm.', hint:'我们 + 明天 + 下午三点 + 见。', example:'我们明天下午三点见。', accepts:[tomorrowThree], explanation:'Use day + time before 见. You can omit 我们 when it is clear who will meet.' },
  { id:'transfer-hour', stage:'Try a new situation · 换个情景', prompt:'The time changes. Suggest meeting TOMORROW at 4 PM. Try without a hint.', hint:'Keep 明天下午; change 三点 to 四点.', example:'我们明天下午四点见。', accepts:[tomorrowFour], explanation:'四点 means four o’clock. Keep 明天 and 下午 to preserve the day and afternoon.' },
  { id:'transfer-day', stage:'Try a new situation · 换个情景', prompt:'Now suggest meeting TODAY at 4 PM. Try without a hint.', hint:'Change 明天 to 今天; keep 下午四点.', example:'我们今天下午四点见。', accepts:[todayFour], explanation:'今天下午四点 means today at 4 pm. Reuse the same sentence pattern with a different day.' },
]
export const REVIEW_TASKS: LessonTask[] = [
  { id:'recall-ask', stage:'Recall · 先回忆', prompt:'Ask what time you and your friend shall meet. Try from memory.', hint:'我们几点见？', example:'我们几点见？', accepts:[askTime], explanation:'Use 几点 to ask the time and 见 or 见面 for meeting.' },
  { id:'recall-tomorrow', stage:'Recall · 先回忆', prompt:'Suggest meeting tomorrow at 4 pm.', hint:'我们明天下午四点见。', example:'我们明天下午四点见。', accepts:[tomorrowFour], explanation:'明天 + 下午四点 + 见: tomorrow + 4 pm + meet.' },
  { id:'recall-today-three', stage:'Transfer · 换个时间', prompt:'Suggest meeting today at 3 pm.', hint:'我们今天下午三点见。', example:'我们今天下午三点见。', accepts:[todayThree], explanation:'Combine the day 今天 with the time 下午三点. Both were introduced in the lesson.' },
  { id:'recall-today-four', stage:'Recall · 先回忆', prompt:'Suggest meeting today at 4 pm.', hint:'我们今天下午四点见。', example:'我们今天下午四点见。', accepts:[todayFour], explanation:'今天下午四点 means today at 4 pm. A hint is useful support, but not unaided recall.' },
]
export const MEETING_TIME_LESSON: LessonDefinition = {
  id: MEETING_TIME_LESSON_ID, slug:'meeting-time', title:'Suggest a meeting time · 提议见面时间',
  subtitle:'Ask when to meet, suggest a meeting, then change the day or hour. No live conversation required.',
  goal:'Ask what time to meet and suggest today or tomorrow at 3 or 4 pm, without copying a sentence.',
  productionStep:'Ask a question and suggest a time with support, then change the day or hour',
  modelLines:[
    { zh:'我们几点见？', pinyin:'Wǒmen jǐ diǎn jiàn?', en:'What time shall we meet?' },
    { zh:'我们明天下午三点见。', pinyin:'Wǒmen míngtiān xiàwǔ sān diǎn jiàn.', en:'Let’s meet tomorrow at 3 pm.' },
    { zh:'好，明天下午三点见。', pinyin:'Hǎo, míngtiān xiàwǔ sān diǎn jiàn.', en:'Okay, see you tomorrow at 3 pm.' },
  ],
  chunks:[
    '我们 (wǒmen) = we; 见 / 见面 (jiàn / jiànmiàn) = meet; 几点 (jǐ diǎn) = what time',
    '今天 (jīntiān) = today; 明天 (míngtiān) = tomorrow',
    '三 (sān) = three; 四 (sì) = four; 三点 / 四点 (sān diǎn / sì diǎn) = three / four o’clock',
    '下午 (xiàwǔ) = afternoon; 下午三点 / 下午四点 = 3 pm / 4 pm',
    '我们今天下午四点见。 (Wǒmen jīntiān xiàwǔ sì diǎn jiàn.) = Let’s meet today at 4 pm.',
  ],
  chunkNote:'Put the day and time before 见: 我们 + day + time + 见. You can leave out 我们 when the context is clear, use 见面 instead of 见, or add 吧 (ba) to soften a suggestion. This lesson practises proposing a time, not negotiating an entire appointment.',
  learnTasks: LEARN_TASKS, reviewTasks: REVIEW_TASKS,
}
export function tasksFor(mode: LessonMode) { return tasksForLesson(MEETING_TIME_LESSON, mode) }
export function gradeLesson(mode: LessonMode, answers: TaskAnswer[]) { return gradeLessonTasks(MEETING_TIME_LESSON, mode, answers) }
