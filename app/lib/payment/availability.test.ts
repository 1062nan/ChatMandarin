import { afterEach, expect, it, vi } from 'vitest'
afterEach(() => { vi.unstubAllEnvs(); vi.resetModules() })
it('defaults checkout off even with all credentials configured', async () => {
  for (const name of ['CREEM_API_KEY', 'CREEM_WEBHOOK_SECRET', 'CREEM_PLUS_PRODUCT_ID', 'CREEM_PRO_PRODUCT_ID']) vi.stubEnv(name, 'test-config')
  vi.stubEnv('CREEM_CHECKOUT_ENABLED', '')
  vi.resetModules()
  const { isCreemPaymentsAvailable } = await import('./creem')
  expect(isCreemPaymentsAvailable()).toBe(false)
  vi.stubEnv('CREEM_CHECKOUT_ENABLED', 'true')
  expect(isCreemPaymentsAvailable()).toBe(true)
})
