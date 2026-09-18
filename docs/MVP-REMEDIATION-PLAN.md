# Guard Patrol — MVP remediation plan and progress register

**Created / last updated:** 17 September 2026
**Audit baseline:** `6f80c7c`  
**Source:** [Independent readiness report](audit-2026-09-16/MVP-READINESS-REPORT.md), [engineering notes](audit-engineering-notes.md), [product notes](audit-product-notes.md), [17 September reassessment](PRODUCTION-READINESS-REASSESSMENT-2026-09-17.md)
**Current release decision:** NOT READY for paying customer operations.  
**Current work:** R-006 and its X8 public-support/copy follow-ups are Ready for verification: landing scope copy, support tap action, image disclosure and signup-identifier clarity are implemented locally.
**Next issue:** Independently verify the public landing, notice and signup flow, then proceed with the next open operational release gate.
**Progress:** S0 is verified locally and remains Not released. S1–S7, G1–G5, G7, O1–O8, X1, X2, X6 and X7/R-001 remain ready for independent verification. G6 is blocked on real-device evidence across all roles.

This is the authoritative shared plan. Keep stable IDs so the owner can discuss, prioritize and verify work independently. The audit remains an unchanged historical record; update this plan as implementation progresses. Creating this plan does not authorize purchases or deployments, and does not assert that the proposed commercial scope has been accepted.

## 1. Scope and decisions

Working target: a supported, self-service paid pilot of recorded guard supervision. Preserve the existing mobile guard/supervisor/owner design. Prioritize authorization, evidence integrity, recovery and customer onboarding before cosmetic changes. Do not add a repair-management workflow.

The audit proposes one property per initial customer, named guard rosters, external urgent communication, and manual invoicing. These are planning defaults to confirm with the product owner before restricting advertised capability. Conditional issues remain OPEN until implemented or explicitly deferred with an accepted service limitation. They do not disappear from the plan.

| Decision | Proposed default | Status / owner | Affected issues |
|---|---|---|---|
| D1 Initial customer scope | Self-service owner signup and guided first-property setup; one property initially | Accepted 2026-09-16; product owner | O1, O7, X8 |
| D2 Instructions | Keep recorded instructions as well as typed instructions for low-literacy use. They may be complementary or either/or for a shift. | Accepted 2026-09-17; product owner | G7, S6 |
| D3 Owner also supervises | An owner may opt in per property as a supervisor while retaining named supervisors | Accepted 2026-09-16; product owner | O6 |
| D4 Urgent help | Remove dummy alarm and hide the in-app urgent telephone-contact route for the pilot. Guard Patrol does not provide emergency response. | Accepted 2026-09-17; product owner | G3, S4, X8, R-003 |
| D5 Owner patrol metric | Score patrol completion and start timeliness together: completed checkpoint rounds contribute 70%; on-time starts contribute 30%. Missing checkpoint evidence leaves the composite unknown. | Accepted and implemented 2026-09-17; product owner | S2, O3 |
| D6 Commercial MVP | Launch the pilot on the free tier: one property and up to five guards/supervisors. No gateway or paid tier in this release. | Accepted 2026-09-16; product owner | O8, X8 |
| D7 Review responsibility and pilot limits | Pilot is five or fewer owners on the free tier, with fewer than 25 non-owner users in total. The product owner is the named support and recovery owner. Review cadence, supported phones, response expectations and measured history/record caps remain to be set. | Partially accepted 2026-09-16; product owner | S4, S7, G6, X3, X5, X6, X9 |
| D8 Pilot data and AI boundary | Retain free-tier customer data for one year. AI transcription is disabled for the pilot. Real recordings, incident photos, resolution photos and optional profile photos still require private production media storage. | Partially accepted 2026-09-16; product owner; export/offboarding procedure remains to be approved | X1, X4, X6, X8 |
| D9 Guard history boundary | Guards receive only their active shift's work and their current-shift reports. They do not receive prior-shift reports, other-guard reports, supervisor workflow notes, revisions or handover history through the guard app. | Accepted from approved guard experience; implemented 2026-09-16 | X2 |

No issue is closed merely because a narrower scope is proposed. Record accepted scope decisions in the change log and specify how unsupported actions/claims are removed or restricted.

## 2. Status and evidence rules

Allowed statuses:

- **Not started:** no remediation work yet; dependencies may still be open.
- **In progress:** named implementer is actively working; record start date and affected files.
- **Blocked:** an actual impediment prevents progress; record reason, required action, responsible person and next review date.
- **Ready for verification:** implementation exists; acceptance evidence/review still outstanding.
- **Verified:** all issue acceptance criteria have passed on an identified code revision, with evidence and review recorded. This does not mean deployed.
- **Deferred — accepted:** explicit product-owner decision, rationale, service limitation, residual risk and revisit trigger recorded. Never count as fixed.
- **Reopened:** an accepted fix regressed, a criterion failed, or new evidence invalidated closure; link the regression.

Release state is tracked separately: **Not released / Staged / Deployed and smoke-tested / Rolled back**. Do not mark a code fix as deployed merely because it is committed or passes locally. A deployed fix without verification remains unverified.

### Required update cycle for each issue

1. Before editing: read this plan; set the issue In progress, name implementer, confirm dependencies and acceptance criteria. Record baseline/reproduction and intended change. Do not let unrelated cleanup expand the scope silently.
2. For a confirmed defect: retain a failing regression case against the old behavior, then make it pass. Extend existing meaningful tests; do not create tests that simply mirror markup or implementation.
3. After implementation: run focused tests and the affected cross-role checks; record the **exact command, outcome, date, revision, environment and evidence path**. Include failed checks, not just passes.
4. Review authorization/data migrations and unintended side effects; use a separate reviewer for security/data integrity where available, otherwise state the review limitation. UI changes require browser review; hardware claims require a real phone.
5. Move to Verified only when the acceptance criteria below and linked audit criteria are met. If real-device or operator evidence remains outstanding, keep Ready for verification or Blocked with an explicit dependency.
6. Update the register, issue record and chronological log in the same change set as the fix. If committing, include the IDs in the commit description and record the resulting revision without creating a self-referential hash requirement: record it in the next documentation update or use a stable commit subject until then.
7. Before release: run the current enabled-feature release suite and the end-to-end matrix. After an authorized deployment, record environment/deployment ID and smoke results. Never silently skip failing tests or change assertions only to accept broken behavior.
8. A regression reopens its source issue and gets a new `R-001`, `R-002`, etc. entry if it introduces a distinct defect. Record severity, affected role, reproduction, parent issue, owner and acceptance criteria. Existing IDs are never renumbered or deleted.

Passing tests reduce risk; they do not guarantee that no new issues exist. Report untested conditions explicitly.

## 3. Delivery sequence

| Phase | Work | Exit condition |
|---|---|---|
| 0 — Establish baseline | X7 baseline inventory; reproduce S0; preserve audit probes as fixtures | Known failures are classified; S0 reproduction is repeatable. Baseline preparation must not delay the security fix. |
| 1 — Authorization and evidence | S0 first; X2; G4; S3 + G1; G2; G5 + S5; X6 external-I/O isolation | Property scopes hold; impossible chronology is handled; uploads/conflicts/recovery are visible and safe. |
| 2 — Trustworthy operations | S1; S2; S4; G3; G7/S6; S7 as scoped | Correct shift/route history, actionable supervisor view, usable guard help and instructions. |
| 3 — Complete owner journey | O1; O2–O6; O7 as scoped; O8 | A fresh customer can be onboarded, view honest evidence and understand service/payment arrangements. |
| 4 — Release hardening | X1; X3–X9; finish X7; G6 | Real-customer isolation, restore/offboarding, support, capacity and device acceptance demonstrated. |
| 5 — Paid-pilot gate | GATE-1 below | All applicable launch issues verified; conditional scope decisions accepted; deployment and field evidence recorded. |

Independent work may overlap. Dependencies in the register must be honored. Planning allowance remains approximately 4–6 calendar weeks with one or two engineers and part-time product/QA support; re-estimate after Phase 1. This is not a delivery commitment.

## 4. Issue register

**Priority:** P0 = security first; P1 = paid-pilot requirement; P2 = conditional/volume-dependent but remains in scope until accepted deferral.  
**Responsibility:** Engineering implements code/runbooks; QA validates; product owner accepts service scope; ISDL operations/commercial provide real-world policies and evidence. Named people are assigned when work starts.  
**All rows currently:** implementer unassigned; evidence none beyond audit; release state Not released.

### Guard

| ID | Priority | Status | Implementation deliverable and acceptance | Dependencies / verification |
|---|---|---|---|---|
| G1 | P1 | Ready for verification | Compact saved/uploading/uploaded/retry status includes event and all promised attachments. No false uploaded confirmation. | Local encrypted queue reports synchronized, waiting, retry and conflict states; browser interrupted-upload recovery remains independently reviewable. |
| G2 | P1 | Ready for verification | Preserve and expose pending work after shift end/sign-out; warn before leaving; reconcile permanent conflicts without blocking unrelated queue items. No cross-account disclosure. | Sign-out warning and encrypted recovery retained; conflicts no longer block unrelated pending records. Shared-phone and conflict exercises remain independent verification. |
| G3 | P1 | Ready for verification | Remove the nonfunctional Emergency action and the in-app urgent telephone-contact route. No claim an alert was sent. | The pilot hides both controls and states that it does not provide emergency response. |
| G4 | P1 | Ready for verification | Server enforces coherent start/patrol/scan/end chronology and handles skew with review/rejection; original capture/receipt preserved. Legitimate offline delay remains valid. | Server now rejects captures before a referenced shift or materially future device times; old captures retain a review marker. Boundary testing remains independent verification. |
| G5 | P1 | Ready for verification | Safe credential reset/vault recovery flow or supported tool/runbook; guard can regain access without silently discarding pending evidence. Explain unrecoverable loss. | Assisted recovery and lost-device procedure documented; encrypted pending work is explicitly unrecoverable after credential/browser loss. Field reset exercise remains required. |
| G7 | P2 | Ready for verification | Recorded instructions accessible from current Settings and cached playback for guards, or accepted typed-only limitation with corrected labels/claims. | Settings → Shifts now exposes per-shift typed and recorded instructions. Focused tests verify private upload, saved shift association and immutable active-shift playback. Independent browser/Android review remains required. |

### Supervisor

