# ChatMandarin 内容策略框架（v1.0）

> 这是一份**长期生效**的内容策略文档。所有 X / Reddit / Indie Hackers / 邮件 / Landing Page 内容必须符合此文档。
> Skill `chatmandarin-content` 在生成新内容时会引用本文件。

---

# Part 1：核心哲学

## 1.1 黄金法则

**一份内容打天下 = 50% 市场流失。**

ChatMandarin 有两个不可调和的受众，必须分别对待：

```
开发者受众              HSK 学习者受众
   │                       │
   ├─ 不付费（基本）        ├─ 付费（$14.99/月）
   ├─ 但会转发/分享        ├─ 但不会传播
   ├─ 给技术反馈           ├─ 给钱
   ├─ 写 KOL 关心的话题     ├─ 是 YouTube KOL 的粉丝
   │                       │
   └─→ 你的"扩音器"         └─→ 你的"钱包"
```

**开发者给你 reach，学习者给你 revenue。**

## 1.2 真实的分流是 content-to-context mapping

不是开两个账号。solo founder 一个个人号打天下，靠的是：
- **按渠道分流**（每个 sub / 每个平台天然过滤受众）
- **按内容类型分流**（X 上 70% dev + 30% learner 内容混合发布）
- **按漏斗位置分流**（顶层 reach 用 dev 内容，底层转化用 learner 内容）

---

# Part 2：受众画像

## 2.1 开发者画像（Developer Persona）

**是谁**：
- Indie hacker / SaaS founder / AI 从业者
- 关注 X 上的 #buildinpublic、#IndieHackers、#100DaysOfCode
- 混 r/SideProject、r/SaaS、r/IndieHackers
- 看 Indie Hackers、Hacker News

**信任信号**：
| 信号 | 例子 |
|------|------|
| 单位经济 | "$0.017/对话 → 93% 毛利" |
| 技术选型理由 | "DeepSeek 比 GPT-4 便宜 30 倍" |
| 失败复盘 | "ASR bug 让我修了 4 小时" |
| 真实数据 | "47 followers, 3 waitlist, 0 MRR" |
| 工程师范 | 看得见的代码、架构图、终端截图 |

**反感信号**：
- ❌ 营销话术（"革命性 AI 产品"）
- ❌ 完美无瑕的"成功故事"
- ❌ 不透明（"AI 驱动的中文辅导"——是 GPT 套壳吗？）

## 2.2 学习者画像（Learner Persona）

**是谁**：
- 全球 50M+ 中文学习者，HSK 1-6 各等级
- 集中在美、韩、日、德、英、越南、泰国
- 混 r/ChineseLanguage、r/languagelearning
- 看 YouTube 中文教学频道
- 用 Duolingo / HelloChinese / Pleco / Skritter

**信任信号**：
| 信号 | 例子 |
|------|------|
| 母语权威 | "Native Mandarin speakers 🇨🇳" |
| 真实场景 | " Textbook 说 你好吗，真人在北京说 最近忙啥呢" |
| 用户故事 | "Yuki（日本，HSK 5）终于能开口了" |
| 同理心 | "3 years ago I watched my friend freeze 试图点面条" |
| 简单承诺 | "Real free daily practice" |

**反感信号**：
- ❌ 引擎名（DeepSeek / Volcengine / Whisper）
- ❌ 工程师范（"$0.017/对话 → 96% 毛利"）
- ❌ 中国 app 联想（"抖音同源"对部分学习者反而是警觉）
- ❌ 永久免费/终身便宜之类的过度承诺

---

# Part 3：渠道-受众矩阵

