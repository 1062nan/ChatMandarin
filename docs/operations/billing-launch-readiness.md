# Billing launch readiness (2026-11-12)

Checkout remains OFF. This is a staged commercial launch checklist, not a decision
to avoid charging. Existing subscriber access, cancellation and signed webhooks
remain independent of this flag. No real purchase was made in this work.

## Implemented next blocker: checkout duplication

A private service-role-only reservation serializes checkout creation per profile.
The first authenticated request reserves a stable request ID before provider I/O.
Only that request can create a session. Concurrent requests return 409; once saved,
requests for the same product/plan/environment reuse the URL. Different plans or
modes do not create a second session. An existing provider subscription blocks
creation again, including during the reservation transaction.

`request_id` in the Creem documentation is a correlation field. We DO NOT assume
that repeating a POST with the same ID is provider-idempotent.

If the provider response is lost, database saving fails, or the session expires,
the reservation is not automatically cleared. Creating another checkout could
produce duplicate recurring subscriptions. An operator must first reconcile the
provider session using the stored provider checkout ID when available, or the
stable attempt/request ID when the response was lost. The provider checkout ID
is persisted privately alongside the ready URL for GET checkout reconciliation. This manual reconciliation boundary
must be tested and replaced by a verified retrieval/expiry workflow before public
checkout is enabled. No browser-accessible release/delete RPC exists.

## Needed to run sandbox (not supplied in this workspace)

Use a separate provider test-mode product and webhook configuration. Put secrets
in the hosting provider's secret settings, never in chat, Git, screenshots or logs.
Required: test API key, matching test Plus/Pro product IDs, test webhook signing
secret, `CREEM_TEST_MODE=true`, correct HTTPS callback origin and hosted test DB.
Keep production `CREEM_CHECKOUT_ENABLED` unset/false. Enable checkout only on a
protected staging deployment with sandbox products. Do not combine test and live
subscription state in the same learner profile.

The current local workspace has `.env.example` only and no CREEM_* environment
variables. This is not evidence that production lacks configuration. No provider
secrets or complete account identifiers were inspected or printed.

## Sandbox acceptance sequence

1. Verify actual product prices/currency/billing interval against the displayed
   offer, without changing current advertised prices.
2. New test subscriber: create checkout once; double click, second tab and plan
   switch must not create additional sessions. Refresh must reuse the ready URL.
3. Provider success plus lost return/DB error: reconcile stored attempt; don't
   create a second subscription. Test expiry and cancellation of uncompleted
   checkouts; verify provider retrieval semantics before automatic release.
4. Signed initial, renewal, unpaid, paused, canceled and expired events; duplicates,
   out-of-order events and old-subscription events cannot corrupt entitlement.
5. Scheduled cancellation: user retains access through verified period end, then
   loses it without requiring another webhook. Support repeated cancellation and
   a provider-success/local-failure recovery.
6. Refund and dispute: reconcile current provider state and transaction scope.
   Partial refunds and old invoices must not blindly revoke a new subscription.
7. Browser success query parameters alone must never show payment received.
8. Verify owner isolation, service-only database APIs and no logged payment data.

Do not enable paid checkout until these pass against real provider sandbox,
not merely mocked API tests.

## Commercial decisions still required

- Current Free speaking practice 1/day versus Plus 3/month is non-monotonic. Do
  not remove existing free entitlements to hide this defect. Choose a paid cap
  at least as useful and validate its worst-case cost before changing promises.
- Record ASR minutes, TTS output, AI tokens and vendor costs for low/median/heavy
  usage; include failures, retry policy, support and payment processing fees.
- Keep prices unchanged pending a contribution-margin model. A proposed cap or
  target margin is not a verified operating result.
- Verify accurate plan copy and cancellation/refund policy before promotion.

## Checks in this patch

- Route tests: disabled gate, authenticated owner, ready reuse, pending/conflict,
  uncertain provider response, persistence failure, invalid input/callback.
- Provider tests: stable request identity and trusted HTTPS checkout destinations.
- Local PostgreSQL: RLS/private grants, one active reservation, stale pending,
  cross-profile/attempt mismatch, mode/plan mismatch and existing subscription.

Migration is additive and does not alter live subscription rows or current prices.
