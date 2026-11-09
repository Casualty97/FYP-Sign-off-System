# Archive, export and retention

**Owner:** Role 3, Jun Kai

**Where the code is**

- backend/features/archive/exportRoutes.js (mounted at /api/admin/data-export) and retention.js (scheduled clean-up)
- archive, decrypt and download routes still inside backend/features/admin/routes.js
- frontend/admin/js/archive.js, archiveDeletion.js, dataExport.js, encryption.js, feedbackDeletion.js, photos.js, emailPopup.js

**What it does**

Marks feedback as archived, previews and deletes by selection or date, exports Excel, CSV, PDF and photo zips after a password unlock, decrypts emails for display, and deletes expired data on a timer.

**Routes** (from tests/contracts/routes.snapshot.txt)

| Method | Path | Registered in |
|---|---|---|
| GET | `/api/admin/archive` | backend/features/admin/routes.js |
| POST | `/api/admin/archive/delete-by-date` | backend/features/admin/routes.js |
| POST | `/api/admin/archive/delete-selected` | backend/features/admin/routes.js |
| POST | `/api/admin/archive/preview-deletion` | backend/features/admin/routes.js |
| GET | `/api/admin/archive/stats` | backend/features/admin/routes.js |
| POST | `/api/admin/archive/update-status` | backend/features/admin/routes.js |
| POST | `/api/admin/bulk-decrypt-archive` | backend/features/admin/routes.js |
| GET | `/api/admin/data-export/audit-log` | backend/features/archive/exportRoutes.js |
| GET | `/api/admin/data-export/feedback/archived` | backend/features/archive/exportRoutes.js |
| GET | `/api/admin/data-export/feedback/full` | backend/features/archive/exportRoutes.js |
| GET | `/api/admin/data-export/feedback/not-archived` | backend/features/archive/exportRoutes.js |
| GET | `/api/admin/data-export/photos/all` | backend/features/archive/exportRoutes.js |
| GET | `/api/admin/data-export/photos/archived` | backend/features/archive/exportRoutes.js |
| GET | `/api/admin/data-export/photos/not-archived` | backend/features/archive/exportRoutes.js |
| GET | `/api/admin/data-export/school-impact/csv` | backend/features/archive/exportRoutes.js |
| GET | `/api/admin/data-export/school-impact/pdf` | backend/features/archive/exportRoutes.js |
| POST | `/api/admin/data-export/unlock` | backend/features/archive/exportRoutes.js |
| POST | `/api/admin/decrypt-email` | backend/features/admin/routes.js |
| POST | `/api/admin/decrypt-emails` | backend/features/admin/routes.js |
| GET | `/api/admin/download-archive-excel` | backend/features/admin/routes.js |
| POST | `/api/admin/download-archive-photos` | backend/features/admin/routes.js |
| GET | `/api/admin/download-audit-excel` | backend/features/admin/routes.js |
| GET | `/api/admin/download-excel` | backend/features/admin/routes.js |
| GET | `/api/admin/download-file/:filename` | backend/features/admin/routes.js |
| GET | `/api/admin/download-photos` | backend/features/admin/routes.js |
| POST | `/api/admin/retention-cleanup/run` | backend/features/admin/routes.js |
| POST | `/api/admin/verify-photo-access` | backend/features/admin/routes.js |

## Visitor Data Archive (task-sheet point 2)

**Where the code is**

