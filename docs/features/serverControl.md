# Server schedules and control (hibernation)

**Owner:** Role 3, Jun Kai

**Where the code is**

- routes still inside backend/features/admin/routes.js (7407 to 8659 in the old layout); files backend/data/kiosk-schedules.json and server-control-mode.json
- frontend/admin/js/serverControl.js, countdown.js, kioskReload.js
- hibernate.bat, restart-app.bat, startup-monitor.bat at the project root

**What it does**

Stores daily start and stop schedules, starts or stops the kiosk server, and on Windows "Stop" runs hibernate.bat (shutdown /h). The saved schedules are executed by nothing on Windows: only the legacy Linux cron runner read them.

**Routes** (from tests/contracts/routes.snapshot.txt)

| Method | Path | Registered in |
|---|---|---|
| GET | `/api/admin/countdown-management` | backend/features/admin/routes.js |
| PUT | `/api/admin/countdown-management` | backend/features/admin/routes.js |
| GET | `/api/admin/kiosk-status` | backend/features/admin/routes.js |
| GET | `/api/admin/server-schedules` | backend/features/admin/routes.js |
| POST | `/api/admin/server-schedules` | backend/features/admin/routes.js |
| DELETE | `/api/admin/server-schedules/:id` | backend/features/admin/routes.js |
| PUT | `/api/admin/server-schedules/:id` | backend/features/admin/routes.js |
| PUT | `/api/admin/server-schedules/:id/toggle` | backend/features/admin/routes.js |
| POST | `/api/admin/server-schedules/disable-all` | backend/features/admin/routes.js |
| POST | `/api/admin/server-schedules/enable-all` | backend/features/admin/routes.js |
| GET | `/api/admin/server/mode` | backend/features/admin/routes.js |
| POST | `/api/admin/server/mode` | backend/features/admin/routes.js |
| POST | `/api/admin/server/restart` | backend/features/admin/routes.js |
| POST | `/api/admin/server/start` | backend/features/admin/routes.js |
| GET | `/api/admin/server/status` | backend/features/admin/routes.js |
| POST | `/api/admin/server/stop` | backend/features/admin/routes.js |
| GET | `/api/feedback/countdown-timer` | backend/features/feedback/routes.js |

**Task-sheet items for this feature**

- Policy-based hibernation: an in-process scheduler plus Windows wake timers; nothing wakes the PC today.
- Install and uninstall scripts for the whole application.

**Known issues (from the October 2026 review, line numbers refer to the layout before the restructure where noted)**

- The saved schedules are executed by nothing on Windows (only the legacy Linux cron runner read them); the page also rejects overnight schedules.
- Auto-archive never runs when the PC hibernates every night (old 6466-6487).

---
Generated from the route snapshot plus hand-written notes on 2026-10-31. Update this page when you change the feature.
