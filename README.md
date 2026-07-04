# ChatMandarin App

AI Chinese tutor for HSK learners. PWA Web App built with Next.js 14 + Cloudflare + Supabase.

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
- Enable **Google** (add your OAuth credentials)
- Enable **GitHub** (add your OAuth credentials)
- Set **Site URL**: `http://localhost:3000` (dev) or `https://chatmandarin.cc` (prod)
- Add **Redirect URLs**: `http://localhost:3000/auth/callback`, `https://chatmandarin.cc/auth/callback`

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

### 7. Deploy to Cloudflare

```bash
npm run build
npx wrangler pages deploy .next --project-name=chatmandarin
```

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
├── wrangler.toml               # Cloudflare config
├── package.json
└── README.md
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (App Router) |
| UI | Tailwind CSS + shadcn/ui |
| Auth | Supabase Auth (Email + Google + GitHub) |
| Database | Supabase Postgres |
| Edge Compute | Cloudflare Workers |
| Hosting | Cloudflare Pages |
| AI (LLM) | DeepSeek V3 |
| AI (STT) | Volcengine ASR |
| AI (TTS) | Volcengine TTS |
| Payment | Lemon Squeezy |
| Email | Resend |

## Development Status

- [x] **Week 1**: Project scaffolding + Auth + UI skeleton
- [ ] **Week 2**: AI conversation core (DeepSeek + Volcengine)
- [ ] **Week 3**: Feedback system + Mistake journal
- [ ] **Week 4**: HSKK mock test + Scenario library
- [ ] **Week 5**: Payment + Subscription
- [ ] **Week 6**: Beta testing + Optimization

## License

Proprietary. © 2026 ChatMandarin.
