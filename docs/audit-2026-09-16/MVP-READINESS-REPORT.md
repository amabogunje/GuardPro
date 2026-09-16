# Guard Companion: independent sellable-MVP readiness review

**Date:** 16 September 2026  
**Code reviewed:** `6f80c7c`  
**Provider:** Integrated Systems and Devices Limited (ISDL)  
**Decision:** Not ready for unrestricted customer production. Substantial working product; a bounded, assisted paid pilot is achievable after the release gates below.

## Executive assessment

The claim that guard and supervisor are production-ready is not supported by this review. Both have useful, implemented journeys and meaningful automated coverage. Their remaining gaps occur when connectivity, account access or operational assumptions fail—the circumstances in which customers most need the records to be trustworthy. The owner experience also needs changes, but another broad redesign is not the main requirement.

| Experience | What is already credible | What prevents launch |
|---|---|---|
| Guard | Individual sign-in, shift capture, patrol scans, voice/photo problems, encrypted offline storage | Hidden transfer failures, incomplete evidence, recovery gaps, unimplemented emergency control, unverified real-phone reliability |
| Customer supervisor | Mobile exceptions, Problems, direct resolution/category, schedules/checkpoints/users, activity reports | Incorrect attendance and historical patrol calculations; incomplete reports can look actionable; lost-device/unfinished-shift recovery |
| Owner | Property location, supervisor creation, acting as supervisor, seven-day cards | First-customer provisioning, misleading or incomplete confidence cues, owner-only setup, evidence access, unfinished commercial journey |

**The smallest product worth selling is reliable recorded guard supervision with customer-led follow-up.** It is not a security guarantee, emergency service, continuous tracking system or complete workforce-management platform.

### What “go live” should mean

Start with an explicitly bounded **assisted paid pilot**, initially one property per customer, named guard assignments and a supported Android/browser combination. ISDL provisions the customer and verifies the property setup. The customer names who reviews issues and how often. Urgent communication continues through normal telephone/WhatsApp. Charges can be handled by a contract, invoice and operator payment ledger.

This is still real production: customer data and payments create obligations. Calling it a pilot does not waive privacy, recovery, isolation or truthful-status requirements. Self-service signup, unattended growth and multi-property sales require additional gates; they need not delay a properly scoped first sale.

## Review method and confidence

Three separate AI-assisted reviewer perspectives covered product/commercial scope, UX/design journeys, and engineering/security/operations. The lead review reconciled their findings against source and executable examples. These are independent review passes, not interviews with human industry experts or a security certification.

Evidence includes current application and database code, migrations, documentation, local automated tests, and isolated synthetic reproduction cases. No real customer records were changed. This audit did not perform a fresh production configuration inspection, penetration test, real Android field trial, customer usability study or backup restoration. Absence of evidence for those activities is a launch gate, not proof that every operational control is absent.

The targeted runs passed **15 tests**: 10 across owner health, owner UI and activity reports, and five coherent API workflows covering authentication, patrols, private media, state transitions and concurrent retries. The broader release suite was not established green; legacy UI failures and fixture-dependent selective tests need reconciliation. Passing these confirms specific implemented behavior; it does not validate the broader product promises. Three independently reproduced calculation examples are available in `docs/audit-2026-09-16/reproduce-findings.mjs`. An isolated local API probe, `reproduce-api-findings.mjs`, reproduces authorization, missing-media, chronology and active-shift deactivation findings. Run either from the repository root; the API probe creates only disposable local data on port 3198.

**Priority key:** **L** = required before the bounded paid pilot; **C** = required only for the corresponding advertised launch variant; **D** = defer. An operational procedure can satisfy a gate where explicitly stated; not every requirement needs a new screen.

## 1. Guard experience

**Primary objective:** reliably record work and problems with minimal effort, and know whether that evidence reached the service.  
**Secondary objective:** understand the shift and recover from phone/connectivity problems without lost records or unfair conclusions about performance.

### Keep the current core

