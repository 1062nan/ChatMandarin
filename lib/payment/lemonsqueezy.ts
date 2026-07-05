/**
 * Lemon Squeezy 支付客户端
 * MoR（Merchant of Record）模式：自动处理全球税务
 */

const LS_API_KEY = process.env.LEMONSQUEEZY_API_KEY
const LS_STORE_ID = process.env.LEMONSQUEEZY_STORE_ID
const LS_PLUS_VARIANT_ID = process.env.LEMONSQUEEZY_PLUS_VARIANT_ID
const LS_PRO_VARIANT_ID = process.env.LEMONSQUEEZY_PRO_VARIANT_ID
const LS_BASE_URL = 'https://api.lemonsqueezy.com/v1'

export type PlanType = 'plus' | 'pro'

interface CreateCheckoutOpts {
  plan: PlanType
  userEmail: string
  userId: string
  redirectUrl: string
}

/**
 * 创建 Lemon Squeezy Checkout URL
 */
export async function createCheckoutUrl(opts: CreateCheckoutOpts): Promise<string> {
  if (!LS_API_KEY || !LS_STORE_ID) {
    throw new Error('Lemon Squeezy credentials not configured')
  }

  const variantId = opts.plan === 'plus' ? LS_PLUS_VARIANT_ID : LS_PRO_VARIANT_ID
  if (!variantId) throw new Error('LEMONSQUEEZY variant ID not configured')

  const response = await fetch(`${LS_BASE_URL}/checkouts`, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${LS_API_KEY}`
    },
    body: JSON.stringify({
      data: {
        type: 'checkouts',
        attributes: {
          // 关联产品 variant
          product_options: {
            variant_quantities: [
              {
                variant_id: parseInt(variantId),
                quantity: 1
              }
            ]
          },
          // 预填用户邮箱
          checkout_options: {
            email: opts.userEmail,
            name: opts.userEmail.split('@')[0],
            discount: true,
            dark: false
          },
          // 自定义数据（用于 webhook 回调识别用户）
          custom: {
            user_id: opts.userId,
            plan: opts.plan
          },
          // 支付完成后跳转
          redirect_url: opts.redirectUrl,
          preview: false,
          test_mode: process.env.NODE_ENV === 'development'
        },
        relationships: {
          store: {
            data: { type: 'stores', id: LS_STORE_ID }
          }
        }
      }
    })
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(`Lemon Squeezy checkout failed: ${JSON.stringify(error)}`)
  }

  const data = await response.json()
  return data.data.attributes.url
}

/**
 * 验证 Lemon Squeezy Webhook 签名
 */
export function verifyWebhookSignature(payload: string, signature: string): boolean {
  const crypto = require('crypto')
  const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET

  if (!secret) {
    throw new Error('LEMONSQUEEZY_WEBHOOK_SECRET is not configured')
  }

  const hmac = crypto.createHmac('sha256', secret)
  hmac.update(payload)
  const digest = hmac.digest('hex')

  const digestBuf = Buffer.from(digest)
  const sigBuf = Buffer.from(signature)

  if (digestBuf.length !== sigBuf.length) return false

  return crypto.timingSafeEqual(digestBuf, sigBuf)
}

/**
 * 从 Webhook 事件中提取订阅信息
 */
export function parseWebhookEvent(event: any) {
  const eventName = event.meta?.event_name
  const data = event.data
  const attributes = data?.attributes || {}

  const customData = attributes.custom_data || {}
  const userId = customData.user_id
  const plan = customData.plan

  // 从 variant 关系中获取产品信息
  const variantId = data?.relationships?.variant?.data?.id
  const subscriptionId = data?.id
  const customerId = attributes.customer_id?.toString()

  // 状态
  const status = attributes.status
  const renewsAt = attributes.renews_at
  const endsAt = attributes.ends_at
  const cancelledAt = attributes.cancelled_at

  // 判断 plan
  let detectedPlan: PlanType | null = null
  if (variantId === LS_PLUS_VARIANT_ID || plan === 'plus') {
    detectedPlan = 'plus'
  } else if (variantId === LS_PRO_VARIANT_ID || plan === 'pro') {
    detectedPlan = 'pro'
  }

  return {
    eventName,
    userId,
    plan: detectedPlan,
    subscriptionId,
    customerId,
    status,
    renewsAt: renewsAt ? new Date(renewsAt) : null,
    endsAt: endsAt ? new Date(endsAt) : null,
    cancelledAt: cancelledAt ? new Date(cancelledAt) : null
  }
}
