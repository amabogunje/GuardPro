# Free-tier beta pilot

This release is for the product owner's friends-and-family beta. Sign up normally at https://getguardpatrol.com/app. There is no invitation code or separate pilot-wide account cap. Each free customer gets one property and up to five guards and supervisors combined. Payments, in-app chat and AI transcription are outside this release.

## First session

1. The owner creates an account and confirms the property address and map position. Enter the address as descriptive information. Use **Use my position** while at the property; confirm the actual map position before saving. Drag the pin or tap the map to refine the position, then confirm and save. You can also pan/zoom and choose Place pin at map centre. Address search is retired. Use **Other** when none of the named property types fits.
2. Choose a supervisor or supervise the property yourself. Set up shifts and checkpoints, then add named guard accounts.
3. Each guard/supervisor chooses a private password at first sign-in and after a manager reset. Owners can reset their team; supervisors can reset their local guards. Password actions are audited. Owner self-recovery uses email.
4. On each actual phone, test sign-in, permissions, a shift, a patrol, a typed/photo/voice report and sign-out. The supervisor confirms the evidence arrived. Use clearly labelled test reports for this exercise.
5. Test one offline report and reload, reconnect and verify exactly one delivered report with its attachments. Do not clear browser storage while work is pending. Recovering older encrypted work requires its old password.
6. Test two users on a shared phone. After sign-out, the next user must not see the previous user's work. Record the model, browser and results in the [device checklist](real-android-pilot-checklist.md).

This beta records activity; it does not provide emergency response or replace the property's existing security procedures. A missing record is not an all-clear. Keep normal procedures in place while evaluating the app.

## Feedback and daily operation

The product owner is the support/recovery operator. Check `/api/health`, Vercel function errors, database availability and private-media usage daily while participants are active. The public customer notice provides the configured support contact. There is no promised support response time or uptime SLA for this beta.

For each problem record: time and timezone, role, phone/browser, steps, expected result, actual result, connectivity and a screenshot if useful. Never include passwords, reset links, API keys or unneeded incident details. Keep outstanding observations in the remediation register with reproducible evidence.

Pause participant use and investigate if data crosses accounts, evidence is lost, sign-in fails broadly, or pending work cannot be reconciled. Preserve local data. The release evidence identifies the previous deployment and pre-release database recovery branch. Database rollback must preserve records received since release; do not blindly restore an old snapshot over new activity.

## Scope of acceptance

Production smoke tests and automated tests establish the tested software flows. Device location accuracy, permission behavior, weak networks, email delivery to participants, and accessibility are measured during the pilot. Database/media recovery, offboarding, capacity evidence and independent review remain tracked gates before broader commercial operation. A pre-release database branch is a recovery point, not a complete media-backup policy.

Review feedback after the first week before expanding recruitment. Add payments only in a separate post-pilot change, with its own billing, authorization and reconciliation checks.