Keep the mobile width, few primary actions, individual sign-in on shared phones, tap-to-record, audio playback, camera/library choices, QR/manual fallback, custom confirmations and immutable submitted records. There is no case for rebuilding this journey from scratch.

### Outstanding work

| ID / priority | Required change | Minimum acceptance condition |
|---|---|---|
| G1 — L | Restore a small, persistent **Saved on this phone / Uploading / Uploaded / Needs retry** indicator. Count required media as well as the event. | Save audio/photo offline, reload, interrupt upload and reconnect. The guard can tell what remains local; retries produce one report and all attachments. No technical diagnostics wall is needed. |
| G2 — L | Make pending-work recovery available across shift end and sign-out, without exposing another guard’s data. Reconcile non-retryable conflicts rather than leaving the queue blocked. Add a clear pending-work warning at these transitions. | Guard A signs out with pending work; B cannot see it; A later signs in and can upload A’s earlier work without reopening a completed shift. A failed attachment remains discoverable. |
| G3 — L | Remove the red **Emergency** placeholder, or replace it with a configured, correctly named telephone help action. | Every visible help action does what its label promises. An emergency alarm that only says “not implemented” is not present in the customer release. Emergency dispatch itself remains excluded. |
| G4 — L | Validate event chronology and flag device-clock anomalies while retaining original capture and server receipt times. | End cannot precede start; scan cannot precede its shift/patrol; implausible future/old captures are rejected or explicitly quarantined. Valid delayed offline uploads still synchronize. |
| G5 — L | Provide a safe password-reset/device-loss procedure; warn before actions that strand encrypted work. | Planned credential change preserves recoverable pending evidence. Unexpected loss has a documented limitation and support escalation. New credentials work without instructing users to erase possibly unsynchronized storage. |
| G6 — L | Complete a real-device field acceptance trial, not just a narrow desktop viewport test. | Supported low-cost Android phone passes mic/camera/GPS allow/deny, poor-light QR, screen lock, incoming-call interruption, browser reopen, weak data, storage pressure and offline retry. Test real NFC only if advertised. |
| G7 — C | Restore recorded-instruction authoring through current supervisor Settings, or explicitly scope instructions to typed content plus onboarding support. | If the product promises voice instructions for low-literacy guards, a supervisor can publish a recording through ordinary navigation and the guard can play the cached instructions offline. Otherwise labels and sales claims reflect typed-only support. |

**Evidence:** `public/app.js:402` defines a sync bar that is not rendered; queue state exists around `1128–1165`; current-shift history around `2271–2316` provides no equivalent transfer overview. Emergency is rendered around `628` and handled at `1747–1757`. Password-derived storage is implemented in `public/vault.js:32–67`; password changes occur in `server.js:1419–1423`. The new shift editor at `public/shifts.js:19` exposes typed instructions, while playback depends on audio in `public/app.js:678–692`.

**Defer:** AI transcription, additional languages, gamification/promotion scores, chat, native background sync/GPS and emergency broadcast infrastructure. None is necessary to prove recorded attendance and patrol activity.

## 2. Customer-supervisor experience

**Primary objective:** identify the exceptions that need intervention and address them quickly.  
**Secondary objective:** produce a defensible record of attendance, patrol completion and problem handling.

### Highest-priority authorization defect

**Reproduced, high severity:** a supervisor restricted to property A can assign a known supervisor account from property B (within the same customer) to A, then reset that account’s global password. This defeats the property boundary despite direct reads of B being denied. It is not a demonstrated cross-customer breach. Source: `server.js:1496–1513` and `1408–1423`. Cross-property assignments must be owner-controlled, and password/role management must respect the actor’s complete authority over the target account. Hiding the assignment UI or relying on unknown UUIDs does not fix server authorization.

### Confirmed calculation defects

1. **Old open shift counted as today’s attendance.** A guard starts yesterday and never ends. Today’s expected shift returns **1 of 1**, good status, even with no new check-in. The code matches overlap rather than the scheduled shift occurrence.
2. **Past completion changes when checkpoints change.** With the same recorded scans, the KPI returns **1 of 1 completed**; adding a checkpoint to the current list makes it **0 of 1**. Historical expectations must use the route applicable to that patrol.

