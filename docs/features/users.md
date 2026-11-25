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
- Fixed 19 Nov 2026: soft-deleted admins could still log in, and an admin who was signed in when the account was deleted stayed signed in for as long as the tab was open. Now `loginUser` (backend/core/auth.js) refuses an account in Deleted Users, which also covers every password re-check. `backend/core/adminSessions.js` ends the sign-ins of one account: `end(id)` notes the time, and a middleware right after the session setup in server.js empties any session of that account that signed in before it, so the next request answers 401 and the page shows "Your session ended. Please sign in again." It is called when an account is deleted, and when another admin changes an account's username, role or password, because a session holds the name and role from the sign-in. An admin who edits their own account stays signed in on that browser (the session takes the new name and role) and is signed out on other browsers. A restored account signs in again as usual.

---
Generated from the route snapshot plus hand-written notes on 2026-10-31. Update this page when you change the feature.
