import { describe, expect, it, vi } from 'vitest'
import { watchGuidedPlan } from './plan-refresh'
const scheduled = { status: 'scheduled' as const, checkedAt: '2026-11-12T10:00:00Z', nextReviewAt: '2026-11-13T10:00:00Z' }
function environment() {
  let listener = () => {}
  let timer = () => {}
  const visibility = { visibilityState: 'visible', addEventListener: vi.fn((_type, fn) => { listener = fn }), removeEventListener: vi.fn() }
  const env = { visibility, setTimer: vi.fn((fn) => { timer = fn; return 7 }), clearTimer: vi.fn() }
  return { env, visible: () => listener(), fire: () => timer() }
}
describe('server schedule revalidation', () => {
  it('bounds a cached schedule to one minute, not its original day-long interval', () => {
    const { env, fire } = environment(); const refresh = vi.fn()
    watchGuidedPlan(scheduled, refresh, env)
    expect(env.setTimer).toHaveBeenCalledWith(expect.any(Function), 60_000)
    fire(); expect(refresh).toHaveBeenCalledTimes(1)
  })
  it('asks the server just after a close deadline without changing due state itself', () => {
    const { env, fire } = environment(); const refresh = vi.fn()
    watchGuidedPlan({ ...scheduled, nextReviewAt: '2026-11-12T10:00:03Z' }, refresh, env)
    expect(env.setTimer).toHaveBeenCalledWith(expect.any(Function), 4000)
    fire(); expect(refresh).toHaveBeenCalledTimes(1)
    expect(scheduled.status).toBe('scheduled')
  })
  it('defers hidden-tab work until visibility returns', () => {
    const { env, fire, visible } = environment(); const refresh = vi.fn()
    watchGuidedPlan(scheduled, refresh, env)
    env.visibility.visibilityState = 'hidden'; fire(); visible()
    expect(refresh).not.toHaveBeenCalled()
    env.visibility.visibilityState = 'visible'; visible()
    expect(refresh).toHaveBeenCalledTimes(1)
  })
  it('cleans up listeners and pending work on navigation or newer server state', () => {
    const { env } = environment()
    const stop = watchGuidedPlan(scheduled, vi.fn(), env)
    stop()
    expect(env.clearTimer).toHaveBeenCalledWith(7)
    expect(env.visibility.removeEventListener).toHaveBeenCalledWith('visibilitychange', env.visibility.addEventListener.mock.calls[0][1])
  })
  it.each(['due', 'new', 'unavailable'] as const)('does not poll %s plans', status => {
    const { env } = environment()
    watchGuidedPlan({ ...scheduled, status }, vi.fn(), env)
    expect(env.setTimer).not.toHaveBeenCalled()
  })
})
