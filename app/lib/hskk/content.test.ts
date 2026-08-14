import { describe, expect, it } from 'vitest'
import { getRandomTest } from './content'

describe('getRandomTest', () => {
  it('makes every configured beginner variant reachable', () => {
    expect(getRandomTest('beginner', () => 0).variant).toBe(1)
    expect(getRandomTest('beginner', () => 0.5).variant).toBe(2)
    expect(getRandomTest('beginner', () => 0.999).variant).toBe(3)
  })
})
