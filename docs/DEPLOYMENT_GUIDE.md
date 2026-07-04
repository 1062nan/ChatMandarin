# ChatMandarin 部署方案

## 架构总览

```
chatmandarin.cc（Cloudflare Pages 项目 #1）
  └── 静态 Landing Page（已部署，HTML）
       └── CTA 按钮 → app.chatmandarin.cc

app.chatmandarin.cc（Cloudflare Pages 项目 #2）
  └── Next.js App（待部署）
       ├── /login, /signup（公开）
       ├── /dashboard, /conversation/*, /hskk/* （需登录）
       └── /api/* （API 路由）
```

**两个 Cloudflare Pages 项目，一个域名**：
- 根域 `chatmandarin.cc` → Landing Page（吸引 + Waitlist）
- 子域 `app.chatmandarin.cc` → Next.js App（产品功能）

---

## Step 1：部署 Next.js App 到 Cloudflare Pages

### 1.1 创建新 Pages 项目

```bash
cd D:/Wordspace/oversea/ChatMandarin/app
npm run build
```

### 1.2 通过 GitHub 部署（推荐）

1. 创建 GitHub 仓库：`chatmandarin-app`（私有）
2. 推送代码：
   ```bash
   git init
   git add .
   git commit -m "Initial: ChatMandarin App"
   git remote add origin git@github.com:你的用户名/chatmandarin-app.git
   git push -u origin main
   ```

3. Cloudflare Dashboard → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**
4. 选择 `chatmandarin-app` 仓库
5. 配置：
   - Framework preset: **Next.js**
   - Build command: `npm run build`
   - Build output directory: `.next`
   - Node version: 18

6. **Environment Variables**（在 Cloudflare Pages → Settings → Environment variables）：
   逐条添加 `.env.local` 中的所有变量（除 `NODE_ENV`）

7. 点 **Save and Deploy**

### 1.3 绑定子域名

1. Cloudflare Pages 项目 → **Custom domains** → **Set up**
2. 输入：`app.chatmandarin.cc`
3. Cloudflare DNS 自动添加 CNAME 记录
4. 等 1-5 分钟激活

---

## Step 2：更新 Landing Page 的链接

Landing Page 中的所有 `/login`、`/signup`、`/dashboard` 链接需要改为 `app.chatmandarin.cc/...`。

### 需要修改的文件
`D:/Wordspace/oversea/ChatMandarin/landing/index.html`

### 需要替换的 URL
```
/login        → https://app.chatmandarin.cc/login
/signup       → https://app.chatmandarin.cc/signup
/dashboard    → https://app.chatmandarin.cc/dashboard
```

### Waitlist 表单 API
```
原：/api/waitlist（同域相对路径）
改：https://app.chatmandarin.cc/api/waitlist（跨域到 App）
```

### 操作
重新部署 Landing Page（Cloudflare Pages → 项目 #1 → Deploy）

---

## Step 3：配置 Supabase Auth Redirect URLs

Supabase Dashboard → Authentication → URL Configuration：

**Site URL**：
```
https://app.chatmandarin.cc
```

**Redirect URLs**（全部加上）：
```
http://localhost:3000/auth/callback
https://app.chatmandarin.cc/auth/callback
https://chatmandarin.cc/auth/callback  （备用，如果未来合并）
```

---

## Step 4：配置 OAuth Provider Callback URLs

每个 OAuth Provider 的回调 URL 改为：

```
https://xobfnmwaxlswfofmembv.supabase.co/auth/v1/callback
```

（这个不变——Supabase 内部回调，与 App URL 无关）

但 Supabase 内部的 redirect 配置会指向 `app.chatmandarin.cc/auth/callback`。

---

## Step 5：未来合并（可选，Phase 2）

当产品验证成功后，可以把 Landing Page 合并进 Next.js App：

1. 将 Landing Page HTML 转为 React 组件
2. 部署到 `chatmandarin.cc`（替换静态项目）
3. 子域 `app.chatmandarin.cc` 301 重定向到 `chatmandarin.cc`
4. 统一为一个项目

**Phase 2 再做**，现在先用双项目方案。

---

## 本地开发 URL

| 环境 | URL | 用途 |
|------|-----|------|
| Landing Page | `https://chatmandarin.cc` | 已上线（Cloudflare Pages） |
| App（本地） | `http://localhost:3000` | 开发 |
| App（线上） | `https://app.chatmandarin.cc` | 部署后 |

Landing Page 的 Waitlist API 在本地开发时：
```
http://localhost:3000/api/waitlist  ← App 本地
```

---

## 检查清单

部署前确认：
- [ ] Next.js App 能 `npm run build` 无报错
- [ ] 所有环境变量已配到 Cloudflare Pages
- [ ] Supabase Auth redirect URLs 含 `app.chatmandarin.cc`
- [ ] Landing Page 的链接已改为 `app.chatmandarin.cc`
- [ ] Cloudflare DNS 的 `app` CNAME 指向 Pages 项目
- [ ] HTTPS 证书自动签发（Cloudflare 自动处理）

部署后验证：
- [ ] `https://app.chatmandarin.cc/login` 能打开
- [ ] 注册/登录功能正常
- [ ] 从 Landing Page 点击 CTA 跳转到 App
- [ ] Waitlist 表单跨域提交成功（CORS 配置）
