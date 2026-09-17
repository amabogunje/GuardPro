# Pilot operations runbook

This runbook applies to the free Guard Companion pilot: no more than five customer owners, fewer than 25 guards and supervisors in total, one property per owner, and no live AI transcription. The product owner is the named support and recovery owner.

It is an operating procedure, not a statement of legal compliance or a promise of monitoring, emergency response, availability, or recovery time.

## Daily service check

1. Open `https://<approved-host>/api/health`. It must return `{"status":"ok"}`. It exposes no customer or configuration data and can be monitored by the chosen uptime service.
2. Check the Vercel deployment status and function errors for the production project.
3. Check Neon database availability and the Production Blob store's usage in their provider dashboards.
4. Record any failed check, affected customer, time noticed, action taken and outcome in the support log. Tell an affected customer only what is known; do not say a guard action was delivered or reviewed unless the record proves it.

## Support and outage handling

- **Support/recovery owner:** product owner.
- **Pilot support route:** publish one ISDL-controlled support email or telephone/WhatsApp contact before inviting a customer. Do not represent the app's disabled in-app messaging as support.
- **Initial response target (proposed):** acknowledge a pilot support request within one business day; investigate an outage as soon as the support owner is available. This must be accepted or replaced before launch.
- For a guard safety concern, follow the site's existing emergency procedures. Guard Companion does not dispatch police, provide an in-app emergency alarm, or guarantee monitoring.
- For an upload issue, preserve the browser/app state and retry once connected. Do not clear browser storage, reset credentials, or remove the account until pending work is reconciled or the guard confirms it can be lost.
- For suspected unauthorized access, disable the affected user in the supervisor/owner settings, record the action, and rotate the account password using the recovery procedure. A disabled user is denied server access immediately; an offline browser cannot be remotely wiped.

## Backup and restore rehearsal — X3

Before the first customer invitation, choose and record recovery objectives. Until then, no recovery-time or recovery-point promise may be made.

1. Select a disposable customer and record its site, users, one incident and its private media IDs.
2. Create a restricted, encrypted Neon database backup/export using the provider's supported method. Create an inventory of the corresponding private Blob objects. Keep the backup and inventory outside the application repository.
3. Restore only into a separate non-production schema and a separate private Blob store. Never point a rehearsal at Production resources.
4. Verify: the restored owner can sign in; the incident, timestamps and transition history match; authorized media links work; an unrelated tenant remains inaccessible; and an expired/unauthorized link is denied.
5. Measure the elapsed recovery time and the age of the recovered data. Record the result, backup reference, operator and observed gaps. Destroy the disposable restore according to provider controls when review is complete.

The product owner must accept the measured recovery objectives before X3 can be verified.

## Retention, export and offboarding — X4

- Retain customer operational records, private media, profile photos, instructions and audit records for **one year** from creation unless a documented legal/contractual hold requires longer retention.
- Do not automatically delete data until the owner approves the deletion authority and a tested job exists. A calendar reminder alone is not proof of deletion.
- On a customer export request, authenticate the owner, scope the export to that customer's sites, include a manifest of database records and private media, encrypt the handoff, record the recipient/time, and expire the handoff link.
- On offboarding, first export or obtain the customer's written choice not to export; disable customer users and revoke access; confirm no active shifts/pending uploads need reconciliation; remove the customer data and private media using a reviewed operator procedure; then verify another customer remains unchanged. Expire/remove backup copies according to their retention schedule.
- The product owner must approve who can authorize export and deletion before destructive offboarding is performed.

## Pilot capacity boundary — X9

The application enforces one property and five non-owner users per free customer. The pilot-wide enrollment ceiling is five owners and fewer than 25 guards/supervisors. These are enrollment limits, not throughput claims.

Before wider use, record a repeatable measurement using representative encrypted browser queues and at least one media retry:

- 390px Android-class screen: state synchronization, starting/ending a shift, patrol scan and voice/photo report.
- Supervisor: five open problems, five resolved problems, five team members, one day of patrol activity.
- Owner: seven-day health view and read-only evidence view.
- Record `/api/state` response time, browser render time, encrypted browser storage used, Blob storage used, and any failed/retried upload. State the device, network condition, data counts and revision.

Do not invite another pilot customer or raise user/history limits until the product owner reviews these measurements. If data volume makes a page slow, implement pagination/incremental synchronization before increasing the limit.

## Customer-facing boundary — X8

Before signup is opened to customers, publish and version short onboarding material that explains:

- the service records shift, patrol, report, point-in-time location and supporting media information;
- the pilot provides no in-app urgent-help action; guards follow the site's existing emergency procedure for urgent safety concerns;
- the free tier includes one property and up to five guards/supervisors, with no payment collected during the pilot;
- the service helps supervise guards and does not replace CCTV, access control, emergency response or a security provider's own duties;
- data is retained for one year, how a customer asks for support/export/offboarding, and how the customer is notified of material service changes.

Have the product owner and qualified local adviser approve the wording and record its version before using it with customers. X8 remains open until that review is complete.
