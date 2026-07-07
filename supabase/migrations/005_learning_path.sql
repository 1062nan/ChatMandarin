-- 005: 学习路径系统
-- 给所有内容打上单元标签 + 用户进度追踪

-- ============ 学习单元定义 ============
CREATE TABLE IF NOT EXISTS learning_units (
  id TEXT PRIMARY KEY,           -- 'hsk1-unit1', 'hsk3-unit2'
  hsk_level SMALLINT NOT NULL,
  unit_number SMALLINT NOT NULL,  -- 1-4
  title TEXT NOT NULL,
  description TEXT,
  difficulty TEXT DEFAULT 'easy', -- easy, medium, hard, challenge
  unlock_score SMALLINT DEFAULT 65, -- 前一单元需要达到的最低分
  content_config JSONB NOT NULL, -- { min_scenarios: 3, min_shadowing: 8, min_dubbing: 1 }
  sort_order INT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============ 给现有场景打 unit 标签 ============
ALTER TABLE scenarios ADD COLUMN IF NOT EXISTS unit_id TEXT;
ALTER TABLE shadowing_sentences ADD COLUMN IF NOT EXISTS unit_id TEXT;
ALTER TABLE dubbing_clips ADD COLUMN IF NOT EXISTS unit_id TEXT;

-- ============ 用户学习进度 ============
CREATE TABLE IF NOT EXISTS user_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  unit_id TEXT NOT NULL REFERENCES learning_units(id),
  status TEXT DEFAULT 'locked', -- locked, available, in_progress, completed, mastered
  best_score SMALLINT DEFAULT 0,
  attempts INT DEFAULT 0,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  mastered_at TIMESTAMPTZ,
  UNIQUE(user_id, unit_id)
);

CREATE INDEX IF NOT EXISTS idx_user_progress ON user_progress(user_id, unit_id);

ALTER TABLE user_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can CRUD own progress" ON user_progress
  FOR ALL USING (user_id IN (SELECT id FROM profiles WHERE auth_id = auth.uid()));

-- ============ 初始化学习单元（HSK 1-5，每级 4 个单元 = 20 个单元）============

INSERT INTO learning_units (id, hsk_level, unit_number, title, description, difficulty, unlock_score, content_config, sort_order) VALUES
-- HSK 1
('hsk1-unit1', 1, 1, '打招呼与自我介绍', '学会基本问候、自我介绍、数字、时间', 'easy', 0, '{"min_scenarios":3,"min_shadowing":8}'::jsonb, 1),
('hsk1-unit2', 1, 2, '日常生活', '点餐、买东西、问路', 'easy', 60, '{"min_scenarios":3,"min_shadowing":8}'::jsonb, 2),
('hsk1-unit3', 1, 3, '出行与交通', '打车、买票、问时间', 'medium', 65, '{"min_scenarios":3,"min_shadowing":8}'::jsonb, 3),
('hsk1-unit4', 1, 4, '社交基础', '邀请朋友、聊天气、告别', 'medium', 70, '{"min_scenarios":3,"min_shadowing":6}'::jsonb, 4),
-- HSK 2
('hsk2-unit1', 2, 1, '购物与讨价', '商场购物、讨价还价、退换货', 'easy', 0, '{"min_scenarios":3,"min_shadowing":8}'::jsonb, 5),
('hsk2-unit2', 2, 2, '生活服务', '理发、看病、寄快递', 'easy', 60, '{"min_scenarios":3,"min_shadowing":8}'::jsonb, 6),
('hsk2-unit3', 2, 3, '旅行出行', '酒店、机场、火车', 'medium', 65, '{"min_scenarios":3,"min_shadowing":8}'::jsonb, 7),
('hsk2-unit4', 2, 4, '朋友聚会', '聚会聊天、请客、道歉', 'medium', 70, '{"min_scenarios":3,"min_shadowing":6}'::jsonb, 8),
-- HSK 3
('hsk3-unit1', 3, 1, '职场入门', '入职、办公室日常、汇报', 'easy', 0, '{"min_scenarios":3,"min_shadowing":8}'::jsonb, 9),
('hsk3-unit2', 3, 2, '租房与生活', '看房、签合同、银行办事', 'easy', 65, '{"min_scenarios":3,"min_shadowing":8}'::jsonb, 10),
('hsk3-unit3', 3, 3, '社交与网络', '社交活动、打电话、网络购物', 'medium', 70, '{"min_scenarios":3,"min_shadowing":8}'::jsonb, 11),
('hsk3-unit4', 3, 4, '综合挑战', '处理纠纷、看医生详细描述、讨论计划', 'hard', 75, '{"min_scenarios":3,"min_shadowing":6}'::jsonb, 12),
-- HSK 4
('hsk4-unit1', 4, 1, '商务沟通', '商务谈判、会议、邮件沟通', 'medium', 0, '{"min_scenarios":3,"min_shadowing":8}'::jsonb, 13),
('hsk4-unit2', 4, 2, '社会话题', '讨论新闻、环保、科技', 'medium', 70, '{"min_scenarios":3,"min_shadowing":8}'::jsonb, 14),
('hsk4-unit3', 4, 3, '深度交流', '表达观点、辩论、讲故事', 'hard', 75, '{"min_scenarios":3,"min_shadowing":8}'::jsonb, 15),
('hsk4-unit4', 4, 4, '面试与展示', '面试、演讲、报告', 'challenge', 80, '{"min_scenarios":3,"min_shadowing":6}'::jsonb, 16),
-- HSK 5
('hsk5-unit1', 5, 1, '学术讨论', '论文讨论、研究报告', 'hard', 0, '{"min_scenarios":3,"min_shadowing":8}'::jsonb, 17),
('hsk5-unit2', 5, 2, '商业策略', '投资、合作、市场分析', 'hard', 75, '{"min_scenarios":3,"min_shadowing":8}'::jsonb, 18),
('hsk5-unit3', 5, 3, '文化探讨', '文化差异、哲学思考', 'challenge', 80, '{"min_scenarios":3,"min_shadowing":8}'::jsonb, 19),
('hsk5-unit4', 5, 4, '高级辩论', '复杂话题辩论、即兴演讲', 'challenge', 85, '{"min_scenarios":3,"min_shadowing":6}'::jsonb, 20)
ON CONFLICT (id) DO NOTHING;

