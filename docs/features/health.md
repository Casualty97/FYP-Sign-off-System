# System and LLM health

**Owner:** Role 3, Jun Kai

**Where the code is**

- backend/features/health/checks.js (the checks), routes.js (GET /api/admin/health, GET and PUT /api/admin/health/layout), layout.js (each admin's chosen checks, backend/data/health-layout.json), tabletNames.js (the names admins give the tablets, backend/data/tablet-names.json), publicRoutes.js (POST /api/health/heartbeat, mounted on both servers)
- frontend/admin/js/health.js and the System Health page in admin.html; frontend/feedback/js/heartbeat.js posts the tablet heartbeat (Role 3 file inside the kiosk folder)
- table device_heartbeats (database/migrations/001_device_heartbeats.sql, then 003_drop_heartbeat_battery.sql)

**What it does**

One page with a card per check: MySQL (version, latency), kiosk server (:3003 probe), Ollama (models, latency; OLLAMA_URL), email (SMTP login, cached 5 minutes, "Check now" forces it), disk space of the project drive, the server PC (CPU and memory load, uptime, app memory), the schedule automation (mode, next stop and start) and the tablets. Every kiosk screen posts a heartbeat once a minute (device id kept in localStorage); one row per device is kept. Refreshes every 30 seconds while open.

Customise (supervisor meeting 03): every check is shown by default; an admin removes the ones they do not need with the switches under Customise and adds them back the same way or with Show all (the cross on each card was taken out on 9 Nov 2026). The choice is saved per admin account on the server, hidden checks are not run for the page (the background recorder behind the anomaly detection still runs them, see Incidents below), the top pill counts only the checks on the page, and the Tablets panel follows its card. Placeholder cards hold the layout while the checks run, so the page does not jump. The Monitoring options panel closes with its close button or the Escape key.

Tablet names: the edit button next to a tablet in the Tablets panel gives it a name or a number (up to 40 characters, no two tablets with the same name); an empty name shows the device name again. Named tablets are listed first in number order ("Tablet 2" before "Tablet 10"), the others after them, most recent first. The names are kept in backend/data/tablet-names.json, apart from the heartbeat rows, so a kiosk never overwrites them.

Look (9 Nov 2026): the status pill on each card carries the state; a card that needs attention or is down tints its whole border instead of a coloured side stripe. The disk card names the drive (the full folder path is in its tooltip), the Server PC card shows the CPU and memory load (Attention from 85 %, Down from 95 %, the same steps as the Hardware page), the PC and app uptime with the app memory, and a link to the Hardware page for the graphs, so the Tablets list was the only panel under the cards until the Incidents panel joined it (11 Nov 2026), and an offline tablet shows an Offline pill with how long ago under it. The 30-second refresh redraws only the cards whose text changed.

Incidents (11 Nov 2026): an Incidents panel sits under the cards, above the Tablets panel. It lists what the anomaly detection found in the hardware samples, the health checks, the named tablets' heartbeats and the server logs (sudden spikes, unusual for the time of day, slow creep, disk filling up, services down or slow, named tablets offline, server errors), each with a plain explanation, its evidence and a timeline; admins acknowledge, resolve and give a verdict, the Test incident button in the panel header opens a sample incident to try the flow, and system admins also reach its Settings there (master switch, per-detector switches and sensitivities, quiet hours). The detectors, the merging rules and the API are in docs/features/aiops.md. Customise gained the option Anomaly detection, which hides the panel for that admin like a hidden card without stopping the detection. The detection also runs the health checks in the background every 5 minutes (every check except email and Ollama, the mail login every 30 minutes) and keeps the results in health_check_results, so Customise now changes only what this page requests; a check hidden here still runs in the background.

**Routes** (from tests/contracts/routes.snapshot.txt)

| Method | Path | Registered in |
|---|---|---|
| GET | `/api/admin/health` | backend/features/health/routes.js |
| GET | `/api/admin/health/layout` | backend/features/health/routes.js |
| PUT | `/api/admin/health/layout` | backend/features/health/routes.js |
| PUT | `/api/admin/health/tablets/:deviceId/name` | backend/features/health/routes.js |
| POST | `/api/health/heartbeat` | backend/features/health/publicRoutes.js |
| GET | `/api/network-interfaces` | backend/kioskServer.js |
| GET | `/api/server-info` | backend/kioskServer.js |
| GET | `/api/status` | backend/kioskServer.js |
| GET | `/api/test-db` | backend/kioskServer.js |

**Task-sheet items for this feature**

- Monitor system and application health (LLM/AI training and anomaly detection) (Admin Screen point 3): the health monitoring is this page; the anomaly detection half is built (the Incidents panel, November 2026, see docs/features/aiops.md); the LLM advisor comes in the next PR. The supervisor had nothing specific in mind for "LLM training", so the team defined it as statistical anomaly detection plus a local LLM advisor, both switchable off.

**Known issues (from the October 2026 review, line numbers refer to the layout before the restructure where noted)**

- None open.

---
Generated from the route snapshot plus hand-written notes on 2026-10-31; Incidents panel and the Anomaly detection option added 2026-11-11. Update this page when you change the feature.
