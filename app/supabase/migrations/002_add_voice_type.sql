-- 002: 添加用户 TTS 音色偏好 + 配音相关表
-- 在 Supabase SQL Editor 运行

-- ============ profiles 加 tts_voice_type ============
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS tts_voice_type TEXT DEFAULT 'BV700_streaming';

-- ============ 影子跟读句子库 ============
CREATE TABLE IF NOT EXISTS shadowing_sentences (
  id TEXT PRIMARY KEY,
  text_zh TEXT NOT NULL,
  text_pinyin TEXT NOT NULL,
  text_en TEXT NOT NULL,
  hsk_level SMALLINT NOT NULL,
  category TEXT NOT NULL DEFAULT 'daily', -- daily / business / travel / idiom / news
  difficulty TEXT NOT NULL DEFAULT 'easy', -- easy / medium / hard
  duration_seconds FLOAT DEFAULT 5,
  is_active BOOLEAN DEFAULT TRUE,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shadowing_hsk ON shadowing_sentences(hsk_level, is_active);

-- RLS
ALTER TABLE shadowing_sentences ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Shadowing sentences are viewable" ON shadowing_sentences;
CREATE POLICY "Shadowing sentences are viewable" ON shadowing_sentences
  FOR SELECT USING (is_active = true);

-- ============ 影子跟读记录 ============
CREATE TABLE IF NOT EXISTS shadowing_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  sentence_id TEXT NOT NULL REFERENCES shadowing_sentences(id),
  pronunciation_score SMALLINT,
  tone_score SMALLINT,
  fluency_score SMALLINT,
  transcript TEXT,
  errors JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shadowing_records_user ON shadowing_records(user_id, created_at DESC);

ALTER TABLE shadowing_records ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can CRUD own shadowing records" ON shadowing_records;
CREATE POLICY "Users can CRUD own shadowing records" ON shadowing_records
  FOR ALL USING (user_id IN (SELECT id FROM profiles WHERE auth_id = auth.uid()));

-- ============ 配音片段库 ============
CREATE TABLE IF NOT EXISTS dubbing_clips (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  category TEXT NOT NULL, -- movie / tv / animation / original
  description TEXT,
  poster_image TEXT,
  duration_seconds INT NOT NULL,
  hsk_level SMALLINT NOT NULL,
  difficulty TEXT NOT NULL DEFAULT 'medium',
  lines JSONB NOT NULL, -- DubbingLine[]
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dubbing_clips ON dubbing_clips(category, hsk_level, is_active);

ALTER TABLE dubbing_clips ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Dubbing clips are viewable" ON dubbing_clips;
CREATE POLICY "Dubbing clips are viewable" ON dubbing_clips
  FOR SELECT USING (is_active = true);

-- ============ 配音记录 ============
CREATE TABLE IF NOT EXISTS dubbing_performances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  clip_id TEXT NOT NULL REFERENCES dubbing_clips(id),
  total_score SMALLINT,
  pronunciation_score SMALLINT,
  tone_score SMALLINT,
  emotion_score SMALLINT,
  rhythm_score SMALLINT,
  fluency_score SMALLINT,
  transcript TEXT,
  line_scores JSONB DEFAULT '[]'::jsonb,
  mode TEXT DEFAULT 'practice', -- practice / perform
  is_personal_best BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dubbing_perf_user ON dubbing_performances(user_id, clip_id, created_at DESC);

ALTER TABLE dubbing_performances ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can CRUD own dubbing performances" ON dubbing_performances;
CREATE POLICY "Users can CRUD own dubbing performances" ON dubbing_performances
  FOR ALL USING (user_id IN (SELECT id FROM profiles WHERE auth_id = auth.uid()));

-- ============ 初始化影子跟读句子（30 句） ============
INSERT INTO shadowing_sentences (id, text_zh, text_pinyin, text_en, hsk_level, category, difficulty, sort_order) VALUES
-- HSK 1
('s001', '你好，很高兴认识你！', 'nǐ hǎo, hěn gāo xìng rèn shi nǐ!', 'Hello, nice to meet you!', 1, 'daily', 'easy', 1),
('s002', '今天天气真好，我们出去走走吧。', 'jīn tiān tiān qì zhēn hǎo, wǒ men chū qù zǒu zou ba.', 'The weather is great today, let''s go for a walk.', 1, 'daily', 'easy', 2),
('s003', '请问，火车站怎么走？', 'qǐng wèn, huǒ chē zhàn zěn me zǒu?', 'Excuse me, how to get to the train station?', 1, 'travel', 'easy', 3),
('s004', '我想买两瓶水。', 'wǒ xiǎng mǎi liǎng píng shuǐ.', 'I want to buy two bottles of water.', 1, 'daily', 'easy', 4),
('s005', '你是哪国人？', 'nǐ shì nǎ guó rén?', 'What''s your nationality?', 1, 'daily', 'easy', 5),
-- HSK 2
('s006', '虽然今天很累，但是我很开心。', 'suī rán jīn tiān hěn lèi, dàn shì wǒ hěn kāi xīn.', 'Although I''m tired today, I''m very happy.', 2, 'daily', 'easy', 6),
('s007', '你能帮我一个忙吗？', 'nǐ néng bāng wǒ yí ge máng ma?', 'Can you do me a favor?', 2, 'daily', 'easy', 7),
('s008', '这家饭店的菜又便宜又好吃。', 'zhè jiā fàn diàn de cài yòu pián yi yòu hǎo chī.', 'This restaurant''s food is both cheap and delicious.', 2, 'daily', 'easy', 8),
('s009', '我已经学了三个月的汉语了。', 'wǒ yǐ jīng xué le sān ge yuè de hàn yǔ le.', 'I''ve been learning Chinese for three months.', 2, 'daily', 'easy', 9),
('s010', '因为下雨，所以我没去打球。', 'yīn wèi xià yǔ, suǒ yǐ wǒ méi qù dǎ qiú.', 'Because it rained, I didn''t go play ball.', 2, 'daily', 'easy', 10),
-- HSK 3
('s011', '如果你有空的话，我们一起去看电影吧。', 'rú guǒ nǐ yǒu kòng de huà, wǒ men yì qǐ qù kàn diàn yǐng ba.', 'If you''re free, let''s go watch a movie together.', 3, 'daily', 'medium', 11),
('s012', '服务员，请帮我把这个菜打包。', 'fú wù yuán, qǐng bāng wǒ bǎ zhè ge cài dǎ bāo.', 'Waiter, please pack this dish for me.', 3, 'daily', 'medium', 12),
('s013', '他的汉语说得跟中国人一样好。', 'tā de hàn yǔ shuō de gēn zhōng guó rén yí yàng hǎo.', 'His Chinese is as good as a native speaker.', 3, 'daily', 'medium', 13),
('s014', '我把房间打扫得干干净净的。', 'wǒ bǎ fáng jiān dǎ sǎo de gān gān jìng jìng de.', 'I cleaned the room spotlessly.', 3, 'daily', 'medium', 14),
('s015', '她不仅聪明，而且很努力。', 'tā bù jǐn cōng míng, ér qiě hěn nǔ lì.', 'She is not only smart but also hardworking.', 3, 'daily', 'medium', 15),
-- HSK 4
('s016', '随着经济的发展，人们的生活水平不断提高。', 'suí zhe jīng jì de fā zhǎn, rén men de shēng huó shuǐ píng bù duàn tí gāo.', 'With economic development, people''s living standards are constantly improving.', 4, 'news', 'medium', 16),
('s017', '我建议你提前做好准备，免得到时候手忙脚乱。', 'wǒ jiàn yì nǐ tí qián zuò hǎo zhǔn bèi, miǎn de dào shí hou shǒu máng jiǎo luàn.', 'I suggest you prepare in advance to avoid being frantic later.', 4, 'business', 'hard', 17),
('s018', '这项研究对于改善环境具有重要意义。', 'zhè xiàng yán jiū duì yú gǎi shàn huán jìng jù yǒu zhòng yào yì yì.', 'This research is of great significance for improving the environment.', 4, 'news', 'hard', 18),
('s019', '尽管遇到了很多困难，我们还是坚持完成了任务。', 'jǐn guǎn yù dào le hěn duō kùn nán, wǒ men hái shì jiān chí wán chéng le rèn wu.', 'Despite many difficulties, we persisted and completed the task.', 4, 'business', 'hard', 19),
('s020', '他的表现给大家留下了深刻的印象。', 'tā de biǎo xiàn gěi dà jiā liú xià le shēn kè de yìn xiàng.', 'His performance left a deep impression on everyone.', 4, 'business', 'medium', 20),
-- HSK 5
('s021', '在全球化的背景下，跨文化交流变得越来越重要。', 'zài quán qiú huà de bèi jǐng xià, kuà wén huà jiāo liú biān de yuè lái yuè zhòng yào.', 'In the context of globalization, cross-cultural communication is becoming increasingly important.', 5, 'news', 'hard', 21),
('s022', '科技创新是推动社会进步的核心动力之一。', 'kē jì chuàng xīn shì tuī dòng shè huì jìn bù de hé xīn dòng lì zhī yī.', 'Technological innovation is one of the core driving forces of social progress.', 5, 'news', 'hard', 22),
('s023', '我们应该充分利用这个机会来展示自己的能力。', 'wǒ men yīng gāi chōng fèn lì yòng zhè ge jī huì lái zhǎn shì zì jǐ de néng lì.', 'We should fully utilize this opportunity to showcase our abilities.', 5, 'business', 'medium', 23),
-- 成语/俗语
('s024', '入乡随俗，到了中国就要按照中国的习惯来。', 'rù xiāng suí sú, dào le zhōng guó jiù yào àn zhào zhōng guó de xí guàn lái.', 'When in Rome, do as the Romans do.', 3, 'idiom', 'medium', 24),
('s025', '一分耕耘，一分收获，没有付出就没有回报。', 'yì fēn gēng yún, yì fēn shōu huò, méi yǒu fù chū jiù méi yǒu huí bào.', 'No pain, no gain.', 4, 'idiom', 'hard', 25),
('s026', '百闻不如一见，你亲自去看看就知道了。', 'bǎi wén bù rú yí jiàn, nǐ qīn zì qù kàn kan jiù zhī dào le.', 'Seeing is better than hearing a hundred times.', 3, 'idiom', 'medium', 26),
('s027', '他做事总是半途而废，所以什么都做不好。', 'tā zuò shì zǒng shì bàn tú ér fèi, suǒ yǐ shén me dōu zuò bù hǎo.', 'He always gives up halfway, so he can''t do anything well.', 4, 'idiom', 'hard', 27),
('s028', '既然来了，就好好玩儿，别想太多。', 'jì rán lái le, jiù hǎo hǎo wánr, bié xiǎng tài duō.', 'Since you''re here, just enjoy yourself and don''t overthink.', 3, 'daily', 'medium', 28),
-- 高级句子
('s029', '不可否认，人工智能正在深刻地改变着我们的生活方式。', 'bù kě fǒu rèn, rén gōng zhì néng zhèng zài shēn kè de gǎi biàn zhe wǒ men de shēng huó fāng shì.', 'Undeniably, AI is profoundly changing our way of life.', 5, 'news', 'hard', 29),
('s030', '只有不断学习和适应变化，才能在激烈的竞争中立于不败之地。', 'zhǐ yǒu bù duàn xué xí hé shì yìng biàn huà, cái néng zài jī liè de jìng zhēng zhōng lì yú bù bài zhī dì.', 'Only by continuously learning and adapting to change can one remain invincible in fierce competition.', 6, 'news', 'hard', 30)
ON CONFLICT (id) DO NOTHING;

-- ============ 初始化配音片段（3 个原创） ============
INSERT INTO dubbing_clips (id, title, category, description, duration_seconds, hsk_level, difficulty, lines) VALUES
(
  'first-day-beijing',
  '初到北京',
  'original',
  '一位外国留学生刚到北京，和出租车司机的对话',
  45,
  3,
  'medium',
  '[
    {"index":1,"start":0,"end":5,"speaker":"司机","text":"您好！去哪儿？","pinyin":"nín hǎo! qù nǎr?","translation":"Hello! Where to?","emotion":"neutral"},
    {"index":2,"start":5,"end":12,"speaker":"留学生","text":"师傅，我去北京语言大学。","pinyin":"shī fu, wǒ qù běi jīng yǔ yán dà xué.","translation":"Driver, I''m going to Beijing Language and Culture University.","emotion":"neutral"},
    {"index":3,"start":12,"end":20,"speaker":"司机","text":"好嘞！你是新来的留学生吧？","pinyin":"hǎo lei! nǐ shì xīn lái de liú xué shēng ba?","translation":"Sure thing! You''re a new international student, right?","emotion":"happy"},
    {"index":4,"start":20,"end":28,"speaker":"留学生","text":"对，我刚到中国，第一次来北京。","pinyin":"duì, wǒ gāng dào zhōng guó, dì yī cì lái běi jīng.","translation":"Yes, I just arrived in China, first time in Beijing.","emotion":"excited"},
    {"index":5,"start":28,"end":38,"speaker":"司机","text":"北京好啊！有故宫、长城、烤鸭，你一定会喜欢的！","pinyin":"běi jīng hǎo a! yǒu gù gōng, cháng chéng, kǎo yā, nǐ yī dìng huì xǐ huān de!","translation":"Beijing is great! Forbidden City, Great Wall, Peking Duck, you''ll love it!","emotion":"excited"},
    {"index":6,"start":38,"end":45,"speaker":"留学生","text":"太好了！我很期待！","pinyin":"tài hǎo le! wǒ hěn qī dài!","translation":"Great! I''m looking forward to it!","emotion":"excited"}
  ]'::jsonb
),
(
  'job-interview-tech',
  '面试时刻',
  'original',
  '一位候选人在科技公司面试中的自我介绍',
  40,
  5,
  'hard',
  '[
    {"index":1,"start":0,"end":8,"speaker":"面试官","text":"请你简单介绍一下自己。","pinyin":"qǐng nǐ jiǎn dān jiè shào yí xià zì jǐ.","translation":"Please briefly introduce yourself.","emotion":"serious"},
    {"index":2,"start":8,"end":20,"speaker":"候选人","text":"好的，我叫大卫，从事软件开发已经五年了，擅长前端技术。","pinyin":"hǎo de, wǒ jiào dà wèi, cóng shì ruǎn jiàn kāi fā yǐ jīng wǔ nián le, shàn cháng qián duān jì shù.","translation":"Sure, my name is David, I''ve been in software development for five years, specializing in frontend.","emotion":"serious"},
    {"index":3,"start":20,"end":30,"speaker":"面试官","text":"你为什么选择我们公司？","pinyin":"nǐ wèi shén me xuǎn zé wǒ men gōng sī?","translation":"Why did you choose our company?","emotion":"neutral"},
    {"index":4,"start":30,"end":40,"speaker":"候选人","text":"因为贵公司在技术创新方面处于行业领先地位，我希望能在这里不断成长。","pinyin":"yīn wèi guì gōng sī zài jì shù chuàng xīn fāng miàn chǔ yú háng yè lǐng xiān dì wèi, wǒ xī wàng néng zài zhè lǐ bù duàn chéng zhǎng.","translation":"Because your company is industry-leading in tech innovation, I hope to keep growing here.","emotion":"serious"}
  ]'::jsonb
),
(
  'renting-apartment',
  '租房谈判',
  'original',
  '和房东谈租房条件的日常对话',
  35,
  4,
  'medium',
  '[
    {"index":1,"start":0,"end":6,"speaker":"租客","text":"请问这套房子多少钱一个月？","pinyin":"qǐng wèn zhè tào fáng zi duō shǎo qián yí ge yuè?","translation":"How much is this apartment per month?","emotion":"neutral"},
    {"index":2,"start":6,"end":14,"speaker":"房东","text":"五千块一个月，包水电费，不包网费。","pinyin":"wǔ qiān kuài yí ge yuè, bāo shuǐ diàn fèi, bù bāo wǎng fèi.","translation":"5000 yuan a month, water and electricity included, internet not included.","emotion":"neutral"},
    {"index":3,"start":14,"end":22,"speaker":"租客","text":"能不能便宜一点儿？四千五怎么样？","pinyin":"néng bu néng pián yi yì diǎnr? sì qiān wǔ zěn me yàng?","translation":"Can you make it cheaper? How about 4500?","emotion":"serious"},
    {"index":4,"start":22,"end":30,"speaker":"房东","text":"四千五有点儿低了，四千八，怎么样？","pinyin":"sì qiān wǔ yǒu diǎnr dī le, sì qiān bā, zěn me yàng?","translation":"4500 is a bit low, how about 4800?","emotion":"neutral"},
    {"index":5,"start":30,"end":35,"speaker":"租客","text":"好的，成交！","pinyin":"hǎo de, chéng jiāo!","translation":"OK, deal!","emotion":"happy"}
  ]'::jsonb
)
ON CONFLICT (id) DO NOTHING;
