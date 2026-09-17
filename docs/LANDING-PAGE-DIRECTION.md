# Guard Patrol landing page

Updated 17 September 2026. The public landing page is served at `/`; the installed operational app is served at the stable `/app` route.

## Team and positioning

The working team comprised an audience strategist/copywriter, a creative director/UX reviewer, a product/technical reviewer, and the lead implementer. The shared recommendation is calm visibility into the work of guards the customer already employs. Audience assumptions should still be validated with customers; this work is not market research.

Target customers: homeowners, owners of residential or small commercial rental properties, and small businesses with small guard teams. Geography informs casting, architecture and currency, but the country name is excluded from public copy.

Lead message: **Keep up with your guards. Even when you’re away.** Supporting questions: who checked in, were rounds recorded, and what needs attention. Guard-friendly voice reports and self-supervision answer practical adoption objections. No fear-based messaging or promises of physical protection.

## Commercial decisions and page flow

The user confirmed Guard Patrol as the brand, the free-tier launch, and permission to show a future paid tier as Coming soon. The existing approved free boundary is one property and five guards/supervisors combined. Paid pricing and capabilities remain unannounced. Start free links to `/app?signup=1`; existing sessions retain their app experience.

Flow: hero and illustrative activity records → three audience contexts → three practical benefits → setup/report/review routine → free and coming-soon plans → practical FAQs → repeated signup action and provider identity.

The existing app root, PWA manifest and app-shell cache are preserved. Public landing integration is additive. Making the landing page the default root needs a separate decision about the installed app's URL and offline behavior.

## Visual direction and asset

Emerald and deep green retain the app's brand. Large plain-language headings, restrained serif emphasis, generous spacing and a single grounded editorial photograph establish an approachable product. Real activity is never implied: sample records are labelled illustrative. No invented customer logos, testimonials, certifications or performance statistics.

Hero generated with the built-in image-generation tool, inspected by the creative director, and delivered as local WebP. Source: `public/landing-assets/property-hero.png`; delivery: `public/landing-assets/property-hero.webp`. The generated people are illustrative, not customers or endorsements.

Final generation prompt:

> Use case: photorealistic-natural. Asset type: website landing page hero photograph, landscape 4:3 composition. Primary request: a natural editorial photograph of a Black West African female property owner/manager about 40 in smart casual olive and cream clothing and an unarmed Black West African male security guard about 35 in a simple navy uniform, respectfully reviewing an ordinary smartphone together by a modest well-maintained Lagos-style low-rise residential compound. Scene/backdrop: rendered walls, dark metal gate, concrete paving, restrained tropical planting, recognizable everyday residential architecture visible. Style: realistic candid photography with natural skin and fabric texture, warm daylight, calm professional mood, medium-wide environmental portrait. Composition: both people clearly visible, smartphone gesture natural, include substantial architecture around them, useful as a landscape website photograph. Constraints: no text, no logos, no weapons, no flags, no security insignia, no luxury mansion, no watermark. Do not depict military or police.

## Publication boundaries

This draft does not close X8, O1, O8 or the release gate. The authoritative remediation plan still requires outstanding operational, independent and real-device evidence. Customer support and approved policy destinations must be resolved before public launch; the page has no fabricated contact or policy links. No app-root replacement, production deployment or commercial activation was performed.
