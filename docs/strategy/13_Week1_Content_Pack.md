# ChatMandarin Week 1+ 完整内容包（v2.0 预热版）

> ⚠️ **v2.0 重大修正**：
> v1.0 版建议"注册当天发 6 推 Thread"——这是**错误策略**，会导致 X 算法判定为新号 spam，账号秒封。
> 本版本改为：**Week 1 纯预热 + Week 2 才开始正式内容**。
>
> 所有原 v1.0 设计的 Day 0-7 Threads（启动宣告、技术选型、痛点洞察等）保留，
> 但**整体后移到 Week 2 (Day 8-14)**。

---

# Part 0：为什么必须预热（核心逻辑）

X 和 Reddit 对**新账号发推广内容**极度敏感，下列组合会触发自动 spam 判定：

| 触发器 | 解释 |
|-------|------|
| 新号 + 立即长 Thread | 5+ 推连发 = 教科书 spam 特征 |
| Bio 含未建站域名 | X 查域名注册时间，新域名 + 新账号 = 红灯 |
| VPN IP 跳跃 | 中国用户首要死因（早美国、晚日本 = 风控）|
| 第三方工具自动发 | Typefully/Buffer 用 API，新号必死 |
| 帖子含 hashtag + emoji + 链接 | 三件套同时出现 = 营销号特征 |

**正确顺序**：

```
Week 1 (Day 0-6)  →  纯互动，不发自己的推
                     ↓
Week 2 (Day 7-13) →  第一波内容（Day 0 启动 Thread 在 Day 8 发）
                     ↓
Week 3+           →  节奏稳定，可以加链接、hashtag、Bio 域名
```

---

# Part 1：永久账号纪律（先于一切内容）

## 1.1 VPN 固定（最重要）

- ✅ **选一个固定节点**（推荐美国西海岸或日本东京）
- ✅ 整个 X / Reddit 使用周期里**永不变节点**
- ✅ 用专门的浏览器 profile（Chrome / Firefox 独立账号）只走那一个节点
- ❌ 不要用免费 VPN（共享 IP 已被风控）
- ❌ 不要在不同设备上登录（手机 4G + 家里 WiFi = IP 跳跃）

**推荐**：NordVPN / Mullvad / 自建 Vultr 节点，固定一个。

## 1.2 设备指纹稳定

- 同一台电脑、同一个浏览器、同一个 IP
- 不要今天 Mac、明天 Windows、后天手机
- 不要清 cookie / 不要登出再登入（X 看到设备变化会风控）

## 1.3 第三方工具纪律

- **Week 1-2 绝对不用** Typefully / Buffer / Hootsuite / TweetDeck
- 全部**手动网页发**
- Week 3 后才考虑预排

## 1.4 Bio 演进（不要一开始就完美）

| 阶段 | Bio 内容 |
|------|---------|
| Day 0-7（注册后） | 只写"Building something. Day X."，**不放域名** |
| Day 14+ | 才加 chatmandarin.cc |
| Day 30+ | 才考虑完整 Bio（product / role / domain）|

## 1.5 Reddit 同理

- 新号 + 立即推广帖 = AutoModerator 自动删
- 必须先有 50+ comment karma 才考虑发帖
- r/SideProject 是最宽松的，但也要先有真实参与

---

# Part 2：Week 1 (Day 0-6) — 纯预热，零发推

## Day 0：账号建立

### X 账号
- [ ] 注册（**新邮箱，Gmail/Outlook/ProtonMail**，不要 163/QQ）
- [ ] 用户名：英文名 + `_builds` 或直接英文名
- [ ] **Bio（精简版，不放域名）**：
  ```
  Building something for Mandarin learners. Day 0.
  Chinese dev shipping to 🌏
  ```
- [ ] **头像**：真人照（清晰、正面、微笑）
- [ ] **Location**：`China`
- [ ] **Website**：**留空**（至少 Day 14 才加）
- [ ] 关注 30 个相关账号（见 Part 6 名单）
- [ ] **不发推**

### Reddit 账号
- [ ] 注册（**同一个新邮箱**）
- [ ] 加入所有 sub：
  - r/SideProject、r/SaaS、r/IndieHackers、r/Entrepreneur（dev）
  - r/ChineseLanguage、r/languagelearning（learner）
- [ ] 浏览每个 sub 的 Top of the week
- [ ] **不发帖**

