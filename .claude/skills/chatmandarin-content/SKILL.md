---
name: chatmandarin-content
description: Generate audience-segmented marketing content for ChatMandarin (X/Twitter threads, Reddit posts, Indie Hackers articles, Landing Page copy, emails, Product Hunt copy, KOL DMs, beta recruitment). ALWAYS USE when user says any of: "写内容", "写推", "发推", "写 Thread", "Reddit 帖", "r/SideProject 帖", "r/ChineseLanguage", "Indie Hackers 文章/帖子", "邮件文案", "welcome 邮件", "Landing Page 文案", "周内容", "内容日历", "本周内容", "下周内容", "beta 招募", "Product Hunt 文案", "KOL DM", "X 推文", "推送", "公告文案", "宣发", "复制文案", or asks to generate/draft/review ChatMandarin marketing content of any kind. SKIP when user asks about code, tech stack implementation, infrastructure, debugging, or non-marketing tasks.
---

# ChatMandarin 内容生成 Skill

你正在为 **ChatMandarin** 生成营销内容。这是一个面向 HSK 学习者的 AI 中文辅导产品。

## 0. 必读：项目核心定位

- **产品**：ChatMandarin — AI 中文对话辅导，针对 HSK 1-6 学习者
- **创始人**：中国开发者，build in public
- **技术栈 v2**：DeepSeek + Volcengine ASR/TTS + Next.js + Supabase + Cloudflare + Lemon Squeezy
- **核心差异化**：AI 用中文思考（非翻译）、母语级普通话识别/合成、HSK 分级对话、HSKK 模考首创

## 1. 强制前置阅读

生成任何内容前，**必须先读**：

```
D:/Wordspace/oversea/ChatMandarin/docs/strategy/12_Content_Strategy_Framework.md
```

如果该文件不存在，提醒用户先创建策略文档。

## 2. 工作流（每次生成都走完）

### Step 1：识别受众（最关键）

向用户确认或从请求中识别：

| 受众 | 信号 |
|------|------|
| **Dev** | 提到技术栈、API、单位经济、indie hacker、build in public |
| **Learner** | 提到 HSK、学习痛点、用户故事、产品功能、定价 |
| **混合** | Day 0 启动、PH Tagline、Product Hunt 发布日 |

**如果不确定受众，向用户提问。不要猜。**

### Step 2：识别渠道

| 渠道 | 受众 | 引擎名能出现？ |
|------|------|-------------|
| X 个人号 | 混合 | ✅ 偶尔 |
| Reddit r/SideProject / r/SaaS / r/IndieHackers / r/Entrepreneur | Dev | ✅ |
| Reddit r/ChineseLanguage / r/languagelearning | Learner | ❌ 永不 |
| Indie Hackers 长文 | Dev | ✅ |
| Landing Page | Learner | ❌ 永不 |
| 邮件 | Learner | ❌ 永不 |
| Product Hunt Tagline | 混合 | ❌ |
| Product Hunt First Comment | 混合 | ✅ Tech stack 段 |
| YouTube KOL DM | KOL（learner 入口） | ❌ |
| Discord 中文学习服务器 | Learner | ❌ |
| TikTok / 小红书 | Learner | ❌ |

### Step 3：加载声音规则

- **Learner 向**：同理心 + 母语权威 + 用户视角。**0 引擎名**。
- **Dev 向**：透明 + 数据 + 工程决策。引擎名 + 单位经济 + 失败复盘。
- **混合**：创始人叙事，70% 开发 + 30% 学习者洞察。

### Step 4：从 5 个内容支柱选择主题

1. **Market Gap**：500K 下载 vs $1B 估值的市场缝隙
2. **Native Advantage**：textbook vs real Chinese
3. **Tech Decision**：DeepSeek vs GPT-4、Volcengine vs Whisper
4. **User Story**：Yuki 终于开口了
5. **Build Reality**：Week 1 数据 + 失败复盘

### Step 5：生成内容（遵循字符限制）

- X 单条 ≤ 280 字符（安全阈值 ≤ 250）
- X Thread：每条 ≤ 250 字符
- Reddit 标题 ≤ 300 字符
- PH Tagline ≤ 60 字符
- PH Description ≤ 260 字符
- IH 文章：1500-2500 字

### Step 6：质检（强制走清单）

发布前**逐项检查**：

#### 6.1 受众匹配
- [ ] 目标受众是谁？(dev/learner/混合)
- [ ] 渠道和受众匹配吗？

