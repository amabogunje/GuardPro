# Production-readiness reassessment — 17 September 2026

This is a source and documentation review after the public-signup/customer-notice work and the accepted decision to hide the pilot's in-app urgent telephone-contact route. It is not real-device evidence, an independent security certification, or a deployment smoke test.

## Current conclusion

The pilot retains a coherent core: guard capture, supervisor review and owner visibility. The pilot must not be described as an emergency-response, urgent-help, or real-time-monitoring service. The in-app telephone route is now deliberately outside scope; that choice is acceptable only when every public surface says so consistently.

## Findings

### R-006 — public urgent-help copy contradicts the pilot scope

**Priority:** P1

The landing FAQ still says guards should call a configured contact for urgent help (`public/landing.html`). This contradicts D4/R-003 and the current guard interface, which exposes no in-app urgent telephone route.

**Acceptance:** Replace the FAQ with the existing customer-notice boundary: for urgent safety concerns, follow the property's existing emergency procedures; Guard Companion does not provide emergency response. Verify the rendered landing page and notice agree after deployment.

### X8 follow-up — make the ISDL support route usable

**Priority:** P2

The configured pilot support contact appears as plain text in the public customer notice. For a telephone number, it should be a clearly labelled tap-to-call support link. This is ISDL customer support, not a guard emergency route.

**Acceptance:** A mobile customer can tap the published ISDL support number from the notice. The label distinguishes support, export and offboarding from urgent safety help.

### X8 follow-up — finish public acquisition clarity

**Priority:** P2

The landing hero image needs a nearby “Illustrative image” caption. The self-service owner form requires an email address, while team members may use email or WhatsApp number. That may be an intentional account-recovery policy, but public onboarding should state it before users enter information.

**Acceptance:** The image is labelled illustrative. The notice or signup form clearly states the owner account's supported sign-in identifier, or the product policy is changed and tested.

## Ongoing launch gates

- G6 remains blocked: signed real Android evidence for guard, supervisor and owner journeys.
- X3–X5 and X9 remain operational evidence work: restore rehearsal, retention/offboarding, support monitoring and capacity measurement.
- R-002, R-004 and R-005 are local changes awaiting independent production verification and deployment.
- R-003 is Deferred — accepted: no in-app urgent telephone/contact route in the pilot.
