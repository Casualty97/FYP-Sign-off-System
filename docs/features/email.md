# Email and badges

**Owner:** Role 3, Jun Kai

**Where the code is**

- backend/features/email/service.js (transport, badges, templates), configStore.js, templateStore.js
- email routes still inside backend/features/admin/routes.js and backend/features/feedback/routes.js
- frontend/admin/js/email.js

**What it does**

Sends the thank-you and badge emails through Gmail, Outlook or custom SMTP from the settings saved in the admin page; badge rules decide which badge a visitor earns.

**Routes** (from tests/contracts/routes.snapshot.txt)

| Method | Path | Registered in |
|---|---|---|
| GET | `/api/admin/badge-email-templates` | backend/features/admin/routes.js |
| PUT | `/api/admin/badge-email-templates` | backend/features/admin/routes.js |
| GET | `/api/admin/email-config` | backend/features/admin/routes.js |
| PUT | `/api/admin/email-config` | backend/features/admin/routes.js |
| POST | `/api/admin/email-config/test` | backend/features/admin/routes.js |
| GET | `/api/feedback/email-status` | backend/features/feedback/routes.js |
| POST | `/api/feedback/send-email` | backend/features/feedback/routes.js |
| GET | `/api/feedback/test-email` | backend/features/feedback/routes.js |
| GET | `/api/test-email-service` | backend/kioskServer.js |

**Task-sheet items for this feature**

- Set the sender email address from the admin page (exists: Email Management, sender field).

**Known issues (from the October 2026 review, line numbers refer to the layout before the restructure where noted)**

- Credentials live in backend/config/defaults/emailConfig.json (tracked from the previous team) and are copied to backend/data/ at boot; rotate them.

---
Generated from the route snapshot plus hand-written notes on 2026-10-31. Update this page when you change the feature.
