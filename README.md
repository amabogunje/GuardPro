# Guard Companion — Guard Pro pilot

**Provided by Integrated Systems and Devices Limited — ISDL.**

**Hosted fictional demo:** https://guardpro-nine.vercel.app — use the demo accounts below. Shared demo credentials are displayed on sign-in; use fictional information only. Hosted release: `v0.2.0-vercel-demo`. [Deployment setup and limits](docs/VERCEL.md).

A working guard-supervision MVP for existing guards. It records attendance, patrol activity, approved incident reports, handovers and follow-up. It does not replace CCTV, physical access control or emergency response. All seeded people, properties and events are fictional.

## Run locally

In-app messaging is hidden and new message submissions are disabled for MVP by default. Existing message history and encrypted local drafts/queued messages are retained; disabled message uploads are paused without blocking reports or patrols. To evaluate messaging for a future release, set `ENABLE_MESSAGING=true` on the server and restart it. Clients receive this setting at synchronization; an offline device retains its last received configuration until it reconnects. Messaging-specific regression suites explicitly opt in; `tests/messaging-disabled.test.js` checks the MVP configuration.

Requires **Node.js 24** and npm. SQLite is included with Node; no database service or Docker is needed.

```powershell
npm ci
Copy-Item .env.example .env
npm start
```

Open **http://127.0.0.1:3000**. Use that same address consistently: `localhost` and `127.0.0.1` have separate cookies and offline storage. The server binds only to this computer by default. Hosted setup is documented in [Vercel deployment](docs/VERCEL.md).

SQLite schema migrations in `migrations/001.sql` through `008.sql` run idempotently on startup. A new database is seeded automatically. The data directory contains `guard.db`, its SQLite WAL files, and private `media/`. Keep this directory out of a public web root and out of source control. For a fresh demo without deleting anything, set `DATA_DIR=./data/fresh-demo` in `.env` and restart. Choose a new browser profile too if you want a fresh offline vault.

| Account | Role | Assigned property |
|---|---|---|
| `bala@demo.isdl` | Guard | Oak House, Ikeja |
| `owner@demo.isdl` | Customer owner | Oak House, Ikeja |
| `supervisor@demo.isdl` | Customer supervisor | Oak House, Ikeja |
| `other@demo.isdl` | Separate customer | Palm Court |

All demo accounts initially use **`Pilot-only-2026!`**. `DEMO_PASSWORD` only changes the initial seed, not existing passwords. These public demo credentials must be replaced for any private pilot. The seeded telephone number is deliberately non-operational; configure the actual escalation contact in Site management.

## Ten-minute demonstration

1. Sign in as Bala. The off-duty home shows a taller **Start your shift** card, **Off duty**, and **Click here**. **Message supervisor** is disabled until check-in. All in-app conversations belong to a shift; use your usual external contact method before work. Click here asks for confirmation, starts the shift and keeps you on Home. The on-duty card shows the start date/time, running elapsed timer and scheduled end in Nigerian local time. Instructions remain available through Hear instructions; there is no acknowledgement or instruction step during check-in. Bala’s fictional demo schedule is 06:00–18:00 and can be changed in Site management.
2. Open **Start patrol**. The next scheduled patrol is selected automatically. Select a checkpoint and scan its QR/NFC label, or use **Unable to scan?** and enter `OAK-1` through `OAK-4`. Scanning saves automatically. Return Home when the patrol is complete.
3. Open **Report a problem**. Tap **Press to start**, then **Tap to stop**; play the recording back and optionally add photos or typed text. Select **Submit** and confirm. Audio-only reports work without an AI key; no transcript is fabricated. Event times are only extracted when supplied; the report timestamp is saved separately. Each attachment is limited to 4 MB.
4. In another browser profile, sign in as owner. Open **Incidents** to see the submitted report and its private original media. Submission time and event time remain separate.
5. Sign in as supervisor. Open Incidents. Acknowledge the new issue, assign a responsible person and next action, then resolve with a note and optional photo. Each transition preserves actor and timestamp. Acknowledgement alone never resolves the incident.
6. Open **Daily reports**, generate a draft, inspect counts/source records, edit the narrative and approve. The owner sees only approved summaries. Download source records as JSON.
7. Site management creates customers, additional properties, individual accounts, assignments, daily shift plans, checkpoints, round times, approved instructions and escalation contacts. Print the QR checkpoint sheet from this screen.
8. End Bala’s shift and enter handover notes.

