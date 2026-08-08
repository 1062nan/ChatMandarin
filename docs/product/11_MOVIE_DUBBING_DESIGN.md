# ChatMandarin 影视配音功能完整设计文档

> 代号：DubMaster
> 定位：ChatMandarin V2 杀手级功能
> 目标：让用户"用中文给经典电影配音"来练口语

---

# 一、产品定位

## 一句话描述
> **选一段经典中国电影，听 AI 示范对白，你来配音，AI 评分你的发音 + 情感 + 节奏。**

## 为什么是杀手级功能

| 维度 | 详情 |
|------|------|
| **竞品空白** | HelloChinese、Duolingo、Speak 都没有 |
| **用户梦想** | "看中国电影学中文"是全球中文学习者的共同愿望 |
| **情感学习** | 中文不只有发音，还有语气（开心/生气/悲伤）—— 配音训练这些 |
| **社交传播** | 用户可以把配音片段分享到 TikTok / Instagram |
| **留存驱动** | "再试一次拿满分"心理 = 高复玩率 |

---

# 二、用户旅程

```
打开 DubMaster
  ↓
选择分类：
  🎬 经典电影（流浪地球、你好李焕英、长安三万里）
  📺 热门剧集（甄嬛传、庆余年、繁花）
  🎭 动画短片（更适合初学者，HSK 1-3）
  ↓
选择片段（每个 30秒-2分钟）
  ↓
进入配音流程（3 步）：

Step 1: 预览
  - 看视频片段（带中文字幕 + 拼音）
  - AI 用情感 TTS 示范对白
  - 显示每句的关键词汇 + 声调标注

Step 2: 练习
  - 逐句练习（AI 读 → 用户跟读 → 评分）
  - 可重复练习每一句
  - 难句自动加入错题本

Step 3: 正式配音
  - 完整播放片段（关闭原声）
  - 用户实时配音（看字幕读对白）
  - 全程录音

Step 4: 成片 + 评分
  - 播放用户的配音版本
  - AI 多维评分
  - 可分享到社交媒体
```

---

# 三、评分系统（5 维度）

| 维度 | 评分方式 | 权重 |
|------|---------|------|
| **发音准确度** | ASR 转录 vs 原文对比 | 30% |
| **声调正确率** | 逐字声调检测 | 25% |
| **情感匹配度** | DeepSeek 分析用户语气是否匹配场景 | 20% |
| **节奏同步** | 用户配音时序 vs 原片时间轴 | 15% |
| **流畅完整度** | 是否读完所有对白，停顿多少 | 10% |

### 评分输出示例

```
🎬 配音评分：85/100 ⭐⭐⭐⭐

🎙 发音准确度：90 分
   "流浪地球" → "流浪地 quen"（"球"读错）

🎵 声调正确率：88 分
   第三声调错误 2 次

🎭 情感匹配度：82 分
   这段是紧张的台词，你的语气偏平淡
   建议：加重语气，加快语速

⏱ 节奏同步：78 分
   第 3 句慢了 2 秒

💬 流畅度：87 分
   共 8 句对白，完成 8 句，停顿 3 次
```

---

# 四、内容库设计

## 片段数据结构

```typescript
interface DubbingClip {
  id: string                          // 'a-wandering-earth-01'
  title: string                       // '流浪地球 - 启动行星发动机'
  category: 'movie' | 'tv' | 'animation'
  posterImage: string                 // 封面图 URL
  clipVideoUrl: string                // 视频片段 URL（可选）
  durationSeconds: number             // 总时长
  hskLevel: number                    // 推荐等级
  difficulty: 'easy' | 'medium' | 'hard' | 'expert'

  // 每句对白
  lines: DubbingLine[]
}

interface DubbingLine {
  index: number                       // 第几句
  startTime: number                   // 开始时间（秒）
  endTime: number                     // 结束时间（秒）
  speaker: string                     // 说话人（'刘培强' / 'MOSS'）
  text: string                        // 中文对白
  pinyin: string                      // 拼音标注
  translation: string                 // 英文翻译
  emotion: 'happy' | 'sad' | 'angry' | 'neutral' | 'excited' | 'serious' | 'fearful'
  keyVocab: Array<{                   // 关键词汇
    word: string
    pinyin: string
    meaning: string
    hskLevel: number
  }>
}
```

## V1 片段库（10 个启动片段）

