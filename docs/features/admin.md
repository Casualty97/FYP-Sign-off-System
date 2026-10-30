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
| GET | `/api/admin/visitor-trends` | backend/features/admin/routes.js |

**Task-sheet items for this feature**

- Health monitoring including the LLM (Ollama) status.
- Hardware usage graphs with statistical forecasting (no AI).
- Policy-based hibernation, archive workflow, install and uninstall scripts, hide the email-pattern setting, set the sender address (see the archive, serverControl, email and parameters pages).

**Known issues (from the October 2026 review, line numbers refer to the layout before the restructure where noted)**

- GET /api/admin/parameters returns 3 of 14 settings groups, so Save Parameters wipes settings and breaks kiosk photo upload (routes 6485 old layout).
- watchKioskService reloads the admin page after login and on session expiry (js/kioskReload.js).
- Server mode is loaded only before login and two pollers are never cleared (js/serverControl.js).
- Dashboard kiosk status poller was removed because its elements never existed; the Kiosk Server badge is updated by checkServerStatus instead.
- Only 39 of about 108 admin routes use auth.requireAuth; the router is mounted with no guard (server.js 419).

**Extracting a route group from routes.js**

1. Create `backend/features/<feature>/routes.js` with an Express router and move your `router.get/post/...` blocks and the helpers only they use into it.
2. Helpers shared with other groups stay in `backend/features/admin/routes.js` and are exported from it (or move to `backend/core/`).
3. Mount the new router in `backend/server.js` under `/api/admin` **before** the big router so the registration order is preserved, run `npm run routes:update`, and check that the snapshot only changed the "Registered in" column.
4. `npm run check` and `npm run smoke` must pass; ESLint `no-undef` tells you which helper you forgot to import.

---
Generated from the route snapshot plus hand-written notes on 2026-10-31. Update this page when you change the feature.
