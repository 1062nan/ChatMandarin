# Restaurant guided lesson pilot

## Scope and learning design
- `/learn/restaurant`, discoverable on the authenticated dashboard.
- Model dialogue with translation, pinyin and optional synthetic audio.
- Meaning checks → measure-word choices → guided requests → changed quantity/item transfer.
- Eight initial tasks and four delayed recall tasks. Limited exact-pattern matcher accepts several natural alternatives, labels unmatched wording as unrecognized rather than bad Chinese, and separates supported practice from first-try unaided matches.
- No claim of listening assessment, pronunciation scoring, official exam coverage or permanent mastery.
- New independent recall schedule: 24h after initial/support practice; unaided recall streak extends to 3/7/14/30 days. Lapse resets streak, not lifetime count. Repeating initial lesson never postpones recall.

## Data impact
One additive `lesson_progress` table and owner-read RLS policy. No existing records changed, no XP, exam marks, unit unlocks or subscription entitlements altered. Authenticated server resolves profile ownership and enforces due time plus compare-and-swap. Browser clients have no write permission. Typed learner requests are sent for deterministic server checking but are not stored; only task IDs and matched/unaided flags remain in progress.

## Validation
- 224 tests pass after integrating d9ecc3e, including 24 new pure/API cases.
- TypeScript and targeted ESLint pass.
- Next production build passes with dummy public Supabase build configuration; no hosted credentials needed for build.
- `node app/scripts/test-restaurant-lesson.mjs` loads all migrations including billing in isolated PGlite PostgreSQL, tests owner-only reads, anonymous read denial, browser INSERT/UPDATE/DELETE denial, and CAS replay protection. Never touches hosted data.
- Independent engineering review accepted scoped pilot after recall-streak and duplicate-advance fixes.

## Release acceptance still required
Apply tracked additive migration transactionally once, then release exact reviewed code. Verify signed-in mobile/desktop UI, all eight tasks, hint and correction flow, rapid Continue, exit without save, network failure/retry, schedule persistence after reload, not-due review rejection and optional audio failure/stop/navigation. Production UI/audio is not yet verified by this change. Do not simulate early review by changing real learner due dates. Promotion should not describe this pilot as a complete curriculum.
