# ChatMandarin 技术架构 + 详细产品设计（v2.0 最终版）

> **决策已定**：
> - 形态：PWA Web App
> - 技术栈：Next.js 14 + Tailwind + shadcn/ui
> - AI：DeepSeek + 火山引擎（5 产品全开）
> - 支付：Lemon Squeezy（MoR）
> - **基础设施：Cloudflare + Supabase 两件套**（修正自之前的"All Cloudflare"）

---

# Part 0：技术选型理由（修正说明）

## 为什么不是纯 All-Cloudflare？

**承诺与现实**：之前承诺过"全 Cloudflare 搞定"，但实际拆解后发现：

| Cloudflare 服务 | 能否替代 | 真实问题 |
|---------------|---------|---------|
| Cloudflare D1（数据库） | ✅ 能 | SQLite 简化版，非真 Postgres；生态不如 Supabase |
| Cloudflare Workers + KV（自建 Auth） | ✅ 能 | 需自写 OAuth/邮箱验证/密码重置（5-10 天工作量） |
| Cloudflare Durable Objects（Realtime） | ✅ 能 | 学习曲线陡，文档少 |
| Cloudflare Email Workers | ✅ 能 | 只能接收，发邮件仍需第三方 |

**结论**：技术上全 Cloudflare **可行但工程量多 30-50%**。

## 为什么选 Cloudflare + Supabase 两件套？

| 维度 | All-Cloudflare | Cloudflare + Supabase |
|------|---------------|----------------------|
| Auth 工作量 | 自建 5-10 天 | **开箱即用（社交登录/魔法链接/邮箱验证全有）** |
| 数据库 | D1（SQLite） | **真 Postgres（成熟 + 生态丰富）** |
| 实时订阅 | Durable Objects（复杂） | **Supabase Realtime（开箱即用）** |
| 供应商数量 | 1 | 2 |
| 月成本（1000 用户） | $10-15 | $10-30（仍低） |
| 上线速度 | 慢 1-2 周 | **快** |

**核心权衡**：
- 用 **Supabase 处理 Auth + Database + Realtime**（业务核心）
- 用 **Cloudflare 处理 Edge Compute + Storage + 静态托管 + CDN**（基础设施）
- 两个供应商各自做自己最擅长的事

## 为什么不三件套（Clerk + Supabase + Cloudflare）？

之前推 Clerk 是错误的，因为：
- Supabase **自带 Auth**（不需要 Clerk）
- Clerk 免费层 10K MAU，Supabase 免费 50K MAU（更慷慨）
- Clerk Pro $25/月，Supabase 自带 Auth 不加价
- **三件套没有意义，Supabase 就够了**

---

# Part 1：系统架构（最终版）

## 1.1 整体架构图

```
┌─────────────────────────────────────────────────────────────┐
│                用户浏览器（PWA）                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ Next.js 14 App（chatmandarin.cc）                   │    │
│  │  ├── 主界面（对话/HSKK 模考/错题本/进度）             │    │
│  │  ├── Web Audio API + MediaRecorder（录音）          │    │
│  │  ├── WebSocket Client（实时音频流）                 │    │
│  │  └── Service Worker（PWA 离线/缓存）                │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
              ↓ HTTPS / WSS
┌─────────────────────────────────────────────────────────────┐
│             Cloudflare 边缘（全球 200+ 节点）                │
│  ├── Cloudflare Pages（前端托管 + SSR）                     │
│  ├── Cloudflare Workers（API / WebSocket 代理）             │
│  ├── Cloudflare KV（Session 缓存 + 限流）                   │
│  ├── Cloudflare R2（音频文件存储）                          │
│  └── Cloudflare Queues（HSKK 异步评分队列）                 │
└─────────────────────────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────────────────────────┐
│            业务 API（Cloudflare Workers 内）                 │
│  ├── /api/auth/*          → 重定向到 Supabase Auth          │
│  ├── /api/chat/stream     → WebSocket（实时对话）            │
│  ├── /api/llm/completions → DeepSeek                        │
│  ├── /api/asr/stream      → 火山引擎流式 ASR                │
│  ├── /api/tts/stream      → 火山引擎 TTS                    │
│  ├── /api/hskk/grade      → HSKK 异步评分                   │
│  ├── /api/lemonsqueezy/webhook → 订阅回调                   │
│  └── /api/admin/*         → 管理后台                        │
└─────────────────────────────────────────────────────────────┘
              ↓
┌──────────────────────────────┐  ┌─────────────────────────┐
│     Supabase（业务数据）      │  │   AI 服务（外部）        │
│  ├── Postgres Database       │  │  ├── DeepSeek V3 (LLM) │
│  │   ├── users               │  │  ├── 火山引擎流式 ASR   │
│  │   ├── subscriptions       │  │  ├── 火山引擎一句话 ASR │
│  │   ├── conversations       │  │  ├── 火山引擎录音 ASR   │
│  │   ├── conversation_turns  │  │  ├── 火山引擎豆包 TTS   │
│  │   ├── mistakes            │  │  └── 火山引擎标准 TTS   │
│  │   └── hskk_tests          │  └─────────────────────────┘
│  ├── Auth (GoTrue)           │
│  │   ├── Email/Password      │  ┌─────────────────────────┐
│  │   ├── Google OAuth        │  │   其他服务              │
│  │   ├── GitHub OAuth        │  │  ├── Lemon Squeezy     │
│  │   └── Magic Link          │  │  ├── Resend（邮件）     │
│  ├── Realtime（订阅推送）    │  │  └── Sentry（错误）     │
│  └── Storage（备份）         │  └─────────────────────────┘
└──────────────────────────────┘
```

