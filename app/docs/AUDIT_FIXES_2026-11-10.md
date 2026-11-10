# Product audit fixes, 2026-11-10

## Batch 1

- Zero-turn/whitespace-only sessions close without practice credit. Summary statistics use persisted learner turns and exclude unavailable scores.
- Unit detail and recommendations use the destination unit's unlock threshold.
- Shadowing links retain the selected sentence, including sentences outside the default list, and reset correctly on navigation.
- Tutor vocabulary hints no longer become learner mistakes. Historical placeholder/tutor-hint rows are excluded from review without deleting records.
- Conversation feedback exposes transcript-based grammar and word choice only. Plain-text model replies remain usable without fabricated scores.
- Shadowing and dubbing report recognized-text matching, not acoustic pronunciation, tone, emotion, rhythm, or spoken fluency.
- HSKK practice validates model grammar/vocabulary/content results, rejects failed/empty ASR, and does not claim an official score or pass prediction.
- Durable conversation turns return warnings rather than inviting duplicate resubmission when a derived summary or journal update fails. Failed primary writes are not reported as success.
- Signup legal labels link to the existing policies. Pricing descriptions match implemented feedback. Landing navigation and placeholder/unsupported assessment claims are corrected in source.

## Verification

- 72 tests across 14 files pass, including actual route handlers with mocked ASR/LLM/database boundaries, malformed output, failure paths, and selected-content routing.
- Final aggregate TypeScript, ESLint (zero errors, 28 existing warnings), production Next build, and diff whitespace checks passed.
- Local compilation uses explicit fake Supabase values, never production credentials. It does not prove live database or speech integration.
- No schema migrations, payment actions, account entitlement changes, or historical data deletions are included in this batch.

## Follow-up limitations

- Live microphone capture is unavailable in the test browser. Audio-provider quality and real speech scoring remain unverified.
- CLI deployment/admin sessions are not configured in this workspace. Application publication must be verified against the existing GitHub/Vercel integration; the separate landing deployment may require Cloudflare access.
- Progression helpers are not wired into completed practice. They also fail to unlock preexisting locked rows. A transactional, source-deduplicated progress integration plus new-account initialization and database permission review is still needed.
- Concurrent turn submissions lack database uniqueness/idempotency guarantees. Closing a conversation and updating profile totals are not a single transaction.
- Failed speech/scoring requests can consume reserved quotas. Refund/retry semantics need transactional support.
- The Free HSKK allowance is 1/day; Plus is 3/month. This existing entitlement design is unchanged and needs a product decision. Existing legal plan promises need a separate review rather than silently rewriting commitments.
