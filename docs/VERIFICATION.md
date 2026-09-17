# Verification record

> Historical verification record. Some entries describe retired messaging, AI, acknowledgement/assignment, or demo-root flows from earlier revisions. The current pilot scope is defined by `README.md` and `docs/MVP-REMEDIATION-PLAN.md`; do not use historical entries as a claim that those features are enabled today.

Local verification on 5 September 2026, Node 24.14.1 and installed Google Chrome on Windows.

`npm test`: **18 passed, 0 failed** after the report-history update, including the following integrated checks:

| Workflow | Verified evidence |
|---|---|
| Shared-phone API lock | Session cookie without unlocked session proof receives 401 |
| Shift and patrol | Guard starts directly, records a patrol start, visits all four checkpoints and ends; duplicate start/scan rejected |
| Incident and private media | Approved report persists; invalid upload rejected; retried valid upload stored once; separate customer receives 403 |
| Follow-up and summary | Strict reported → acknowledged → assigned → resolved transitions; actor history; notification receipt; deterministic counts and owner-visible approval |
| Offline browser | 390×844 viewport, offline photo submission, reload, sign-out/unlock, failed media upload, reconnect and exactly-once synchronization |
| Voice and dashboards | Denied microphone with text fallback; synthetic microphone hold/release and audio submission; owner mobile layout; supervisor administration and printable QR sheet |
| Material layouts | All role-specific pages at 390, 900 and 1440px widths; no horizontal overflow, unnamed buttons or browser page errors |
| Off-duty home | Taller Start your shift card, Click here, disabled Message supervisor and sign-out; no provider subtitle, duty actions, handover or technical status; direct check-in stays on Home; server rejects off-duty reports, alerts and messages |
| In-app messages | Off-duty message survives offline reload, arrives exactly once, reaches the assigned supervisor inbox, supports acknowledgement and denies cross-customer access |

The API tests use denied/unavailable GPS data successfully. Manual checkpoint entry is exercised. Real hardware camera permission prompts, QR focus, actual location accuracy and phone dialing still require the pilot checklist.

Browser page-error collections were empty in the passing browser tests. Layout checks found no horizontal page overflow at 390px for the guard and owner. Guard, owner and supervisor screenshots were captured and inspected. A final agent-browser check verified the restarted app's login screen and found no reported page errors.

The isolated test database and screenshots are under `data/test-*`, excluded from source control. Test reports and synthetic audio never enter the primary demo database. Paid AI transcription/narrative calls were not made; no secret or external messaging service was configured.

This record is evidence for a local MVP, not a production security certification or real-device acceptance.

The on-duty home test checks that no acknowledgement or instruction screen interrupts check-in, the elapsed clock advances, and old handover/technical panels are absent. Pure timing checks cover daytime and overnight Nigerian schedules, missing schedules and elapsed durations over 24 hours.

Patrol checks cover overnight interval expansion, invalid intervals, owner/supervisor schedule permission boundaries, idempotent patrol-start events, a simulated five-minute reminder, overdue styling, and an offline start that persists through reload and synchronizes. Vibration and phone notifications still require real Android testing, including denied permissions, silent mode and screen lock.

Patrol-page verification: 390px greeting-aligned Home button, shift patrol numbering, no slot picker, resume of unfinished patrols, server rejection of skipped slots or mismatched checkpoints, simulated QR and NDEF text reads automatically saving with capture methods, manual exception dialog, GPS reference permissions and distance review. No real NFC hardware or tags were used.

Report-page checks cover collapsed text entry, removal of the approval checkbox, aligned Home navigation, camera preview and photo capture using a synthetic camera, and a voice-only submission with audio and photo visible to the authorized owner. Original audio is retained and no transcript is fabricated. Physical laptop/Android camera permissions and microphone hardware still need pilot testing.

Recording regression checks now call play() and verify audio currentTime advances for both held and tapped recordings. Playback uses local blob URLs because the CSP deliberately disallows data: media sources; the previous presence-only audio-control assertion missed this bug. The live elapsed timer and single optional typed box are covered. Report capture and server receipt timestamps remain separate from unknown incident time.

Custom confirmation dialogs: checked accepting and cancelling start, end and submit, draft retention on cancellation, typed reports without photos and empty-report rejection. Mobile screenshots verify the styled modal and side-by-side buttons.

Guard report history tests verify collapsed initial state, current-shift filtering, offline pending entries, a read-only detail dialog, preservation of a new draft, server rejection of guard follow-up changes, and idempotent event replay preserving the original report.

Saved-report page verification: automatic audio playback source and visible uploaded image, empty read-only text for voice-only records, saved typed content, reporting timestamp and guard name, and Back to reports preserving the draft. All 18 tests passed after replacing the report dialog.

Recorded shift instructions verified (19-test suite passed; expanded focused test also passed): owner microphone capture and playback, publish, supervisor typed-only update, current shift keeps its starting version, guard audio playback offline, another customer denied media access, expired links denied, typed-only guard view, and denied microphone fallback. Mobile screenshot: recorded-instructions.png in the corresponding data/test-* directory. Real Android microphone quality and locked-screen reminder behavior still require device testing.

