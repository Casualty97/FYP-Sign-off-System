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

**Task-sheet items for this feature**

- Visitor data archiving to local disk with export and full deletion.
- Automatic daily archiving (Datastore_Assembly checks for a procedure and event that nothing creates).

**Known issues (from the October 2026 review, line numbers refer to the layout before the restructure where noted)**

- Two dead routes (/archive/stats, /bulk-decrypt-archive) were fixed to use the promise pool, bcrypt and auth.decryptEmail; nothing calls them yet.
- Manual retention clean-up route (/retention-cleanup/run) has no button.
- Archive hard-delete unlinks the photos before the SQL DELETE and has no transaction (old 3053, 3203).
- Temporary retention is dead end-to-end: feedback/routes.js forces long-term (old 634) and the clean-up re-processes the same legacy rows forever, from both server processes (retention.js 149-252, 307-343).
- Auto-archive never runs when the PC hibernates every night (old 6466-6487).
- CSV export turns 0 into a blank, has no formula neutralisation and prints raw Date strings (exportRoutes 974-996).
- /archive/delete-selected and the data-export downloads answer 401 on a wrong password; the page now only logs out on the auth middleware's 401, but 403 would be the right status.

---
Generated from the route snapshot plus hand-written notes on 2026-10-31. Update this page when you change the feature.
