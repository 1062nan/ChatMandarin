# Indie Hackers 第一篇深度文章

> 完整可发布版本，直接 copy-paste
> 发布时间：Week 1 末（建议周日下午，欧美时间早上）
> 长度：约 1500 字
> 目的：建立行业专家形象 + 长期 SEO 流量

---

## 标题

```
I'm a Chinese developer building for the West — here's why I chose HSK learners (and how I validated the market)
```

## 标签（IH 上选）

- `#buildinpublic`
- `#saas`
- `#ai`
- `#education`
- `#china`

---

## 正文（Markdown）

```
Hi IH 👋

I'm a Chinese developer, and I'm building an AI Chinese tutor called ChatMandarin — specifically for HSK learners worldwide.

This post is the "why" + market research + my MVP plan. I'd love your feedback.

---

## The origin story

3 years ago, an American friend asked me to help him learn Mandarin. He had been studying for 6 months. Could pass HSK 3 on paper. But when he visited Beijing, he froze trying to order noodles.

"I can read textbooks. I cannot talk to people."

I tried every Chinese learning app I could find to help him. **None of them solved the actual problem: speaking practice with real-time feedback.**

That gap stuck with me. Now, in 2026, AI is finally good enough to solve it.

---

## The market data (and the gap)

I spent 4 weeks researching before writing code. Here's what I found:

### Market size
- **50M+ people** learning Chinese globally (Hanban/CLEC estimates)
- **Cumulative 100M HSK test takers** since 1992
- **Online language learning market**: $20-30B globally
- **Chinese is the #8 language** on Duolingo in 2024 (up from #9)

### Competitor analysis (with real data)

| Product | Users | Notes |
|---------|-------|-------|
| **HelloChinese** | 500K Play Store downloads | Top Chinese-specific app, but small |
| **Duolingo (all languages)** | 500M+ downloads, $7.48亿 ARR (2024) | Chinese is #8, but shallow |
| **Speak** (Korean AI tutor) | $1B valuation, $78M Series C | Proved AI conversation works for Asian languages |
| **HelloTalk** | 70M registered | Language exchange, not AI tutor |
| **ChinesePod** | 4000+ lessons | Old school, declining |

### The gap

**No one is doing AI conversation practice specifically for HSK learners.**

- HelloChinese: traditional course-style, weak AI
- Duolingo: too shallow, no speaking depth
- Speak: only Korean/Spanish/English/Japanese — **no Chinese yet**
- HSKK (oral exam): **zero dedicated tools**

---

## Why this gap exists

I think there are 3 reasons:

1. **Chinese is hard to do well**
   - Tones require precise feedback (not just STT)
   - Vocabulary is hierarchical (HSK levels)
   - Cultural context matters a lot

2. **The market looks small from outside**
   - 50M Chinese learners vs 1.5B English learners
   - Most Western founders don't notice it
   - But: 500K downloads for HelloChinese shows huge room to grow

3. **The technology just got cheap enough**
   - LLMs became affordable for Chinese (DeepSeek = 1/30 GPT-4 cost)
   - Volcengine brought native-grade Mandarin ASR (same engine as Douyin)
   - Volcengine Doubao TTS made Chinese voice output indistinguishable from real
   - 2 years ago, this was impossible at $14.99/mo

---

## My advantages as a Chinese developer

This is the part I want to be honest about.

**Unfair advantages:**
- **Native Chinese speaker** — I know what's natural vs textbook-stiff
- **DeepSeek API access** — 30x cheaper than GPT-4, optimized for Chinese
- **Volcengine ASR/TTS** — same voice engine that powers Douyin (14亿 users), native-grade Mandarin
- **Cultural context** — I know the difference between "你好吗?" (textbook) and "最近忙啥呢" (real)

**Disadvantages I'm working on:**
- English writing (I'm using Claude to polish, full transparency)
- Western design sense (hiring a freelance designer on Dribbble)
- Marketing/distribution (this is my first time building for global market)

---

## The MVP plan (8 weeks)

I'm shipping a focused MVP by [Month Year]:

### Core features (P0)
1. **HSK-graded AI conversation** — vocab strictly limited to user's HSK level
2. **Real-time feedback** — tone/grammar/word choice/fluency (4 dimensions)
3. **5 real-life scenarios** — restaurant, taxi, doctor, etc.

### Differentiators (P1)
4. **HSKK oral exam mock test** — full simulation with AI scoring
5. **Mistake journal with spaced repetition**

### Tech stack
- **DeepSeek V3** (LLM) — $0.14/1M tokens
- **Volcengine streaming ASR** (STT) — native Mandarin, Douyin-grade
- **Volcengine Doubao TTS** (TTS) — natural Mandarin voices
- **Next.js 14 + Supabase + Cloudflare** (web + edge)

**Unit economics:**
- Cost per conversation: ~$0.01
- Price: $14.99/month
- Average user: 60 conversations/month
- Cost: $0.60/month → gross margin **96%**

---

## What I've done in week 1

I'm building in public, so here's the unfiltered reality:

✅ Domain secured (chatmandarin.cc)
✅ Tech stack decided
✅ DeepSeek + Volcengine ASR/TTS integration tested
✅ X account: 47 followers after 1 week
✅ Waitlist: 3 signups (3 real humans, not friends/family)
✅ ~800 lines of code

❌ No beautiful UI yet
❌ No HSKK mock test yet
❌ MRR: $0

---

## What I need from you

I'd love feedback on:

1. **Market thesis** — am I crazy, or is this real?
2. **Pricing** — $14.99/mo feels right. Agree?
3. **MVP scope** — should I cut HSKK mock test for V1?
4. **Go-to-market** — YouTube KOL collaborations or paid ads first?

If you're learning Chinese or know someone who is, I'd love to chat.
Waitlist link in comments (don't want to spam the post).

I'll post monthly updates here on IH.

Thanks for reading 🙏

---

**Build in public:** Follow along on X — [@ChatMandarin](https://x.com/ChatMandarin)

**Edit:** Some have asked about my numbers. Sources:
- Duolingo ARR: Wikipedia 2024 financial data
- Speak valuation: TechCrunch Dec 2024
- HelloChinese downloads: Play Store
- HSK cumulative: China Ministry of Education
- 50M learners: China Institute (2008), probably higher now
```

---

## 发布后 24 小时操作

1. **回复每条评论**（IH 算法看重作者参与）
2. **不要直接发产品链接**（除非有人问）
3. **更新原始帖子**：加 "Edit: 链接来了" 在底部
4. **同步到 X**：发推 "Just published on Indie Hackers: [link]"

---

## 后续每月更新

每月在 IH 发一篇 "ChatMandarin Month X Report"，结构：

```
Month X Report 📊

Numbers:
- MRR: $X
- Users: X
- CAC: $X
- Churn: X%

What worked: ...
What didn't: ...
Next month goals: ...

[详细内容]
```

**这是建立长期 SEO + 社群信任的关键**。
