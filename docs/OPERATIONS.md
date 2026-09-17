# Operations and cost assumptions

## Data handling

The pilot records identities/assignments, on-duty location samples and accuracy, device capture/server receipt timestamps, site instructions, audio, photos, reports and follow-up history. Inform guards and customers about those specific collections and intended recipients before use. Photos may contain personal information and metadata. Decide whether to strip EXIF before a deployment; the current app preserves uploaded originals.

Uploads accept JPEG/PNG and common browser audio formats, validate MIME plus basic magic bytes, and have a 4 MB file limit, six attachments per incident and 1 GB media quota per site. Record submission is capped at 1,000 events/guard/day. AI transcription is capped at 20 requests/guard/hour in one running process. These are basic pilot controls, not malware analysis, distributed abuse protection or a guaranteed spending cap. Set API-project spending limits and monitor provider usage separately.

Use OS volume encryption and restricted file permissions for the server data directory; server media is private by authorization but not individually encrypted at rest by this app. Use secure cookies behind HTTPS, a tested reverse proxy configuration, persistent disk and a single server process. The default Origin check is intentionally same-origin. A proxy configuration must preserve the expected origin/protocol or be explicitly adjusted and tested. Do not bypass it blindly.

## Retention and recovery decisions before pilot

The accepted free-pilot retention period is **one year**. No automatic deletion runs in this MVP. Define separate treatment of unresolved cases, media, summaries and audit evidence; decide who can authorize export/deletion, how backups expire and how deletion is verified. Do not infer Nigerian legal compliance from the presence of encryption or a retention proposal.

Production uses Neon Postgres and private Vercel Blob storage, so a usable recovery rehearsal must restore both a database backup and its matching private media inventory into separate non-production resources. A database-only restore loses supporting files. For a local SQLite demonstration, copy the database consistently with its WAL and private media directory. Encrypt backups, restrict access and test restoring both data and media.

On device loss: disable the user to revoke server sessions and assignments, record the action, notify the responsible customer, and use the device's existing management/remote-wipe facility if available. This app cannot remotely erase an offline browser. Unsynchronized work may be unrecoverable. On password loss: do not reset or clear storage until the old vault's pending work has been addressed.

On customer offboarding: export the agreed records/media, obtain confirmation, remove assignments and sessions, disable access, then delete the customer's dependent rows and private files in a reviewed operator procedure consistent with the agreed retention policy. Remove retained copies from managed devices and expire backups. There is deliberately no one-click destructive offboarding feature in this pilot. See [the pilot operations runbook](PILOT-OPERATIONS-RUNBOOK.md) for the executable checklist.

## Cost model

Local demonstration uses the existing computer and no external messaging or AI, so it introduces no hosting/API bill. Electricity, mobile data, staff time and existing hardware still have costs.

For an illustrative 10-site hosted pilot, assume 2 one-minute audio incidents per site per day and a 30-day month: **600 transcription minutes/month**. At an illustrative $0.006/minute, transcription would be **$3.60/month**. Substitute the actual chosen model's current rate; rates and availability are not fixed by this project. Narrative cost is `(input tokens × input rate + output tokens × output rate) / 1,000,000`, covering incident drafts, retries and daily summaries. See [official current API pricing](https://developers.openai.com/api/docs/pricing).

For capacity planning, assume one 2 MB photo plus 1 MB of audio per incident. That is about **1.8 GB/month for 10 sites**, before replication/backups, overhead and repeated views. Ninety days of this usage is approximately 5.4 GB of original media. The 1 GB/site cap will eventually stop attachments unless an operator applies an agreed retention policy or increases capacity.

A **planning allowance**, not a vendor quote: $10–25/month for a small persistent server and backups, plus measured AI use and bandwidth. Allowing $1–5 for narrative usage and contingency gives roughly **$15–35/month in infrastructure for this illustrative pilot**, before any paid external messaging. Reprice from an actual provider quote before committing. No subscription price or customer setup fee has been invented, and billing is not built.

Potentially expensive variables: long recordings, frequent AI retries, large photos, indefinite retention, media downloads/egress, backup copies, external SMS/WhatsApp charges, customer support, supervisor staffing, phones, replacement devices, SIM data, connectivity/power resilience and security operations. Staff response time may dominate the infrastructure cost. Currency conversion, taxes and Nigerian telecom pricing are excluded; use actual procurement quotes.
