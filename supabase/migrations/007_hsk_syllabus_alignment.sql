-- 007: HSK 官方大纲对齐
-- 给 learning_units 增加 grammar_points / vocab_topics / exam_skills 字段
-- 后端：知道每单元练什么 HSK 大纲内容
-- 前端：保持故事线名称（display_mode = journey），HSK 信息只在 backend 和 admin 工具中可见

-- ============ 增加大纲字段 ============
ALTER TABLE learning_units ADD COLUMN IF NOT EXISTS grammar_points JSONB DEFAULT '[]'::jsonb;
ALTER TABLE learning_units ADD COLUMN IF NOT EXISTS vocab_topics JSONB DEFAULT '[]'::jsonb;
ALTER TABLE learning_units ADD COLUMN IF NOT EXISTS exam_skills JSONB DEFAULT '[]'::jsonb;
ALTER TABLE learning_units ADD COLUMN IF NOT EXISTS official_scenario_ids JSONB DEFAULT '[]'::jsonb;

-- ============ 为每个单元填充 HSK 大纲标签 ============
UPDATE learning_units SET
  grammar_points = '["\u662f\u5b57\u53e5","\u6709\u5b57\u53e5","\u7591\u95ee\u4ee3\u8bcd","\u57fa\u672c SVO","\u6570\u5b57 + \u91cf\u8bcd"]'::jsonb,
  vocab_topics = '["\u95ee\u5019","\u81ea\u6211\u4ecb\u7ecd","\u6570\u5b57","\u65f6\u95f4","\u56fd\u7c4d"]'::jsonb,
  exam_skills = '["\u542c\u5bf9\u8bdd\u9009\u56fe","\u770b\u56fe\u9009\u8bcd"]'::jsonb,
  official_scenario_ids = '["introduction","weather"]'::jsonb
WHERE id = 'hsk1-unit1';

UPDATE learning_units SET
  grammar_points = '["\u60f3 / \u8981 \u80fd\u613f\u52a8\u8bcd","\u5426\u5b9a\u8bcd\u4e0d / \u6ca1","\u6307\u793a\u4ee3\u8bcd\u8fd9 / \u90a3","\u6570\u91cf\u77ed\u8bed"]'::jsonb,
  vocab_topics = '["\u996e\u98df","\u8d2d\u7269","\u65e5\u5e38\u7269\u54c1","\u989c\u8272"]'::jsonb,
  exam_skills = '["\u542c\u5bf9\u8bdd\u9009\u7b54\u6848","\u9009\u8bcd\u586b\u7a7a"]'::jsonb,
  official_scenario_ids = '["restaurant","market"]'::jsonb
WHERE id = 'hsk1-unit2';

UPDATE learning_units SET
  grammar_points = '["\u65f6\u95f4\u8868\u8fbe","\u65b9\u4f4d\u8bcd\u5728 / \u4e0a / \u4e0b","\u4ecb\u8bcd\u548c / \u8ddf"]'::jsonb,
  vocab_topics = '["\u4ea4\u901a","\u95ee\u8def","\u65f6\u95f4","\u65e5\u671f"]'::jsonb,
  exam_skills = '["\u542c\u5bf9\u8bdd\u9009\u56fe","\u6392\u5217\u987a\u5e8f"]'::jsonb,
  official_scenario_ids = '["taxi","directions"]'::jsonb
WHERE id = 'hsk1-unit3';

UPDATE learning_units SET
  grammar_points = '["\u7a0b\u5ea6\u526f\u8bcd\u5f88 / \u975e\u5e38 / \u592a","\u8bed\u6c14\u52a9\u8bcd\u5417 / \u5462 / \u5426","\u5f62\u5bb9\u8bcd\u8c13\u8bed\u53e5"]'::jsonb,
  vocab_topics = '["\u9080\u8bf7","\u5929\u6c14","\u544a\u522b","\u793e\u4ea4\u57fa\u7840"]'::jsonb,
  exam_skills = '["\u542c\u5bf9\u8bdd\u5224\u65ad\u5bf9\u9519","\u9009\u8bcd\u586b\u7a7a"]'::jsonb,
  official_scenario_ids = '["party","invitation"]'::jsonb
WHERE id = 'hsk1-unit4';

UPDATE learning_units SET
  grammar_points = '["\u6bd4\u8f83\u53e5 A \u6bd4 B","\u8ddf\u2026\u2026\u4e00\u6837","\u7a0b\u5ea6\u526f\u8bcd\u6700 / \u66f4"]'::jsonb,
  vocab_topics = '["\u8d2d\u7269","\u9000\u6362\u8d27","\u6bd4\u8f83\u5546\u54c1"]'::jsonb,
  exam_skills = '["\u542c\u5bf9\u8bdd\u9009\u7b54\u6848","\u9605\u8bfb\u7406\u89e3"]'::jsonb,
  official_scenario_ids = '["shopping","return","coffee"]'::jsonb
