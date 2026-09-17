# Real Android pilot checklist

Use a small supervised trial. Explain that this service helps supervise employed guards and does not promise emergency monitoring, in-app urgent help, or police dispatch.

- Configure individual credentials and owners/site assignments. The pilot does not expose an in-app supervisor telephone action.
- Use HTTPS or Chrome USB port forwarding to the computer's localhost. A plain LAN HTTP address does not provide the secure context required for microphone, camera, location, service workers or installation. Do not expose the app publicly just to test it.
- Install through Chrome's app/install menu if available. Confirm home-screen launch and offline app-shell loading. The manifest supplies 192px and 512px PNG icons; check device-specific launcher requirements before wider distribution.
- At 360–390px widths and large system font settings, have Bala's real-world counterpart start a shift, acknowledge a handover, find all four actions, and end the shift without coaching. Review literacy and icon comprehension.
- Test front/back camera choice, printed QR under poor lighting, damaged labels, denied camera permission and typed-code fallback. BarcodeDetector availability varies; a bundled scanner library could be added later.
- Test microphone allow/deny, hold/release, short and 90-second recordings, calls interrupting recording, playback volume, noise, battery saver and screen lock. Test JPEG/PNG library photos; HEIC must be converted first.
- Verify location allow/deny, indoor/no-fix, inaccurate fix and disabled location services. Compare capture and server receipt times. No continuous location should be collected.
- With airplane mode enabled, capture audio/photo, save, reload, unlock and sign out. Another account must not see decrypted records. Reconnect and retry twice; exactly one server record should exist.
- Interrupt the photo upload, close/reopen the app, and retry. Confirm the report remains visible while the attachment is pending, then becomes playable/viewable after synchronization.
- Test nearly full storage, browser eviction warning behavior and session expiration. Do not clear app/browser storage until all work is synchronized. Record device/browser versions.
- Confirm that no in-app emergency alarm or urgent telephone action is shown. Follow the site's existing emergency procedure outside Guard Companion when testing an urgent safety scenario.
- Have the owner inspect the report and original media. Have the supervisor acknowledge, assign and resolve. Check the actor/timestamp timeline and resolution photo.
- Generate a daily summary, open source records, check counts, approve, and inspect it as owner. Submit a delayed record and generate a revised daily summary rather than changing the approved historical snapshot.
- AI transcription is disabled for this pilot. Confirm original recordings remain playable and guard-entered text remains the source of record.
- Perform a backup restore on a spare machine and walk through lost-phone, password-loss, customer offboarding and service-outage procedures.

Keep a signed pilot acceptance record listing actual tested device models, browser versions, remaining defects and operating responsibilities. Native background GPS/transfer, remote wipe and guaranteed delivery are outside this web MVP.
