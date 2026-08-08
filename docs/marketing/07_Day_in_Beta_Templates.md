# Day in Beta 系列推文模板（每天一条）

> 用法：Beta 期间每天发 1 条，展示真实用户故事 + 数据
> 目的：让 X 粉丝看到产品在被真实使用 + 建立信任

---

## Day in Beta 系列：核心原则

### 1. 真实
- 真实用户（化名）
- 真实数据（不要美化）
- 真实问题（包括 bug）

### 2. 具体数字
- ❌ "Many users tried it"
- ✅ "12 users completed 47 conversations today"

### 3. 故事化
- 每条都是一个"主角"（匿名用户）+ 一个洞察
- 不要罗列数据

### 4. 不出 PII（个人身份信息）

---

## 推文模板（14 天，可循环）

### Day 1 in Beta：第一位用户

```
🎉 Beta Day 1.

Our first tester just logged in.

User: "Sarah" (US, HSK 3)
Goal: Prep for HSK 4 exam in October

First conversation: Restaurant ordering
Result: 5 turns, 2 tone errors caught
Her feedback: "The teacher mode is brutal but I learned
more in 3 minutes than 3 months on Duolingo."

Goal: 10 more beta users by end of week.

#buildinpublic #Mandarin #HSK
```

### Day 2 in Beta：意外发现

```
👀 Beta Day 2. Surprising insight.

Expected problem: AI too slow
Actual problem: Users too polite

3/5 testers said "你好" too many times (textbook reflex).
Real Chinese speakers say "你好" once, then move on.

The AI now subtly discourages repetitive greetings:
User: "你好你好你好"
AI: "你好！咱们开始吧，你最近怎么样？"

Subtle correction > explicit correction.

#buildinpublic #UX #Mandarin
```

### Day 3 in Beta：数据公布

```
📊 Beta Day 3. Numbers so far:

- 8 active beta users (of 12 invited)
- 47 conversations completed
- Avg conversations/user: 6.5
- Most popular scenario: "Restaurant" (47%)
- Least popular: "Doctor visit" (3%)
- Tone accuracy avg: 73% (HSK 3 users)

Bugs found: 4 (1 P0, 1 P1, 2 P2)
- P0 fixed in 2 hours
- P1 fixed in 1 day

NPS so far: 9/10 (small sample, but promising).

#buildinpublic #SaaS
```

### Day 4 in Beta：用户原话

```
💬 Beta Day 4. Real tester quote.

"Mike" (Germany, HSK 5):
"I've been studying Chinese for 3 years. Passed HSK 5
last month. But when my Chinese colleague asked me
'你最近忙吗?' I froze.

ChatMandarin is the first tool that forces me to
actually SPEAK. 30 minutes here = more speaking
practice than 3 months of textbook."

This is exactly why I built this. 🙏

#buildinpublic #Mandarin
```

### Day 5 in Beta：修复一个 bug 的故事

```
🐛 Beta Day 5. Bug story.

Bug: ASR mistranscribed "shì" (是) as "shì" (事)
in context where it should be (是).

Root cause: Short sentences lack context, tone disambiguation fails.

Fix: Added context-aware disambiguation
- LLM gets full conversation context
- Returns most likely interpretation
- 3-hour fix, massive quality improvement

This is what real building looks like.

#buildinpublic #AI #Mandarin
```

### Day 6 in Beta：周末回顾

```
📈 Beta Week 1 done.

Numbers:
- 12 beta users onboarded
- 89 conversations completed
- Avg user retention: 6/7 days
- Bug fixes shipped: 9
- New features added: 2 (based on feedback)

What I learned:
1. The HSKK mock test is the killer feature (most requested)
2. Mobile UI needs work (60% of users on phones)
3. Users want MORE brutal correction mode (not less!)
4. Chinese learner community is incredibly supportive

Week 2 goal: scale to 30 users + ship HSKK mock test.

#buildinpublic
```

### Day 7 in Beta：场景对比

```
📊 Beta Day 7. Scenario popularity:

1. Restaurant ordering: 32% ⭐
2. Taxi conversation: 21%
3. Self introduction: 18%
4. Shopping: 14%
5. Doctor visit: 8% (low — too advanced vocab)
6. Job interview: 7% (only HSK 5-6 users)

Insight: Beginner scenarios win.
Will add: "Asking directions" + "Small talk with neighbors"
next week.

What scenario would YOU want to practice?

#buildinpublic #Mandarin
```

### Day 8 in Beta：HSKK 模考上线

```
🎉 Beta Day 8. HSKK Mock Test is LIVE.

The most-requested feature is finally in beta.

What it does:
- Full HSKK exam simulation
- 3 sections: read aloud, Q&A, picture description
- Strict timing (no retries)
- AI scores on 5 dimensions
- Generates score report

First user just completed it:
"Tom" (US, HSK 4)
- Pronunciation: 78
- Fluency: 65
- Grammar: 82
- Vocabulary: 80
- Content: 75
- Total: 76/100 (predicted HSKK intermediate pass)

He said: "I've never had this kind of feedback. Eye-opening."

#buildinpublic #HSK #Mandarin
```

