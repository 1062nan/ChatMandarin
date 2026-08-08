# ChatMandarin Week 2–3：X / Reddit 发布内容包

> 状态基线：以下内容只使用 2026-07-18 本地代码审计确认过的事实。当前构建与类型检查通过；真实 AI、语音、支付和 beta 仍需生产密钥与用户验收，所以文案不写“已上线”“已有用户”或虚构指标。

## 发布原则

- 创始人身份透明，不伪装普通用户或“满意客户”。
- 不买互动、不互赞、不刷 Karma、不批量私信、不跨社区复制粘贴同一正文。
- X 不重复发近似内容，不用无关热门标签导流，不在评论区贴无关产品链接。
- Reddit 每次发布前重新阅读目标社区侧栏规则；社区规则高于本文件。
- `r/ChineseLanguage` 仅在 mods 明确批准后发布产品相关内容；未批准时只做真实、无产品植入的社区参与。
- 链接只在页面可用、隐私条款正确、表单验证完成后添加。

## 7 天 X 内容

### Day 1 — 真实进展

【受众】混合  
【渠道】X 单条  
【发布时间建议】2026-07-20 21:00（中国时间）  
【审计要点】不带链接；所有功能均已在代码中确认，但没有宣称生产验收完成。

```text
Week 2–3 update on ChatMandarin:

✅ HSK-graded voice conversations
✅ AI opening + spoken replies
✅ 4-part feedback
✅ Mistake journal with spaced repetition
✅ HSKK mock flow

The build passes. Live API and beta testing are next. Still $0 MRR.
```

配图建议：Dashboard 或 conversation 页面截图。截图前隐藏邮箱、项目 ID、密钥和浏览器书签。

### Day 2 — 构建现实

【受众】开发者  
【渠道】X 单条  
【发布时间建议】2026-07-21 08:30（中国时间）  
【审计要点】真实复盘，不公布漏洞利用细节。

```text
I was ready to add features. A dependency audit found a critical security advisory instead.

So I paused the roadmap, upgraded Next.js, restored linting, and rebuilt.

Shipping is not just adding features. Sometimes progress is removing launch risk.
```

### Day 3 — 学习者痛点

【受众】学习者  
【渠道】X 单条  
【发布时间建议】2026-07-22 21:00（中国时间）  
【审计要点】零引擎名、零夸张效果承诺。

```text
Many Chinese learners do not need another vocabulary list.

They need a safe place to speak, make mistakes, hear a natural reply, and try again.

That is the loop I am building for ChatMandarin:

speak → feedback → retry → remember
```

### Day 4 — Voice AI 工程复盘

【受众】开发者  
【渠道】X 单条  
【发布时间建议】2026-07-23 08:30（中国时间）  
【审计要点】只讲已解决或已实现的工程环节。

```text
One hard lesson from building voice AI: the model is only one step.

Mic permissions, silent audio, short recordings, retries, JSON recovery, quotas, and saving progress decide whether the tutor feels reliable.

The plumbing is the product.
```

### Day 5 — 用户研究问题

【受众】学习者  
【渠道】X 单条  
【发布时间建议】2026-07-24 21:00（中国时间）  
【审计要点】不诱导点赞或转发；回复用于产品研究。

```text
If you are learning Mandarin, which part blocks you most?

1. Starting a real conversation
2. Tones and pronunciation
3. Finding natural words
4. Preparing for HSKK

Reply with the number + your HSK level. Your answers will shape beta testing.
```

### Day 6 — 小型 Thread：为什么还不宣布上线

【受众】混合  
【渠道】X Thread（4 条）  
【发布时间建议】2026-07-25 21:00（中国时间）  
【审计要点】每条单独发布；不加链接；不承诺 beta 日期。

```text
1/4

ChatMandarin has enough screens to look “finished.” It is not ready to call finished.

The honest status: the core learning loop is implemented, but production credentials, real-device voice tests, and beta feedback still need to happen.
```

```text
2/4

What exists today:

• HSK-graded conversations
• spoken AI replies
• pronunciation, grammar, word-choice, and fluency feedback
• mistake review
• HSKK mock-test flow
```

```text
3/4

What I am validating before beta:

• microphone behavior across browsers
• real API latency and failure recovery
• database migrations and quotas
• whether feedback is actually useful to learners
```

```text
4/4

The temptation is to announce early and fix everything in public.

For a voice-learning product, one broken first conversation can lose trust immediately.

I would rather share the real checklist than pretend the launch is done.
```

### Day 7 — 周复盘

【受众】开发者  
【渠道】X 单条  
【发布时间建议】2026-07-26 21:00（中国时间）  
【审计要点】发布时把括号内结果替换为真实数据；没有数据就删除该行。

