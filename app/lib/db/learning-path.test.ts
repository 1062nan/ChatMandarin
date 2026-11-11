import { describe, expect, it, vi } from 'vitest'
vi.mock('@/lib/supabase/server', () => ({ createSupabaseServerClient: vi.fn() }))
vi.mock('./verified-practice', () => ({ ensureOwnedLearningProgress: vi.fn() }))
import { generateRecommendation, type LearningUnit, type UserUnitProgress } from './learning-path'
const units = [
  { id: 'first', title: 'First', hsk_level: 1, unlock_score: 0, sort_order: 1 },
  { id: 'next', title: 'Next', hsk_level: 1, unlock_score: 60, sort_order: 3 },
] as LearningUnit[]
function progress(score: number, status: UserUnitProgress['status'] = 'in_progress') {
  return new Map<string, UserUnitProgress>([['first', { unit_id: 'first', status, best_score: score, attempts: 1 }], ['next', { unit_id: 'next', status: score >= 60 ? 'available' : 'locked', best_score: 0, attempts: 0 }]])
}
describe('learning path destination thresholds', () => {
  it('does not use another HSK chapter entry threshold as completion', () => {
    const chapters = [units[0], { ...units[1], hsk_level: 2, unlock_score: 0 }]
    expect(generateRecommendation(chapters, progress(0))?.reason).toContain('65 分')
    expect(generateRecommendation(chapters, progress(65))?.unit_id).toBe('next')
  })
  it('does not claim a stored locked unit is unlocked from an old score', () => {
    const records = progress(100)
    records.set('next', { unit_id: 'next', status: 'locked', best_score: 0, attempts: 0 })
    expect(generateRecommendation(units, records)?.type).toBe('review')
    expect(generateRecommendation(units, records)?.unit_id).toBe('first')
  })
  it('does not skip first-unit practice because its entry threshold is zero', () => {
    const recommendation = generateRecommendation(units, progress(0, 'available'))
    expect(recommendation?.type).toBe('practice_more')
    expect(recommendation?.unit_id).toBe('first')
    expect(recommendation?.reason).toContain('60 分')
  })
  it('recommends next unit exactly when its entry threshold is met', () => {
    expect(generateRecommendation(units, progress(59))?.type).toBe('practice_more')
    expect(generateRecommendation(units, progress(60))?.unit_id).toBe('next')
  })
  it('does not claim completion alone meets a higher next-unit threshold', () => {
    expect(generateRecommendation([units[0], { ...units[1], unlock_score: 70 }], progress(65, 'completed'))?.type).toBe('practice_more')
  })
  it('keeps the preceding active unit as prerequisite across sort-order gaps', () => {
    const recommendation = generateRecommendation(units, new Map())
    expect(recommendation?.unit_id).toBe('first')
    const locked = progress(20)
    locked.set('next', { unit_id: 'next', status: 'locked', best_score: 0, attempts: 0 })
    expect(generateRecommendation(units, locked)?.unit_id).toBe('first')
  })
  it('requires completion score for the last unit without claiming another unlock', () => {
    expect(generateRecommendation([units[0]], progress(0))?.reason).toContain('完成本单元')
    expect(generateRecommendation([units[0]], progress(65))?.type).toBe('all_done')
  })
})