## 1.2 职责划分（清晰）

| 层级 | 由谁负责 | 做什么 |
|------|---------|-------|
| **前端** | Cloudflare Pages | Next.js 静态/SSR 托管 |
| **Edge Compute** | Cloudflare Workers | API + WebSocket 代理（全球低延迟） |
| **Auth** | Supabase Auth (GoTrue) | 注册/登录/OAuth/邮箱验证 |
| **业务数据库** | Supabase Postgres | 用户/订阅/对话/错题/HSKK |
| **Session 缓存** | Cloudflare KV | 高频读写的 session/限流 |
| **音频文件** | Cloudflare R2 | HSKK 录音（大文件，便宜） |
| **异步任务** | Cloudflare Queues | HSKK 评分（耗时 30s） |
| **AI** | DeepSeek + 火山引擎 | 对话 + ASR + TTS |
| **支付** | Lemon Squeezy | MoR 订阅 |
| **邮件** | Resend | 事务邮件 |

---

# Part 2：实时音频对话管线（核心）

## 2.1 时间轴

```
t=0     用户按麦克风按钮
        ↓ MediaRecorder 启动（Opus 编码）

t=0+    音频块（每 200ms）→ Cloudflare Worker → 火山引擎流式 ASR
        ↓ 实时返回部分转录
        UI 显示"listening... 你说：你好..."

t=X     用户停顿 800ms（VAD 检测）
        ↓ 发送 "end of utterance"

t=X+800 火山引擎返回完整转录 + 时间戳
        并发触发：

        ┌─────────────────────────────────────────┐
        │ 1. 转录 → DeepSeek 流式生成 JSON        │
        │    System Prompt（HSK 分级 + 纠错模式）  │
        │    历史 5 轮对话                         │
        │                                          │
        │ 2. 用户音频 → 声调分析（librosa）        │
        │    + 流畅度统计                          │
        │                                          │
        │ 3. 准备 TTS 流（pending）                │
        └─────────────────────────────────────────┘

t=X+1500 DeepSeek 首 token 到达
        → 启动火山引擎 TTS 流式合成
        → 前端实时显示 AI 文字
        → 同时播放 TTS 音频块

t=X+2000 用户开始听到 AI 回复
        UI 显示反馈（评分、错误）

t=X+3000 准备下一轮
```

## 2.2 延迟预算（目标 < 3s）

| 阶段 | 目标 | 责任方 |
|------|------|-------|
| 用户停顿检测 | 800ms | 前端 VAD |
| ASR 完成转录 | 200-400ms | 火山引擎（流式） |
| DeepSeek 首 token | 500-800ms | DeepSeek 流式 API |
| TTS 首音频块 | 300-500ms | 火山引擎 TTS |
| 网络 RTT | 100-200ms | Cloudflare 边缘 |
| **总计** | **1.9-2.7s** | - |

---

# Part 3：数据模型（Supabase Postgres）

## 3.1 Schema