## Offline demonstration

Sign in once while online and wait for the app shell to cache. Disconnect using browser DevTools Network → Offline. Capture a patrol or incident, optionally with audio/photo, then submit locally. Reload: the signed-in tab and saved work return. Sign out and back in: pending records survive. Reconnect with the app open to synchronize automatically. Repeated retries must still create one record.

For an interrupted media upload, block `/api/media/**` in a browser testing tool, submit a photo report, then unblock and retry. The incident stays submitted while the attachment remains failed/pending locally. The automated browser suite performs this scenario.

There is **no dependency on background browser execution**. The foreground app retries on reconnect, reopening/unlocking, visibility changes, the retry button and a 30-second foreground home-screen timer. Keep the app open until synchronized. If the 12-hour session expires, sign out and sign in online with the same password to renew access; encrypted pending work remains. Conflicting records from two devices or newly added handover requirements may need supervisor reconciliation; no record is silently discarded.

## Optional real AI

Set `OPENAI_API_KEY` in your local `.env` or deployment secret manager; **never paste it into chat or put it in `public/`**. Restart the server. `TRANSCRIPTION_MODEL` defaults to `whisper-1`; `REPORT_MODEL` defaults to `gpt-4o-mini`. Both are configurable and require access on the configured API project.

`ai.js` is the replaceable server-only adapter. It performs real transcription, extracts supplied observations/actions/persons/follow-up and uncertain event time, and asks for missing essentials. It also drafts daily narratives using database counts and approved reports. The guard must approve incident text; a supervisor must approve summaries. No image inference is used. API output is untrusted and is rendered as escaped text.