```text
This week on ChatMandarin:

• upgraded the framework after a security audit
• made conversation completion idempotent
• restored CI-ready linting
Next gate: real API + device testing.

No vanity metrics yet. Just fewer launch risks.
```

## Reddit：r/SideProject 可发布稿

【受众】开发者 / 独立开发者  
【渠道】Reddit `r/SideProject`  
【发布时间建议】2026-07-22 20:30（中国时间）  
【审计要点】发布当天再次查看社区规则；正文主动披露“我是开发者”；先不放链接，除非规则允许且 landing page 已验收。

标题：

```text
I built the core of an AI Mandarin speaking tutor, then a security audit changed my definition of “done”
```

正文：

```text
I’m the solo developer of ChatMandarin, a web app for HSK learners who can study Chinese but still freeze when they need to speak.

Over the last few weeks I implemented the core loop:

- HSK-graded voice conversations
- AI-generated openings and spoken replies
- feedback on pronunciation, grammar, word choice, and fluency
- a mistake journal with spaced repetition
- an HSKK mock-test flow

The production build passed, so I was tempted to call the MVP ready.

Then I ran a dependency audit. It found a critical advisory in the old framework version. I stopped feature work, upgraded the framework, restored a non-interactive lint check, rebuilt the app, and fixed a separate bug that could count the same completed conversation more than once.

The app now builds and type-checks cleanly, but I am not calling it launched yet. The remaining gate is real API and device testing: microphone permissions, silent recordings, latency, database migrations, quotas, and failure recovery.

I would value feedback from other builders on two questions:

1. What is your minimum launch gate for a voice AI product?
2. Would you recruit a small beta before adding analytics, or add basic error monitoring first?

Happy to share architecture details. I will add the demo only if the community rules allow it and people ask for it.
```

发布后互动：只回答问题；有人明确要 demo 时再回复链接。不要私信未主动询问的人。

## Reddit：r/ChineseLanguage 先发给 mods 的申请

【受众】社区管理员  
【渠道】Reddit Modmail  
【发布时间建议】任何产品帖之前 3–7 天  
【审计要点】这不是发帖许可；只有收到明确同意后才使用下一节草稿。

```text
Subject: Permission to request feedback on an HSK speaking-practice beta

Hi mods,

I’m a native Mandarin-speaking developer building a small web beta for HSK learners to practice speaking and receive structured feedback.

I want to respect this community’s current self-promotion rules. Would you allow one clearly disclosed feedback/recruitment post with no affiliate links, no discount claims, and no repeated promotion?

The post would explain what is already implemented, state that I am the builder, ask for a small number of testers, and offer free beta access in exchange for honest feedback.

I’m happy to send the exact draft for review or follow a designated thread/day. If this is not appropriate, I will not post it.

Thank you.
```

## Reddit：仅在 mods 明确批准后使用的学习者招募稿

【受众】HSK / HSKK 学习者  
【渠道】Reddit `r/ChineseLanguage`（仅限书面批准后）  
【发布时间建议】按 mods 指定时间  
【审计要点】把批准日期和 beta 实际条件补全；零引擎名；不编造名额紧迫感。

标题：

```text
Looking for honest feedback on an HSK speaking-practice beta (mod approved)
```

正文：

```text
Hi everyone — I’m the developer of ChatMandarin, and the mods approved this post on [date].

I’m building it for a problem I have seen among Chinese learners: reading and vocabulary practice are easy to find, but low-pressure speaking practice is not.

The current web beta includes:

- conversations adjusted to an HSK level
- spoken replies
- feedback on pronunciation, grammar, word choice, and fluency
- a mistake journal for later review
- an HSKK mock-test flow

I am looking for [real number] learners to test the core conversation flow on their own browser and microphone. This is still a beta, so I especially want to hear what feels confusing, inaccurate, slow, or unhelpful.

Beta access is free during the test. There is no requirement to post a review or say anything positive.

If you are interested, please reply with your HSK level and the browser/device you use. I will share access details only after the beta environment passes final checks.
```

## 发布前最终检查

- [ ] 生产页面能正常打开，隐私政策与联系方式真实。
- [ ] 没有把“代码已实现”写成“线上已稳定运行”。
- [ ] 没有虚构用户、等待名单、收入、延迟、成本、下载量或转化率。
- [ ] 所有截图已去除邮箱、密钥、项目 ID 和私人标签页。
- [ ] 目标 subreddit 当天规则允许该内容，必要时已有 mods 明确批准。
- [ ] 同一 Reddit 正文没有复制到多个社区。
- [ ] X 内容没有批量重复、无关标签、无关回复导流或诱导互动。
- [ ] 发布后由本人真实回答评论，不使用批量自动回复。
