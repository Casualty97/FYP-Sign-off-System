# Feedback questions

**Owner:** Role 1, Zihan

**Where the code is**

- routes inside backend/features/admin/routes.js and backend/features/feedback/routes.js; tables questions and question_options
- frontend/admin/js/questions.js; rendered by frontend/feedback/js/questions.js

**What it does**

Admins create, order and delete the ESG questions and their options; the kiosk renders them. Since 31 Oct the admin list also shows inactive questions so they can be re-activated.

**Routes** (from tests/contracts/routes.snapshot.txt)

| Method | Path | Registered in |
|---|---|---|
| GET | `/api/admin/feedback/:id/questions` | backend/features/admin/routes.js |
| GET | `/api/admin/questions` | backend/features/admin/routes.js |
| POST | `/api/admin/questions` | backend/features/admin/routes.js |
| DELETE | `/api/admin/questions/:id` | backend/features/admin/routes.js |
| PUT | `/api/admin/questions/:id` | backend/features/admin/routes.js |
| GET | `/api/feedback/questions` | backend/features/feedback/routes.js |

**Known issues (from the October 2026 review, line numbers refer to the layout before the restructure where noted)**

- Required questions are enforced client-side only (feedback/routes.js validationRules never checks the answers).

---
Generated from the route snapshot plus hand-written notes on 2026-10-31. Update this page when you change the feature.
