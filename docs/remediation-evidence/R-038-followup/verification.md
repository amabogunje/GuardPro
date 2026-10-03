# R-038 / R-040 / R-041 and X7 release follow-up

Date: 2026-10-03. Implementer/reviewer: Codex, self-review only.
Revision: uncommitted working tree based on `3c6762d`, including the preceding R-036/R-037/R-039 changes. Windows, Node 24.14.1, local SQLite and desktop Chrome with mobile viewports. No production deployment or customer-data mutation.

## Confirmed defects and corrections

- **R-038:** `node --test tests/provisioning.test.js` reproduced `property_locations has 9 columns but 8 values were supplied`. The assisted provisioning command now names all eight intended columns and uses the table's default property type. The regression verifies two isolated customers, valid owner/coordinate persistence, cross-customer denial and audit receipts. A sandbox-only attempt first failed with `spawn EPERM`; rerunning with child processes permitted reproduced the actual SQL defect.
- **R-040 (G5/X7):** offline reload could not evaluate the application module graph: `supervisor-setup.js` was not in the service-worker precache. Added it and advanced the cache version to v141. `offline-before.txt` retains the failed offline reload; `offline-after.txt` shows 5/5 browser scenarios passing, including offline evidence capture, interrupted upload/exactly-once retry, patrol countdown, draft restoration and two-tab sign-out. This is desktop browser emulation, not physical Android acceptance.
- **R-041 (O1/R-035):** creating another property retained the old selected site when opening supervision setup. The API now returns the newly created site ID and audits that site; the editor forwards the response, and the app selects that assigned site after refreshing state. The mobile regression requires the new site's supervision choice and verifies that its property card is selected before any manual selection. Free-tier limits and owner authorization are unchanged.

## Release-harness corrections

Retained existing behavior assertions; no additional skips or production rate-limit bypasses. Corrected explicit guard sign-in fields, completed-shift lookup through the owner fixture (guards intentionally cannot see ended shifts), account-menu interaction, visible Material controls, required WhatsApp input, current owner setup/navigation, and the expandable emergency FAQ. Signup cases restart their local server to isolate IP rate budgets; the duplicate case creates its own fixture, and an additional test explicitly proves the five-attempt signup limit.

The first follow-up release run (`npm run test:release`) recorded 91/102 passing and 11 failures while fixes were underway; see `initial-release.txt`. Earlier 60/91 and 31-failure evidence remains in R-036. Intermediate focused logs are retained rather than presented as final passes. One owner screenshot check encountered an asynchronous rerender; it now waits for the expected three action icons before asserting the count.

Focused commands:

```
node --test tests/provisioning.test.js
node --test --test-reporter=tap --test-concurrency=1 tests/owner-ui.test.js tests/signup.test.js
node --test --test-reporter=tap --test-name-pattern='Android viewport|Material layouts|mobile patrol countdown|refresh restores|sign-out invalidates' tests/workflows.test.js
npm run test:release
```

Final full-suite result: `npm run test:release` exited 0, **103 passed / 0 failed / 0 cancelled**, duration 377,779 ms; see `final-release.txt`. The existing release command excludes disabled-feature scenarios by name; no exclusions were added. This is current local acceptance evidence, not independent review or deployment. Syntax checks for server.js, public/app.js, public/property-location.js and public/sw.js passed. Owner desktop screenshot was visually inspected; the fixed narrow dashboard, property hero, action controls and KPI cards were legible without overflow.

## Production check and remaining boundaries

Read-only Vercel inspection identifies production deployment `dpl_GsVyvNt7zwZCB4Neq2Zs5vVY2w7u`, commit `3c6762d5aeda233e3ddbc0121a006fbfd926c255`, READY. Its `/api/health` returned HTTP 200 with `{"status":"ok"}` on 2026-10-03. Recent sampled runtime logs show successful GET requests, not an authenticated property-save retry. The get_project connector exposed incompatible parameter schemas; deployment listing and runtime logs worked.

R-035's earlier named-column application fix is already deployed; actual production owner create/edit confirmation remains outstanding. These local fixes and R-036/R-037/R-039 are not released. Remaining release requirements include independent security/data-integrity review, PostgreSQL migration 025 rehearsal/application and grants, hosted Geoapify activation, the originally failing home address, actual email delivery/recovery, physical-phone acceptance, and X3/X4/X5/X8/X9 operational sign-off. Public health checks and local SQLite tests do not close those requirements.
