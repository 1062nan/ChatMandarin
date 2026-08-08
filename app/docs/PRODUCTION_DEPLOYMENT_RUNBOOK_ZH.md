# ChatMandarin 生产上线部署手册

更新日期：2026-07-19

本文档以当前真实生产环境为准，不是通用模板。

## 0. 本次实际上线记录

- Voice Worker：`chatmandarin-voice`
- Voice Worker URL：`https://chatmandarin-voice.wangyn-80.workers.dev`
- 初始代码版本：`d08e8656-76b4-4254-b53a-46104a075c65`
- 当前含生产 Secret 的版本：`94e3275b-eba7-41ea-a51b-d78d9a136e2b`
- Vercel Preview：`dpl_13G62hXurwufmQbYdimPxET7pqNv`
- 当前 Vercel Production：`dpl_8efz78Mgr3PNhYzb2AMbByHBkqES`
- 上一 Vercel Production 回滚点：`dpl_66VdEwzqBEG6QwMfkwBMUizUosek`
- `app.chatmandarin.cc`：已切换到新 Production，状态 READY。
- Cloudflare 与 Vercel 已配置同一 `VOICE_GATEWAY_SECRET`，值未打印、未写入磁盘、未提交 Git。

2026-07-19 的 120 秒线上语音验证结果：

| 检查 | 结果 | 延迟 |
| --- | --- | --- |
| 未签名请求拦截 | 1/1 成功 | 433 ms |
| TTS→WAV→ASR 闭环 | 1/1 成功 | 3475 ms |
| Voice Worker 健康检查 | 4/4 成功 | p50 278 ms，p95 333 ms |
| 火山引擎 TTS | 4/4 成功 | p50 1032 ms，p95 1761 ms |

Vercel 发布后验证：生产首页 200、登录页 200、未登录 TTS API 401、Voice Worker `/health` 200；Chrome 已登录用户 Dashboard 正常渲染，页面控制台无本域错误。

## 1. 当前架构

| 组件 | 平台 | 地址/名称 | 当前用途 |
| --- | --- | --- | --- |
| 官网 Landing | Cloudflare Pages | `chatmandarin` | `https://chatmandarin.cc` |
| 全栈应用 | Vercel | `chat-mandarin` | `https://app.chatmandarin.cc` |
| 语音中转 | Cloudflare Workers | `chatmandarin-voice` | 东京区域提示，转发火山引擎 ASR/TTS |
| 数据库与登录 | Supabase | 现有项目 | PostgreSQL、Auth、RLS |
| LLM | DeepSeek | 现有 API Key | 对话和评分 |
| ASR/TTS | 火山引擎 | 现有 App ID/API Key | 中文语音识别、合成 |
| 东京 EC2 | AWS 东京 | 现有服务器 | 暂不切流，作为未来兼容网关备用 |

语音链路：

```text
海外用户 -> Vercel 应用 -> Cloudflare Voice Worker（东京放置提示）-> 火山引擎
                                         |
                                         +-> 东京 EC2 兼容网关（配置后才启用回退）
```

Cloudflare 的区域配置是放置提示，不代表 Worker 固定运行在某一台东京服务器。当前配置为 `aws:ap-northeast-1`。

## 2. 账号和权限

### 已完成，无需用户操作

- Cloudflare CLI 已登录正确账号。
- Cloudflare Account ID：`aaf6eb377e64ab54e1df0c06633c4779`。
- Workers.dev 子域名：`wangyn-80.workers.dev`。
- Vercel CLI 已登录并绑定项目 `chat-mandarin`。
- Vercel Project ID：`prj_gJ9ZOp6fLcX0FpV8al4wWAXjkMge`。
- Vercel Team ID：`team_3q7AKhmQnHJdsf0NXJVntVKI`。
- Vercel 已保存 Supabase、DeepSeek、火山引擎 Production/Preview 密钥。

### 只有以下情况需要用户操作

