# ChatMandarin 总待办清单

> 你要处理的所有事项，按优先级排序。
> 每完成一项打 [x]。

---

## 🔴 P0：不配就无法运行（必做）

### 1. Supabase 数据库
- [ ] 运行 SQL 迁移
  - 打开 https://supabase.com/dashboard → 项目 xobfnmwaxlswfofmembv → SQL Editor
  - 粘贴 `app/supabase/migrations/001_init.sql` → Run
  - 验证：`SELECT count(*) FROM scenarios;` → 应返回 5

- [ ] 确认 Service Role Key 已填入 `.env.local`
  - Dashboard → Settings → API → `service_role` → 复制
  - 填入 `SUPABASE_SERVICE_ROLE_KEY=...`

- [ ] 配置 URL Configuration
  - Dashboard → Authentication → URL Configuration
  - Site URL: `http://localhost:3000`（开发）→ 上线后改 `https://app.chatmandarin.cc`
  - Redirect URLs: 加 `http://localhost:3000/auth/callback` + `https://app.chatmandarin.cc/auth/callback`

### 2. DeepSeek API
- [ ] 注册 + 充值
  - https://platform.deepseek.com → 注册 → 充值 $10
  - API Keys → Create → 复制
- [ ] 填入 `.env.local`：
  ```
  DEEPSEEK_API_KEY=sk-xxxxxxxxxxxxx
  ```

### 3. 火山引擎语音
- [ ] 开通 5 个产品
  - https://console.volcengine.com → 语音技术
  - 开通：流式 ASR、一句话 ASR、录音文件 ASR、豆包 TTS、标准 TTS
- [ ] 创建应用 → 拿到 App ID + Access Token
- [ ] 填入 `.env.local`：
  ```
  VOLCENGINE_APP_ID=你的appid
  VOLCENGINE_ACCESS_TOKEN=你的token
  ```

### 4. 本地测试
- [ ] `npm run dev`
- [ ] 注册账号 → 登录
- [ ] 点击对话场景 → 录音说话 → 收到 AI 回复 + 评分

---

## 🟡 P1：上线前必做（但不影响本地开发）

### 5. Cloudflare 部署
- [ ] 创建 GitHub 仓库 `chatmandarin-app`
- [ ] 推送代码到 GitHub
- [ ] Cloudflare Pages → Create → Connect to Git → 选仓库
- [ ] 配置 Build（Next.js preset）
- [ ] 添加所有环境变量（Cloudflare Pages → Settings → Environment variables）
- [ ] 绑定 `app.chatmandarin.cc` 子域

### 6. Landing Page 链接更新
- [ ] 把 `landing/index.html` 中所有 CTA 链接改为 `app.chatmandarin.cc`
  - `/login` → `https://app.chatmandarin.cc/login`
  - `/signup` → `https://app.chatmandarin.cc/signup`
- [ ] Waitlist API 改为 `https://app.chatmandarin.cc/api/waitlist`
- [ ] 重新部署 Landing Page（Cloudflare Pages）

### 7. Lemon Squeezy（支付）
- [ ] 注册 https://app.lemonsqueezy.com（护照）
- [ ] 创建 Store → 记录 Store ID
- [ ] 创建产品：
  - ChatMandarin Plus：$14.99/月 → 记录 Variant ID
  - ChatMandarin Pro：$29/月 → 记录 Variant ID
- [ ] 创建 Webhook：
  - URL: `https://app.chatmandarin.cc/api/lemonsqueezy/webhook`
  - Events: 全选
  - 记录 Signing Secret
- [ ] 填入 `.env.local` + Cloudflare 环境变量：
  ```
  LEMONSQUEEZY_API_KEY=...
  LEMONSQUEEZY_WEBHOOK_SECRET=...
  LEMONSQUEEZY_STORE_ID=...
  LEMONSQUEEZY_PLUS_VARIANT_ID=...
  LEMONSQUEEZY_PRO_VARIANT_ID=...
  ```

