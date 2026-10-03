# Public free-tier beta — 3 October 2026

Application revision: `0c6f022c52386089f703eb9ef948ff89692b70fd`, pushed to master. Live URL: https://getguardpatrol.com. Vercel production deployment `dpl_Gu4irJh8SRbNYNaQksan9ErF6t9L` READY; `vercel inspect` confirms the public alias. Paid GATE-1 remains NOT READY. User authorized this beta and explicitly chose ordinary public free signup, no invitation or global enrollment cap. Existing limits: one property and five guards/supervisors combined per customer. Payments deferred.

## Verification

- `npm run test:release`: 103 passed, zero failed/skipped, 340.32 seconds; [final log](final-tests.txt). Existing command excludes tests for deliberately disabled messaging. No new exclusions.
- `node --test tests/postgres-passwords.integration.mjs` against isolated Neon clone with runtime role: 1 passed. Covers signup, scoped state, mandatory private password, owner reset and session revocation.
- Migration 025 rehearsed then applied transactionally to `guardpro_pilot`; repeat application is idempotent, one existing non-owner flagged, runtime SELECT/INSERT/UPDATE/DELETE privileges verified. Existing private choices are not re-flagged.
- Corrected staged production `dpl_5QLLv4SUhT1FcUwY95qBGyXtdGFx` uses the same application revision. Authenticated synthetic tests: ordinary signup; Other property create/edit persistence; second-property denial; sixth team-member denial; live Geoapify lookup for Ikeja City Mall; guard first-password requirement; owner reset and old-session invalidation; private Blob upload/authorized read/anonymous denial. No real participant email sent.
- Headless installed Chrome, 390×844 viewport: hosted owner signs in, sees the synthetic property, no horizontal overflow. [Screenshot](hosted-owner-mobile.png).
- Post-release public HTTP checks: `/api/health`, `/api/public/onboarding`, `/app`, `/sw.js` all 200. Signup and configured recovery available; no invitation requirement; offline dependency present in service worker.
- Synthetic customer, six users and profile Blob removed using exact IDs and verified synthetic email suffix. Explicitly qualified post-cleanup production counts: 3 customers, 4 users, 0 incident media, matching baseline.

## Failures retained and resolved

- Initial 105-test intermediate run included proposed invitation tests; proposal removed after user clarification. [Intermediate log](intermediate-tests.txt) is not the final release result.
- [102/103 run](intermediate-owner-race.txt): owner browser test raced asynchronous self-supervision save and menu rerender. Test now waits for Stop supervising before opening the menu; focused four tests and final full suite pass.
- R-043: first staged build at 9cb8f1b failed signup with Postgres 42P01 because user_password_state was absent from the schema qualification whitelist. Transaction rolled back. Corrected and proven against real Postgres and hosted production before public deployment.
- Smoke harness initially used email from the privacy-filtered state response; corrected to known synthetic fixture email and resumed same account. Browser harness initially lacked bundled Chromium and used an incorrect label; switched to installed Chrome and existing app IDs. Public smoke initially requested /service-worker.js (404); actual registered /sw.js passed. These harness errors did not require application changes.

## Recovery and remaining acceptance

Previous application: `dpl_GsVyvNt7zwZCB4Neq2Zs5vVY2w7u` at 3c6762d. Pre-release Neon branch `br-super-field-auvsghjf` (pilot-before-20261003), parent LSN `0/45E5CD8`, expires **10 October 2026 at 12:00 UTC**. Rehearsal branch `br-aged-haze-au58l05g` deleted after tests. Database branch is not a complete media-backup/restore proof. Do not restore over new pilot records without reconciliation. Migration is additive; old code ignores its table, but reverting code also reverts private-password enforcement.

Geoapify production secret configured; secrets omitted from source, evidence and deployment upload. Deployment exclusions include local data/envs and unrelated integration worktree. Configuration checks are not proof of actual email delivery.

Pending pilot work: real phones/GPS/camera/microphone/offline/recovery; original home address coverage; actual recovery email receipt; biometric/password-manager behavior. Pending broader commercial gates: independent security/data-integrity review, complete database/media recovery, retention/offboarding operations, capacity measurements and support commitments. See [pilot guide](../../CONTROLLED-PILOT.md). No claim that these gates are verified.
