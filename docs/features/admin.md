# Admin page shell and the big admin router

**Owner:** Role 3, Jun Kai (lead); each route group belongs to the role listed on its page

**Where the code is**

- backend/features/admin/routes.js: the former adminRoutes.js, 8.7k lines, still one file
- frontend/admin/admin.html, admin.css, js/core.js, js/navigation.js, js/init.js, js/dashboard.js

**What it does**

Login, session timeout, navigation between the admin pages, the dashboard with its charts and alerts, and the feedback data table. The router file still holds every admin route group; each owner extracts theirs into backend/features/<feature>/routes.js when they first work on it (see "Extracting a route group" below).

**Routes** (from tests/contracts/routes.snapshot.txt)

| Method | Path | Registered in |
|---|---|---|
| GET | `/admin` | backend/server.js |
| GET | `/admin/` | backend/server.js |
| GET | `/api/admin/dashboard` | backend/features/admin/routes.js |
| GET | `/api/admin/download-file/:filename` | backend/features/admin/routes.js |
| GET | `/api/admin/feedback` | backend/features/admin/routes.js |
| GET | `/api/admin/feedback-stats` | backend/features/admin/routes.js |
| DELETE | `/api/admin/feedback/:id` | backend/features/admin/routes.js |
| PUT | `/api/admin/feedback/:id` | backend/features/admin/routes.js |
| GET | `/api/admin/feedback/:id/questions` | backend/features/admin/routes.js |
| GET | `/api/admin/intervention-alerts` | backend/features/admin/routes.js |
| GET | `/api/admin/journey-passport` | backend/features/admin/routes.js |
| POST | `/api/admin/keep-alive` | backend/features/admin/routes.js |
| GET | `/api/admin/leaf-pledge-trends` | backend/features/admin/routes.js |
| POST | `/api/admin/login` | backend/features/admin/routes.js |
| POST | `/api/admin/logout-audit` | backend/features/admin/routes.js |
| GET | `/api/admin/nick-usage-analytics` | backend/features/admin/routes.js |
| GET | `/api/admin/school-summary` | backend/features/admin/routes.js |
| GET | `/api/admin/test-db` | backend/features/admin/routes.js |
| POST | `/api/admin/verify-password` | backend/features/admin/routes.js |
| GET | `/api/admin/visitor-trends` | backend/features/admin/routes.js |

**Task-sheet items for this feature**

- Health monitoring including the LLM (Ollama) status.
- Hardware usage graphs with statistical forecasting (no AI).
- Policy-based hibernation, archive workflow, install and uninstall scripts, hide the email-pattern setting, set the sender address (see the archive, serverControl, email and parameters pages).

**Known issues (from the October 2026 review, line numbers refer to the layout before the restructure where noted)**

- Only 39 of about 108 admin routes use auth.requireAuth; the router is mounted with no guard (server.js 419).
- Three queries use a feedback.rating column that does not exist (old 1399, 4252, 4345).
- Phones are always bounced off /pledgeboard: req.session.mobileAccessGranted is set by nothing (server.js 140).
- getSelectedIP falls back to the first adapter unless one is literally named "Wi-Fi 2" (server.js 227); set SERVER_IP on the wall PC.
- kioskServer.js has drifted from server.js (no page gates, different static handling) if the wall browser is pointed at :3003.
- restart-app.bat and startup-monitor.bat can double-launch the servers.
- Dashboard kiosk status poller was removed because its elements never existed; the Kiosk Server badge is updated by checkServerStatus instead.
- scripts/setup: Simulation_Generator stores bare filenames in photo_path (the app expects photos/<file>) and needs pngjs, which is not a dependency; Purge_Actuator "CLEAR ALL TEST DATA" leaves photo files and several tables behind.

**Extracting a route group from routes.js**

1. Create `backend/features/<feature>/routes.js` with an Express router and move your `router.get/post/...` blocks and the helpers only they use into it.
2. Helpers shared with other groups stay in `backend/features/admin/routes.js` and are exported from it (or move to `backend/core/`).
3. Mount the new router in `backend/server.js` under `/api/admin` **before** the big router so the registration order is preserved, run `npm run routes:update`, and check that the snapshot only changed the "Registered in" column.
4. `npm run check` and `npm run smoke` must pass; ESLint `no-undef` tells you which helper you forgot to import.

---
Generated from the route snapshot plus hand-written notes on 2026-10-31. Update this page when you change the feature.