- backend/features/archive/visitorRoutes.js (mounted at /api/admin/visitor-archive, system_admin only)
- visitorRunner.js (what is due, the preview, the run itself: write, check, delete, clean up; the history; recovery after a restart)
- visitorWriter.js (the zip: JSON, CSV, photos and manifest; reading and checking an archive back), visitorFiles.js (archive folder rules, photo paths, file names), visitorSchedule.js (keep periods, Singapore-time cutoffs, when an automatic run is due), visitorSettings.js (the settings file and its checks), visitorScheduler.js (the timer started by server.js)
- backend/core/audit.js (audit rows for the feature routers), backend/core/zip.js (reading zips back with yauzl), database/migrations/004_visitor_archives.sql (the history table)
- deletedCounts.js (counts of deleted rows per Singapore day, written in the delete transaction; table deleted_record_counts, migration 005) and saveGate.js (kiosk saves and delete steps take turns; table visitor_save_gate, migration 006)
- Hooks in other roles' files, each marked `<Jun Kai start>`: backend/features/feedback/routes.js (the visitor number adds the deleted feedback; the background kiosk save goes through the save gate), backend/features/tree/routes.js (`GET /api/tree/years` adds each year's deleted leaves), frontend/tree/tree.js and frontend/3dTree/3dTree.js (the year book says "· N archived")
- frontend/admin/js/visitorArchive.js and the #visitor-archive-page block in frontend/admin/admin.html
- Settings: backend/config/defaults/visitor-archive-settings.json, copied to backend/data/ on first use; the automatic-run state is backend/data/visitor-archive-state.json
- Tests: tests/unit/visitorArchive.test.js, and the `--archive` step of tests/smoke.js (CI runs it)

**What it does**

Saves visitor records older than a keep period to one zip file per run on the server PC, then deletes them from the database. The keep period is set separately for feedback and for lost & found reports (12 months by default, in days, weeks, months or years). A run takes the visitors, their submissions with pledges, answers and likes, the raw and processed photos, and the lost & found reports with their item photos. The zip (JSON, CSV, photos and a manifest with a SHA-256 for every entry) is read back and checked before anything is deleted; the rows then go in one transaction, and the photo files are removed only after that, when no remaining row uses them. A visitor who came back recently, or records that changed while the file was being written, stay in the database. Emails stay encrypted exactly as in the database, and lost & found contact details are encrypted with the same key. Runs start from the page (with the admin's password) or on a schedule (daily, weekly, monthly or every N days; off by default; it needs "Delete the records") that catches up after the PC wakes from hibernation. The history lists every run; a run's records can be viewed after a password unlock, emails decrypted (audited), and the file downloaded, checked or deleted. Old zip files can expire after a set time (default: kept forever); a change that would delete existing files asks for the password first.

Running totals keep counting deleted records: every delete (this page, the old Permanent Data Deletion on Archived Feedback, and the Delete button on a Feedback Data or Archived Feedback row) adds how many feedback rows, tree leaves, visitors and lost & found reports it removed, per Singapore day of when each was made, to deleted_record_counts in the same transaction (counts only, no names or ids). The kiosk's visitor number ("You are visitor #N", the landing screen's visitor count) and the tree's year book add those counts back. Numbers that describe what is on show (Pulse, Pledgeboard, the admin dashboard, which all leave out archived feedback) are not changed, and a returning visitor whose record was archived starts a new passport (the system has forgotten them on purpose).

A kiosk save always goes before a delete. The kiosk thanks the visitor first and saves in the background (look the visitor up by email, add the visit, insert the pledge); if an archive deleted that visitor in between, the pledge used to be lost without anyone seeing an error. Now a save adds a row to visitor_save_gate while it runs, from either server process (server.js or kioskServer.js), and renews it every 30 seconds (a first-time download of the pledge sentiment model can take minutes); the delete step checks that table before every statement and before its commit, and when a save shows up it rolls back, waits for the save and starts the delete again (the visitor then has a new pledge and stays). After 10 such restarts the run ends as "Saved records kept" and says to run it again. scripts/setup/Purge_Actuator.js and Datastore_Assembly.js clear deleted_record_counts and visitor_save_gate along with the visitor tables.

**Routes** (from tests/contracts/routes.snapshot.txt)

