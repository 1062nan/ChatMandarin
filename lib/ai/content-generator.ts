/**
 * AI 内容生成器
 * 用 DeepSeek 动态生成场景/跟读句/配音片段/HSKK 题目
 * 生成结果缓存到数据库
 */

import { getConversationResponse, safeParseJSON } from '@/lib/ai/deepseek'

// ==================== 场景生成 ====================

export interface GeneratedScenario {
  id: string
  name: { en: string; zh: string }
  description: { en: string; zh: string }
  recommended_hsk: number[]
  duration_minutes: number
  ai_persona: string
  scenario_prompt: string
  goals: string[]
  completion_criteria: { min_turns?: number; min_vocab_used?: number }
}

const SCENARIO_THEMES = [
  { id: 'shopping', en: 'Shopping', zh: '购物' },
  { id: 'airport', en: 'Airport', zh: '机场' },
  { id: 'hotel', en: 'Hotel Check-in', zh: '酒店入住' },
  { id: 'bank', en: 'Bank', zh: '银行' },
  { id: 'library', en: 'Library', zh: '图书馆' },
  { id: 'gym', en: 'Gym', zh: '健身房' },
  { id: 'haircut', en: 'Hair Salon', zh: '理发店' },
  { id: 'post-office', en: 'Post Office', zh: '邮局' },
  { id: 'school', en: 'School', zh: '学校' },
  { id: 'weather', en: 'Weather Chat', zh: '聊天气' },
  { id: 'directions', en: 'Asking Directions', zh: '问路' },
  { id: 'phone-call', en: 'Phone Call', zh: '打电话' },
  { id: 'party', en: 'Party', zh: '聚会' },
  { id: 'rental', en: 'Renting Apartment', zh: '租房' },
  { id: 'market', en: 'Market Bargaining', zh: '菜市场讨价' },
  { id: 'train', en: 'Train Station', zh: '火车站' },
  { id: 'pharmacy', en: 'Pharmacy', zh: '药店' },
  { id: 'coffee', en: 'Coffee Shop', zh: '咖啡店' },
  { id: 'pet', en: 'Pet Store', zh: '宠物店' },
  { id: 'return', en: 'Returning Items', zh: '退货' },
  { id: 'visa', en: 'Visa Office', zh: '签证处' },
  { id: 'network', en: 'Networking Event', zh: '社交活动' },
  { id: 'apology', en: 'Apologizing', zh: '道歉' },
  { id: 'compliment', en: 'Complimenting', zh: '夸奖' },
  { id: 'invitation', en: 'Inviting Friends', zh: '邀请朋友' },
]

export async function generateScenario(hskLevel: number, themeId?: string): Promise<GeneratedScenario> {
  const theme = themeId
    ? SCENARIO_THEMES.find(t => t.id === themeId) || SCENARIO_THEMES[Math.floor(Math.random() * SCENARIO_THEMES.length)]
    : SCENARIO_THEMES[Math.floor(Math.random() * SCENARIO_THEMES.length)]

  const prompt = `Generate a Chinese conversation practice scenario. Return JSON only.

Theme: ${theme.en} (${theme.zh})
HSK Level: ${hskLevel}

Return this JSON structure:
{
  "name": {"en": "${theme.en}", "zh": "${theme.zh}"},
  "description": {"en": "One sentence description in English", "zh": "一句中文描述"},
  "ai_persona": "You are a [role] at a [place]. Describe personality in Chinese.",
  "scenario_prompt": "Detailed instructions for the AI on how to conduct this conversation. Include what to discuss, flow of conversation, and cultural tips. Write in English.",
  "goals": ["goal 1", "goal 2", "goal 3"],
  "completion_criteria": {"min_turns": 6}
}

The ai_persona must be written in Chinese.
Keep vocabulary appropriate for HSK ${hskLevel}.`

  const result = await getConversationResponse(prompt, [
    { role: 'user', content: `Generate scenario: ${theme.en} for HSK ${hskLevel}` }
  ])

  return {
    id: `${theme.id}-${hskLevel}-${Date.now()}`,
    name: (result as any).name || { en: theme.en, zh: theme.zh },
    description: (result as any).description || { en: theme.en, zh: theme.zh },
    recommended_hsk: [Math.max(1, hskLevel - 1), hskLevel, hskLevel + 1],
    duration_minutes: 5,
    ai_persona: (result as any).ai_persona || `你是一个${theme.zh}的工作人员，态度友好。`,
    scenario_prompt: (result as any).scenario_prompt || `Guide the customer through the ${theme.en} scenario naturally.`,
    goals: (result as any).goals || ['Complete the conversation successfully'],
    completion_criteria: (result as any).completion_criteria || { min_turns: 6 }
  }
}

// ==================== 跟读句生成 ====================

