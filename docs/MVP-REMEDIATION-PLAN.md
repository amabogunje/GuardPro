# Guard Companion — MVP remediation plan and progress register

**Created / last updated:** 16 September 2026  
**Audit baseline:** `6f80c7c`  
**Source:** [Independent readiness report](audit-2026-09-16/MVP-READINESS-REPORT.md), [engineering notes](audit-engineering-notes.md), [product notes](audit-product-notes.md)  
**Current release decision:** NOT READY for paying customer operations.  
**Current work:** G7 — restore reachable recorded-instruction publication (In progress).  
**Next issue:** Implement and verify a per-shift recorded-instruction path, then obtain independent review and complete G6 signed Android field validation.  
**Progress:** S0 is verified locally and remains Not released. S1–S7 and G1–G5 remain ready for independent verification. G6 is blocked on real-device evidence; G7 is reopened because recorded instruction publication is unreachable; X7 is In progress to align the release suite with approved MVP scope.

This is the authoritative shared plan. Keep stable IDs so the owner can discuss, prioritize and verify work independently. The audit remains an unchanged historical record; update this plan as implementation progresses. Creating this plan does not authorize purchases or deployments, and does not assert that the proposed commercial scope has been accepted.

## 1. Scope and decisions

Working target: a supported, assisted paid pilot of recorded guard supervision. Preserve the existing mobile guard/supervisor/owner design. Prioritize authorization, evidence integrity, recovery and customer onboarding before cosmetic changes. Do not add a repair-management workflow.

The audit proposes one property per initial customer, named guard rosters, external urgent communication, and manual invoicing. These are planning defaults to confirm with the product owner before restricting advertised capability. Conditional issues remain OPEN until implemented or explicitly deferred with an accepted service limitation. They do not disappear from the plan.

| Decision | Proposed default | Status / owner | Affected issues |
|---|---|---|---|
| D1 Initial customer scope | Assisted onboarding; one property initially | Proposed; product owner | O1, O7, X8 |
| D2 Instructions | Keep recorded instructions as well as typed instructions for low-literacy use | Proposed; product owner | G7, S6 |
| D3 Owner also supervises | Support this existing promised variant | Proposed; product owner | O6 |
| D4 Urgent help | Remove dummy alarm; use configured normal telephone help, no guaranteed monitoring | Proposed; product owner | G3, S4, X8 |
| D5 Owner patrol metric | Show completed patrol coverage, or explicitly rename existing metric to start timeliness; choose before implementation | Decision needed; product owner | S2, O3 |
| D6 Commercial MVP | Manual invoice/payment ledger and support contact; no gateway | Proposed; ISDL commercial lead | O8, X8 |
| D7 Review responsibility and pilot limits | Agree review cadence, supported phones, site/user/history caps and response expectations | Decision needed; ISDL operations + customer | S4, S7, G6, X6, X9 |

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
| G3 | P1 | Ready for verification | Remove nonfunctional Emergency action; implement correctly labelled configured help if D4 accepted. No claim an alert was sent. | Placeholder alarm removed. Configured Call supervisor uses a telephone link; actual dialler exercise remains G6. |
| G4 | P1 | Ready for verification | Server enforces coherent start/patrol/scan/end chronology and handles skew with review/rejection; original capture/receipt preserved. Legitimate offline delay remains valid. | Server now rejects captures before a referenced shift or materially future device times; old captures retain a review marker. Boundary testing remains independent verification. |
| G5 | P1 | Ready for verification | Safe credential reset/vault recovery flow or supported tool/runbook; guard can regain access without silently discarding pending evidence. Explain unrecoverable loss. | Assisted recovery and lost-device procedure documented; encrypted pending work is explicitly unrecoverable after credential/browser loss. Field reset exercise remains required. |
| G6 | P1 | Blocked | Signed real Android acceptance record with models/browser/OS, permissions, weak connectivity, QR, recording interruption, screen lock, storage pressure and shared phone. NFC only claimed if tested. | Checklist created at `docs/real-android-pilot-checklist.md`; blocked until ISDL, QA and a pilot operator execute and sign it. Desktop browser tests do not close this issue. |
| G7 | P2 | In progress | Recorded instructions accessible from current Settings and cached playback for guards, or accepted typed-only limitation with corrected labels/claims. | Reopened during verification: current Settings navigation no longer exposes recorded-instruction publication. Restore a user-facing per-shift path, then repeat recording, authorization and offline playback tests. |

### Supervisor

