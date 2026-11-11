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
      headers: { 'WWW-Authenticate': 'Bearer', 'Cache-Control': 'no-store' }
    });
  }

  if (!env.WAITLIST) {
    return new Response('KV not bound', { status: 500 });
  }

  const format = url.searchParams.get('format') || 'json';

  // 列出所有 email: 开头的 key
  const records = [];
  let cursor;
  do {
    const page = await env.WAITLIST.list({ prefix: 'email:', ...(cursor ? { cursor } : {}) });
    for (const key of page.keys) {
      const value = await env.WAITLIST.get(key.name);
      if (!value) continue;
      try {
        const record = JSON.parse(value);
        if (record && typeof record === 'object' && typeof record.email === 'string') {
          records.push(record);
        }
      } catch { /* Ignore malformed legacy records without exposing raw data. */ }
    }
    if (page.list_complete) break;
    if (!page.cursor || page.cursor === cursor) {
      return new Response('Incomplete KV listing', { status: 503, headers: { 'Cache-Control': 'no-store' } });
    }
    cursor = page.cursor;
  } while (true);

  // 按时间排序
  records.sort((a, b) => (Number(a.timestamp) || 0) - (Number(b.timestamp) || 0));

  if (format === 'csv') {
    // 导出 CSV
    const header = 'email,hsk_level,country,timestamp,date\n';
    const rows = records.map(r => {
      const instant = new Date(r.timestamp);
      const date = Number.isFinite(instant.getTime()) ? instant.toISOString() : '';
      return [r.email, r.hsk_level, r.country, r.timestamp, date].map(csvCell).join(',');
    }).join('\n');
    return new Response(header + rows, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="chatmandarin-waitlist.csv"',
        'Cache-Control': 'no-store'
      }
    });
  }

  // 默认 JSON
  return new Response(JSON.stringify({
    total: records.length,
    subscribers: records
  }, null, 2), {
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
  });
}

// CSV quoting alone does not prevent spreadsheet formulas. Neutralize dangerous
// prefixes before quoting, including whitespace/control characters before them.
function csvCell(value) {
  let text = value == null ? '' : String(value);
  if (/^[\s\u0000-\u001f]*[=+@-]/.test(text) || /^[\t\r\n]/.test(text)) text = "'" + text;
  return '"' + text.replace(/"/g, '""') + '"';
}
