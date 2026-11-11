import { createHmac, randomUUID, timingSafeEqual } from 'crypto'

export type PlanType = 'plus' | 'pro'

const CREEM_API_KEY = process.env.CREEM_API_KEY
const CREEM_PLUS_PRODUCT_ID = process.env.CREEM_PLUS_PRODUCT_ID
const CREEM_PRO_PRODUCT_ID = process.env.CREEM_PRO_PRODUCT_ID

export function isCreemPaymentsAvailable(): boolean {
  return Boolean(
    process.env.CREEM_CHECKOUT_ENABLED === 'true'
    && CREEM_API_KEY
    && process.env.CREEM_WEBHOOK_SECRET
    && CREEM_PLUS_PRODUCT_ID
    && CREEM_PRO_PRODUCT_ID
  )
}

export function getCreemApiBaseUrl(): string {
  const configuredBaseUrl = process.env.CREEM_API_BASE_URL?.trim().replace(/\/$/, '')
  if (configuredBaseUrl) return configuredBaseUrl

  const testMode = process.env.CREEM_TEST_MODE
    ?.trim()
    .replace(/^['"]|['"]$/g, '')
    .toLowerCase()

  return testMode === 'true' || testMode === '1'
    ? 'https://test-api.creem.io/v1'
    : 'https://api.creem.io/v1'
}

function productIdForPlan(plan: PlanType): string {
  const productId = plan === 'plus' ? CREEM_PLUS_PRODUCT_ID : CREEM_PRO_PRODUCT_ID
  if (!productId) throw new Error(`Creem ${plan} product is not configured`)
  return productId
}

export async function createCheckoutUrl(options: {
  plan: PlanType
  userEmail: string
  userId: string
  successUrl: string
}): Promise<string> {
  if (!CREEM_API_KEY) throw new Error('Creem API key is not configured')

  const apiBaseUrl = getCreemApiBaseUrl()
  const response = await fetch(`${apiBaseUrl}/checkouts`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': CREEM_API_KEY,
    },
    body: JSON.stringify({
      product_id: productIdForPlan(options.plan),
      request_id: `${options.userId}:${options.plan}:${randomUUID()}`,
      success_url: options.successUrl,
      customer: { email: options.userEmail },
      metadata: {
        user_id: options.userId,
        plan: options.plan,
      },
    }),
  })

  const payload = await response.json().catch(() => null) as
    | { checkout_url?: string; message?: string }
    | null

  if (!response.ok || !payload?.checkout_url) {
    const apiHost = new URL(apiBaseUrl).host
    throw new Error(
      `Creem checkout failed (${response.status}; host=${apiHost}; keyLength=${CREEM_API_KEY.length})`
    )
  }

  return payload.checkout_url
}

export function verifyCreemWebhookSignature(payload: string, signature: string): boolean {
  const secret = process.env.CREEM_WEBHOOK_SECRET
  if (!secret) throw new Error('Creem webhook secret is not configured')
  if (!signature) return false

  const expected = createHmac('sha256', secret).update(payload).digest('hex')
  const expectedBuffer = Buffer.from(expected, 'utf8')
  const signatureBuffer = Buffer.from(signature, 'utf8')

  return expectedBuffer.length === signatureBuffer.length
    && timingSafeEqual(expectedBuffer, signatureBuffer)
}

type UnknownRecord = Record<string, unknown>

function asRecord(value: unknown): UnknownRecord {
  return value && typeof value === 'object' ? value as UnknownRecord : {}
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null
}

function asTimestamp(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? value
    : null
}

export interface ParsedCreemEvent {
  eventId: string
  eventType: string
  eventCreatedAt: number | null
  productId: string | null
  mode: string | null
  userId: string | null
  customerEmail: string | null
  plan: PlanType | null
  subscriptionId: string | null
  status: string | null
  currentPeriodEnd: string | null
}

export function parseCreemEvent(event: unknown): ParsedCreemEvent {
  const root = asRecord(event)
  const object = asRecord(root.object)
  const nestedSubscription = asRecord(object.subscription)
  const subscription = object.object === 'subscription' ? object : nestedSubscription
  const transaction = asRecord(object.transaction)
  const metadata = {
    ...asRecord(object.metadata),
    ...asRecord(subscription.metadata),
    ...asRecord(asRecord(object.checkout).metadata),
  }
  const productValue = subscription.product ?? object.product
  const product = asRecord(productValue)
  const productId = asString(product.id) || asString(productValue)
  const customerValue = subscription.customer ?? object.customer
  const customer = asRecord(customerValue)

  const metadataPlan = asString(metadata.plan)
  let plan: PlanType | null = null
  if (productId && productId === process.env.CREEM_PLUS_PRODUCT_ID) plan = 'plus'
  if (productId && productId === process.env.CREEM_PRO_PRODUCT_ID) plan = 'pro'
  if (metadataPlan && metadataPlan !== plan) plan = null

  return {
    eventId: asString(root.id) || '',
    eventType: asString(root.eventType) || '',
    eventCreatedAt: asTimestamp(root.created_at),
    productId,
    mode: asString(subscription.mode) || asString(object.mode),
    userId: asString(metadata.user_id)
      || asString(metadata.userId)
      || asString(metadata.referenceId),
    customerEmail: asString(customer.email),
    plan,
    subscriptionId: asString(subscription.id)
      || asString(object.subscription)
      || asString(transaction.subscription),
    status: asString(subscription.status),
    currentPeriodEnd: asString(subscription.current_period_end_date),
  }
}
