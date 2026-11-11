import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { getSyllabusPromptContext } from '../hsk/syllabus'

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8')

describe('truthful speaking-practice positioning', () => {
  it('discloses format and scoring limits before a learner starts', () => {
    const page = read('components/hskk/hskk-client.tsx')
    expect(page).toContain('not a full HSKK mock exam')
    expect(page).toContain('question counts, and timing do not reproduce an official exam')
    expect(page).toContain('internal practice levels')
    expect(page).toContain('Pronunciation and fluency are not assessed')
    expect(page).not.toContain('>HSKK Mock Test<')
    expect(page).not.toContain("hskRange: 'HSK")
  })

  it('does not present navigation or generated practice as an official mock', () => {
    expect(read('components/layout/app-navbar.tsx')).not.toContain('HSKK Mock')
    expect(read('app/(app)/hskk/page.tsx')).toContain('Speaking Practice')
    expect(read('lib/ai/content-generator.ts')).toContain('not an official test blueprint')
  })

  it('labels the internal traditional-level outline rather than claiming official coverage', () => {
    expect(getSyllabusPromptContext(2)).toContain('not a complete or verified official syllabus')
    expect(read('app/(app)/dashboard/journey-view.tsx')).not.toContain('严格按 HSK 官方大纲')
    expect(read('app/(app)/unit/[id]/unit-client.tsx')).toContain('尚未核验完整官方大纲覆盖')
  })
})
