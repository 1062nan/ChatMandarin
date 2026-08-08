-- 004: 预填充精选内容（方案 C 第 2 步）
-- 25 个额外对话场景 + 70 句额外跟读 + 7 个额外配音片段
-- 运行后总内容量：30 场景 / 100 跟读 / 10 配音

-- ============ 额外对话场景（25 个） ============
INSERT INTO scenarios (id, name, description, recommended_hsk, ai_persona, scenario_prompt, goals, completion_criteria, sort_order) VALUES
('shopping', '{"en":"Shopping","zh":"购物"}'::jsonb, '{"en":"Buy clothes at a shopping mall","zh":"在商场买衣服"}'::jsonb, ARRAY[2,3], 'You are a friendly shop assistant at a clothing store in Shanghai. You are helpful and patient.', 'Greet customer, ask what they want, recommend items, discuss sizes, handle price negotiation, complete sale.', '["Find an item","Try it on","Ask about price","Complete purchase"]'::jsonb, '{"min_turns":6}'::jsonb, 6),
('airport', '{"en":"Airport","zh":"机场"}'::jsonb, '{"en":"Check in and navigate the airport","zh":"机场值机和问路"}'::jsonb, ARRAY[3,4], 'You are a check-in agent at Beijing Capital Airport. You are professional and efficient.', 'Handle check-in: verify passport, ask about luggage, discuss seating, provide gate information.', '["Check in successfully","Ask about luggage rules","Find your gate"]'::jsonb, '{"min_turns":5}'::jsonb, 7),
('hotel', '{"en":"Hotel Check-in","zh":"酒店入住"}'::jsonb, '{"en":"Check into a hotel","zh":"在酒店办理入住"}'::jsonb, ARRAY[2,3], 'You are a receptionist at a mid-range hotel. You are polite and professional.', 'Greet guest, verify reservation, discuss room type, explain hotel facilities, handle special requests.', '["Complete check-in","Ask about breakfast","Request extra items"]'::jsonb, '{"min_turns":5}'::jsonb, 8),
('bank', '{"en":"Bank","zh":"银行"}'::jsonb, '{"en":"Open an account or exchange money","zh":"开户或换汇"}'::jsonb, ARRAY[4,5], 'You are a bank teller at ICBC. You are formal and precise.', 'Handle account opening, currency exchange, or money transfer. Explain procedures clearly.', '["Explain your needs","Complete the transaction","Ask about fees"]'::jsonb, '{"min_turns":6}'::jsonb, 9),
('directions', '{"en":"Asking Directions","zh":"问路"}'::jsonb, '{"en":"Ask for and give directions","zh":"问路和指路"}'::jsonb, ARRAY[2,3], 'You are a local Beijing resident. You are helpful and friendly, happy to give directions.', 'A foreigner asks you for directions. Provide clear instructions using landmarks and directions.', '["Ask for a location","Understand directions","Thank the person"]'::jsonb, '{"min_turns":4}'::jsonb, 10),
('phone-call', '{"en":"Phone Call","zh":"打电话"}'::jsonb, '{"en":"Make a restaurant reservation by phone","zh":"打电话预订餐厅"}'::jsonb, ARRAY[3,4], 'You are a restaurant host answering the phone. You are polite and efficient.', 'Answer phone, take reservation details (time, party size, special requests), confirm booking.', '["State your reservation needs","Confirm time and party size","Ask about parking"]'::jsonb, '{"min_turns":5}'::jsonb, 11),
('coffee', '{"en":"Coffee Shop","zh":"咖啡店"}'::jsonb, '{"en":"Order coffee and chat","zh":"点咖啡和聊天"}'::jsonb, ARRAY[1,2], 'You are a barista at Luckin Coffee. You are young and energetic.', 'Take coffee order, ask about size and sugar, suggest new items, handle payment.', '["Order a coffee","Customize your drink","Pay for your order"]'::jsonb, '{"min_turns":4}'::jsonb, 12),
('gym', '{"en":"Gym","zh":"健身房"}'::jsonb, '{"en":"Sign up for a gym membership","zh":"办健身卡"}'::jsonb, ARRAY[3,4], 'You are a fitness consultant at a gym. You are enthusiastic and persuasive.', 'Greet potential member, explain membership options, give a facility tour description, discuss pricing.', '["Ask about membership","Understand pricing","Sign up or decline"]'::jsonb, '{"min_turns":6}'::jsonb, 13),
('haircut', '{"en":"Hair Salon","zh":"理发店"}'::jsonb, '{"en":"Get a haircut","zh":"剪头发"}'::jsonb, ARRAY[2,3], 'You are a hairstylist. You are chatty and skilled.', 'Greet customer, ask about desired style, discuss length and treatment, make small talk during cut.', '["Describe the style you want","Make small talk","Pay and tip"]'::jsonb, '{"min_turns":5}'::jsonb, 14),
('library', '{"en":"Library","zh":"图书馆"}'::jsonb, '{"en":"Borrow books at the library","zh":"在图书馆借书"}'::jsonb, ARRAY[3,4], 'You are a librarian. You are quiet and knowledgeable.', 'Help student find books, explain borrowing rules, handle library card registration.', '["Apply for a library card","Find a specific book","Understand borrowing rules"]'::jsonb, '{"min_turns":5}'::jsonb, 15),
('market', '{"en":"Market Bargaining","zh":"菜市场讨价"}'::jsonb, '{"en":"Buy vegetables and bargain","zh":"买菜讨价还价"}'::jsonb, ARRAY[2,3], 'You are a fruit and vegetable vendor at a local market. You are lively and humorous.', 'Customer wants to buy fruit. Negotiate prices, recommend fresh items, close the deal.', '["Ask about prices","Bargain successfully","Complete purchase"]'::jsonb, '{"min_turns":6}'::jsonb, 16),
('pharmacy', '{"en":"Pharmacy","zh":"药店"}'::jsonb, '{"en":"Buy medicine at a pharmacy","zh":"在药店买药"}'::jsonb, ARRAY[3,4], 'You are a pharmacist. You are professional and caring.', 'Customer describes symptoms, recommend medicine, explain dosage, advise on precautions.', '["Describe your symptoms","Understand dosage instructions","Ask about side effects"]'::jsonb, '{"min_turns":5}'::jsonb, 17),
('rental', '{"en":"Apartment Viewing","zh":"看房"}'::jsonb, '{"en":"View an apartment for rent","zh":"看租房"}'::jsonb, ARRAY[4,5], 'You are a real estate agent showing an apartment. You are persuasive but honest.', 'Show the apartment, highlight features, discuss rent and deposit, negotiate terms.', '["Ask about the apartment","Discuss rent and deposit","Express interest or concerns"]'::jsonb, '{"min_turns":7}'::jsonb, 18),
('train', '{"en":"Train Station","zh":"火车站"}'::jsonb, '{"en":"Buy train tickets","zh":"买火车票"}'::jsonb, ARRAY[3,4], 'You are a ticket seller at Shanghai Hongqiao Station. You are efficient.', 'Handle ticket purchase: destination, date, seat class, payment. Provide platform info.', '["Buy a train ticket","Choose departure time","Ask about the platform"]'::jsonb, '{"min_turns":5}'::jsonb, 19),
('return', '{"en":"Returning Items","zh":"退货"}'::jsonb, '{"en":"Return a product to a store","zh":"去商店退货"}'::jsonb, ARRAY[3,4], 'You are a customer service representative. You are following store policy strictly.', 'Customer wants to return an item. Verify receipt, check condition, process refund or exchange.', '["Explain why you want to return","Answer questions about the item","Get your refund or exchange"]'::jsonb, '{"min_turns":5}'::jsonb, 20),
('invitation', '{"en":"Inviting Friends","zh":"邀请朋友"}'::jsonb, '{"en":"Invite a friend to dinner","zh":"请朋友吃饭"}'::jsonb, ARRAY[2,3], 'You are a Chinese friend. You are warm and casual.', 'Call a friend to invite them to dinner. Discuss time, place, food preferences, and transportation.', '["Invite your friend","Decide on time and place","End the conversation naturally"]'::jsonb, '{"min_turns":5}'::jsonb, 21),
('compliment', '{"en":"Giving Compliments","zh":"夸奖别人"}'::jsonb, '{"en":"Compliment a colleague","zh":"夸奖同事"}'::jsonb, ARRAY[3,4], 'You are a coworker. You are modest when complimented.', 'Exchange compliments about work, appearance, or achievements. Practice Chinese modesty in responses.', '["Give a compliment","Receive a compliment modestly","Continue the conversation"]'::jsonb, '{"min_turns":4}'::jsonb, 22),
('apology', '{"en":"Apologizing","zh":"道歉"}'::jsonb, '{"en":"Apologize for being late","zh":"迟到道歉"}'::jsonb, ARRAY[3,4], 'You are a friend who was kept waiting. You are understanding but slightly annoyed.', 'Your friend is late. Listen to their apology, accept or express frustration, plan what to do next.', '["Explain why you are late","Apologize sincerely","Make new plans"]'::jsonb, '{"min_turns":5}'::jsonb, 23),
('party', '{"en":"Party Chat","zh":"聚会聊天"}'::jsonb, '{"en":"Chat at a party","zh":"在聚会上聊天"}'::jsonb, ARRAY[3,4], 'You are a party guest. You are curious and friendly.', 'Meet new people at a party. Discuss work, hobbies, interests. Exchange contact info.', '["Introduce yourself","Ask about their work","Find common interests"]'::jsonb, '{"min_turns":5}'::jsonb, 24),
('weather', '{"en":"Weather Chat","zh":"聊天气"}'::jsonb, '{"en":"Small talk about weather","zh":"聊天气"}'::jsonb, ARRAY[1,2], 'You are a friendly neighbor. You like chatting about daily life.', 'Run into a neighbor. Chat about weather, seasons, and daily activities.', '["Comment on the weather","Talk about seasons","End politely"]'::jsonb, '{"min_turns":4}'::jsonb, 25),
('school', '{"en":"First Day at School","zh":"开学第一天"}'::jsonb, '{"en":"Register for classes","zh":"报到选课"}'::jsonb, ARRAY[4,5], 'You are a university academic advisor. You are helpful and organized.', 'Help a new student register for classes, explain requirements, discuss schedule.', '["Ask about course registration","Discuss your schedule","Understand requirements"]'::jsonb, '{"min_turns":6}'::jsonb, 26),
('pet', '{"en":"Pet Store","zh":"宠物店"}'::jsonb, '{"en":"Buy supplies at a pet store","zh":"在宠物店买东西"}'::jsonb, ARRAY[2,3], 'You are a pet store owner. You love animals and are very knowledgeable.', 'Customer wants pet supplies. Recommend products, give advice on pet care, discuss prices.', '["Describe what you need","Get advice on pet care","Buy items"]'::jsonb, '{"min_turns":5}'::jsonb, 27),
('network', '{"en":"Networking","zh":"社交活动"}'::jsonb, '{"en":"Network at a business event","zh":"在商务活动中拓展人脉"}'::jsonb, ARRAY[5,6], 'You are a tech industry professional at a networking event. You are confident and articulate.', 'Meet someone new, exchange business cards, discuss industry trends, plan to follow up.', '["Introduce yourself professionally","Discuss industry topics","Exchange contact info"]'::jsonb, '{"min_turns":6}'::jsonb, 28),
('post-office', '{"en":"Post Office","zh":"邮局"}'::jsonb, '{"en":"Send a package at the post office","zh":"在邮局寄包裹"}'::jsonb, ARRAY[3,4], 'You are a postal worker. You are methodical and clear.', 'Help customer send a package: weigh, choose shipping method, fill forms, calculate cost.', '["Send a package","Choose shipping method","Fill out forms"]'::jsonb, '{"min_turns":5}'::jsonb, 29),
('visa', '{"en":"Visa Office","zh":"签证处"}'::jsonb, '{"en":"Apply for a visa extension","zh":"办理签证延期"}'::jsonb, ARRAY[5,6], 'You are an immigration officer. You are strict and follow procedures precisely.', 'Process visa extension: verify documents, ask about purpose of stay, explain requirements.', '["Submit your application","Answer questions about your stay","Understand next steps"]'::jsonb, '{"min_turns":6}'::jsonb, 30)
ON CONFLICT (id) DO NOTHING;

