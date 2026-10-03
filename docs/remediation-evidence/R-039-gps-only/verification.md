# R-039 — GPS property setup, 3 October 2026

User explicitly retired address search after inadequate Nigerian residential coverage. Address remains a descriptive property attribute. Signup and property editor use Use my position and retain coordinate/map confirmation; movable pin deferred. Existing addresses/coordinates and manual coordinate entry preserved; no migration.

Removed Geoapify adapter, search UI/styles/fixture and provider configuration example. Both old search endpoints return 410 without invoking a provider, including if a key remains configured. Shared position-preview.js replaces address-lookup.js; service-worker v142 precaches it.

Validation: npm run test:release passed 99/99, zero failed/skipped. The previous six geocoding tests were explicitly replaced with two tests for the revised scope, rather than skipped: retired endpoints plus mobile signup GPS/address independence and persisted values. Existing property-editor test now proves absence of search and preserves GPS coordinates when the address changes; permission-denied and approximate GPS cases still pass. Other API/browser/offline regressions passed. See release-tests.txt.

Release: pending publication at this record. Independent review and physical-device GPS acceptance remain pending. Next: verify live retired endpoint, v142 cache and signup form, then run actual-phone pilot checklist.