## Day 1：观察 + 第一条互动

### X 任务（15 分钟）
- [ ] 浏览 timeline，给 10 条相关推点赞
- [ ] 在 3 条推下留**真诚的评论**（不是 "cool!"，要有观点）

**评论示范**：
```
✅ "This matches what I see in r/ChineseLanguage —
   learners say exactly this. The textbook-to-real gap is huge."

✅ "Curious how you handled the latency issue.
   I'm dealing with similar in voice AI."

❌ "Cool! Check out my project chatmandarin.cc"
```

### Reddit 任务（20 分钟）
- [ ] r/SideProject：浏览本周 Top 5 帖，每帖留 1 条价值评论
- [ ] r/ChineseLanguage：浏览本周 Top 5 帖，每帖留 1 条母语者视角评论
- [ ] **不发帖**

**Reddit 评论示范（见 Part 7 模板）**：
- 母语者视角分享中文冷知识
- 真诚回答 HSK 学习者的提问
- 共情学习者挫败感
- **永不提产品名 / 链接 / "I'm building X"**

## Day 2：评论积累

### X 任务（15 分钟）
- [ ] 给 5 个新账号的关注列表扫一遍，再关注 10-20 个
- [ ] 留 5 条真诚评论
- [ ] 转推 1-2 条真正好的内容（带评论）

### Reddit 任务（15 分钟）
- [ ] r/SideProject：留 3 条价值评论
- [ ] r/ChineseLanguage：留 2 条母语者评论
- [ ] r/languagelearning：留 2 条评论

## Day 3-4：继续互动

### X 任务（每天 15 分钟）
- [ ] 留 5-8 条评论
- [ ] 给 20 条推点赞
- [ ] **仍不发自己的推**

### Reddit 任务（每天 15 分钟）
- [ ] 5 条价值评论
- [ ] 浏览各 sub 新帖，找能评论的

### 这时候你可以开始有感而发
- 把每天在 r/ChineseLanguage 看到的痛点记下来（后续 Week 2 内容素材）

## Day 5：第一条 X 推（终于）

### 早晨单推（08:30 CN，纯文字，无链接无 hashtag）
```
Spent the week reading r/ChineseLanguage top posts of the year.

The #1 pain: "can read but can't speak."

50+ learners said the same thing. Textbook Chinese ≠ real Chinese.

Fascinating gap.
```
**字数**：~200 字符 ✅
**为什么这样**：
- ✅ 无链接（避免 spam 特征）
- ✅ 无 hashtag（避免营销号特征）
- ✅ 无 emoji 或仅一个
- ✅ 有观点、有数据、引发共鸣
- ❌ **不要**带 chatmandarin.cc

## Day 6：第二条单推

### 晚上单推（21:00 CN，纯思考）
```
Unpopular opinion:

Most "AI language apps" are just GPT-4 + fancy UI.

Real value is:
1. Domain-specific prompts
2. Structured outputs
3. Voice in / voice out
4. Knowing the language deeply

The model is 5% of the work.
```

## Day 7：第一条 Thread（仍无链接）

### 晚上Thread（21:00 CN，3-4 条）

#### Tweet 1/3
```
🧵 1 week of lurking r/ChineseLanguage.

The most surprising pain I found 👇
```

#### Tweet 2/3
```
1/ "I passed HSK 4 on paper.
Froze trying to talk to my Chinese coworker."

This story appears 50+ times in the sub.

Learners can read textbooks. They can NOT speak.
```

#### Tweet 3/3
```
2/ Textbook teaches "你好吗?"
Real people say "最近忙啥呢?"

Nobody actually says "你好吗?" except in textbooks.

The textbook-to-real gap is real.

(That's all. Just sharing what I found.)
```

**关键**：
- ❌ **不要**在 Thread 末尾加 "I'm building X" 或链接
- ✅ 纯分享观察，**等别人问"are you building something?"**
- ✅ 这条 Thread 是"喂观察"型，不是"推广产品"型

### Week 1 结束检查
- [ ] X：关注 50+ 账号，留 30+ 评论，发 2 单推 + 1 Thread
- [ ] Reddit：comment karma 30+（r/SideProject + r/ChineseLanguage 合计）
- [ ] **0 个产品推广帖 / 0 个域名链接**
- [ ] VPN 同一节点
- [ ] 同一设备

