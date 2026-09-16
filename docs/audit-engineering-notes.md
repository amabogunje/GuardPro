# Independent engineering launch review — 16 September 2026

Scope: repository and isolated local API exercises. No hosted customer data was changed; production environment settings were not independently inspected. This is a launch-readiness review, not a security certification.

## Position

The guard and supervisor journeys are functionally substantial, but neither is ready for an unattended paid launch. A small, assisted paid pilot is achievable without adding messaging, AI, automated billing, or a native app. The launch contract should promise recorded supervision evidence, not emergency response, fraud-proof attendance, or verified physical safety.

## Verified strengths

Five coherent API workflows passed: session-proof enforcement; shift/patrol and duplicate checks; incident/media retries and cross-customer media denial; transition/history handling; concurrent retry and active-shift uniqueness. Media uses authenticated private access plus expiring signed links. Database mutations are serialized and committed before success responses. Guard pending work is encrypted per account; persisted retry IDs protect against duplicate uploads. Those are useful foundations.

## Must address before paid operational use

### Shared supervisor / owner authorization: cross-property account takeover

**Reproduced, high severity.** A supervisor assigned only to property A receives 403 for property B settings. Nevertheless, `POST /api/admin` with `kind=assign`, property A and B's supervisor user ID succeeds. The actor can then reset that user's global password through `kind=update_user` at A. The victim retains its B assignment. This is within one customer, not across customers, but defeats the property's scope boundary.

Evidence: `server.js:1496`–1513 checks common customer, not the actor's authority over the source user; `server.js:1408`–1423 updates the global account. Isolated reproduction: `data/audit-security-probe.mjs`.

Minimum: make cross-property supervisor assignments owner-controlled, enforce the actor's complete management scope before password/role changes, and add the denied source-property takeover regression. UUID secrecy is not an authorization control.

### Guard: submissions can appear complete while their only evidence is missing

**Reproduced.** The report event is committed before its attachments. An audio-only report with no uploaded audio is accepted and can be resolved by a supervisor. The incident payload does not store expected attachment IDs/count, unlike messaging. The supervisor detail renders only files already received, with no pending-evidence indicator. This is especially harmful after an interrupted voice upload: the submitted text is just “Voice report — listen to the attached recording.”

Evidence: `public/app.js:1135`–1153 upload ordering; `public/app.js:1532`–1548 event payload; `public/app.js:86` and 104 detail rendering; `server.js:724`–781 incident creation; `server.js:1068` resolution.

Minimum: persist an attachment manifest and explicit incomplete/complete state; show an understandable saved-on-phone/upload-failed indicator and retry action; show evidence still pending to the supervisor and prevent an accidental blank resolution or require explicit acknowledgement. Keep the event-first retry design; do not discard the incident.

### Guard: poisoned synchronization queue and account recovery

**Code-confirmed risk.** A non-403 event failure such as competing shift 409 blocks subsequent queued events (`public/app.js:1157`–1164). Failed shift starts remain in the local active-shift calculation (`public/app.js:289`–306). There is no normal reconciliation path for the guard or supervisor. A password reset changes server credentials but cannot decrypt existing work encrypted with the previous password (`public/vault.js:39`–81; `server.js:1419`). A guard can be unable to log into the existing browser after reset without the old password.

Minimum: distinguish retryable network failures from conflicts, provide safe reconciliation of rejected shifts and dependent records, and test the full forgotten-password + pending-media workflow. If pilot recovery is operator-assisted, ship an audited runbook/tool that preserves pending evidence; do not instruct users to clear storage.

### Supervisor: lost device and abandoned active shift have no safe management path

**Reproduced.** Disabling a guard with an active shift returns 409 (`server.js:1418`). Ending a shift is guard-only (`server.js:399`), so a missing/stolen phone or departed guard leaves the supervisor blocked. Password reset revokes sessions, but runs into the encrypted-vault recovery issue above and is not a clean disable action.

Minimum: allow immediate access/session revocation independently of attendance state; add supervisor exception-close with actor, reason, receipt time, and preservation of the original attendance. Reconcile late offline records rather than silently rejecting/loss.

### Shared analytics: reject or quarantine impossible device chronology