### 电影类（4 个）
```typescript
{
  id: 'wandering-earth-launch',
  title: '流浪地球 - 行星发动机',
  category: 'movie',
  hskLevel: 4,
  difficulty: 'hard',
  durationSeconds: 45,
  lines: [
    {
      index: 1,
      startTime: 0,
      endTime: 5,
      speaker: '刘培强',
      text: '地球，启程了。',
      pinyin: 'dì qiú, qǐ chéng le.',
      translation: 'Earth, we are departing.',
      emotion: 'serious',
      keyVocab: [
        { word: '地球', pinyin: 'dì qiú', meaning: 'Earth', hskLevel: 2 },
        { word: '启程', pinyin: 'qǐ chéng', meaning: 'set off', hskLevel: 5 }
      ]
    },
    {
      index: 2,
      startTime: 5,
      endTime: 12,
      speaker: 'MOSS',
      text: '发动机功率已达百分之百，地球正在离开太阳系。',
      pinyin: 'fā dòng jī gōng lǜ yǐ dá bǎi fēn zhī bǎi...',
      translation: 'Engine power at 100%, Earth is leaving the solar system.',
      emotion: 'neutral',
      keyVocab: [
        { word: '发动机', pinyin: 'fā dòng jī', meaning: 'engine', hskLevel: 4 },
        { word: '功率', pinyin: 'gōng lǜ', meaning: 'power', hskLevel: 5 }
      ]
    },
    // ...更多对白
  ]
}
```

### 动画类（3 个，HSK 1-3 友好）
- 《大鱼海棠》经典片段（情感丰富，词汇简单）
- 《哪吒之魔童降世》"我命由我不由天"（励志，简单有力）
- 《长安三万里》诗词朗诵场景

### 剧集类（3 个）
- 《甄嬛传》经典宫斗对白（高级中文）
- 《庆余年》搞笑片段（口语化）
- 《繁花》上海生活场景（生活化）

---

# 五、技术架构

## 系统流程

```
用户选片段
  ↓
Step 1 预览：
  TTS 情感版 → 逐句生成示范对白（带情感）
  ↓
Step 2 练习：
  逐句：TTS 播放示范 → 用户录音 → ASR → 对比评分
  ↓
Step 3 正式配音：
  全程录音 → ASR 转录全文
  ↓
Step 4 评分：
  ASR 转录 vs 原文 → 发音分
  声调检测 → 声调分
  DeepSeek 分析语气 → 情感分
  时间轴对比 → 节奏分
  完整度统计 → 流畅分
```

## API 设计

### 1. 获取片段列表
```
GET /api/dubbing/clips?category=movie&hsk_level=4
→ { clips: DubbingClip[] }
```

### 2. 获取单个片段详情
```
GET /api/dubbing/clips/:id
→ { clip: DubbingClip }
```

### 3. 逐句练习评分
```
POST /api/dubbing/practice
Body: { clip_id, line_index, audio: WAV }
→ {
    transcript: "用户说的",
    original: "原文",
    pronunciation_score: 88,
    tone_errors: [{ word: "球", expected: "qiú", got: "qū" }],
    suggestions: "注意第二声'球'的声调"
  }
```

### 4. 正式配音评分
```
POST /api/dubbing/perform
Body: { clip_id, audio: WAV (完整录音) }
→ {
    scores: {
      pronunciation: 90,
      tone: 88,
      emotion: 82,
      rhythm: 78,
      fluency: 87
    },
    total: 85,
    line_by_line: [...],  // 逐句对比
    highlights: "你的情感表达很到位！",
    improvements: "注意第三句的节奏，慢了2秒"
  }
```

### 5. 获取示范 TTS
```
POST /api/dubbing/demo
Body: { text, emotion: "serious", voice_type: "BV701_streaming" }
→ { audio: "base64-mp3" }
```

---

# 六、情感 TTS 集成

## 普通版（无情感 TTS 时）
```
用豆包语音合成2.0（已有）
所有句子用相同语气读
```

## 增强版（开通情感预测版后）
```
用精品长文本语音合成-情感预测版
AI 自动识别文本情感 → 选择合适语气
  悲伤的句子 → 低沉慢速
  愤怒的句子 → 快速有力
  开心的句子 → 明快上扬
```