---

# Part 3：Week 2 (Day 7-13) — 第一波内容

> 从这里开始用 v1.0 设计的内容，但**节奏放缓**：
> - 每天 1 条主推（不再 1 Thread + 1 单推）
> - Thread 之间隔 1-2 天
> - **Bio 仍不放域名**

## Day 8：Day 0 启动 Thread（5 条精简版）

### 晚上Thread（21:00 CN）

#### Tweet 1/5
```
🧵 Building something for Mandarin learners.

Why? The market is massively underserved.

(Thread 👇)
```

#### Tweet 2/5
```
1/ Market data:

• 50M+ people learn Chinese globally
• Cumulative 100M HSK test takers
• HelloChinese (top app): only 500K downloads
• Speak (Korean AI tutor): $1B valuation

The gap is huge.
```

#### Tweet 3/5
```
2/ My plan:

1. HSK-graded AI conversation
2. HSKK oral exam mock test
3. Mistake journal + spaced repetition
4. Real-time tone/grammar feedback
```

#### Tweet 4/5
```
3/ I'm a Chinese developer.

3 years ago I watched an American friend freeze
trying to order noodles in Beijing. He had passed HSK 3.

Now I'm building the tool he needed. 🛠️
```

#### Tweet 5/5
```
4/ Day 0 status:

• Tech stack: ✅ decided
• Code: 0 lines
• Waitlist: 0

Building in public. Will share progress.

#buildinpublic
```

**审计**：
- ✅ **没有 chatmandarin.cc**（Week 2 还不能加）
- ✅ 只有 1 个 hashtag（避免 spam 特征）
- ✅ 没有过早承诺
- ✅ 真实数据（0 行代码、0 waitlist）

## Day 9：技术选型 Thread（dev 受众）

照搬 `../marketing/03_X_Post_Templates.md` 的 Day 1 Thread（5 条 DeepSeek vs GPT-4）。
**仍不放链接**。可以加 `#DeepSeek` 等 dev hashtag。

## Day 10：纯单推（休息日）

```
Building AI products is 20% model, 80% plumbing.

The model is smart.
The plumbing (auth, payments, latency, errors, state) is what kills you.

Memo to self: don't underestimate the plumbing.
```

## Day 11：截图单推

```
First working screenshot 👇

[Attached: terminal screenshot]

- AI replying in HSK 3 vocabulary only ✅
- Actually understood my broken tones ✅
- Latency: 1.2s end-to-end

Ugly CLI, but it works.

#buildinpublic
```

## Day 12：竞品分析 Thread

照搬 `../marketing/03_X_Post_Templates.md` 的 Day 3 Thread（5 条 HelloChinese vs Speak）。

## Day 13：Week 2 复盘 + Reddit 首发

### 晚上X 复盘 Thread（4 条）
照搬 `../marketing/03_X_Post_Templates.md` 的 Day 5 Thread。

### Reddit r/SideProject 首发（仅在 karma 50+ 时）
如果 Reddit karma 还不够 50，**继续推迟**。

**r/SideProject 帖**（照搬 `../marketing/00_Action_Checklist.md` Task 2.4 的 Reddit 文案，已替换 .cc）。

**重要**：
- 只发 r/SideProject，**不同时发** r/SaaS / r/IndieHackers
- 发后 48 小时秒回每条评论

## Day 14：终于可以在 Bio 加域名

### 早晨
- [ ] 编辑 X Bio，加上 chatmandarin.cc：
  ```
  🛠️ Building ChatMandarin — AI Chinese tutor
  🇨🇳 Chinese dev shipping to 🌏
  📚 Helping HSK learners speak Mandarin
  🔗 chatmandarin.cc
  ```
- [ ] X Website 字段填 chatmandarin.cc
- [ ] Reddit user profile（可选）填 chatmandarin.cc

### 晚上个人故事 Thread
照搬 `../marketing/03_X_Post_Templates.md` 的 Day 6 Thread。

---

# Part 4：Week 3+ 节奏（正式巡航）

到 Week 3 才进入"每天 1 Thread + 2 单推 + 5-10 互动"的稳态。

参考 `12_Content_Strategy_Framework.md` Part 6 的 70/30 法则。