1. Vercel、Cloudflare 或 Supabase 登录过期，需要完成网页登录、验证码或二次验证。
2. 启用付费功能时，需要提供 Creem 的 API Key、Webhook Secret 和 Plus/Pro Product ID，并执行数据库迁移 009。
3. 将主应用从 Vercel 完全迁移到 Cloudflare Workers 时，需要提供 Supabase Service Role Key，或者登录 Supabase 后由部署人员写入 Cloudflare Secret。
4. 启用东京 EC2 自动回退时，需要确认 EC2 域名、HTTPS 证书和网关部署权限。

不要通过聊天、截图或 Git 提交密钥。优先使用平台 Secret 输入框或 CLI 的安全输入。

## 3. 本地发布前检查

工作目录：

```powershell
Set-Location D:\Wordspace\oversea\ChatMandarin\app
```

安装和验证：

```powershell
npm ci
npm run type-check
npm run lint
npm run voice:typegen
npm run voice:type-check
npm run voice:dry-run
npm run build:cloudflare
```

验收标准：

- TypeScript 无错误。
- ESLint 无 error；已有 warning 应记录，但不应新增阻断性 warning。
- Voice Worker dry-run 成功。
- OpenNext 生产构建成功。
- `git diff --check` 无空白错误。

## 4. 首次初始化 Cloudflare Workers

只有新 Cloudflare 账号需要执行一次：

1. 登录 Cloudflare Dashboard。
2. 打开 Workers & Pages。
3. 在 Account Details 中设置 Workers.dev Subdomain。
4. 本项目实际子域名是 `wangyn-80.workers.dev`。

CLI 验证：

```powershell
npx wrangler whoami
```

必须看到 Account ID `aaf6eb377e64ab54e1df0c06633c4779`。若账号 ID 不一致，立即停止，不要发布。

## 5. 发布 Voice Worker

配置文件：`workers/voice-gateway/wrangler.jsonc`。

先预演，再发布：

```powershell
npm run voice:typegen
npm run voice:type-check
npm run voice:dry-run
npx wrangler deploy --config workers/voice-gateway/wrangler.jsonc
```

预期线上地址：

```text
https://chatmandarin-voice.wangyn-80.workers.dev
```

部署后记录 Wrangler 输出的 Version ID。不要立即修改 `app.chatmandarin.cc` DNS。

## 6. 写入 Cloudflare Secret 和 Vercel 环境变量

自动化方式（推荐）：

```powershell
node scripts/configure-production-voice.mjs
```

脚本会完成：

1. 从本机忽略提交的 `.env.local` 读取火山引擎 App ID/API Key。
2. 在内存中生成新的 `VOICE_GATEWAY_SECRET`。
3. 写入 Cloudflare Worker Secrets：
   - `VOLCENGINE_API_KEY`
   - `VOLCENGINE_APP_ID`
   - `VOICE_GATEWAY_SECRET`
4. 写入 Vercel Production 和 Preview：
   - `VOLCENGINE_ROUTE=cloudflare`
   - `CLOUDFLARE_VOICE_GATEWAY_URL=https://chatmandarin-voice.wangyn-80.workers.dev`
   - `VOICE_GATEWAY_SECRET=<同一个随机值>`
5. 执行 120 秒线上健康检查、鉴权、TTS 和 ASR 闭环。

随机共享密钥不会打印或写入磁盘。脚本失败时重新完整运行，以保证 Cloudflare 和 Vercel 使用同一密钥。

手工备用方式：

```powershell
npx wrangler secret put VOLCENGINE_API_KEY --config workers/voice-gateway/wrangler.jsonc
npx wrangler secret put VOLCENGINE_APP_ID --config workers/voice-gateway/wrangler.jsonc
npx wrangler secret put VOICE_GATEWAY_SECRET --config workers/voice-gateway/wrangler.jsonc
npx vercel env add VOLCENGINE_ROUTE production,preview --force
npx vercel env add CLOUDFLARE_VOICE_GATEWAY_URL production,preview --force
npx vercel env add VOICE_GATEWAY_SECRET production,preview --force --sensitive
```

三个环境中的 `VOICE_GATEWAY_SECRET` 必须完全相同。

## 7. 线上 Voice Worker 验证

