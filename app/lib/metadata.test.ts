import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { publicMetadataBase } from './metadata'
const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8')
describe('public app metadata', () => {
  it.each(['http://localhost:3000', 'https://127.0.0.1', 'https://[::1]', 'bad-url', 'ftp://test.example', 'https://user:secret@test.example'])('rejects unsafe production origin %s', value => {
    expect(publicMetadataBase(value, true).origin).toBe('https://app.chatmandarin.cc')
  })
  it('allows explicit preview origin and local test configuration', () => {
    expect(publicMetadataBase('https://preview.example/path', true).href).toBe('https://preview.example/')
    expect(publicMetadataBase('http://localhost:3000', false).origin).toBe('http://localhost:3000')
  })
  it('separates metadata from callback config and avoids inherited homepage canonical', () => {
    const layout = read('../app/layout.tsx')
    expect(layout).toContain('metadataBase: publicMetadataBase()')
    expect(layout).not.toContain('NEXT_PUBLIC_APP_URL')
    expect(layout).not.toMatch(/canonical:\s*['"]\/['"]|url:\s*['"]\/['"]/)
  })
  it.each(['terms', 'privacy'])('gives %s its own canonical and share path', route => {
    const page = read(`../app/(marketing)/${route}/page.tsx`)
    expect(page).toContain(`canonical: '/${route}'`)
    expect(page).toContain(`url: '/${route}'`)
  })
})
