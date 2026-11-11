# Server schedules and control (hibernation)

**Owner:** Role 3, Jun Kai

**Where the code is**

Look (12 Nov 2026, picked by the user from mock-ups; supervisor meeting 04 item 1): four tiles on top (Next stop, Next start, Right now, Mode), then the plan as a month calendar like a phone calendar: each day shows the policies that decide it as chips in their colours and the hours the kiosk runs, and clicking a day opens its week in the 7 days view (the bars now in the colour of each policy). Each policy has one of ten colours (field color, picked in its form; a new policy takes the first colour no other Active policy has; without one it gets a colour from its id); Stop policies are always grey. GET /api/admin/server-schedules/preview allows up to 42 days for the month. Then the policies, the controls and the automation details.

- backend/features/serverControl/policies.js (the policy rules: priority order, which policy decides a moment, the on/off timeline, wake times, the 7-day preview; unit tests in tests/unit/policies.test.js), control.js (schedule, mode and automation files, kiosk probe, start and hibernate actions), scheduler.js (the once-a-minute runner, started by server.js only), wakeTask.js (Windows "ESG Kiosk Wake" scheduled task)
- routes still inside backend/features/admin/routes.js; files backend/data/kiosk-schedules.json, server-control-mode.json, server-automation.json
- frontend/admin/js/serverControl.js, countdown.js, kioskReload.js
- hibernate.bat, restart-app.bat, startup-monitor.bat at the project root

**What it does**

Policies (supervisor meeting 03, 4 Nov 2026). Each policy is Active (the kiosk runs) or Stop (the kiosk is off) for a time window, repeating every day, on chosen days of the week (listed one by one, Monday first), on every day of selected months, or on one date; "All day" is 00:00 to 00:00. The list order is the priority: at any moment the first enabled policy that covers it decides, and with no policy the kiosk is off. A new policy is placed just above the first policy it outranks: one date > days of the week > months > every day, and at the same level Stop > Active. Admins can drag a policy (or move it with the arrow keys on its handle) anywhere, for example an Active policy above a Stop policy so that it wins; "Default order" re-sorts. With only Active policies the result is the same union of windows as before. In AUTO mode the scheduler hibernates the PC right after the policies switch the kiosk off (once per switch, never just because the state is off, so a PC woken by hand stays on) and starts the kiosk server while the policies say it runs and the kiosk is not reachable, which is also what brings it back after the Windows wake timer resumes the PC. The wake timer is a scheduled task with WakeToRun and one-time triggers 3 minutes before every switch-on in the next 14 days (at most 40; after a longer Stop period, the first switch-on that follows it), rebuilt on every policy change and once a day, so a Stop day never wakes the PC, and removed in manual mode (the policies are paused, so nothing wakes the PC; switching back to automatic rebuilds it at once); wake timers must be allowed in the Windows power plan (the install script does that). The "Next 7 days" card shows which policy decides each part of the week; its arrows, date box (a calendar) and Today button show any other week, from 2 years back to 5 years ahead, and in manual mode the days are empty because the policies are paused. While a policy is dragged, a grey slot shows where it lands. The manual "Stop and hibernate" button hibernates as well; the previous team's "Start the day / End the day" button was removed on 6 Nov 2026 (its routes stay, they are the same start, stop and mode routes the Controls card uses). KIOSK_AUTOMATION=off switches all of it off (laptops, CI); dry-run only logs. The Automation card on the page shows the next stop and start, the wake-timer state and the last automatic actions.

Look (9 Nov 2026): the Controls card sits right under the Automation card, so the state and the mode switch are together at the top. Start kiosk, Restart application and Stop and hibernate show only in manual mode (Start kiosk is greyed while the kiosk runs), switching to automatic mode asks for confirmation first because the policies take over within a minute, and the switch is named for screen readers. With no policies the list offers a New policy button and Default order, Enable all and Disable all are greyed. The ordering rules sit behind "How new policies are placed", and Stop periods in the 7-day preview are hatched red like the Stop pills; a bar too short for its name shows the name only in its tooltip.

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

- Auto-archive never ran when the PC hibernates every night (old 6466-6487): fixed in November 2026, see docs/features/archive.md.
- Waking from hibernation needs a PC whose firmware supports RTC wake (most desktops do); that is for the system-level part of Role 4.

**Hibernation at the system level belongs to Role 4 (12 Nov 2026)**

The task sheet gives "Set up server hibernation scheduling at the system level" to Ryan (Role 4), so the user had the parts of this feature that did it removed: the scheduler no longer hibernates the PC when the policies switch the kiosk off (it records the switch-off in the automation log as "Off hours started (recorded)"; the kiosk server keeps running, the user's choice of 12 Nov 2026 until the system-level part exists, and the page says "Off hours" instead of "the kiosk is off"), and the "ESG Kiosk Wake" Windows wake-timer task (backend/features/serverControl/wakeTask.js), its status on this page and its check on System Health are gone. What stays here (Role 3, point 1): the policies, the calendar and the 7-day preview, the next stop and start, starting the kiosk server when a policy needs it, and the previous team's manual Stop and hibernate button. For the system-level part, `GET /api/admin/server/status` gives the next stop and start, and `policies.wakeTimes` lists the coming switch-on times.

---
Generated from the route snapshot plus hand-written notes on 2026-10-31. Update this page when you change the feature.