### Week 3 才能做的事
- IH 长文发布（用 `../marketing/04_IndieHackers_First_Post.md`）
- r/SaaS / r/IndieHackers 第二个 Reddit 帖
- 邮件 Welcome 模板（用 Part 8）
- 联系 YouTube KOL DM

---

# Part 5：X 关注 & 回复名单

## Build in Public 圈（每天互动 2-3 个）
- @marc_louvion、@tdinh_me、@levelsio
- @jasonleowsg、@OwenYoungZh、@dannypostma、@dvassallo

## AI 教育 / 中文学习 圈（每天互动 1-2 个）
- @speak_apps、@duolingo、@ChinesePod
- @YoyoChinese、@EverydayChinese

## 互动规则
- ✅ 真诚：评论有观点，不是 "cool!"
- ✅ 不打广告：评论**永不**提 ChatMandarin
- ✅ 频率：每个账号每周评论 1-2 次，不要刷屏
- ❌ Week 1 不要 DM 任何人

---

# Part 6：Reddit 评论模板（每天用）

> 规则：**永不**主动提产品。被问起时低调 DM。
> 适合 r/ChineseLanguage 和 r/languagelearning。

## 模板 A：回答 HSK 等级问题
```
I'm HSK 4. From my experience, the jump from 3 to 4 was mostly about
vocabulary volume (500 → 1200 words) and longer reading passages.
Grammar felt similar, just more of it.

What helped me: graded readers at HSK 3.5 level before pushing into 4.
```

## 模板 B：回答 "how to practice speaking"
```
Honest answer: most apps don't really help with speaking.
What worked for me:
1. Shadowing podcasts (Mandarin Companion)
2. Language exchange on HelloTalk
3. Recording myself + listening back (painful but works)

The "can read but can't speak" gap is real.
Most learners hit it around HSK 3-4.
```

## 模板 C：回答 tone learning
```
Tones are muscle memory, not knowledge. You can't learn them by reading.

What worked:
- Record yourself saying 你好 vs 你好 (different tones)
- Listen back with a native speaker
- Repeat 100 times over a week

After a while your mouth just knows.
```

## 模板 D：textbook vs real Chinese
```
This is so true. My foreign friends learned "你好吗?" from textbooks.
Real Beijingers say "最近忙啥呢?" or "吃了吗?"

Textbook Chinese feels stiff because it's modeled on formal writing.
Big gap nobody addresses.
```

## 模板 E：HSKK oral exam
```
HSKK is a totally different beast from written HSK.
The picture description section trips up everyone.

Honestly there's almost no dedicated HSKK prep tool.
Most people just use generic speaking practice and hope.
```

## 模板 F：app 推荐
```
Tried most of them:
- Duolingo: good for vocab, shallow on everything else
- HelloChinese: better structure, but still course-style
- Pleco: dictionary, not learning
- Skritter: handwriting only

Honestly the gap is real-time speaking practice. None really do it.
```

## 模板 G：安慰挫折感
```
This is normal. The "intermediate plateau" hits around HSK 3-4.
You're not doing anything wrong — it's the gap between
textbook vocabulary and real-world fluency.

Keep going. It breaks around HSK 5.
```

## 评论规则
- ✅ **真实**：你是母语者，这是你的优势
- ✅ **同理心**：承认挫败感
- ✅ **细节**：具体例子 > 抽象建议
- ❌ **不提**：ChatMandarin / 链接 / "I'm building X"
- ❌ **不营销**：哪怕别人问"有没有工具推荐"，也不主动推销

**例外**：被人**直接问** "are you building something?" 时：
```
Yes, I'm building a tool for this exact gap. Still early stage.
DM if curious — don't want to spam the thread.
```

---

# Part 7：邮件 Welcome 模板（Week 3+ 用）

> 适用：有人通过 Landing Page 填了邮箱（Landing Page 至少 Week 3-4 才上线）
> 受众：**纯 learner**

**主题**：
```
🧧 Welcome to ChatMandarin — here's what's next
```

