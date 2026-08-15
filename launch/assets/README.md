# ChatMandarin 推广素材包

更新日期：2026-08-16

本目录对应 `app/docs/PRODUCTION_PROMOTION_PLAN_ZH.md` 的 4.3 素材清单。所有学习数据均为明确标记的演示数据，不来自真实用户。

## 可直接发布的文件

| 文件 | 规格 | 建议用途 | 来源 |
| --- | --- | --- | --- |
| `01-hsk-learning-path.png` | 1600×900 PNG | HSK 分级场景介绍、X 教学帖 | 产品视觉演示，标注 `Demo session` |
| `02-voice-conversation-demo.png` | 1600×900 PNG | 语音对话功能介绍 | 产品视觉演示，标注 `Demo session` |
| `03-four-dimension-feedback.png` | 1600×900 PNG | 四维反馈介绍 | 产品视觉演示，标注 `Demo session` |
| `04-hskk-practice.png` | 1600×900 PNG | HSKK 风格练习介绍 | 产品视觉演示，标注 `Demo session` |
| `05-pricing-live.png` | 1240×760 PNG | 定价说明、审核材料 | 2026-08-16 从 `https://chatmandarin.cc/` 真实定价区采集 |
| `06-x-product-banner.png` | 1600×900 PNG | X 首发帖、Reddit 获批后的产品图 | 品牌背景加产品视觉演示 |
| `07-conversation-demo-23s.mp4` | 1280×720 H.264 MP4，约 23 秒，无音频 | X/Reddit 短视频 | 由本目录截图生成的字幕化产品演示 |

## 推荐发布顺序

1. X 正式发布：`07-conversation-demo-23s.mp4`
2. X 功能拆解：`03-four-dimension-feedback.png`
3. X HSKK 介绍：`04-hskk-practice.png`
4. Reddit 获得管理员批准后：`06-x-product-banner.png` 或对应功能截图
5. 用户询问价格时：`05-pricing-live.png`

## 合规说明

- 不得去掉截图中的 `Demo session` 标记后将其描述为真实用户记录。
- 不得把演示分数写成真实用户平均分、提升幅度或学习效果证明。
- 定价图发布前应再次确认网站与 Creem 的价格仍一致。
- AI 反馈可能存在错误；对外文案应保留教育练习工具而非官方 HSK/HSKK 服务的说明。
- Reddit 仅在目标社区规则允许且所需管理员批准已经取得时发布。
- 不要把同一正文和素材批量投放多个社区。

## 隐私检查结果

本次导出已检查以下项目，未发现：

- 邮箱、手机号或真实姓名
- 用户 ID、项目 ID 或账单信息
- API key、token、cookie 或后台地址
- 浏览器标签、桌面通知或其他项目内容
- 真实用户对话、录音或评价

## 可复现源文件

- `source/storyboard.html`：功能截图与横版图画布
- `source/brand-background.png`：由内置图像生成工具生成的装饰背景，不含 UI、人物或文字
- `source/video-renderer.html`：短视频画布与字幕时间线
- `source/render-server.mjs`：仅在本机回环地址保存浏览器生成的视频文件

源文件只用于重新导出素材，不属于线上运行代码，也不会向第三方上传任何数据。