Both were reproduced with pure functions, without altering the application or database. These are product defects, not merely missing test coverage.

### Outstanding work

| ID / priority | Required change | Minimum acceptance condition |
|---|---|---|
| S0 — L, first fix | Close the cross-property assignment/password-reset escalation. | A property-A supervisor cannot acquire management authority over a property-B account. Test same-customer/different-property and cross-customer cases, including password changes and existing multi-property users. |
| S1 — L | Bind attendance to the correct shift occurrence; surface overdue/unclosed shifts separately. | Yesterday’s open shift cannot satisfy today’s expectation. Legitimate overnight shifts still work. Correcting a stale shift is explicit and audited. |
| S2 — L | Use immutable schedule/route expectations for historical patrol completion and exports. Reconcile denominator rules across dashboard, reports and owner cards. | Changing a checkpoint or roster today does not rewrite yesterday’s result. Named assignments, Any, missed starts, duplicate attempts and midnight boundaries produce consistent, explainable totals. |
| S3 — L | Record expected incident attachments and show incomplete media explicitly. | Block audio upload after event acceptance: supervisor sees “Recording pending” instead of an apparently empty report. Retry attaches the original audio once. Resolution cannot silently treat missing promised evidence as complete; a deliberate exception must be explicit. |
| S4 — L | Distinguish **records missing/unconfirmed** from verified operational exceptions. Agree how supervisors learn about new problems. | Stale capture time remains unconfirmed even if an old record was just uploaded. For the pilot, a documented review cadence plus telephone escalation is sufficient. Proactive closed-app alerting must not be sold unless actually implemented and tested. |
| S5 — L | Provide audited recovery for a lost phone, stale shift and immediate account revocation. | A lost-device guard can be denied server access immediately even with an open shift. Attendance is reconciled separately; the supervisor does not impersonate the guard or falsify the original record. |
| S6 — C | Complete voice-instruction publishing if that is part of guard onboarding; train supervisors on category and P1/P2/P3 definitions. | A representative supervisor can create the real roster and instructions, then resolve/classify a problem without developer help. Priority is a human classification, not inferred criminal intent. |
| S7 — C | For larger report volumes, add compact report paging/search and make attention-row Review open the chosen incident directly. | The clicked report opens immediately; a phone can find an older report without rendering an unbounded list. At a tightly capped pilot volume this can follow the first release, but measure it. |

**Evidence:** `public/supervisor-status.js:75–86` implements overlap attendance; `116–123` compares with the current checkpoints. `public/app.js:1134–1157` posts events before media; incident construction around `1530–1547` omits the expected-media metadata used for messages. `server.js:1068–1082` resolves reports without requiring complete supporting media. `server.js:1418` blocks deactivation while a shift is active. `public/app.js:950–953` routes Review to the list; `106–109` renders all problem rows.

**Defer:** repair/maintenance work orders, multistage assignment workflow, payroll, complex scheduling rules beyond first customers’ needs, chat, AI summaries and enterprise escalation trees. Keep direct problem resolution with comments and category.

## 3. Owner experience

**Primary objective:** confidence that agreed supervision is happening, with a clear indication when evidence is incomplete.  
**Secondary objective:** establish the property/responsible person, inspect evidence when necessary and optionally supervise directly.

The owner does not need a larger dashboard. The owner needs fewer ways to draw the wrong conclusion and a complete path from buying the service to using it.

### Outstanding work

