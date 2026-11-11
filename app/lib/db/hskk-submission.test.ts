import { describe, expect, it, vi, beforeEach } from 'vitest'
const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createSupabaseAdmin: () => ({ rpc }) }))
import { hskkFingerprint, reserveHskk, finishHskk, failHskk } from './hskk-submission'
beforeEach(() => vi.resetAllMocks())
const bytes = (s: string) => new TextEncoder().encode(s).buffer
describe('HSKK durable submission adapter', () => {
  it('fingerprints canonical test and ordered sections deterministically', () => {
    const sections = [bytes('read'), bytes('qa'), bytes('picture')]
    const value = hskkFingerprint('beginner', 1, sections)
    expect(value).toMatch(/^[0-9a-f]{64}$/)
    expect(hskkFingerprint('beginner', 1, sections)).toBe(value)
    expect(hskkFingerprint('beginner', 2, sections)).not.toBe(value)
    expect(hskkFingerprint('beginner', 1, [...sections].reverse())).not.toBe(value)
  })
  it('reserves on authenticated client and propagates database failure', async () => {
    rpc.mockResolvedValue({ data: { state: 'reserved' }, error: null })
    await reserveHskk({ rpc } as never, 'profile', 'hash', 'beginner')
    expect(rpc).toHaveBeenCalledWith('reserve_hskk_submission', { p_profile_id: 'profile', p_fingerprint: 'hash', p_level: 'beginner' })
    rpc.mockResolvedValue({ error: new Error('offline') })
    await expect(reserveHskk({ rpc } as never, 'profile', 'hash', 'beginner')).rejects.toThrow('offline')
  })
  it('rejects expired finish leases', async () => {
    rpc.mockResolvedValue({ data: false, error: null })
    await expect(finishHskk('profile', 'hash', 'lease', {}, [])).rejects.toThrow('expired')
    rpc.mockResolvedValue({ data: true, error: null })
    await expect(finishHskk('profile', 'hash', 'lease', {}, [])).resolves.toBeUndefined()
  })
  it('marks failure with its lease without deleting records', async () => {
    rpc.mockResolvedValue({ data: false, error: null })
    await failHskk('profile', 'hash', 'lease')
    expect(rpc).toHaveBeenCalledWith('fail_hskk_submission', { p_profile_id: 'profile', p_fingerprint: 'hash', p_lease_token: 'lease' })
  })
})
