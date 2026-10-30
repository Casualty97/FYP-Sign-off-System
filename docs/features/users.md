# Admin users and login

**Owner:** shared

**Where the code is**

- backend/core/auth.js (bcrypt, sessions, encryption helpers); routes inside backend/features/admin/routes.js
- frontend/admin/js/users.js, core.js

**What it does**

System admin, IT admin and IT staff accounts with soft delete and restore. The seeded account is systemadmin.

**Routes** (from tests/contracts/routes.snapshot.txt)

| Method | Path | Registered in |
|---|---|---|
| GET | `/api/admin/users` | backend/features/admin/routes.js |
| POST | `/api/admin/users` | backend/features/admin/routes.js |
| DELETE | `/api/admin/users/:id` | backend/features/admin/routes.js |
| PUT | `/api/admin/users/:id` | backend/features/admin/routes.js |
| DELETE | `/api/admin/users/:id/permanent` | backend/features/admin/routes.js |
| POST | `/api/admin/users/:id/restore` | backend/features/admin/routes.js |
| GET | `/api/admin/users/deleted` | backend/features/admin/routes.js |

**Known issues (from the October 2026 review, line numbers refer to the layout before the restructure where noted)**

- Change the seeded admin password on the wall PC.

---
Generated from the route snapshot plus hand-written notes on 2026-10-31. Update this page when you change the feature.