| ID / priority | Required change | Minimum acceptance condition |
|---|---|---|
| O1 — L | Add a controlled first-customer provisioning procedure. Fix the zero-property creation path if self-service is offered. | A brand-new customer receives an individual owner account and first property without demo credentials or ad-hoc SQL. Tenant boundaries are validated. An audited operator command/runbook is sufficient for assisted onboarding. |
| O2 — L | Make owner confidence explicit about current uncertainty and retrospective scope. | Cards are labelled as the last seven completed days/through yesterday. A small current outstanding/unreviewed indicator and “Current activity unconfirmed” state are visible when appropriate. Recent receipt of old data must not imply current coverage. |
| O3 — L | Align metric names with actual evidence; expose unknown/partial coverage. | Either rename patrol coverage to start timeliness or calculate completed-patrol coverage. On-time starts with zero scans cannot imply completed patrols. Any-guard rosters and unknown historical periods do not produce a reassuring staffing score. |
| O4 — L | Keep report classification uncertainty distinct from current danger. | Open/unclassified incidents are visible as requiring review; zero classified security reports does not mean zero security risk. A resolved historical P1 is clearly retrospective. If current risk classification is promised, permit classification before resolution without adding repair management. |
| O5 — L | Provide a small read-only Problems/Activity route in owner mode. | Owner can inspect original audio/photos, reporter, timestamps and resolution without switching to management mode. The three KPI cards can remain nonclickable as requested. |
| O6 — C | Make owner-as-supervisor a persisted, valid responsibility choice. | An owner-only household can finish setup without creating a fake second supervisor; actions retain the real owner’s audit identity. Required if this launch variant is supported. |
| O7 — C | Support assigning an existing supervisor to an additional property, or explicitly restrict the initial offer to one property. | Second property can reuse the same supervisor account without duplicate-contact errors and without cross-customer access. Do not advertise a complete multi-property workflow before this works. |
| O8 — L, operational | Finish the commercial handoff with accurate service/support/payment information. | The owner has agreed service dates, price, invoice/payment instructions and support contact. Hide the unconfigured Subscription screen or show real manual-service information. Automated payments are not required. |

**Evidence:** `public/owner.js:13` offers first-property creation, but `server.js:1365–1382` derives the customer from an existing assigned site; `1356–1357` rejects customer creation. `owner-overview.js:31` only counts supervisor-role users for completed setup. Its freshness result at `22–35` is reduced to last receipt time in `public/owner.js:18`. `owner-health.js:11` excludes today; its patrol calculation uses start events; report classification happens during resolution. `public/owner.js` offers Property/Supervisors/Subscription rather than a read-only evidence route. `public/team.js` supports create/edit but not the existing-member assignment workflow.

### Why the current scores are not yet enough

A local reproduction produces **100% patrol health with zero checkpoint scans**. This is consistent with the current explanatory wording about patrol starts, so it is not a hidden arithmetic error. It is a mismatch if the owner interprets coverage as completed supervision. Likewise, the risk card summarizes classified historical reports; today's unresolved urgent incident does not raise its historical security/P1 percentages. Keep these metrics only with clear meaning and a separate current review cue. They are not calibrated probabilities that a property is secure.

**Defer:** automated subscription billing, payment gateway, geocoding automation/map editor when ISDL assists setup, elaborate score drilldowns, portfolio analytics and AI risk inference.

## 4. Shared release gates

These apply to every role; a role cannot be production-ready while these remain unresolved.

| Gate | Minimum implementation or operational evidence |
|---|---|
| Production separation | Real customers must not enter the publicly documented shared demo tenant. Verify separate production/preview/demo data and media, unique credentials, disabled demo accounts, server-side authorization and least-privilege runtime access. Current cloud configuration needs inspection; documentation is not proof. |
| Guard data minimization | Limit guard reads to assigned work and the explicitly agreed handover summary. Current `/api/state` includes other guards’ unresolved incident text/revisions/history within the site, even though their media is denied. Confirm the intended need and remove excess fields (`server.js:331,351–363`). |
| Access recovery | Supported password recovery, immediate session revocation and controlled stale-shift correction. Preserve recoverable encrypted pending data; explain genuinely unrecoverable device loss. Test same-site, cross-site and cross-customer access, including media after revocation. |
| Evidence integrity | Required-media tracking, chronology checks, exactly-once retries, immutable historical expectations and truthful freshness. Preserve original evidence and correction audit history. |
| Recovery and data lifecycle | Test restoring database **and** private media, not just having a backup option. Define retention, export, customer offboarding, access removal and backup expiry with named operators. Manual procedures are acceptable if tested and repeatable. |
| Support and observability | Named support owner, outage procedure, monitored application/upload failures, quota/cost limits and a capacity check for the intended pilot load. Avoid holding a global write lock during slow external uploads if it blocks other customers’ core actions. |
| Current release evidence | Reconcile tests and docs with shipped scope. A green current critical-path suite, isolated tenant tests and Android field results are required. Old messaging/handover/AI-approval tests are not substitutes; obsolete failing tests must be retired or updated explicitly. |
| Service boundary | Written customer/guard explanation of what is collected, who sees it, support/review expectations and external urgent-contact route. Obtain qualified local review where needed; this audit makes no legal-compliance claim. |