WHERE id = 'hsk2-unit1';

UPDATE learning_units SET
  grammar_points = '["\u65f6\u6001\u4e86 / \u8fc7 / \u7740","\u4ecb\u8bcd\u77ed\u8bed\u7ed9 / \u5bf9"]'::jsonb,
  vocab_topics = '["\u7406\u53d1","\u770b\u75c5","\u836f\u5e97","\u751f\u6d3b\u670d\u52a1"]'::jsonb,
  exam_skills = '["\u542c\u5bf9\u8bdd\u5224\u65ad\u5bf9\u9519","\u6392\u5217\u987a\u5e8f"]'::jsonb,
  official_scenario_ids = '["doctor","haircut","pharmacy"]'::jsonb
WHERE id = 'hsk2-unit2';

UPDATE learning_units SET
  grammar_points = '["\u8fd8\u662f \u9009\u62e9\u7591\u95ee","\u526f\u8bcd\u5df2\u7ecf / \u8fd8\u6ca1 / \u5c31 / \u624d","\u52a8\u8bcd\u91cd\u53e0"]'::jsonb,
  vocab_topics = '["\u9152\u5e97","\u673a\u573a","\u706b\u8f66","\u51fa\u884c\u6d41\u7a0b"]'::jsonb,
  exam_skills = '["\u542c\u5bf9\u8bdd\u9009\u7b54\u6848","\u770b\u56fe\u7528\u8bcd\u9020\u53e5"]'::jsonb,
  official_scenario_ids = '["airport","hotel","train"]'::jsonb
WHERE id = 'hsk2-unit3';

UPDATE learning_units SET
  grammar_points = '["\u5173\u8054\u8bcd\u56e0\u4e3a\u2026\u2026\u6240\u4ee5\u2026\u2026","\u5173\u8054\u8bcd\u867d\u7136\u2026\u2026\u4f46\u662f\u2026\u2026","\u5173\u8054\u8bcd\u5982\u679c\u2026\u2026\u5c31\u2026\u2026"]'::jsonb,
  vocab_topics = '["\u805a\u4f1a","\u8bf7\u5ba2","\u9053\u6b49","\u793e\u4ea4\u5e94\u916c"]'::jsonb,
  exam_skills = '["\u542c\u957f\u5bf9\u8bdd","\u5b8c\u6210\u77ed\u6587"]'::jsonb,
  official_scenario_ids = '["party","invitation","compliment","apology"]'::jsonb
WHERE id = 'hsk2-unit4';

UPDATE learning_units SET
  grammar_points = '["\u8d8a\u6765\u8d8a\u2026\u2026","\u526f\u8bcd\u5176\u5b9e / \u5f53\u7136 / \u4e00\u5b9a / \u53ef\u80fd","\u4ecb\u8bcd\u6839\u636e / \u6309\u7167"]'::jsonb,
  vocab_topics = '["\u5165\u804c\u624b\u7eed","\u529e\u516c\u5ba4\u65e5\u5e38","\u6c47\u62a5\u5de5\u4f5c"]'::jsonb,
  exam_skills = '["\u542c\u957f\u5bf9\u8bdd","\u6392\u5217\u987a\u5e8f","\u770b\u56fe\u7528\u8bcd\u9020\u53e5"]'::jsonb,
  official_scenario_ids = '["school","gym"]'::jsonb
WHERE id = 'hsk3-unit1';

UPDATE learning_units SET
  grammar_points = '["\u628a\u5b57\u53e5\u57fa\u7840","\u628a\u5b57\u53e5 + \u8865\u8bed","\u4ecb\u8bcd\u9664\u4e86 / \u7531\u4e8e / \u4e3a\u4e86"]'::jsonb,
  vocab_topics = '["\u770b\u623f\u79df\u623f","\u94f6\u884c\u5f00\u6237","\u7b7e\u5408\u540c"]'::jsonb,
  exam_skills = '["\u542c\u957f\u5bf9\u8bdd","\u9605\u8bfb\u7406\u89e3","\u5b8c\u6210\u77ed\u6587"]'::jsonb,
  official_scenario_ids = '["rental","bank"]'::jsonb
WHERE id = 'hsk3-unit2';