-- ============ 额外影子跟读句（70 句） ============
INSERT INTO shadowing_sentences (id, text_zh, text_pinyin, text_en, hsk_level, category, difficulty, sort_order) VALUES
-- HSK 1 日常（10 句）
('s031', '我每天早上六点起床。', 'wǒ měi tiān zǎo shàng liù diǎn qǐ chuáng.', 'I get up at 6 every morning.', 1, 'daily', 'easy', 31),
('s032', '这个多少钱？', 'zhè ge duō shǎo qián?', 'How much is this?', 1, 'daily', 'easy', 32),
('s033', '我喜欢喝绿茶，不喜欢喝咖啡。', 'wǒ xǐ huan hē lǜ chá, bù xǐ huan hē kā fēi.', 'I like green tea, not coffee.', 1, 'daily', 'easy', 33),
('s034', '我家有四口人。', 'wǒ jiā yǒu sì kǒu rén.', 'There are four people in my family.', 1, 'daily', 'easy', 34),
('s35', '今天星期几？今天星期三。', 'jīn tiān xīng qī jǐ? jīn tiān xīng qī sān.', 'What day is today? Today is Wednesday.', 1, 'daily', 'easy', 35),
('s036', '你会说中文吗？', 'nǐ huì shuō zhōng wén ma?', 'Can you speak Chinese?', 1, 'daily', 'easy', 36),
('s037', '这个字怎么写？', 'zhè ge zì zěn me xiě?', 'How do you write this character?', 1, 'education', 'easy', 37),
('s038', '我去图书馆看书。', 'wǒ qù tú shū guǎn kàn shū.', 'I go to the library to read books.', 1, 'daily', 'easy', 38),
('s039', '这道菜很好吃，请再给我一份。', 'zhè dào cài hěn hǎo chī, qǐng zài gěi wǒ yí fèn.', 'This dish is delicious, please give me another serving.', 1, 'travel', 'easy', 39),
('s040', '对不起，我听不懂。', 'duì bu qǐ, wǒ tīng bu dǒng.', 'Sorry, I do not understand.', 1, 'daily', 'easy', 40),
-- HSK 2 商务/旅行（10 句）
('s041', '请问，去机场怎么走？坐机场大巴就可以。', 'qǐng wèn, qù jī chǎng zěn me zǒu? zuò jī chǎng dà bā jiù kě yǐ.', 'Excuse me, how to get to the airport? Take the airport bus.', 2, 'travel', 'easy', 41),
('s042', '我们公司的老板非常严格，但是也很公平。', 'wǒ men gōng sī de lǎo bǎn fēi cháng yán gé, dàn shì yě hěn gōng píng.', 'Our boss is very strict but also fair.', 2, 'business', 'easy', 42),
('s043', '因为下雨了，所以我不去打球了。', 'yīn wèi xià yǔ le, suǒ yǐ wǒ bù qù dǎ qiú le.', 'Because it rained, I am not going to play ball.', 2, 'daily', 'easy', 43),
('s044', '你想喝点儿什么？给我一杯热茶吧。', 'nǐ xiǎng hē diǎnr shén me? gěi wǒ yì bēi rè chá ba.', 'What would you like to drink? Give me a cup of hot tea.', 2, 'daily', 'easy', 44),
('s045', '我打算明年去中国留学。', 'wǒ dǎ suàn míng nián qù zhōng guó liú xué.', 'I plan to study abroad in China next year.', 2, 'education', 'easy', 45),
('s046', '这个房间太小了，有没有大一点儿的？', 'zhè ge fáng jiān tài xiǎo le, yǒu méi yǒu dà yì diǎnr de?', 'This room is too small, do you have a bigger one?', 2, 'travel', 'easy', 46),
('s047', '虽然工作很忙，但我每天晚上都学习中文。', 'suī rán gōng zuò hěn máng, dàn wǒ měi tiān wǎn shàng dōu xué xí zhōng wén.', 'Although work is busy, I study Chinese every night.', 2, 'education', 'easy', 47),
('s048', '你能帮我一个忙吗？当然可以。', 'nǐ néng bāng wǒ yí ge máng ma? dāng rán kě yǐ.', 'Can you do me a favor? Of course.', 2, 'daily', 'easy', 48),
('s049', '我觉得冬天比夏天舒服。', 'wǒ jué de dōng tiān bǐ xià tiān shū fu.', 'I think winter is more comfortable than summer.', 2, 'daily', 'easy', 49),
('s050', '这张照片拍得真好看！', 'zhè zhāng zhào piàn pāi de zhēn hǎo kàn!', 'This photo looks really nice!', 2, 'daily', 'easy', 50),
-- HSK 3 综合（15 句）
('s051', '如果你明天有空的话，我们一起去看电影吧。', 'rú guǒ nǐ míng tiān yǒu kòng de huà, wǒ men yì qǐ qù kàn diàn yǐng ba.', 'If you are free tomorrow, lets go watch a movie.', 3, 'daily', 'medium', 51),
('s052', '把那本书放在桌子上，别放在椅子上。', 'bǎ nà běn shū fàng zài zhuō zi shàng, bié fàng zài yǐ zi shàng.', 'Put that book on the table, do not put it on the chair.', 3, 'daily', 'medium', 52),
('s053', '她不但会说汉语，而且说得非常流利。', 'tā bù dàn huì shuō hàn yǔ, ér qiě shuō de fēi cháng liú lì.', 'She can not only speak Chinese but also speaks it fluently.', 3, 'business', 'medium', 53),
('s054', '我还没决定去不去参加明天的会议。', 'wǒ hái méi jué dìng qù bu qù cān jiā míng tiān de huì yì.', 'I have not decided whether to attend tomorrow is meeting.', 3, 'business', 'medium', 54),
('s055', '外面太冷了，你最好多穿一件衣服。', 'wài miàn tài lěng le, nǐ zuì hǎo duō chuān yí jiàn yī fu.', 'It is too cold outside, you had better wear an extra layer.', 3, 'daily', 'medium', 55),
('s056', '只要每天练习，你的中文一定会越来越好。', 'zhǐ yào měi tiān liàn xí, nǐ de zhōng wén yí dìng huì yuè lái yuè hǎo.', 'As long as you practice every day, your Chinese will definitely get better.', 3, 'idiom', 'medium', 56),
('s057', '让他先休息一下，他刚做完手术。', 'ràng tā xiān xiū xi yí xià, tā gāng zuò wán shǒu shù.', 'Let him rest first, he just had surgery.', 3, 'daily', 'medium', 57),
('s058', '服务员，请帮我们拍一张合影。', 'fú wù yuán, qǐng bāng wǒ men pāi yì zhāng hé yǐng.', 'Waiter, please take a group photo for us.', 3, 'travel', 'medium', 58),
('s059', '既然你不喜欢吃辣的，那我们就去吃广东菜。', 'jì rán nǐ bù xǐ huan chī là de, nà wǒ men jiù qù chī guǎng dōng cài.', 'Since you do not like spicy food, let us go eat Cantonese food.', 3, 'daily', 'medium', 59),
('s060', '这个故事的结尾出乎我的意料。', 'zhè ge gù shi de jié wěi chū hū wǒ de yì liào.', 'The ending of this story was beyond my expectations.', 3, 'daily', 'medium', 60),
('s061', '无论多忙，我都会坚持锻炼身体。', 'wú lùn duō máng, wǒ dōu huì jiān chí duàn liàn shēn tǐ.', 'No matter how busy, I will keep exercising.', 3, 'idiom', 'hard', 61),
('s062', '与其在家待着，不如出去散散步。', 'yǔ qí zài jiā dāi zhe, bù rú chū qù sàn sàn bù.', 'Rather than staying home, it is better to go for a walk.', 3, 'idiom', 'hard', 62),
('s063', '通过这次旅行，我不仅学到了很多，还交了不少朋友。', 'tōng guò zhè cì lǚ xíng, wǒ bù jǐn xué dào le hěn duō, hái jiāo le bù shǎo péng yǒu.', 'Through this trip, I not only learned a lot but also made many friends.', 3, 'travel', 'medium', 63),
('s064', '刚来中国的时候，我什么中文都不会说。', 'gāng lái zhōng guó de shí hòu, wǒ shén me zhōng wén dōu bú huì shuō.', 'When I first came to China, I could not speak any Chinese.', 3, 'daily', 'medium', 64),
('s065', '只要功夫深，铁杵磨成针。', 'zhǐ yào gōng fu shēn, tiě chǔ mó chéng zhēn.', 'With enough effort, an iron rod can be ground into a needle.', 3, 'idiom', 'hard', 65),
-- HSK 4-5 综合（15 句）
('s066', '近年来，中国的移动支付发展速度令人惊讶。', 'jìn nián lái, zhōng guó de yí dòng zhī fù fā zhǎn sù dù lìng rén jīng yà.', 'In recent years, the speed of mobile payment development in China is astonishing.', 4, 'news', 'hard', 66),
('s067', '尽管遇到了各种各样的困难，他始终没有放弃自己的梦想。', 'jǐn guǎn yù dào le gè zhǒng gè yàng de kùn nán, tā shǐ zhōng méi yǒu fàng qì zì jǐ de mèng xiǎng.', 'Despite various difficulties, he never gave up his dream.', 4, 'daily', 'hard', 67),
('s068', '在这个信息爆炸的时代，学会独立思考比以往任何时候都重要。', 'zài zhè ge xìn xī bào zhà de shí dài, xué huì dú lì sī kǎo bǐ yǐ wǎng rèn hé shí hòu dōu zhòng yào.', 'In this era of information explosion, learning to think independently is more important than ever.', 5, 'news', 'hard', 68),
('s069', '保护环境是每个人的责任，从身边的小事做起。', 'bǎo hù huán jìng shì měi ge rén de zé rèn, cóng shēn biān de xiǎo shì zuò qǐ.', 'Protecting the environment is everyone is responsibility, starting from small things around us.', 4, 'news', 'medium', 69),
('s070', '他的成功绝非偶然，而是长期努力的结果。', 'tā de chéng gōng jué fēi ǒu rán, ér shì cháng qī nǔ lì de jié guǒ.', 'His success is by no means accidental, but the result of long-term effort.', 5, 'business', 'hard', 70),
-- 成语/俗语（10 句）
('s071', '有志者事竟成，只要努力就一定能成功。', 'yǒu zhì zhě shì jìng chéng, zhǐ yào nǔ lì jiù yí dìng néng chéng gōng.', 'Where there is a will, there is a way.', 4, 'idiom', 'hard', 71),
('s072', '俗话说，入乡随俗，到了中国就要习惯中国人的生活方式。', 'sú huà shuō, rù xiāng suí sú, dào le zhōng guó jiù yào xí guàn zhōng guó rén de shēng huó fāng shì.', 'As the saying goes, when in Rome, do as the Romans do.', 4, 'idiom', 'hard', 72),
('s073', '他做事情总是虎头蛇尾，开始很积极，后来就不行了。', 'tā zuò shì qing zǒng shì hǔ tóu shé wěi, kāi shǐ hěn jī jí, hòu lái jiù bù xíng le.', 'He always starts strong but fizzles out.', 4, 'idiom', 'hard', 73),
('s074', '这次考试我考砸了，真是功夫不负有心人的反面教材。', 'zhè cì kǎo shì wǒ kǎo zá le, zhēn shì gōng fu bù fù yǒu xīn rén de fǎn miàn jiào cái.', 'I failed this exam, it is the opposite of effort pays off.', 5, 'idiom', 'hard', 74),
('s075', '人心齐，泰山移，只要团结起来，什么困难都能克服。', 'rén xīn qí, tài shān yí, zhǐ yào tuán jié qǐ lái, shén me kùn nán dōu néng kè fú.', 'When people unite, they can move mountains.', 5, 'idiom', 'hard', 75),
-- 高级商务/学术（10 句）
('s076', '在中国做生意，建立良好的人际关系网络至关重要。', 'zài zhōng guó zuò shēng yi, jiàn lì liáng hǎo de rén jì guān xì wǎng luò zhì guān zhòng yào.', 'Doing business in China, building good interpersonal networks is crucial.', 5, 'business', 'hard', 76),
('s077', '随着人工智能技术的不断发展，许多传统行业面临着前所未有的挑战。', 'suí zhe rén gōng zhì néng jì shù de bù duàn fā zhǎn, xǔ duō chuán tǒng háng yè miàn lín zhe qián suǒ wèi yǒu de tiǎo zhàn.', 'With the continuous development of AI technology, many traditional industries face unprecedented challenges.', 6, 'news', 'hard', 77),
('s078', '中华文化源远流长，博大精深，值得每一个人去深入了解。', 'zhōng huá wén huà yuán yuǎn liú cháng, bó dà jīng shēn, zhí dé měi yí ge rén qù shēn rù liǎo jiě.', 'Chinese culture has a long history and profound depth, worth deep understanding.', 6, 'news', 'hard', 78),
('s079', '在面试中，自信和谦虚之间的平衡非常重要。', 'zài miàn shì zhōng, zì xìn hé qiān xū zhī jiān de píng héng fēi cháng zhòng yào.', 'In interviews, the balance between confidence and humility is very important.', 5, 'business', 'hard', 79),
('s080', '我们应该从长远的角度来思考问题，而不是只看眼前利益。', 'wǒ men yīng gāi cóng cháng yuǎn de jiǎo dù lái sī kǎo wèn tí, ér bú shì zhǐ kàn yǎn qián lì yì.', 'We should think about problems from a long-term perspective, not just immediate benefits.', 5, 'business', 'hard', 80),
-- 对话常用句（20 句）
('s081', '不好意思，打扰一下，我想问一个问题。', 'bù hǎo yì si, dǎ rǎo yí xià, wǒ xiǎng wèn yí ge wèn tí.', 'Excuse me, I want to ask a question.', 2, 'daily', 'easy', 81),
('s082', '没关系，别放在心上。', 'méi guān xi, bié fàng zài xīn shàng.', 'It is okay, do not worry about it.', 2, 'daily', 'easy', 82),
('s083', '你觉得怎么样？我听听你的想法。', 'nǐ jué de zěn me yàng? wǒ tīng ting nǐ de xiǎng fǎ.', 'What do you think? I want to hear your thoughts.', 3, 'daily', 'medium', 83),
('s084', '让我想想，给我一点儿时间。', 'ràng wǒ xiǎng xiang, gěi wǒ yì diǎnr shí jiān.', 'Let me think, give me a little time.', 2, 'daily', 'easy', 84),
('s085', '说得好，我完全同意你的看法。', 'shuō de hǎo, wǒ wán quán tóng yì nǐ de kàn fǎ.', 'Well said, I completely agree with your view.', 3, 'business', 'medium', 85),
('s086', '辛苦了，好好休息一下吧。', 'xīn kǔ le, hǎo hǎo xiū xi yí xià ba.', 'You worked hard, take a good rest.', 2, 'daily', 'easy', 86),
('s087', '别着急，慢慢来，我们有的是时间。', 'bié zháo jí, màn man lái, wǒ men yǒu de shì shí jiān.', 'Do not rush, take your time, we have plenty of time.', 3, 'daily', 'medium', 87),
('s088', '你说得对，我之前怎么没想到呢。', 'nǐ shuō de duì, wǒ zhī qián zěn me méi xiǎng dào ne.', 'You are right, how did I not think of that before.', 3, 'daily', 'medium', 88),
('s089', '太棒了，这正是我想要的。', 'tài bàng le, zhè zhèng shì wǒ xiǎng yào de.', 'Awesome, this is exactly what I wanted.', 2, 'daily', 'easy', 89),
('s090', '一言为定，明天下午三点见。', 'yì yán wéi dìng, míng tiān xià wǔ sān diǎn jiàn.', 'It is a deal, see you at 3pm tomorrow.', 3, 'daily', 'medium', 90),
('s091', '一切顺利，请放心。', 'yí qiè shùn lì, qǐng fàng xīn.', 'Everything is going well, do not worry.', 3, 'business', 'medium', 91),
('s092', '感谢你的帮助，没有你我不可能完成。', 'gǎn xiè nǐ de bāng zhù, méi yǒu nǐ wǒ bù kě néng wán chéng.', 'Thank you for your help, I could not have done it without you.', 3, 'daily', 'medium', 92),
('s093', '没问题，包在我身上。', 'méi wèn tí, bāo zài wǒ shēn shàng.', 'No problem, leave it to me.', 3, 'daily', 'medium', 93),
('s094', '时间不早了，我们改天再聊吧。', 'shí jiān bù zǎo le, wǒ men gǎi tiān zài liáo ba.', 'It is getting late, let us chat another day.', 3, 'daily', 'medium', 94),
('s095', '说实话，我对这个结果不太满意。', 'shuō shí huà, wǒ duì zhè ge jié guǒ bú tài mǎn yì.', 'To be honest, I am not very satisfied with this result.', 4, 'business', 'hard', 95),
('s096', '太厉害了，你怎么做到的？', 'tài lì hai le, nǐ zěn me zuò dào de?', 'That is amazing, how did you do it?', 2, 'daily', 'easy', 96),
('s097', '以后有什么事，随时联系我。', 'yǐ hòu yǒu shén me shì, suí shí lián xì wǒ.', 'If you need anything in the future, contact me anytime.', 3, 'business', 'medium', 97),
('s098', '别客气，这是我应该做的。', 'bié kè qi, zhè shì wǒ yīng gāi zuò de.', 'You are welcome, it is what I should do.', 2, 'daily', 'easy', 98),
('s099', '我理解你的感受，但事情没有你想的那么严重。', 'wǒ lǐ jiě nǐ de gǎn shòu, dàn shì qing méi yǒu nǐ xiǎng de nà me yán zhòng.', 'I understand how you feel, but it is not as serious as you think.', 4, 'daily', 'hard', 99),
('s100', '相信自己，你一定可以的。', 'xiāng xìn zì jǐ, nǐ yí dìng kě yǐ de.', 'Believe in yourself, you can definitely do it.', 2, 'daily', 'easy', 100)
ON CONFLICT (id) DO NOTHING;