```sql
-- ============ 用户 ============
CREATE TABLE profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Supabase Auth 关联
  auth_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  -- 用户偏好
  hsk_level INT DEFAULT 1 CHECK (hsk_level BETWEEN 1 AND 6),
  correction_mode TEXT DEFAULT 'friendly'
    CHECK (correction_mode IN ('friendly', 'strict', 'tutor')),
  audio_speed FLOAT DEFAULT 1.0,
  -- 时间戳
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_active_at TIMESTAMPTZ
);

-- ============ 订阅 ============
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  lemon_squeezy_id TEXT UNIQUE,
  plan TEXT NOT NULL CHECK (plan IN ('free', 'plus', 'pro')),
  status TEXT NOT NULL CHECK (status IN ('active', 'canceled', 'past_due', 'trialing')),
  current_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============ 对话会话 ============
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  scenario TEXT NOT NULL, -- restaurant / taxi / doctor / ...
  hsk_level INT NOT NULL,
  correction_mode TEXT NOT NULL,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  total_turns INT DEFAULT 0,
  -- 累计分数
  avg_pronunciation FLOAT,
  avg_grammar FLOAT,
  avg_fluency FLOAT,
  avg_word_choice FLOAT
);

-- 索引：用户最近对话
CREATE INDEX idx_conversations_user_started
  ON conversations(user_id, started_at DESC);

-- ============ 对话单轮 ============
CREATE TABLE conversation_turns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  turn_index INT NOT NULL,
  -- 内容
  user_text TEXT,
  ai_text TEXT,
  -- 音频路径（R2）
  user_audio_path TEXT,  -- 仅在 HSKK 或 debug 模式存储
  ai_audio_path TEXT,
  -- 评分（0-100）
  pronunciation_score INT,
  grammar_score INT,
  fluency_score INT,
  word_choice_score INT,
  -- 错误详情
  errors JSONB DEFAULT '[]'::jsonb,
  -- 元数据
  user_audio_duration_ms INT,
  ai_response_latency_ms INT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_turns_conversation
  ON conversation_turns(conversation_id);

-- ============ 错题本 ============
CREATE TABLE mistakes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  -- 错误信息
  type TEXT NOT NULL CHECK (type IN ('tone', 'grammar', 'word', 'fluency')),
  user_said TEXT NOT NULL,
  correct TEXT NOT NULL,
  explanation TEXT,
  hsk_level INT,
  scenario TEXT,
  -- 来源对话
  source_conversation_id UUID REFERENCES conversations(id),
  -- 间隔重复算法（SM-2）
  review_count INT DEFAULT 0,
  next_review_at TIMESTAMPTZ DEFAULT NOW(),
  ease_factor FLOAT DEFAULT 2.5,
  interval_days INT DEFAULT 1,
  mastered BOOLEAN DEFAULT FALSE,
  -- 时间戳
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_reviewed_at TIMESTAMPTZ
);

-- 索引：今天要复习的错题
CREATE INDEX idx_mistakes_user_review
  ON mistakes(user_id, next_review_at)
  WHERE NOT mastered;

-- ============ HSKK 模考 ============
CREATE TABLE hskk_tests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  level TEXT NOT NULL CHECK (level IN ('beginner', 'intermediate', 'advanced')),
  -- 三段录音（R2 路径）
  section_read_audio TEXT,      -- 朗读部分
  section_qa_audio TEXT,        -- 问答部分
  section_picture_audio TEXT,   -- 看图说话
  -- 三段转录
  section_read_text TEXT,
  section_qa_text JSONB,        -- [{question, answer}]
  section_picture_text TEXT,
  -- 总评分（0-100）
  total_score INT,
  pronunciation_score INT,
  fluency_score INT,
  grammar_score INT,
  vocabulary_score INT,
  content_score INT,
  -- 详细反馈
  feedback JSONB,
  -- 时间戳
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX idx_hskk_user_created
  ON hskk_tests(user_id, created_at DESC);

-- ============ 场景库（静态数据） ============
CREATE TABLE scenarios (
  id TEXT PRIMARY KEY, -- 'restaurant', 'taxi', ...
  name JSONB NOT NULL, -- {"en": "Restaurant", "zh": "餐厅"}
  description JSONB NOT NULL,
  recommended_hsk INT[] NOT NULL,
  duration_minutes INT DEFAULT 5,
  ai_persona TEXT NOT NULL,
  scenario_prompt TEXT NOT NULL,
  goals JSONB DEFAULT '[]'::jsonb,
  is_active BOOLEAN DEFAULT TRUE,
  sort_order INT DEFAULT 0
);

-- ============ 使用统计（限流用） ============
CREATE TABLE usage_stats (
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  conversation_seconds INT DEFAULT 0,
  conversation_count INT DEFAULT 0,
  hskk_count INT DEFAULT 0,
  PRIMARY KEY (user_id, date)
);

-- ============ Row Level Security ============
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_turns ENABLE ROW LEVEL SECURITY;
ALTER TABLE mistakes ENABLE ROW LEVEL SECURITY;
ALTER TABLE hskk_tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_stats ENABLE ROW LEVEL SECURITY;

-- 用户只能访问自己的数据
CREATE POLICY "Users read own profile" ON profiles
  FOR SELECT USING (auth_id = auth.uid());

CREATE POLICY "Users update own profile" ON profiles
  FOR UPDATE USING (auth_id = auth.uid());

CREATE POLICY "Users CRUD own subscriptions" ON subscriptions
  FOR ALL USING (user_id IN (
    SELECT id FROM profiles WHERE auth_id = auth.uid()
  ));

CREATE POLICY "Users CRUD own conversations" ON conversations
  FOR ALL USING (user_id IN (
    SELECT id FROM profiles WHERE auth_id = auth.uid()
  ));

CREATE POLICY "Users read own turns" ON conversation_turns
  FOR SELECT USING (
    conversation_id IN (
      SELECT id FROM conversations WHERE user_id IN (
        SELECT id FROM profiles WHERE auth_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users CRUD own mistakes" ON mistakes
  FOR ALL USING (user_id IN (
    SELECT id FROM profiles WHERE auth_id = auth.uid()
  ));

CREATE POLICY "Users CRUD own hskk_tests" ON hskk_tests
  FOR ALL USING (user_id IN (
    SELECT id FROM profiles WHERE auth_id = auth.uid()
  ));

CREATE POLICY "Users read own usage_stats" ON usage_stats
  FOR SELECT USING (user_id IN (
    SELECT id FROM profiles WHERE auth_id = auth.uid()
  ));

-- 场景库所有人可读
CREATE POLICY "Anyone can read active scenarios" ON scenarios
  FOR SELECT USING (is_active = TRUE);
```

