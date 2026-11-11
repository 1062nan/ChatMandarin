import { expect, it } from 'vitest'
import { buildHSKKPrompt } from './prompts'
it('instructs transcript scoring not to penalize ASR numeral formatting', () => {
  const prompt = buildHSKKPrompt({ level: 'beginner', section: 'read', transcript: '我今年20岁', referenceText: '我今年二十岁' })
  expect(prompt).toContain('Arabic and Chinese numerals with the same value')
  expect(prompt).toContain('Never deduct points or list these formatting differences')
  expect(prompt).toContain('do not assess pronunciation')
})
