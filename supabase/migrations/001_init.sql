-- =====================================================
-- ChatMandarin 数据库初始化（v1.0）
-- 在 Supabase SQL Editor 运行此文件
-- =====================================================

-- 启用必要的扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============ profiles（用户资料） ============
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  hsk_level SMALLINT DEFAULT 1 CHECK (hsk_level BETWEEN 1 AND 6),
  correction_mode TEXT DEFAULT 'friendly' CHECK (correction_mode IN ('friendly', 'strict', 'tutor')),
  audio_speed REAL DEFAULT 1.0 CHECK (audio_speed BETWEEN 0.5 AND 2.0),
  preferred_language TEXT DEFAULT 'en',
  -- 训练统计（缓存）
  total_conversations INT DEFAULT 0,
  total_minutes INT DEFAULT 0,
  current_streak INT DEFAULT 0,
  longest_streak INT DEFAULT 0,
  last_practice_date DATE,
  -- 时间戳
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============ subscriptions（订阅） ============
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  lemon_squeezy_id TEXT UNIQUE,
  plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'plus', 'pro')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'canceled', 'past_due', 'trialing', 'expired')),
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status) WHERE status = 'active';

-- ============ conversations（对话会话） ============
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  scenario TEXT NOT NULL,
  hsk_level SMALLINT NOT NULL,
  correction_mode TEXT NOT NULL,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  total_turns INT DEFAULT 0,
  avg_pronunciation REAL,
  avg_grammar REAL,
  avg_fluency REAL,
  avg_word_choice REAL
);

CREATE INDEX IF NOT EXISTS idx_conversations_user_started ON conversations(user_id, started_at DESC);

-- ============ conversation_turns（对话单轮） ============
CREATE TABLE IF NOT EXISTS conversation_turns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  turn_index INT NOT NULL,
  user_text TEXT,
  ai_text TEXT,
  user_audio_path TEXT,  -- R2 路径（仅 HSKK 或 debug 模式）
  ai_audio_path TEXT,
  pronunciation_score SMALLINT,
  grammar_score SMALLINT,
  fluency_score SMALLINT,
  word_choice_score SMALLINT,
  errors JSONB DEFAULT '[]'::jsonb,
  user_audio_duration_ms INT,
  ai_response_latency_ms INT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_turns_conversation ON conversation_turns(conversation_id);

-- ============ mistakes（错题本） ============
CREATE TABLE IF NOT EXISTS mistakes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('tone', 'grammar', 'word', 'fluency')),
  user_said TEXT NOT NULL,
  correct TEXT NOT NULL,
  explanation TEXT,
  hsk_level SMALLINT,
  scenario TEXT,
  source_conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
  -- SM-2 间隔重复
  review_count INT DEFAULT 0,
  next_review_at TIMESTAMPTZ DEFAULT NOW(),
  ease_factor REAL DEFAULT 2.5 CHECK (ease_factor >= 1.3),
  interval_days INT DEFAULT 1,
  mastered BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_reviewed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_mistakes_user_review
  ON mistakes(user_id, next_review_at) WHERE NOT mastered;
CREATE INDEX IF NOT EXISTS idx_mistakes_user_type ON mistakes(user_id, type);

-- ============ hskk_tests（HSKK 模考） ============
CREATE TABLE IF NOT EXISTS hskk_tests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  level TEXT NOT NULL CHECK (level IN ('beginner', 'intermediate', 'advanced')),
  section_read_audio TEXT,
  section_qa_audio TEXT,
  section_picture_audio TEXT,
  section_read_text TEXT,
  section_qa_text JSONB DEFAULT '[]'::jsonb,
  section_picture_text TEXT,
  total_score SMALLINT,
  pronunciation_score SMALLINT,
  fluency_score SMALLINT,
  grammar_score SMALLINT,
  vocabulary_score SMALLINT,
  content_score SMALLINT,
  feedback JSONB DEFAULT '{}'::jsonb,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_hskk_user_created ON hskk_tests(user_id, created_at DESC);