## 3.2 触发器：注册时自动建 profile

```sql
-- 当 auth.users 新增用户时，自动在 profiles 建记录
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (auth_id, email)
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
```

---

# Part 4：技术栈详细选择

## 4.1 前端

| 组件 | 选型 | 理由 |
|------|------|------|
| 框架 | **Next.js 14 (App Router)** | 全栈一体 + SSR + PWA |
| UI 库 | **shadcn/ui + Radix** | 现代、可定制、a11y |
| 样式 | **Tailwind CSS 3** | 快速、一致 |
| 状态管理 | **Zustand** | 轻量、不啰嗦 |
| 数据请求 | **TanStack Query** | 缓存 + 重试 |
| Supabase 客户端 | **@supabase/ssr + @supabase/supabase-js** | App Router 友好 |
| 音频处理 | **Web Audio API + MediaRecorder** | 浏览器原生 |
| WebSocket | **原生 WebSocket API** | 简单可靠 |
| PWA | **@ducanh2912/next-pwa** | Service Worker |
| 图表 | **Recharts** | 进度仪表盘 |
| 表单 | **React Hook Form + Zod** | 类型安全 |
| 动画 | **Framer Motion** | 微交互 |

## 4.2 后端（Cloudflare Workers）

| 组件 | 选型 | 理由 |
|------|------|------|
| 运行时 | **Cloudflare Workers**（Next.js API Routes 部署到 Workers） | 全球低延迟 |
| WebSocket | **Cloudflare Durable Objects** | 实时音频流（同一会话需要状态） |
| 认证 | **Supabase Auth (GoTrue)** | 集成 DB，免费 |
| 数据库 | **Supabase Postgres** | 成熟、生态强 |
| 对象存储 | **Cloudflare R2** | 音频文件（比 S3 便宜） |
| 缓存 | **Cloudflare KV** | Session/限流 |
| 队列 | **Cloudflare Queues** | HSKK 异步评分 |
| 错误监控 | **Sentry** | 标配 |

## 4.3 AI 服务（火山引擎 5 产品 + DeepSeek）

| 服务 | 用途 | 调用方式 |
|------|------|---------|
| **DeepSeek V3** | 对话生成 + 错误分析 + 评分 | HTTP（流式） |
| **火山引擎流式 ASR** | 实时对话 | WebSocket |
| **火山引擎一句话 ASR** | 短练习 | HTTP |
| **火山引擎录音 ASR** | HSKK 模考 | HTTP 异步 |
| **火山引擎豆包 TTS** | 主 TTS | WebSocket 流式 |
| **火山引擎标准 TTS** | 便宜兜底 | HTTP |

## 4.4 支付与邮件

| 服务 | 用途 | 理由 |
|------|------|------|
| **Lemon Squeezy** | MoR 订阅支付 | 中国友好、全球 VAT 处理 |
| **Resend** | 事务邮件 | 开发者友好、免费 3000/月 |

---

# Part 5：产品功能详细设计

## 5.1 用户旅程

```
首次访问 chatmandarin.cc
  ↓
3 秒上手（无注册墙）
  ↓ 选 HSK 等级（1-6）+ 场景
第一次免费对话（5 分钟）
  ↓ 体验惊艳
对话结束 → 推荐注册（保存进度）
  ↓
注册（Supabase Auth：Email/Google/GitHub）
  ↓ 自动建 profile + free 订阅
主界面（继续对话 / HSKK 模考 / 错题本）
  ↓
达到免费额度（5 min/day）→ 升级弹窗
  ↓
升级页面（Lemon Squeezy Checkout）
  ↓ 支付成功 → Webhook 更新订阅
付费用户：无限对话 + HSKK + 全部场景
```

## 5.2 五大页面

### Page 1：Dashboard（首页）
```
┌──────────────────────────────────────────┐
│  ChatMandarin        🔔 Streak: 7 days   │
├──────────────────────────────────────────┤
│  你好，Tom！                              │
│  HSK 4 · 47 conversations · 89% accuracy │
├──────────────────────────────────────────┤
│  📊 你的进度                              │
│  Pronunciation: ████████░░ 78%           │
│  Grammar:        █████████░ 89%          │
│  Vocabulary:     ██████░░░░ 62%          │
├──────────────────────────────────────────┤
│  ⚡ 今日推荐                              │
│  [🎤 餐厅点餐 - HSK 3]                    │
│  [🎤 HSKK 模考 中级]                      │
│  [📖 复习错题 3 个]                       │
├──────────────────────────────────────────┤
│  📈 本周训练曲线                          │
│  [折线图：每天 accuracy 趋势]             │
└──────────────────────────────────────────┘
```

