# ChatMandarin 配置清单（你需要在各平台做的事）

> 每完成一项打 ✅。有问题随时问我。

---

## ✅ 已完成

- [x] Supabase 项目创建
- [x] Supabase Auth → Email（关闭邮箱验证）
- [x] Supabase Auth → Google 开启
- [x] Supabase Auth → GitHub 开启
- [x] Supabase Auth → Facebook 开启
- [x] Supabase Auth → X/Twitter OAuth 2.0 开启
- [x] Next.js 项目搭建 + npm install
- [x] Logo + Favicon

---

## ⬜ 待完成

### 1. Supabase 数据库迁移

**操作**：
1. 打开 https://supabase.com/dashboard → 项目 xobfnmwaxlswfofmembv
2. **SQL Editor** → New query
3. 打开文件：`D:/Wordspace/oversea/ChatMandarin/app/supabase/migrations/001_init.sql`
4. 全选复制 → 粘贴到 SQL Editor → **Run**
5. 验证：`SELECT count(*) FROM scenarios;` → 应返回 5

**如果之前跑失败过**，先跑清理 SQL：
```sql
DROP TABLE IF EXISTS conversation_turns CASCADE;
DROP TABLE IF EXISTS conversations CASCADE;
DROP TABLE IF EXISTS mistakes CASCADE;
DROP TABLE IF EXISTS hskk_tests CASCADE;
DROP TABLE IF EXISTS usage_stats CASCADE;
DROP TABLE IF EXISTS subscriptions CASCADE;
DROP TABLE IF EXISTS scenarios CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;
DROP FUNCTION IF EXISTS handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;
```

---

### 2. Supabase URL Configuration

**Dashboard → Authentication → URL Configuration**

**Site URL**（开发期）：
```
http://localhost:3000
```

**Redirect URLs**（点 "Add URL" 逐条加）：
```
http://localhost:3000/auth/callback
https://chatmandarin.cc/auth/callback
```

**生产上线时改为**：
```
Site URL: https://chatmandarin.cc
```

---

### 3. Supabase Service Role Key

**Dashboard → Settings → API → Project API keys**

找到 `service_role`（secret，不是 publishable）→ 复制

填入 `D:/Wordspace/oversea/ChatMandarin/app/.env.local`：
```
SUPABASE_SERVICE_ROLE_KEY=你复制的 service_role key
```

---

### 4. Google OAuth 配置

**Supabase Dashboard → Authentication → Providers → Google**

记录下 Supabase 给你的 **Callback URL (for OAuth)**：
```
https://xobfnmwaxlswfofmembv.supabase.co/auth/v1/callback
```

**去 Google Cloud Console 配置**：
1. 打开 https://console.cloud.google.com
2. 创建项目（或用现有的）
3. **APIs & Services** → **OAuth consent screen**
   - User Type: External
   - App name: ChatMandarin
   - User support email: 你的邮箱
   - Developer contact: 你的邮箱
   - Authorized domains: `chatmandarin.cc`、`xobfnmwaxlswfofmembv.supabase.co`
   - 其他填基本信息 → Save
4. **APIs & Services** → **Credentials** → **Create Credentials** → **OAuth client ID**
   - Application type: Web application
   - Name: ChatMandarin Web
   - **Authorized redirect URIs**：填入
     ```
     https://xobfnmwaxlswfofmembv.supabase.co/auth/v1/callback
     ```
5. 创建后拿到 **Client ID** + **Client Secret**
6. 回到 Supabase Dashboard → Google provider → 填入 Client ID + Secret → Save

---

### 5. GitHub OAuth 配置

**Supabase Dashboard → Authentication → Providers → GitHub**

Callback URL（Supabase 提供）：
```
https://xobfnmwaxlswfofmembv.supabase.co/auth/v1/callback
```

**去 GitHub 配置**：
1. 打开 https://github.com/settings/developers
2. **OAuth Apps** → **New OAuth App**
3. 填写：
   - Application name: ChatMandarin
   - Homepage URL: `https://chatmandarin.cc`
   - Authorization callback URL: `https://xobfnmwaxlswfofmembv.supabase.co/auth/v1/callback`
4. 创建后拿 **Client ID**
5. **Generate a new client secret** → 复制
6. 回到 Supabase → GitHub provider → 填入 → Save

---

### 6. Facebook OAuth 配置

**Supabase Dashboard → Authentication → Providers → Facebook**

Callback URL：
```
https://xobfnmwaxlswfofmembv.supabase.co/auth/v1/callback
```

**去 Facebook Developers 配置**：
1. 打开 https://developers.facebook.com
2. **My Apps** → **Create App** → 类型选 "Consumer"
3. App name: ChatMandarin
4. **Add Product** → **Facebook Login** → Set up
5. **Settings** → **Basic**：
   - App Domains: `chatmandarin.cc`
   - Privacy Policy URL: `https://chatmandarin.cc/privacy`（先填占位）
   - **Save changes**
6. **Facebook Login** → **Settings**：
   - Valid OAuth Redirect URIs: `https://xobfnmwaxlswfofmembv.supabase.co/auth/v1/callback`
   - **Save**
7. 拿到 **App ID** + **App Secret**
8. 回到 Supabase → Facebook provider → 填入 → Save
9. **重要**：Facebook App 默认是 "Development mode"（只有测试用户能用）。上线前要提交 "App Review" 切换到 "Live mode"。

---

### 7. X (Twitter) OAuth 2.0 配置

**Supabase Dashboard → Authentication → Providers → X (Twitter OAuth 2.0)**

Callback URL：
```
https://xobfnmwaxlswfofmembv.supabase.co/auth/v1/callback
```