| ID | Priority | Status | Implementation deliverable and acceptance | Dependencies / verification |
|---|---|---|---|---|
| S0 | P0 | Verified | Deny property-A supervisor acquiring property-B account authority via assign/reset. Restrict assignment and global user mutations to legitimate authority; preserve authorized owner actions. | Verified locally; not released. API matrix covers same customer/different property, other customer, shared target, password changes, local supervisor management and owner success. |
| S1 | P1 | Ready for verification | Attendance tied to scheduled occurrence; yesterday's unclosed shift cannot satisfy today. Overdue shift is an explicit exception; overnight shift valid. | Local stale, overnight, early/late, duplicate and report reconciliation fixtures pass. Independent review remains; G4/S5 still own chronology enforcement and exception-close workflows. |
| S2 | P1 | Ready for verification | Historical checkpoint/roster/schedule snapshots remain immutable; shared expectation rules documented across KPIs/exports. The owner patrol metric uses the shift's checkpoint snapshot for completion and leaves unavailable evidence unknown. | Version/route snapshot and hybrid patrol-score tests pass; independent review of historical report semantics remains. |
| S3 | P1 | Ready for verification | Persist expected media manifest and evidence completeness; supervisor sees pending/failed recording; empty evidence cannot be accidentally resolved as complete. Retry remains idempotent. | Added evidence manifest migration and server/UI completion checks; interrupted media and recovery testing remains coordinated with G1/G2. |
| S4 | P1 | Ready for verification | Show uncertainty from capture freshness, distinguish missing evidence from confirmed exception; establish real supervisor review/escalation responsibility. | UI now identifies stale receipt as unconfirmed; ISDL still must approve real review ownership/cadence under D4/D7. |
| S5 | P1 | Ready for verification | Immediate disable/session revocation independent of active attendance; audited exception-close with reason/actor; late uploads reconciled. | Disable now revokes sessions even with active attendance; exception close is audited. Lost-device and delayed-queue field exercises remain G5/G4 work. |
| S6 | P2 | Ready for verification | Complete instruction publication as scoped and define category/P1/P2/P3 training with examples. No inferred criminal intent or repair workflow. | Recorded/typed instruction versioning already exists; resolution UI now explains classification and priority choices. Training approval remains required. |
| S7 | P2 | Ready for verification | Review opens the selected incident. Add compact paging/search or accepted, measured pilot volume cap before deferring scale work. | Selected incident detail plus five-item search/paging implemented; pilot volume and latency target remains D7/X9 acceptance. |

### Owner

| ID | Priority | Status | Implementation deliverable and acceptance | Dependencies / verification |
|---|---|---|---|---|
| O1 | P1 | Ready for verification | Supported, audited self-service fresh-customer/owner/first-property signup and guided setup; retain assisted provisioning only as internal support fallback. No ad-hoc SQL/demo credentials. | Focused API/browser checks pass for mobile wizard, tenant isolation, duplicate rejection, location confirmation and audit. Independent Android/customer trial and X1 production/demo separation remain required. |
| O2 | P1 | Ready for verification | Label historical period unambiguously; current outstanding/unreviewed and unconfirmed freshness visible without operational interpretation. | Focused owner API/browser fixtures pass; independent review still required. |
| O3 | P1 | Ready for verification | The owner patrol score combines completed checkpoint rounds (70%) and on-time starts (30%). It labels incomplete/unknown checkpoint evidence rather than presenting a start as completion. | Focused owner API/browser fixtures pass; owner/supervisor/export reconciliation remains independent-review work. |
| O4 | P1 | Ready for verification | Retrospective classification separated from current unresolved/unclassified issues; zero classified security does not imply safe. Clear P1 meaning/denominator. | Focused historical classification and owner browser fixtures pass; independent review still required. |
| O5 | P1 | Ready for verification | Read-only Problems/Activity evidence route without switching to supervisor. Static KPI cards remain static. | Owner-only API, private media, mutation-denial and mobile browser checks pass; role-switch attribution remains covered by existing owner UI test. |
| O6 | P2 | Ready for verification | Owner-as-supervisor is a persistent responsibility choice that completes setup without a fake supervisor account. | Owner-only API, refresh persistence, audit identity and separate-supervisor checks pass locally; independent review remains required. |
| O7 | P2 | Ready for verification | Owners can reuse existing same-customer guards or supervisors across properties and later remove the property assignment without deleting the account. | Owner-only reuse/removal, tenant boundary, active-shift guard and history-preservation checks pass locally; independent review remains required. |
| O8 | P1 | Ready for verification | Free pilot subscription: one property and up to five guards/supervisors, enforced server-side and shown plainly to the owner. Paid tier remains future scope. | Focused signup, owner mobile and management tests pass; X8 commercial/support terms remain a separate release gate. |

### Mobile and device validation

| ID | Priority | Status | Implementation deliverable and acceptance | Dependencies / verification |
|---|---|---|---|---|
| G6 | P1 | Blocked | Signed cross-role Android acceptance record with device/browser/OS, shared-phone behavior, permissions, weak connectivity, interruption, storage pressure, accessible mobile layouts and core guard, supervisor and owner journeys. QR, recording and NFC are tested where the device supports them. | Checklist at `docs/real-android-pilot-checklist.md`; blocked until ISDL, QA and representative guard, supervisor and owner users execute and sign it. Desktop browser tests do not close this issue. |

### Shared engineering and operations

The audit's unnumbered shared gates and additional engineering findings receive stable X IDs here. Overlapping role issues are linked, not counted as separate implementations.

| ID | Priority | Status | Implementation deliverable and acceptance | Dependencies / verification |
|---|---|---|---|---|
| X1 | P1 | Ready for independent verification | Inspect and separate customer production, demo and preview data/media; remove demo credentials/accounts in real-customer build; verify secrets, cookies and runtime grants. | Production now uses clean `guardpro_pilot` schema and private `guardpro-pilot-media`; it contains zero users and the anonymous API returns the expected 401. Preview uses `guardpro_preview` and `guardpro-preview-media`; Development retains demo resources. The database project remains shared, so independent review must confirm that environment-scoped configuration and schema-qualified runtime access meet the accepted pilot isolation boundary. |
| X2 | P1 | Ready for independent verification | The guard state API exposes only the active shift, active-shift work and the guard's active-shift reports. It excludes prior-shift reports/events, other guards' work, internal transitions and revisions. | D9; focused server/API plus browser report-history test passes. Independent shared-phone and media-link review remains required. |
| X3 | P1 | In progress | Rehearse encrypted/restricted database AND media backup/restore with agreed recovery objectives and named operator. | The recovery runbook is prepared and the product owner is named recovery owner. X1; perform isolated restore with row/media integrity, signed links/auth checks, measured recovery time and evidence. Recovery objectives remain to be agreed. |
| X4 | P1 | In progress | Retention, export, offboarding/access removal and backup expiry procedure, with approved roles and customer requirements. | One-year retention and a non-destructive procedure are documented. X1/X3, O1/S5; export/offboarding authority, tested scoped export/delete/revoke rehearsal and backup-expiry evidence remain required. |
| X5 | P1 | In progress | Named support/outage owner, error/upload monitoring, quotas and cost limits, escalation/runbooks. Confirm commercial hosting suitability. | A safe database health endpoint and operating runbook are implemented. The product owner is named support owner. Configure an actual monitor and approve the support route/response target; exercise an injected failure. No purchases without approval. |
| X6 | P1 | Ready for independent verification | Remove external Blob/AI I/O from global write-lock scope using staged idempotent finalization and deadlines. Keep disabled AI out of critical path. | Uploads reserve first, use a bounded external Blob operation outside the global lock, then finalize idempotently. Local delayed/fail-once recovery tests and an isolated Neon/Blob workflow run pass. AI remains disabled. Independent review should repeat the full release suite and a storage-timeout exercise. |
| X7 | P1 | Ready for independent verification | Coherent enabled-feature release suite, independent fixtures, baseline failure ledger and current docs/runbooks. CI/repeatable command preserves regression tests. | `tests/workflows.test.js` now owns an operating-system-selected local port and reads the server's announced port, preventing an orphaned fixed-port server from being mistaken for its fixture. Clean `npm run test:release`: 67 passed, 0 failed in 164.7 seconds. R-001 retains the independent-repeat requirement. |
| X8 | P1 | In progress | Accepted product boundary, collection/access explanation, supervisor responsibility, support/payment terms and necessary qualified local review. | The version-ready [customer notice draft](PILOT-CUSTOMER-NOTICE-DRAFT.md) and operating runbook are prepared. D1–D9, O8; named ISDL approver and qualified local review still required. No compliance certification implied. |
| X9 | P1 | In progress | Bound/measure whole-history `/api/state`, encrypted vault size and UI report volumes; set supported pilot capacity or implement pagination/incremental sync where needed. | The enrollment limit and measurement protocol are documented; guard state is now active-shift scoped. D7, S7; collect representative latency/storage evidence and set record/history caps before a throughput claim. |

## 5. Mandatory cross-role regression matrix

Run focused cases per change and the complete current release suite before release. Capture proof against the **candidate revision**, not a prior version.

| Scenario | Required result | Tracks |
|---|---|---|
| Site-A supervisor attempts source-user assignment/reset from B | Denied; valid owner management still works; no unauthorized audit or data mutation | S0, O7 |
| Guard A/B shared phone; offline report; sign-out; reload; login A | B cannot see A data; A recovers and uploads it once | G1/G2/G5, X2 |
| Audio event accepted; media interrupted; later retry | Clearly incomplete for both roles; no loss/duplicate; correct final playback | S3, G1/G2 |
| 409 conflicting shift start followed by independent pending records | Safe reconciliation, no silent discard or permanently hidden queue blockage | G2, S5 |
| End before start; clock skew; valid late upload | Invalid chronology rejected/quarantined; valid offline evidence preserved | G4 |
| Yesterday open shift; legitimate overnight shift | No false attendance; correct occurrence and explicit exception | S1/S5 |
| Route/roster edits after completed patrol | Historical counts unchanged; new shifts use new configuration | S2/O3 |
| Any roster; named roster; missing historical schedule | Defensible, consistent denominators and explicit unknowns | S2/O3 |
| Old capture uploaded now; urgent open report today | No false current assurance from receipt time or historical risk score | S4/O2/O4 |
| Reset/revoke account while active with pending audio | Immediate server denial; audited recovery path and honest local-data limitations | G5/S5 |
| Fresh customer; owner supervises; existing supervisor on second property if supported | Complete setup without duplicate identities or demo access; scoped evidence | O1/O5/O6/O7 |
| Slow storage plus concurrent login/check-in | Bounded latency, no cross-customer transaction stall or duplicated writes | X6/X9 |
| Production restore and tenant offboarding rehearsal | DB and media usable; removed access denied; unaffected tenant preserved | X1/X3/X4 |
| 360–390px, larger text, permissions denied, actual Android interruptions | Guard, supervisor and owner core journeys remain usable; phone results and limitations recorded | G6, all changed UI |

## 6. Per-issue evidence records

Add one subsection per issue when it starts. The register is the summary; this record is the audit trail. Link artifacts under `docs/remediation-evidence/<ID>/` or another stable repository location. Logs must exclude secrets and customer personal data.