Without credentials, audio is still recorded, retained and playable, but **no transcript is invented**. Incident text is guard-entered. Summary narratives use a clearly described deterministic template. The real API code is implemented but paid requests were not executed during verification. See [official transcription documentation](https://developers.openai.com/api/docs/guides/speech-to-text) and [current API pricing](https://developers.openai.com/api/docs/pricing).

## Tests

```powershell
npm test
```

Tests launch an isolated server on port 3101 and create a separate `data/test-*` database. Browser tests use installed Chrome at `C:/Program Files/Google/Chrome/Application/chrome.exe`; override `CHROME_PATH` for another machine. For Linux, for example, set `CHROME_PATH=/usr/bin/google-chrome`. The production app on port 3000 is not modified by these tests.

Coverage includes authentication, cookie-only access denial, customer/site/media isolation, duplicate active shifts, complete patrol counts, report approval, invalid media then successful retry, exactly-once events/attachments, incident transitions, notification receipt, summary approval/source counts, a 390×844 viewport, encrypted offline reload/sign-out/reconnection, interrupted media, microphone denial and synthetic audio capture. Browser screenshots are stored in the isolated test directory. Synthetic microphone audio is a test fixture, not a real guard recording or AI transcript.

See [architecture and limitations](docs/ARCHITECTURE.md), [pilot checklist](docs/PILOT.md), and [operating assumptions](docs/OPERATIONS.md).

Patrol scheduling: owners and supervisors can open **Overview → Scheduled rounds → Edit patrol schedule**, choose specific times or a repeating window (for example every 15 minutes), then save. Times are Nigerian local time. The guard sees the countdown on Start patrol. Foreground reminders are handled by the app; mobile browsers do not guarantee reminders while closed.

Patrols: select a checkpoint, choose QR or NFC, and scan to save automatically. Manual code entry is under Unable to scan. NFC tags must hold the printed checkpoint code as an NDEF text record. Schedule changes apply to new shifts; unfinished patrols resume automatically. Early starts remain enabled for testing. Property location configuration is owner-only under Site management.

Refreshing a signed-in tab restores your account and current page, including offline drafts, for the 12-hour session. Sign in once after this update to enable restoration. Always use Sign out before handing a shared phone to another guard; encrypted pending work is preserved. Browser tab/session recovery behavior varies.

### User identification photos

Settings → Team accepts an optional JPEG/PNG profile photo (maximum 2 MB) when creating or editing a member. Photos are stored in the existing private media store; only the user or an owner/supervisor sharing an assigned site can retrieve them. They are not publicly cached or included in offline storage. Guards without a photo, or whose photo cannot load, display a default user icon. This is visual identification only, not facial recognition. Include `user_photos` records and their referenced private files in customer offboarding/deletion procedures, including superseded photo files.

### Supervisor settings (current MVP)

**Team** follows the checkpoint list pattern: five members per page, search for longer lists, profile thumbnail/default icon, and a focused add/edit screen. Email is optional when a WhatsApp number is provided; at least one is required. Nigerian `08012345678` is normalized to `+2348012345678`; international numbers require the country code. A number can belong to only one account. Sign in with email or number plus the password—this does not verify WhatsApp ownership, send messages, or use WhatsApp OTP. Confirm contact ownership during onboarding and keep passwords private.

Migration **012** adds private `user_contacts` records and an immutable encrypted-vault account key. Existing users keep their original vault key; alternate email/phone identifiers map to the same vault after online authentication. Sign in online once with each identifier before using it to unlock offline. Phone-only accounts use an internal database email placeholder, never displayed or accepted as an email sign-in. Include the new table in PostgreSQL runtime grants and offboarding. Changing a password still requires recovering pending work encrypted with the old password first.

Checkpoint printing opens an in-page preview with either all active labels or the selected checkpoint, followed by an explicit Print action. Chrome/Edge can print or save as PDF; embedded browsers may not expose a system print dialog. Checkpoint codes remain auto-generated and immutable so existing QR/NFC labels stay valid. Delete checkpoint uses a confirmation and retires the checkpoint from new patrols and label sheets; historical records and existing shift snapshots retain it. Migration **011** adds `retired_checkpoints` (include it in PostgreSQL migration/runtime grants before deployment).

Assigned guards supports **Any**, mutually exclusive with named guards. This permits any active guard assigned to the property to use that shift, including guards added later. Actual check-ins retain their guard identity. For Any, attendance totals come from distinct guards who check in: two arrivals display **2 of 2**, and no arrivals display **0 of 0**. Named assignments retain their planned total: one arrival against two assignments displays **1 of 2**. Activity reports use the same attendance targets; check-outs still require recorded shift ends, and their expected count becomes due at shift end. The versioned `guard_ids` JSON stores `["*"]` for Any; it never expands to all property guards as expected attendees. Patrol times accept either `0900, 1500, 1800` or colon-separated times and are stored as `09:00,15:00,18:00`.

Settings opens on **Shifts**, with **Checkpoints** and **Team** beside it. The tabs keep the same header and mobile width.

- **Shifts:** create or edit daily shift windows, assign guards, enter comma-separated patrol times, and add shift-specific typed instructions. Shared voice/typed instructions are under “Instructions for all shifts”. Equal start/end times mean 24 hours; a property without configured shifts has a default 24-hour shift. Existing legacy shift windows are retained. Patrol times must fall within their shift, and a guard cannot be assigned to overlapping shifts. Save shifts to publish assignments and patrol times together. Saved versions are retained, and active guard shift records keep their starting instruction/schedule snapshot. Shared recording plus additional typed instructions are supported; separate voice recordings per individual shift are not yet available.
- **Checkpoints:** create or rename a checkpoint, print its QR label, or write its code as an NDEF text record to an NFC tag on a compatible phone/browser. Other devices show instructions for a tag-writing app. QR and NFC use the same stable checkpoint code. Test physical tag writing and guard scanning on Android over HTTPS before a pilot.
- **Team:** supervisors and owners can create, edit, or deactivate assigned guards and supervisors. Owner accounts cannot be edited here. Deactivation revokes sessions, removes future shift assignments, and retains historical records. An active guard shift must end first. Reactivation does not automatically restore removed shift assignments. Recover unsynchronized guard work before deactivation or password changes; a password change does not re-encrypt existing offline records on another device.

SQLite migration **010** runs on local startup. For PostgreSQL, run the existing migration command before deploying; it creates `shift_templates` and `disabled_users`. Where migration and runtime database roles differ, grant the runtime role access to these new tables just as for existing application tables. No hosted migration or deployment is performed by editing these settings locally.

Targeted verification: `node --test tests/settings.test.js tests/supervisor.test.js tests/activity-reports.test.js tests/messaging-disabled.test.js`. These use isolated local databases; browser tests cover 360px and desktop widths, tab selection, checkpoint editing, NFC fallback, and unchanged header placement.

### Owner mobile experience

The owner home now shows **Guard coverage health**, **Patrol coverage health** and **Report risk signal**. The cards are display-only for MVP. The period is the last seven completed Nigerian calendar days; only finished shift occurrences with historical schedules are measured. Unknown roster days and Any-guard attendance without a required headcount are excluded, not scored as perfect. Health is `100 × (on-time + 0.5 × late) / expected`, rounded to a whole percent, with a five-minute late allowance. A missed record means no matching start has been received; it does not prove absence. Patrol health measures scheduled starts, not checkpoint completion. Delayed uploads can revise results.

Report security and P1 percentages use **all reports filed in the period** as the denominator. Unclassified reports remain explicit. P1 is high priority, P2 medium and P3 low; Elevated means at least one classified P1 in the period. The outstanding count includes unresolved carryovers, even outside the period. This describes reported issues, not a guarantee about property safety.

Resolving a problem now requires **Security**, **Maintenance** or **Other**. Security additionally requires P1/P2/P3. Migration **014** adds `incident_classifications`, with server validation, database constraints and the resolving actor/time. Existing resolved reports remain unclassified; no category is inferred. Grant the hosted runtime role access to this table before deploying. Migration 014 is included in the owner KPI release; the deployment requires this additive table and runtime grants. `tests/owner-health.test.js` verifies weights, historical expectations, unknown data and report denominators.

The owner has a narrow mobile layout at every screen size. **Property**, **Supervisors** and **Subscription** are the three main actions. The owner-only `/api/owner-overview/:site` endpoint supplies the health cards and freshness of received evidence. Old uploads do not imply current activity. Any-guard rosters have no invented headcount target.

Use **Property** to confirm an address/map position or add another property. Use **Supervisors** to create an assigned supervisor with email or phone sign-in. **Act as supervisor** opens the existing operational view; **Return to owner view** restores the owner overview. This preference survives refresh in the encrypted account vault. It never changes the authenticated role or impersonates another user. Owner resolutions retain the owner's actor ID and role in the audit history. Owner-mode problem details are read-only; switch views to act.

**Subscription** is an honest unconfigured screen. There are no prices, active subscription claims, invoices, checkout or payment processing. Service terms and a payment-provider integration are still required before payments can be managed. The existing MVP boundary remains in force.

Verification: `node --test tests/owner-overview.test.js tests/owner-ui.test.js`. Tests cover tenant permissions, actual-versus-expected coverage, stale data, owner attribution, property/supervisor creation, evidence access, mobile/desktop width and view switching. No deployment is performed by these changes.

### Property setup details

Owners configure **Site management → Property address & location**: full address, confirmed coordinates, and allowed radius (20–5000 metres). New properties require these fields. OpenStreetMap lookup opens the address search; the owner manually confirms the map position and enters coordinates, or uses their position while physically at the property. Automatic address geocoding is not implemented. No real Oak House address is guessed or seeded. Guards and supervisors cannot change these fields; server permissions enforce this.

New shift starts and checkpoint scans receive a server assessment using the property reference effective at device capture time. A position outside the radius plus GPS accuracy is flagged; unavailable GPS, accuracy worse than 100 metres, or an unconfigured property is **unconfirmed**, not proof of absence. Original coordinates, accuracy, capture/receipt times and reference snapshot are retained. Older records are not backfilled, and later property edits do not rewrite assessments.

Supervisors see pending location exceptions grouped per guard shift in **Needs your attention**, separate from the Problems KPI. Review shows the evidence and map links, accepts an optional comment, and records **Mark reviewed** with actor and time. Later exceptions require another review. Review history remains accessible; marking reviewed neither changes the recorded GPS nor resolves a reported problem.

Migration **013** adds `property_locations` and `location_reviews`; include them in hosted runtime grants, retention and customer offboarding. No hosted migration has been run for this feature. Test with `node --test tests/gps.test.js`. Browser verification uses a map fixture, not a live geocoding service. Before a pilot, confirm the actual address/radius on site and test Android GPS accuracy, denied permissions, offline capture and delayed upload over HTTPS. These checks use individual on-duty events, not continuous tracking, and cannot establish misconduct or prove a property is secure.
