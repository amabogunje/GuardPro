# Production-readiness review — 17 September 2026

## Decision

**No-go for public self-service promotion today.** The core Guard, Supervisor, and Owner journeys are materially stronger and the newly deployed landing page is visually polished. However, public entry, onboarding, support, and failure-state controls still have customer-visible contradictions.

A tightly controlled technical or assisted pilot can continue only with the current product boundaries clearly stated. Public advertising, open self-service acquisition, or a claim of production readiness should wait until the P1 findings below and the remaining pilot operating gates are closed.

## Review method

- Independent product/copy review of public flows and source.
- Independent visual/mobile/asset review at a 375–390 px viewport.
- Engineering review of public routes, signup, authentication headers, production state, and release tests.
- Deployed checks of the production landing page, sign-up CTA, and browser console.

The landing page loads cleanly at `/landing.html`; its Start free action opens `/?signup=1`; no browser-console errors were found in that journey. The release test suite was rerun outside the restricted workspace sandbox because the sandbox prevented Node from spawning its child test processes. The unrestricted runner displayed passing cases but did not return a complete final summary to this review session, so it is **not** counted as clean full-suite evidence; capture it again as part of the final independent release gate.

## P1 — resolve before public promotion

### R-002 — production exposes fictional credentials

The production sign-in form pre-fills `bala@demo.isdl` and presents a “Fictional pilot accounts” disclosure, although production data intentionally has no demo users. This creates a failed first-use experience and weakens the claimed separation between demo and production.

- Evidence: `public/app.js` sign-in renderer.
- Fix: render demo accounts and defaults only in an explicit local/demo build mode. Production must present an empty identifier field and the normal Sign in / Create an account path.
- Acceptance: production root exposes no fictional identities, passwords, or prefilled demo login.

### R-003 — urgent telephone route cannot be configured in self-service setup

The guard’s telephone action only appears when the site has a phone contact. Public signup collects the owner and property but not the urgent telephone contact, and the current Settings route has no reachable editor for it. A newly created property can therefore have no working urgent-help path.

- Evidence: guard home in `public/app.js`; self-service form in `public/app.js`; Settings tabs in `public/settings.js`.
- Fix: add a required/explicit setup task for the site’s urgent telephone contact, with a reachable owner/supervisor editor. Do not call the account setup complete until it is configured. Preserve the normal telephone route as the pilot safety mechanism.
- Acceptance: a self-service owner can set the contact, a guard sees a working `tel:` action, and an absent contact is clearly visible as incomplete setup rather than silently omitted.

### X8-PUBLIC — public signup lacks published notice, support contact, and acceptance

The landing page invites visitors to create an account and the signup form collects owner identity, email, property address, and coordinates before presenting a published customer notice or recording agreement. The available notice remains a draft with a placeholder support contact.

- Evidence: `public/landing.html`, `public/app.js`, `docs/PILOT-CUSTOMER-NOTICE-DRAFT.md`.
- Fix: approve and publish a customer notice with a real ISDL support route; link it from the landing and signup pages; record acceptance with a version and timestamp before account creation.
- Acceptance: a prospective owner can see the notice and support route before submitting personal/property data, and the created account retains the accepted version/time.

### R-004 — public route is ambiguous

The new marketing page is live at `/landing.html`, while the public root opens the operational sign-in screen and gives no route back to the landing page. This makes advertising and customer support unnecessarily fragile.

- Fix: make an explicit routing decision: landing page at `/` with the app at a stable `/app` route, or retain a clearly documented public landing URL and link it from sign-in. Update deployment and launch documentation to match.
- Acceptance: the promoted public URL has one intentional landing experience, and existing installed app/bookmarked users have a stable route.

### R-005 — release copy and behavior are not reconciled

The repository documents retired or inconsistent behavior, including historical messaging/AI/incident workflows, an older subscription state, and a patrol metric description that conflicts with the accepted 70% completed coverage / 30% start-timeliness measure. Source also retains visible in-app messaging paths despite the intended MVP decision to remove or hide messaging.

- Evidence: `README.md`, `docs/ARCHITECTURE.md`, `docs/VERIFICATION.md`, `docs/real-android-pilot-checklist.md`, `docs/VERCEL.md`, `public/app.js`.
- Fix: create one release copy source of truth and reconcile public UI, README, architecture, operator runbook, device checklist, and feature flags. Decide whether messaging is disabled for the pilot and remove all public entry points if it is.
- Acceptance: every customer-facing and operator-facing statement matches the deployed build and pilot scope.

## P2 — complete in final polish

| Finding | Required action |
| --- | --- |
| Hero asset can be mistaken for a real customer/property. | Add a brief “Illustrative image” caption; retain the generation/provenance record. Serve the 133 KB WebP and remove the unused 2.1 MB PNG from the public payload if it is not required. |
| A few compact controls fall below the 44×44 px mobile touch-target convention. | Normalize FAQ summaries, pager/text controls, and interactive rows; repeat mobile/device checks. |
| Landing has good semantic structure but no canonical/Open Graph/Twitter metadata. | Add canonical and social metadata after selecting the primary public route. |
| Owner sign-up requires email while team members can use WhatsApp numbers. | Confirm this is an intentional owner-account policy and state it in onboarding/FAQ. |
| Owner risk card is retrospective and classification occurs on resolution. | Keep wording explicit that it is historical; separately surface current unresolved problems. If a current-risk signal is promised, allow triage classification before resolution. |

## Current strengths

- Landing-page visual system, free-tier limits, and emergency-service language are professional and appropriately restrained.
- Landing copy does not promise CCTV replacement, automatic police dispatch, guaranteed monitoring, or an all-clear result.
- CTA-to-signup navigation works; public source carries a restrictive CSP, no-store API/media responses, secure session controls, origin checks, and rate limits.
- Guard and supervisor layouts inspected at mobile width did not horizontally overflow and provide understandable fallbacks for device permissions.
- Private media, customer isolation, idempotent media retry, free-tier limits, and self-service owner creation are implemented foundations.

## Existing release gates still open

These are not superseded by the new landing review:

1. **G6:** complete and record real Android field acceptance: microphone, camera, GPS, QR/NFC where advertised, weak data, interrupted recording, screen lock/reopen, storage pressure, offline retry.
2. **X3–X5:** configure and rehearse operational monitoring, database-plus-media restore, retention/offboarding, and the named ISDL support/recovery process.
3. **X7/R-001:** repeat the full clean independent release suite and preserve its results against the final commit.
4. **X9:** perform the bounded pilot capacity/abuse exercise.
5. Validate known failure states during a roster week: incomplete supporting media, stale/unconfirmed activity, loss/revocation with pending work, and no misleading emergency/delivery claims.

## Recommended launch sequence

1. Close R-002 and R-003.
2. Decide and implement the public/app route structure; publish a real customer notice and support contact with signup acceptance.
3. Reconcile all release copy and remove/disable every public messaging path if messaging remains out of scope.
4. Complete the operating, recovery, capacity, and actual-Android gates above.
5. Run an independent full-suite and deployed smoke test from the final commit, then hold a brief go/no-go review using this report and `docs/MVP-REMEDIATION-PLAN.md`.

## Launch posture after remediation

Once the P1 items and operating gates are evidenced, launch as a bounded **free, one-property, up-to-five non-owner-user pilot**. Continue to state that Guard Companion supervises existing guards; it does not replace CCTV, physical access control, security providers, site emergency procedures, or emergency response.