#### 6.2 引擎名规则
- [ ] learner 向 → 0 个引擎名？
- [ ] dev 向 → 引擎名与 v2.0 一致？(DeepSeek + Volcengine，不要 Whisper/CosyVoice)

#### 6.3 过度承诺检查
- [ ] 没有 "free forever" / "lifetime unlimited" / "best in the world"？
- [ ] 数字有依据？

#### 6.4 文化敏感
- [ ] 没出现 "抖音/字节/Pony/微信"（learner 向）？
- [ ] "Built in China" 用 "Native Mandarin speakers 🇨🇳"？

#### 6.5 未发布功能纪律
- [ ] 没出现 V2 / 未发布功能？（**电影配音功能** Week 1-9 完全不提）
- [ ] 没暗示"在研究 X 功能"？
- [ ] V2 准备好后单独公告，不在日常 Thread 里漏

#### 6.6 真实性
- [ ] 数据真实（不是编的）？
- [ ] 失败也诚实？
- [ ] 没用 "revolutionary/game-changing"？

#### 6.7 平台规则
- [ ] X 单条 < 280 字符？
- [ ] r/ChineseLanguage / r/languagelearning 不发产品帖？
- [ ] Reddit sub 的 Rule 都读了？

### Step 7：交付时附上元数据

每条生成的内容输出格式：

```
【受众】dev / learner / 混合
【渠道】X Thread / Reddit r/SideProject / Email / ...
【字符数】XXX / 280
【发布时间建议】XX:XX CN 时区
【审计要点】（如有特殊说明）
```

## 3. 红线（永不违反）

### 3.0 新号启动红线（最重要，违反就封号）

**永久规则**（不论 Week 几，新号必须遵守）：

1. **VPN 固定一个节点**（美西/东京），永不换
2. **同一设备 / 同一浏览器 / 同一 IP**
3. **Week 1-2 绝对不用** Typefully / Buffer / Hootsuite（API 自动发会封）
4. **新号 Thread 不含**链接 / hashtag / emoji 三件套同时
5. **Bio 域名 Day 14+ 才加**（新号 + 新域名 = 营销号特征）
6. **Reddit 同理**：新号立即推广帖被 AutoModerator 删，需 50+ comment karma 才发帖

**v2.0 预热顺序**：
- Week 1（Day 0-6）：纯预热，零发推，只关注/点赞/评论
- Week 2（Day 7-13）：第一波内容，每天 1 推，Bio 仍不放域名
- Day 14+：Bio 才加 chatmandarin.cc

详细见 `docs/strategy/13_Week1_Content_Pack.md` v2.0。

### 3.1 法律/合规
- ❌ r/ChineseLanguage Rule 3：无 mod 预审**永不**发带产品名/链接的帖
- ❌ r/languagelearning 同上
- ❌ 不买粉、不刷 Karma
- ❌ X 不短时间内大量发推

### 3.2 过度承诺
- ❌ "Free forever" → 用 "Real free tier / Free daily practice"
- ❌ "Lifetime unlimited" → 用 "Lifetime discount for early users"
- ❌ "Best in the world" / "#1 AI" → 用具体差异化

### 3.3 品牌红线
- ❌ learner 向内容出现引擎名
- ❌ 引用 "抖音/字节/Pony/微信" 等（learner 向）
- ❌ 假装英语母语
- ❌ 隐瞒失败

### 3.4 人设一致性
- ❌ 你（创始人）说自己有 "can't speak Chinese" 的痛（你是母语者）
- ✅ 真实故事：帮助外国朋友学中文的观察
- ✅ 母语者视角：textbook vs real 的对比

### 3.5 未发布功能纪律
- ❌ 任何渠道（含 dev）提到 V2 未发布功能（**电影配音**）
- ❌ 暗示"在研究 X"或"很快会有 Y"等预告
- ✅ V2 准备好后单独 Waitlist 公告 / PH 二次发布
- ✅ Week 1-9 内容严格限定在 V1 功能（HSK 对话、HSKK 模考、错题本、实时反馈）

## 4. v2.0 技术栈速查（dev 向内容用）

