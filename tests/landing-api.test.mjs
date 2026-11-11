import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const load = async (path) => import(`data:text/javascript;base64,${Buffer.from(await readFile(new URL(path, import.meta.url))).toString('base64')}`);
const waitlist = await load('../landing/functions/api/waitlist.js');
const admin = await load('../landing/functions/api/admin.js');
function kv() {
  const data = new Map();
  return { data, async get(k) { return data.get(k) ?? null; }, async put(k,v) { data.set(k,v); }, async list() { return { keys:[...data.keys()].filter(k=>k.startsWith('email:')).map(name=>({name})), list_complete:true }; } };
}
const post = (value, env) => waitlist.onRequestPost({request:new Request('https://test.invalid/api/waitlist',{method:'POST',body:JSON.stringify(value)}),env});
test('invalid JSON field types return 400, never write', async()=>{
 for (const body of [null,[],3,{email:4},{email:'a@example.com',hsk_level:3}]) {
  const store=kv(); const r=await post(body,{WAITLIST:store}); assert.equal(r.status,400); assert.equal(store.data.size,0);
 }
});
test('valid signup normalizes and duplicate does not increment',async()=>{
 const store=kv(); const env={WAITLIST:store};
 const a=await post({email:'  TEST@example.com ',hsk_level:'HSK 1'},env); assert.equal(a.status,200); assert.equal((await a.json()).count,1);
 const b=await post({email:'test@example.com'},env); assert.equal((await b.json()).duplicate,true); assert.equal(store.data.get('meta:count'),'1');
});
test('malformed JSON returns 400',async()=>{
 const r=await waitlist.onRequestPost({request:new Request('https://test.invalid/api/waitlist',{method:'POST',body:'{'}),env:{WAITLIST:kv()}}); assert.equal(r.status,400);
});
test('missing KV fails closed for GET and POST',async()=>{
 assert.equal((await post({email:'a@example.com'},{})).status,503);
 assert.equal((await waitlist.onRequestGet({env:{}})).status,503);
});
test('invalid stored count does not write signup',async()=>{
 const store=kv(); store.data.set('meta:count','broken');
 assert.equal((await post({email:'a@example.com'},{WAITLIST:store})).status,503); assert.equal(store.data.size,1);
});
test('admin refuses absent, query-string, or wrong token',async()=>{
 for(const [url,headers,env] of [['https://test.invalid/api/admin',{},{}],['https://test.invalid/api/admin?token=secret',{}, {ADMIN_TOKEN:'secret'}],['https://test.invalid/api/admin',{Authorization:'Bearer wrong'},{ADMIN_TOKEN:'secret'}]]) {
  assert.equal((await admin.onRequestGet({request:new Request(url,{headers}),env})).status,401);
 }
});
test('admin reads all KV pages and skips corrupt records',async()=>{
 let page=0;
 const store={async list(args){page++;return page===1?{keys:[{name:'email:a'}],list_complete:false,cursor:'next'}:{keys:[{name:'email:b'},{name:'email:bad'}],list_complete:true};},async get(k){return k==='email:bad'?'invalid':JSON.stringify({email:k,timestamp:1});}};
 const r=await admin.onRequestGet({request:new Request('https://test.invalid/api/admin',{headers:{Authorization:'Bearer secret'}}),env:{ADMIN_TOKEN:'secret',WAITLIST:store}});
 assert.equal((await r.json()).total,2); assert.equal(page,2); assert.equal(r.headers.get('cache-control'),'no-store');
});
test('CSV escapes quotes and neutralizes formulas',async()=>{
 const store=kv(); store.data.set('email:a',JSON.stringify({email:'=1+1@example.com',hsk_level:'HSK "1",test',country:'JP',timestamp:1}));
 const r=await admin.onRequestGet({request:new Request('https://test.invalid/api/admin?format=csv',{headers:{Authorization:'Bearer secret'}}),env:{ADMIN_TOKEN:'secret',WAITLIST:store}});
 const body=await r.text(); assert.ok(body.includes('"\'=1+1@example.com"')); assert.ok(body.includes('"HSK ""1"",test"')); assert.equal(r.headers.get('cache-control'),'no-store');
});
test('published asset tree excludes configuration and server source',async()=>{
 const { readdir }=await import('node:fs/promises');
 const entries=await readdir(new URL('../landing/public/',import.meta.url));
 assert.ok(entries.includes('index.html')); assert.ok(entries.includes('logo.svg'));
 assert.ok(entries.every(name=>name.endsWith('.html')||name.endsWith('.svg')));
 const config=await readFile(new URL('../landing/wrangler.toml',import.meta.url),'utf8');
 assert.match(config,/pages_build_output_dir\s*=\s*"\.\/public"/);
});
test('invalid count GET returns explicit no-store error',async()=>{
 const store=kv(); store.data.set('meta:count','NaN');
 const r=await waitlist.onRequestGet({env:{WAITLIST:store}});
 assert.equal(r.status,503); assert.equal(r.headers.get('cache-control'),'no-store');
});