**正文**：
```
Hi [First Name],

Thanks for joining the ChatMandarin waitlist. 🙏

I'm [Your Name], a Chinese developer building an AI tutor
specifically for HSK learners who want to SPEAK Mandarin —
not just read and write.

Quick story:

3 years ago, my American friend passed HSK 3 on paper.
Then he visited Beijing and froze trying to order noodles.
Textbook Chinese ≠ real Chinese.

That gap is why I'm building ChatMandarin.

**What you'll get as a waitlist member:**

1. Priority beta access (before public launch)
2. 30% off the first year (first 100 members only)
3. Direct input on features (I read every reply)

**Timeline:**

Private beta starts in [Month, Year]. I'll email you when
your invite is ready — usually 2-3 weeks before public launch.

Reply to this email anytime with questions or feature requests.
I personally read everything.

Thanks for believing in this journey. 🇨🇳

[Your Name]
Founder, ChatMandarin
chatmandarin.cc
```

---

# Part 8：KPI（修订版）

## Week 1（预热周）
- X：关注 50+ 账号，留 30+ 评论
- X：发 2 单推 + 1 Thread（**无链接**）
- Reddit：comment karma 30+
- ❌ **零** 自己的产品推广帖

## Week 2（第一波内容）
- X followers: 20-40（从互动来）
- Reddit karma: 50+
- r/SideProject 首发（仅当 karma 够）
- Bio 加域名（Day 14）

## Week 3+
- X followers: 50+ → 200+
- Waitlist: 第 1 个订阅
- IH 长文发布
- YouTube KOL 接触开始

---

# Part 9：应急（如果再次被封）

## 9.1 申诉模板
```
Hi X Support,

My account was suspended shortly after creating it. I'm a real
developer in China building a language-learning app called
ChatMandarin. I posted my first content introducing my project
(build in public).

I think the suspension may be due to:
- Using a VPN (required to access X from China)
- Being a new account posting my first thread

I'm a real human, not a bot. Happy to verify my identity.
Please reinstate my account.

Thank you,
[Your name]
```

## 9.2 不要立刻重建
- 等申诉结果（3-14 天）
- 同设备 / 同 IP / 同邮箱**关联封禁** = 新号也秒封
- 必须**换 IP（VPN 节点）/ 换设备 / 换邮箱**才能开新号

## 9.3 备选方案（最坏情况）
- 等待 30 天，让设备指纹"冷却"
- 换新 VPN 节点 + 新邮箱 + 新手机号
- 注册后严格按本 v2.0 预热策略走

---

# Part 10：版本审计说明

## v2.0 对 v1.0 的关键修正

| 项 | v1.0（错） | v2.0（对） |
|----|-----------|-----------|
| Day 0 发推 | 注册当天发 6 条 Thread | 注册当天**不发推** |
| Bio 域名 | Day 1 就放 chatmandarin.cc | Day 14+ 才放 |
| 第三方工具 | 推荐 Typefully | Week 1-2 绝对不用 |
| Reddit 帖 | Week 1 当天发 r/SideProject | Week 2 karma 50+ 才发 |
| 节奏 | 每天 1 Thread + 2 单推 | Week 1 零推，Week 2 每天 1 推 |
| IH 长文 | Week 1 末发布 | Week 3 才发布 |

## 现有 Threads 内容保留

v1.0 设计的所有 Thread 文案（Day 0 启动、Day 1 技术选型、Day 2 截图、Day 3 竞品、Day 4 痛点、Day 5 复盘、Day 6 故事、Day 7 Prompt）依然有效，但：
- **整体后移到 Week 2-3**
- 见 `../marketing/03_X_Post_Templates.md` 完整文案

---

# Part 11：当前立刻该做（用户行动清单）

## 今天（申诉 X 封号）
1. [ ] 用 Part 9.1 模板申诉（强调中国 VPN）
2. [ ] 等结果（3-14 天）

## 申诉期间（不要立刻开新号）
1. [ ] 固定一个 VPN 节点（如美西 / 东京），**永远不变**
2. [ ] 准备一个新邮箱（Gmail / Outlook）
3. [ ] 阅读现有文档（00-13），理解产品 + 内容策略

## 申诉成功
1. [ ] 按本 v2.0 预热策略走（Week 1 零推）
2. [ ] 不要急

## 申诉失败
1. [ ] 等 30 天让设备指纹冷却
2. [ ] 换 VPN 节点 + 新邮箱 + 新手机号
3. [ ] 严格按 v2.0 走

---

**版本**：v2.0（2026-07-04）
**配套文档**：`12_Content_Strategy_Framework.md`、`../marketing/03_X_Post_Templates.md`、`../marketing/00_Action_Checklist.md`
**核心教训**：新号 + 立即 Thread + Bio 域名 = X 算法秒封。永远先预热。