自动脚本已经执行 120 秒验证。需要单独重跑时：

```powershell
npm run voice:test
```

完整 ASR 闭环：

```powershell
node scripts/test-voice-gateway.mjs --duration-seconds 120 --asr-from-tts
```

验收标准：

- `/health` 成功率 100%。
- 未签名请求返回 401。
- TTS 返回非空音频。
- TTS 生成的 WAV 能被 ASR 识别为非空文字。
- 2 分钟内无 5xx。

2–5 分钟只证明即时可用，不代表长期稳定性。

## 8. Vercel Preview 发布

先部署 Preview：

```powershell
npx vercel deploy
```

记录 Preview URL，然后检查：

```powershell
curl.exe -I https://<preview-url>
```

浏览器验收：

1. 首页加载。
2. 登录、退出。
3. 启动一次对话。
4. 录制真实语音并得到转写。
5. AI 回复后能播放 TTS。
6. 对话结束只累计一次统计。
7. HSKK、跟读、配音至少各测试一次。
8. 浏览器控制台无阻断错误。

## 9. Vercel 正式发布

Preview 验收通过后，可以将同一部署提升为生产：

```powershell
npx vercel promote https://<preview-url>
```

也可以重新构建正式部署：

```powershell
npx vercel deploy --prod
```

发布后检查：

```powershell
curl.exe -I https://app.chatmandarin.cc
```

确认响应仍来自 Vercel，HTTP 200，TLS 正常。

## 10. Cloudflare Pages 官网发布

Landing 目录：`D:\Wordspace\oversea\ChatMandarin\landing`。

发布前检查 CTA 必须指向 `https://app.chatmandarin.cc`，且未开放的能力不能写成“已经上线”。

```powershell
Set-Location D:\Wordspace\oversea\ChatMandarin\landing
npx wrangler pages deploy . --project-name chatmandarin
```

`ADMIN_TOKEN` 必须保存在 Cloudflare Pages 加密环境变量中。Waitlist KV 绑定名为 `WAITLIST`，namespace ID 为 `80aa104c85614d269b6236b1f693d5a1`。

## 11. 回滚

### Voice Worker 回滚

```powershell
npx wrangler versions list --name chatmandarin-voice
npx wrangler rollback --name chatmandarin-voice <VERSION_ID>
```

紧急绕过网关：在 Vercel 把 `VOLCENGINE_ROUTE` 改为 `direct`，然后重新部署 Production。

### Vercel 回滚

```powershell
npx vercel rollback
```

也可以在 Vercel Dashboard 的 Deployments 中选择上一稳定部署并 Promote to Production。

### Landing 回滚

在 Cloudflare Pages 的 Deployments 中选择上一成功版本执行 Rollback。

## 12. 正式迁移主应用到 Cloudflare Workers（第二阶段）

当前生产应用仍在 Vercel。不要在未验证 Supabase Service Role、Auth 回调和支付 Webhook 前直接把 `app.chatmandarin.cc` 切到 Cloudflare Worker。

迁移步骤：

1. 创建 `chatmandarin-app` staging Worker。
2. 使用 `wrangler secret put` 写入全部服务端密钥。
3. 配置非敏感变量和 `NEXT_PUBLIC_APP_URL`。
4. `npm run build:cloudflare` 后部署 staging。
5. 完整验证登录、数据库、语音、支付。
6. 给 Worker 添加自定义域名或 Route。
7. 再切换 `app.chatmandarin.cc`。
8. Vercel 保留至少一个回滚周期。

Cloudflare 主应用迁移不是 Voice Worker 上线的前置条件。

## 13. 上线后监控

```powershell
npx wrangler tail chatmandarin-voice --format json
npx wrangler deployments list --name chatmandarin-voice
npx vercel inspect https://app.chatmandarin.cc
```

重点关注：

- Voice Worker 5xx、上游超时、ASR WebSocket 关闭。
- TTS/ASR p95 突然上升。
- Vercel Function 错误率。
- Supabase Auth 和 RLS 拒绝。
- 日志中不得出现 API Key、共享密钥、完整音频或不必要的个人信息。