## 5. How far away are we?

This is **a hardening and completion release**, not a new product build. Core guard and supervisor capture/review flows exist. Owner setup and summary screens exist. The remaining engineering concentrates on transfer visibility, chronology and historical calculations, recovery, and provisioning; operations and field acceptance remain equally important.

A preliminary planning allowance is **roughly 4–6 calendar weeks** for one or two engineers with part-time product/QA support, including a one-week field exercise, if scope remains single-property assisted onboarding and the audit does not uncover a deeper synchronization redesign. This is a low-confidence planning range, not a quotation or a claim that a percentage of the app is complete. Re-estimate after reproducing recovery/media faults and agreeing the first customers’ actual rosters.

Recommended sequence:

1. **Authorization and integrity first:** S0–S3, G1–G5. Add regression cases for stale shifts, route edits, chronology, interrupted media and password changes. These are shared foundations for all roles.
2. **Make the first sale operationally complete:** O1–O6 as applicable, manual commercial information, remove emergency placeholder, explicit supervisor review/escalation responsibility.
3. **Prepare the production boundary:** separate real customers from demo, rehearse provisioning/revocation/restore/offboarding, update release suite and runbooks, test intended concurrent upload load.
4. **Run one real roster week:** supported Android phones, day and overnight shifts, deliberate late/missed patrol, offline voice/photo, stale shift, lost-device exercise, supervisor resolution and owner evidence review. Verify every KPI/export against source records.
5. **Approve a capped paid pilot:** named support responsibility and customer acceptance of the exact service boundary. Expand to self-service or multi-property customers only after those additional journeys pass.

### Go/no-go checklist for the first paying customer

- [ ] Fresh customer/owner/property provisioned through the supported path; no demo access.
- [ ] Cross-property assignment/password-reset escalation is denied; two customer accounts cannot access each other’s records or private media.
- [ ] One complete shift works on the actual guard phone, including permissions denied and offline capture.
- [ ] Audio/photo upload interruption remains visible, recovers once and never produces an apparently complete empty report.
- [ ] Yesterday’s unclosed shift does not satisfy today; route edits do not rewrite historical completion.
- [ ] Wrong device time does not create a negative-duration or impossible sequence without an explicit exception.
- [ ] Password reset, lost phone and immediate revocation rehearsed with pending work.
- [ ] Owner sees honest historical/current limits and can inspect evidence in read-only mode.
- [ ] Responsible supervisor and external urgent-contact/review procedure agreed.
- [ ] Database/media restore, retention and offboarding rehearsal completed.
- [ ] Current release tests pass; real Android acceptance record exists.
- [ ] Contract, invoice/payment handling, support contact and service dates established.

**Recommendation:** do not declare guard or supervisor “finished” while focusing only on owner redesign. Freeze optional features and release all three as one trustworthy, deliberately limited service after these gates are met.

## Supporting review notes

- [Product/commercial review](../audit-product-notes.md)
- [Engineering/security review](../audit-engineering-notes.md)
- UX/design findings are incorporated in the role sections above.

No application source was changed, no code was deployed and no hosted customer data was modified during this audit.