-- ============ 额外配音片段（7 个） ============
INSERT INTO dubbing_clips (id, title, category, description, duration_seconds, hsk_level, difficulty, lines) VALUES
(
  'grandmas-cooking',
  '奶奶的厨艺',
  'original',
  '孙子回家看奶奶，奶奶做了他最爱吃的菜',
  40,
  3,
  'medium',
  '[
    {"index":1,"speaker":"奶奶","text":"回来啦！快坐，奶奶给你做了红烧肉！","pinyin":"huí lái la! kuài zuò, nǎi nai gěi nǐ zuò le hóng shāo ròu!","translation":"You are back! Sit down, Grandma made you braised pork!","emotion":"happy"},
    {"index":2,"speaker":"孙子","text":"太好了！奶奶做的红烧肉是全世界最好吃的！","pinyin":"tài hǎo le! nǎi nai zuò de hóng shāo ròu shì quán shì jiè zuì hǎo chī de!","translation":"Great! Grandma braised pork is the best in the world!","emotion":"excited"},
    {"index":3,"speaker":"奶奶","text":"就你嘴甜！来，多吃点，你太瘦了。","pinyin":"jiù nǐ zuǐ tián! lái, duō chī diǎn, nǐ tài shòu le.","translation":"You smooth talker! Come, eat more, you are too thin.","emotion":"happy"},
    {"index":4,"speaker":"孙子","text":"奶奶，您也要多吃，身体最重要。","pinyin":"nǎi nai, nín yě yào duō chī, shēn tǐ zuì zhòng yào.","translation":"Grandma, you should eat more too, health is most important.","emotion":"serious"},
    {"index":5,"speaker":"奶奶","text":"好好好，我们一起吃！","pinyin":"hǎo hǎo hǎo, wǒ men yì qǐ chī!","translation":"Okay okay, let us eat together!","emotion":"happy"}
  ]'::jsonb
),
(
  'job-offer-call',
  '录用通知',
  'original',
  'HR打电话通知候选人通过了面试',
  35,
  5,
  'hard',
  '[
    {"index":1,"speaker":"HR","text":"您好，恭喜您通过了我们的面试！","pinyin":"nín hǎo, gōng xǐ nín tōng guò le wǒ men de miàn shì!","translation":"Hello, congratulations on passing our interview!","emotion":"happy"},
    {"index":2,"speaker":"候选人","text":"真的吗？太好了！非常感谢！","pinyin":"zhēn de ma? tài hǎo le! fēi cháng gǎn xiè!","translation":"Really? That is great! Thank you so much!","emotion":"excited"},
    {"index":3,"speaker":"HR","text":"我们非常欣赏您的专业能力，期待您加入团队。","pinyin":"wǒ men fēi cháng xīn shǎng nín de zhuān yè néng lì, qī dài nín jiā rù tuán duì.","translation":"We highly appreciate your professional skills and look forward to you joining the team.","emotion":"serious"},
    {"index":4,"speaker":"候选人","text":"我一定会努力工作，不辜负你们的期望。","pinyin":"wǒ yí dìng huì nǔ lì gōng zuò, bù gū fù nǐ men de qī wàng.","translation":"I will definitely work hard and not let you down.","emotion":"serious"}
  ]'::jsonb
),
(
  'lost-tourist',
  '迷路的游客',
  'original',
  '外国游客在中国迷路，向当地人问路',
  45,
  2,
  'easy',
  '[
    {"index":1,"speaker":"游客","text":"你好！请问火车站怎么走？","pinyin":"nǐ hǎo! qǐng wèn huǒ chē zhàn zěn me zǒu?","translation":"Hi! Excuse me, how to get to the train station?","emotion":"neutral"},
    {"index":2,"speaker":"路人","text":"火车站？你往前走，到红绿灯左转。","pinyin":"huǒ chē zhàn? nǐ wǎng qián zǒu, dào hóng lǜ dēng zuǒ zhuǎn.","translation":"Train station? Go straight ahead, turn left at the traffic light.","emotion":"helpful"},
    {"index":3,"speaker":"游客","text":"往前走，然后左转。远吗？","pinyin":"wǎng qián zǒu, rán hòu zuǒ zhuǎn. yuǎn ma?","translation":"Go straight, then left. Is it far?","emotion":"neutral"},
    {"index":4,"speaker":"路人","text":"不远，走路十分钟就到了。","pinyin":"bù yuǎn, zǒu lù shí fēn zhōng jiù dào le.","translation":"Not far, about ten minutes walk.","emotion":"helpful"},
    {"index":5,"speaker":"游客","text":"太好了，谢谢你！中国人真友好！","pinyin":"tài hǎo le, xiè xie nǐ! zhōng guó rén zhēn yǒu hǎo!","translation":"Great, thank you! Chinese people are so friendly!","emotion":"happy"},
    {"index":6,"speaker":"路人","text":"不客气，祝你一路平安！","pinyin":"bú kè qi, zhù nǐ yí lù píng ān!","translation":"You are welcome, have a safe trip!","emotion":"happy"}
  ]'::jsonb
),
(
  'business-negotiation',
  '商务谈判',
  'original',
  '两家公司商谈合作条件',
  50,
  5,
  'hard',
  '[
    {"index":1,"speaker":"甲方","text":"关于这次合作，我们希望利润分成是五五。","pinyin":"guān yú zhè cì hé zuò, wǒ men xī wàng lì rùn fēn chéng shì wǔ wǔ.","translation":"Regarding this cooperation, we hope for a 50-50 profit split.","emotion":"serious"},
    {"index":2,"speaker":"乙方","text":"五五恐怕不太合适，毕竟核心技术是我们提供的。","pinyin":"wǔ wǔ kǒng pà bú tài hé shì, bì jìng hé xīn jì shù shì wǒ men tí gōng de.","translation":"50-50 might not be appropriate, after all, we provide the core technology.","emotion":"serious"},
    {"index":3,"speaker":"甲方","text":"但是市场渠道和人脉资源是我们负责的。","pinyin":"dàn shì shì chǎng qú dào hé rén mài zī yuán shì wǒ men fù zé de.","translation":"But we are responsible for market channels and networking resources.","emotion":"serious"},
    {"index":4,"speaker":"乙方","text":"这样吧，我们各退一步，四六怎么样？","pinyin":"zhè yàng ba, wǒ men gè tuì yí bù, sì liù zěn me yàng?","translation":"How about this, we each take a step back, 40-60?","emotion":"neutral"},
    {"index":5,"speaker":"甲方","text":"好，四六就四六，合作愉快！","pinyin":"hǎo, sì liù jiù sì liù, hé zuò yú kuài!","translation":"Okay, 40-60 it is, happy cooperation!","emotion":"happy"}
  ]'::jsonb
),
(
  'morning-routine',
  '忙碌的早晨',
  'original',
  '室友之间的日常对话，匆忙准备出门',
  30,
  2,
  'easy',
  '[
    {"index":1,"speaker":"A","text":"快起来！已经八点了！","pinyin":"kuài qǐ lái! yǐ jīng bā diǎn le!","translation":"Get up! It is already 8!","emotion":"excited"},
    {"index":2,"speaker":"B","text":"什么？八点了？糟糕，我要迟到了！","pinyin":"shén me? bā diǎn le? zāo gāo, wǒ yào chí dào le!","translation":"What? 8 already? Oh no, I am going to be late!","emotion":"fearful"},
    {"index":3,"speaker":"A","text":"我帮你准备了早餐，快吃！","pinyin":"wǒ bāng nǐ zhǔn bèi le zǎo cān, kuài chī!","translation":"I prepared breakfast for you, eat quickly!","emotion":"happy"},
    {"index":4,"speaker":"B","text":"太感谢了！你真是我的救星！","pinyin":"tài gǎn xiè le! nǐ zhēn shì wǒ de jiù xīng!","translation":"Thank you so much! You are my savior!","emotion":"happy"}
  ]'::jsonb
),
(
  'shopping-dispute',
  '退货风波',
  'original',
  '顾客退货时与店员的对话',
  40,
  3,
  'medium',
  '[
    {"index":1,"speaker":"顾客","text":"你好，这件衣服我想退货。","pinyin":"nǐ hǎo, zhè jiàn yī fu wǒ xiǎng tuì huò.","translation":"Hi, I want to return this clothing.","emotion":"neutral"},
    {"index":2,"speaker":"店员","text":"请问有什么问题吗？","pinyin":"qǐng wèn yǒu shén me wèn tí ma?","translation":"Is there any problem with it?","emotion":"neutral"},
    {"index":3,"speaker":"顾客","text":"颜色和网上图片不一样，色差太大了。","pinyin":"yán sè hé wǎng shàng tú piàn bù yí yàng, sè chā tài dà le.","translation":"The color is different from the online picture, the color difference is too big.","emotion":"angry"},
    {"index":4,"speaker":"店员","text":"好的，有购物小票吗？我可以帮您办理退货。","pinyin":"hǎo de, yǒu gòu wù xiǎo piào ma? wǒ kě yǐ bāng nín bàn lǐ tuì huò.","translation":"Okay, do you have the receipt? I can process the return for you.","emotion":"neutral"},
    {"index":5,"speaker":"顾客","text":"有，给你。谢谢。","pinyin":"yǒu, gěi nǐ. xiè xie.","translation":"Yes, here you go. Thanks.","emotion":"neutral"}
  ]'::jsonb
),
(
  'school-reunion',
  '同学聚会',
  'original',
  '多年后老同学重逢',
  45,
  4,
  'medium',
  '[
    {"index":1,"speaker":"A","text":"好久不见！你还是老样子，一点没变。","pinyin":"hǎo jiǔ bú jiàn! nǐ hái shì lǎo yàng zi, yì diǎn méi biàn.","translation":"Long time no see! You look exactly the same, have not changed a bit.","emotion":"happy"},
    {"index":2,"speaker":"B","text":"哪里哪里，你才年轻呢！孩子们都好吗？","pinyin":"nǎ li nǎ li, nǐ cái nián qīng ne! hái zi men dōu hǎo ma?","translation":"Not at all, you are the young one! Are the kids doing well?","emotion":"happy"},
    {"index":3,"speaker":"A","text":"都很好，大的上中学了，小的刚上小学。时间过得真快啊！","pinyin":"dōu hěn hǎo, dà de shàng zhōng xué le, xiǎo de gāng shàng xiǎo xué. shí jiān guò de zhēn kuài a!","translation":"They are doing well, the older one is in middle school, the younger just started elementary. Time flies!","emotion":"neutral"},
    {"index":4,"speaker":"B","text":"是啊，转眼我们都毕业二十年了。来，为我们友谊干杯！","pinyin":"shì a, zhuǎn yǎn wǒ men dōu bì yè èr shí nián le. lái, wèi wǒ men yǒu yì gān bēi!","translation":"Yes, in a blink we graduated 20 years ago. Come, cheers to our friendship!","emotion":"excited"},
    {"index":5,"speaker":"A","text":"干杯！希望我们永远是好朋友。","pinyin":"gān bēi! xī wàng wǒ men yǒng yuǎn shì hǎo péng yǒu.","translation":"Cheers! Hope we will always be good friends.","emotion":"happy"}
  ]'::jsonb
)
ON CONFLICT (id) DO NOTHING;

-- ============ 验证 ============
-- SELECT count(*) FROM scenarios;        -- 应该 30+
-- SELECT count(*) FROM shadowing_sentences; -- 应该 100+
-- SELECT count(*) FROM dubbing_clips;      -- 应该 10+
