// Cloudflare Pages Function - 接收 waitlist 订阅
// 邮箱存到 Cloudflare KV，无第三方依赖
//
// 绑定 KV namespace: WAITLIST

export async function onRequestPost({ request, env }) {
  // 只允许 POST
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ ok: false, error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const email = (body.email || '').trim().toLowerCase();
  const hskLevel = (body.hsk_level || '').trim().slice(0, 50);

  // 简单邮箱格式校验
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || !emailRegex.test(email) || email.length > 200) {
    return new Response(JSON.stringify({ ok: false, error: 'Invalid email' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // 检查 KV 是否绑定
  if (!env.WAITLIST) {
    return new Response(JSON.stringify({ ok: false, error: 'KV not bound' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // 防重复：用 email 作为 key（自动去重）
  const existing = await env.WAITLIST.get(`email:${email}`);
  if (existing) {
    return new Response(JSON.stringify({
      ok: true,
      message: 'Already subscribed',
      duplicate: true
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // 存到 KV
  // key: email:xxx@yyy.com  → 方便去重
  // key: index:timestamp    → 方便按时间排序
  // value: JSON 字符串
  const timestamp = Date.now();
  const record = {
    email,
    hsk_level: hskLevel,
    ip: request.headers.get('CF-Connecting-IP') || 'unknown',
    country: request.cf?.country || 'unknown',
    ua: (request.headers.get('User-Agent') || '').slice(0, 200),
    timestamp
  };

  await env.WAITLIST.put(`email:${email}`, JSON.stringify(record));
  await env.WAITLIST.put(`idx:${timestamp}:${email}`, '1');

  // 简单计数（用于显示总量）
  let count = parseInt(await env.WAITLIST.get('meta:count') || '0', 10);
  count = count + 1;
  await env.WAITLIST.put('meta:count', String(count));

  return new Response(JSON.stringify({
    ok: true,
    message: 'Subscribed successfully',
    count
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
}

// GET：返回当前订阅数（公开，仅数字）
export async function onRequestGet({ request, env }) {
  if (!env.WAITLIST) {
    return new Response(JSON.stringify({ count: 0 }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }
  const count = await env.WAITLIST.get('meta:count') || '0';
  return new Response(JSON.stringify({ count: parseInt(count, 10) }), {
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=60'
    }
  });
}
