# R-036 / R-037 local verification — 2026-10-03

Revision: uncommitted working tree based on `3c6762d`. Environment: Windows, Node 24.14.1, isolated disposable SQLite databases, installed Chrome in headless mode. Reviewer: implementer self-review only. No independent reviewer, PostgreSQL execution, physical device or deployment evidence.

## Final affected checks

| Exact command | Result | Evidence |
|---|---|---|
| `node --test tests/password-change.test.js tests/property-types.test.js` | 9 passed / 0 failed | focused-tests.txt |
| `node --test tests/settings.test.js` | 7 passed / 0 failed | settings-tests.txt |
| `node --test tests/supervisor.test.js` | 13 passed / 0 failed | supervisor-tests.txt |
| `node --test --test-name-pattern='owner password-reset\|legacy old-password\|sign-in recovery' tests/signup.test.js` | 3 passed / 0 failed | owner-recovery-tests.txt |
| `git diff --check` | Passed | Terminal check |

API checks cover restricted temporary sign-in, same/short-password rejection, revoked sessions, guard-only supervisor authority, shared-account/cross-customer denial, actor/target audit records without secrets, and owner reset. Migration checks verify idempotent legacy backfill without re-flagging a completed password. Browser checks cover mobile private-password completion, saved-work recovery with the old password, explicit fresh start when it is unavailable, ciphertext retention, owner legacy-vault recovery, settings and supervisor workflows. Other is persisted through the real API and rendered at 390px; screenshots were visually inspected.

The new password test failed before implementation: expected passwordChangeRequired=true, received undefined. The first sandboxed attempt could not spawn Node (EPERM); execution with process permission reproduced the actual failure. A startup-regex error in the initial test harness was corrected. Intermediate new-test failures were fixture ordering, audit-row scoping and use of an SVG document without document.body; each was corrected and rerun.

## Broad-suite failures are retained

`npm run test:release` was run during implementation: **91 tests, 60 passed, 31 failed**, 818.0 seconds. The complete output is `initial-release-suite.txt`. This is an intermediate result, not a final-candidate release certificate. The full suite has not been rerun after the focused corrections below. No tests were removed and no additional skip patterns were added.

Failures caused by the accepted credential/role change were corrected in the affected fixtures: new users now complete private-password setup; supervisors no longer edit peer supervisors; pagination has enough guards after supervisor rows are excluded; recovery copy matches the fixed roles. The complete settings and supervisor suites now pass. The legacy owner-vault browser test was waiting for Sign out inside a closed account menu; it now waits for the visible account-menu control and still checks the retained-work notification.

Comparison against an untouched `git archive HEAD` snapshot at `data/password-baseline`:

`node --test --test-concurrency=1 --test-name-pattern='owner password-reset|legacy old-password|owner property form|settings tabs|assisted provisioning' tests/signup.test.js tests/gps.test.js tests/settings.test.js tests/provisioning.test.js`

Result: **2 passed, 3 failed**, captured in `unchanged-baseline-tests.txt`. The baseline reproduces the property-form stale-selector timeout, positional provisioning insert error (R-038), and closed-menu owner recovery selector timeout. Its owner reset API and settings-browser tests pass.

Other broad-suite failures remain unresolved under X7/R-001/R-033: owner/setup selectors, landing expectations, workflow fixture/state failures and signup rate-limit interactions. Do not assume every remaining failure is pre-existing; only the selected baseline comparisons above were reproduced. Standalone selection of the Any-guard test also exposed dependence on preceding shift setup; the complete settings suite passes. The full release command still uses its original configured exclusions for disabled features.

## Rollout and remaining verification

- Apply migration 025 with the migration runner and verify PostgreSQL runtime grants **before** deploying this code. Existing guard/supervisor accounts will require a private password at their next online login. Demo seed accounts explicitly model completed private credentials; real manager-created accounts always require replacement.
- The API restriction applies to existing sessions too. Remote revocation cannot instantly affect an offline device; rejected synchronization must be handled through sign-in/recovery.
- The old encrypted record remains on the device. Without its old password, its pending work is inaccessible; the UI requires explicit acknowledgement before starting fresh. Server password completion and browser storage cannot form one atomic transaction; if browser storage fails, the UI reports that the password changed and retains the old record for recovery.
- Rehearse repeated resets, lost passwords, interrupted local writes, shared phones and connectivity changes on actual devices. PostgreSQL migration and independent security review remain outstanding.
- No hosted migration, deployment, email send, map fix, biometric implementation, subscription change or delegated override feature was performed.

Next action: independently review R-036/R-037, resolve the release ledger under X7/R-001/R-033 and schedule the separate R-035/R-038 property investigation. Keep these changes Ready for verification / Not released.