### 8. Cloudflare KV
- [ ] Dashboard → Workers & Pages → KV → Create namespace `KV`
- [ ] 记录 ID → 填入 `wrangler.toml`

---

## 🟢 P2：上线后 1 周内做

### 9. Resend（邮件）
- [ ] 注册 https://resend.com
- [ ] 验证域名 chatmandarin.cc
- [ ] 拿 API Key
- [ ] 填入环境变量

### 10. OAuth Provider 正式配置
- [ ] Google Cloud Console → OAuth Client → Redirect URI 加 `app.chatmandarin.cc`
- [ ] GitHub → OAuth App → 同上
- [ ] Facebook → App → 同上 + 提交 App Review（Live mode）
- [ ] X Developer → App → 同上

### 11. Sentry（错误监控）
- [ ] 注册 https://sentry.io
- [ ] 创建 Next.js 项目 → 拿 DSN
- [ ] 填入 `SENTRY_DSN=`

---

## 🔵 P3：后续优化

### 12. 代码修复（我还没做的）
- [ ] 忘记密码流程（/forgot-password 页面 + API）
- [ ] 取消订阅功能（API + UI）
- [ ] Dashboard 真实平均分计算
- [ ] AI 动态开场白（替换硬编码）
- [ ] HSKK Q&A 题目 TTS 播放
- [ ] HSK 词汇后处理过滤（如果 V1 准确率不够）

### 13. 产品功能扩展
- [ ] 历史模考记录页
- [ ] 对话历史页
- [ ] 更多场景（增加到 10-15 个）
- [ ] 社交功能（好友、排行榜）
- [ ] 老师仪表盘（B2B）
- [ ] 移动端 PWA 优化

### 14. Landing Page 合并
- [ ] 把 Landing Page HTML 转为 Next.js 组件
- [ ] 统一到 `chatmandarin.cc`（去掉子域）

---

## 环境变量完整清单

把以下所有变量配到 Cloudflare Pages → Settings → Environment variables：

```
# Supabase（必填）
NEXT_PUBLIC_SUPABASE_URL=https://xobfnmwaxlswfofmembv.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_vwfguEHXurRnWtGu2V6Wwg_Nvitxbrk
SUPABASE_SERVICE_ROLE_KEY=（从 Dashboard 复制）

# DeepSeek（必填）
DEEPSEEK_API_KEY=（从 DeepSeek 复制）

# 火山引擎（必填）
VOLCENGINE_APP_ID=（从火山引擎复制）
VOLCENGINE_ACCESS_TOKEN=（同上）

# Lemon Squeezy（上线前必填）
LEMONSQUEEZY_API_KEY=
LEMONSQUEEZY_WEBHOOK_SECRET=
LEMONSQUEEZY_STORE_ID=
LEMONSQUEEZY_PLUS_VARIANT_ID=
LEMONSQUEEZY_PRO_VARIANT_ID=

# App 配置
NEXT_PUBLIC_APP_URL=https://app.chatmandarin.cc
NEXT_PUBLIC_APP_NAME=ChatMandarin
ADMIN_TOKEN=随机字符串

# 可选
RESEND_API_KEY=
RESEND_FROM_EMAIL=hello@chatmandarin.cc
SENTRY_DSN=
```

---

## 你现在应该做的（按顺序）

1. **跑 SQL 迁移**（5 分钟）→ 确认数据库就绪
2. **配 DeepSeek + 火山引擎 Key**（10 分钟）→ 对话功能可测试
3. **`npm run dev` 测试对话**（5 分钟）→ 确认核心功能
4. **推送 GitHub + 部署 Cloudflare**（30 分钟）→ 线上可访问
5. **配 Lemon Squeezy**（15 分钟）→ 支付可测试
6. **更新 Landing Page 链接**（10 分钟）→ 完整闭环
