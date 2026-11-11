import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
const { createClient } = vi.hoisted(() => ({ createClient: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createSupabaseServerClient: createClient }))
vi.mock('@/components/shadowing/shadowing-client', () => ({ ShadowingClient: () => null }))
vi.mock('next/navigation', () => ({ notFound: () => { throw new Error('NOT_FOUND') } }))
import ShadowingPage from './page'

const selectedId = 's031'
const first = { id: '22222222-2222-2222-2222-222222222222', text_zh: '你好' }
const selected = { id: selectedId, text_zh: '我想要一杯茶' }
function query(data: unknown) {
  const chain: any = { then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data, error: null }).then(resolve) }
  for (const method of ['select', 'eq', 'lte', 'order', 'limit', 'single', 'maybeSingle']) chain[method] = vi.fn(() => chain)
  return chain
}
function setup(list = [first, selected], requested: unknown = selected) {
  const profile = query({ hsk_level: 1 })
  const listing = query(list)
  const selection = query(requested)
  let sentenceQueries = 0
  const from = vi.fn((table: string) => table === 'profiles' ? profile : sentenceQueries++ === 0 ? listing : selection)
  createClient.mockResolvedValue({ auth: { getUser: async () => ({ data: { user: { id: 'user' } } }) }, from })
  return { from, selection }
}
beforeEach(() => { vi.clearAllMocks(); vi.stubGlobal('React', React) })
describe('selected shadowing navigation', () => {
  it('preserves a selected sentence inside the generic list', async () => {
    const db = setup()
    const result = await ShadowingPage({ searchParams: Promise.resolve({ sentence: selectedId }) })
    expect(result?.props.initialSentenceId).toBe(selectedId)
    expect(result?.props.sentences[1]).toEqual(selected)
    expect(result?.key).toBe(selectedId)
    expect(db.from).toHaveBeenCalledTimes(2)
  })
  it('fetches an active selected sentence outside the generic list', async () => {
    const db = setup([first])
    const result = await ShadowingPage({ searchParams: Promise.resolve({ sentence: selectedId }) })
    expect(result?.props.sentences[0]).toEqual(selected)
    expect(db.selection.eq).toHaveBeenCalledWith('id', selectedId)
    expect(db.selection.eq).toHaveBeenCalledWith('is_active', true)
  })
  it('uses a fresh client key for ordinary navigation back to generic practice', async () => {
    setup()
    const result = await ShadowingPage({ searchParams: Promise.resolve({}) })
    expect(result?.key).toBe('all')
    expect(result?.props.initialSentenceId).toBeUndefined()
  })
  it.each(['invalid', selectedId])('does not silently replace an unavailable requested sentence: %s', async sentence => {
    setup([first], null)
    await expect(ShadowingPage({ searchParams: Promise.resolve({ sentence }) })).rejects.toThrow('NOT_FOUND')
  })
})