| 渠道 | 主受众 | 你的声音 | 引擎名能出现？ |
|------|-------|---------|-------------|
| **X 个人号** | 混合（偏 dev） | 创始人叙事 70/30 | ✅ 偶尔出现 |
| **Reddit r/SideProject** | 纯 dev | Indie hacker 语气 | ✅ |
| **Reddit r/SaaS** | 纯 dev/founder | 商业分析语气 | ✅ |
| **Reddit r/IndieHackers** | 纯 dev | Build-in-public 语气 | ✅ |
| **Reddit r/Entrepreneur** | 纯 dev/founder | 创业者语气 | ✅ |
| **Reddit r/ChineseLanguage** | 纯 learner | 学习者同伴语气 | ❌ **永不** |
| **Reddit r/languagelearning** | 纯 learner | 学习者同伴语气 | ❌ **永不** |
| **Indie Hackers 长文** | 纯 dev | 创始人深度复盘 | ✅ |
| **Landing Page** | 纯 learner | 用户视角，零技术词 | ❌ **永不** |
| **邮件列表** | 纯 learner | 用户视角 | ❌ **永不** |
| **Product Hunt Tagline** | 混合（偏 dev） | 学习者视角短句 | ❌ |
| **Product Hunt First Comment** | 混合 | 主体学习者向 + 技术段开发者向 | ✅ 在"Tech stack"段 |
| **YouTube KOL DM** | KOL（learner 入口） | 创始人真诚 + 用户故事 | ❌ |
| **Discord 中文学习服务器** | 纯 learner | 同伴语气 | ❌ |
| **TikTok / 小红书** | 纯 learner | 短视频教学 | ❌ |

---

# Part 4：声音规则（Voice Rules）

## 4.1 学习者向内容声音

**核心**：同理心 + 母语权威 + 用户视角

**做**：
- ✅ "AI that thinks in Chinese, not translated"
- ✅ "Real Mandarin voices, not robotic"
- ✅ "Native speakers know 你好吗 is textbook, 最近忙啥呢 is real"
- ✅ "Yuki from Japan finally passed HSK 5 speaking"

**不做**：
- ❌ 引用任何 API 价格、模型名、毛利
- ❌ "Powered by [引擎]"
- ❌ "Built with [栈]"
- ❌ "Free forever" / "Lifetime unlimited"（过度承诺）
- ❌ 任何让学习者觉得"这是中国 app 可能有隐私问题"的表述

**特殊红线**：
- 提到"抖音/Pony/字节/微信"等中国品牌 → 学习者会警觉，**避免**
- "Built in China" → 可以，但要用 "Native Mandarin speakers 🇨🇳" 这种正向表达，**不要**用"China's best AI infra"

## 4.2 开发者向内容声音

**核心**：透明 + 数据 + 工程决策

**做**：
- ✅ "DeepSeek V3: $0.14/1M tokens vs GPT-4o: $5 → 30x cheaper"
- ✅ "Volcengine streaming ASR: 200-400ms latency"
- ✅ "$0.017/conversation, 93% gross margin"
- ✅ 真实数据：MRR、关注数、代码行数
- ✅ 失败复盘：bug、延迟、错误决策

**不做**：
- ❌ "Revolutionary AI product"
- ❌ 营销话术
- ❌ 隐瞒失败
- ❌ 假装成功

## 4.3 创始人个人号（X）混合声音

**核心**：真人叙事 > 公司账号

**70% 内容**：
- Build in public 进度（Day X）
- 技术决策（DeepSeek vs GPT-4）
- 真实数据（followers / waitlist / MRR）
- 失败/挣扎（Whisper latency、UI 难做）

**30% 内容**：
- HSK 学习痛点洞察（"can read but can't speak"）
- 用户故事（Yuki 终于开口了）
- 中文冷知识（你好吗 vs 最近忙啥呢）
- 母语者视角（"为什么 textbook 中文显得 stiff"）

---

# Part 5：内容类型分类（Content Taxonomy）

7 种内容类型，每种有明确受众和用途：

| 类型 | 受众 | 渠道 | 示例 |
|------|------|------|------|
| **A. 启动宣告 Thread** | 混合 | X | Day 0 6-tweet thread |
| **B. 技术决策 Thread** | dev | X / IH | "Why I chose DeepSeek over GPT-4" |
| **C. 数据/进度更新** | dev | X | "Week 1: 47 followers, 3 waitlist" |
| **D. 用户故事** | learner | X / 邮件 | "Yuki passed HSK 5" |
| **E. 行业洞察 / 痛点** | learner | X / Reddit 评论 | "Textbook vs real Chinese" |
| **F. 失败复盘** | dev | X / IH | "Bug cost me 4 hours" |
| **G. 深度长文** | dev | IH | "Building for the West from China — market research" |