**去 X Developer Portal 配置**：
1. 打开 https://developer.x.com
2. 创建项目 + App
3. **App settings** → **User authentication settings** → **Edit**
4. 开启 **OAuth 2.0**
5. App type: **Web App**
6. Callback URI / Redirect URL:
   ```
   https://xobfnmwaxlswfofmembv.supabase.co/auth/v1/callback
   ```
7. Website URL: `https://chatmandarin.cc`
8. OAuth 2.0 Type: **Web App**
9. Request email from users: ✅ 开启
10. 保存后拿 **Client ID** + **Client Secret**
11. 回到 Supabase → twitter provider → 填入 → Save

---

### 8. 火山引擎语音（5 个产品）

**操作**：
1. 登录 https://console.volcengine.com
2. **语音技术** → 分别开通：
   - [ ] 流式语音识别
   - [ ] 一句话识别
   - [ ] 录音文件识别
   - [ ] 语音合成大模型（豆包）
   - [ ] 标准版语音合成
3. 创建应用 → 拿到：
   - `App ID`
   - `Access Token`
4. **密钥管理** → 创建 Access Key → 拿到：
   - `Access Key ID`
   - `Secret Access Key`

填入 `.env.local`：
```
VOLCENGINE_APP_ID=你的 App ID
VOLCENGINE_ACCESS_TOKEN=你的 Access Token
VOLCENGINE_ACCESS_KEY=你的 AK
VOLCENGINE_SECRET_KEY=你的 SK
```

---

### 9. DeepSeek API

**操作**：
1. 打开 https://platform.deepseek.com
2. 注册 + 充值（$10 起步够测试）
3. **API Keys** → Create → 复制

填入 `.env.local`：
```
DEEPSEEK_API_KEY=你的 key
```

---

### 10. Lemon Squeezy（支付）

**操作**：
1. 打开 https://app.lemonsqueezy.com
2. 注册（用护照）
3. **Settings** → **API** → 创建 API Key
4. **Stores** → 记录 Store ID
5. **Products** → 创建 2 个产品：
   - ChatMandarin Plus：$14.99/月
   - ChatMandarin Pro：$29/月
6. 每个 Product 创建 Variant → 记录 Variant ID
7. **Webhooks** → 创建：
   - URL: `https://chatmandarin.cc/api/lemonsqueezy/webhook`
   - Events: 全选
   - 记录 Signing Secret

填入 `.env.local`：
```
LEMONSQUEEZY_API_KEY=你的 key
LEMONSQUEEZY_WEBHOOK_SECRET=你的 signing secret
LEMONSQUEEZY_STORE_ID=你的 store id
LEMONSQUEEZY_PLUS_VARIANT_ID=plus 的 variant id
LEMONSQUEEZY_PRO_VARIANT_ID=pro 的 variant id
```

---

### 11. Resend（邮件）

**操作**：
1. 打开 https://resend.com
2. 注册
3. **API Keys** → Create → 复制
4. （可选）验证域名 chatmandarin.cc 以解锁自定义发件人

填入 `.env.local`：
```
RESEND_API_KEY=你的 key
RESEND_FROM_EMAIL=hello@chatmandarin.cc
```

---

### 12. Cloudflare KV（缓存/限流）

**操作**：
1. Cloudflare Dashboard → **Workers & Pages** → **KV**
2. Create namespace → 名称：`KV`
3. 记录 namespace ID

填入 `wrangler.toml`：
```toml
[[kv_namespaces]]
binding = "KV"
id = "你的 namespace ID"
```

---

### 13. Cloudflare R2（音频存储）

**操作**：
1. Cloudflare Dashboard → **R2**
2. Create bucket → 名称：`chatmandarin-audio`
3. （可选）绑定自定义域名 `cdn.chatmandarin.cc`

wrangler.toml 已配好，无需额外修改。

---

## 配置完成验证

全部配完后，`.env.local` 应该包含：

```
NEXT_PUBLIC_SUPABASE_URL=https://xobfnmwaxlswfofmembv.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_vwfguEHXurRnWtGu2V6Wwg_Nvitxbrk
SUPABASE_SERVICE_ROLE_KEY=（从 Dashboard 复制）
DEEPSEEK_API_KEY=（从 DeepSeek 复制）
VOLCENGINE_APP_ID=（从火山引擎复制）
VOLCENGINE_ACCESS_TOKEN=（同上）
VOLCENGINE_ACCESS_KEY=（同上）
VOLCENGINE_SECRET_KEY=（同上）
LEMONSQUEEZY_API_KEY=（从 Lemon Squeezy 复制）
LEMONSQUEEZY_WEBHOOK_SECRET=（同上）
LEMONSQUEEZY_STORE_ID=（同上）
LEMONSQUEEZY_PLUS_VARIANT_ID=（同上）
LEMONSQUEEZY_PRO_VARIANT_ID=（同上）
RESEND_API_KEY=（从 Resend 复制）
RESEND_FROM_EMAIL=hello@chatmandarin.cc
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_APP_NAME=ChatMandarin
ADMIN_TOKEN=随机字符串
```

---

## 优先级

**Week 1 完成必须配的**（不配项目跑不起来）：
- ✅ Supabase（URL + Anon Key）→ 已配
- ⬜ Supabase Service Role Key
- ⬜ SQL 迁移
- ⬜ Supabase URL Configuration（Redirect URLs）

**Week 2 开发前必须配的**：
- ⬜ DeepSeek API Key
- ⬜ 火山引擎 4 个值

**Week 5 开发前必须配的**：
- ⬜ Lemon Squeezy

**生产上线前必须配的**：
- ⬜ Cloudflare KV / R2
- ⬜ Resend
- ⬜ 所有 OAuth provider 的正式 Redirect URLs
- ⬜ Supabase Site URL 改为 `https://chatmandarin.cc`