### Page 2：对话练习（核心）
```
┌──────────────────────────────────────────┐
│  ← 返回   餐厅点餐 · HSK 3                │
├──────────────────────────────────────────┤
│  🤖 你好，请问几位？                      │
│                                          │
│            🗣 你：我们两位 [波形]         │
│                                          │
│  🤖 好的，窗边还是里面？                  │
│                                          │
│            🗣 你：窗边可以吗？            │
├──────────────────────────────────────────┤
│  ⚡ 实时反馈                              │
│  发音 95 | 流畅 80 | 语法 92 | 用词 88    │
│  💡 "可以吗" 地道，"行吗" 更口语          │
├──────────────────────────────────────────┤
│  [🎤 按住说话] 或 [空格键]               │
└──────────────────────────────────────────┘
```

### Page 3：HSKK 模考
```
┌──────────────────────────────────────────┐
│  HSKK 中级模考                            │
├──────────────────────────────────────────┤
│  Section 1/3 · 朗读                      │
│  ─────────────                           │
│  请朗读下面这段文字（30 秒准备）：         │
│                                          │
│  "中国是一个很大的国家，北方和南方..."    │
│                                          │
│  准备时间：00:23                          │
│  [开始录音]                              │
└──────────────────────────────────────────┘
```

### Page 4：错题本
```
┌──────────────────────────────────────────┐
│  错题本                                   │
├──────────────────────────────────────────┤
│  🔴 今天要复习（3 个）                    │
│  ─────────────                           │
│  💬 "想要" vs "想来一份"                  │
│     你说："我想要..."                     │
│     更地道："想来一份"                    │
│     [详情]                               │
│                                          │
│  🗣 第三声调 mǎi → mǎ                     │
│     你发音：māi（第一声）                  │
│     标准：mǎi（先降后升）                  │
│     [🎧 对比]                            │
├──────────────────────────────────────────┤
│  📅 已掌握（29 个）                       │
└──────────────────────────────────────────┘
```

### Page 5：设置
```
┌──────────────────────────────────────────┐
│  设置                                     │
├──────────────────────────────────────────┤
│  纠错模式                                 │
│  ◉ 朋友模式（默认，自然融入）              │
│  ○ 老师模式（严格指出）                   │
│  ○ 讲解模式（详细解释）                   │
├──────────────────────────────────────────┤
│  AI 语速                                  │
│  ○ 慢  ◉ 正常  ○ 快                      │
├──────────────────────────────────────────┤
│  订阅                                     │
│  Current: Free                           │
│  [Upgrade to Plus - $14.99/mo]           │
├──────────────────────────────────────────┤
│  账号                                     │
│  Email: tom@example.com                  │
│  [Logout]                                │
└──────────────────────────────────────────┘
```

## 5.3 核心功能详解

### Feature 1：HSK 分级 AI 对话

**HSK 词汇库**（开源）：
```
public/hsk/
  ├── hsk1.json （500 词）
  ├── hsk2.json （1200 词）
  ├── hsk3.json （2500 词）
  ├── hsk4.json （4500 词）
  ├── hsk5.json （8500 词）
  └── hsk6.json （12000 词）
```

**System Prompt 模板（HSK 3 + 餐厅场景 + 朋友模式）**：
```
You are ChatMandarin, an AI Chinese tutor.

User profile:
- HSK level: 3
- Correction mode: friendly

STRICT VOCABULARY RULES:
- Use ONLY words from HSK 1, 2, 3 vocabulary lists
- NEVER use HSK 4+ words
- If a concept requires HSK 4+, use HSK 1-3 alternative

CONVERSATION RULES:
- You are a friendly waiter at a Chinese restaurant
- Ask about: number of people, seating, ordering, drinks
- Keep replies SHORT: under 25 characters
- Naturally model correct Chinese
- If user makes an error, don't say "wrong"
  Instead, use the correct form in your reply

OUTPUT FORMAT (JSON only, no markdown):
{
  "reply": "你的回复（中文）",
  "errors": [
    {
      "type": "tone|grammar|word|fluency",
      "user_said": "用户原话",
      "correct": "正确版本",
      "explanation": "为什么错（一句话，英文）",
      "severity": "low|medium|high"
    }
  ],
  "scores": {
    "pronunciation": 0-100,
    "grammar": 0-100,
    "word_choice": 0-100,
    "fluency": 0-100
  },
  "conversation_complete": false
}
```

### Feature 2：实时反馈（4 维度）

**发音评分（声调）**：
- V1：用 pypinyin 从转录文本生成标准声调 → 用户音频 F0 对比（librosa）
- V2：训练专门的中文声调评分模型

**语法评分**：DeepSeek 在 JSON 输出里给（基于错误数量）

**用词评分**：DeepSeek 评估（是否用了"更地道"的表达）

**流畅度评分**：VAD 算停顿时长，总停顿 < 10% = 100 分

### Feature 3：HSKK 模考

