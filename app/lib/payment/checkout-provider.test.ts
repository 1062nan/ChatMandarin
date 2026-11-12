import { afterEach, describe, expect, it, vi } from 'vitest'

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.resetModules() })
async function setup(url='https://www.creem.io/test/payment/checkout',id:unknown='ch_test') {
  vi.resetModules()
  vi.stubEnv('CREEM_API_KEY','sandbox-fixture-only')
  vi.stubEnv('CREEM_PLUS_PRODUCT_ID','prod_test')
  vi.stubEnv('CREEM_TEST_MODE','true')
  const fetchMock=vi.fn().mockResolvedValue({ok:true,json:async()=>({id,checkout_url:url})})
  vi.stubGlobal('fetch',fetchMock)
  return {...await import('./creem'),fetchMock}
}
const options={plan:'plus' as const,userEmail:'fixture@example.invalid',userId:'fixture',successUrl:'https://app.example.invalid/settings',requestId:'stable-attempt-id'}
describe('checkout request identity',()=>{
  it('sends the reserved identity, not a new random ID',async()=>{
    const {createCheckoutSession,fetchMock}=await setup()
    expect(await createCheckoutSession(options)).toEqual({id:'ch_test',url:'https://www.creem.io/test/payment/checkout'})
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url,request]=fetchMock.mock.calls[0]
    expect(url).toBe('https://test-api.creem.io/v1/checkouts')
    expect(JSON.parse(request.body).request_id).toBe('stable-attempt-id')
  })
  it.each([null,'',123])('rejects missing or invalid provider identity %s',async id=>{
    const {createCheckoutSession}=await setup(undefined,id)
    await expect(createCheckoutSession(options)).rejects.toThrow()
  })
  it.each(['javascript:alert(1)','http://creem.io/payment/x','https://creem.io.evil.example/x','https://user:pass@creem.io/x','https://www.creem.io:8443/payment/x'])(
    'rejects unsafe returned URL %s',async url=>{
      const {createCheckoutSession}=await setup(url)
      await expect(createCheckoutSession(options)).rejects.toThrow()
    })
})
