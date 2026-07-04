/**
 * HSK 词汇后处理过滤器（方案 C）
 *
 * 在 AI 生成回复后，检查是否包含超纲词汇：
 * 1. 对 AI 回复进行简单分词（按字符/词组匹配）
 * 2. 检查是否包含目标级别以上的词汇
 * 3. 如果发现超纲词 → 标记并在 errors 中提示用户
 */

import { HSK_LEVELS } from '@/lib/hsk/vocabulary'

interface VocabCheckResult {
  passed: boolean
  overLevelWords: Array<{
    word: string
    userLevel: number
    estimatedLevel: number
    suggestion: string
  }>
  cleanedReply?: string
}

/**
 * 检查 AI 回复是否包含超纲词汇
 * @param reply AI 的中文回复
 * @param targetHSKLevel 用户的 HSK 等级
 */
export function checkVocabularyLevel(
  reply: string,
  targetHSKLevel: number
): VocabCheckResult {
  const overLevelWords: VocabCheckResult['overLevelWords'] = []

  // 获取该级别应该避免的词汇
  for (const level of HSK_LEVELS) {
    if (level.level <= targetHSKLevel) continue

    // 检查 reply 中是否包含更高级别的 "avoid words"
    for (const word of level.avoidWords) {
      if (word.length < 2) continue // 跳过单字

      // 使用 includes 做简单匹配（中文不需要空格分词）
      if (reply.includes(word)) {
        // 尝试找到替代词
        const suggestion = findSimplerAlternative(word, targetHSKLevel)

        overLevelWords.push({
          word,
          userLevel: targetHSKLevel,
          estimatedLevel: level.level,
          suggestion
        })
      }
    }

    // 检查核心词是否超出级别
    // 注意：这不会检查所有词，只检查 "avoid" 列表（已知的高级词）
  }

  return {
    passed: overLevelWords.length === 0,
    overLevelWords
  }
}

/**
 * 为超纲词找更简单的替代
 */
function findSimplerAlternative(word: string, targetLevel: number): string {
  // 常见高级词 → 简单替代映射
  const alternatives: Record<string, string> = {
    '经验': '做过的事',
    '选择': '选',
    '准备': '准备好',
    '关系': '联系',
    '问题': '问题（HSK 3+）',
    '感觉': '觉得',
    '发现': '看到',
    '变化': '变',
    '态度': '想法',
    '满意': '高兴',
    '关心': '在意',
    '决定': '定',
    '环境': '周围',
    '机会': '机会（HSK 4）',
    '考虑': '想',
    '影响': '改变',
    '支持': '帮忙',
    '发展': '变大',
    '经济': '钱的方面',
    '政治': '政府的事',
    '典型': '有代表性',
    '象征': '代表',
    '传统': '老的',
    '现代': '新的',
    '科技': '技术',
    '文化': '文化（HSK 5）',
    '反映': '表现出',
    '要求': '需要',
    '满足': '达到',
    '实现': '做到',
    '提供': '给',
    '保证': '确保',
    '矛盾': '冲突',
    '竞争': '比赛',
    '效率': '效率（HSK 5）',
    '资源': '资源（HSK 5）',
    '概念': '想法',
    '理论': '理论（HSK 5）',
    '促进': '推动',
    '推动': '帮忙发展',
    '维护': '保持',
    '保障': '保护',
    '改革': '改变',
    '创新': '新做法'
  }

  return alternatives[word] || `（更简单的表达）`
}

/**
 * 将词汇检查结果整合到对话 errors 中
 * 如果发现 AI 用了超纲词，给用户一个"学习提示"
 */
export function enhanceErrorsWithVocab(
  errors: any[],
  vocabResult: VocabCheckResult
): any[] {
  if (vocabResult.passed) return errors

  const enhanced = [...errors]

  for (const over of vocabResult.overLevelWords) {
    enhanced.push({
      type: 'word',
      user_said: over.word,
      correct: over.suggestion,
      explanation: `"${over.word}" is an HSK ${over.estimatedLevel} word. A simpler way to say this at HSK ${over.userLevel}: "${over.suggestion}".`,
      severity: 'low'
    })
  }

  return enhanced
}