## 情感映射
```typescript
const EMOTION_TO_TTS_PARAMS = {
  happy:    { speed_ratio: 1.1, volume: 1.2, pitch: 1.1 },
  sad:      { speed_ratio: 0.8, volume: 0.8, pitch: 0.9 },
  angry:    { speed_ratio: 1.2, volume: 1.3, pitch: 1.0 },
  serious:  { speed_ratio: 0.95, volume: 1.0, pitch: 0.95 },
  excited:  { speed_ratio: 1.15, volume: 1.2, pitch: 1.15 },
  fearful:  { speed_ratio: 1.0, volume: 0.7, pitch: 1.1 },
  neutral:  { speed_ratio: 1.0, volume: 1.0, pitch: 1.0 }
}
```

---

# 七、评分算法详细设计

## 1. 发音准确度（30%）

```typescript
function scorePronunciation(transcript: string, original: string): number {
  // 1. 文本对齐（编辑距离算法）
  const alignment = alignTexts(transcript, original)

  // 2. 统计匹配率
  let correct = 0
  let total = 0
  for (const char of alignment) {
    total++
    if (char.match) correct++
  }

  // 3. 扣分规则
  // - 完全匹配：+1
  // - 近音（声母/韵母对但声调错）：+0.5
  // - 完全不匹配：0

  return Math.round((correct / total) * 100)
}
```

## 2. 声调正确率（25%）

```typescript
function scoreTones(transcript: string, original: string): ToneResult {
  const transcriptPinyin = getPinyin(transcript)  // pypinyin
  const originalPinyin = getPinyin(original)

  const errors: ToneError[] = []
  let correct = 0
  let total = 0

  for (let i = 0; i < originalPinyin.length; i++) {
    total++
    if (transcriptPinyin[i].tone === originalPinyin[i].tone) {
      correct++
    } else {
      errors.push({
        char: original[i],
        expected: originalPinyin[i].tone,
        got: transcriptPinyin[i].tone
      })
    }
  }

  return { score: Math.round((correct / total) * 100), errors }
}
```

## 3. 情感匹配度（20%）

```typescript
async function scoreEmotion(
  transcript: string,
  expectedEmotion: string,
  clipContext: string
): Promise<number> {
  const prompt = `You are scoring a student's movie dubbing performance.

Scene context: ${clipContext}
Expected emotion: ${expectedEmotion}
Student's actual delivery (transcribed): "${transcript}"

Rate the emotional match (0-100):
- Does the word choice reflect the expected emotion?
- Are intensifiers/exclamations present where appropriate?
- Is the formality level appropriate?

Return JSON: { "score": 0-100, "feedback": "short explanation" }`

  const result = await deepseek.chat(prompt)
  return result.score
}
```

## 4. 节奏同步（15%）

```typescript
function scoreRhythm(
  userAudioDuration: number,
  clipDuration: number,
  lineTimings: Array<{ start: number; end: number }>,
  userSilences: number[]
): number {
  // 用户总时长 vs 片段总时长
  const durationRatio = Math.min(userAudioDuration / clipDuration, 1)
  let score = durationRatio * 60  // 时长匹配占 60%

  // 停顿位置是否合理
  // 如果用户在句间停顿（合理），不扣分
  // 如果用户在句中停顿（不合理），扣分
  const appropriateSilences = userSilences.filter(s =>
    isBetweenLines(s, lineTimings)
  ).length
  const totalSilences = userSilences.length
  if (totalSilences > 0) {
    score += (appropriateSilences / totalSilences) * 40
  } else {
    score += 40
  }

  return Math.round(Math.min(score, 100))
}
```

## 5. 流畅完整度（10%）

```typescript
function scoreFluency(
  totalLines: number,
  completedLines: number,
  pauseCount: number,
  avgPauseDuration: number
): number {
  // 完成率
  const completionRate = completedLines / totalLines

  // 停顿惩罚
  const pausePenalty = Math.min(pauseCount * 3, 30)  // 每次停顿扣 3 分，最多扣 30

  // 长停顿额外惩罚
  const longPausePenalty = avgPauseDuration > 3 ? 10 : 0

  return Math.round(Math.max(0, completionRate * 100 - pausePenalty - longPausePenalty))
}
```

---

# 八、前端界面设计

