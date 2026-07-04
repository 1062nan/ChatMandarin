# ChatMandarin 全功能代码评审报告

> 评审范围：功能完整性 + 设计质量 + 代码质量
> 评分标准：✅ 通过 / ⚠️ 需优化 / ❌ 缺失

---

## 1. 认证系统（Authentication）

### 功能评审
| 检查项 | 状态 | 说明 |
|--------|------|------|
| 邮箱注册 | ✅ | Zod 密码强度校验 + Supabase Auth |
| 邮箱登录 | ✅ | React Hook Form + 错误提示 |
| Google OAuth | ✅ | Supabase Provider 已开启 |
| GitHub OAuth | ✅ | 同上 |
| Facebook OAuth | ✅ | 同上 |
| X (Twitter) OAuth | ✅ | 同上 |
| Auth 守卫 | ✅ | middleware.ts 保护需登录路由 |
| OAuth 回调处理 | ✅ | /auth/callback/route.ts 正确交换 code |
| 退出登录 | ✅ | Navbar 内 signOut |
| **忘记密码** | ❌ | **链接存在但无实现** |
| **密码重置** | ❌ | **完全缺失** |

### 设计评审
- ✅ 登录/注册页有 Logo + 标语
- ✅ OAuth 按钮带平台图标
- ✅ 加载状态（spinner + disabled）
- ⚠️ 密码无实时强度指示器

### 代码评审
- ✅ React Hook Form + Zod 双重验证
- ✅ 错误统一通过 toast 提示
- ⚠️ 登录表单的 "Forgot password" 按钮 `router.push('/login?mode=forgot')` 但 login 页没有处理 `mode=forgot` 参数
- ⚠️ Supabase Auth 的 PKCE flow 需要在 Supabase Dashboard 确认已开启

### 修复建议
1. **P0**：实现忘记密码流程（发送重置邮件）
2. **P1**：密码强度实时指示器

---

## 2. 仪表盘（Dashboard）

### 功能评审
| 检查项 | 状态 | 说明 |
|--------|------|------|
| 用户问候 | ✅ | 显示名字 + HSK 等级 |
| 连续天数 | ✅ | Streak 计数 |
| 待复习错题数 | ✅ | 实时查询 |
| 场景推荐 | ✅ | 从 DB 读取 5 个场景 |
| 最近对话 | ✅ | 显示最近 5 条 |
| **平均分数** | ⚠️ | 显示 "—" 占位（未计算） |
| **进度图表** | ❌ | 无 |

### 设计评审
- ✅ 卡片布局清晰
- ✅ 场景推荐可点击
- ⚠️ 缺少视觉进度条/图表
- ⚠️ 分数卡片显示 "—" 不友好

### 代码评审
- ✅ 服务端数据获取
- ⚠️ layout.tsx 和 dashboard/page.tsx 都在 fetch profile（重复查询）
- ⚠️ 多个串行 DB 查询（可优化为 Promise.all）

### 修复建议
1. **P1**：计算真实平均分（从 conversations 表聚合）
2. **P2**：加 Recharts 进度图表

---

## 3. AI 对话（Conversation）

### 功能评审
| 检查项 | 状态 | 说明 |
|--------|------|------|
| 录音 | ✅ | 按住说话 + 空格键 |
| 实时音量波形 | ✅ | RMS 计算 + 20 条柱 |
| WAV 编码 | ✅ | 16kHz PCM → WAV |
| 语音识别 | ✅ | 火山引擎一句话识别 |
| AI 对话 | ✅ | DeepSeek JSON mode |
| AI 语音合成 | ✅ | 火山引擎豆包 TTS |
| 4 维度评分 | ✅ | 发音/语法/用词/流畅 |
| 错误纠正 | ✅ | 类型标签 + 纠正 + 解释 |
| 对话历史 | ✅ | 最近 5 轮 context |
| 免费额度限制 | ✅ | 5 min/day 检查 |
| 错题自动保存 | ✅ | 对话结束时提取 errors |
| AI 语音播放 | ✅ | base64 → audio 自动播放 |
| 重播音频 | ✅ | 可点击 Replay |
| **对话结束统计** | ⚠️ | **未调用 /api/conversation/end** |
| **AI 开场白** | ⚠️ | **硬编码而非 AI 生成** |
| **ASR 失败重试** | ❌ | |
| **对话完成检测** | ⚠️ | flag 存在但未做后续处理 |

