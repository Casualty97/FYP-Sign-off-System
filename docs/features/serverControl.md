# Server schedules and control (hibernation)

**Owner:** Role 3, Jun Kai

**Where the code is**

- backend/features/serverControl/control.js (schedule, mode and automation files, kiosk probe, start and hibernate actions, schedule maths), scheduler.js (the once-a-minute runner, started by server.js only), wakeTask.js (Windows "ESG Kiosk Wake" scheduled task)
- routes still inside backend/features/admin/routes.js; files backend/data/kiosk-schedules.json, server-control-mode.json, server-automation.json
- frontend/admin/js/serverControl.js, countdown.js, kioskReload.js
- hibernate.bat, restart-app.bat, startup-monitor.bat at the project root

**What it does**

Daily, weekly and specific-date start/stop times. In AUTO mode the scheduler hibernates the PC when a stop time passes (once per stop, never again after someone wakes the PC by hand) and starts the kiosk server when a window is open and the kiosk is not reachable, which is also what brings it back after the Windows wake timer resumes the PC. The wake timer is a scheduled task with WakeToRun, kept in sync with the schedules and firing 3 minutes before each start time; wake timers must be allowed in the Windows power plan (the install script does that). Manual "Stop" and "End Day" hibernate as well. KIOSK_AUTOMATION=off switches all of it off (laptops, CI); dry-run only logs. The Automation card on the page shows the next stop and start, the wake-timer state and the last automatic actions.

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
| GET | `/api/admin/server/automation` | backend/features/admin/routes.js |
| GET | `/api/admin/server/mode` | backend/features/admin/routes.js |
| POST | `/api/admin/server/mode` | backend/features/admin/routes.js |
| POST | `/api/admin/server/restart` | backend/features/admin/routes.js |
| POST | `/api/admin/server/start` | backend/features/admin/routes.js |
| GET | `/api/admin/server/status` | backend/features/admin/routes.js |
| POST | `/api/admin/server/stop` | backend/features/admin/routes.js |
| GET | `/api/feedback/countdown-timer` | backend/features/feedback/routes.js |

**Task-sheet items for this feature**

- Install and uninstall scripts for the whole application.

**Known issues (from the October 2026 review, line numbers refer to the layout before the restructure where noted)**

- Auto-archive never runs when the PC hibernates every night (old 6466-6487).
- Waking from hibernation needs a PC whose firmware supports RTC wake (most desktops do); test it once on the wall PC.

---
Generated from the route snapshot plus hand-written notes on 2026-10-31. Update this page when you change the feature.
