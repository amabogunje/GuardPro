# R-039 — Address lookup evidence, 2026-10-03

## Live provider follow-up

The user supplied a Geoapify key on 2026-10-03. It was saved only as `GEOAPIFY_API_KEY` in ignored `.env.local`, preserving other settings. `git check-ignore .env.local` confirmed exclusion. No secret was printed or added to this evidence.

Executed a Node stdin module with `node --env-file=.env.local --input-type=module`, importing only `geocodeAddress` from `./geocoding.js` and querying **Ikeja City Mall, Lagos, Nigeria**. The live provider returned five candidates. First result: Ikeja City Mall, 174/194 Obafemi Awolowo Way, Lagos 100242, LA, Nigeria; latitude **6.614738**, longitude **3.357877**, approximate=false. This confirms that the supplied key and actual adapter work for this public landmark. Multiple candidates still require user selection in the app.

No database/server was started and no hosted configuration was changed. The original home address has not been supplied/tested. The fixture-based evidence below remains valid; its original missing-key statement is superseded for local configuration only. Hosted activation, physical-device checks and independent review remain outstanding.

Revision: uncommitted working tree based on `3c6762d`, retaining the earlier R-036/R-037 changes. Implementer/reviewer: Codex, self-review only. Status: Ready for verification / Not released.

## Provider and experience

Selected [Geoapify forward geocoding](https://apidocs.geoapify.com/docs/geocoding/forward-geocoding/). It accepts free-form addresses and returns latitude, longitude, formatted matches and confidence information. Its [geocoding service documentation](https://www.geoapify.com/geocoding-api/) permits storing results with attribution; its [pricing page](https://www.geoapify.com/pricing/) permits commercial use of the free plan within quota. Sources checked 2026-10-03. Google was considered, but its [geocoding policies](https://developers.google.com/maps/documentation/geocoding/policies) restrict storage and require Google Maps for map display; this integration preserves the existing OpenStreetMap preview and stored property coordinates.

Type a full address including city/country and click Find address. A single building/amenity match with confidence >=0.95 fills coordinates. Multiple or less precise matches require an explicit selection and are labelled approximate. The original typed address is preserved, including unit/gate details. The map stays inside the form; confirmation is reset before saving. GPS remains independent, including its existing precision fallback. Changing the address, coordinates or choosing GPS invalidates outstanding lookup results. A late GPS response cannot overwrite a newer lookup either.

API key stays on the server. The adapter uses only a fixed HTTPS provider endpoint, rejects redirects, validates input/output, limits results to five, applies an eight-second timeout and replaces provider exceptions with safe messages. Provider requests run outside the global mutation transaction. Authenticated lookup requires owner authority; anonymous signup lookup is available only when signup support is configured. Rate limits: 20 searches per owner/anonymous IP per ten minutes; 1,000 total per rolling day per hosted database or local process. See the activation runbook for scope/limitations.

## Tests

Environment: Windows, Node 24.14.1, disposable SQLite, installed Chrome headless, 390px viewport. Provider fetch is replaced only in the isolated test server through `--import tests/fixtures/geocoding-fetch.mjs`; production has no mock-provider switch.

| Command | Result | Evidence |
|---|---|---|
| `$env:GEOCODING_BASELINE='true'; node --test --test-name-pattern='property lookup fills' tests/geocoding.test.js` | Expected failure against untouched HEAD property UI: Find address count 0, expected 1 | baseline-test.txt |
| `node --test tests/geocoding.test.js tests/property-types.test.js` | 9 passed, 0 failed | focused-tests.txt |
| `node --test tests/gps.test.js` | 4 passed, 0 failed | gps-tests.txt |
| `node --check geocoding.js`, `public/address-lookup.js`, `public/property-location.js`, `public/app.js`, `server.js`; `git diff --check` | Passed | Terminal checks |

Coverage: provider encoding/validation, missing key, malformed responses, secret-safe errors, abort timeout, anonymous/owner route behavior, guard denial, concurrent login during slow geocoding, rate limiting, property persistence, mobile signup persistence, approximate/multiple/no matches, failure preservation, address edits during requests, both GPS/lookup race directions, and unchanged GPS permission/fallback/save behavior.

The first integration run passed 8/9: signup had a missing preview container. Browser error diagnostics identified the null element; the container was added, and all focused tests passed on the final code. The intermediate failure is retained in signup-intermediate-failure.txt. The GPS test previously targeted the obsolete button label Property; it now uses Manage Property and retains all original GPS assertions. No tests were removed or skipped.

Screenshot `address-mobile.png` was visually inspected; it uses a map/provider fixture and is **not** evidence of live address accuracy. Agent-browser separately opened the actual local owner property journey with the isolated provider fixture. No actual customer address was sent to Geoapify.

## Activation and outstanding work

The product owner confirmed a new Geoapify account is needed. No account was created, key obtained, payment authorized or hosting environment changed. Follow `docs/PILOT-OPERATIONS-RUNBOOK.md` to create a project and configure server-only `GEOAPIFY_API_KEY`. Test representative actual addresses, especially the reported home address, with owner participation. Do not claim better coverage merely from a better workflow.

No schema migration for geocoding. Earlier password migration 025 is still required before deploying this combined working tree. R-035/R-038 property persistence/provisioning and X7/R-001/R-033 broad-suite failures remain separate; this task did not rerun the already failing full release suite. Physical-device review, live provider coverage, independent review and an authorized deployment remain open.
