-- 008: 订阅功能完善 —— 配额追踪 + 重放保护 + 月度统计
--
-- 修复点：
-- 1. webhook 重放保护（独立 webhook_events 表，替代错误的 subscriptions.lemon_squeezy_id 查询）
-- 2. usage_stats 加 shadowing_count / dubbing_count
-- 3. 新增 usage_monthly 表（月度配额：HSKK 3/月 等）
-- 4. mistakes 表加 plan 字段索引（便于 free 容量限制）

-- ============ webhook_events 表 ============
CREATE TABLE IF NOT EXISTS webhook_events (
  event_id TEXT PRIMARY KEY,
  event_name TEXT,
  subscription_id TEXT,
  processed_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============ usage_stats 加字段 ============
ALTER TABLE usage_stats ADD COLUMN IF NOT EXISTS shadowing_count INT DEFAULT 0;
ALTER TABLE usage_stats ADD COLUMN IF NOT EXISTS dubbing_count INT DEFAULT 0;

-- ============ 月度使用统计 ============
CREATE TABLE IF NOT EXISTS usage_monthly (
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  year_month TEXT NOT NULL,  -- 格式 '2026-07'
  hskk_count INT DEFAULT 0,
  PRIMARY KEY (user_id, year_month)
);

CREATE INDEX IF NOT EXISTS idx_usage_monthly ON usage_monthly(user_id, year_month);

ALTER TABLE usage_monthly ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own monthly usage" ON usage_monthly
  FOR SELECT USING (user_id IN (SELECT id FROM profiles WHERE auth_id = auth.uid()));

-- ============ mistakes 表索引（加速 free 容量检查）============
CREATE INDEX IF NOT EXISTS idx_mistakes_user_active ON mistakes(user_id) WHERE mastered = false;

-- ============ 验证 ============
-- SELECT * FROM usage_stats LIMIT 1;
-- SELECT * FROM usage_monthly LIMIT 1;
-- SELECT * FROM webhook_events LIMIT 1;