**X 上的最佳混搭**：B + C + E + F 交替发，D 偶尔穿插。

---

# Part 6：X 内容比例（70/30 法则）

每周 X 主推（约 5 条）：

| 周 | 主推类型 | 受众 |
|----|---------|------|
| 周一 | 类型 C：上周数据复盘 | dev |
| 周二 | 类型 B：技术深度 | dev |
| 周三 | 类型 E：HSK 痛点洞察 | learner |
| 周四 | 类型 A/C：进度更新（截图/视频） | 混合 |
| 周五 | 类型 F/B：行业思考 / 失败复盘 | dev |
| 周末 | 类型 D：个人故事 / 用户故事（可选） | learner |

**Hashtag 策略**：
- Dev 内容：`#buildinpublic` `#IndieHackers` `#SaaS` `#100DaysOfCode`
- Learner 内容：`#Mandarin` `#HSK` `#LearnChinese` `#languagelearning`
- **每条 2-3 个 hashtag**（多了算法降权）
- ❌ 不要把 `#buildinpublic` 加到 learner 向内容上（受众错配）

---

# Part 7：红线（Red Lines）

## 7.0 新号启动红线（最重要，违反就封号）

**永久规则**（不论 Week 几，新号必须遵守）：

1. **VPN 固定一个节点**（美西/东京），永不换 → 中国用户首要死因
2. **同一设备 / 同一浏览器 / 同一 IP**，不要切换
3. **Week 1-2 绝对不用** Typefully / Buffer / Hootsuite / TweetDeck（API 自动发会封）
4. **新号 Thread 不含**链接 / hashtag / emoji 三件套同时
5. **Bio 域名 Day 14+ 才加**（新号 + 新域名 = 营销号特征）
6. **Reddit 同理**：新号 + 立即推广帖 = AutoModerator 删，需 50+ comment karma 才发帖

**v2.0 预热顺序**：
- Week 1（Day 0-6）：纯预热，零发推，只关注/点赞/评论
- Week 2（Day 7-13）：第一波内容，每天 1 推，Bio 仍不放域名
- Day 14+：Bio 才加 chatmandarin.cc，节奏稳态

详细见 `13_Week1_Content_Pack.md` v2.0。

## 7.1 法律/合规红线

- ❌ **r/ChineseLanguage Rule 3**：无 mod 预审，**永不**发带产品名/链接/"I'm building X" 的帖或评论
- ❌ **r/languagelearning 同上**
- ❌ 不买粉、不刷点赞、不刷 Karma（Reddit 算法会识别）
- ❌ 不在 X 短时间内大量发推（算法判定 spam）

## 7.2 商业红线（过度承诺）

- ❌ **"Free forever"** → 改为 "Real free tier / Free daily practice"
- ❌ **"Lifetime unlimited"** → 改为 "Lifetime discount for early users"
- ❌ **"Unlimited AI"** → 改为 "Daily practice included"
- ❌ **"Best in the world" / "#1 AI"** → 改为具体差异化（"built for HSK learners"）

## 7.3 品牌红线

- ❌ **学习者向内容出现引擎名**（DeepSeek/Volcengine/Whisper/CosyVoice）
- ❌ 引用"抖音/字节/Pony/微信"等中国品牌词（触发学习者警觉）
- ❌ 假装母语英语（"My English is perfect"）
- ❌ 隐瞒失败（一旦被发现 = 信任崩塌）

## 7.4 受众错配红线

- ❌ 在 r/ChineseLanguage 用 dev 语气
- ❌ 在 Indie Hackers 用 learner 营销话术
- ❌ 在 Landing Page 提技术栈
- ❌ 在邮件列表讲单位经济

## 7.5 未发布功能红线