Voice/photo supervisor messaging verified: the 19 existing regression cases passed, and the focused messaging case passed after tightening media-readiness checks. Coverage includes optional text and photos, photo-only send disabled, microphone capture and playback, camera capture, offline reload, interrupted upload/retry without duplicate messages, supervisor player/photo rendering, and denial of message/media access to customer owners and other customers. Inbox refreshes now check playback both before starting and after finishing network work. Test fixtures use a full-day patrol schedule rather than depending on the current demo shift hours. Real-phone microphone/camera quality still needs pilot testing.

Two-way shift chat: all 21 automated workflow tests passed. Verified supervisor voice/photo replies, guard receipt/playback, archived shift selection on both roles, read-only archived guard view, same-site second-guard isolation, private reply media, owner denial, stable message retry IDs, and existing offline/acknowledgement workflows. Mobile visual reviewed in two-way-shift-chat.png. Local app remains at http://127.0.0.1:3000/.

Shift-only messaging: all 22 tests pass. Verified disabled off-duty home action, server rejection of missing/null shifts and guard capture times outside the shift, valid on-duty messages uploading after shift end exactly once, two-way replies, archives, media privacy and existing workflows. Mobile disabled state reviewed in guard-home-message.png. No off-duty thread creation or shortcut code remains.

Current-shift-only guard conversations: all 23 tests pass. Verified empty section hidden until the first supervisor message, named sender rendering and You labels, plain unboxed rows on mobile, no guard archive links or historical message API results, and rejection of historical media links after shift end. Supervisor history and valid delayed media uploads remain supported. Reviewed empty-chat-hidden.png and plain-current-chat.png.

Newest-first/unread update: three focused browser workflows passed, covering acknowledgements, empty conversation visibility, newest-first ordering, a two-message unread badge, clearing on open, offline reload persistence, reconnection receipt updates and subsequent new messages. Mobile screenshots reviewed: home-unread-messages.png and newest-messages-first.png.

Session restoration regression: all 26 automated workflow tests passed. Added guard/owner/supervisor reload, restored page and offline photo/text draft, explicit sign-out, expired restoration, revoked server session, and sibling-tab sign-out coverage. The running local server was also checked with agent-browser.

Neon/Vercel adaptation: all 26 existing workflows passed locally, plus the new concurrent-retry case. Against real Neon/Blob, 25 existing workflows passed in the isolated full run; the patrol layout check passed on a focused rerun after measuring both animated controls in one frame. The new concurrency case also passed against Neon, including six simultaneous logins, one report/attachment for repeated submissions, and one active shift for competing starts. Runtime-role checks denied access outside guardpro and denied schema changes. Synthetic fixtures were used, with no live AI calls.

Hosted verification on 5 September 2026: `scripts/smoke-hosted.mjs` passed against https://guardpro-nine.vercel.app. Confirmed secure-cookie login, unauthenticated API denial, exactly-once report submission, invalid media followed by successful retry, byte-identical private PNG/WAV playback, denial to another customer, acknowledgement/assignment/resolution, source-matched summary approval and shift end. Browser verification confirmed sign-in and session restoration on refresh. A clearly labeled resolved synthetic verification report remains in the demo records. No real microphone input or AI service was used in hosted checks.

## Customer supervisor mobile redesign

Supervisors now belong to the customer. Owners create and assign supervisors; supervisors create and assign guards. Cross-customer assignment and role escalation are rejected server-side. Customer creation is removed from the supervisor workspace.

Verification: the 27 existing workflows passed in the regression run; the two new supervisor tests passed on a separate isolated local server (port 3104). The separate server keeps test sign-ins from exhausting the unchanged 40-attempt login limit. `npm test` discovers both test files. Supervisor navigation, instructions, incidents, patrol settings, summaries and team management were checked at 360px and 1440px with no horizontal overflow or browser page errors. QR printing and existing owner/guard workflows also passed. The running local app was visually inspected. These changes have not been deployed to the hosted demo.

Supervisor semantic colors: navigation/photo choices share pale blue, ordinary dashboard cards are neutral, unacknowledged reports and recorded end-of-shift patrol exceptions are pale red, and outstanding acknowledgements/missing uploads are amber. Patrol totals compare distinct completed scheduled slots against slots due so far in the selected UTC reporting day (schedule times remain Nigerian local time). Attendance uses each guard's latest daily shift plan for the current view, including overnight plans; historical dates show recorded check-ins. Missing records remain unconfirmed: a site-wide last upload does not prove every phone synchronized. No maintenance deadlines or repair tracking were added. Supervisor browser/layout, hierarchy and deterministic status-calculation tests pass.

## Date-scoped supervisor Home

Quick actions are fixed above the overview. The overview date picker defaults to today in Africa/Lagos and provides a Today shortcut. Shift selection, KPIs, attendance and missing-record checks follow that selected day/window. Unresolved problems and unread messages captured before the selected shift are shown as carried over; later records are excluded. The Messages badge counts all unread incoming messages for the selected site, independently of the date filter, matching the guard badge appearance. Home no longer marks unopened supervisor messages delivered/read; opening a conversation writes the same persisted read receipt used by guards. Foreground Home refreshes while respecting open pickers.

Historical shift plans use retained versions created by the selected date. Historical patrol expectations use saved shift-start snapshots. Where an old roster or patrol snapshot was never saved, the UI labels it unavailable instead of applying today's configuration retrospectively. Report status remains its current recorded status, rather than a reconstruction of its status at a past instant. Tests cover calendar/Today navigation, shift selection, unread badge clearing, prior plan selection, carry-over exclusion of future records, and mobile layout.
