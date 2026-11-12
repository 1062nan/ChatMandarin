# Meeting-time lesson release notes

Base: b67924b. This additive lesson does not grant XP, unlock units or claim HSK/HSKK proficiency.

## Changes
- `/learn/meeting-time`: eight tasks and four later recall tasks, asking when to meet and proposing today/tomorrow at 3/4 pm.
- Shared grading, learner UI and authenticated API implementation. Restaurant route, task content, exports and saved records remain compatible.
- Dashboard reads only each owner's lesson IDs and dates; due recall sorts before new content. Both schedules remain visible and refresh with the existing server-clock strategy.
- No raw typed answers saved. Compact outcomes, latest attempt receipt, server due checks and compare-and-swap remain per owner AND lesson.

## Release order
1. Review source and tests; authorize external source publication separately where required.
2. Apply `20261112082717_meeting_time_lesson.sql` before deploying the application. It only extends the existing CHECK allowlist; it does not update progress or privileges.
3. Deploy the reviewed application commit. Verify `/learn/restaurant`, `/learn/meeting-time` and dashboard against a signed-in QA account.
4. Test new lesson save, reload, interrupted save/retry and duplicate click behavior. Confirm restaurant progress/due dates are unchanged, early review cannot advance a date, and the daily card points to the correct lesson.
5. Validate due review when actually due; do not change production dates to simulate it. Optional TTS failure must leave text-only work usable.

Keep the additive DB constraint on application rollback; removing the new allowed ID would fail once learners have meeting-time records. Never delete their progress to roll back a feature.

## Evidence and remaining limits
- Local unit/API tests, server-rendered component checks, type-check and Next production build passed. Build uses placeholder public Supabase configuration, not live accounts.
- Full PGlite migration sequence verifies owner-only reads, denied browser writes, anonymous denial, CAS, lesson isolation, allowed IDs, and byte-equivalent preexisting restaurant record/receipt across the additive migration.
- Independent engineering and pedagogy reviews requested; wording revised to avoid unnatural 3 am examples.
- Browser interaction/mobile/audio and deployed authenticated end-to-end QA remain release checks. Eight to ten minutes is an estimate, not an observed learner result.
