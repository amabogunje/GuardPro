# Guard experience MVP — v0.1.0-guard-mvp

Checkpoint requested on 5 September 2026. Brand: Guard Companion, provided by Integrated Systems and Devices Limited (ISDL).

## Included

- Individual guard sign-in, refresh restoration and protected offline drafts.
- Shift start/end confirmations, duty duration and scheduled end.
- Scheduled patrols, checkpoint QR/NFC capture and manual scan fallback.
- Voice/text reports with optional photos and read-only report history.
- Recorded or typed shift instructions.
- Current-shift supervisor conversations, named replies and unread indicators.
- Owner/supervisor dashboard, tenant-scoped APIs, private media, migrations and demo seed.

Verification: all 26 automated workflow tests passed at this checkpoint. Real Android camera, NFC, microphone, installation and permission behavior still require the device checklist in PILOT.md. AI requires server credentials; unavailable transcription is never simulated as real.

## Local demonstration

Use Node.js 24, run `npm ci`, copy `.env.example` to `.env`, then run `npm start`. Visit http://127.0.0.1:3000. Follow README.md for fictional accounts. Runtime database, uploaded media, local environment files and dependencies are excluded from this release.

## Hosted demonstration boundary

This tag preserves the working local implementation: a single Express process, SQLite and private files on a persistent volume. It is not directly deployable as a durable Vercel Function. Vercel's temporary filesystem must not be used as the database or permanent media store.

A Vercel deployment needs a remote relational database and private object storage, plus tested transaction handling, upload limits, stable media signing credentials and secure cookies. Alternatively, a persistent backend can serve the API behind the Vercel frontend. Do not present an ephemeral or frontend-only deployment as this working MVP.

Reference: https://vercel.com/kb/guide/is-sqlite-supported-in-vercel
