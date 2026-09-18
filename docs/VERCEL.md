# Vercel + Neon deployment

GuardPro uses the existing Vercel account and Neon integration, with a dedicated free-tier Neon project (`guardpro-db`) and a dedicated **private** Blob store (`guardpro-media`). Other applications' databases and media stores are untouched. No paid plan was purchased.

## Runtime

- Node.js 24 / Express on Vercel, in `iad1`, close to the Neon database and Blob store.
- `database.js`: asynchronous PostgreSQL queries using a small `pg` pool and Neon's pooled connection. `DATABASE_SCHEMA=guardpro` selects the clean demo schema. SQL parameters remain bound; the adapter explicitly qualifies application tables because Neon's pooler does not accept a startup `search_path` option.
- The `guardpro_app` runtime role has schema usage and SELECT/INSERT/UPDATE/DELETE on GuardPro tables. It cannot alter tables or read the verification schema. Administrator credentials are only needed locally for migrations, not for normal hosted requests. Unused administrator connection variables were removed from Vercel.
- Each mutation uses one database connection and a transaction-scoped advisory lock. This serializes pilot writes across instances, covering duplicate requests, shift uniqueness, quotas and audit history. Responses are sent only after commit. Reads use tenant-scoped queries. This intentionally trades write throughput for a simple pilot; slow Blob/AI requests also hold that lock. Higher traffic warrants per-site locking and separate upload reservations.
- Photos and recordings use private Blob objects. The app authorizes every link and download against the session, site assignment and current-shift rules. It streams private content through authenticated routes, without exposing the store token. Links expire after two minutes; a shared signing secret allows them to work across instances and deployments.
- Files are capped at **4 MB** in the browser and server, below Vercel's request/response limits. Guard recordings stop at 90 seconds. Larger existing offline files remain on the device with a retry error; do not clear their storage. Direct multipart uploads would be a later improvement for larger files.
- Hosted rate counters live in PostgreSQL and count failed login attempts too. Sessions also live in PostgreSQL; HTTPS cookies are Secure, HttpOnly and SameSite=Strict. No background worker or continuously running server is assumed.
- Local SQLite/file storage remains available via `npm start` with no `DATABASE_URL` or Blob token. The original implementation is preserved by tag `v0.1.0-guard-mvp`.

## Environment and migrations

Required hosted variables: `DATABASE_URL` (restricted pooled connection), `DATABASE_SCHEMA=guardpro_pilot`, `BLOB_READ_WRITE_TOKEN` (private store), `MEDIA_SIGNING_SECRET` (32 random bytes or more), `COOKIE_SECURE=true`, and `PILOT_SUPPORT_CONTACT` (an ISDL-managed public support route). AI is disabled for this pilot.

Owner self-service password recovery additionally requires `RESEND_API_KEY` and `RESEND_FROM`, using a sender domain verified in Resend. Set `PASSWORD_RESET_BASE_URL=https://getguardpatrol.com` for Production; use the protected preview URL for Preview if preview reset links are enabled. Until both email variables are configured, the sign-in help screen honestly directs owners to ISDL support and does not say an email was sent.

Keep credentials in Vercel's secret settings. `.env.local`, `.env.runtime`, the data directory and `.vercel` are ignored by Git and deployment uploads. Never paste credentials into chat or commit them.

For a new setup, provision/link Neon and private Blob first, then pull a development environment containing an administrator connection:

```powershell
npm ci
npx vercel link
npx vercel env pull .env.local --yes
# Set DATABASE_SCHEMA and SEED_DEMO=true in the ignored local environment for a NEW demo only.
npm run db:migrate
```

The PostgreSQL migration runs as an explicit administrative operation, not on every request or deployment. Grant the runtime role access to newly added tables in future migrations. Do not use the restricted runtime connection to run DDL. Keep `SEED_DEMO` off for real customer deployments; existing demo passwords are not reset by seeding.

For Preview or Production, do **not** use `vercel env run` for migrations: Vercel protects the administrative connection string and a local fallback can point the command at the wrong schema. Authenticate the Neon CLI, retrieve a direct owner connection for the `guardpro-db` main branch, set the intended `DATABASE_SCHEMA` explicitly, and run `node migrate.js` without `SEED_DEMO`. Confirm the target table exists in that schema before deploying code that depends on it.

For local verification against cloud services, `npm run start:cloud` reads `.env.local`. This workstation also has an ignored `.env.runtime` holding the restricted demo connection, usable with `node --env-file=.env.runtime server.js`. Do not overwrite the migration connection with the restricted role.

```powershell
npm test
npm run test:cloud
npx vercel deploy --yes
# Verify the preview, then promote the tested URL:
npx vercel promote <preview-url> --yes
```

`test:cloud` uses real Neon and Blob, a new `test_<timestamp>` schema, and a separate local server on port 3102. It never resets the clean `guardpro` demo schema. Tests retain their isolated schemas and tiny synthetic media for inspection; periodically remove only identified test artifacts through a reviewed maintenance operation. The adapter remains the same as production. Never point regression tests at real customer data.

## Public routes and deployment boundaries

The public root `/` serves the Guard Patrol landing page. The operational application is at `/app`; installable app manifests also start there. The production sign-in screen does not expose fictional credentials or prefill a demo identity. Local demo credentials remain documented for local development only.

Production (`guardpro_pilot`) and Preview (`guardpro_preview`) use separate clean schemas and private Blob stores. Keep Vercel deployment protection enabled for previews.

There is no browser guarantee of patrol reminders or synchronization while the app is closed. Camera, NFC, microphone permissions, Android install behavior and mobile data interruptions still need the device checklist. AI transcription is unconfigured, not simulated; original recordings and typed reports work.

Before an operational pilot: confirm the Vercel plan permits the intended commercial use, arrange database/media backups and retention, replace demo accounts, validate real phones and review access/abuse controls. Neon recovery does not back up Blob files. No production-readiness or legal-compliance claim is made.

## Operating assumptions

Provisioned Neon is on `free_v3`; Vercel is the existing Hobby team. No fixed operating bill is promised: compute hours, the foreground five-second message polling, database storage, Blob storage/operations/downloads and retention drive usage. Multiple idle open phones still poll. Shared account quotas also cover your other Vercel projects. AI and external messaging have no usage here because neither is enabled. Check provider dashboards before inviting more testers or upgrading; no paid upgrade is automatic in this work.

References: [Neon connection pooling](https://neon.com/docs/connect/connection-pooling), [private Blob](https://vercel.com/docs/vercel-blob/private-storage), [Vercel function limits](https://vercel.com/docs/functions/limitations).
