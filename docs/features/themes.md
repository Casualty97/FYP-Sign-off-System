# Admin themes

**Owner:** Role 3, Jun Kai (decided 31 Oct 2026)

**Where the code is**

- routes inside backend/features/admin/routes.js; table saved_themes
- frontend/admin/js/themes.js

**What it does**

Colour themes for the admin page itself, saved per admin user.

**Routes** (from tests/contracts/routes.snapshot.txt)

| Method | Path | Registered in |
|---|---|---|
| GET | `/api/admin/saved-themes` | backend/features/admin/routes.js |
| POST | `/api/admin/saved-themes` | backend/features/admin/routes.js |
| DELETE | `/api/admin/saved-themes/:id` | backend/features/admin/routes.js |
| PUT | `/api/admin/saved-themes/:id` | backend/features/admin/routes.js |
| PUT | `/api/admin/saved-themes/:id/activate` | backend/features/admin/routes.js |
| GET | `/api/admin/saved-themes/active` | backend/features/admin/routes.js |
| POST | `/api/admin/saved-themes/deactivate-all` | backend/features/admin/routes.js |

**Known issues (from the October 2026 review, line numbers refer to the layout before the restructure where noted)**

- Save Theme always fails: it reads colour inputs that no longer exist (js/themes.js).
- Theme card swatches are always grey.

---
Generated from the route snapshot plus hand-written notes on 2026-10-31. Update this page when you change the feature.
