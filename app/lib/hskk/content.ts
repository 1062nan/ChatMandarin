/**
 * HSKK 模考内容库
 * 每级 3 套完整模考（朗读 + 问答 + 看图说话）
 * 内容参考官方 HSKK 考试大纲
 */

export type HSKKLevel = 'beginner' | 'intermediate' | 'advanced'

export interface HSKKTestContent {
  level: HSKKLevel
  variant: number
  // Section 1: 朗读
  readAloud: {
    passage: string
    preparationTime: number // seconds
    maxRecordTime: number // seconds
  }
  // Section 2: 问答
  qa: {
    questions: Array<{
      question: string
      audio?: string // 如果有预录音频
      preparationTime: number
      maxAnswerTime: number
    }>
  }
  // Section 3: 看图说话
  pictureDescription: {
    imageUrl: string
    prompt: string
    preparationTime: number
    maxRecordTime: number
  }
}

export const HSKK_CONTENT: HSKKTestContent[] = [
  // ============ 初级 ============
  {
    level: 'beginner',
    variant: 1,
    readAloud: {
      passage: '我是一个留学生，我叫大卫。我在北京学习汉语。我的老师很好，同学们也很友好。每天上午上课，下午我去图书馆看书。周末的时候，我常常和朋友一起去吃饭、看电影。我很喜欢在中国的生活。',
      preparationTime: 30,
      maxRecordTime: 120
    },
    qa: {
      questions: [
        { question: '你叫什么名字？', preparationTime: 5, maxAnswerTime: 30 },
        { question: '你每天几点起床？', preparationTime: 5, maxAnswerTime: 30 },
        { question: '你喜欢吃什么中国菜？', preparationTime: 5, maxAnswerTime: 30 }
      ]
    },
    pictureDescription: {
      imageUrl: 'https://images.unsplash.com/photo-1526317899638-78c289e1a871?w=800',
      prompt: '请看这张图片，描述图片中的内容。请尽量多说。',
      preparationTime: 30,
      maxRecordTime: 60
    }
  },
  {
    level: 'beginner',
    variant: 2,
    readAloud: {
      passage: '我的家有三口人：爸爸、妈妈和我。爸爸是医生，每天在医院工作。妈妈是老师，在一个小学教书。我今年二十岁，是一个大学生。我们一家人都很忙，但是每个周末都会一起吃饭。我觉得我的家庭很幸福。',
      preparationTime: 30,
      maxRecordTime: 120
    },
    qa: {
      questions: [
        { question: '你家有几口人？', preparationTime: 5, maxAnswerTime: 30 },
        { question: '你的爸爸做什么工作？', preparationTime: 5, maxAnswerTime: 30 },
        { question: '你周末一般做什么？', preparationTime: 5, maxAnswerTime: 30 }
      ]
    },
    pictureDescription: {
      imageUrl: 'https://images.unsplash.com/photo-1571687949921-1306bfb24b72?w=800',
      prompt: '请看这张图片，描述图片中的内容。',
      preparationTime: 30,
      maxRecordTime: 60
    }
  },
  {
    level: 'beginner',
    variant: 3,
    readAloud: {
      passage: '北京是中国的首都，也是一个很大很美的城市。北京有很多有名的地方，比如长城、故宫和天安门。每年有很多外国朋友来北京旅游。北京的烤鸭很有名，大家都喜欢吃。冬天的时候，北京会下雪，很冷但是很漂亮。',
      preparationTime: 30,
      maxRecordTime: 120
    },
    qa: {
      questions: [
        { question: '你喜欢什么季节？为什么？', preparationTime: 5, maxAnswerTime: 30 },
        { question: '你来过中国吗？', preparationTime: 5, maxAnswerTime: 30 },
        { question: '你觉得学汉语难不难？', preparationTime: 5, maxAnswerTime: 30 }
      ]
    },
    pictureDescription: {
      imageUrl: 'https://images.unsplash.com/photo-1508804185872-d7badad00f7d?w=800',
      prompt: '请看这张图片，描述图片中的内容。',
      preparationTime: 30,
      maxRecordTime: 60
    }
  },

  // ============ 中级 ============
  {
    level: 'intermediate',
    variant: 1,
    readAloud: {
      passage: '随着科技的发展，人们的生活方式发生了很大的变化。以前，我们买东西需要去商店，现在只需要在手机上点几下，东西就会送到家门口。不过，也有人觉得网上购物虽然方便，但是少了逛商店的乐趣。另外，越来越多的年轻人喜欢在网上看电影、听音乐，而不是去电影院或者买唱片。这些变化让我们的生活更加便捷，但同时也带来了一些新的问题，比如很多人花太多时间看手机，减少了和家人朋友的交流。',
      preparationTime: 45,
      maxRecordTime: 180
    },
    qa: {
      questions: [
        { question: '你认为网上购物有哪些优点和缺点？', preparationTime: 10, maxAnswerTime: 45 },
        { question: '你觉得怎样才能减少对手机的依赖？', preparationTime: 10, maxAnswerTime: 45 },
        { question: '如果你可以发明一种新技术，你希望它能解决什么问题？', preparationTime: 10, maxAnswerTime: 45 }
      ]
    },
    pictureDescription: {
      imageUrl: 'https://images.unsplash.com/photo-1556742111-a301076d9d18?w=800',
      prompt: '请仔细观察这张图片，描述图片中的场景，并说说你对这种现象的看法。',
      preparationTime: 45,
      maxRecordTime: 90
    }
  },
  {
    level: 'intermediate',
    variant: 2,
    readAloud: {
      passage: '中国的茶文化有几千年的历史。中国人不仅喜欢喝茶，还把喝茶当成一种生活方式。不同地区的人喜欢喝不同的茶：北方人喜欢花茶，南方人喜欢乌龙茶和普洱茶。喝茶不仅能解渴，还能帮助消化、减轻压力。现在，越来越多的外国人也开始了解中国的茶文化。在北京、上海等大城市，有很多茶馆，人们可以在那里品茶、聊天、放松。茶文化是中国文化中非常重要的一部分。',
      preparationTime: 45,
      maxRecordTime: 180
    },
    qa: {
      questions: [
        { question: '你的国家有什么传统饮食文化？', preparationTime: 10, maxAnswerTime: 45 },
        { question: '你觉得传统文化在现代社会中还重要吗？为什么？', preparationTime: 10, maxAnswerTime: 45 },
        { question: '请介绍一个你认为最有特色的中国文化元素。', preparationTime: 10, maxAnswerTime: 45 }
      ]
    },
    pictureDescription: {
      imageUrl: 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=800',
      prompt: '请描述这张图片中的场景，并表达你的观点。',
      preparationTime: 45,
      maxRecordTime: 90
    }
  },
  {
    level: 'intermediate',
    variant: 3,
    readAloud: {
      passage: '现在，越来越多的中国年轻人选择自己创业，而不是去大公司上班。他们当中有些人开了自己的网店，有些人做了自由职业者，还有些人创办了自己的公司。创业虽然有很多挑战和困难，但是它也给了年轻人实现梦想的机会。政府也鼓励年轻人创业，提供了很多优惠政策和资金支持。不过，创业并不是适合每个人的，在开始之前，需要认真思考自己的能力和市场的情况。',
      preparationTime: 45,
      maxRecordTime: 180
    },
    qa: {
      questions: [
        { question: '你觉得年轻人应该先去大公司工作还是直接创业？', preparationTime: 10, maxAnswerTime: 45 },
        { question: '如果你有机会创业，你想做什么样的公司？', preparationTime: 10, maxAnswerTime: 45 },
        { question: '你认为成功的人需要具备哪些品质？', preparationTime: 10, maxAnswerTime: 45 }
      ]
    },
    pictureDescription: {
      imageUrl: 'https://images.unsplash.com/photo-1521737711867-e3b97375f902?w=800',
      prompt: '请描述图片中的工作场景，并谈谈你对这种工作方式的看法。',
      preparationTime: 45,
      maxRecordTime: 90
    }
  },

  // ============ 高级 ============
  {
    level: 'advanced',
    variant: 1,
    readAloud: {
      passage: '在全球化深入发展的今天，不同文明之间的交流与碰撞已经成为常态。一方面，这种交流促进了各国人民之间的理解与尊重，推动了科技、教育、艺术等领域的合作与发展；另一方面，文化差异也时常引发误解和冲突。如何在保持自身文化特色的同时，以开放包容的态度对待其他文化，是每个现代人需要思考的问题。中国自古以来就有"和而不同"的传统智慧，这种思想在今天依然具有重要的现实意义。只有互相尊重、求同存异，才能实现不同文明的和谐共处。',
      preparationTime: 60,
      maxRecordTime: 180
    },
    qa: {
      questions: [
        { question: '你如何看待全球化对本国文化的影响？请结合自己的经历谈谈。', preparationTime: 15, maxAnswerTime: 60 },
        { question: '在跨文化交流中，你认为最大的障碍是什么？应该如何克服？', preparationTime: 15, maxAnswerTime: 60 },
        { question: '"和而不同"的思想对解决当今世界的矛盾冲突有什么启示？', preparationTime: 15, maxAnswerTime: 60 }
      ]
    },
    pictureDescription: {
      imageUrl: 'https://images.unsplash.com/photo-1480796927426-f609979314bd?w=800',
      prompt: '请仔细观察这张图片，描述图片所反映的社会现象，并深入分析其背后的原因和影响。',
      preparationTime: 60,
      maxRecordTime: 120
    }
  },
  {
    level: 'advanced',
    variant: 2,
    readAloud: {
      passage: '人工智能正在以前所未有的速度改变着人类社会的方方面面。从智能手机里的语音助手到自动驾驶汽车，从医疗诊断到金融分析，人工智能技术的应用已经渗透到各个领域。然而，伴随着技术进步，一系列伦理和社会问题也随之而来：人工智能是否会取代大量人类的工作？机器决策的公正性如何保证？数据隐私如何保护？这些问题没有简单的答案，需要政府、企业和公众共同参与讨论和解决。在拥抱技术进步的同时，我们必须保持清醒的头脑，确保人工智能的发展能够真正造福全人类。',
      preparationTime: 60,
      maxRecordTime: 180
    },
    qa: {
      questions: [
        { question: '你认为人工智能会对就业市场产生怎样的影响？', preparationTime: 15, maxAnswerTime: 60 },
        { question: '在人工智能时代，人类最不可替代的能力是什么？', preparationTime: 15, maxAnswerTime: 60 },
        { question: '请谈谈你对"技术向善"这一理念的理解。', preparationTime: 15, maxAnswerTime: 60 }
      ]
    },
    pictureDescription: {
      imageUrl: 'https://images.unsplash.com/photo-1677442136019-21780ecad995?w=800',
      prompt: '请描述这张图片所展示的场景，并深入讨论这一技术对社会发展的影响。',
      preparationTime: 60,
      maxRecordTime: 120
    }
  },
  {
    level: 'advanced',
    variant: 3,
    readAloud: {
      passage: '近年来，环境保护已经成为国际社会共同关注的重要议题。气候变暖、空气污染、水资源短缺、生物多样性减少……这些问题不仅影响着当代人的生活质量，更关系到子孙后代的生存与发展。中国作为世界上最大的发展中国家，在环境保护方面承担着重要的责任。从大力推广清洁能源到实施严格的排放标准，从建设生态城市到推进"美丽中国"战略，中国在环境保护领域做出了巨大的努力。然而，环境保护不仅仅是政府的责任，更需要每一个普通公民的参与。改变消费习惯、减少浪费、选择绿色出行方式，这些看似微小的个人行为，汇聚起来就能产生巨大的影响。',
      preparationTime: 60,
      maxRecordTime: 180
    },
    qa: {
      questions: [
        { question: '在你的国家，人们是如何应对环境问题的？', preparationTime: 15, maxAnswerTime: 60 },
        { question: '你个人在日常生活中会做哪些环保行动？', preparationTime: 15, maxAnswerTime: 60 },
        { question: '你认为经济发展和环境保护之间的关系应该如何平衡？', preparationTime: 15, maxAnswerTime: 60 }
      ]
    },
    pictureDescription: {
      imageUrl: 'https://images.unsplash.com/photo-1611273426858-450d8e3c9fce?w=800',
      prompt: '请描述这张图片中的自然景观，并讨论环境保护的重要性。',
      preparationTime: 60,
      maxRecordTime: 120
    }
  }
]

/**
 * 随机获取一套测试内容
 */
export function getRandomTest(level: HSKKLevel): HSKKTestContent {
  const tests = HSKK_CONTENT.filter(t => t.level === level)
  return tests[Math.floor(Math.random() * tests.length)]
}

/**
 * 获取指定级别的测试数量
 */
export function getTestCount(level: HSKKLevel): number {
  return HSKK_CONTENT.filter(t => t.level === level).length
}