-- ============ scenarios（场景库） ============
CREATE TABLE IF NOT EXISTS scenarios (
  id TEXT PRIMARY KEY,
  name JSONB NOT NULL,
  description JSONB NOT NULL,
  recommended_hsk INT[] NOT NULL DEFAULT '{}',
  duration_minutes INT DEFAULT 5,
  ai_persona TEXT NOT NULL,
  scenario_prompt TEXT NOT NULL,
  goals JSONB DEFAULT '[]'::jsonb,
  completion_criteria JSONB DEFAULT '{}'::jsonb,
  is_active BOOLEAN DEFAULT TRUE,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============ usage_stats（每日使用统计，用于限流） ============
CREATE TABLE IF NOT EXISTS usage_stats (
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  conversation_seconds INT DEFAULT 0,
  conversation_count INT DEFAULT 0,
  hskk_count INT DEFAULT 0,
  PRIMARY KEY (user_id, date)
);

-- ============ updated_at 触发器 ============
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS set_profiles_updated_at ON profiles;
CREATE TRIGGER set_profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

DROP TRIGGER IF EXISTS set_subscriptions_updated_at ON subscriptions;
CREATE TRIGGER set_subscriptions_updated_at BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- ============ 新用户注册时自动建 profile ============
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (auth_id, email)
  VALUES (NEW.id, NEW.email);

  -- 同时建一条 free 订阅
  INSERT INTO public.subscriptions (user_id, plan, status)
  SELECT id, 'free', 'active' FROM public.profiles WHERE auth_id = NEW.id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- ============ 初始化 5 个场景 ============
INSERT INTO scenarios (id, name, description, recommended_hsk, ai_persona, scenario_prompt, goals, completion_criteria, sort_order)
VALUES
(
  'restaurant',
  '{"en": "Restaurant Ordering", "zh": "餐厅点餐"}'::jsonb,
  '{"en": "Practice ordering food at a Chinese restaurant", "zh": "在中文餐厅点餐"}'::jsonb,
  ARRAY[2, 3, 4],
  'You are a friendly waiter at a Beijing restaurant. You are a young woman, very polite and welcoming.',
  'Guide the customer through ordering: greet them, ask how many people, offer seating, take their order, suggest drinks, handle any special requests (no spice, allergies, etc.).',
  '["Successfully order 2-3 dishes", "Ask about drinks", "Handle a special request"]'::jsonb,
  '{"min_turns": 6, "min_vocab_used": 15}'::jsonb,
  1
),
(
  'taxi',
  '{"en": "Taxi Ride", "zh": "打车"}'::jsonb,
  '{"en": "Take a taxi and give directions in Chinese", "zh": "打车并给司机指路"}'::jsonb,
  ARRAY[2, 3],
  'You are a Beijing taxi driver. You are middle-aged, friendly, like to chat.',
  'Pick up the customer, ask destination, confirm route, handle payment (mobile or cash), make small talk.',
  '["Tell driver your destination", "Confirm the fare", "Make small talk"]'::jsonb,
  '{"min_turns": 5}'::jsonb,
  2
),
(
  'introduction',
  '{"en": "Self Introduction", "zh": "自我介绍"}'::jsonb,
  '{"en": "Introduce yourself to a new friend", "zh": "向新朋友自我介绍"}'::jsonb,
  ARRAY[1, 2],
  'You are a Chinese college student meeting a foreigner for the first time at a language exchange event.',
  'Greet the person, exchange names, nationalities, occupations, ask about their Chinese learning journey.',
  '["Introduce name and nationality", "Ask 2 questions back", "End naturally"]'::jsonb,
  '{"min_turns": 5}'::jsonb,
  3
),
(
  'doctor',
  '{"en": "Doctor Visit", "zh": "看医生"}'::jsonb,
  '{"en": "Visit a doctor and describe your symptoms", "zh": "看医生并描述症状"}'::jsonb,
  ARRAY[3, 4],
  'You are a doctor at a Chinese hospital. You are professional but friendly.',
  'Greet the patient, ask what is wrong, ask about symptoms (how long, how severe), suggest treatment or medicine, give advice.',
  '["Describe your symptoms", "Understand the advice", "Ask about medicine"]'::jsonb,
  '{"min_turns": 6}'::jsonb,
  4
),
(
  'interview',
  '{"en": "Job Interview", "zh": "工作面试"}'::jsonb,
  '{"en": "Practice a job interview in Chinese", "zh": "练习用中文进行工作面试"}'::jsonb,
  ARRAY[5, 6],
  'You are the hiring manager at a Chinese tech company. You are professional, ask tough but fair questions.',
  'Start the interview: ask candidate to introduce themselves, ask about experience, ask situational questions, discuss salary expectations, close the interview.',
  '["Answer introduction question", "Handle experience questions", "Discuss salary"]'::jsonb,
  '{"min_turns": 8}'::jsonb,
  5
)
ON CONFLICT (id) DO NOTHING;

-- ============ Row Level Security ============
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_turns ENABLE ROW LEVEL SECURITY;
ALTER TABLE mistakes ENABLE ROW LEVEL SECURITY;
ALTER TABLE hskk_tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE scenarios ENABLE ROW LEVEL SECURITY;

-- Profiles：用户只能读写自己的资料
DROP POLICY IF EXISTS "Public profiles are viewable" ON profiles;
CREATE POLICY "Public profiles are viewable" ON profiles
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT WITH CHECK (auth_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth_id = auth.uid());

-- Subscriptions
DROP POLICY IF EXISTS "Users can view own subscriptions" ON subscriptions;
CREATE POLICY "Users can view own subscriptions" ON subscriptions
  FOR SELECT USING (user_id IN (SELECT id FROM profiles WHERE auth_id = auth.uid()));

-- Conversations
DROP POLICY IF EXISTS "Users can CRUD own conversations" ON conversations;
CREATE POLICY "Users can CRUD own conversations" ON conversations
  FOR ALL USING (user_id IN (SELECT id FROM profiles WHERE auth_id = auth.uid()));

-- Conversation turns（只读，由服务端写入）
DROP POLICY IF EXISTS "Users can view own turns" ON conversation_turns;
CREATE POLICY "Users can view own turns" ON conversation_turns
  FOR SELECT USING (
    conversation_id IN (
      SELECT id FROM conversations WHERE user_id IN (
        SELECT id FROM profiles WHERE auth_id = auth.uid()
      )
    )
  );

-- Mistakes
DROP POLICY IF EXISTS "Users can CRUD own mistakes" ON mistakes;
CREATE POLICY "Users can CRUD own mistakes" ON mistakes
  FOR ALL USING (user_id IN (SELECT id FROM profiles WHERE auth_id = auth.uid()));

-- HSKK Tests
DROP POLICY IF EXISTS "Users can view own hskk_tests" ON hskk_tests;
CREATE POLICY "Users can view own hskk_tests" ON hskk_tests
  FOR SELECT USING (user_id IN (SELECT id FROM profiles WHERE auth_id = auth.uid()));

-- Usage stats（只读）
DROP POLICY IF EXISTS "Users can view own usage_stats" ON usage_stats;
CREATE POLICY "Users can view own usage_stats" ON usage_stats
  FOR SELECT USING (user_id IN (SELECT id FROM profiles WHERE auth_id = auth.uid()));

-- Scenarios（所有人可读 active 的）
DROP POLICY IF EXISTS "Scenarios are viewable" ON scenarios;
CREATE POLICY "Scenarios are viewable" ON scenarios
  FOR SELECT USING (is_active = true);

-- ============ 完成 ============
-- 验证查询：
-- SELECT count(*) FROM scenarios;  -- 应该返回 5