### Page 1：片段选择
```
┌──────────────────────────────────────────┐
│  🎬 DubMaster · Movie Dubbing            │
├──────────────────────────────────────────┤
│  分类：[电影] [剧集] [动画]               │
│  等级：[HSK 1-3] [HSK 4-5] [HSK 6+]     │
├──────────────────────────────────────────┤
│                                          │
│  ┌──────────┐  ┌──────────┐            │
│  │ 🎬 封面图  │  │ 🎬 封面图  │           │
│  │ 流浪地球  │  │ 你好李焕英 │           │
│  │ HSK 4 ·硬│  │ HSK 3 ·中 │           │
│  │ 45秒·8句 │  │ 60秒·6句  │           │
│  │ ⭐ 85 最高│  │ ⭐ — 新  │           │
│  └──────────┘  └──────────┘            │
│                                          │
│  ┌──────────┐  ┌──────────┐            │
│  │ 🎭 哪吒   │  │ 📺 甄嬛传 │           │
│  │ HSK 2 ·易│  │ HSK 5+ ·极│          │
│  └──────────┘  └──────────┘            │
│                                          │
└──────────────────────────────────────────┘
```

### Page 2：练习模式（逐句）
```
┌──────────────────────────────────────────┐
│  ← 返回   流浪地球 - 行星发动机    HSK 4  │
├──────────────────────────────────────────┤
│                                          │
│  第 2/8 句                               │
│  ─────────                               │
│  🔊 AI 示范                              │
│  ┌─────────────────────────────────────┐ │
│  │ 🎙 MOSS：                             │ │
│  │ 发动机功率已达百分之百，              │ │
│  │ 地球正在离开太阳系。                  │ │
│  │                                      │ │
│  │ fā dòng jī gōng lǜ yǐ dá...         │ │
│  │                                      │ │
│  │ 关键词：                              │ │
│  │ 发动机(HSK4) 功率(HSK5) 百分之百     │ │
│  │                                      │ │
│  │ 情感：🟦 严肃                         │ │
│  └─────────────────────────────────────┘ │
│  [▶ 播放示范]  [🔊 慢速示范]             │
│                                          │
│  ─────────                               │
│  🗣 你的跟读                             │
│  [🎤 按住跟读这句]                       │
│                                          │
│  上次成绩：发音 88 · 声调 92             │
│  💡 "功率" 的 "率" 是第四声（lü）        │
│                                          │
│  [← 上一句]  [下一句 →]                  │
│  进度：●●○○○○○○ (2/8)                   │
└──────────────────────────────────────────┘
```

### Page 3：正式配音
```
┌──────────────────────────────────────────┐
│  🎬 正式配音                              │
├──────────────────────────────────────────┤
│                                          │
│  准备好了吗？                            │
│  你将看完整段片段，并实时配音。           │
│  原声会被关闭，你看到字幕读出来。         │
│                                          │
│  提示：                                  │
│  · 尽量跟上字幕的节奏                    │
│  · 注意情感表达（MOSS 是冷静的 AI）      │
│  · 读错不要停，继续往下读                │
│                                          │
│  [🎬 开始配音]                           │
│                                          │
│  倒计时：3... 2... 1... 开始！           │
│  ─────────                               │
│  [实时显示当前字幕]                      │
│  [实时显示进度条]                        │
│  [🎙 录音中...]                          │
│                                          │
└──────────────────────────────────────────┘
```

### Page 4：评分 + 成片
```
┌──────────────────────────────────────────┐
│  🎬 配音完成！                            │
├──────────────────────────────────────────┤
│                                          │
│  🏆 总分：85/100 ⭐⭐⭐⭐                 │
│  新纪录！                                │
│                                          │
│  🎙 发音准确度：90 █████████░            │
│  🎵 声调正确率：88 ████████░░            │
│  🎭 情感匹配度：82 ████████░░            │
│  ⏱ 节奏同步：78 ███████░░░              │
│  💬 流畅完整度：87 ████████░░            │
│                                          │
│  ─────────                               │
│  📝 逐句对比                              │
│                                          │
│  第1句 ✅ 完美                           │
│  第2句 ⚠️ "功率"读成了"gōng lǜ"         │
│        应该是"gōng lǜ"（第四声）         │
│  第3句 ❌ 漏了"太阳系"                   │
│  第4句 ✅ 完美                           │
│  ...                                    │
│                                          │
│  ─────────                               │
│  🎧 听你的配音                           │
│  [▶ 播放你的版本]                        │
│  [▶ 播放 AI 示范版]                      │
│  [▶ 对比播放]                            │
│                                          │
│  ─────────                               │
│  [🔄 再来一次]                           │
│  [📤 分享到 X/Reddit]                    │
│  [🏠 返回片段选择]                       │
│                                          │
└──────────────────────────────────────────┘
```

