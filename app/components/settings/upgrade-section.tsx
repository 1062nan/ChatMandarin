'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Loader2, Check, Crown, Zap } from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils/cn'

interface UpgradeSectionProps {
  currentPlan: string
  paymentsAvailable: boolean
  cancelAtPeriodEnd?: boolean
  currentPeriodEnd?: string | null
}

const plans = [
  {
    id: 'free',
    name: 'Free',
    price: '$0',
    period: 'forever',
    features: [
      '5 min AI conversation / day',
      '1 scenario',
      'Basic feedback',
      '1 HSKK mock test / day'
    ],
    cta: 'Current plan',
    disabled: true,
    icon: null
  },
  {
    id: 'plus',
    name: 'Plus',
    price: '$14.99',
    period: '/month',
    features: [
      'Unlimited AI conversation',
      'All scenarios',
      'Real-time 4-dimension feedback',
      'HSKK mock tests (3/month)',
      'Mistake journal with SRS',
      'Unlimited shadowing and dubbing practice'
    ],
    cta: 'Upgrade to Plus',
    highlight: true,
    icon: Zap
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '$29',
    period: '/month',
    features: [
      'Everything in Plus',
      'Unlimited HSKK mock tests',
      'Custom voice selection'
    ],
    cta: 'Upgrade to Pro',
    highlight: false,
    icon: Crown
  }
]

export function UpgradeSection({
  currentPlan,
  paymentsAvailable,
  cancelAtPeriodEnd = false,
  currentPeriodEnd = null,
}: UpgradeSectionProps) {
  const searchParams = useSearchParams()
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null)
  const [canceling, setCanceling] = useState(false)

  const upgraded = searchParams.get('upgraded') === 'true'
  useEffect(() => {
    if (upgraded) toast.success('Payment received. Your subscription will activate shortly.')
  }, [upgraded])

  async function handleUpgrade(plan: string) {
    if (!paymentsAvailable) {
      toast.info('Subscriptions are temporarily unavailable while payment setup is being completed.')
      return
    }

    setLoadingPlan(plan)
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan })
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to create checkout')
      }

      const { url } = await res.json()
      // Redirect to the Creem-hosted checkout.
      window.location.href = url
    } catch (error) {
      toast.error((error as Error).message || 'Failed to start checkout')
      setLoadingPlan(null)
    }
  }

  async function handleCancel() {
    if (!confirm('Cancel subscription? You\'ll keep access until end of billing period.')) return
    setCanceling(true)
    try {
      const res = await fetch('/api/subscription/cancel', { method: 'POST' })
      if (!res.ok) throw new Error('Failed to cancel')
      toast.success('Subscription canceled. Access continues until end of billing period.')
      window.location.reload()
    } catch (error) {
      toast.error((error as Error).message)
    } finally {
      setCanceling(false)
    }
  }

  return (
    <Card id="subscription" className="scroll-mt-6">
      <CardHeader>
        <CardTitle>Subscription</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="mb-4 text-sm text-muted-foreground">
          Current plan: <span className="font-semibold capitalize">{currentPlan}</span>
        </p>

        {!paymentsAvailable && (
          <p className="mb-4 rounded-md border border-gold/30 bg-gold/10 px-3 py-2 text-sm text-foreground" role="status">
            Paid subscriptions are temporarily unavailable while payment provider verification is being completed.
          </p>
        )}

        <div className="grid gap-4 sm:grid-cols-3">
          {plans.map((plan) => {
            const isCurrent = currentPlan === plan.id
            const Icon = plan.icon

            return (
              <div
                key={plan.id}
                className={cn(
                  'rounded-lg border p-4',
                  plan.highlight && 'border-vermilion shadow-sm',
                  isCurrent && 'bg-muted/50'
                )}
              >
                {plan.highlight && (
                  <div className="mb-2 inline-block rounded-full bg-vermilion px-2 py-0.5 text-xs font-medium text-white">
                    POPULAR
                  </div>
                )}

                <div className="mb-1 flex items-center gap-2">
                  {Icon && <Icon className="h-4 w-4 text-vermilion" />}
                  <h4 className="font-bold">{plan.name}</h4>
                </div>

                <div className="mb-3">
                  <span className="text-2xl font-bold">{plan.price}</span>
                  <span className="text-sm text-muted-foreground">{plan.period}</span>
                </div>

                <ul className="mb-4 space-y-1">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-1.5 text-xs">
                      <Check className="mt-0.5 h-3 w-3 shrink-0 text-jade" />
                      {feature}
                    </li>
                  ))}
                </ul>

                {isCurrent ? (
                  <div className="rounded-md bg-muted py-2 text-center text-sm font-medium text-muted-foreground">
                    Current plan
                  </div>
                ) : (
                  <Button
                    variant={plan.highlight ? 'primary' : 'outline'}
                    size="sm"
                    className="w-full"
                    disabled={loadingPlan !== null}
                    onClick={() => handleUpgrade(plan.id)}
                  >
                    {loadingPlan === plan.id && <Loader2 className="h-3 w-3 animate-spin" />}
                    {paymentsAvailable ? plan.cta : 'Temporarily unavailable'}
                  </Button>
                )}
              </div>
            )
          })}
        </div>

        {currentPlan !== 'free' && cancelAtPeriodEnd && (
          <div className="mt-4 border-t pt-4 text-sm text-muted-foreground">
            Cancellation scheduled
            {currentPeriodEnd
              ? ` for ${new Date(currentPeriodEnd).toLocaleDateString()}`
              : ' for the end of the current billing period'}.
          </div>
        )}

        {currentPlan !== 'free' && !cancelAtPeriodEnd && (
          <div className="mt-4 border-t pt-4">
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
              disabled={canceling}
              onClick={handleCancel}
            >
              {canceling && <Loader2 className="h-3 w-3 animate-spin" />}
              Cancel subscription
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