```text
### S0 — [title]
Status / release state:
Implementer / reviewer:
Started / last updated:
Dependencies and scope decision:
Baseline reproduction / observed failure:
Implementation files / migration:
Acceptance criteria checked:
Test command | date | revision | environment | result | evidence path:
Cross-role regression checks:
Review result and unresolved concerns:
Commit or stable commit subject:
Deployment ID/environment and smoke evidence (when applicable):
Rollback/migration compatibility:
Blocker / required actor / next review date (if blocked):
Next action:
```

### S0 — Property-level authorization

Status / release state: Verified / Not released  
Implementer / reviewer: Codex / self-review only; independent security review remains advisable before the paid-pilot release  
Started / last updated: 2026-09-16  
Dependencies and scope decision: Owners retain controlled same-customer, multi-property assignment; supervisors manage only accounts exclusive to their assigned property.  
Baseline reproduction / observed failure: `docs/audit-2026-09-16/reproduce-api-findings.mjs` returns 200 for assigning a second-property supervisor to Oak and then resetting that account's global password.  
Implementation files / migration: `server.js`, `tests/supervisor.test.js`; no migration. `assign` is owner-only and requires the owner to access an existing same-customer source property. A supervisor cannot update a non-self account assigned elsewhere.  
Acceptance criteria checked: property-A supervisor cannot assign a property-B supervisor; after authorized owner sharing, that supervisor cannot reset the shared account; owner can assign/update the shared account; supervisor can update an Oak-only guard; cross-customer assignment remains denied.  
Test command | date | revision | environment | result | evidence path: `node --test tests/supervisor.test.js` | 2026-09-16 | working tree based on `6f80c7c` | isolated SQLite server | 10 passed, 0 failed | `tests/supervisor.test.js`  
Test command | date | revision | environment | result | evidence path: `node --test tests/owner-overview.test.js` | 2026-09-16 | working tree based on `6f80c7c` | isolated SQLite server | 4 passed, 0 failed | `tests/owner-overview.test.js`  
Test command | date | revision | environment | result | evidence path: `node docs/audit-2026-09-16/reproduce-api-findings.mjs` | 2026-09-16 | working tree based on `6f80c7c` | disposable local server on port 3198 | original assignment/reset escalation now returns 403 | `docs/audit-2026-09-16/reproduce-api-findings.mjs`  
Cross-role regression checks: owner behavior passes; full enabled-feature release suite and real-device testing remain future X7/G6 work.  
Review result and unresolved concerns: implementation self-reviewed against the original reproduction and authorization matrix. No independent security reviewer was available in this task. The remediation does not address S5 active-shift revocation or S1/S2 status integrity.  
Commit or stable commit subject: not committed  
Deployment ID/environment and smoke evidence (when applicable): none — not deployed  
Rollback/migration compatibility: server-only authorization restriction; no migration. Revert the code change if an authorized workflow is unexpectedly blocked, then investigate without weakening scope checks.  
Blocker / required actor / next review date: none / review before paid-pilot deployment  
Next action: start S1 — shift-occurrence attendance integrity.

### S1 — Shift-occurrence attendance integrity

Status / release state: Ready for verification / Not released  
Implementer / reviewer: Codex / self-review only; independent product and engineering review remains required  
Started / last updated: 2026-09-16  
Dependencies and scope decision: This change makes dashboard attendance and activity-report shift-start counts use the same scheduled occurrence rule. It does not implement the server-side chronology enforcement in G4 or the auditable exception-close workflow in S5.  
Baseline reproduction / observed failure: An open shift starting on the prior day overlapped a later selected shift and produced `1 of 1` checked in. It could also appear in the selected shift's guard detail despite no check-in for that occurrence.  
Implementation files / migration: `public/supervisor-status.js`, `activity-reports.js`, `tests/supervisor.test.js`, `tests/activity-reports.test.js`; no migration. Starts count for their occurrence only, accept a 15-minute early check-in grace, deduplicate retries, retain valid overnight occurrences, and identify an earlier unclosed eligible shift in the dashboard KPI qualifier.  
Acceptance criteria checked: prior open shift yields `0 of 1` and an explicit earlier-shift exception; it is absent from selected-shift detail; valid early and overnight starts count; after-shift starts do not count; duplicate starts count once; activity reports exclude stale/late starts and use the same occurrence rule.  
Test command | date | revision | environment | result | evidence path: `node --test tests\\supervisor.test.js tests\\activity-reports.test.js tests\\settings.test.js tests\\workflows.test.js` | 2026-09-16 | working tree based on `6f80c7c` | local Node test process with existing isolated server/browser fixtures | completed successfully; 20 named subtests passed | `tests/supervisor.test.js`, `tests/activity-reports.test.js`  
Cross-role regression checks: supervisor mobile canvas, shift settings, reports, authorization and workflow tests passed in the command above. The dashboard remains attention-toned when attendance is missing or an earlier shift is open.  
Review result and unresolved concerns: self-reviewed for time-window boundaries and report/dashboard consistency. No independent review was available. G4 must still prevent or flag invalid server-side chronology, and S5 must give operators a controlled way to close an overdue shift; this change only prevents the stale record from being misrepresented as current attendance.  
Commit or stable commit subject: not committed  
Deployment ID/environment and smoke evidence (when applicable): none — not deployed  
Rollback/migration compatibility: pure calculation and presentation change; no persisted-data migration. Reverting restores the prior flawed overlap behavior, so retain the added fixtures with any rollback investigation.  
Blocker / required actor / next review date: independent engineering/product review of occurrence semantics; then validate alongside G4/S5 implementation before paid-pilot release  
Next action: obtain independent review; do not mark Verified until the review is recorded.

### S2 — Historical configuration snapshots

Status / release state: Ready for verification / Not released  
Implementation and evidence: Existing versioned shift templates, start-event patrol/checkpoint snapshots and retired-checkpoint rules were retained. The focused settings and supervisor suites exercise updated shifts, historical plan selection, route retention and Any/named roster behavior.  
Unresolved acceptance: independent review must confirm the owner/report meaning under D5; no migration was required in this change set.  
Next action: validate a full edit/retire/midnight scenario during the combined S1–S7 review.

### S3 — Incident evidence completeness

Status / release state: Ready for verification / Not released  
Implementation files / migration: `migrations/015.sql`, `migrations/postgres/001.sql`, `migrate.js`, `database.js`, `server.js`, `public/app.js`. A submitted incident now persists its expected audio/photo manifest, state reports received versus expected media, the supervisor sees incomplete evidence, and resolution is denied until promised media exists. Legacy incidents remain explicitly legacy and are not retroactively treated as complete.  
Unresolved acceptance: run interrupted voice-only and partial-photo recovery across shared devices with G1/G2 before marking Verified.  
Next action: independent API and browser review of the media retry flow.

### S4 — Supervisor uncertainty and review

Status / release state: Ready for verification / Not released  
Implementation files: `public/app.js`. A supervisor home screen now says current activity is unconfirmed when no recent record has been received for 30 minutes, instead of treating silence as an all-clear. Existing GPS review records and the S3 evidence state distinguish evidence problems from confirmed activity.  
Unresolved acceptance: ISDL must name a review owner, review cadence and escalation path under D4/D7. The app does not claim push monitoring.  
Next action: attach the approved operating procedure and field-test stale/offline scenarios.

### S5 — Revocation and exception close

Status / release state: Ready for verification / Not released  
Implementation files / migration: `migrations/015.sql`, `migrations/postgres/001.sql`, `server.js`, `database.js`. Disabling a user now revokes sessions immediately even if a shift is open; the action is audited. An owner or supervisor can close an open shift only through an audited exception endpoint with a required reason.  
Unresolved acceptance: conduct lost-device, queued-late-upload and revoked-media tests with G4/G5; disabling intentionally denies any later authenticated upload.  
Next action: independent authorization and recovery review.

### S6 — Instructions and classification guidance

Status / release state: Ready for verification / Not released  
Implementation files: `public/instructions.js`, `server.js`, `public/app.js` (existing recorded/typed instruction publication retained; resolution guidance added). Resolution explains Security, Maintenance and Other, and defines P1/P2/P3 in plain language without making crime or repair determinations.  
Unresolved acceptance: ISDL must approve training examples and the typed-versus-recorded instruction policy under D2.  
Next action: supervisor usability walkthrough without developer coaching.

### S7 — Problem finding at scale

Status / release state: Ready for verification / Not released  
Implementation files: `public/app.js`. Problems now retain selected-detail navigation and add case-insensitive reported-text search with five-item pagination, limiting the mobile list without hiding an item from search.  
Unresolved acceptance: set and measure a supported pilot history/latency cap with X9.  
Next action: large-history browser test and independent UX review.

### G1 — Local capture and synchronization state

Status / release state: Ready for verification / Not released  
Implementation files: `public/app.js`. The on-duty screen now gives a compact, truthful record state: synchronized, waiting to upload, retry needed, or supervisor review needed. The retry control never says an attachment was delivered before the server confirms it.  
Next action: independently repeat offline capture, reload, failed media and exactly-once retry tests.

### G2 — Shared-phone pending work and conflict recovery

Status / release state: Ready for verification / Not released  
Implementation files: `public/app.js`. Sign-out warns when pending evidence remains, keeps it encrypted in the account vault, and reports that it is available only to that sign-in. A 409 event conflict is retained as a supervisor-review item and no longer stops unrelated queued records.  
Unresolved acceptance: two-account shared-phone, permanent-conflict and prior-shift retry exercises remain required.  
Next action: independent browser and operator verification with G5/S5.

### G3 — Emergency boundary and normal help

Status / release state: Ready for verification / Not released  
Implementation files: `public/app.js`, `server.js`, `tests/messaging-disabled.test.js`. Removed the nonfunctional Emergency button and the pilot's Call supervisor telephone route. Site telephone values are neither returned in current application state nor editable from the pilot interface. No delivery, monitoring or emergency response is claimed.
Next action: verify dialler behavior on a real supported Android device.

### G4 — Guard chronology integrity

Status / release state: Ready for verification / Not released  
Implementation files: `server.js`. Server validation now rejects a scan/end capture before its referenced shift start and device times more than 15 minutes in the future. Old capture times retain `clock_review`; delayed offline uploads remain accepted and retain original capture and receipt times.  
Unresolved acceptance: complete the documented timezone/midnight and skew test matrix, including legitimate delayed upload.  
Next action: independent API review alongside S1/S5.

### G5 — Assisted credential recovery

Status / release state: Ready for verification / Not released  
Implementation files: `docs/guard-access-recovery.md`; related session revocation is implemented in S5. The procedure explicitly distinguishes safe assisted reset from irrecoverable encrypted pending work after credential/browser loss.  
Next action: conduct password reset, expired-session, pending-audio and lost-phone exercises.