**Reproduced.** A shift end captured one hour before its shift start is accepted and persisted. Scan validation likewise lacks a check against the shift/patrol start capture time. The existing clock warning flags only differences over a day (`server.js:485`); it does not protect ordering. Such data contaminates attendance and coverage scores.

Evidence: `server.js:631`–683; isolated probe prints a stored `ended_at < started_at` shift.

Minimum: validate event chronology, bound future timestamps, and quarantine uncertain device-clock records for review. Continue preserving capture and receipt times. This does not require anti-spoofing or continuous GPS.

### Guard: remove the emergency alarm placeholder from the paid product

The red Emergency action is intentionally nonfunctional (`public/app.js:628`, 1747–1756). It tells users no alert was sent only after being pressed. A paid operational app must not train guards to rely on an unavailable emergency action. Minimum: remove it or replace with a clearly labeled working ordinary contact action; do not build automatic dispatch for MVP.

### Shared operations: separate customer production from the public demo

`public/app.js:251` always renders shared demo credentials. `docs/VERCEL.md:48`–54 states previews and production share the demo schema/storage configuration and lists remaining pilot work. This is evidence of the documented demo deployment, not proof of today's live configuration. Before accepting real customer data: create isolated production data/storage, remove demo access and credentials from that build, isolate previews, verify secure cookies and restricted runtime role, and test a database-plus-media restore. Agree retention/offboarding and a support/recovery owner. Manual invoicing and controlled operator onboarding are adequate for an assisted pilot.

### Shared engineering: external operations hold a global write lock

`database.js:42`–56 uses one advisory lock for all writes across customers. `server.js:69` wraps entire handlers, including Blob uploads (`server.js:924`) and paid AI network calls, in that transaction. Slow external calls therefore stall unrelated check-ins and sign-ins. Minimum for pilot: move external I/O outside the global transaction with staged/idempotent finalization, sensible deadlines, and one concurrency test with delayed storage. Enterprise sharding is unnecessary.

## Scope/privacy decisions requiring explicit acceptance

The guard API returns other guards' unresolved incidents including transcripts, revisions and supervisor history (`server.js:351`–363), although their media is correctly denied. It also returns all site end events (`server.js:331`) for handover. This is not a cross-customer leak, but exceeds the removed guard handover UI. Define what guards legitimately need; return a limited current handover summary rather than all raw historical revisions when unnecessary.

All assigned-site history is fetched through `/api/state` and stored in the vault on every refresh (`server.js:213`–383; `public/app.js:253`–285). This is acceptable only for a deliberately capped pilot with measured latency/storage; paginate or bound history before broadly selling many sites. No need for an infrastructure rewrite first.

GPS, QR and NFC are supporting evidence, not tamper-resistant proof. Browser input and device clocks remain client-supplied. Require real Android acceptance for screen lock/resume, denied permissions, weak GPS, QR/NFC support, phone storage pressure, long offline sessions and reconnect. Do not promise background reminders or automatic response.

## Test interpretation

Passing command: `node --test --test-name-pattern="^(cookie alone|authentication, guard scope|approved report, recoverable|supervisor state machine|concurrent retries)" tests/workflows.test.js` — 5 passed.

An earlier broad test-name filter accidentally omitted a prerequisite fixture, causing the media workflow's undefined-shift failure. That is an invalid selective-run artifact, not an application defect. It also encountered outdated instruction-navigation and legacy messaging browser failures; these require test maintenance/triage, not an unsupported conclusion that current visible messaging is broken (messaging is excluded from MVP).

Production launch should have a coherent release suite for enabled features plus a documented real-device signoff, not rely on historic test totals in documentation. Existing docs contain obsolete desktop/messaging/state-machine expectations.

## Engineering distance estimate

Directional, not a commitment: approximately 8–15 focused engineering days plus real-device and restore acceptance to close these cross-cutting issues for a tightly limited assisted pilot, assuming one experienced engineer and prompt product decisions. This excludes other reviewers' owner onboarding and KPI correctness work and should not be added mechanically where tasks overlap. A minimum pilot can defer in-app messaging, AI processing, autonomous alerts, self-service billing, advanced anti-fraud, enterprise observability and automation of every support procedure.