export async function generateShadowingSentences(hskLevel: number, category: string, count: number = 5): Promise<any[]> {
  const prompt = `Generate ${count} Chinese sentences for shadowing practice.

HSK Level: ${hskLevel}
Category: ${category}

Return JSON array:
[
  {
    "text_zh": "中文句子",
    "text_pinyin": "pīnyīn with tones",
    "text_en": "English translation",
    "hsk_level": ${hskLevel},
    "category": "${category}",
    "difficulty": "easy|medium|hard"
  }
]

Rules:
- Use only HSK ${hskLevel} and below vocabulary
- Include a mix of statement, question, and exclamation sentences
- Make them natural and useful for daily life
- Pinyin must include tone marks`

  const result = await getConversationResponse(prompt, [
    { role: 'user', content: `Generate ${count} sentences` }
  ])

  const parsed = safeParseJSON(result.reply)
  if (Array.isArray(parsed)) return parsed

  // 如果 AI 没返回数组，用 fallback
  return Array(count).fill(0).map((_, i) => ({
    text_zh: `今天天气很好，我们出去玩吧。`,
    text_pinyin: `jīn tiān tiān qì hěn hǎo, wǒ men chū qù wán ba.`,
    text_en: `The weather is nice today, let's go out.`,
    hsk_level: hskLevel,
    category,
    difficulty: 'easy'
  }))
}

// ==================== 配音片段生成 ====================

export async function generateDubbingClip(hskLevel: number, difficulty: string): Promise<any> {
  const themes = [
    'A misunderstanding at a restaurant',
    'Friends planning a trip together',
    'A tense negotiation at a market',
    'Reunion after a long time apart',
    'First day at a new school',
    'Helping a lost tourist',
    'A surprise birthday party',
    'Solving a problem at work',
    'Meeting the landlord about repairs',
    'Discussing future plans',
  ]

  const theme = themes[Math.floor(Math.random() * themes.length)]

  const prompt = `Create an original short dialogue scene for Chinese dubbing practice.

Theme: ${theme}
HSK Level: ${hskLevel}
Difficulty: ${difficulty}

Return JSON only:
{
  "title": "Short title in Chinese",
  "description": "One sentence description in English",
  "duration_seconds": 30-60,
  "hsk_level": ${hskLevel},
  "difficulty": "${difficulty}",
  "lines": [
    {
      "index": 1,
      "speaker": "角色名",
      "text": "中文台词（15-30字）",
      "pinyin": "pīnyīn",
      "translation": "English translation",
      "emotion": "happy|sad|angry|neutral|excited|serious|fearful"
    }
  ]
}

Generate 4-6 lines of dialogue. Make it natural and engaging.
Use HSK ${hskLevel} and below vocabulary.`

  const result = await getConversationResponse(prompt, [
    { role: 'user', content: `Generate dubbing clip: ${theme}` }
  ])

  const parsed = safeParseJSON(result.reply)
  if (parsed && Array.isArray(parsed.lines)) return parsed

  return {
    title: '日常对话',
    description: theme,
    duration_seconds: 40,
    hsk_level: hskLevel,
    difficulty,
    lines: [
      { index: 1, speaker: 'A', text: '你好，最近怎么样？', pinyin: 'nǐ hǎo, zuì jìn zěn me yàng?', translation: 'Hi, how are you lately?', emotion: 'neutral' },
      { index: 2, speaker: 'B', text: '我很好，谢谢！你呢？', pinyin: 'wǒ hěn hǎo, xiè xie! nǐ ne?', translation: 'I am good, thanks! And you?', emotion: 'happy' },
    ]
  }
}

// ==================== HSKK 题目生成 ====================

export async function generateHSKKTest(level: 'beginner' | 'intermediate' | 'advanced'): Promise<any> {
  const levelMap = {
    beginner: { hsk: 2, wordRange: '200-400 characters', qaComplexity: 'simple daily questions' },
    intermediate: { hsk: 4, wordRange: '400-600 characters', qaComplexity: 'opinion questions' },
    advanced: { hsk: 6, wordRange: '500-800 characters', qaComplexity: 'complex discussion questions' },
  }
  const cfg = levelMap[level]

  const prompt = `Generate an HSKK ${level} mock test. Return JSON only.

Reading passage: ${cfg.wordRange}, HSK ${cfg.hsk} level vocabulary.
Q&A: 3 ${cfg.qaComplexity}.
Picture description: Describe a scene (provide a prompt, we'll use a placeholder image).

Return:
{
  "readAloud": {
    "passage": "中文朗读文段",
    "preparationTime": 30,
    "maxRecordTime": 120
  },
  "qa": {
    "questions": [
      {"question": "中文问题1", "preparationTime": 5, "maxAnswerTime": 30},
      {"question": "中文问题2", "preparationTime": 5, "maxAnswerTime": 30},
      {"question": "中文问题3", "preparationTime": 5, "maxAnswerTime": 30}
    ]
  },
  "pictureDescription": {
    "imageUrl": "https://images.unsplash.com/photo-1517248135467-4c7edcad4c6c?w=800",
    "prompt": "请描述这张图片中的内容。",
    "preparationTime": 30,
    "maxRecordTime": 60
  }
}`

  const result = await getConversationResponse(prompt, [
    { role: 'user', content: `Generate HSKK ${level} test` }
  ])

  const parsed = safeParseJSON(result.reply)
  return parsed || null
}

// ==================== 内容推荐 ====================

export function getRecommendedScenarios(hskLevel: number, completedScenarios: string[]): string[] {
  const available = SCENARIO_THEMES.filter(t => !completedScenarios.includes(t.id))
  return available.slice(0, 5).map(t => t.id)
}