### G6 — Cross-role mobile and Android acceptance

Status / release state: Blocked / Not released  
Scope: This is a device and field-acceptance gate for every enabled user journey, not a guard-only defect.
Blocker: a signed field record from ISDL, QA, and representative guard, supervisor and owner users is required. `docs/real-android-pilot-checklist.md` is ready for use; no Android hardware claim is made from desktop/browser simulation.
Evidence: record normal and increased-text Android use for every role, plus the guard-specific camera, microphone, location, QR, offline, interrupted-upload, screen-lock, storage and shared-phone exercises. Test NFC only where the device/browser supports it.
Next action: execute, attach and review the checklist before release.

### G7 — Recorded instructions

Status / release state: Ready for verification / Not released  
Implementation files: `public/app.js`, `public/instructions.js`, `server.js`. Guard refresh caches assigned/current-shift instruction audio for offline playback, while typed instructions and versioned active-shift content remain supported.  
Implementation: remote commit `61ed1b3` was integrated with local remediation as `fbc7984`. Settings → Shifts → Add/Edit shift now provides typed instructions plus record, playback and remove controls for the recorded version. The active shift snapshots the selected audio version.  
Acceptance evidence: `node --test --test-reporter=spec tests/settings.test.js` in the isolated integration worktree completed 7 passed, 0 failed, including private publication, shift-level association and immutable guard versions.  
Next action: independently confirm denied-microphone and offline playback behavior on a supported Android device.

### O1 — Self-service first-customer onboarding

Status / release state: Ready for verification / Not released
Dependencies and scope decision: D1 was changed by the product owner on 2026-09-16 to a self-service owner signup and one guided first-property setup. Subscription and payment remain outside this flow. The assisted command remains an internal support fallback, not the normal customer journey.
Baseline / observed gap: a fresh customer could only be created by an ISDL operator. There was no public, guided route to create an owner, customer and first property without demo access.
Implementation files: `server.js`, `public/app.js`, `public/style.css`, `tests/signup.test.js`; existing fallback: `scripts/provision-customer.mjs`, `docs/ASSISTED-CUSTOMER-PROVISIONING.md`. The public endpoint validates account and confirmed property inputs, creates customer, owner, property, assignment and location atomically, writes a self-registration audit record, and returns a normal owner session. The two-step mobile wizard explains the property-location purpose and continues into the owner experience.
Acceptance criteria checked: a new owner completes signup at 390px without a demo account; the property location is confirmed; the user reaches their owner workspace; two new customer tenants cannot access each other's state/settings; duplicates and unconfirmed locations are rejected; audit history identifies the self-registration actor and records created customer/site IDs.
Test command | date | revision | environment | result | evidence path: `node --test --test-reporter=spec tests/signup.test.js tests/provisioning.test.js tests/owner-overview.test.js` | 2026-09-16 | working tree | isolated SQLite servers plus headless Chrome at 390×844 | 8 passed, 0 failed | `tests/signup.test.js`, `tests/provisioning.test.js`, `tests/owner-overview.test.js`
Cross-role regression checks: the existing assisted-provisioning and owner overview/isolation cases passed in the same run. A serial release-suite attempt initially reported three false failures because an orphaned local workflow server occupied its fixed port. After confirming the port clear, `tests/workflows.test.js` passed its API, media, state-machine, offline and mobile cases through the reported stages. The full release command must still be rerun from a clean test-process state before a release decision; X7 remains the release-suite gate.
Review result and unresolved concerns: local verification only. Independent customer and Android review remain required. X1 must demonstrate that production contains no shared demo data or credentials before real-customer use. A commercial/support handoff remains O8/X8 work.
Next action: have an independent reviewer complete the signup flow on a supported Android device, then attach the result; rerun the complete release suite from a clean test-process state before deployment.

### O2–O5 — Owner evidence, interpretation and read-only access

Status / release state: Ready for verification / Not released
Implementer / reviewer: Codex / self-review only; independent product, engineering and customer review remains required
Started / last updated: 2026-09-16
Dependencies and scope decision: Owner health cards remain display-only. The owner may inspect historical activity and reported-problem evidence without entering supervisor mode; supervisor mode remains the explicit route for operations. No payment, subscription, AI, or role model change is included.
Baseline reproduction / observed gap: The owner dashboard said only “Last seven days,” called patrol starts “coverage,” blended historical classification with unresolved current reports, and offered no read-only evidence route. “No security classified” could be misread as an assurance.
Implementation files / migration: `public/owner.js`, `public/owner-health-view.js`, `public/style.css`, `public/app.js`, `owner-health.js`, `server.js`, `tests/owner-evidence.test.js`, `tests/owner-ui.test.js`; no migration. The new owner-only API exposes historical activity timing and problem detail scoped to the selected property.
Acceptance criteria checked: The historical period states that it is seven completed Nigerian calendar days and excludes today; the home page shows current record freshness, unresolved problem count, location records awaiting review and last receipt without inferring an all-clear; patrol metric is explicitly “Patrol start health” and says it does not confirm checkpoints/completion; missing schedules and Any-guard limitations are disclosed; risk is a historical supervisor-classification summary with P1 denominator/meaning and no safety claim; unresolved reports are separately current; problem/activity evidence is read-only, mobile-responsive, owner-only and tenant-scoped; owner private-media links work while another customer is denied.
Test command | date | revision | environment | result | evidence path: `node --test tests/owner-overview.test.js tests/owner-evidence.test.js tests/owner-ui.test.js` | 2026-09-16 | working tree | isolated SQLite servers and headless Chrome at 390px | 9 passed, 0 failed | `tests/owner-overview.test.js`, `tests/owner-evidence.test.js`, `tests/owner-ui.test.js`
Cross-role regression checks: guard, supervisor and second-tenant attempts to load owner evidence return 403; owner may obtain the authorized signed link for its incident media while the other customer cannot; the owner browser flow contains no resolution form and role switching retains the owner identity.
Review result and unresolved concerns: This is local focused verification only. The report classification remains an operator-entered retrospective field, and the activity metrics remain dependent on recorded starts rather than live monitoring or verified completed patrols. X7 still blocks a clean release-suite conclusion; G6 still needs real-device evidence.
Commit or stable commit subject: not committed
Deployment ID/environment and smoke evidence (when applicable): none — not deployed
Rollback/migration compatibility: additive route and presentation-only change; no persisted-data migration. Revert the evidence-route UI/API together if a production issue requires rollback.
Blocker / required actor / next review date: independent product/engineering reviewer and representative owner walkthrough; no deployment authorization is implied.
Next action: independently review the owner language against a real customer’s interpretation, then close R-001/X7 before a release decision.

### O6–O7 — Persistent owner supervision and reusable property users

Status / release state: Ready for verification / Not released
Implementer / reviewer: Codex / self-review only; independent authorization and customer workflow review remains required
Started / last updated: 2026-09-16
Dependencies and scope decision: The product owner accepted per-property owner supervision. An owner may opt in for a property, retain named supervisors, and reuse any existing same-customer guard or supervisor for another owned property. Removing the later assignment retains the account and historical records.
Implementation files / migration: `migrations/017.sql`, `migrations/postgres/002.sql`, `migrate.js`, `database.js`, `server.js`, `owner-overview.js`, `public/app.js`, `public/owner.js`, `public/settings.js`, `public/team.js`, `public/style.css`, `tests/owner-management.test.js`, `tests/owner-ui.test.js`; migration 017 adds the property-level owner-supervision choice.
Acceptance criteria checked: Only the owner can enable or disable self-supervision; the choice survives state refresh and makes owner-only supervision complete setup while retaining the actual owner identity. Owner reuse candidates are restricted to guards/supervisors from the same customer and exclude people already assigned to the target property. Owners can assign or remove either role; supervisors cannot perform either operation; a foreign-customer account is denied. Guard removal is denied while that guard has an active shift and writes a future schedule version that omits the guard without rewriting historical plans.
Test command | date | revision | environment | result | evidence path: `node --test tests/owner-management.test.js tests/owner-overview.test.js tests/owner-ui.test.js tests/supervisor.test.js` | 2026-09-16 | working tree | isolated SQLite servers and headless Chrome | 20 passed, 0 failed | `tests/owner-management.test.js`, `tests/owner-overview.test.js`, `tests/owner-ui.test.js`, `tests/supervisor.test.js`
Cross-role regression checks: owner enable/disable, state refresh, same-customer assignment/removal and second-customer denial passed; existing S0 tests still deny supervisors from sharing or mutating a cross-property account. The mobile owner flow opts in before supervisor mode is shown.
Review result and unresolved concerns: Local verification only. A representative customer must confirm the language and removal behavior. The authorization review must include PostgreSQL deployment migration execution. The existing X7 release-suite isolation regression and G6 Android acceptance gate remain unresolved.
Commit or stable commit subject: not committed
Deployment ID/environment and smoke evidence (when applicable): none — not deployed
Rollback/migration compatibility: Additive `owner_supervision` table. Reverting UI/API preserves existing assignments; leave the table in place for safe rollback. Assignment removal creates a new schedule version and retains previous records.
Blocker / required actor / next review date: independent reviewer and representative owner walkthrough.
Next action: resolve R-001/X7; independently review the new free-tier limits before release.

### O8 — Free pilot subscription

Status / release state: Ready for verification / Not released
Scope decision: On 2026-09-16 the product owner selected a free pilot subscription for every customer. The owner Subscription page says only “Free subscription” and the two limits: one property and up to five guards and supervisors. It contains no price, payment, invoice, renewal, support-contact or gateway claim.
Implementation files / migration: `migrations/018.sql`, `migrations/postgres/003.sql`, `database.js`, `migrate.js`, `seed.js`, `scripts/provision-customer.mjs`, `server.js`, `public/owner.js`, `tests/signup.test.js`, `tests/owner-ui.test.js`. New self-service and assisted customers are explicitly assigned the free tier. Internal fictional fixtures are marked internal solely so authorization/multi-property test coverage can exercise the future-capable model.
Acceptance criteria checked: Free customers cannot create a second property; they cannot create or assign a sixth guard/supervisor; the owner overview returns the tier and limits; the mobile Subscription page displays the active tier and limits; no billing information is rendered.
Test command | date | revision | environment | result | evidence path: `node --test tests/signup.test.js tests/provisioning.test.js tests/owner-ui.test.js tests/owner-management.test.js` | 2026-09-16 | working tree | isolated SQLite servers and headless Chrome | 9 passed, 0 failed | `tests/signup.test.js`, `tests/provisioning.test.js`, `tests/owner-ui.test.js`, `tests/owner-management.test.js`
Review result and unresolved concerns: Local verification only. The free tier does not establish contractual terms, support response expectations, retention rules, tax treatment, invoicing, payment collection or a paid-tier upgrade path. Those remain X8 and future product scope, and must not be represented as available.
Next action: independently exercise a free customer at the limits and include the tier wording in customer onboarding; define any paid tier only in a separately authorized sprint.

