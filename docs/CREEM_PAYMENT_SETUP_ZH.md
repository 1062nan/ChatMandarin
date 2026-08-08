# ChatMandarin Creem 支付开通手册

更新日期：2026-07-19

## 1. 当前边界

ChatMandarin 已将代码侧支付供应商从 Lemon Squeezy 切换为 Creem。正式收费前仍需完成：

1. Creem 注册与中国大陆 KYC。
2. 创建 Plus/Pro 测试产品。
3. 创建测试 API Key 和 Webhook。
4. 执行 Supabase `009_creem_payment_provider.sql` 迁移。
5. 将 Creem 测试凭据写入 Vercel，部署并测试。
6. Creem 审核通过后创建正式产品和正式凭据，再切换生产。

不要把 API Key 或 Webhook Secret 发到聊天、截图或提交到 Git。

## 2. 注册与身份审核

1. 打开 `https://creem.io` 并创建账户。
2. 国家/地区选择真实的 `China`。
3. 主体按真实情况选择个人或企业。
4. 产品填写为 SaaS 在线中文学习订阅：
   - Website: `https://chatmandarin.cc`
   - App: `https://app.chatmandarin.cc`
   - Description: `AI-powered Mandarin learning SaaS with conversation practice, pronunciation feedback, HSK learning paths and HSKK mock tests.`
5. 个人主体的收款人姓名必须与 KYC 身份一致；企业主体的银行账户名称必须与企业主体一致。
6. 中国个人可按后台可用选项配置支付宝；企业配置真实企业银行账户。

## 3. 测试产品

在 Test mode 创建并发布两个 recurring 产品：

| 产品 | 价格 | 周期 | Tax category |
| --- | --- | --- | --- |
| ChatMandarin Plus | USD 14.99 | every month | SaaS |
| ChatMandarin Pro | USD 29.00 | every month | SaaS |

不启用免费试用。分别使用 `Copy ID` 记录两个 `prod_...` 产品 ID。

## 4. 测试凭据与 Webhook

在 Developers 中创建测试 API Key，并建立 Webhook：

```text
https://app.chatmandarin.cc/api/creem/webhook
```

订阅以下事件：

```text
subscription.active
subscription.paid
subscription.trialing
subscription.update
subscription.scheduled_cancel
subscription.canceled
subscription.past_due
subscription.paused
subscription.expired
refund.created
dispute.created
```

保存 `CREEM_WEBHOOK_SECRET`。Webhook 以 `creem-signature` HMAC-SHA256 签名，应用会校验原始请求体。

## 5. Supabase 迁移

在 Supabase SQL Editor 中打开并完整执行：

```text
supabase/migrations/009_creem_payment_provider.sql
```

迁移会：

- 将 `lemon_squeezy_id` 改名为 `provider_subscription_id`；
- 新增 `payment_provider`；
- 合并同一用户的重复订阅记录；
- 强制每个用户最多一条订阅；
- 保留支付供应商订阅 ID 的唯一性。

执行前建议在 SQL Editor 导出 `subscriptions` 表。执行后验证：

```sql
select user_id, count(*)
from public.subscriptions
group by user_id
having count(*) > 1;
```

结果必须为 0 行。

## 6. Vercel 测试环境变量

在 Vercel 项目 `chat-mandarin` 的 Production 和 Preview 中写入同一组测试值：

```text
CREEM_API_KEY=<test key>
CREEM_WEBHOOK_SECRET=<test webhook secret>
CREEM_PLUS_PRODUCT_ID=prod_...
CREEM_PRO_PRODUCT_ID=prod_...
CREEM_TEST_MODE=true
```

然后重新部署。测试期间 checkout 请求会发往 `https://test-api.creem.io/v1`。

## 7. 2–5 分钟测试

1. 登录 `https://app.chatmandarin.cc`。
2. Settings 中购买 Plus。
3. 完成 Creem 测试结账。
4. 返回 Settings 后等待 Webhook，刷新页面确认 Plus 已生效。
5. 检查 Creem Webhook 日志为 200。
6. 测试取消订阅，确认页面显示取消日期且本周期内权限仍保留。
7. 对 Pro 重复一次。

跳转成功只代表支付页面完成；套餐权限以签名 Webhook 写入 Supabase 为准。

## 8. 正式上线

Creem 审核通过后，在正式环境重新创建产品、API Key 和 Webhook。正式 `prod_...` ID 与测试 ID 不可混用。

仅在全部正式值已经准备好时，一次性替换 Vercel Production：

```text
CREEM_API_KEY=<live key>
CREEM_WEBHOOK_SECRET=<live webhook secret>
CREEM_PLUS_PRODUCT_ID=<live Plus product ID>
CREEM_PRO_PRODUCT_ID=<live Pro product ID>
CREEM_TEST_MODE=false
```

重新部署后，先验证 checkout 页面上的产品名、金额、币种和周期，再开放升级入口。

## 9. 回滚

若正式支付异常：

1. 不删除 Creem 产品或订单。
2. 在 Vercel 回滚到上一部署。
3. 暂时隐藏升级入口或保持支付接口返回配置错误。
4. 修复后重放 Creem Webhook；`webhook_events.event_id` 会阻止重复处理。

官方参考：

- `https://docs.creem.io/merchant-of-record/supported-countries`
- `https://docs.creem.io/merchant-of-record/finance/payouts`
- `https://docs.creem.io/features/checkout/checkout-api`
- `https://docs.creem.io/code/webhooks`