**3 个 Section**：
1. **朗读**：200-400 字短文，30 秒准备，朗读录音
2. **问答**：3 个问题（音频播放），每题 30 秒回答
3. **看图说话**：1 张图，30 秒准备，说 1 分钟

**评分流程**：
1. 录音上传到 R2
2. Cloudflare Queues 异步任务
3. 火山引擎录音文件 ASR（异步转录）
4. DeepSeek 多维度评分（pronunciation/fluency/grammar/vocabulary/content）
5. 存 Supabase + 生成 PDF 报告

### Feature 4：错题本 + 间隔重复（SM-2）

```typescript
// lib/srs.ts
export function updateSRS(mistake: Mistake, quality: number): Mistake {
  // quality: 0-5（用户回忆质量）
  let { ease_factor, interval_days, review_count } = mistake

  if (quality < 3) {
    interval_days = 1
  } else {
    if (review_count === 0) interval_days = 1
    else if (review_count === 1) interval_days = 6
    else interval_days = Math.round(interval_days * ease_factor)

    ease_factor = Math.max(1.3,
      ease_factor + 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)
    )
  }

  return {
    ...mistake,
    review_count: review_count + 1,
    interval_days,
    ease_factor,
    next_review_at: new Date(Date.now() + interval_days * 86400000),
    mastered: review_count >= 5 && quality >= 4
  }
}
```

### Feature 5：场景库（V1 5 个场景）

```typescript
// scenarios/restaurant.ts
export const restaurant = {
  id: 'restaurant',
  name: { en: 'Restaurant Ordering', zh: '餐厅点餐' },
  description: 'Order food at a Chinese restaurant',
  recommended_hsk: [2, 3, 4],
  duration_minutes: 5,
  ai_persona: '你是北京一家餐厅的服务员，年轻女性，态度友好',
  scenario_prompt: '用户走进来吃饭。引导他完成点餐流程：人数、座位、点菜、饮料、特殊需求',
  goals: [
    '成功点 2-3 个菜',
    '询问是否要饮料',
    '处理特殊需求（不要辣）'
  ],
  completion_criteria: {
    min_turns: 6,
    min_vocab_used: 15
  }
}
```

### Feature 6：免费额度 + 升级

**免费**：
- 每天 5 分钟对话
- 每天 1 个场景
- 基础反馈

**触发升级**：
- 达到免费额度
- HSKK 模考想看报告
- 错题超 10 个想复习
- 第 3 次对话后（养成习惯）

---

# Part 6：核心 API 端点

```typescript
// app/api/chat/stream/route.ts（WebSocket 升级）
export async function GET(req: Request) {
  // 1. Supabase Auth 验证 JWT
  const user = await getUserFromRequest(req)
  if (!user) return new Response('Unauthorized', { status: 401 })

  // 2. 检查免费额度（Cloudflare KV）
  const today = new Date().toISOString().split('T')[0]
  const usageKey = `usage:${user.id}:${today}`
  const usage = JSON.parse((await env.KV.get(usageKey)) || '{"seconds":0}')
  const sub = await getSubscription(user.id)

  if (sub.plan === 'free' && usage.seconds >= 300) {
    return new Response('Daily limit reached', { status: 429 })
  }

  // 3. 升级 WebSocket（Durable Object）
  const id = env.CONVERSATION_DO.idFromName(user.id)
  return env.CONVERSATION_DO.fetch(req)
}

// app/api/hskk/grade/route.ts
export async function POST(req: Request) {
  const user = await getUserFromRequest(req)
  if (!user) return new Response('Unauthorized', { status: 401 })

  // 1. 上传 3 段音频到 R2
  const audioPaths = await uploadToR2(req.body)

  // 2. 入队异步评分
  await env.HSKK_QUEUE.send(JSON.stringify({
    user_id: user.id,
    audio_paths: audioPaths,
    level: 'intermediate'
  }))

  return Response.json({ status: 'processing', estimated_time: 30 })
}

// app/api/lemonsqueezy/webhook/route.ts
export async function POST(req: Request) {
  // 1. 验证签名
  const signature = req.headers.get('X-Signature')
  const body = await req.text()
  if (!verifySignature(body, signature)) {
    return new Response('Invalid signature', { status: 401 })
  }

  // 2. 处理事件
  const event = JSON.parse(body)
  switch (event.meta.event_name) {
    case 'subscription_created':
    case 'subscription_updated':
      await updateSubscription(event.data)
      break
    case 'subscription_cancelled':
      await cancelSubscription(event.data)
      break
  }

  return new Response('OK')
}
```

---

# Part 7：Durable Object（实时对话状态）