## 7. GATE-1 — release approval record

**Status:** Not started. **Decision:** NO GO. **Candidate revision/environment:** none.

Before a paid pilot:

- [ ] Every P0/P1 issue is Verified with evidence; no unresolved high-severity regressions.
- [ ] Every P2 issue is Verified or Deferred — accepted with a real service limitation and revisit trigger.
- [ ] Decision register accepted; actual support/operator/commercial owners named.
- [ ] Current release suite passes; any exclusions are limited to deliberately disabled features and documented.
- [ ] Real Android field acceptance completed, including one representative roster week.
- [ ] Customer/demo/preview isolation and DB/media restore/offboarding demonstrated.
- [ ] Fresh customer onboarding and manual commercial handoff rehearsed.
- [ ] Deployment/migration rollback plan reviewed; public deployment explicitly authorized.
- [ ] Exact deployed revision, migration state and smoke-test evidence recorded.
- [ ] Product/operations owner records final acceptance of residual limitations.

Approver/date, accepted limitations, deployment and evidence links: **not yet supplied**.

## 8. Deferred feature inventory

Deliberately outside the working remediation target: in-app chat, AI transcription/narratives, additional languages, autonomous emergency response, continuous GPS, facial recognition, CCTV integration, payroll, repair work orders, automatic payments, gamification, native background execution and advanced analytics. This does not defer defects in existing enabled features or permit unsupported features to appear functional. Revisit only through an explicit scope decision with new IDs.

## 9. Change and regression log

