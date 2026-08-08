# ChatMandarin 部署指南（2026-07-18）

ChatMandarin 分成两个独立部署：

- `landing/`：纯静态 Landing Page，继续使用 Cloudflare Pages。
- `app/`：包含 SSR、Middleware 和 API Routes 的 Next.js 全栈应用，使用 Cloudflare Workers + OpenNext。

不要把 `app/.next` 直接上传到 Pages；那不是可运行的全栈产物。

## 1. 本地发布门禁

在 `D:/Wordspace/oversea/ChatMandarin/app` 执行：

```bash
npm ci
npm run cf-typegen
npm run type-check
npm run lint
npm run build:cloudflare
npx wrangler deploy --dry-run
npm run preview
```

必须在浏览器检查：首页、登录、注册、密码重置、Dashboard、对话启动，以及至少一个失败分支。Windows 上 OpenNext 会提示建议使用 WSL；CI 和正式构建优先用 Linux。

## 2. Supabase

按顺序应用 `supabase/migrations/001_init.sql` 到最新迁移，且先在 staging 项目验证。生产执行前备份数据库。

Auth 至少配置：

- Site URL：正式应用域名。
- Redirect URL：`https://<app-domain>/auth/callback`。
- Email provider；OAuth provider 只启用已正确配置回调的渠道。

## 3. Workers 环境变量与密钥

构建变量和运行时密钥都要在 Cloudflare Workers 的 Builds / Settings 中配置。不得写入 `wrangler.jsonc`、源码或 Git。

必需：

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
DEEPSEEK_API_KEY
VOLCENGINE_API_KEY
VOLCENGINE_APP_ID
NEXT_PUBLIC_APP_URL
```

支付启用前再配置：

```text
CREEM_API_KEY
CREEM_WEBHOOK_SECRET
CREEM_PLUS_PRODUCT_ID
CREEM_PRO_PRODUCT_ID
CREEM_TEST_MODE
```

使用交互式命令写入密钥，不要把值放进命令行参数：

```bash
npx wrangler secret put SECRET_NAME
```

## 4. Staging 验收

正式域名发布前，先部署到 staging Worker 或 preview URL，完成：

- 注册、登录、退出、忘记密码、密码重置。
- 真实麦克风录音；Chrome、Edge、Safari/移动端至少各一轮。
- ASR 空音频、过短音频、权限拒绝、上游超时。
- AI 回复、TTS 播放、对话结束与统计只累计一次。
- HSKK 提交、错题复习、每日/月度配额。
- Checkout、Webhook 签名、Webhook 重放、取消订阅（启用支付时）。
- Workers Logs 无未处理异常，且日志不包含密钥、完整音频或不必要的个人信息。

## 5. 正式发布

只有 staging 验收通过后执行：

```bash
npm run deploy
```

部署后立即做同一套关键路径冒烟测试，并记录当前 Worker version。出现阻断性问题时使用 Wrangler versions/rollback 回退到上一稳定版本。

## 6. Landing Page

`landing/wrangler.toml` 只包含非敏感配置。`ADMIN_TOKEN` 必须放在 Pages 加密环境变量中，并在本次源码泄露修复后轮换。管理接口只接受 `Authorization: Bearer <token>`，不要再通过 URL query string 传密钥。

发布 Landing Page 前确认 CTA 指向实际可访问的应用或 waitlist；Beta 未开放时不要写“已上线”。
