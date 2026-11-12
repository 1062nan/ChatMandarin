# Plus speaking allowance rollout

Feature gate defaults OFF, independently of payment checkout. No price changes.

When enabled, Plus inherits Free's one speaking-practice session per UTC day,
then can use ten flexible bonus sessions per UTC calendar month. Daily allowance
is consumed first. No carryover. Pro remains unlimited. In a 31-day month the
maximum is 41 sessions, provided the learner practices on each day. This is an
allowance, not a claim of HSKK exam equivalence or a guarantee of results.

Existing `hskk_count` daily/monthly totals remain intact. The new bonus counter
starts at zero, so historical practice is not retroactively charged against the
new benefit. Same-submission retry remains governed by the existing durable
submission reservation; it must not consume either allowance again.

## Gate and rollout

The private singleton `plus_speaking_allowance_config` is default false.
Authenticated clients can read only the boolean getter, not mutate the flag.
App copy and quota previews use that same getter and fail closed to the existing
plan on unavailable configuration. Actual reservation remains atomic in SQL.

Apply additive migration before app. Verify flag false, browser writes denied,
and the old 3/month behavior while disabled. Test enabled state only in isolated
fixtures first. Do not enable production until reviewed cost assumptions and
benefit copy are accepted. Checkout remains independently disabled until real
provider sandbox acceptance passes.

Do not turn the flag OFF after advertising/enabling the new benefit for paying
users without a grandfathering plan: switching back would reduce allowances.
Roll back app code while preserving database entitlement, rather than silently
revoking a purchased benefit. Existing total usage must never be reset.

## Commercial validation before charging

Prices remain $14.99/month Plus and $29/month Pro. These are existing displayed
prices, not freshly verified provider prices. For Plus, budget the full 41-session
31-day speaking allowance, plus all other included usage. Record ASR minutes,
LLM input/output tokens, audio generation, retries and failed jobs, payment fees,
and expected support cost. Contribution = net subscription receipts minus these
variable costs. A measured per-speaking-session cost multiplied by 41 is only
one part of the budget: currently unlimited conversation/audio/shadowing/dubbing
and Pro usage remain unbounded cost exposures. Do not claim profitable operation
or open checkout based solely on this allowance fix.
