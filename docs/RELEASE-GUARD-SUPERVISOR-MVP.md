# Guard and supervisor MVP

Release tag: `v0.3.0-guard-supervisor-mvp`.

This release includes the mobile guard and customer-supervisor journeys, compact Problems and activity Reports pages, Shifts/Checkpoints/Users settings, email or phone sign-in, private profile photos, QR printing and NFC setup, versioned shift assignments, and owner-confirmed property location with supervisor GPS exception review. Messaging is disabled for the MVP. The guard Emergency button is an explicitly unimplemented placeholder.

Deploy using the existing GuardPro Vercel project, Neon database and private Blob store. Run additive migrations 010–013 and grant the existing runtime role access to their tables before publishing. Do not reseed or copy the local SQLite demo into the hosted database. Environment files and local media remain excluded from Git and deployment uploads.

`npm run test:release` runs the current MVP checks. Four legacy messaging UI tests are excluded because they still target the removed conversation interface: voice supervisor messages, two-way shift chat, empty current conversation, and newest-message ordering. They remain in `npm test` for future reconciliation before messaging is re-enabled. The release suite includes a dedicated test that messaging is hidden and new-message requests are rejected.

The hosted demo remains fictional and shared. Real Android camera, microphone, NFC, GPS and offline interruption testing remains necessary before operational use. The owner enters the full address and confirms map coordinates; automatic geocoding is not included. No production-readiness claim is made.
