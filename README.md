# ChatMandarin App

AI Chinese tutor for HSK learners. The Next.js 15 application runs on Vercel,
with Supabase for authentication/data and a Cloudflare Worker voice gateway for
Volcengine ASR/TTS traffic.

## Quick Start

### 1. Install dependencies

```bash
cd D:/Wordspace/oversea/ChatMandarin/app
npm install
```

### 2. Configure environment

Copy `.env.example` to `.env.local` and fill in values:

```bash
cp .env.example .env.local
# Edit .env.local with your keys
```

Required keys:
- `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase anon key
- `SUPABASE_SERVICE_ROLE_KEY` — Supabase service role key (server only)

### 3. Run database migration

**Option A**: Use Supabase Dashboard SQL Editor
1. Go to https://supabase.com/dashboard → your project → SQL Editor
2. Copy contents of `supabase/migrations/001_init.sql`
3. Paste → Run

**Option B**: Use Supabase CLI
```bash
npx supabase db push
```

### 4. Configure Supabase Auth

In Supabase Dashboard → Authentication → Providers:
- Enable **Email** (with passwords)
- Keep OAuth providers disabled unless their production credentials and callback URLs have been configured and tested
- Set **Site URL**: `http://localhost:3000` (dev) or `https://app.chatmandarin.cc` (prod)
- Add **Redirect URLs**: `http://localhost:3000/auth/callback`, `https://app.chatmandarin.cc/auth/callback`

### 5. Copy static assets

Copy the logo/favicon from the landing page:
```bash
cp ../landing/logo.svg public/
cp ../landing/favicon.svg public/
cp ../landing/apple-touch-icon.svg public/
cp ../landing/og-image.svg public/
```

### 6. Run dev server

```bash
npm run dev
```

Open http://localhost:3000

### 7. Deploy the application to Vercel

```bash
npm run type-check
npm run lint
npm run build
npx vercel --prod --yes
```

The production application is served at `https://app.chatmandarin.cc`. The
separate static landing page is served by Cloudflare Pages at
`https://chatmandarin.cc`. The Cloudflare/OpenNext scripts remain available for
preview and portability checks; they are not the current primary app deployment
path.

## Project Structure

```
app/
├── app/                        # Next.js App Router
│   ├── (app)/                  # Authenticated app
│   │   ├── dashboard/          # Home page
│   │   ├── conversation/       # AI conversation practice
│   │   ├── hskk/               # HSKK mock test
│   │   ├── mistakes/           # Mistake journal
│   │   ├── settings/           # User settings
│   │   └── layout.tsx          # App layout (auth guard + navbar)
│   ├── (marketing)/            # Public pages
│   ├── login/                  # Login page
│   ├── signup/                 # Signup page
│   ├── auth/callback/          # OAuth callback handler
│   ├── api/                    # API routes
│   ├── layout.tsx              # Root layout
│   └── globals.css             # Global styles
├── components/                 # React components
│   ├── ui/                     # shadcn/ui primitives
│   ├── auth/                   # Auth forms
│   ├── layout/                 # Navbar, etc.
│   └── settings/               # Settings components
├── lib/                        # Utilities
│   ├── supabase/               # Supabase clients (client/server/middleware)
│   ├── db/                     # Database types + queries
│   └── utils/                  # Helpers
├── public/                     # Static assets
├── supabase/                   # Database migrations
├── .env.example                # Environment template
├── open-next.config.ts         # OpenNext adapter config
├── wrangler.jsonc              # Cloudflare Workers config
├── package.json
└── README.md
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15 (App Router) |
| UI | Tailwind CSS + shadcn/ui |
| Auth | Supabase Auth (Email/password; OAuth only when explicitly configured) |
| Database | Supabase Postgres |
| Application Hosting | Vercel |
| Landing Hosting | Cloudflare Pages |
| Voice Gateway | Cloudflare Workers |
| AI (LLM) | DeepSeek V3 |
| AI (STT) | Volcengine ASR |
| AI (TTS) | Volcengine TTS |
| Payment | Creem (Merchant of Record) |
| Support Email | Cloudflare Email Routing |

## Development Status

- [x] **Week 1**: Project scaffolding + Auth + UI skeleton
- [x] **Week 2 (implementation)**: AI conversation core, ASR/TTS integration, audio diagnostics
- [x] **Week 3 (implementation)**: Four-dimension feedback + mistake journal + spaced repetition
- [x] **Week 4 (implementation)**: HSKK mock flow + learning path + scenario content
- [x] **Week 5 (implementation)**: Checkout, webhook, cancellation, plans, and quota tracking
- [x] **Week 6**: Production credentials, migrations, voice gateway, Live payments, public compliance pages, and launch hardening

Production status verified on 2026-08-08: the landing page, login, signup,
Privacy Policy, and Terms pages return HTTP 200. Creem Live products, production
checkout creation, and the signed webhook path were validated on 2026-07-31.
TypeScript and production builds pass; ESLint has no errors (legacy warnings
remain).

## Operations Documentation

- [Production deployment runbook](docs/PRODUCTION_DEPLOYMENT_RUNBOOK_ZH.md)
- [Creem payment setup](docs/CREEM_PAYMENT_SETUP_ZH.md)
- [Production promotion plan](docs/PRODUCTION_PROMOTION_PLAN_ZH.md)

## License

Proprietary. © 2026 ChatMandarin.
