# Server schedules and control (hibernation)

**Owner:** Role 3, Jun Kai

**Where the code is**

Look (12 Nov 2026, picked by the user from mock-ups; supervisor meeting 04 item 1): four tiles on top (Next stop, Next start, Right now, Mode), then the plan as a month calendar like a phone calendar: each day shows the policies that decide it as chips in their colours and the hours the kiosk runs, and clicking a day opens its week in the 7 days view (the bars now in the colour of each policy). Each policy has one of ten colours (field color, picked in its form; a new policy takes the first colour no other Active policy has; without one it gets a colour from its id); Stop policies are always grey. GET /api/admin/server-schedules/preview allows up to 42 days for the month. Then the policies, the controls and the automation details.

- backend/features/serverControl/runLog.js (why the kiosk stopped and started, and the check after the PC was off), powerEvents.js (reads the Windows System event log), recoveryView.js (the History to read only, for the page that opens after the PC was off), backend/core/stopNote.js (the note a program leaves when it is closed), startAll.js at the project root (writes that note too)
- backend/features/serverControl/policies.js (the policy rules: priority order, which policy decides a moment, the on/off timeline, wake times, the 7-day preview; unit tests in tests/unit/policies.test.js), control.js (schedule, mode and automation files, kiosk probe, start and hibernate actions), scheduler.js (the once-a-minute runner, started by server.js only), wakeTask.js (Windows "ESG Kiosk Wake" scheduled task)
- routes still inside backend/features/admin/routes.js; files backend/data/kiosk-schedules.json, server-control-mode.json, server-automation.json
- frontend/admin/js/serverControl.js, countdown.js, kioskReload.js, historyLines.js (the names and rows of the History lines); frontend/admin/recovery.html with js/recoveryView.js (the page that opens after the PC was off)
- hibernate.bat, restart-app.bat, startup-monitor.bat at the project root

**What it does**

Policies (supervisor meeting 03, 4 Nov 2026). Each policy is Active (the kiosk runs) or Stop (the kiosk is off) for a time window, repeating every day, on chosen days of the week (listed one by one, Monday first), on every day of selected months, or on one date; "All day" is 00:00 to 00:00. The list order is the priority: at any moment the first enabled policy that covers it decides, and with no policy the kiosk is off. A new policy is placed just above the first policy it outranks: one date > days of the week > months > every day, and at the same level Stop > Active. Admins can drag a policy (or move it with the arrow keys on its handle) anywhere, for example an Active policy above a Stop policy so that it wins; "Default order" re-sorts. With only Active policies the result is the same union of windows as before. In AUTO mode the scheduler hibernates the PC right after the policies switch the kiosk off (once per switch, never just because the state is off, so a PC woken by hand stays on) and starts the kiosk server while the policies say it runs and the kiosk is not reachable, which is also what brings it back after the Windows wake timer resumes the PC. The wake timer is a scheduled task with WakeToRun and one-time triggers 3 minutes before every switch-on in the next 14 days (at most 40; after a longer Stop period, the first switch-on that follows it), rebuilt on every policy change and once a day, so a Stop day never wakes the PC, and removed in manual mode (the policies are paused, so nothing wakes the PC; switching back to automatic rebuilds it at once); wake timers must be allowed in the Windows power plan (the install script does that). The "Next 7 days" card shows which policy decides each part of the week; its arrows, date box (a calendar) and Today button show any other week, from 2 years back to 5 years ahead, and in manual mode the days are empty because the policies are paused. While a policy is dragged, a grey slot shows where it lands. The manual "Stop and hibernate" button hibernates as well; the previous team's "Start the day / End the day" button was removed on 6 Nov 2026 (its routes stay, they are the same start, stop and mode routes the Controls card uses). KIOSK_AUTOMATION=off switches all of it off (laptops, CI); dry-run only logs. The Automation card on the page shows the next stop and start, the wake-timer state and the last automatic actions.

Look (9 Nov 2026): the Controls card sat right under the Automation card, so the state and the mode switch were together. Since 17 Nov 2026 the Automation card is the History drawer: the History button at the top right (beside New policy) opens it from the right with the automation state (On, Paused, No policies, Dry run, Off on this machine, with its summary and the last check of the scheduler) and the recent automatic actions, refreshed when it opens and every minute while the page is open (the same ids as the old card, filled by `loadAutomationStatus`). A dry run and an unreadable status are also said on the Mode tile, so nothing important hides behind the button. Start kiosk, Restart application and Stop and hibernate show only in manual mode (Start kiosk is greyed while the kiosk runs), switching to automatic mode asks for confirmation first because the policies take over within a minute, and the switch is named for screen readers. With no policies the list offers a New policy button and Default order, Enable all and Disable all are greyed. The ordering rules sit behind "How new policies are placed", and Stop periods in the 7-day preview are hatched red like the Stop pills; a bar too short for its name shows the name only in its tooltip.

**Why the kiosk stopped and started (History, 18 Nov 2026)**