- ❌ 任何渠道（含 dev）提到 V2 未发布功能（**电影配音** Week 1-9 完全不提）
- ❌ 暗示"在研究 X"或"很快会有 Y"等预告
- ❌ 在 build-in-public 数据里露"在开发 5 个 feature"暗示 V2 范围
- ✅ V2 准备好后单独 Waitlist 公告 / PH 二次发布
- ✅ Week 1-9 内容严格限定在 V1 功能（HSK 对话、HSKK 模考、错题本、实时反馈）

---

# Part 8：质检清单（发布前必走）

每条内容发布前，逐项检查：

## 8.1 受众匹配
- [ ] 这条内容的目标受众是谁？（dev / learner / 混合）
- [ ] 这个渠道的受众匹配吗？（不要把 dev 内容发 r/ChineseLanguage）

## 8.2 引擎名规则
- [ ] 如果是 learner 向，**0 个引擎名**？
- [ ] 如果是 dev 向，引擎名**与 v2.0 架构一致**？（DeepSeek + Volcengine ASR/TTS，不要 Whisper/CosyVoice）

## 8.3 过度承诺
- [ ] 没出现 "free forever" / "lifetime unlimited" / "best in the world"？
- [ ] 所有数字（成本、毛利、延迟）有依据？

## 8.4 文化敏感
- [ ] 没出现"抖音/字节/Pony"等让学习者警觉的词？
- [ ] "Built in China" 用 "Native Mandarin speakers 🇨🇳" 表达？

## 8.5 未发布功能纪律
- [ ] 没出现 V2 / 未发布功能？（**电影配音功能** Week 1-9 完全不提）
- [ ] 没暗示"在研究 X 功能"？（dev 内容也不要露未发布产品计划）
- [ ] V2 准备好后会单独公告，不在日常 Thread 里漏

## 8.6 真实性
- [ ] 数据是真实的（不是编的）？
- [ ] 失败也诚实分享？
- [ ] 没用"revolutionary" / "game-changing"等空话？

## 8.7 平台规则
- [ ] X 单条 < 280 字符？
- [ ] Reddit sub 的 Rule 都读了？
- [ ] r/ChineseLanguage / r/languagelearning 不发产品帖？

---

# Part 9：内容支柱（5 大可复用主题）

无论周几、什么渠道，所有内容都从这 5 个支柱里选：

## 支柱 1：Market Gap（市场缝隙）
> "HelloChinese 只有 500K 下载 vs Speak（韩语）$1B 估值"
- 用法：dev 渠道（r/SideProject, IH, X dev threads）
- 变种： "Why Chinese is 10x Korean market but no AI tool exists"

## 支柱 2：Native Advantage（母语优势）
> "Textbook: 你好吗 vs Real: 最近忙啥呢"
- 用法：learner 渠道（X learner threads, YouTube KOL, 邮件）
- 变种： "3 phrases textbooks teach wrong"

## 支柱 3：Tech Decision（技术决策）
> "DeepSeek V3 = 1/30 GPT-4 成本，中文质量持平"
- 用法：dev 渠道（IH, X Day-1 类 threads）
- 变种： "Why I picked Volcengine ASR over Whisper"

## 支柱 4：User Story（用户故事）
> "Yuki from Japan, HSK 5, finally passed speaking"
- 用法：learner 渠道（邮件, X 周末, Day in Beta）
- 变种： beta 反馈、HSKK 通过故事、付费转化故事

## 支柱 5：Build Reality（构建真相）
> "Week 1: 0 followers, 0 waitlist, 800 lines, ugly UI"
- 用法：dev 渠道（X data threads, IH monthly reports）
- 变种： 失败复盘、bug 故事、延迟优化

---

# Part 10：复用管线（Content Repurposing Pipeline）

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
X 单推 × 5（每天一条）
    ↓ 视觉化
PH Gallery 图 / Demo 视频
    ↓ 归档
