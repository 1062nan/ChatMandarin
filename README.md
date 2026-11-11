# ChatMandarin

AI 中文对话辅导，针对 HSK 1-6 学习者。本仓库是 monorepo，包含产品代码、静态 landing page、营销/策略/产品文档。

## 仓库结构

```
ChatMandarin/
├── app/                  # Next.js 15 应用（Vercel + Supabase + Cloudflare Worker）
│   ├── app/              # Next.js App Router
│   ├── components/  lib/  public/  supabase/  workers/
│   ├── package.json
│   └── README.md         # app 本地启动详见此文档
├── landing/              # 静态 landing page（Cloudflare Pages）
│   ├── public/            # 仅此目录作为公开静态资源
│   ├── functions/        # Cloudflare Pages Functions（waitlist 等）
│   └── wrangler.toml
├── docs/
│   ├── marketing/        # 营销启动：行动清单、X 模板、IH 长文、Waitlist/Beta/PH 手册
│   ├── strategy/         # 策略文档：商标、内容策略框架、内容日历（Week 1 / Week 2-3）
│   └── product/          # 产品设计：技术架构、功能设计、V2 配音设计
├── .claude/
│   └── skills/chatmandarin-content/   # 内容生成 skill
└── .gitignore
```

## 快速开始

### 运行 Next.js 应用

```bash
cd app
npm install
cp .env.example .env.local   # 填入密钥
npm run dev
```

详见 [`app/README.md`](./app/README.md)。

### 运行 landing page

```bash
cd landing
npx wrangler pages dev public
```

### 官网 API 回归检查

```bash
node --test tests/landing-api.test.mjs
```

Cloudflare Pages 的 Root directory 为 `landing`，输出目录由 `landing/wrangler.toml` 指定为 `public`。Functions 保留在 `landing/functions`，配置、测试和源码不放入公开资源目录。

### 文档协作

- 营销/内容：从 `docs/marketing/00_Action_Checklist.md` 开始
- 内容策略：`docs/strategy/12_Content_Strategy_Framework.md`
- 技术背景：`docs/product/09_Tech_Architecture_and_Product_Design.md`

## 协作流程

1. 主分支：`main`（受保护）
2. 功能分支命名：`feat/<short-desc>`、`docs/<short-desc>`、`fix/<short-desc>`
3. PR 前自测：`cd app && npm run build && npm run lint`
4. 提交信息遵循 [Conventional Commits](https://www.conventionalcommits.org/)：`feat:` / `fix:` / `docs:` / `chore:` / `refactor:`

## 技术栈速览

- **LLM**: DeepSeek V3
- **STT/TTS**: Volcengine streaming ASR + Doubao TTS（经 Cloudflare Worker voice gateway 代理）
- **Frontend**: Next.js 15 + Tailwind + shadcn/ui
- **Backend**: Cloudflare Workers + Durable Objects
- **DB/Auth**: Supabase Postgres + Supabase Auth
- **Storage**: Cloudflare R2 + KV
- **Payments**: Creem（MoR）
- **Email**: Resend

完整架构和单位经济见 [`docs/product/09_Tech_Architecture_and_Product_Design.md`](./docs/product/09_Tech_Architecture_and_Product_Design.md)。
