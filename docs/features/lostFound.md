# Lost and found

**Owner:** shared

**Where the code is**

- backend/features/lostFound/store.js; routes inside backend/features/admin/routes.js and backend/features/feedback/routes.js
- frontend/feedback/js/lostFound.js, frontend/admin/js/lostFound.js

**What it does**

Visitors report a lost item from the kiosk (with a photo); admins list, export and update the reports.

**Routes** (from tests/contracts/routes.snapshot.txt)

| Method | Path | Registered in |
|---|---|---|
| GET | `/api/admin/lost-found-reports` | backend/features/admin/routes.js |
| PATCH | `/api/admin/lost-found-reports/:id/status` | backend/features/admin/routes.js |
| GET | `/api/admin/lost-found-reports/export.csv` | backend/features/admin/routes.js |
| POST | `/api/feedback/lost-found` | backend/features/feedback/routes.js |

**Known issues (from the October 2026 review, line numbers refer to the layout before the restructure where noted)**

- The staff alert email's "View attached item photo" is a relative link and nothing is attached (feedback/routes.js 1535-1561 old).

---
Generated from the route snapshot plus hand-written notes on 2026-10-31. Update this page when you change the feature.
