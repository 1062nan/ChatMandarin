import React from 'react'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
const { client } = vi.hoisted(() => ({ client: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createSupabaseServerClient: client }))
vi.mock('@/lib/db/learning-path', () => ({ getLearningPath: async () => ({ units: [], progress: new Map(), recommendation: null }) }))
vi.mock('./journey-view', () => ({ JourneyView: () => null }))
import DashboardPage from './page'
import { DailyGuidedPlan } from '@/components/lessons/daily-guided-plan'
function query(data: unknown, error: unknown = null) {
  const q: any = { then: (resolve: (v: unknown) => unknown) => Promise.resolve({ data, error }).then(resolve) }
  for (const method of ['select', 'eq', 'gt', 'lte', 'order', 'limit', 'single', 'maybeSingle']) q[method] = vi.fn(() => q)
  return q
}
function setup(progress: unknown = null, error: unknown = null) {
  const lesson = query(progress, error)
  const from = vi.fn((table: string) => table === 'profiles' ? query({ id: 'owner', display_name: 'Learner' }) : table === 'lesson_progress' ? lesson : query([]))
  client.mockResolvedValue({ auth: { getUser: async () => ({ data: { user: { id: 'auth' } } }) }, from })
  return { lesson, from }
}
function findCard(element: any): any {
  if (!element) return null
  if (element.type === DailyGuidedPlan) return element
  for (const child of React.Children.toArray(element.props?.children)) { const found = findCard(child); if (found) return found }
  return null
}
beforeEach(() => { vi.resetAllMocks(); vi.stubGlobal('React', React); vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-13T03:09:03Z')) })
afterEach(() => vi.useRealTimers())
describe('authenticated dashboard learning plan', () => {
  it('reads only the owner and lesson schedule, without answers or privileged writes', async () => {
    const { lesson } = setup({ next_review_at: '2026-11-13T03:09:03Z' })
    const card = findCard(await DashboardPage())
    expect(lesson.select).toHaveBeenCalledWith('next_review_at')
    expect(lesson.eq).toHaveBeenCalledWith('user_id', 'owner')
    expect(lesson.eq).toHaveBeenCalledWith('lesson_id', 'restaurant-order-v1')
    expect(card.props.plan.status).toBe('due')
  })
  it('preserves unavailable state rather than falsely offering a first lesson', async () => {
    setup(null, { message: 'unavailable' })
    expect(findCard(await DashboardPage()).props.plan.status).toBe('unavailable')
  })
  it('has no progress reads without an authenticated user', async () => {
    const { from } = setup()
    client.mockResolvedValue({ auth: { getUser: async () => ({ data: { user: null } }) }, from })
    expect(await DashboardPage()).toBeNull()
    expect(from).not.toHaveBeenCalled()
  })
})