The supervisor asked for more than the times the policies switch on and off: also when the kiosk itself stopped and started, and what caused it (the program was closed, the PC was shut down, the power was cut, or something else). All of it is in one list, the History drawer of this page (button at the top right), newest first, with a filter: All, Starts and stops, Schedule. The list is `events` in backend/data/server-automation.json, kept to the newest 500 lines (it was 50) and sorted by time, because a stop is only written down at the next start, with the time it happened. `GET /api/admin/server/automation?limit=N` sends up to 500 lines (10 without `limit`, as before) and `eventsTotal`.

How a stop is found out. Nothing can write to a file at the moment the power goes, so the server leaves two traces while it runs and reads them at its next start (runLog.js, called once by server.js when it is listening):

1. "Still alive": every 20 seconds the server writes backend/data/run-state.json (its process id, when it started, the time now, whether the kiosk server answered). The last time in that file is when the run ended, to within 20 seconds.
2. A stop note: a program that is closed in a way it can notice writes backend/data/run-stop.json first, in one synchronous call (core/stopNote.js). startAll.js writes it for Ctrl+C, for a closed window (Windows sends SIGHUP) and when one of the two servers ends by itself (it then names that server and its exit code, and stops the other one as before). server.js writes it for its own Ctrl+C or closed window, for an error that ends it (the message is kept) and for any other exit (the exit code). Restart application on the admin page writes "Restart application was pressed on the admin page by <user>" before it restarts. The first note of a stop wins, so the program that knows the most is the one that is kept.
3. With no note, the server asks Windows: powerEvents.js reads the System event log from 2 minutes before the last "still alive", with one PowerShell call, and uses only event ids and values (never the message text, which changes with the display language). Kernel-Boot 27 says the PC started (0 cold start, 1 fast startup; 2 is only a return from hibernation), Kernel-Power 41 and EventLog 6008 say the start followed an unexpected shutdown, User32 1074 says who asked for a shutdown or restart and why, Kernel-General 13 that Windows shut down.

| What History says | When |
|---|---|
| Stopped: power lost | the PC started again and Windows recorded an unexpected shutdown (41 or 6008). Windows cannot tell a power cut from a held power button, so the sentence says "lost power or was switched off without shutting down" |
| Stopped: Windows error | the same, and event 41 carries a bug check code |
| Stopped: PC shut down / PC restarted | Windows shut down in the normal way; with event 1074 the line names the program that asked and its reason, for example a Windows Update restart |
| Stopped: PC went off | the PC started again but Windows has no record of how it went off |
| Stopped: window closed, Ctrl+C, Restart application, a server ended, error, ended by itself | the stop note |
| Stopped: program ended | no note and the PC stayed on: End task in Task Manager, or a kill from another program |
| Started: PC switched on / Windows sign-in / after a restart / Started | what began the run: the PC started (with its time), the logon shortcut of install.cmd (it runs `startAll.js --logon`, and startAll.js passes `--logon` on to the two servers), Restart application, or a start by hand |
| PC went to sleep, PC woke up | a "still alive" that comes more than 90 seconds late means the programs were paused, not closed; Windows says whether it was sleep or hibernation (Kernel-Power 42), and the wake line says how long |
| Kiosk server not answering / answers again | the main server asks the kiosk server (port 3003) once a minute and writes down a change |
| On hours started / Off hours started | the policies switched (automatic mode). The switch to on hours is new; it is never written on the first check after a start |
| Starting the kiosk, Kiosk started, Mode changed | Start kiosk and the mode switch on this page now say who pressed them |

A stop note that Windows also causes while it shuts down (the window closing, a server ending) gives way to a shutdown within 3 minutes of it; any other note wins, because a program that had time to leave a note was stopping already. A shutdown more than 3 minutes after the last "still alive" did not end the run either: the program had ended before. A run-state.json that cannot be read (a power cut can leave it half written) still counts through the time it was last written. A stop note only counts when it was written at the end of that run (from 30 seconds before its last "still alive" to a minute after), so a note from a start in between that failed never hides a power cut. The event log gets 90 seconds and a second try, because PowerShell is slow right after sign-in. When it still cannot be read (or on another system) the stop is written as "Stopped: cause not known", and the PC's uptime is the only sign that it restarted; with Windows Fast Startup the uptime does not start over, so in that one case the check after the PC was off is skipped.

Sleep and hibernation are only recorded here. Putting the PC to sleep, waking it and scheduling that stay with the system-level part (Role 4).

**After the PC was off (18 Nov 2026)**

When the server starts and the PC was off since its last run (a power cut or a normal shutdown, found as above), it checks the policies once (`recover` in runLog.js):

- Automatic mode and a policy says the kiosk runs now: it waits up to 90 seconds for the kiosk server (startAll.js starts it at the same moment), starts it if it still does not answer, and opens the History in the default browser of the person signed in to Windows (`https://localhost:<PORT>/admin/recovery.html`; on Windows through `rundll32 url.dll,FileProtocolHandler`). The browser shows the certificate warning the first time, as it does for the desktop link.
- Automatic mode and off hours (a Stop policy, or no policy): nothing is started or opened; the scheduler starts the kiosk when the next policy begins.
- Manual mode: the policies are paused, so the kiosk comes back the way it was: checked and opened if the kiosk server answered before the stop, left alone if it did not.
- `KIOSK_AUTOMATION=off` (laptops, CI): nothing is started or opened. `dry-run`: only written down.