| Method | Path | Registered in |
|---|---|---|
| GET | `/api/admin/visitor-archive/overview` | backend/features/archive/visitorRoutes.js |
| PUT | `/api/admin/visitor-archive/settings` | backend/features/archive/visitorRoutes.js |
| POST | `/api/admin/visitor-archive/folder-check` | backend/features/archive/visitorRoutes.js |
| POST | `/api/admin/visitor-archive/preview` | backend/features/archive/visitorRoutes.js |
| POST | `/api/admin/visitor-archive/runs` | backend/features/archive/visitorRoutes.js |
| GET | `/api/admin/visitor-archive/runs` | backend/features/archive/visitorRoutes.js |
| GET | `/api/admin/visitor-archive/runs/:id` | backend/features/archive/visitorRoutes.js |
| POST | `/api/admin/visitor-archive/runs/:id/verify` | backend/features/archive/visitorRoutes.js |
| POST | `/api/admin/visitor-archive/unlock` | backend/features/archive/visitorRoutes.js |
| GET | `/api/admin/visitor-archive/runs/:id/download` | backend/features/archive/visitorRoutes.js |
| GET | `/api/admin/visitor-archive/runs/:id/records` | backend/features/archive/visitorRoutes.js |
| GET | `/api/admin/visitor-archive/runs/:id/photo` | backend/features/archive/visitorRoutes.js |
| POST | `/api/admin/visitor-archive/runs/:id/decrypt` | backend/features/archive/visitorRoutes.js |
| DELETE | `/api/admin/visitor-archive/runs/:id/file` | backend/features/archive/visitorRoutes.js |

**What other pages notice after an archive**

- Archived visitors leave the digital tree, the pledgeboard, the Feedback Data and Feedback Reports pages (those screens show what is in the database). The kiosk's "visitor #N" and the tree's year book keep their totals; the year book adds "· N archived", because the tree drawn for that year can only show the leaves still in the database.
- On a development checkout, archiving deletes the previous team's photos that are tracked in git under uploads/; `git checkout -- uploads/` brings them back.

**Task-sheet items for this feature**

- Visitor data archiving to local disk with export and full deletion: done (the Visitor Data Archive page, November 2026).
- Automatic daily archiving (Datastore_Assembly checks for a procedure and event that nothing creates): replaced by the page's own schedule, which runs inside server.js and catches up after hibernation.

**Known issues (from the October 2026 review, line numbers refer to the layout before the restructure where noted)**

- Two dead routes (/archive/stats, /bulk-decrypt-archive) were fixed to use the promise pool, bcrypt and auth.decryptEmail; nothing calls them yet.
- Manual retention clean-up route (/retention-cleanup/run) has no button.
- Fixed in November 2026: archive hard-delete (the old Permanent Data Deletion) unlinked the photos before the SQL DELETE, with no transaction (old 3053, 3203). The DELETE now runs in one transaction with its deleted counts and takes turns with kiosk saves; the photos go after it, only for the rows it deleted. When a kiosk save is running it answers "try again in a minute" (409) after about 20 seconds instead of holding the page.
- Temporary retention is dead end-to-end: feedback/routes.js forces long-term (old 634) and the clean-up re-processes the same legacy rows forever, from both server processes (retention.js 149-252, 307-343).
- Fixed in November 2026: auto-archive (the 90-day soft archive) never ran on a PC that hibernates every night (old 6466-6487, a 24-hour interval that only counted uptime). It is now checked 2 minutes after the server starts and every 15 minutes, runs once per Singapore day and catches up after hibernation (last run in backend/data/auto-archive-state.json). The shipped default is now off, and because a backend/data copy made earlier still said on (a setting nobody had seen working), the first start after the update switches it off once (backend/data/auto-archive-state.json records it, and the server log says so); nothing leaves the screens until an admin turns it on again in Parameters > Auto Archive. A setting the page does not offer (for example 7 days, typed into the file) makes the check skip with a log line instead of stopping the server. "Run Archive Update Now" (POST /api/admin/archive/update-status) now needs a system admin login, like the Parameters page it sits on; it had no login check.
- CSV export turns 0 into a blank, has no formula neutralisation and prints raw Date strings (exportRoutes 974-996).
- /archive/delete-selected and the data-export downloads answer 401 on a wrong password; the page now only logs out on the auth middleware's 401, but 403 would be the right status.

---
Generated from the route snapshot plus hand-written notes on 2026-10-31; Visitor Data Archive added 2026-11-09, then the deleted counts, the save gate and the auto-archive timer fix the same day. Update this page when you change the feature.
