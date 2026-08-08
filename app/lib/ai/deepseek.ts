/**
 * DeepSeek LLM 客户端
 * OpenAI-compatible API
 * https://api.deepseek.com/v1/chat/completions
 */

import { jsonrepair } from 'jsonrepair'

const DEEPSEEK_BASE_URL = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com'
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface ConversationResponse {
  reply: string
  errors: Array<{
    type: 'tone' | 'grammar' | 'word' | 'fluency'
    user_said: string
    correct: string
    explanation: string
    severity: 'low' | 'medium' | 'high'
  }>
  scores: {
    pronunciation: number
    grammar: number
    word_choice: number
    fluency: number
  }
  conversation_complete: boolean
  encouragement?: string
}

export interface HSKKScoreResponse {
  scores: {
    pronunciation: number
    fluency: number
    grammar: number
    vocabulary: number
    content: number
  }
  total_score: number
  predicted_pass: boolean
  major_issues: Array<{
    dimension: string
    issue: string
    example: string
    correction: string
  }>
  strengths: string[]
  overall_feedback: string
}

/**
 * 调用 DeepSeek 获取对话回复
 */
export async function getConversationResponse(
  systemPrompt: string,
  messages: ChatMessage[],
  options?: { temperature?: number; maxTokens?: number }
): Promise<ConversationResponse> {
  if (!DEEPSEEK_API_KEY) {
    throw new Error('DEEPSEEK_API_KEY is not configured')
  }

  const callDeepSeek = async (useJsonMode: boolean) => {
    const response = await fetch(`${DEEPSEEK_BASE_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages,
        ],
        temperature: options?.temperature ?? 0.7,
        max_tokens: options?.maxTokens ?? 1500,
        ...(useJsonMode ? { response_format: { type: 'json_object' } } : {}),
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`DeepSeek API error (${response.status}): ${error}`)
    }

    const data = await response.json()
    const choice = data.choices?.[0]
    const content: string | undefined = choice?.message?.content
    const finishReason: string | undefined = choice?.finish_reason
    const usage = data.usage

    console.log('[DeepSeek] finish_reason:', finishReason, 'content_len:', content?.length || 0, 'usage:', usage)

    return { content, finishReason, usage }
  }

  // 第一次尝试：json_object 模式
  let result
  try {
    result = await callDeepSeek(true)
  } catch (e) {
    console.error('[DeepSeek] first call failed:', e)
    throw e
  }

  // 如果返回空/纯空格，重试一次（不开 json_object 模式）
  if (!result.content || result.content.trim().length === 0) {
    console.warn('[DeepSeek] empty content, retrying without json_object mode. finish_reason:', result.finishReason)
    result = await callDeepSeek(false)
  }

  const content = result.content || ''
  if (content.trim().length === 0) {
    throw new Error(
      `DeepSeek returned empty content twice. Last finish_reason: ${result.finishReason}, usage: ${JSON.stringify(result.usage)}`
    )
  }

  // 多层 JSON 解析：
  // 1. JSON.parse（标准）
  // 2. markdown code fence 提取
  // 3. 第一个 { 到最后一个 } 子串
  // 4. jsonrepair 修复 LLM 常见错误（缺引号、缺括号、尾随逗号、混入文字等）
  const tryParse = (text: string): ConversationResponse | null => {
    // 标准 parse
    try {
      return JSON.parse(text) as ConversationResponse
    } catch {}

    // markdown code fence
    const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (fenceMatch) {
      try { return JSON.parse(fenceMatch[1]) as ConversationResponse } catch {}
    }

    // 子串：第一个 { 到最后一个 }
    const s = text.indexOf('{')
    const e = text.lastIndexOf('}')
    if (s !== -1 && e !== -1 && e > s) {
      const substr = text.substring(s, e + 1)
      try { return JSON.parse(substr) as ConversationResponse } catch {}
    }

    // jsonrepair：修复损坏的 JSON
    try {
      const repaired = jsonrepair(text)
      return JSON.parse(repaired) as ConversationResponse
    } catch {}

    // 子串 + jsonrepair
    if (s !== -1 && e !== -1 && e > s) {
      try {
        const repaired = jsonrepair(text.substring(s, e + 1))
        return JSON.parse(repaired) as ConversationResponse
      } catch {}
    }

    return null
  }

  const parsed = tryParse(content)
  if (parsed) {
    // 确保 reply 字段有内容
    if (!parsed.reply && typeof parsed === 'object') {
      parsed.reply = content.substring(0, 100)
    }
    return parsed
  }

  // 最后 fallback：DeepSeek 完全没返回 JSON 结构（纯自然语言）
  // 直接当 reply，对话能继续
  console.warn(
    '[DeepSeek] content is not JSON even after jsonrepair, using plaintext fallback. finish_reason:',
    result.finishReason,
    'first 80 chars:',
    content.substring(0, 80)
  )
  return {
    reply: content.trim(),
    errors: [],
    scores: {
      pronunciation: 80,
      grammar: 80,
      word_choice: 80,
      fluency: 80,
    },
    conversation_complete: false,
    encouragement: undefined,
  }
}

/**
 * 调用 DeepSeek 评分 HSKK 模考
 */
export async function getHSKKScore(
  systemPrompt: string
): Promise<HSKKScoreResponse> {
  if (!DEEPSEEK_API_KEY) {
    throw new Error('DEEPSEEK_API_KEY is not configured')
  }

  const response = await fetch(`${DEEPSEEK_BASE_URL}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: systemPrompt }
      ],
      temperature: 0.3,
      max_tokens: 1200,
      response_format: { type: 'json_object' }
    })
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`DeepSeek API error (${response.status}): ${error}`)
  }

  const data = await response.json()
  const content = data.choices[0]?.message?.content

  if (!content) {
    throw new Error('DeepSeek returned empty response')
  }

  try {
    return JSON.parse(content) as HSKKScoreResponse
  } catch {
    // markdown fence
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (jsonMatch) {
      try { return JSON.parse(jsonMatch[1]) as HSKKScoreResponse } catch {}
    }
    // 子串
    const s = content.indexOf('{')
    const e = content.lastIndexOf('}')
    if (s !== -1 && e !== -1 && e > s) {
      try { return JSON.parse(content.substring(s, e + 1)) as HSKKScoreResponse } catch {}
    }
    // jsonrepair
    try {
      const repaired = jsonrepair(content)
      return JSON.parse(repaired) as HSKKScoreResponse
    } catch {}
    throw new Error(`Failed to parse HSKK score response after all repair attempts. First 300 chars: ${content.substring(0, 300)}`)
  }
}

/**
 * 提取 JSON（容错处理，多层 + jsonrepair）
 */
export function safeParseJSON(text: string): any | null {
  // 标准 parse
  try {
    return JSON.parse(text)
  } catch {}

  // markdown fence
  const match = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (match) {
    try { return JSON.parse(match[1]) } catch {}
  }

  // 子串
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start !== -1 && end !== -1 && end > start) {
    try { return JSON.parse(text.substring(start, end + 1)) } catch {}
  }

  // jsonrepair
  try {
    return JSON.parse(jsonrepair(text))
  } catch {}

  // 子串 + jsonrepair
  if (start !== -1 && end !== -1 && end > start) {
    try {
      return JSON.parse(jsonrepair(text.substring(start, end + 1)))
    } catch {}
  }

  return null
}