-- ============ 给场景打 unit 标签 ============
-- HSK 1-2 场景
UPDATE scenarios SET unit_id = 'hsk1-unit1' WHERE id IN ('introduction', 'weather');
UPDATE scenarios SET unit_id = 'hsk1-unit2' WHERE id IN ('restaurant');
UPDATE scenarios SET unit_id = 'hsk1-unit3' WHERE id IN ('taxi');
UPDATE scenarios SET unit_id = 'hsk2-unit1' WHERE id IN ('shopping', 'market', 'return');
UPDATE scenarios SET unit_id = 'hsk2-unit2' WHERE id IN ('doctor', 'haircut', 'pharmacy');
UPDATE scenarios SET unit_id = 'hsk2-unit3' WHERE id IN ('airport', 'hotel', 'train');
UPDATE scenarios SET unit_id = 'hsk2-unit4' WHERE id IN ('party', 'invitation', 'compliment', 'apology', 'coffee');
UPDATE scenarios SET unit_id = 'hsk3-unit2' WHERE id IN ('rental', 'bank');
UPDATE scenarios SET unit_id = 'hsk3-unit3' WHERE id IN ('phone-call', 'library', 'post-office', 'pet');
UPDATE scenarios SET unit_id = 'hsk3-unit4' WHERE id IN ('directions', 'network');
UPDATE scenarios SET unit_id = 'hsk4-unit4' WHERE id IN ('interview');
UPDATE scenarios SET unit_id = 'hsk5-unit3' WHERE id IN ('visa');
UPDATE scenarios SET unit_id = 'hsk3-unit1' WHERE id IN ('school', 'gym');