### Day 9 in Beta：付费转化第一单

```
💰 Beta Day 9. First paying customer.

"Yuki" (Japan, HSK 5) just upgraded to paid plan:
$14.99/month, annual plan ($99).

Her reason: "I've been studying for HSK 5 for 6 months.
ChatMandarin is the only thing that helped me actually
SPEAK. The HSKK mock test alone is worth the price."

MRR: $8.25 (annual divided by 12)
Not life-changing money. But first real dollar = validation.

#buildinpublic #SaaS #MRR
```

### Day 10 in Beta：用户地理分布

```
🌍 Beta Day 10. Where users are from:

1. 🇺🇸 USA: 35%
2. 🇰🇷 Korea: 22%
3. 🇯🇵 Japan: 15%
4. 🇩🇪 Germany: 8%
5. 🇬🇧 UK: 7%
6. 🇻🇳 Vietnam: 5%
7. 🇹🇭 Thailand: 4%
8. Others: 4%

Surprise: Korea + Japan = 37% of users.
Confirms my thesis: East Asian learners want
HSK speaking practice the most.

Marketing implication: localize for Korean + Japanese
in V2.

#buildinpublic #Mandarin
```

### Day 11 in Beta：最难修的 bug

```
😅 Beta Day 11. The hardest bug yet.

Issue: AI sometimes repeats the same correction
in every reply, frustrating users.

Example:
User says "我吃饭北京" (wrong word order).
AI: "我在北京吃饭了。你呢？"
User replies.
AI again: "Just a reminder: '在北京吃饭' not '吃饭北京'"

Why it happened:
- Mistake was added to "memory"
- Prompt told AI to reinforce past mistakes
- But didn't limit frequency

Fix: Limit reminders to 1 per session per mistake type.

Sometimes the AI is too helpful.

#buildinpublic #AI
```

### Day 12 in Beta：用户分群洞察

```
📊 Beta Day 12. User segmentation insight.

Power users (5+ conversations/day): 25%
Casual users (1-2 conv/day): 50%
Inactive (0 conv in 3 days): 25%

Power users share a trait:
All are prepping for specific HSK exam dates.

Casual users: general interest, no deadline.

Insight: Market harder to people with HSK exam deadlines.
Update ads targeting: "HSK exam in 3 months? Try this."

#buildinpublic #SaaS #marketing
```

### Day 13 in Beta：用户建议投票

```
🗳️ Beta Day 13. Feature request tally:

1. Mobile app (native): 14 votes ⭐
2. More HSK levels (4-6 support): 11 votes
3. Voice message to real teacher: 7 votes
4. Group conversation practice: 5 votes
5. Grammar video explanations: 3 votes

Mobile app wins clearly. Building React Native version
starting next week.

Other features: V2 roadmap.

What would YOU vote for?
[Reply with your priority]

#buildinpublic #Mandarin
```

### Day 14 in Beta：里程碑总结

```
🎉 Beta Week 2 complete. 2 weeks in.

Numbers:
- 27 active beta users
- 312 conversations completed
- 8 paying customers (29.6% conversion!)
- MRR: $99 (annualized $1,188)
- NPS: 8.7/10

Top 3 lessons:
1. HSKK mock test is THE killer feature
2. Mobile is critical (60% of usage)
3. "Native Chinese developer" is a marketing asset

What's next:
- Ship mobile app (4 weeks)
- Add HSK 4-6 support (2 weeks)
- Prep Product Hunt launch (4 weeks)

Thank you beta testers. You're amazing. 🙏

#buildinpublic #milestone
```

---

## 通用模板公式

每条 Day in Beta 推文都遵循：

```
[表情] Beta Day X. [Hook].

[Story/Data/Insight - 3-5 sentences]

[Optional: quote / number / specific detail]

[Optional: question to engage]

[1-2 hashtags]
```

### Hook 类型
- 数字："Beta Day 5. 47 conversations done."
- 故事："Beta Day 7. Sarah's feedback made my day."
- 问题："Beta Day 10. Why are Korean users loving this?"
- 洞察："Beta Day 12. Surprising insight from data."
- 庆祝："Beta Day 14. Milestone reached."

### 避免的 Hook
- "Another day in beta..."（无聊）
- "Today was hard..."（消极）
- "Beta update:"（无信息量）

---

## 高级技巧

### 1. 截图 > 文字
如果可能，配：
- 真实对话截图（脱敏）
- 数据仪表盘截图
- 反馈邮件截图（征得同意）

### 2. 视频 > 截图
5-15 秒短视频展示功能 / bug / 用户反应。

### 3. 引用真实用户原话
- 增加 authentic 感
- 用户感觉到被重视
- 比"users say..."可信

### 4. 自嘲 / 真实失败
- "Bug cost me 4 hours"
- "Most hated feature yesterday"
- "I made a mistake, here's the fix"

**真实 > 完美**。