---

# 九、数据库设计

```sql
-- 配音片段（静态内容）
CREATE TABLE dubbing_clips (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  category TEXT NOT NULL, -- movie / tv / animation
  poster_image TEXT,
  clip_video_url TEXT,
  duration_seconds INT NOT NULL,
  hsk_level INT NOT NULL,
  difficulty TEXT NOT NULL,
  lines JSONB NOT NULL, -- DubbingLine[]
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 用户配音记录
CREATE TABLE dubbing_performances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  clip_id TEXT NOT NULL REFERENCES dubbing_clips(id),
  -- 评分
  total_score INT,
  pronunciation_score INT,
  tone_score INT,
  emotion_score INT,
  rhythm_score INT,
  fluency_score INT,
  -- 详细数据
  transcript TEXT,
  line_scores JSONB, -- 逐句评分
  -- 音频
  audio_path TEXT, -- R2 存储
  -- 元数据
  mode TEXT, -- 'practice' | 'perform'
  is_personal_best BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_dubbing_user_clip ON dubbing_performances(user_id, clip_id, created_at DESC);
```

---

# 十、版权处理方案

## ⚠️ 关键问题

直接使用电影视频 + 原声音频 = **侵权**。

## 解决方案

### 方案 A：只用文本（推荐 V1）
- **不嵌入电影视频**
- 只用"对白文本"（从公开剧本/字幕提取）
- AI 生成情感语音替代原声
- 配合静态图片/插画展示场景
- **版权风险：低**（文本引用属合理使用）

### 方案 B：用户自带视频
- 用户上传自己拥有的电影片段
- 系统只提供字幕 + AI 示范 + 评分
- **版权风险：零**（用户自行承担）

### 方案 C：授权合作（V3）
- 与爱奇艺/优酷等平台合作
- 获取正版片段授权
- **版权风险：零**，但商务成本高

### 推荐：V1 用方案 A，V2 加方案 B

---

# 十一、开发计划

## Phase 1（2 周）：核心功能
- [ ] 数据库表创建
- [ ] 片段内容库（10 个片段，手工编写对白）
- [ ] 片段选择 UI
- [ ] 逐句练习模式（TTS 示范 + 用户录音 + 评分）
- [ ] 基础评分（发音 + 声调）

## Phase 2（1 周）：正式配音
- [ ] 全程录音模式
- [ ] 完整评分（5 维度）
- [ ] 成片播放 + 对比
- [ ] 个人最佳记录

## Phase 3（1 周）：社交 + 优化
- [ ] 分享功能
- [ ] 排行榜
- [ ] 更多片段（扩展到 30 个）
- [ ] 情感 TTS 集成（如已开通）

**总工期：4 周**

---

# 十二、单元经济

| 项 | 成本 |
|----|------|
| 每次配音练习（逐句模式） | |
| - ASR（8 句 × 5 秒 = 40 秒） | ~$0.003 |
| - TTS（8 句 × 15 字 = 120 字） | ~$0.001 |
| - DeepSeek（8 次评分） | ~$0.002 |
| **每次练习总成本** | **~$0.006** |
| **每次正式配音** | **~$0.008** |
| 月重度用户（100 次练习） | **~$0.6/月** |
| 售价（Plus $14.99/月） | **毛利率 96%** |

---

# 十三、与现有产品的集成

| 现有功能 | 配音功能联动 |
|---------|------------|
| **错题本** | 配音中的声调错误自动进入错题本 SRS |
| **Dashboard** | 显示"最近配音最高分" |
| **设置** | 配音功能需要 Plus 订阅 |
| **HSK 分级** | 片段按 HSK 级别分类 |
| **场景对话** | 配音片段可关联到相似场景练习 |

---

**文档完成。** 这是一份可以直接交给开发团队执行的详细设计。

**告诉我**：
1. 要我开始写配音功能的代码吗？
2. 还是先做 V1 增强功能（影子跟读 + 多音色）？
3. 对设计有什么调整意见？