# Guard Companion — Guard Pro pilot

**Provided by Integrated Systems and Devices Limited — ISDL.**

**Hosted fictional demo:** https://guardpro-nine.vercel.app — use the demo accounts below. Shared demo credentials are displayed on sign-in; use fictional information only. Hosted release: `v0.2.0-vercel-demo`. [Deployment setup and limits](docs/VERCEL.md).

A working guard-supervision MVP for existing guards. It records attendance, patrol activity, approved incident reports, handovers and follow-up. It does not replace CCTV, physical access control or emergency response. All seeded people, properties and events are fictional.

## Run locally

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

Patrols: select a checkpoint, choose QR or NFC, and scan to save automatically. Manual code entry is under Unable to scan. NFC tags must hold the printed checkpoint code as an NDEF text record. Schedule changes apply to new shifts; unfinished patrols resume automatically. Early starts remain enabled for testing. Migration 004 adds optional site location reference settings under Scheduled rounds → Location checks.

Refreshing a signed-in tab restores your account and current page, including offline drafts, for the 12-hour session. Sign in once after this update to enable restoration. Always use Sign out before handing a shared phone to another guard; encrypted pending work is preserved. Browser tab/session recovery behavior varies.

### User identification photos

Settings → Manage your team → Create account accepts an optional JPEG/PNG profile photo (maximum 2 MB). Photos are stored in the existing private media store; only the user or an owner/supervisor sharing an assigned site can retrieve them. They are not publicly cached or included in offline storage. Guards without a photo, or whose photo cannot load, display a default user icon. This is visual identification only, not facial recognition. SQLite migration 009 runs on local startup; run the existing migration command before deploying to PostgreSQL. Include `user_photos` records and their referenced private files in customer offboarding/deletion procedures. Editing/replacing existing users’ photos is not yet exposed in settings.