### 设计评审
- ✅ 聊天气泡 UI
- ✅ 反馈卡片带颜色编码
- ✅ 录音按钮交互良好
- ✅ 完美分数特殊提示
- ⚠️ 无消息加载骨架屏
- ⚠️ 处理中状态不够突出

### 代码评审
- ✅ AudioRecorder 类封装完善
- ✅ API 路由完整（鉴权→限额→ASR→LLM→TTS→DB）
- ⚠️ ScriptProcessorNode 已被 W3C 标记为 deprecated（但仍广泛使用，兼容性 100%）。生产环境长期应迁移到 AudioWorkletNode
- ⚠️ 开场白函数 `getOpeningMessage()` 是硬编码的，不同场景的开场白有限
- ⚠️ 用户退出对话（点 End 按钮）时未调用 end API
- ⚠️ usage_stats 的 upsert 逻辑有冗余（先 upsert 再查再 update）

### 修复建议
1. **P0**：对话退出时调用 /api/conversation/end
2. **P1**：开场白改为 AI 生成（调一次 DeepSeek 不带用户输入）
3. **P2**：迁移到 AudioWorkletNode（性能更好，但 ScriptProcessorNode 可用）

---

## 4. HSKK 模考（Mock Test）

### 功能评审
| 检查项 | 状态 | 说明 |
|--------|------|------|
| 级别选择 | ✅ | 初/中/高 3 级 |
| 9 套内容 | ✅ | 每级 3 套 |
| Section 1 朗读 | ✅ | 文本展示 + 倒计时 + 录音 |
| Section 2 问答 | ✅ | 3 题 + 逐题录音 |
| Section 3 看图 | ✅ | 图片 + 倒计时 + 录音 |
| AI 评分 | ✅ | 5 维度 + 总分 |
| 预测通过 | ✅ | predicted_pass |
| 主要问题 | ✅ | 维度 + 问题 + 示例 + 改进 |
| 优点 | ✅ | strengths 列表 |
| 转录展示 | ✅ | 3 段转录文本 |
| **Q&A 音频播放** | ❌ | **应播放题目 TTS 但未实现** |
| **历史模考记录** | ❌ | **无法查看过去的模考** |

### 设计评审
- ✅ 级别选择卡片清晰
- ✅ 步骤流程合理
- ✅ 结果页详细（总分 + 5 维度 + 问题 + 优点 + 转录）
- ⚠️ 无跨 section 进度指示器
- ⚠️ 提交时无预估时间倒计时

### 代码评审
- ✅ Phase 状态机清晰
- ✅ 内容与逻辑分离
- ⚠️ 多个 Q&A 录音合并为单个 Blob（简单拼接 WAV 可能产生无效文件）
- ⚠️ Unsplash 图片 URL 可能被限流或下线
- ⚠️ DeepSeek 评分 prompt 包含全部 3 段转录 → token 用量较大

### 修复建议
1. **P1**：Q&A 题目用 TTS 播放（在 Section 2 开始时播放每题语音）
2. **P1**：本地存储 Q&A 录音为数组（而非合并为一个 blob），API 分别处理
3. **P2**：加历史模考记录页

---

## 5. 错题本 + SRS（Mistake Journal）

### 功能评审
| 检查项 | 状态 | 说明 |
|--------|------|------|
| 自动提取错题 | ✅ | 对话中 errors → mistakes 表 |
| 待复习列表 | ✅ | 按 next_review_at 排序 |
| 已掌握列表 | ✅ | mastered=true |
| 复习模式 | ✅ | 翻卡 + 4 档评分 |
| SM-2 算法 | ✅ | 正确实现 ease_factor/interval/mastered |
| 复习完成统计 | ✅ | 记忆率百分比 |
| **手动添加错题** | ❌ | |
| **搜索/筛选** | ❌ | |
| **音频回放** | ❌ | 复习时不播放原始音频 |

### 设计评审
- ✅ 翻卡交互自然
- ✅ 进度条
- ✅ 4 档评分按钮清晰
- ✅ 颜色编码合理

### 代码评审
- ✅ SM-2 实现正确
- ✅ review API 有权限验证
- ⚠️ mistakes 页从 Server Component 改为 Client Component（丢失 SSR 优势，但获得了交互性）
- ⚠️ 无防抖（快速连续评分可能产生竞争条件）

### 修复建议
1. **P2**：加搜索/筛选（按类型/HSK 等级）
2. **P3**：手动添加错题

---

## 6. 设置 + 支付（Settings + Payment）