UPDATE learning_units SET
  grammar_points = '["\u7ed3\u679c\u8865\u8bed\uff08\u505a\u5b8c / \u770b\u5230\u627e\u5230\uff09","\u53ef\u80fd\u8865\u8bed\uff08\u5403\u5f97\u5b8c / \u770b\u4e0d\u61c2\uff09","\u526f\u8bcd\u4e00\u76f4 / \u7ecf\u5e38 / \u5076\u5c14"]'::jsonb,
  vocab_topics = '["\u793e\u4ea4\u6d3b\u52a8","\u6253\u7535\u8bdd","\u56fe\u4e66\u9986","\u517b\u5ba0\u7269"]'::jsonb,
  exam_skills = '["\u542c\u5bf9\u8bdd\u9009\u7b54\u6848","\u9605\u8bfb\u957f\u6587","\u770b\u56fe\u7528\u8bcd\u9020\u53e5"]'::jsonb,
  official_scenario_ids = '["phone-call","library","post-office","pet"]'::jsonb
WHERE id = 'hsk3-unit3';

UPDATE learning_units SET
  grammar_points = '["\u628a\u5b57\u53e5\u7efc\u5408","\u88ab\u52a8\u53e5\u88ab / \u53eb / \u8ba9","\u8d8a\u2026\u2026\u8d8a\u2026\u2026","\u5173\u8054\u8bcd\u4e0d\u4f46\u2026\u2026\u800c\u4e14\u2026\u2026"]'::jsonb,
  vocab_topics = '["\u9000\u8d27\u7ea0\u7eb7","\u8be6\u7ec6\u63cf\u8ff0\u75c5\u60c5","\u8ba8\u8bba\u590d\u6742\u8ba1\u5212"]'::jsonb,
  exam_skills = '["\u542c\u957f\u5bf9\u8bdd","\u9605\u8bfb\u957f\u6587","\u5b8c\u6210\u77ed\u6587"]'::jsonb,
  official_scenario_ids = '["directions","network"]'::jsonb
WHERE id = 'hsk3-unit4';

UPDATE learning_units SET
  grammar_points = '["\u590d\u6742\u590d\u53e5\u5373\u4f7f\u2026\u2026\u4e5f\u2026\u2026","\u5173\u8054\u8bcd\u6b64\u5916 / \u800c\u4e14 / \u5426\u5219 / \u56e0\u6b64","\u5f3a\u8c03\u53e5\u662f\u2026\u2026\u7684\u2026\u2026"]'::jsonb,
  vocab_topics = '["\u5546\u52a1\u8c08\u5224","\u4f1a\u8bae","\u90ae\u4ef6\u6c9f\u901a","\u5408\u4f5c\u8ba8\u8bba"]'::jsonb,
  exam_skills = '["\u542c\u957f\u5bf9\u8bdd","\u9605\u8bfb\u957f\u6587","\u547d\u9898\u4f5c\u6587"]'::jsonb,
  official_scenario_ids = '["business-negotiation"]'::jsonb
WHERE id = 'hsk4-unit1';

UPDATE learning_units SET
  grammar_points = '["\u590d\u6742\u590d\u53e5\u65e0\u8bba\u2026\u2026\u90fd\u2026\u2026","\u53cd\u95ee\u53e5\u6269\u5c55","\u62bd\u8c61\u540d\u8bcd\uff08\u89c2\u70b9 / \u7acb\u573a\uff09"]'::jsonb,
  vocab_topics = '["\u65b0\u95fb","\u73af\u4fdd","\u79d1\u6280\u53d1\u5c55"]'::jsonb,
  exam_skills = '["\u9605\u8bfb\u7406\u89e3","\u9605\u8bfb\u957f\u6587","\u547d\u9898\u4f5c\u6587"]'::jsonb,
  official_scenario_ids = '[]'::jsonb
WHERE id = 'hsk4-unit2';

UPDATE learning_units SET
  grammar_points = '["\u590d\u6742\u590d\u53e5\u4e0e\u5176\u2026\u2026\u4e0d\u5982\u2026\u2026","\u6210\u8bed\u548c\u60ef\u7528\u8bcd","\u4fee\u8f9e\uff1a\u6bd4\u55bb\u3001\u6392\u6bd4"]'::jsonb,
  vocab_topics = '["\u8bb2\u6545\u4e8b","\u8fa9\u8bba","\u6df1\u5ea6\u6c9f\u901a"]'::jsonb,
  exam_skills = '["\u542c\u957f\u5bf9\u8bdd","\u9605\u8bfb\u957f\u6587","\u547d\u9898\u4f5c\u6587"]'::jsonb,
  official_scenario_ids = '[]'::jsonb