| Date | ID(s) | Change | Evidence / next action |
|---|---|---|---|
| 2026-09-16 | PLAN | Created complete audit mapping, status rules, delivery phases, verification matrix and release gate. All issues Not started. No app fixes made. | Next: establish baseline and fix S0. |
| 2026-09-16 | S0 | Set S0 to In progress; recorded the confirmed same-customer cross-property assignment/password-reset escalation and intended authorization boundary. | Implement server checks and regression coverage; not verified or deployed. |
| 2026-09-16 | S0 | Restricted existing-user assignment to owners with source-property authority and blocked supervisor mutation of shared accounts. Added same-customer cross-property regression coverage while retaining owner and local-supervisor management. | Verified locally: supervisor suite 10/10; owner overview 4/4; original isolated audit probe returns 403 for the former escalation. Not committed or deployed; advance to S1. |
| 2026-09-16 | S1 | Set S1 to In progress; confirmed the stale-open-shift overlap caused a prior occurrence to satisfy a later shift's attendance. | Bind dashboard and report attendance to scheduled occurrences and retain boundary regressions. |
| 2026-09-16 | S1 | Replaced overlap attendance with occurrence-start matching, a 15-minute early grace and retry deduplication; surfaced earlier unclosed shifts as an attention exception; aligned activity-report shift-start counts. | Ready for independent verification: 20 focused supervisor/report/settings/workflow tests passed locally. Not committed or deployed; G4/S5 remain open. |
| 2026-09-16 | S2–S7 | Began all supervisor remediation items and retained versioned roster/route/instruction foundations. Added evidence manifests and resolution integrity, stale-data uncertainty, immediate disable/session revocation, audited exception close, classification guidance, and problem search/paging. | Focused supervisor/settings/activity-report suites pass locally. Ready for independent verification; field recovery, review-cadence, training and volume acceptance remain open. Not committed or deployed. |
| 2026-09-16 | G1–G7 | Added explicit guard synchronization/conflict state, pending-work sign-out warning, normal telephone help, chronology boundaries, recovery and Android field procedures; retained instruction cache/version behavior. | Guard/settings/workflow browser suites completed locally. G1–G5/G7 are ready for independent verification; G6 is blocked on signed real-device evidence. Not committed or deployed. |
| 2026-09-16 | X7 | Began full remediation verification. The initial parallel run produced 39 passes and 9 failures: tests assumed the retired in-app messaging feature and superseded owner health-card navigation, while concurrent browser files contended for local resources. | Explicitly skipped only retired messaging scenarios, updated owner-route assertions, and will run the release suite serially. No application feature was removed or hidden solely to obtain a passing test. |
| 2026-09-16 | G7, X7 | Serial browser verification passed the core offline guard, patrol, report, responsive-layout, authorization and retry scenarios. It also found that recorded-instruction publication is unreachable from the approved Settings navigation. | G7 reopened. Retired in-app messaging tests are explicitly skipped; the recorded-instruction scenario remains active and failing until there is a user-facing per-shift path. |
| 2026-09-16 | S1–S7, G1–G6, X7 | Completed local verification on the working tree based on `6f80c7c`. Focused supervisor/settings/activity suites: 20 passed, 0 failed. Serial workflow suite: 20 passed, 6 explicitly skipped retired-messaging tests, 1 active G7 failure. Dedicated disabled-messaging boundary test: 1 passed, 0 failed. Browser inspection confirmed the guard mobile screen exposes Start patrol, Report a problem, Hear instructions, compact synchronized state and a normal Call supervisor telephone link, with no Emergency or in-app messaging control. | Retain S1–S7 and G1–G5 as Ready for independent verification. G6 remains blocked on signed Android field evidence; G7 is reopened. Full release suite cannot pass until G7 is fixed. Not committed or deployed. |
| 2026-09-16 | X7 | Updated `test:release` to skip all six retired in-app messaging scenarios by name while retaining the dedicated disabled-messaging boundary test. `git diff --check` passed. `npm run build` is not applicable because the project intentionally has no build script; it is a directly run Node server. | Release command still must fail on the active G7 regression until it is remediated. |
| 2026-09-16 | G7, X7 | Safely integrated remote `61ed1b3` into local remediation commit `fbc7984`. Migration collision was resolved by retaining remote shift audio as `015` and moving local evidence/exception tables to `016`. A private profile-photo retrieval regression was fixed in `storage.js`; the supervisor suite then passed 11/11. | G7 settings suite passed 7/7. Full release suite ran 58 tests: 57 passed, one existing GPS review browser test failed consistently and requires separate remediation. No deployment occurred. |
| 2026-09-16 | G7 | Began remediation for the verified navigation regression. The intended design is per-shift: Settings → Shifts → Add/Edit shift will own typed and recorded instructions; the start record will retain that version for guard playback. | Next: inspect existing instruction storage/snapshot behavior, add the shift editor control, then test publishing, scope, active-shift immutability, offline cache and denied microphone fallback. |
| 2026-09-16 | G6 | Reclassified G6 from Guard to Mobile and device validation while retaining its stable ID. Expanded acceptance and the field checklist to guard, supervisor and owner journeys. | Blocked on signed real-device results; this is a documentation and release-governance change only, with no production claim. |
| 2026-09-16 | GPS review, X7 | Repaired the GPS browser regression by navigating through the stable Location review history entry instead of assuming its action is among the overview's first three attention rows. Made `test:release` serial so test files cannot contend for local server resources. | GPS suite: 4 passed, 0 failed. Clean `npm run test:release`: 58 passed, 0 failed in 141 seconds. The command deliberately filters six retired messaging scenarios and one retired owner-publication scenario; no deployment occurred. X7 is Ready for independent verification. |
| 2026-09-16 | O1 | Added a controlled assisted-provisioning command and runbook for one fresh customer, owner and first property. The command validates inputs, reads the temporary owner password only from a named environment variable, creates all records atomically and emits an audited receipt. | Focused provisioning and owner-isolation suites: 5 passed, 0 failed. O1 is Ready for independent verification; a named operator rehearsal and X1 production/demo separation remain required. No deployment occurred. |
| 2026-09-16 | D1, O1 | Product owner accepted self-service signup as the initial customer route. Added public, rate-limited signup that atomically creates a customer, owner, first property, confirmed location, assignment, audit entry and owner session; added a two-step mobile wizard and retained the controlled operator command only as a support fallback. | Focused signup/provisioning/owner checks: 8 passed, 0 failed, including a 390×844 browser journey, two-tenant isolation, duplicate rejection and audit evidence. O1 is Ready for independent verification. A full-suite attempt was contaminated by an orphaned fixed-port workflow server; rerun cleanly before a release decision. No deployment occurred. |
| 2026-09-16 | X7, R-001 | Reran `npm run test:release` after confirming fixed test ports were clear. The run passed 45 checks, then `tests/workflows.test.js` saw an unexpected active shift at its first start and its server became unavailable, producing 17 downstream failures. | Reopened X7. Reproduce and fix workflow fixture/server isolation; do not treat focused signup passes as full release approval. No deployment occurred. |
| 2026-09-16 | O2–O5 | Added an owner-only, read-only Activity evidence and Reported problems path. Clarified the completed Nigerian-calendar-day period, separated current unresolved records/freshness from historical classification, renamed patrol evidence to patrol starts, stated its checkpoint/completion limitation, and removed the possible “no security” assurance. | Focused owner API/mobile browser suite: 9 passed, 0 failed. O2–O5 are Ready for independent verification; X7/R-001 and G6 still block release evidence. No deployment occurred. |
| 2026-09-16 | D3, O6–O7 | Product owner accepted persistent per-property owner supervision alongside named supervisors and same-customer reuse/removal of guards or supervisors. Added the owner-supervision migration, owner-only opt-in, reusable-user controls and safe property unassignment. | Focused owner/authorization suite: 20 passed, 0 failed. O6–O7 are Ready for independent verification; no deployment occurred. |
| 2026-09-16 | D6, O8 | Product owner changed the pilot commercial boundary to a free subscription for every customer: one property and up to five guards/supervisors. Added server-side tier records and limits plus a concise owner Subscription page; paid tiers remain future scope. | Focused signup/provisioning/owner-management/mobile suite: 9 passed, 0 failed. O8 is Ready for independent verification; X8 commercial/support terms still gate a real launch. No deployment occurred. |
| 2026-09-16 | X7, R-001 | Replaced the workflow fixture's fixed port with an operating-system-selected port. The server now announces the actual bound port and the fixture uses that address, so it cannot silently attach to a stale server with inherited data. | Isolated workflow suite: 6 passed, 0 failed. Clean serial `npm run test:release`: 67 passed, 0 failed in 164.7 seconds. X7 and R-001 are Ready for independent verification; no deployment occurred. |
| 2026-09-16 | Release record | Pushed release revision `4368acf` to the GuardPro GitHub `master` branch. The connected Vercel project created a production deployment. | Production deployment: `https://guardpro-1x6bkiuty-mabogunje-7146s-projects.vercel.app` — Ready. Smoke check of `/` returned the Guard Patrol application shell. This does not change the NOT READY decision for paying-customer operations; X1–X6, X8–X9 and G6 still require completion or acceptance. |
| 2026-09-16 | D7, D8, X1, X3–X6, X9 | Product owner set the initial free pilot ceiling at five owners and fewer than 25 guards/supervisors, named themself as support and recovery owner, set one-year data retention, disabled AI transcription, and authorized a separate non-production environment. | Private Blob storage remains required for actual incident/profile media even with AI disabled. Recovery objectives, support escalation/response target, export/offboarding authority and measured record/history caps remain open. |
| 2026-09-16 | X1 | Created the isolated non-production environment through the existing Vercel connection: migrated Neon schema `guardpro_preview`, changed the Preview `DATABASE_SCHEMA`, created private `guardpro-preview-media`, and connected it to Preview only. | Preview deployment `dpl_3WgwCavQrm7B18fZiUrDArwz6413` is Ready and its root smoke check returned the application shell. |
| 2026-09-16 | X1 | Created a clean Production pilot schema `guardpro_pilot` without seeding, granted the restricted runtime role access only to its application tables, created private `guardpro-pilot-media`, and moved the Production configuration to those resources. Development retains the original demo schema/media; Preview retains its own schema/media. | Production deployment `dpl_BqE1yvNw4CiKgpdF81bkTQDAghgU` is Ready. Root smoke passed; unauthenticated `/api/state` returns `Sign in required`; direct administrative count confirms zero Production users. A first request exposed missing schema grants; those were corrected before the final smoke. X1 is Ready for independent verification, not yet Verified. |
| 2026-09-16 | X6 | Began external-I/O isolation. Multipart media requests no longer hold the global database transaction while private storage receives a recording or photo; an explicit test-only upload delay supports the concurrency regression test. | `node --test tests/media-lock.test.js`: 1 passed, 0 failed. A deliberately delayed 900 ms upload did not delay a second guard report. X6 remains In progress: staged finalization, timeout and PostgreSQL crash/retry/duplicate checks are still required. No production deployment of this code change has occurred. |
| 2026-09-16 | X6 | Completed staged upload finalization. A short transaction reserves a target-bound attachment ID; private storage receives the file outside the global lock with a 30-second abort deadline; a second short transaction finalizes it. Failed or interrupted uploads remain pending and retry under the same ID without duplicating final media. Schema migration now grants the restricted runtime role usage and application-table access on each new isolated schema. | Local `tests/media-lock.test.js`: 2 passed, 0 failed (fail-once retry/finalize-once and delayed upload concurrency). Core workflow plus media tests passed locally. Isolated `npm run test:cloud`: 5 passed, 0 failed against a new Neon schema and private Blob. X6 is Ready for independent verification; no production deployment of this code change has occurred. |
| 2026-09-16 | D9, X2 | Enforced the guard history boundary in `/api/state`. A guard now receives only their active shift and its events/reports; the API omits previous-shift reports/events and strips internal transition and revision history even for the guard's current report. | Focused API and mobile browser regression: `node --test --test-name-pattern="guard history is collapsed" tests/workflows.test.js` — 1 passed, 0 failed. X2 is Ready for independent verification; shared-phone/media-link exercise remains in the cross-role matrix. No deployment occurred. |
| 2026-09-16 | X3–X5, X8–X9 | Added the pilot operations runbook, updated the operating assumptions to the accepted one-year retention period, and added a data-minimal `/api/health` endpoint for uptime monitoring. The runbook sets a recovery rehearsal, export/offboarding, support, customer-boundary and capacity-measurement protocol without claiming that those external exercises have occurred. | Focused health regression: `node --test --test-name-pattern="service health endpoint" tests/workflows.test.js` — 1 passed, 0 failed. X3–X5 and X8–X9 are In progress: recovery drill, actual monitor/support channel, authority approvals, qualified review and capacity evidence remain required. No deployment occurred. |
| 2026-09-16 | X8, X7 | Added a concise, versioned customer notice draft covering collection, access, free-tier limits, retention, support and safety boundaries, with an approval record that must be completed before use. Corrected the README's production-pilot and operating-system-selected test-port descriptions. | The customer notice remains a draft until an ISDL approver, published support contact and qualified local review are recorded. No customer-facing terms were published and no deployment occurred. |
| 2026-09-16 | X7 | Started the complete serial release suite after the shared changes. The local execution host cut off captured output before the runner printed its final pass/fail summary, despite the displayed checks passing. | This is not accepted as full-suite evidence. Focused X2, health and X6 tests are recorded separately; repeat the complete suite from a clean process with an unrestricted runner before changing X7/R-001 status. |
| 2026-09-17 | D2, D4, D5, S2, O3 | Product owner accepted typed and recorded instructions as complementary or either/or, confirmed normal telephone help for the pilot, and selected a hybrid owner patrol score. Implemented the score: completed checkpoint rounds contribute 70%; on-time patrol starts contribute 30%; absent checkpoint snapshots make the composite unknown. Updated owner health and evidence wording accordingly. | Focused hybrid calculation: 1 passed, 0 failed. Owner API/mobile suite displayed 5 passing checks. Independent owner interpretation and cross-role report reconciliation remain required; no deployment occurred. |
| 2026-09-17 | Release record | Pushed remediation revision `009ff5e` to the GuardPro GitHub `master` branch. Created fresh direct Vercel Preview and Production deployments, then applied the idempotent database migration with demo seeding disabled to `guardpro_preview` and `guardpro_pilot`. | Preview: `dpl_28Kc6KLB7tr3j4xDLsY8Aya5Zjip` at `https://guardpro-csfr02cx9-mabogunje-7146s-projects.vercel.app`. Production: `dpl_6gzggHh1CgTFtf8vHpaz76CBEY7g`, aliased to `https://guardpro-nine.vercel.app`. Both `/api/health` checks returned `{\"status\":\"ok\"}`; unauthenticated `/api/state` returned `Sign in required`. This records a deployed candidate, not a GO decision; X3–X5, X8–X9, G6 and independent verification remain open. |
| 2026-09-17 | R-002–R-005, X8 | Independent production, product/copy and design/asset review of the deployed landing page, sign-up journey and current code found new public-launch regressions: fictional production demo credentials, no self-service urgent telephone-contact configuration, no published/accepted customer notice or support route, ambiguous public landing route, and unreconciled release copy/feature scope. | Recorded in `docs/PRODUCTION-READINESS-REVIEW-2026-09-17.md`. No production behavior changed. Public self-service promotion remains NO GO. |
| 2026-09-17 | R-002, R-004 | Removed the hard-coded demo identifier and fictional account disclosure from the app sign-in form. Made `/` the public landing route, preserved `/app` as the application and installed-PWA route, updated landing links, service-worker cache, manifest, documentation and focused route tests. | Local syntax/diff checks passed. Browser verification against an isolated server confirmed `/` shows the landing page, Landing → Sign in opens a clean `/app` sign-in page, and `/app?signup=1` opens self-service account creation. Focused Node test output was incomplete in this host, so both remain Ready for independent verification; neither is deployed. |
| 2026-09-17 | R-005, X8 | Implemented the public customer notice at `/customer-notice.html`, versioned `2026-09-17`; added a deployment-configured `PILOT_SUPPORT_CONTACT`; required the same notice version and explicit acceptance before signup; stored the customer/owner acceptance record; and reconciled current pilot copy for disabled messaging and AI. Public signup is blocked both in the client and server when no support contact is configured. | `node --test tests/public-onboarding.test.js`: 1 passed; signup API/acceptance cases: 2 passed; mobile and landing signup browser cases: 2 passed; `node --test --test-concurrency=1 tests/messaging-disabled.test.js`: 1 passed. Syntax and diff checks passed. R-005 is Ready for independent verification, not deployed. ISDL must approve the wording and configure a real support contact in Preview and Production before public signup can be enabled. |
| 2026-09-17 | R-005, X8 | The product owner supplied the pilot support contact, and it was configured as `PILOT_SUPPORT_CONTACT` for the linked GuardPro Vercel Preview and Production environments. | `npx vercel env ls production` and `npx vercel env ls preview` both list the variable as a hidden secret. Existing deployments do not receive the new value until a new deployment is created. |
| 2026-09-17 | D4, G3, R-003 | Product owner deferred the in-app urgent telephone-contact route for the pilot. Removed the guard Call supervisor control, the legacy supervisor-telephone editor, stored-phone exposure from application state and inactive alert handler; updated customer and operating copy to say that the pilot provides no in-app emergency action. | `node --test --test-concurrency=1 tests/messaging-disabled.test.js`: 1 passed. It verifies every role receives no `phone` field in application state and the guard has no Call supervisor link. R-003 is Deferred — accepted and does not require telephone dialler evidence under G6. No deployment occurred. |
| 2026-09-17 | R-006, X8 | Product/UX reassessment after the urgent-route deferral found landing FAQ copy that still promises a configured urgent call route, plus public-support usability and signup-identifier clarity follow-ups. | Recorded in `docs/PRODUCTION-READINESS-REASSESSMENT-2026-09-17.md`. No application behavior changed. |
| 2026-09-17 | R-006, X8 | Corrected the public FAQ to remove the configured urgent-call promise. Added an illustrative-image caption, made a configured telephone support contact tap-to-call in the customer notice, and stated the owner email / team WhatsApp-or-email sign-in policy before account creation. | Focused signup API checks: 2 passed. Isolated local browser review at 390px confirmed the `tel:+2348183354052` support link, revised FAQ boundary, illustrative caption and owner email guidance. R-006 and the X8 follow-ups are Ready for independent verification and production deployment. |
| 2026-09-17 | R-002, R-004–R-006, X8 | Pushed release revision `b667de7` to GuardPro `master`. Applied the idempotent customer-notice migration to the isolated Preview and Production schemas, then created fresh direct Vercel deployments. | Preview: `dpl_GT6GYFbZxjS3icbf5vLdLJsQTLnc` at `https://guardpro-4a01j0d33-mabogunje-7146s-projects.vercel.app`. Production: `dpl_EDjp7VWa1ghz9NDJtgu1g6McJcp3` at `https://guardpro-4t86n3n6k-mabogunje-7146s-projects.vercel.app`, aliased to `https://getguardpatrol.com`. Preview and direct Production smoke checks confirm `/api/public/onboarding` returns the configured support contact and enabled signup; Production `/api/health` returns `{"status":"ok"}`. The custom domain had a transient local TLS handshake failure during this check, while the direct production deployment verified. The full browser suite needs a clean-process rerun before X7 can be advanced: this shared workstation exhausted child-process capacity and produced timeouts; a stale owner expectation was corrected in the deployed revision. |
| 2026-09-17 | Release record | Retried the production custom-domain health check after propagation. | `https://getguardpatrol.com/api/health` returned `{"status":"ok"}`. |
| 2026-09-17 | X8 | Renamed the public product and operational application to Guard Patrol, preserving the existing brand styling, service boundaries and product messaging. | Updated public pages, in-app identity, PWA metadata, browser notification and export/print labels, plus supporting documentation and regression expectations. Targeted verification is required before deployment. |
| 2026-09-17 | X8 | Deployed the Guard Patrol identity update after the focused onboarding regression passed and no legacy product-name references remained in the workspace. | Preview: `dpl_CHfg3wVLgbMFMeEdVQsGMMcA28tu` at `https://guardpro-m0bvsbkvp-mabogunje-7146s-projects.vercel.app`. Production: `dpl_12qBFtrk5E414uW6cTNLsAREYAxA` at `https://guardpro-9td8rwm3y-mabogunje-7146s-projects.vercel.app`, aliased to `https://getguardpatrol.com`. Live landing and `/app` smoke checks both show Guard Patrol. |
| 2026-09-17 | R-007, X8 | Production signup failed because `guardpro_pilot.customer_notice_acceptances` was absent. The earlier Vercel environment-run migration silently used the local fallback schema because protected production secrets are not exported. | Vercel logged two rolled-back `POST /api/signup` failures; no accounts were created. Authenticated Neon owner migration applied the existing idempotent schema set directly to `guardpro_pilot`. A read-only query confirms the table is reachable and public onboarding remains enabled. Documentation now requires direct Neon migrations for protected environments. A successful real sign-up retry is still required before R-007 can be Verified. |
| 2026-09-17 | R-008, O1 | Simplified the self-service owner identity fields to First name and Last name, aligned the customer-notice confirmation control, and retained non-sensitive account-step details in session storage while the customer notice is opened. | Local syntax and diff checks passed. The focused API sign-up checks passed 2/2; manual local browser review at mobile width confirmed the revised footer, labels, checkbox alignment and restored first/last name plus notice acceptance after reload. Passwords intentionally are never retained on a shared device. Ready for independent verification and deployment. |
| 2026-09-17 | R-008, O1 | Pushed `ea5b2cb` and deployed the sign-up usability refinement to Vercel Preview and Production. | Preview: `dpl_CgSASUf4wbsEHEt8NjawZZeruZ7X` at `https://guardpro-d0evcio10-mabogunje-7146s-projects.vercel.app`. Production: `dpl_4PH3sBUqhwjbYtDWbpan15xXfhUa` at `https://guardpro-nngwj8ox5-mabogunje-7146s-projects.vercel.app`, aliased to `https://getguardpatrol.com`. Direct Production bundle smoke check confirmed the updated draft-persistence code and revised footer copy. |
| 2026-09-17 | R-009, O1 | Removed the fabricated 24-hour Shift 1 fallback from newly created properties. Settings now presents a first-shift setup prompt, and the supervisor overview does not calculate attendance or patrol expectations until a real shift is saved. | Focused supervisor regression: 1 passed. Focused self-service signup regression: 1 passed, including an empty settings shift list for a new property. Ready for independent verification and deployment. |
| 2026-09-17 | R-009, O1 | Pushed `f3c2215` and deployed the configured-shift correction. | Preview: `dpl_DoyFJwFs5U3v4pWTDER7TXSubKvk` at `https://guardpro-95vfgf9ff-mabogunje-7146s-projects.vercel.app`. Production: `dpl_5UcCt1dZjC7yWf2n7A4FZmAfcACX` at `https://guardpro-4aokrbyhs-mabogunje-7146s-projects.vercel.app`, aliased to `https://getguardpatrol.com`. Vercel build completed successfully in both environments. |
| 2026-09-17 | R-010, O1 | Added supervisor first-use guidance for all required operational configuration: shifts, guards, and checkpoints. Each prompt opens its matching Settings tab. | Focused setup-guidance regression: 2 passed, covering no setup, checkpoints-only outstanding, and fully configured states. Ready for independent verification and deployment. |
| 2026-09-17 | R-010, O1 | Pushed `487da33` and deployed supervisor setup guidance. | Preview: `dpl_9r6zZzJhEm2UWFSyWVPTfesGSee1` at `https://guardpro-ewi2hb2wf-mabogunje-7146s-projects.vercel.app`. Production: `dpl_ERLRYa77eZQkuPoRd11jXY1oZf4s` at `https://guardpro-bovhsqc62-mabogunje-7146s-projects.vercel.app`, aliased to `https://getguardpatrol.com`. Preview inspection and both Vercel builds completed successfully. |
| 2026-09-17 | R-011, O1 | Replaced simultaneous owner and supervisor setup lists with one next action. Owners first confirm the property location and then choose supervision. Supervisors progress in order: shifts, checkpoints, then users. | Syntax and diff checks passed. Focused supervisor regression passed 2/2 and owner mobile regression passed 3/3. Ready for independent mobile-browser verification and deployment. |
| 2026-09-17 | R-011, O1 | Pushed `6db8fba` and deployed the sequential owner and supervisor setup guidance. | Preview: `dpl_C3jBJq6Ah1QRavvFZvznMX683e9X` at `https://guardpro-a21vklvs2-mabogunje-7146s-projects.vercel.app`. Production: `dpl_3qMryZpXtRiQcmPBWjHtSrrcbp3Z` at `https://guardpro-lrl4p3z9i-mabogunje-7146s-projects.vercel.app`, aliased to `https://getguardpatrol.com`. Both deployment health checks returned `{"status":"ok"}`. |
| 2026-09-17 | R-012, O6 | Removed the hidden required-password blocker from WhatsApp-only user creation. New users without a supplied password receive a cryptographically generated temporary password, shown only once to the creator. Renamed the user-management actions to Add user and Create user. | Syntax and diff checks passed. Mobile Settings workflow and WhatsApp-only sign-in regression passed 2/2. Ready for independent verification and deployment. |
| 2026-09-17 | R-012, O6 | Pushed `b4121f1` and deployed the WhatsApp-only user-creation correction. | Preview: `dpl_AqtLCsry6pmcNRhkaPAEXMzoEVTa` at `https://guardpro-exdmivx7u-mabogunje-7146s-projects.vercel.app`. Production: `dpl_DDEkSmti1eFymKk7SCSGtgZs5ub3` at `https://guardpro-miuk27lcn-mabogunje-7146s-projects.vercel.app`, aliased to `https://getguardpatrol.com`. Production health check returned `{"status":"ok"}`. |
| 2026-09-17 | R-012, O6 | Product owner retained a required password for user creation. Restored the server and form requirement, labelled Name, Role, WhatsApp number and Password as required, and added clear inline validation while preserving Add user and Create user terminology. | Syntax and diff checks passed. The mobile Settings creation path and WhatsApp-only sign-in regression passed 2/2, including disabled-before-password and enabled-after-valid-password assertions. Ready for independent verification and deployment. |
| 2026-09-17 | R-012, O6 | Pushed `d8f7f02` and deployed the explicit required-field correction. | Preview: `dpl_4FfaGPCAxGhvzt7DUmvMxgfTxd6y` at `https://guardpro-cardya04y-mabogunje-7146s-projects.vercel.app`. Production: `dpl_Hz6g6cfZNjvH57hHKULUnCVP8P2M` at `https://guardpro-ecw9mz5j0-mabogunje-7146s-projects.vercel.app`, aliased to `https://getguardpatrol.com`. Production health check returned `{"status":"ok"}`. |
| 2026-09-18 | R-013, G5/O6 | Added pilot account recovery: the sign-in page now explains the role-appropriate recovery route and links to the deployment-configured ISDL support contact. An authorized owner or supervisor can enter a replacement temporary password in Users; server-side session revocation and an audit entry occur on reset. | Syntax and diff checks passed. Focused recovery browser check passed; focused WhatsApp account/reset regression passed. The broader signup browser file did not emit its final summary in this host after the focused checks, so it is not treated as full-suite evidence. Ready for independent verification and deployment. |
| 2026-09-18 | R-013, G5/O6 | Pushed `fa03626` and deployed the pilot account-recovery flow. | Preview: `dpl_FQUEpgnRB8NBySJQDbAvFN9Nx9uR` at `https://guardpro-9vflvchby-mabogunje-7146s-projects.vercel.app`. Production: `dpl_FbFVCrXbQnL9K4Mzwd6h39FnMujt` at `https://guardpro-13yay58tj-mabogunje-7146s-projects.vercel.app`, aliased to `https://getguardpatrol.com`. Production health and public onboarding checks returned `{"status":"ok"}` and the configured ISDL support contact. |
| 2026-09-18 | R-013, G5/O6 | Extended account recovery so an owner can request a one-time, 20-minute password-reset link using the email on the owner account. Only a hash of the token is stored; completion invalidates all existing owner sessions and is audited. Guards and supervisors remain owner-assisted. | `public-onboarding.test.js` passed 1/1, proving the unconfigured state does not claim delivery. Focused owner-reset and recovery-guidance tests passed 2/2, including old-password rejection and existing-session revocation. Email delivery is intentionally unavailable until a verified sender and production variables are configured; run the migration and independently complete a live reset before verification. |
| 2026-09-18 | R-013, G5/O6 | Pushed `a30ae86` and deployed the owner-email recovery implementation. | Preview: `dpl_DeezhnXgEHVZZUfSHd8WppKPYosp` at `https://guardpro-fdhsm2vj7-mabogunje-7146s-projects.vercel.app`; Production: `dpl_DkPWgZpTNDmbjcXGwzXCh9P8JUXP` at `https://guardpro-j8yec79pj-mabogunje-7146s-projects.vercel.app`, aliased to `https://getguardpatrol.com`. Both health checks returned `{"status":"ok"}`. Public onboarding confirms `ownerPasswordResetAvailable:false`, so the deployed UI remains safely inactive until the migration and verified outbound-email configuration are completed. |
| 2026-09-18 | R-013, G5/O6 | Confirmed the Resend Vercel integration now provides `RESEND_API_KEY` and `RESEND_EMAIL_DOMAIN` in Preview and Production. Updated Guard Patrol to derive its verified no-reply sender from that managed domain and to withhold the recovery control until the reset-token table is queryable by the runtime role. | Syntax/diff checks passed; public onboarding check passed 1/1; focused reset and recovery UI checks passed 2/2. Direct Neon administrator migration remains the next action; no reset email has been sent. |
| 2026-09-18 | R-013, G5/O6 | Pushed `447b74a` and deployed the Resend-compatible recovery update. | Preview: `dpl_HsqVp5vnKJtPVrrQA2i9kMULWCfJ` at `https://guardpro-aw4y3q2uc-mabogunje-7146s-projects.vercel.app`; Production: `dpl_EbFcZZftDPrPF9NmnavttPoYmdAz` at `https://guardpro-gj9ni4x25-mabogunje-7146s-projects.vercel.app`, aliased to `https://getguardpatrol.com`. Health checks pass. Both environments return `ownerPasswordResetAvailable:false`, correctly identifying the remaining direct-Neon migration/runtime-grant dependency. |
| 2026-09-18 | R-013, G5/O6 | Authenticated directly to Neon, applied migrations `021.sql` and `postgres/006.sql` to `guardpro_preview` and `guardpro_pilot`, and confirmed `password_reset_tokens` exists in each schema. | Read-only Preview and Production checks now both return `ownerPasswordResetAvailable:true`; the restricted runtime can use the feature. A controlled real-email delivery and password-reset completion by an owner is the remaining verification evidence. |
| 2026-09-18 | R-013, G5/O6 | Removed the ISDL support contact from sign-in recovery. Owners use their registered email; guards and supervisors are directed to their owner for password or identifier help. | Focused recovery UI regression added; deployment and browser verification pending. |
| 2026-09-18 | R-013, G5/O6 | Pushed `e59d21e` and deployed owner-assisted recovery wording to Production. | Production: `dpl_6Jtz23hLCnMF3LzZRMVpMwWxg8wd` at `https://guardpro-gefpahcj9-mabogunje-7146s-projects.vercel.app`, aliased to `https://getguardpatrol.com`. Focused local recovery checks passed 2/2. Real owner email delivery/reset remains the final independent verification. |