-- ============ 给影子跟读打 unit 标签 ============
UPDATE shadowing_sentences SET unit_id = 'hsk1-unit1' WHERE hsk_level = 1 AND id IN ('s001','s002','s003','s004','s005','s031','s032','s033','s034','s038');
UPDATE shadowing_sentences SET unit_id = 'hsk1-unit2' WHERE hsk_level = 1 AND id IN ('s006','s009','s040','s081','s082','s084','s086','s089','s096','s098');
UPDATE shadowing_sentences SET unit_id = 'hsk1-unit3' WHERE hsk_level = 1 AND id IN ('s010','s039','s048','s050');
UPDATE shadowing_sentences SET unit_id = 'hsk1-unit4' WHERE hsk_level = 1 AND id IN ('s007','s037','s081','s082','s094');
UPDATE shadowing_sentences SET unit_id = 'hsk2-unit1' WHERE hsk_level = 2 AND id IN ('s008','s044','s086');
UPDATE shadowing_sentences SET unit_id = 'hsk2-unit2' WHERE hsk_level = 2 AND id IN ('s006','s007','s045','s047','s084','s098');
UPDATE shadowing_sentences SET unit_id = 'hsk2-unit3' WHERE hsk_level = 2 AND id IN ('s009','s021','s027','s036','s041','s045');
UPDATE shadowing_sentences SET unit_id = 'hsk2-unit4' WHERE hsk_level = 2 AND id IN ('s046','s050','s085','s087','s089','s093','s096','s100');
UPDATE shadowing_sentences SET unit_id = 'hsk3-unit1' WHERE hsk_level = 3 AND id IN ('s011','s012','s051','s052','s054','s056','s058','s083');
UPDATE shadowing_sentences SET unit_id = 'hsk3-unit2' WHERE hsk_level = 3 AND id IN ('s013','s014','s053','s055','s057','s059','s062','s064','s088','s090','s091','s092','s094','s097');
UPDATE shadowing_sentences SET unit_id = 'hsk3-unit3' WHERE hsk_level = 3 AND id IN ('s015','s024','s056','s063','s083','s088','s090');
UPDATE shadowing_sentences SET unit_id = 'hsk3-unit4' WHERE hsk_level = 3 AND id IN ('s016','s025','s028','s046','s061','s065','s071','s072','s073','s087','s093','s095','s099','s100');
UPDATE shadowing_sentences SET unit_id = 'hsk4-unit1' WHERE hsk_level = 4 AND id IN ('s017','s018','s019','s020','s066','s069','s071','s076','s079');
UPDATE shadowing_sentences SET unit_id = 'hsk4-unit2' WHERE hsk_level = 4 AND id IN ('s018','s066','s069','s074','s076','s077');
UPDATE shadowing_sentences SET unit_id = 'hsk4-unit3' WHERE hsk_level = 4 AND id IN ('s019','s020','s067','s068','s070','s071','s073','s074','s075','s095','s099');
UPDATE shadowing_sentences SET unit_id = 'hsk4-unit4' WHERE hsk_level = 4 AND id IN ('s017','s019','s022','s023','s070','s076','s079');
UPDATE shadowing_sentences SET unit_id = 'hsk5-unit1' WHERE hsk_level = 5 AND id IN ('s021','s022','s023','s068','s077','s078','s080');
UPDATE shadowing_sentences SET unit_id = 'hsk5-unit2' WHERE hsk_level = 5 AND id IN ('s023','s068','s070','s076','s079','s080');
UPDATE shadowing_sentences SET unit_id = 'hsk5-unit3' WHERE hsk_level = 5 AND id IN ('s024','s025','s061','s065','s072','s077','s078');
UPDATE shadowing_sentences SET unit_id = 'hsk5-unit4' WHERE hsk_level = 6 AND id IN ('s029','s030','s068','s077','s078');

-- ============ 给配音片段打 unit 标签 ============
UPDATE dubbing_clips SET unit_id = 'hsk3-unit4' WHERE hsk_level = 3;
UPDATE dubbing_clips SET unit_id = 'hsk2-unit1' WHERE id = 'lost-tourist';
UPDATE dubbing_clips SET unit_id = 'hsk2-unit4' WHERE id = 'morning-routine';
UPDATE dubbing_clips SET unit_id = 'hsk3-unit2' WHERE id = 'first-day-beijing';
UPDATE dubbing_clips SET unit_id = 'hsk3-unit3' WHERE id = 'school-reunion';
UPDATE dubbing_clips SET unit_id = 'hsk3-unit4' WHERE id IN ('shopping-dispute', 'renting-apartment', 'grandmas-cooking');
UPDATE dubbing_clips SET unit_id = 'hsk4-unit1' WHERE id = 'business-negotiation';
UPDATE dubbing_clips SET unit_id = 'hsk4-unit4' WHERE id = 'job-offer-call';
UPDATE dubbing_clips SET unit_id = 'hsk5-unit2' WHERE id = 'job-interview-tech';

-- ============ 给所有用户初始化学习进度 ============
INSERT INTO user_progress (user_id, unit_id, status)
SELECT p.id, u.id,
  CASE
    WHEN u.hsk_level = 1 AND u.unit_number = 1 THEN 'available'
    WHEN u.hsk_level = 2 AND u.unit_number = 1 THEN 'available'
    WHEN u.hsk_level = 3 AND u.unit_number = 1 THEN 'available'
    ELSE 'locked'
  END
FROM profiles p
CROSS JOIN learning_units u
WHERE NOT EXISTS (
  SELECT 1 FROM user_progress up
  WHERE up.user_id = p.id AND up.unit_id = u.id
)
ON CONFLICT (user_id, unit_id) DO NOTHING;

-- ============ RLS ============
ALTER TABLE learning_units ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Learning units are viewable" ON learning_units
  FOR SELECT USING (is_active = true);

-- ============ 验证 ============
-- SELECT hsk_level, unit_number, title, difficulty, unlock_score FROM learning_units ORDER BY sort_order;
-- SELECT unit_id, count(*) FROM scenarios WHERE unit_id IS NOT NULL GROUP BY unit_id;
-- SELECT unit_id, count(*) FROM shadowing_sentences WHERE unit_id IS NOT NULL GROUP BY unit_id;
-- SELECT unit_id, count(*) FROM dubbing_clips WHERE unit_id IS NOT NULL GROUP BY unit_id;
