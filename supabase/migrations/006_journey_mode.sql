-- 006: 更新学习单元为故事线主题（混合模式）
-- 后端：严格按 HSK 大纲
-- 前端：默认显示故事线名称，可切换考试模式

-- ============ 更新单元标题为故事线 ============
UPDATE learning_units SET
  title = '初到北京',
  description = '刚到中国，学会基本打招呼、介绍自己、数字时间、简单点餐'
WHERE id = 'hsk1-unit1';

UPDATE learning_units SET
  title = '逛逛菜市场',
  description = '学会买东西、问价格、讨价还价、日常饮食'
WHERE id = 'hsk1-unit2';

UPDATE learning_units SET
  title = '出行记',
  description = '学会打车、问路、买票、看时间'
WHERE id = 'hsk1-unit3';

UPDATE learning_units SET
  title = '交个朋友',
  description = '学会邀请朋友、聊天气、告别、基本的情感表达'
WHERE id = 'hsk1-unit4';

UPDATE learning_units SET
  title = '上海购物',
  description = '商场购物、退换货、比较商品、表达喜好'
WHERE id = 'hsk2-unit1';

UPDATE learning_units SET
  title = '生活百事',
  description = '理发、看病、药店、寄快递——处理日常生活服务'
WHERE id = 'hsk2-unit2';

UPDATE learning_units SET
  title = '旅行记',
  description = '酒店入住、机场值机、火车站买票——出行全流程'
WHERE id = 'hsk2-unit3';

UPDATE learning_units SET
  title = '朋友聚会',
  description = '聚会聊天、请客吃饭、道歉和感谢——社交场景'
WHERE id = 'hsk2-unit4';

UPDATE learning_units SET
  title = '入职第一天',
  description = '入职手续、办公室日常、向同事汇报工作'
WHERE id = 'hsk3-unit1';

UPDATE learning_units SET
  title = '安家落户',
  description = '看房租房、银行开户、签合同——安顿生活'
WHERE id = 'hsk3-unit2';

UPDATE learning_units SET
  title = '扩大圈子',
  description = '社交活动、打电话、图书馆、养宠物——融入社区'
WHERE id = 'hsk3-unit3';

UPDATE learning_units SET
  title = '处理麻烦事',
  description = '退货纠纷、详细描述病情、讨论复杂计划——应对困难'
WHERE id = 'hsk3-unit4';

UPDATE learning_units SET
  title = '商务谈判',
  description = '商务会议、谈判技巧、合作讨论——职场进阶'
WHERE id = 'hsk4-unit1';

UPDATE learning_units SET
  title = '热点话题',
  description = '讨论新闻、环保、科技发展——表达观点'
WHERE id = 'hsk4-unit2';

UPDATE learning_units SET
  title = '深度交流',
  description = '讲故事、辩论、表达复杂思想——深度沟通'
WHERE id = 'hsk4-unit3';

UPDATE learning_units SET
  title = '面试与展示',
  description = '求职面试、公开演讲、工作报告——高阶职场'
WHERE id = 'hsk4-unit4';

UPDATE learning_units SET
  title = '学术讨论',
  description = '论文答辩、研究报告、学术交流'
WHERE id = 'hsk5-unit1';

UPDATE learning_units SET
  title = '商业策略',
  description = '投资决策、合作方案、市场分析——高级商务'
WHERE id = 'hsk5-unit2';

UPDATE learning_units SET
  title = '文化探索',
  description = '讨论文化差异、哲学思考、社会现象——深度文化'
WHERE id = 'hsk5-unit3';

UPDATE learning_units SET
  title = '巅峰对话',
  description = '复杂话题辩论、即兴演讲、高级表达——精通中文'
WHERE id = 'hsk5-unit4';

-- ============ 给 profiles 加 display_mode ============
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS display_mode TEXT DEFAULT 'journey';
-- 'journey' = 故事线模式（默认）
-- 'exam' = HSK 考试模式

-- ============ 更新 RLS ============
-- learning_units 已有 RLS，确保新字段可读
ALTER TABLE learning_units ENABLE ROW LEVEL SECURITY;