| ID | Priority | Status | Implementation deliverable and acceptance | Dependencies / verification |
|---|---|---|---|---|
| S0 | P0 | Verified | Deny property-A supervisor acquiring property-B account authority via assign/reset. Restrict assignment and global user mutations to legitimate authority; preserve authorized owner actions. | Verified locally; not released. API matrix covers same customer/different property, other customer, shared target, password changes, local supervisor management and owner success. |
| S1 | P1 | Ready for verification | Attendance tied to scheduled occurrence; yesterday's unclosed shift cannot satisfy today. Overdue shift is an explicit exception; overnight shift valid. | Local stale, overnight, early/late, duplicate and report reconciliation fixtures pass. Independent review remains; G4/S5 still own chronology enforcement and exception-close workflows. |
| S2 | P1 | Ready for verification | Historical checkpoint/roster/schedule snapshots remain immutable; shared expectation rules documented across KPIs/exports. Unknown history stays unknown. | Existing version and route-snapshot tests pass; independent review of historical report semantics remains. |
| S3 | P1 | Ready for verification | Persist expected media manifest and evidence completeness; supervisor sees pending/failed recording; empty evidence cannot be accidentally resolved as complete. Retry remains idempotent. | Added evidence manifest migration and server/UI completion checks; interrupted media and recovery testing remains coordinated with G1/G2. |
| S4 | P1 | Ready for verification | Show uncertainty from capture freshness, distinguish missing evidence from confirmed exception; establish real supervisor review/escalation responsibility. | UI now identifies stale receipt as unconfirmed; ISDL still must approve real review ownership/cadence under D4/D7. |
| S5 | P1 | Ready for verification | Immediate disable/session revocation independent of active attendance; audited exception-close with reason/actor; late uploads reconciled. | Disable now revokes sessions even with active attendance; exception close is audited. Lost-device and delayed-queue field exercises remain G5/G4 work. |
| S6 | P2 | Ready for verification | Complete instruction publication as scoped and define category/P1/P2/P3 training with examples. No inferred criminal intent or repair workflow. | Recorded/typed instruction versioning already exists; resolution UI now explains classification and priority choices. Training approval remains required. |
| S7 | P2 | Ready for verification | Review opens the selected incident. Add compact paging/search or accepted, measured pilot volume cap before deferring scale work. | Selected incident detail plus five-item search/paging implemented; pilot volume and latency target remains D7/X9 acceptance. |

### Owner

| ID | Priority | Status | Implementation deliverable and acceptance | Dependencies / verification |
|---|---|---|---|---|
| O1 | P1 | Not started | Supported, audited fresh-customer/owner/first-property provisioning; self-service zero-property path fixed if offered, otherwise honest assisted flow. No ad-hoc SQL/demo credentials. | S0, D1; create two fresh tenants, owner login, property setup and isolation tests; repeatable runbook. |
| O2 | P1 | Not started | Label historical period unambiguously; current outstanding/unreviewed and unconfirmed freshness visible without operational interpretation. | S4; exclude-today, stale offline receipt and current issue browser/API fixtures. |
| O3 | P1 | Not started | Align patrol score/label with D5; disclose unknown/partial measurement and Any staffing limitations. No start-only evidence presented as completion. | S2, D5; zero scans/on-time start, incomplete roster and Any fixtures; owner/supervisor/export reconciliation. |
| O4 | P1 | Not started | Retrospective classification separated from current unresolved/unclassified issues; zero classified security does not imply safe. Clear P1 meaning/denominator. | S3, O2; today's open incident, historical resolved P1, unclassified/legacy report fixtures. |
| O5 | P1 | Not started | Read-only Problems/Activity evidence route without switching to supervisor. Static KPI cards remain static. | S0, S3; owner media authorization, source links and mutation denial in owner UI; role-switch attribution still works. |
| O6 | P2 | Not started | Owner-as-supervisor is a persistent responsibility choice that completes setup without a fake supervisor account. | O1, D3; refresh, audit identity, owner-only and separate-supervisor cases. |
| O7 | P2 | Not started | Reuse existing supervisor for another property through authorized workflow, or explicitly accept and enforce single-property initial scope. | S0, O1, D1; existing identity assignment, duplicate contact, tenant boundaries, removal and access tests. |
| O8 | P1 | Not started | Truthful manual-service/payment/support information or remove dead-end Subscription entry; establish contract, invoice/ledger and service dates. | D6, X8; ISDL commercial supplies terms; no invented prices/statuses or unsolicited payment integration. |

### Shared engineering and operations

The audit's unnumbered shared gates and additional engineering findings receive stable X IDs here. Overlapping role issues are linked, not counted as separate implementations.