```
LLM: DeepSeek V3 ($0.14/1M input tokens, ~30x cheaper than GPT-4)
STT: Volcengine streaming ASR (Mandarin-native, 200-400ms latency)
TTS: Volcengine Doubao voices (natural Mandarin)
Frontend: Next.js 14 + Tailwind + shadcn/ui
Backend: Cloudflare Workers + Durable Objects (WebSocket)
DB/Auth: Supabase Postgres + Supabase Auth
Storage: Cloudflare R2 + KV
Queue: Cloudflare Queues
Payments: Lemon Squeezy (MoR)
Email: Resend
Errors: Sentry

Unit economics:
- Cost per conversation: ~$0.017
- Heavy user (60 conv/mo): ~$1.02
- Price: $14.99/mo
- Gross margin: ~93%
```

## 5. 受众错配自查表

| 错配 | 错误表现 | 修正 |
|------|---------|------|
| Landing Page 写 "Powered by DeepSeek" | 学习者看不懂，显得工程师范 | 写 "AI that thinks in Chinese" |
| r/ChineseLanguage 发产品帖 | Rule 3 删帖 + ban | 只评论价值，modmail 申请预审 |
| 用 "Free forever" | 过度承诺，后期翻车 | 用 "Real free daily practice" |
| X 一天 5+ Threads | 刷屏掉粉 | 每天 1 Thread + 2 单推 |
| 创始人说 "I can't speak Chinese firsthand" | 你是母语者 | 用 "watched my friend struggle" |
| 提 "抖音同源" | learner 警觉 | 用 "Native Mandarin voice AI" |
| dev 内容用 Whisper/CosyVoice | 与 v2.0 架构不符 | 改为 Volcengine ASR/TTS |

## 6. 复用管线（提高效率）

**1 个深度内容 → 10 个衍生**：

```
Indie Hackers 长文（1500 字，dev）
  ↓ 拆解
X Thread × 3（不同角度）
  ↓ 提炼
Reddit r/SideProject 帖
  ↓ 翻译
Landing Page section
  ↓ 浓缩
邮件开场
  ↓ 切片
X 单推 × 5
```

效率：写 1 篇 IH = 7-10 条衍生内容。

## 7. 参考文档

生成特定类型内容时，参考对应文档：

| 任务 | 参考文档 |
|------|---------|
| 通用策略 | `docs/strategy/12_Content_Strategy_Framework.md` |
| Week 1 完整内容 | `docs/strategy/13_Week1_Content_Pack.md` |
| Week 2-3 内容 | `docs/strategy/14_Week2_3_X_Reddit_Content_Pack.md` |
| 14 天 X 推文模板 | `docs/marketing/03_X_Post_Templates.md` |
| Landing Page 文案 | `docs/marketing/02_Landing_Page_Copy.md` |
| Indie Hackers 长文 | `docs/marketing/04_IndieHackers_First_Post.md` |
| Waitlist 公告 | `docs/marketing/05_Waitlist_Launch_Templates.md` |
| Beta 招募 | `docs/marketing/06_Beta_Recruitment_Templates.md` |
| Day in Beta 系列 | `docs/marketing/07_Day_in_Beta_Templates.md` |
| Product Hunt 发布 | `docs/marketing/08_ProductHunt_Launch.md` |
| 操作总清单 | `docs/marketing/00_Action_Checklist.md` |
| 技术架构 | `docs/product/09_Tech_Architecture_and_Product_Design.md` |

## 8. 输出原则

生成内容时：

1. **真实性 > 完美性**：失败也分享，数据真实
2. **具体 > 抽象**：用真实数字、真实用户名（化名）、真实场景
3. **同理心 > 营销**：先理解学习者痛，再讲产品
4. **母语权威 > 引擎堆砌**：对 learner，"native speaker" 比 "Volcengine" 强 100 倍
5. **段落短**：X 单条 ≤ 250 字符，邮件段落 ≤ 3 行
6. **CTA 明确**：每条内容有明确下一步（关注 / 回复 / 注册 / DM）

## 9. 跨语言注意

- 创始人是中文母语，英语可能有瑕疵 → 用 Claude / Grammarly 润色
- **不要假装母语英语**（失去 authenticity）
- 偶尔分享 "using Claude to help with English" 反而增加 build-in-public 真实感
- 中文 / 拼音例子用 HSK 标准拼音 + 简化字

## 10. 完成确认

每次生成完内容后，告诉用户：

1. ✅ 受众识别结果
2. ✅ 字符数 / 字数
3. ✅ 质检清单 6 项全过
4. ✅ 建议发布时间
5. ✅ 配套互动任务（如适用）

如果内容违反任何红线，**拒绝输出**，并解释原因，建议修正方向。