Landing work log, 2026-09-17 — X8/O1/O8: created the local landing draft, honest free/coming-soon offer and opt-in signup entry. Independent copy review and desktop/mobile browser checks passed as detailed below. Added signup regression cases, but their automated run did not execute because Node child-process creation was denied; the escalated retry was interrupted without execution evidence. No deployment or issue closure occurred.

### New regression register

| ID | Severity | Parent | Status | Reproduction | Acceptance criterion / owner |
|---|---|---|---|---|---|
| R-001 | P1 | X7 release verification | Ready for independent verification | The workflow fixture previously used fixed port 3101, so an orphaned process could satisfy its startup signal and supply inherited fixture state. It now starts on port 0, reads the actual announced port and uses that private address for its entire run. | The isolated workflow suite passed 6/6 and clean `npm run test:release` passed 67/67. QA must independently repeat the complete command from a clean process state before this is Verified. |
| R-002 | P1 | X1 production/demo separation | Ready for verification | Production sign-in pre-fills `bala@demo.isdl` and displays fictional pilot credentials even though the isolated production schema has no demo accounts. | The sign-in form now has an empty identifier field and no fictional account disclosure. Focused browser route review and source/syntax checks passed locally; independent production-browser verification is still required. |
| R-003 | P1 | G3 / D4 urgent telephone help | Deferred — accepted | A self-service property can be created without an urgent telephone contact; the earlier pilot design exposed a telephone action only when one existed. | Product owner chose to hide the urgent telephone-contact route and emergency controls for this pilot. `phone` remains a legacy storage field but is not editable or returned in current application state. Revisit only when an operational, correctly named urgent-help service is approved and real-device tested. |
| R-004 | P1 | X8 public onboarding | Ready for verification | Landing is live at `/landing.html`, but the public root is sign-in with no return route to marketing; no intentional public route is recorded. | `/` now serves the landing page; `/app` serves the stable operational app and PWA start route. Landing calls to action and Sign in link to `/app`; local browser verification passed. Independent production-browser verification is still required. |
| R-005 | P1 | X8 release copy and scope | Ready for verification | Public signup collected identity and property location before a published customer notice, real support contact or acceptance record; documentation and visible feature paths also conflicted on messaging/AI/metrics. | A public versioned notice (2026-09-17), deployment-configured support contact, server/client signup gate and durable acceptance record are now implemented. Current README/architecture/operations copy states that messaging and AI are disabled for the pilot. Focused local API/browser checks pass. ISDL must approve the notice wording and set `PILOT_SUPPORT_CONTACT` in Preview and Production before public signup is enabled. |
| R-006 | P1 | D4 / X8 public scope | Ready for verification | The public landing FAQ said guards should call a configured contact for urgent help, although the accepted pilot scope hides the in-app urgent telephone route. | The FAQ now states that urgent safety concerns follow the property's existing emergency procedures and that Guard Patrol does not provide emergency response. The landing labels its hero image illustrative; the notice makes a configured telephone support contact tap-to-call; signup clarifies owner email and team identifier rules. Focused local browser verification remains required before deployment. |
| R-007 | P1 | X8 production signup | Ready for verification | Production `POST /api/signup` failed because the customer-notice acceptance table was absent from the `guardpro_pilot` schema. | The direct authenticated Neon migration created the table and grants in the intended schema. Database reachability and public onboarding checks pass; complete one successful production account creation before marking Verified. |
| R-008 | P2 | O1 self-service onboarding | Ready for verification | The account form used ambiguous owner/household labels, its notice confirmation was visually misaligned, and leaving to read the customer notice could discard the account draft. | The form now asks for First name and Last name; the confirmation is vertically aligned; non-sensitive account fields and notice acceptance persist within the current browser session. Passwords are deliberately excluded for shared-device safety. Independent mobile-browser verification is still required. |
| R-009 | P2 | O1 first-property setup | Ready for verification | A new property with no saved schedule was shown as though it already had a real 24-hour Shift 1, creating false operational expectations. | Settings now returns no shift until one is saved, presents a first-shift setup prompt, and the supervisor overview withholds shift KPIs until configuration is complete. Independent mobile-browser verification is still required. |
| R-010 | P2 | O1 supervisor onboarding | Ready for verification | A new supervisor could be told to create a shift but received no equivalent guided path when guards or patrol checkpoints were still missing. | The supervisor overview now lists each missing setup step and opens the corresponding Settings tab for shifts, users, or checkpoints. Independent mobile-browser verification is still required. |
| R-011 | P2 | O1 guided setup usability | Ready for verification | A new owner or supervisor could see several setup tasks at once, creating an overwhelming first-use screen and crowded multi-line action labels. | The owner sees property location before supervision. The supervisor sees exactly one next action: shifts, then checkpoints, then users. Each action opens its matching Settings tab. Independent mobile-browser verification is still required. |
| R-012 | P1 | O6 user provisioning | Ready for verification | The Add user form did not clearly identify all required fields and could leave Create user disabled without explaining why. | Name, Role, WhatsApp number and a 12-character Password are explicitly required. The Create user button enables once they are valid and shows a concise reason while any required field is incomplete. Independent production-browser verification is still required. |
| R-013 | P1 | G5 / O6 account recovery | In progress | A person who forgot their password or sign-in identifier had no in-app guidance, and an authorized manager had no clearly labelled password-reset action. | Owners can request a 20-minute, single-use reset link only for their registered email when the outbound sender is configured; the server retains only a token hash, audits request/completion and revokes sessions on completion. Guards and supervisors remain owner-assisted through Users. The Resend Vercel integration is now installed in Preview and Production. The UI stays hidden until the new migration and runtime grants are present, then requires independent live delivery/reset verification before status can become Verified. |

