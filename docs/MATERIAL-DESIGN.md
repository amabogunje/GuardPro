# Material 3 Expressive redesign

All screens use a shared Material 3 Expressive presentation, adapted to ISDL's guard-supervision service. Guidance checked against Google's current Material documentation on 5 September 2026:

- [Material 3 and M3 Expressive](https://m3.material.io/)
- [Adaptive layout patterns](https://m3.material.io/foundations/layout/canonical-examples/overview)
- [Interaction states](https://m3.material.io/foundations/interaction/states/overview)

## Application

`public/style.css` defines semantic primary, container, surface, outline and status colors. Emerald remains the brand action color; tonal green surfaces group related content, and amber indicates pending attention. A consistent type scale, generous spacing, rounded cards, filled primary actions and outlined secondary actions apply to login, shifts, rounds, reporting, instructions, owner/supervisor dashboards, incident follow-up, summaries, administration and print sheets.

Dashboard navigation adapts from a labeled side drawer to a compact rail and then a bottom navigation bar. The guard keeps large labeled actions and a focused single-column experience. Different shapes and tonal containers distinguish guard actions without introducing charts or maps. The sign-in screen uses a spacious two-column layout on desktop and one column on phones.

`public/material.js` supplies local scalable SVG icons, accessible text labels, selected navigation semantics and form label associations. Icons supplement text. Controls have visible focus/pressed/disabled states and touch targets of at least 48px. Motion is short and disabled when reduced motion is requested. Typography uses locally available Roboto or the operating-system fallback; no remote font request is required.

This is an implementation of Material design principles in the existing plain-web stack, not a claim that the app uses Google's Android-only Expressive component implementation. There are no new paid dependencies or runtime network assets. The existing backend, authorization and encrypted offline workflow remain in place. The service-worker cache includes the new presentation module.

## Verification

`npm test`: **7 passed, 0 failed** after this redesign. The added Material layout test visits all role-specific pages at 390, 900 and 1440px widths and checks page overflow, accessible button names and browser errors. Screenshots are written to `data/test-*/material-*.png`. Existing shift, incident, media, tenant-isolation, voice and offline-retry tests also pass.

The design still requires real Android evaluation with actual guards, larger system fonts and outdoor lighting; see the existing pilot checklist.
