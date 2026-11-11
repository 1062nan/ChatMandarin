# Verified practice and learning progression

## Changes

- Server-assessed shadowing and full dubbing performances save their transcript-only results and learning progress in one transaction.
- Conversations use protected session settings and saved turns. Ending a conversation updates its summary, completion count, streak and learning progress atomically.
- Replaying a saved conversation turn returns the original result before ASR/quota consumption. Concurrent writes at the same turn index persist once. Replaying identical audio cannot award duplicate progress and returns the original assessment.
- First active units initialize lazily for the learner's selected HSK level and lower levels. Later units unlock from the preceding unit in the same HSK level, using the destination's threshold.
- Legacy client-editable scores cannot generate new achievements. When a unit receives its first verified assessment, its previous progress is retained in a private snapshot and its new best score/attempts derive from verified credits.
- Null/unavailable assessments never become fabricated points. Empty conversations do not increase completed-practice counts. Legacy open conversations can be ended but do not award progression.
- Account deletion continues to cascade through private owned records. Existing practice records are not bulk-deleted or rewritten.

## Deployment order

1. Stage the authenticated read-only `/api/health/practice` endpoint. Existing learning behavior remains unchanged.
2. Verify production schema and run both new migrations plus `supabase/tests/verified_learning_progress.sql` inside one explicit transaction that ends with `ROLLBACK`. Set `test.profile_id` to the explicitly authorized test account first; never select an arbitrary user.
3. Apply only `20261111013749_verified_learning_progress.sql` and `20261111013756_atomic_verified_conversations.sql`, in order. The existing production database has historical schema without migration history; do not replay migrations 001–010 or run an unreviewed `db push`.
4. Verify private-table RLS, denied client writes/execute, service-role function grants and both migration entries. New RPCs are `SECURITY INVOKER` with an empty search path.
5. While signed in, open `/api/health/practice`. Require `{"ready":true}` before deploying the practice consumers. The endpoint exposes no key, record or diagnostic details.
6. Publish the practice application changes and verify the exact deployment commit, dashboard/unit rendering, conversation start/end, empty-session accounting and retries.

## Verification

- `npm test`: 85 tests across 17 files passed before rollout.
- `npm run test:db`: in-memory PostgreSQL loads all 13 migrations and executes the integration test as `service_role`. Covers threshold boundaries, legacy forged scores/settings, replay, empty/unscored sessions, count idempotency and transaction rollback.
- `npm run type-check`, ESLint and production Next.js build passed. ESLint retains 28 existing warnings and no errors.
- The database integration uses local fixtures and no hosted credentials. Hosted tests are rollback-only against the authorized test account.

## Limits and remaining work

- Transcript matching is not acoustic pronunciation, tone or fluency assessment. These changes do not make those claims.
- Microphone input and real ASR quality have not been validated in the cloud browser because microphone permission is blocked.
- Audio requests and racing conversation requests may still consume quota or provider work before the database detects duplicates. Failed-ASR quota refunds remain separate work.
- Configured minimum content counts are not enforced because current content cannot satisfy several units' counts. Existing score thresholds (completion 65, mastery 80, destination unlock threshold) are preserved.
- Plan allowances and payment terms are unchanged. The Free/Plus HSKK allowance discrepancy still needs a product decision.
- Cloudflare landing publication remains separate from the Vercel application release.

## Profile privacy follow-on

A metadata audit found a public SELECT policy on all profile columns, including email. `20261111015710_restrict_profile_reads.sql` replaces it with authenticated owner-only reads and removes anonymous SELECT access. Existing own-profile updates and server-side payment lookup remain authorized. No profile rows are deleted or rewritten. `supabase/tests/profile_read_isolation.sql` checks owner-only visibility and denied anonymous access inside rollback. The local database test includes two synthetic users to verify actual isolation.

## Hosted migration record

Verified on 2026-11-11 before application activation:

- Local `20261111013749_verified_learning_progress.sql` was recorded remotely as `20261111061025` (`verified_learning_progress`).
- Local `20261111013756_atomic_verified_conversations.sql` was recorded remotely as `20261111061051` (`atomic_verified_conversations`).
- Local `20261111015710_restrict_profile_reads.sql` was recorded remotely as `20261111061259` (`restrict_profile_reads`).

The hosted migration tool assigned its own timestamps. Reconcile this mapping and the historical baseline before using a future CLI `db push`; do not replay files solely because their local timestamps differ. Hosted rollback integration and post-apply role checks passed. The authorized test profile and progress hashes were unchanged. Private table/RPC grants, owner-only profile reads and denied anonymous profile access were verified separately from application readiness.
