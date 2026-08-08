// Cloudflare Pages Function - 管理后台（查看/导出订阅）
// 受密码保护
//
// 绑定 KV namespace: WAITLIST
// 环境变量：ADMIN_TOKEN（在 Cloudflare Pages 设置中配置）

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);

  // 只接受 Authorization header，避免密钥进入 URL、浏览器历史和访问日志。
  const authorization = request.headers.get('Authorization') || '';
  const token = authorization.startsWith('Bearer ')
    ? authorization.slice('Bearer '.length)
    : '';

  if (!token || token !== (env.ADMIN_TOKEN || '')) {
    return new Response('Unauthorized', {
      status: 401,
      headers: { 'WWW-Authenticate': 'Bearer' }
    });
  }

  if (!env.WAITLIST) {
    return new Response('KV not bound', { status: 500 });
  }

  const format = url.searchParams.get('format') || 'json';

  // 列出所有 email: 开头的 key
  const list = await env.WAITLIST.list({ prefix: 'email:' });
  const records = [];

  for (const key of list.keys) {
    const value = await env.WAITLIST.get(key.name);
    if (value) {
      try {
        records.push(JSON.parse(value));
      } catch (e) {}
    }
  }

  // 按时间排序
  records.sort((a, b) => a.timestamp - b.timestamp);

  if (format === 'csv') {
    // 导出 CSV
    const header = 'email,hsk_level,country,timestamp,date\n';
    const rows = records.map(r => {
      const date = new Date(r.timestamp).toISOString();
      return `"${r.email}","${r.hsk_level || ''}","${r.country || ''}","${r.timestamp}","${date}"`;
    }).join('\n');
    return new Response(header + rows, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="chatmandarin-waitlist.csv"'
      }
    });
  }

  // 默认 JSON
  return new Response(JSON.stringify({
    total: records.length,
    subscribers: records
  }, null, 2), {
    headers: { 'Content-Type': 'application/json' }
  });
}
