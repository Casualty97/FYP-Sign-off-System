# VIP visitors

**Owner:** shared

**Where the code is**

- routes inside backend/features/admin/routes.js; table vip_management
- frontend/admin/js/vips.js; gold leaves in frontend/tree/tree.js

**What it does**

Names on this list get a gold leaf on the tree.

**Routes** (from tests/contracts/routes.snapshot.txt)

| Method | Path | Registered in |
|---|---|---|
| GET | `/api/admin/vips` | backend/features/admin/routes.js |
| POST | `/api/admin/vips` | backend/features/admin/routes.js |
| DELETE | `/api/admin/vips/:name` | backend/features/admin/routes.js |

**Known issues (from the October 2026 review, line numbers refer to the layout before the restructure where noted)**

- Remove button breaks for names with an apostrophe (js/vips.js).

---
Generated from the route snapshot plus hand-written notes on 2026-10-31. Update this page when you change the feature.
