# Standalone audio protection

Prelaunch provisional safeguards, not measured provider-cost pricing:
- Free standalone `/api/tts`: 10,000 requested UTF-16 code units per UTC day, 20 requests per fixed UTC minute. Reserves atomically before upstream synthesis, including uncertain/failed upstream attempts. No audio/text persisted in usage table.
- Separate from conversation, speaking, shadowing and dubbing quotas. No new daily cap for effective Plus/Pro, including unexpired canceled access. Paid cost exposure is therefore not solved by this change.
- Free guided restaurant example uses four short lines (under 100 characters total), cached within its mounted lesson session. Normal first playback fits comfortably under both limits. Multiple simultaneous tabs share one server-owned budget.
- Limits appear in affected audio UI on429, with reset/retry guidance and text fallback. They do not establish verified language or listening proficiency.
- Public endpoint rejects over500 characters and over8KB bodies, rather than silently returning truncated audio. Signed gateway accepts up to1000 characters/16KB. Internal conversation synthesis retains its existing1000-character truncation before signing; existing feature quotas remain unchanged.
- Gateway still requires HMAC body signature and timestamp. No user/browser signing secret is exposed. This patch does not solve the existing trusted signed-request replay window or multi-account abuse.

## Release
Apply additive migration before app deployment; verify service-only table/RPC permissions. Deploy the Worker change separately for its stricter byte/length validation. Verify app and Worker versions independently. Do not advertise Worker protection as deployed until checked. On rollback preserve the additive usage table. Never fail open on quota storage failure.

## Validation
`npm test`, `npm run type-check`, `npm run voice:type-check`, `node scripts/test-tts-quota.mjs`, `npm run build`. Database test is local in-memory PostgreSQL and does not change hosted user data.
