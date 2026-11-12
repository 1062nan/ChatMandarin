import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
const mocks = vi.hoisted(() => ({ client: vi.fn(), available: vi.fn(), checkout: vi.fn(), admin: vi.fn(), rpc: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createSupabaseServerClient: mocks.client, createSupabaseAdmin: mocks.admin }))
vi.mock('@/lib/payment/creem', () => ({ isCreemPaymentsAvailable: mocks.available, createCheckoutSession: mocks.checkout, productIdForPlan: () => 'prod_plus', getCreemApiBaseUrl: () => 'https://test-api.creem.io/v1' }))
import { POST } from './route'
function query(data: unknown) {
  const q: any = {}
  for (const m of ['select', 'eq']) q[m] = () => q
  q.single = q.maybeSingle = async () => ({ data, error: null })
  return q
}
const request = () => new NextRequest('https://example.test/api/checkout', { method: 'POST', body: JSON.stringify({ plan: 'plus' }) })
beforeEach(() => {
  vi.resetAllMocks()
  vi.stubEnv('NEXT_PUBLIC_APP_URL','https://app.chatmandarin.cc')
  mocks.admin.mockReturnValue({rpc:mocks.rpc})
  mocks.available.mockReturnValue(false)
  mocks.client.mockResolvedValue({ auth: { getUser: async () => ({ data: { user: { id: 'auth' } } }) }, from: (table: string) => query(table === 'profiles' ? { id: 'profile', email: 'test@example.invalid' } : { provider_subscription_id: 'existing', status: 'active', plan: 'plus' }) })
})
describe('checkout safety gate', () => {
  it('never calls provider while checkout is disabled', async () => {
    expect((await POST(request())).status).toBe(503)
    expect(mocks.checkout).not.toHaveBeenCalled()
  })
  it('blocks another checkout for an existing provider subscription', async () => {
    mocks.available.mockReturnValue(true)
    expect((await POST(request())).status).toBe(409)
    expect(mocks.checkout).not.toHaveBeenCalled()
  })
  it('rejects anonymous checkout without provider calls', async () => {
    mocks.client.mockResolvedValue({ auth: { getUser: async () => ({ data: { user: null } }) } })
    expect((await POST(request())).status).toBe(401)
    expect(mocks.checkout).not.toHaveBeenCalled()
  })
})

function enableNewCheckout() {
  mocks.available.mockReturnValue(true)
  mocks.client.mockResolvedValue({auth:{getUser:async()=>({data:{user:{id:'auth'}}})},from:(table:string)=>query(table==='profiles'?{id:'profile',email:'test@example.invalid'}:null)})
}
describe('durable checkout reuse',()=>{
  it('stores before returning a newly created provider URL',async()=>{
    enableNewCheckout()
    mocks.rpc.mockResolvedValueOnce({data:{outcome:'created',attempt_id:'attempt'}}).mockResolvedValueOnce({data:true})
    mocks.checkout.mockResolvedValue({id:'ch_test',url:'https://www.creem.io/test/checkout'})
    const response=await POST(request())
    expect(response.status).toBe(200)
    expect(mocks.checkout).toHaveBeenCalledWith(expect.objectContaining({requestId:'attempt'}))
    expect(mocks.rpc).toHaveBeenLastCalledWith('finish_creem_checkout',expect.objectContaining({p_attempt_id:'attempt',p_checkout_id:'ch_test'}))
    expect(response.headers.get('cache-control')).toBe('no-store')
  })
  it('returns stored URL without another provider call',async()=>{
    enableNewCheckout()
    mocks.rpc.mockResolvedValue({data:{outcome:'ready',url:'https://www.creem.io/test/checkout'}})
    expect((await POST(request())).status).toBe(200)
    expect(mocks.checkout).not.toHaveBeenCalled()
  })
  it.each(['pending','conflict','subscription_exists'])('blocks %s without provider call',async(outcome)=>{
    enableNewCheckout();mocks.rpc.mockResolvedValue({data:{outcome}})
    expect((await POST(request())).status).toBe(409)
    expect(mocks.checkout).not.toHaveBeenCalled()
  })
  it('does not release or retry an uncertain provider call',async()=>{
    enableNewCheckout();mocks.rpc.mockResolvedValue({data:{outcome:'created',attempt_id:'attempt'}})
    mocks.checkout.mockRejectedValue(new Error('timeout'))
    expect((await POST(request())).status).toBe(500)
    expect(mocks.rpc).toHaveBeenCalledTimes(1)
    expect(mocks.checkout).toHaveBeenCalledTimes(1)
  })
  it('does not return an unpersisted URL',async()=>{
    enableNewCheckout();mocks.rpc.mockResolvedValueOnce({data:{outcome:'created',attempt_id:'attempt'}}).mockResolvedValueOnce({data:false})
    mocks.checkout.mockResolvedValue({id:'ch_test',url:'https://www.creem.io/test/checkout'})
    const response=await POST(request())
    expect(response.status).toBe(500); expect(await response.json()).not.toHaveProperty('url')
  })
  it('rejects malformed body without reserving or calling provider',async()=>{
    enableNewCheckout()
    expect((await POST(new NextRequest('https://example.test/api/checkout',{method:'POST',body:'null'}))).status).toBe(400)
    expect(mocks.rpc).not.toHaveBeenCalled()
  })
  it('refuses localhost callback before reserving',async()=>{
    enableNewCheckout();vi.stubEnv('NEXT_PUBLIC_APP_URL','http://localhost:3000')
    expect((await POST(request())).status).toBe(500);expect(mocks.rpc).not.toHaveBeenCalled()
  })
})

describe('parallel HTTP requests',()=>{
  it('only the reservation winner creates a provider session',async()=>{
    enableNewCheckout()
    let reserved=false
    let finishProvider!: (session:{id:string;url:string})=>void
    mocks.checkout.mockImplementation(()=>new Promise<{id:string;url:string}>(resolve=>{finishProvider=resolve}))
    mocks.rpc.mockImplementation(async(name:string)=>{
      if(name==='finish_creem_checkout')return {data:true}
      if(reserved)return {data:{outcome:'pending'}}
      reserved=true;return {data:{outcome:'created',attempt_id:'one-attempt'}}
    })
    const first=POST(request())
    await vi.waitFor(()=>expect(mocks.checkout).toHaveBeenCalledTimes(1))
    const second=await POST(request())
    expect(second.status).toBe(409)
    finishProvider({id:'ch_test',url:'https://www.creem.io/test/payment/a'})
    expect((await first).status).toBe(200)
    expect(mocks.checkout).toHaveBeenCalledTimes(1)
  })
})