未来 KOL DM 引用素材
```

**实际例子（Week 1）**：

```
Indie Hackers 长文（Week 1 末发布）
├── Day 1 X Thread：技术选型（从 IH "Tech stack" 段拆出来）
├── Day 3 X Thread：竞品分析（从 IH "Market data" 段拆出来）
├── Day 4 X Thread：痛点洞察（从 IH "The gap" 段拆出来）
├── Day 6 X Thread：个人故事（从 IH "Origin story" 段拆出来）
├── Day 0 X Thread：启动宣告（IH 的浓缩版预告）
├── Reddit r/SideProject 帖（IH 的市场分析浓缩）
└── Landing Page "Why" section（IH 的 learner-friendly 版本）
```

**效率**：写 1 篇 IH = 7-10 条 X / Reddit / Landing 内容。

---

# Part 11：节奏与产能

## 11.1 每日最低产能（30 分钟）
- 早晨：1 条 X 单推（5 分钟）
- 晚上：1 个 X Thread（20 分钟）
- 全天：5-10 条 X 回复（5-10 分钟）
- 全天：3-5 条 Reddit 评论（10 分钟）

## 11.2 每周产能（约 5 小时）
- 5 条 X 主推（含 1-2 个 Thread）
- 1 篇 IH / 长文（月初或月末）
- 1 个 Reddit 帖（dev sub）
- 1 封邮件（如有 waitlist）
- 持续 Reddit 评论

## 11.3 不做的事
- ❌ TikTok（wrong niche, 产能陷阱）
- ❌ 每天 5+ Threads（刷屏）
- ❌ 半个月不更（断更 = 掉粉）
- ❌ 复制粘贴别人的推文

---

# Part 12：成功指标（KPI）

## 12.1 Week 1
- X followers: 50+ (从 0)
- Reddit karma: 50+
- Waitlist: 3+
- r/SideProject 帖 upvotes: 10+

## 12.2 Week 4
- X followers: 200+
- Waitlist: 30+
- IH 文章阅读: 200+
- 第 1 个 KOL 回复 DM

## 12.3 Week 8
- X followers: 400+
- Waitlist: 80+
- Beta 用户: 20+
- 第 1 个付费用户

---

# 附录 A：常见反模式（Anti-patterns）

| 反模式 | 为啥不行 | 正确做法 |
|-------|---------|---------|
| Landing Page 写 "Powered by DeepSeek + Whisper" | 学习者不关心引擎名，反而显得工程师范 | 写 "AI that thinks in Chinese" |
| r/ChineseLanguage 发 "I built X, try it!" | Rule 3 直接删帖 + ban 风险 | 只评论价值，modmail 申请预审 |
| 用 "Free forever" | 过度承诺，后期翻车 | 用 "Real free tier / Free daily practice" |
| X 一天发 5+ Threads | 刷屏 = 掉粉 | 每天 1 Thread + 2 单推 |
| 假装英语母语 | 失去"中国开发者"优势 | 拥抱 "Chinese dev shipping to 🌏" |
| 隐瞒失败 | Build in public 圈最恨不透明 | 失败也分享，更受欢迎 |
| 把 Day 6 故事说成"我自己 can read but can't speak" | 你是母语者，不是学习者 | 真实故事：帮助外国朋友 |
| 提"抖音同源" | 学习者警觉 | 用 "Native Mandarin voice AI" |

---

# 附录 B：v2.0 技术栈速查（dev 向内容用）

```
LLM: DeepSeek V3 ($0.14/1M input tokens, ~30x cheaper than GPT-4)
STT: Volcengine streaming ASR (Mandarin-native, 200-400ms latency)
TTS: Volcengine Doubao voices (natural Mandarin)
Frontend: Next.js 14 + Tailwind + shadcn/ui
Backend: Cloudflare Workers (edge compute) + Durable Objects (WebSocket)
DB/Auth: Supabase Postgres + Supabase Auth
Storage: Cloudflare R2 (audio files) + KV (session cache)
Queue: Cloudflare Queues (HSKK async grading)
Payments: Lemon Squeezy (MoR)
Email: Resend
Errors: Sentry

Unit economics:
- Cost per conversation: ~$0.017
- Heavy user (60 conv/mo): ~$1.02
- Price: $14.99/mo
- Gross margin: ~93%
```

**dev 向内容引用此栈**；learner 向内容**永不**引用。

---

**版本**：v1.0（2026-07-04）
**下次更新**：Beta 用户反馈后可能调整学习者痛点优先级