### 功能评审
| 检查项 | 状态 | 说明 |
|--------|------|------|
| HSK 等级切换 | ✅ | 1-6 按钮选择 |
| 纠错模式切换 | ✅ | 3 种模式卡片 |
| 语速调节 | ✅ | 滑块 0.5-2.0x |
| 保存设置 | ✅ | 更新 profiles 表 |
| 订阅展示 | ✅ | 显示当前 plan |
| 升级界面 | ✅ | 3 档定价对比 |
| Checkout 跳转 | ✅ | 创建 LS Checkout URL |
| Webhook 处理 | ✅ | 订阅创建/更新/取消 |
| **取消订阅** | ❌ | **无界面操作** |
| **账单历史** | ❌ | |
| **支付成功验证** | ⚠️ | URL 参数 `?upgraded=true` 仅前端展示，未验证真实性 |

### 设计评审
- ✅ 设置页面干净
- ✅ 升级卡片对比清晰
- ✅ "POPULAR" 标签突出

### 代码评审
- ✅ Lemon Squeezy 签名验证正确（HMAC-SHA256 + timingSafeEqual）
- ✅ Webhook 处理多种事件
- ⚠️ createCheckoutUrl 中 `custom_data` 存 user_id（安全，但 Lemon Squeezy 可能篡改）
- ⚠️ Webhook 只通过 Lemon Squeezy ID 查找订阅（首次创建时 upsert 可能 user_id 不匹配）

### 修复建议
1. **P0**：加取消订阅功能（调 Lemon Squeezy API cancel subscription）
2. **P1**：支付成功后验证（从 Lemon Squeezy API 查询订阅状态）

---

## 7. 错误处理 + SEO

### 功能评审
| 检查项 | 状态 | 说明 |
|--------|------|------|
| 全局 Error Boundary | ✅ | app/error.tsx |
| Loading 状态 | ✅ | app/loading.tsx |
| 404 页面 | ✅ | app/not-found.tsx |
| Privacy Policy | ✅ | GDPR/CCPA 合规 |
| Terms of Service | ✅ | 完整条款 |
| robots.txt | ✅ | 屏蔽私有路由 |
| **sitemap.xml** | ❌ | |
| **OG image** | ⚠️ | 在 Landing Page 有但 App 没复用 |

### 修复建议
1. **P1**：生成 sitemap.xml
2. **P2**：复制 OG image 到 app/public/

---

## 8. 整体架构评审

### 优点
- ✅ **清晰的关注点分离**：AI 层 / 数据层 / UI 层 / 支付层
- ✅ **类型安全**：TypeScript strict + Database 类型定义
- ✅ **RLS 保护**：数据库行级安全
- ✅ **MoR 支付**：Lemon Squeezy 处理全球税务
- ✅ **品牌一致性**：墨黑+朱砂红+米白色系贯穿全局

### 需要改进
- ⚠️ **音频技术**：ScriptProcessorNode 已 deprecated（但可用）
- ⚠️ **测试覆盖**：无单元测试 / E2E 测试
- ⚠️ **日志系统**：仅 console.error，无结构化日志
- ⚠️ **性能监控**：无 Sentry / PostHog
- ⚠️ **限流**：仅有每日额度限制，无实时 QPS 限流

---

## 9. 修复优先级排序

### P0（上线前必须修复）
1. ❌ 忘记密码流程实现
2. ⚠️ 对话退出时调用 /api/conversation/end
3. ❌ 取消订阅功能
4. ✅ sitemap.xml

### P1（上线后 1 周内修复）
5. ⚠️ Dashboard 真实平均分计算
6. ⚠️ 对话开场白改为 AI 生成
7. ⚠️ Q&A 题目 TTS 播放
8. ⚠️ 支付成功验证

### P2（上线后 1 月内修复）
9. Dashboard 进度图表
10. 历史模考记录
11. 错题搜索/筛选
12. 账单历史
13. AudioWorkletNode 迁移

### P3（长期优化）
14. 单元测试
15. E2E 测试
16. Sentry 集成
17. 结构化日志
18. Dark mode

---

## 总结

**整体评分：7.5/10**

**优势**：
- 功能覆盖完整（对话 + HSKK + 错题 + 支付）
- 代码结构清晰（分层合理）
- 类型安全（TypeScript strict）
- 数据安全（RLS + HMAC 验证）
- 品牌一致（东方美学）

**待改进**：
- 几个关键功能缺口（忘记密码、取消订阅）
- 对话退出统计未更新
- Dashboard 数据不完整
- 无测试覆盖
- 音频技术栈待升级