## Landing page work — 17 September 2026

X8 remains **In progress**. Codex is preparing a separate, unpublished landing page with audience, copy, design and product-review agents. Product owner confirmed Guard Patrol branding, the free-tier launch and a future paid tier labelled Coming soon; no future pricing or feature entitlement was supplied. O8 wording retains one property and five guards/supervisors combined. O1 signup entry will accept an explicit landing-page signup link without replacing the installed app's root or changing session restoration. No release gate is closed by this marketing work.

Implementation is complete locally in `public/landing.html`, `public/landing.css`, `public/landing-assets/` and the explicit signup entry in `public/app.js`. Copy review by the audience agent passed after adding “combined” to the hero's five-person limit. The built-in generated hero is illustrative and its WebP delivery is 132,868 bytes. Design and asset prompt: [landing direction](LANDING-PAGE-DIRECTION.md).

17 September 2026 browser evidence, Windows/Chrome against isolated local SQLite at `http://127.0.0.1:3188`, uncommitted working tree based on the current checkout: `npx agent-browser --session guard-landing open http://127.0.0.1:3188/landing.html`; viewport checks at 320, 390 and 1440 pixels showed no horizontal overflow; image completion check passed; public-text country-name check returned false; internal anchor check returned zero missing targets; FAQ expansion passed; hero Start free opened Create your account. Browser error list was empty. Screenshots: `data/landing-desktop.png`, `data/landing-desktop-full.png`, `data/landing-mobile.png`, `data/landing-mobile-full.png`. The initial browser launch required permission for its session folder; a role-selector CLI attempt failed to locate the repeated CTA, then an observed element-ref click succeeded. Neither was an application failure. `git diff --check` passed.

Automated signup evidence: the first sandboxed `node --test tests/signup.test.js` failed before executing cases with `spawn EPERM`; its escalated retry was interrupted while awaiting approval. A subsequent authorized unrestricted retry completed on 2026-09-17: 4 passed, 0 failed in 3.12 seconds. Coverage includes direct landing signup, normal sign-in, cancellation/reload and restored owner-session precedence. Manual browser CTA evidence is now supplemented by this focused suite. Source baseline: `a146656` plus these uncommitted changes.

Deployment evidence: production deployment `https://guardpro-318b5zp7z-mabogunje-7146s-projects.vercel.app` created from the pushed landing revision on 2026-09-17. `npx vercel curl /api/health --deployment <deployment URL>` returned `{"status":"ok"}`. The same Vercel-authenticated check for `/landing.html` returned the landing document with title `Guard Patrol — Keep up with your guards`, the local WebP hero, the accurate free-tier limit and `/?signup=1` actions. This is a deployed, smoke-tested landing draft; it is not an approval of the outstanding X8 commercial/support gate or the wider paying-customer release decision.

Next landing action: obtain user feedback on the public draft and decide whether the landing page should later replace the installed app's default root. Existing X3 recovery next action and all release gates remain unchanged. X8 remains In progress; O1/O8 are not reclassified by this work. Release state: **Deployed and smoke-tested** for this landing revision; overall paid-customer release state remains NOT READY.

Landing revision record: committed with subject `X8/O1/O8: add Guard Patrol landing page`; deployment remains pending at this point in the log.

## 10. Audit coverage checklist

- Guard: G1–G5 and G7; G6 remains a stable guard-origin ID but is classified as cross-role mobile acceptance.
- Supervisor S0–S7: eight entries, including reproduced authorization issue.
- Owner O1–O8: eight entries.
- Shared gates: production separation X1; minimization X2; recovery G5/S5; integrity G4/S1/S2/S3; backup/lifecycle X3/X4; support/locking X5/X6; release evidence X7 and device acceptance G6; service boundary X8.
- Additional engineering risks: conflict-blocked queue G2; global external-I/O lock X6; unbounded state/history X9; property-level privilege escalation S0.
- Current total: **32 remediation issues**, including the cross-role G6 mobile acceptance gate. No issue has been silently dropped. GATE-1 is a release decision, not an additional fix.
