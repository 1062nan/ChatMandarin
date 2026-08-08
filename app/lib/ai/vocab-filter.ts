/**
 * HSK 词汇后处理过滤器（方案 C + 大纲增强）
 *
 * 在 AI 生成回复后，检查是否包含超纲词汇：
 * 1. 对 AI 回复进行简单分词（按字符/词组匹配）
 * 2. 检查是否包含目标级别以上的词汇
 * 3. 如果发现超纲词 → 标记并在 errors 中提示用户
 *
 * 大纲增强：现在同时检查 HSK_LEVELS.avoidWords 和 HSK_SYLLABUS.sampleWords，
 * 覆盖面从 ~30 词/级 → ~80+ 词/级，更准确判断超纲。
 */

import { HSK_LEVELS } from '@/lib/hsk/vocabulary'
import { HSK_SYLLABUS } from '@/lib/hsk/syllabus'

/**
 * 构建每级的"超纲词检测池"：
 * = 该级别以上所有级的 avoidWords + sampleWords
 */
function getOverLevelPool(userLevel: number): Map<string, number> {
  const pool = new Map<string, number>()
  for (const syl of HSK_SYLLABUS) {
    if (syl.level <= userLevel) continue
    for (const w of syl.sampleWords) {
      if (w.length >= 2 && !pool.has(w)) pool.set(w, syl.level)
    }
  }
  for (const lv of HSK_LEVELS) {
    if (lv.level <= userLevel) continue
    for (const w of lv.avoidWords) {
      if (w.length >= 2 && !pool.has(w)) pool.set(w, lv.level)
    }
  }
  return pool
}

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
  const pool = getOverLevelPool(targetHSKLevel)

  // 一次扫描即可——所有更高级别的词都在 pool 里
  for (const [word, lvl] of pool) {
    if (reply.includes(word)) {
      const suggestion = findSimplerAlternative(word, targetHSKLevel)
      overLevelWords.push({
        word,
        userLevel: targetHSKLevel,
        estimatedLevel: lvl,
        suggestion
      })
    }
  }

  // 去重（同一个词可能来自 avoidWords + sampleWords，但 Map 已自动去重）
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
