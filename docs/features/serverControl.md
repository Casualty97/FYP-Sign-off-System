# Server schedules and control (hibernation)

**Owner:** Role 3, Jun Kai

**Where the code is**

- backend/features/serverControl/policies.js (the policy rules: priority order, which policy decides a moment, the on/off timeline, wake times, the 7-day preview; unit tests in tests/unit/policies.test.js), control.js (schedule, mode and automation files, kiosk probe, start and hibernate actions), scheduler.js (the once-a-minute runner, started by server.js only), wakeTask.js (Windows "ESG Kiosk Wake" scheduled task)
- routes still inside backend/features/admin/routes.js; files backend/data/kiosk-schedules.json, server-control-mode.json, server-automation.json
- frontend/admin/js/serverControl.js, countdown.js, kioskReload.js
- hibernate.bat, restart-app.bat, startup-monitor.bat at the project root

**What it does**

Policies (supervisor meeting 03, 4 Nov 2026). Each policy is Active (the kiosk runs) or Stop (the kiosk is off) for a time window, repeating every day, on selected weekdays (listed one by one, Monday first), on every day of selected months, or on one date; "All day" is 00:00 to 00:00. The list order is the priority: at any moment the first enabled policy that covers it decides, and with no policy the kiosk is off. A new policy is placed just above the first policy it outranks: one date > weekdays > months > every day, and at the same level Stop > Active. Admins can drag a policy (or move it with the arrow keys on its handle) anywhere, for example an Active policy above a Stop policy so that it wins; "Default order" re-sorts. With only Active policies the result is the same union of windows as before. In AUTO mode the scheduler hibernates the PC right after the policies switch the kiosk off (once per switch, never just because the state is off, so a PC woken by hand stays on) and starts the kiosk server while the policies say it runs and the kiosk is not reachable, which is also what brings it back after the Windows wake timer resumes the PC. The wake timer is a scheduled task with WakeToRun and one-time triggers 3 minutes before every switch-on in the next 14 days (at most 40), rebuilt on every policy change and once a day, so a Stop day never wakes the PC; wake timers must be allowed in the Windows power plan (the install script does that). The "Next 7 days" card shows which policy decides each part of the week. Manual "Stop" and "End Day" hibernate as well. KIOSK_AUTOMATION=off switches all of it off (laptops, CI); dry-run only logs. The Automation card on the page shows the next stop and start, the wake-timer state and the last automatic actions.

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
| GET | `/api/admin/server-schedules/preview` | backend/features/admin/routes.js |
| POST | `/api/admin/server-schedules/reorder` | backend/features/admin/routes.js |
| GET | `/api/admin/server/automation` | backend/features/admin/routes.js |
| GET | `/api/admin/server/mode` | backend/features/admin/routes.js |
| POST | `/api/admin/server/mode` | backend/features/admin/routes.js |
| POST | `/api/admin/server/restart` | backend/features/admin/routes.js |
| POST | `/api/admin/server/start` | backend/features/admin/routes.js |
| GET | `/api/admin/server/status` | backend/features/admin/routes.js |
| POST | `/api/admin/server/stop` | backend/features/admin/routes.js |
| GET | `/api/feedback/countdown-timer` | backend/features/feedback/routes.js |

**Task-sheet items for this feature**

- Enhance Hibernation setting via policy-based setting (meeting 03: Active and Stop policies, single weekdays, specific beats general, drag-and-drop priority).
- Install and uninstall scripts for the whole application.

**Known issues (from the October 2026 review, line numbers refer to the layout before the restructure where noted)**

- Auto-archive never runs when the PC hibernates every night (old 6466-6487).
- Waking from hibernation needs a PC whose firmware supports RTC wake (most desktops do); test it once on the wall PC.

---
Generated from the route snapshot plus hand-written notes on 2026-10-31. Update this page when you change the feature.
