/**
 * DeepSeek LLM 客户端
 * OpenAI-compatible API
 * https://api.deepseek.com/v1/chat/completions
 */

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

  try {
    return JSON.parse(content) as ConversationResponse
  } catch {
    // 尝试从 markdown code fence 中提取 JSON
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[1]) as ConversationResponse
      } catch (e) {
        throw new Error(`Failed to parse JSON from code fence: ${(e as Error).message}. Raw: ${content.substring(0, 300)}`)
      }
    }
    // 尝试找第一个 { 和最后一个 }
    const start = content.indexOf('{')
    const end = content.lastIndexOf('}')
    if (start !== -1 && end !== -1 && end > start) {
      try {
        return JSON.parse(content.substring(start, end + 1)) as ConversationResponse
      } catch (e) {
        throw new Error(`Failed to parse JSON substring: ${(e as Error).message}. Raw: ${content.substring(0, 300)}`)
      }
    }
    throw new Error(`DeepSeek returned non-JSON content. finish_reason=${result.finishReason}. First 300 chars: ${content.substring(0, 300)}`)
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
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (jsonMatch) {
      return JSON.parse(jsonMatch[1]) as HSKKScoreResponse
    }
    throw new Error(`Failed to parse HSKK score response: ${content.substring(0, 200)}`)
  }
}

/**
 * 提取 JSON（容错处理）
 */
export function safeParseJSON(text: string): any | null {
  try {
    return JSON.parse(text)
  } catch {
    const match = text.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (match) {
      try {
        return JSON.parse(match[1])
      } catch {
        return null
      }
    }
    // 尝试找第一个 { 和最后一个 }
    const start = text.indexOf('{')
    const end = text.lastIndexOf('}')
    if (start !== -1 && end !== -1) {
      try {
        return JSON.parse(text.substring(start, end + 1))
      } catch {
        return null
      }
    }
    return null
  }
}