One History line says what was decided and done ("PC back on: kiosk checked" or "PC back on: nothing started"). A start that did not follow the PC being off (a restart of the programs, a sign-out and sign-in) opens nothing.

**The page that opens: the History without a sign-in, to read only (18 Nov 2026)**

The first version opened `/admin`, which stopped at the login page: nobody is at the PC when it opens, so nothing was shown. Now `frontend/admin/recovery.html` opens. It shows the History straight away: "What happened" (the stop, the start and the "PC back on" line of this start, oldest first), "Since then" (updated every minute) and "Before that".

It is not a way into the admin page. A sign-in without a password after a power cut would let anyone who switches the PC off and on into the admin page, on a screen that visitors can see. So the page gets the History lines and nothing else:

- The server makes a link when it opens the browser (`issue` in `backend/features/serverControl/recoveryView.js`): 48 random hex characters after `#` in the address. The page takes it off the address at once and keeps it for that tab only.
- `GET /api/admin/recovery-view` gives the newest 60 History lines only to a request that carries that link in the `X-Recovery-View` header and that comes from the PC itself (the address of the connection, `127.0.0.1` or `::1`, never a header). Another machine gets 403, a wrong or missing link 401.
- The link is kept in memory only. It ends when the kiosk programs stop, when the next one is made, or after 24 hours. It is never written down: the History line names the page without it.
- The link is not a sign-in: it opens these lines and nothing else, so it adds no way into any other route. The page has a "Sign in to the admin page" button that leads to `/admin#schedule-history`; after the sign-in the admin page opens the Server Schedule page with its History drawer (`openAdminLinkTarget` in core.js).
- A browser that chose "Keep me signed in" and is still accepted by the server skips the read-only page and goes to the admin page with the History drawer open.

The names and rows of the History lines are in `frontend/admin/js/historyLines.js`, shared by the drawer and this page.

Three things had to change for an unattended start to work:

- The scheduler's first automatic kiosk start now waits 90 seconds after the server starts (`STARTUP_GRACE_MS`). It used to check after 5 seconds. A kiosk server that startAll.js had started but that was not listening yet could get a second copy; the two then fight for port 3003, and when startAll.js's own copy loses, startAll.js stops the main server too.
- backend/core/db.js waits 5 minutes for a MySQL that does not answer yet (connection refused, timed out) instead of 30 seconds. After a power cut Windows can sign in while MySQL is still starting; a server that gave up then ended, startAll.js stopped the other one, and nothing started them again. A MySQL that answers with an error (wrong password, unknown database) still ends the server after 6 tries.
- Two settings outside the software, for the person who sets up the PC: the PC must switch itself on when power returns (firmware setting, often "Restore on AC power loss: Power on"), and Windows must sign in by itself, because the logon shortcut and the browser both need a signed-in session. The installer changes neither.

Not tested on real hardware yet: the power-cut line is proven with recorded events (a real Windows Update restart of the development laptop, and the documented events of an unexpected shutdown), not with a PC whose power was pulled.

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
- Supervisor, 18 Nov 2026: record when and why the kiosk stopped and started, and after a power shutdown check the policy, start the kiosk and open the admin page: built 18 Nov 2026 (see the sections above). After the test on 18 Nov 2026 the page that opens is the History to read only, not the login page.
- Install and uninstall scripts for the whole application: built 12 Nov 2026, see [install.md](install.md) (`install.cmd`, `uninstall.cmd`).

**Known issues (from the October 2026 review, line numbers refer to the layout before the restructure where noted)**

- Auto-archive never ran when the PC hibernates every night (old 6466-6487): fixed in November 2026, see docs/features/archive.md.
- Waking from hibernation needs a PC whose firmware supports RTC wake (most desktops do); that is for the system-level part of Role 4.

**Hibernation at the system level belongs to Role 4 (12 Nov 2026)**

The task sheet gives "Set up server hibernation scheduling at the system level" to Ryan (Role 4), so the user had the parts of this feature that did it removed: the scheduler no longer hibernates the PC when the policies switch the kiosk off (it records the switch-off in the automation log as "Off hours started (recorded)"; the kiosk server keeps running, the user's choice of 12 Nov 2026 until the system-level part exists, and the page says "Off hours" instead of "the kiosk is off"), and the "ESG Kiosk Wake" Windows wake-timer task (backend/features/serverControl/wakeTask.js), its status on this page and its check on System Health are gone. What stays here (Role 3, point 1): the policies, the calendar and the 7-day preview, the next stop and start, starting the kiosk server when a policy needs it, and the previous team's manual Stop and hibernate button. For the system-level part, `GET /api/admin/server/status` gives the next stop and start, and `policies.wakeTimes` lists the coming switch-on times.

---
Generated from the route snapshot plus hand-written notes on 2026-10-31. Update this page when you change the feature.