```typescript
// workers/conversation-do.ts
export class ConversationDO implements DurableObject {
  state: DurableObjectState
  env: Env

  async fetch(req: Request) {
    const pair = new WebSocketPair()
    await this.handleSession(pair[1])
    return new Response(null, { status: 101, webSocket: pair[0] })
  }

  async handleSession(ws: WebSocket) {
    ws.accept()

    // 创建火山引擎 ASR WebSocket
    const asrWs = new WebSocket('wss://openspeech.bytedance.com/api/v2/asr')

    // 用户音频 → ASR
    ws.addEventListener('message', async (event) => {
      if (event.data instanceof ArrayBuffer) {
        asrWs.send(event.data) // 转发音频块
      }
    })

    // ASR 转录 → DeepSeek → TTS → 用户
    asrWs.addEventListener('message', async (event) => {
      const result = JSON.parse(event.data)
      if (result.is_final) {
        // 完整转录，调 DeepSeek
        const aiResponse = await callDeepSeek(result.text)
        // 调 TTS
        const audioStream = await callVolcengineTTS(aiResponse.reply)
        // 返回给用户
        ws.send(JSON.stringify({
          type: 'ai_response',
          text: aiResponse.reply,
          audio: audioStream,
          errors: aiResponse.errors,
          scores: aiResponse.scores
        }))
      } else {
        // 部分转录，实时显示
        ws.send(JSON.stringify({
          type: 'partial_transcript',
          text: result.text
        }))
      }
    })
  }
}
```

---

# Part 8：开发里程碑（6 周）

## Week 1：基础架构 + UI 骨架

**目标**：能跑的空壳

- [ ] Next.js 14 项目搭建（TypeScript + Tailwind + App Router）
- [ ] shadcn/ui 安装
- [ ] Supabase 项目创建 + schema 部署
- [ ] Supabase Auth 集成（Email + Google OAuth）
- [ ] Cloudflare Pages + Workers 部署
- [ ] 5 大页面骨架（Dashboard / 对话 / HSKK / 错题本 / 设置）
- [ ] 中间件：登录态保护

## Week 2：AI 对话核心（最难）

**目标**：能进行一次真实 AI 对话

- [ ] DeepSeek API 客户端
- [ ] 火山引擎流式 ASR WebSocket 客户端
- [ ] 火山引擎豆包 TTS 流式播放
- [ ] Web Audio API + MediaRecorder 录音
- [ ] 简单 VAD（停顿检测）
- [ ] Durable Object 实现 WebSocket 会话
- [ ] 端到端：用户说话 → AI 回复（延迟 < 4s）

## Week 3：反馈系统 + 错题本

**目标**：实时反馈工作，错题积累

- [ ] 声调分析（pypinyin + librosa，Python Worker）
- [ ] DeepSeek 错误分析 JSON 解析
- [ ] 反馈面板 UI（4 维度）
- [ ] 错题表 + 增删改查
- [ ] SM-2 间隔重复算法实现
- [ ] 错题本 UI + 复习流程

## Week 4：HSKK 模考 + 场景库

**目标**：完整 HSKK 流程

- [ ] HSKK 3 sections 实现
- [ ] 火山引擎录音文件 ASR（异步）
- [ ] Cloudflare Queues 集成
- [ ] 多维度评分（DeepSeek）
- [ ] 报告生成（PDF）
- [ ] 5 个场景定义（restaurant/taxi/intro/doctor/interview）

## Week 5：支付 + 用户系统

**目标**：能收钱

- [ ] Lemon Squeezy 账户设置
- [ ] 创建产品：Plus $14.99 / Pro $29
- [ ] Webhook 集成
- [ ] 订阅状态检查中间件
- [ ] 付费墙（5 min/day 限制）
- [ ] 升级页面 + Checkout
- [ ] Resend 邮件（订阅确认）

## Week 6：内测 + 优化

**目标**：准备 Beta

- [ ] 性能优化（音频流、网络）
- [ ] 移动端测试（iOS Safari, Android Chrome）
- [ ] Sentry 错误监控
- [ ] PWA 配置（manifest + icons）
- [ ] Lighthouse 优化（>90 分）
- [ ] Beta 用户招募（Waitlist）
- [ ] Bug 修复
- [ ] 正式 Beta 发布

---

# Part 9：项目目录结构

