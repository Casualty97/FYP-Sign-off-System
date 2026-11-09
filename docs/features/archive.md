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
- frontend/admin/js/visitorArchive.js and the #visitor-archive-page block in frontend/admin/admin.html
- Settings: backend/config/defaults/visitor-archive-settings.json, copied to backend/data/ on first use; the automatic-run state is backend/data/visitor-archive-state.json
- Tests: tests/unit/visitorArchive.test.js, and the `--archive` step of tests/smoke.js (CI runs it)

**What it does**

Saves visitor records older than a keep period to one zip file per run on the server PC, then deletes them from the database. The keep period is set separately for feedback and for lost & found reports (12 months by default, in days, weeks, months or years). A run takes the visitors, their submissions with pledges, answers and likes, the raw and processed photos, and the lost & found reports with their item photos. The zip (JSON, CSV, photos and a manifest with a SHA-256 for every entry) is read back and checked before anything is deleted; the rows then go in one transaction, and the photo files are removed only after that, when no remaining row uses them. A visitor who came back recently, or records that changed while the file was being written, stay in the database. Emails stay encrypted exactly as in the database, and lost & found contact details are encrypted with the same key. Runs start from the page (with the admin's password) or on a schedule (daily, weekly, monthly or every N days; off by default; it needs "Delete the records") that catches up after the PC wakes from hibernation. The history lists every run; a run's records can be viewed after a password unlock, emails decrypted (audited), and the file downloaded, checked or deleted. Old zip files can expire after a set time (default: kept forever); a change that would delete existing files asks for the password first.

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

- Archived visitors leave the digital tree, the pledgeboard, the Feedback Data and Feedback Reports pages, and the kiosk's "visitor #N" count goes down (those screens count what is in the database).
- On a development checkout, archiving deletes the previous team's photos that are tracked in git under uploads/; `git checkout -- uploads/` brings them back.

**Task-sheet items for this feature**

- Visitor data archiving to local disk with export and full deletion: done (the Visitor Data Archive page, November 2026).
- Automatic daily archiving (Datastore_Assembly checks for a procedure and event that nothing creates): replaced by the page's own schedule, which runs inside server.js and catches up after hibernation.

**Known issues (from the October 2026 review, line numbers refer to the layout before the restructure where noted)**

- Two dead routes (/archive/stats, /bulk-decrypt-archive) were fixed to use the promise pool, bcrypt and auth.decryptEmail; nothing calls them yet.
- Manual retention clean-up route (/retention-cleanup/run) has no button.
- Archive hard-delete unlinks the photos before the SQL DELETE and has no transaction (old 3053, 3203).
- Temporary retention is dead end-to-end: feedback/routes.js forces long-term (old 634) and the clean-up re-processes the same legacy rows forever, from both server processes (retention.js 149-252, 307-343).
- Auto-archive (the 90-day soft archive) never runs when the PC hibernates every night (old 6466-6487). Left as it is on purpose: the shipped default switches it on, so a working timer would hide every pledge older than 90 days from the Pledgeboard, Pulse and the kiosk passport; the team decides first. The Visitor Data Archive's own schedule is not affected.
- CSV export turns 0 into a blank, has no formula neutralisation and prints raw Date strings (exportRoutes 974-996).
- /archive/delete-selected and the data-export downloads answer 401 on a wrong password; the page now only logs out on the auth middleware's 401, but 403 would be the right status.

---
Generated from the route snapshot plus hand-written notes on 2026-10-31; Visitor Data Archive added 2026-11-09. Update this page when you change the feature.