| ID | Priority | Status | Implementation deliverable and acceptance | Dependencies / verification |
|---|---|---|---|---|
| X1 | P1 | Not started | Inspect and separate customer production, demo and preview data/media; remove demo credentials/accounts in real-customer build; verify secrets, cookies and runtime grants. | Before real data; deployment inventory and cross-environment access checks. Record IDs, never secrets. Infrastructure changes only within authorization. |
| X2 | P1 | Not started | Minimize guard API disclosure to assigned work and agreed handover summary; remove unnecessary other-guard transcripts/revisions/history. | S0; positive relevant-information tests and negative site/role/media disclosure tests. Product defines handover need. |
| X3 | P1 | Not started | Rehearse encrypted/restricted database AND media backup/restore with agreed recovery objectives and named operator. | X1; isolated restore with row/media integrity, signed links/auth checks, measured recovery time and evidence. |
| X4 | P1 | Not started | Retention, export, offboarding/access removal and backup expiry procedure, with approved roles and customer requirements. | X1/X3, O1/S5; disposable tenant export/delete/revoke rehearsal, other tenant unaffected; no real-data deletion without authorization. |
| X5 | P1 | Not started | Named support/outage owner, error/upload monitoring, quotas and cost limits, escalation/runbooks. Confirm commercial hosting suitability. | D7, X1; injected failure observed and acted on; provider allowance verified; no purchases without approval. |
| X6 | P1 | Not started | Remove external Blob/AI I/O from global write-lock scope using staged idempotent finalization and deadlines. Keep disabled AI out of critical path. | S3 design; delayed upload in A does not block B's check-in/login; crash/retry/duplicate consistency tests on PostgreSQL as well as local store. |
| X7 | P1 | In progress | Coherent enabled-feature release suite, independent fixtures, baseline failure ledger and current docs/runbooks. CI/repeatable command preserves regression tests. | Messaging tests are explicitly skipped because the feature is disabled for the MVP; owner tests now exercise the approved mobile owner routes. Record full suite revision/results. |
| X8 | P1 | Not started | Accepted product boundary, collection/access explanation, supervisor responsibility, support/payment terms and necessary qualified local review. | D1–D7, O8; named ISDL approver and versioned customer/guard onboarding material. No compliance certification implied. |
| X9 | P1 | Not started | Bound/measure whole-history `/api/state`, encrypted vault size and UI report volumes; set supported pilot capacity or implement pagination/incremental sync where needed. | D7, S7; seeded intended history/concurrent-device load, latency/storage budgets and documented cap. No arbitrary throughput claims. |

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
| 360–390px, larger text, permissions denied, actual Android interruptions | Core journeys remain usable; phone results and limitations recorded | G6, all changed UI |

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
Implementation files: `public/app.js`, `tests/messaging-disabled.test.js`. Removed the nonfunctional Emergency button and its misleading placeholder. Where a property has a configured phone number, the guard sees Call supervisor as a normal `tel:` link; no delivery, monitoring or emergency response is claimed.  
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

### G6 — Real Android acceptance

Status / release state: Blocked / Not released  
Blocker: a signed field record from ISDL, QA and a pilot operator is required. `docs/real-android-pilot-checklist.md` is ready for use; no Android hardware claim is made from desktop/browser simulation.  
Next action: execute, attach and review the checklist before release.

### G7 — Recorded instructions

Status / release state: In progress / Not released  
Implementation files: `public/app.js`, `public/instructions.js`, `server.js`. Guard refresh caches assigned/current-shift instruction audio for offline playback, while typed instructions and versioned active-shift content remain supported.  
Verification failure: `tests/workflows.test.js` cannot reach the recorded-instruction editor through the approved Settings navigation. This is a functional access regression, not a test exclusion.  
Next action: provide a user-facing, per-shift recorded-instruction control within the approved Settings pattern; then independently confirm denied-microphone and offline playback behavior.

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
| 2026-09-16 | G7 | Began remediation for the verified navigation regression. The intended design is per-shift: Settings → Shifts → Add/Edit shift will own typed and recorded instructions; the start record will retain that version for guard playback. | Next: inspect existing instruction storage/snapshot behavior, add the shift editor control, then test publishing, scope, active-shift immutability, offline cache and denied microphone fallback. |

### New regression register

None recorded during remediation yet. The original audit defects are tracked above, not counted as newly introduced regressions. If a new issue is found, append a row with R-ID, severity, parent change, status, reproduction, acceptance criterion and owner; include it in GATE-1.

## 10. Audit coverage checklist

- Guard G1–G7: seven register entries.
- Supervisor S0–S7: eight entries, including reproduced authorization issue.
- Owner O1–O8: eight entries.
- Shared gates: production separation X1; minimization X2; recovery G5/S5; integrity G4/S1/S2/S3; backup/lifecycle X3/X4; support/locking X5/X6; release evidence X7/G6; service boundary X8.
- Additional engineering risks: conflict-blocked queue G2; global external-I/O lock X6; unbounded state/history X9; property-level privilege escalation S0.
- Current total: **32 remediation issues** (7 guard + 8 supervisor + 8 owner + 9 shared). No issue has been silently dropped. GATE-1 is a release decision, not an additional fix.