WHERE id = 'hsk4-unit3';

UPDATE learning_units SET
  grammar_points = '["\u5f3a\u8c03\u53e5\u8fde\u2026\u2026\u90fd\u2026\u2026","\u63d2\u5165\u8bed\uff08\u6309\u7406\u8bf4 / \u4e00\u822c\u6765\u8bf4\uff09","\u526f\u8bcd\u6bd5\u7adf / \u5230\u5e95 / \u7a76\u7adf"]'::jsonb,
  vocab_topics = '["\u6c42\u804c\u9762\u8bd5","\u516c\u5f00\u6f14\u8bb2","\u5de5\u4f5c\u62a5\u544a"]'::jsonb,
  exam_skills = '["\u542c\u957f\u5bf9\u8bdd","\u9605\u8bfb\u957f\u6587","\u547d\u9898\u4f5c\u6587"]'::jsonb,
  official_scenario_ids = '["interview"]'::jsonb
WHERE id = 'hsk4-unit4';

UPDATE learning_units SET
  grammar_points = '["\u4e66\u9762\u8bed\u6b63\u5f0f\u8868\u8fbe","\u62bd\u8c61\u52a8\u8bcd\uff08\u4fc3\u8fdb / \u63a8\u52a8 / \u7ef4\u62a4\uff09","\u5f15\u7528\u4e0e\u8f6c\u8ff0"]'::jsonb,
  vocab_topics = '["\u8bba\u6587\u7b54\u8fa9","\u7814\u7a76\u62a5\u544a","\u5b66\u672f\u4ea4\u6d41"]'::jsonb,
  exam_skills = '["\u9605\u8bfb\u957f\u6587","\u547d\u9898\u4f5c\u6587\uff0880 \u5b57\u77ed\u6587\uff09"]'::jsonb,
  official_scenario_ids = '[]'::jsonb
WHERE id = 'hsk5-unit1';

UPDATE learning_units SET
  grammar_points = '["\u62bd\u8c61\u540d\u8bcd\uff08\u77db\u76fe / \u7ade\u4e89 / \u6548\u7387\uff09","\u5173\u8054\u8bcd\u4e0e\u4e4b\u76f8\u53cd / \u4e0e\u6b64\u540c\u65f6 / \u8fdb\u800c","\u6982\u62ec\u4e0e\u603b\u7ed3"]'::jsonb,
  vocab_topics = '["\u6295\u8d44\u51b3\u7b56","\u5408\u4f5c\u65b9\u6848","\u5e02\u573a\u5206\u6790"]'::jsonb,
  exam_skills = '["\u9605\u8bfb\u957f\u6587","\u547d\u9898\u4f5c\u6587"]'::jsonb,
  official_scenario_ids = '["job-interview-tech"]'::jsonb
WHERE id = 'hsk5-unit2';

UPDATE learning_units SET
  grammar_points = '["\u6210\u8bed\u7684\u9ad8\u7ea7\u8fd0\u7528","\u590d\u6742\u957f\u53e5","\u4fee\u8f9e\u624b\u6cd5\u7efc\u5408"]'::jsonb,
  vocab_topics = '["\u6587\u5316\u5dee\u5f02","\u54f2\u5b66\u601d\u8003","\u793e\u4f1a\u73b0\u8c61"]'::jsonb,
  exam_skills = '["\u9605\u8bfb\u957f\u6587","\u547d\u9898\u4f5c\u6587"]'::jsonb,
  official_scenario_ids = '["visa"]'::jsonb
WHERE id = 'hsk5-unit3';

UPDATE learning_units SET
  grammar_points = '["\u53cc\u91cd\u5426\u5b9a","\u53cd\u95ee\u53e5\u4f55\u987b / \u4f55\u5fc5","\u8fc7\u6e21\u4e0e\u8854\u63a5"]'::jsonb,
  vocab_topics = '["\u590d\u6742\u8bdd\u9898\u8fa9\u8bba","\u5373\u5174\u6f14\u8bb2","\u9ad8\u7ea7\u8868\u8fbe"]'::jsonb,
  exam_skills = '["\u9605\u8bfb\u957f\u6587","\u547d\u9898\u4f5c\u6587"]'::jsonb,
  official_scenario_ids = '[]'::jsonb
WHERE id = 'hsk5-unit4';

-- ============ 验证 ============
-- SELECT id, title, jsonb_array_length(grammar_points) as grammar_count,
--        jsonb_array_length(vocab_topics) as vocab_count
-- FROM learning_units ORDER BY sort_order;