```
chatmandarin/
├── app/
│   ├── (marketing)/
│   │   ├── page.tsx              # Landing（复用现有）
│   │   └── layout.tsx
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   └── signup/page.tsx
│   ├── (app)/
│   │   ├── dashboard/page.tsx
│   │   ├── conversation/
│   │   │   └── [scenario]/page.tsx
│   │   ├── hskk/page.tsx
│   │   ├── mistakes/page.tsx
│   │   ├── settings/page.tsx
│   │   └── layout.tsx            # 应用主布局（含 nav）
│   ├── api/
│   │   ├── chat/stream/route.ts
│   │   ├── hskk/grade/route.ts
│   │   ├── lemonsqueezy/webhook/route.ts
│   │   └── admin/stats/route.ts
│   ├── layout.tsx
│   └── globals.css
├── components/
│   ├── ui/                       # shadcn/ui
│   ├── audio/
│   │   ├── recorder.tsx          # 麦克风 + VAD
│   │   ├── waveform.tsx
│   │   └── audio-player.tsx
│   ├── chat/
│   │   ├── conversation-view.tsx
│   │   ├── feedback-panel.tsx
│   │   └── scenario-picker.tsx
│   └── ...
├── workers/
│   ├── conversation-do.ts        # Durable Object
│   ├── hskk-grader.ts            # Queue consumer
│   └── types.ts
├── lib/
│   ├── ai/
│   │   ├── deepseek.ts
│   │   ├── volcengine-asr.ts
│   │   ├── volcengine-tts.ts
│   │   ├── tone-analyzer.ts
│   │   └── conversation-manager.ts
│   ├── db/
│   │   ├── supabase-client.ts
│   │   ├── profiles.ts
│   │   ├── conversations.ts
│   │   ├── mistakes.ts
│   │   └── hskk.ts
│   ├── auth/
│   │   └── middleware.ts         # Supabase Auth 中间件
│   ├── payment/
│   │   └── lemonsqueezy.ts
│   └── utils/
├── public/
│   ├── hsk/
│   │   ├── hsk1.json
│   │   └── ...
│   ├── scenarios/
│   ├── icons/
│   ├── logo.svg
│   ├── favicon.svg
│   └── manifest.json
├── supabase/
│   ├── migrations/
│   │   └── 001_init.sql          # 上面那段 SQL
│   └── seed.sql
├── wrangler.toml
├── next.config.js
├── tailwind.config.ts
├── package.json
└── README.md
```

---

# Part 10：成本预算（月度）

## 1000 用户场景（其中 100 付费）

| 项 | 月成本 | 备注 |
|----|-------|------|
| Cloudflare Pages | $0 | 免费 |
| Cloudflare Workers（100 万次/天） | $5 | 付费版 |
| Cloudflare R2（10GB 音频） | $1 | 便宜 |
| Cloudflare KV | $0.5 | 便宜 |
| Cloudflare Queues | $0 | 免费 |
| **Supabase**（25K MAU 免费） | **$0** | 免费层够用 |
| **DeepSeek API**（100 付费 × 100 对话） | **$5-15** | 极便宜 |
| **火山引擎 ASR + TTS** | **$100-200** | 大头 |
| Lemon Squeezy（5% 抽成） | $75（按 $1499 MRR） | - |
| Resend 邮件 | $0 | 免费 3000/月 |
| Sentry | $0 | 免费 |
| 域名 | $1 | 年化 |
| **总计** | **$187-297/月** | - |

**收入**：100 × $14.99 = $1,499
**毛利**：$1,200-1,300（80%+）

## 关键：Supabase 免费层 vs Pro

**免费层**（500MB DB + 50K MAU + 200MB Storage）：
- 适合 0-1000 用户
- 完全免费

**Pro 层**（$25/月，8GB DB + 100K MAU + 100GB Storage）：
- 适合 1000-10000 用户
- 必要时再升级

---

# Part 11：与之前 v1.0 文档的差异

| 维度 | v1.0（之前的） | v2.0（最终版） |
|------|--------------|---------------|
| Auth | Clerk | **Supabase Auth** |
| DB | Supabase | **Supabase**（不变） |
| 供应商数量 | 3（Clerk + Supabase + Cloudflare） | **2（Supabase + Cloudflare）** |
| 成本 | 多 $25/月（Clerk Pro） | 省 $25/月 |
| 自建 Auth | 否 | 否（Supabase 自带） |
| 工程量 | 标准 | 标准 |

---

# Part 12：立即可做（Week 1 启动）

## Step 1：开通账号（你做）

- [ ] **Supabase**：https://supabase.com 注册（GitHub 登录最快）
- [ ] **DeepSeek**：https://platform.deepseek.com 注册 + 充值 $10
- [ ] **火山引擎**：你已说没问题
- [ ] **Lemon Squeezy**：https://lemonsqueezy.com 注册
- [ ] **Resend**：https://resend.com 注册
- [ ] **Sentry**：https://sentry.io 注册（可选）

## Step 2：项目初始化（我做/你做）

```bash
npx create-next-app@latest chatmandarin \
  --typescript --tailwind --app --src-dir
cd chatmandarin
npx shadcn-ui@latest init
npm install @supabase/ssr @supabase/supabase-js \
  zustand @tanstack/react-query react-hook-form zod \
  @ducanh2912/next-pwa framer-motion recharts

# Supabase CLI（用于本地开发 + migration）
npm install -D supabase
```

## Step 3：部署 schema 到 Supabase

把 Part 3 的 SQL 粘贴到 Supabase SQL Editor → Run

---

# 决策点

## 决策 1：是否开始 Week 1 实施？
- A. 立即开始
- B. 等账号开通完
- C. 先看代码示例

## 决策 2：代码粒度
- A. 完整代码（每个文件给）
- B. 关键文件 + 架构
- C. 自己研究

## 决策 3：项目位置
- A. 在 D:/Wordspace/oversea/ChatMandarin/app/ 下建
- B. 新建独立目录
- C. 其他

---

**告诉我**：
1. 3 个决策
2. 已开通哪些账号
3. 是否需要我现在开始写 Week 1 实际代码
