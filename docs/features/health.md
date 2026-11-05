# System and LLM health

**Owner:** Role 3, Jun Kai

**Where the code is**

- backend/features/health/checks.js (the checks), routes.js (GET /api/admin/health, GET and PUT /api/admin/health/layout), layout.js (each admin's chosen checks, backend/data/health-layout.json), publicRoutes.js (POST /api/health/heartbeat, mounted on both servers)
- frontend/admin/js/health.js and the System Health page in admin.html; frontend/feedback/js/heartbeat.js posts the tablet heartbeat (Role 3 file inside the kiosk folder)
- table device_heartbeats (database/migrations/001_device_heartbeats.sql, then 003_drop_heartbeat_battery.sql)

**What it does**

One page with a card per check: MySQL (version, latency), kiosk server (:3003 probe), Ollama (models, latency; OLLAMA_URL), email (SMTP login, cached 5 minutes, "Check now" forces it), disk space of the project drive, the server PC (CPU, memory, uptime, Node), the schedule automation (mode, next stop and start, wake timer) and the tablets. Every kiosk screen posts a heartbeat once a minute (device id kept in localStorage); one row per device is kept. Refreshes every 30 seconds while open.

Customise (supervisor meeting 03): every check is shown by default; an admin removes the ones they do not need (the cross on a card, or the switches under Customise) and adds them back the same way or with Show all. The choice is saved per admin account on the server, hidden checks are not run at all, the top pill counts only the checks on the page, and the Tablets and Server PC panels follow their cards. Placeholder cards hold the layout while the checks run, so the page does not jump.

**Routes** (from tests/contracts/routes.snapshot.txt)

| Method | Path | Registered in |
|---|---|---|
| GET | `/api/admin/health` | backend/features/health/routes.js |
| GET | `/api/admin/health/layout` | backend/features/health/routes.js |
| PUT | `/api/admin/health/layout` | backend/features/health/routes.js |
| POST | `/api/health/heartbeat` | backend/features/health/publicRoutes.js |
| GET | `/api/network-interfaces` | backend/kioskServer.js |
| GET | `/api/server-info` | backend/kioskServer.js |
| GET | `/api/status` | backend/kioskServer.js |
| GET | `/api/test-db` | backend/kioskServer.js |

**Task-sheet items for this feature**

- System and application health monitoring; the supervisor has nothing specific in mind for "LLM training and anomaly detection", so the team defines it.

**Known issues (from the October 2026 review, line numbers refer to the layout before the restructure where noted)**

- Tablets show their generated id until a rename field exists.

---
Generated from the route snapshot plus hand-written notes on 2026-10-31. Update this page when you change the feature.
