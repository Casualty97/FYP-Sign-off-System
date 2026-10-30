# Photo frames (overlays)

**Owner:** Role 1, Zihan

**Where the code is**

- routes still inside backend/features/admin/routes.js (/overlays) and backend/features/feedback/routes.js (/api/feedback/overlays); files in assets/overlays/
- frontend/admin/js/overlays.js

**What it does**

Admins upload desktop and mobile frame images per theme; the kiosk draws the chosen frame over the photo.

**Routes** (from tests/contracts/routes.snapshot.txt)

| Method | Path | Registered in |
|---|---|---|
| GET | `/api/admin/overlay/:id` | backend/features/admin/routes.js |
| GET | `/api/admin/overlays` | backend/features/admin/routes.js |
| POST | `/api/admin/overlays` | backend/features/admin/routes.js |
| DELETE | `/api/admin/overlays/:id` | backend/features/admin/routes.js |
| GET | `/api/feedback/overlays` | backend/features/feedback/routes.js |

**Task-sheet items for this feature**

- RP photo props.

---
Generated from the route snapshot plus hand-written notes on 2026-10-31. Update this page when you change the feature.
