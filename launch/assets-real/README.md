# ChatMandarin 真实生产页面素材包

采集日期：2026-08-16

本目录是 `launch/assets/` 演示版素材的真实生产页面版本。所有产品画面均来自 `app.chatmandarin.cc` 或 `chatmandarin.cc` 的实际运行页面，没有生成式 UI、虚构产品页面或真实用户数据。

## 可直接使用的文件

| 文件 | 规格 | 真实来源 |
| --- | --- | --- |
| `01-dashboard-real.png` | 1600×900 PNG | 临时生产测试账号的真实 Dashboard |
| `02-hsk-path-real.png` | 1600×900 PNG | Dashboard 实际切换至 HSK 考试模式 |
| `03-conversation-start-real.png` | 1536×825 PNG | 生产环境实际创建的 Restaurant Ordering 对话 |
| `04-feedback-real.png` | 1536×825 PNG | 生产 ASR、评分及 AI 回复的实际结果 |
| `05-hskk-real.png` | 1280×720 PNG | 生产 HSKK Mock Test 页面 |
| `06-pricing-real.png` | 1240×760 PNG | `chatmandarin.cc` 线上真实定价区 |
| `07-banner-real-ui.png` | 1600×900 PNG | 使用真实反馈截图排版的横版图，无生成式背景或 UI |
| `08-real-site-walkthrough-23s.mp4` | 1280×720 H.264 MP4，23.17 秒，无音频 | 由本目录真实生产截图生成的字幕化 walkthrough |

## 真实语音测试记录

测试使用临时生产账号 `ChatMandarin Demo`，没有使用真实客户账号或历史数据。

1. 生产环境创建 Restaurant Ordering 对话。
2. 通过生产 `/api/tts` 生成测试句：`一个人，谢谢。我想吃面条。`
3. 将该合成普通话仅在当前浏览器会话中作为虚拟麦克风输入，没有读取物理麦克风。
4. 生产 ASR 实际识别为：`一个人，谢谢。我想吃面条。`
5. 生产评分实际返回总分 `93/100`：Pronunciation 90、Grammar 95、Word Choice 95、Fluency 90。
6. 生产 AI 实际回复：`好的，一个人。你要吃什么面条？我们有牛肉面和鸡蛋面。`

这些分数仅代表一次合成测试句的实际系统结果，不得宣传为用户平均分、学习效果、准确率或性能保证。

## 合规要求

- 可以表述为“真实生产页面截图”或“使用临时测试账号完成的真实产品流程”。
- 不得表述为真实用户案例、testimonial 或学习效果证明。
- 对外发布反馈图时保留“AI feedback may contain errors”的说明。
- 发布定价图前重新核对网站与 Creem 的当前价格。
- Reddit 仅在目标社区允许且需要的管理员批准已经取得时发布。

## 可复现源文件

- `source/banner-real.html`：使用真实反馈截图排版横版图
- `source/video-renderer-real.html`：将真实生产截图生成字幕化短视频
- `source/render-server-real.mjs`：仅在本机回环地址保存生成的视频

源文件不接触真实用户数据，也不会把文件上传到第三方。
