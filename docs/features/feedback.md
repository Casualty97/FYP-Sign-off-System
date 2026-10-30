# Feedback screen (kiosk)

**Owner:** Role 1, Zihan

**Where the code is**

- backend/features/feedback/ (routes.js, validationRules.js, pledgeSentiment.js)
- frontend/feedback/ (feedback.html, feedback.css, js/*.js in load order: core, bear, lostFound, flowPages, faceDetect, faceFilters, init, inactivity, questions, submit, photo, overlays, navigation, backNavigation, events, config, language)

**What it does**

The visitor flow on the tablets: landing page with the QR code and the RP bear, consent, details, feedback questions, pledge, photo with face detection and filters, thank-you page and email. Server side it validates the submission, encrypts the email, stores the feedback and answers, picks badges and sends the thank-you email.

**Routes** (from tests/contracts/routes.snapshot.txt)

| Method | Path | Registered in |
|---|---|---|
| POST | `/api/feedback/feedback/:id/retry-email` | backend/features/feedback/routes.js |
| GET | `/api/feedback/languages/languages.json` | backend/features/feedback/routes.js |
| POST | `/api/feedback/save-photo` | backend/features/feedback/routes.js |
| POST | `/api/feedback/save-processed-photo` | backend/features/feedback/routes.js |
| POST | `/api/feedback/submit-feedback` | backend/features/feedback/routes.js |
| GET | `/api/feedback/test-db` | backend/features/feedback/routes.js |
| GET | `/api/feedback/visitor-count` | backend/features/feedback/routes.js |
| POST | `/api/feedback/visitor-passport` | backend/features/feedback/routes.js |
| GET | `/feedback` | backend/kioskServer.js |

**Task-sheet items for this feature**

- Face detection must block the photo when no face is in front (already the case; supervisor confirmed the task-sheet wording was inverted).
- RP photo props and a more interactive RP bear.
- Pledge required, feedback skippable; admin-editable titles and button names.
- Display is 7 m by 2 m.
- Tablet battery level reported to the server (needs HTTPS: navigator.getBattery on Android Chrome).

**Known issues (from the October 2026 review, line numbers refer to the layout before the restructure where noted)**

- Hidden rating inputs survive form.reset(), so the next visitor can submit the previous visitor's rating (old feedback.js 2284, 2468-2473).
- After a successful submit the kiosk never auto-resets: the idle warning appears over the thank-you page and hangs (old 4662, 4686-4717).
- The upload page keeps the previous visitor's photo preview and an enabled Continue button after a reset (old 3108).
- A theme reset leaves a stale overlay preview, so the previewed frame differs from the saved one (old 2268, 4057).
- The on-screen keepsake shows the raw unframed capture because processedPhoto is nulled before the thank-you page (old 3880, 5146).
- allowedPhotoFormats is [] in the shipped config and the `|| defaults` fallback does not trigger for an empty array, so every upload is rejected (old 3043; admin save writes []).
- Empty feedbackMessages blank the page text; setText has no fallback and runs again after translations (old 6028, 6774).
- The photoRequired rule never takes effect: Skip Photo is always offered and the server accepts photoSkipped (old 2968; validationRules).
- Returning to the landing page depends on an async /form-ui fetch: blank kiosk when it fails (old 1018, 5864).
- initializeCamera has no in-flight guard: double taps leak a MediaStream, Back during getUserMedia leaves the camera on (old 3648).
- The capture countdown is never cancelled on navigation and fires on a hidden page (old 3740).
- Android tablets are classified as "mobile", so the in-page camera, filters and boomerang are unreachable on the real hardware and the upload input opens the rear camera (old 2066; html 774).
- "View Pledgeboards" on tablets redirects back to /feedback (server.js 150 gate).
- The thank-you page always says the photo was emailed (html 1079).
- Overlay load failure silently produces an unframed keepsake; schema.sql seeds a wrong Tech mobile overlay path (old 4502; schema 289).
- face-api script and model come from the internet; offline, every capture and upload fails with a camera error (old 1170, 3655).
- Upload size is checked on the JPEG file but the server checks the re-encoded PNG (old 3331; routes 466).
- One failed questions fetch permanently disables the feedback step until a reload (old 2557).
- form-ui background overrides the parameters background on every return to landing (old 5846).
- Idle warning and timeout toast appear on the landing page itself (old 2165).
- confirmStyle writes its error to an alert on a hidden page (old 4590).
- "N questions answered" counts unanswered questions (old 4629).
- No touch-reachable language switcher in the shipped configuration (html 147).
- With pledge disabled, Back from the photo-choice page returns to the disabled pledge page (old 5783).
- Lost and Found is unreachable: both openers are inside HTML comments (html 155, 944).
- MediaPipe and face-api load from CDNs: keep local copies for the day the centre has no internet.
- overlaySettings and photoSettings.supportedFormats are saved by the admin but read by nothing (admin/js/parameters.js 14586 old layout).

---
Generated from the route snapshot plus hand-written notes on 2026-10-31. Update this page when you change the feature.
