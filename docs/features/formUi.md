# Feedback form text and layout

**Owner:** Role 1, Zihan

**Where the code is**

- routes inside backend/features/admin/routes.js and backend/features/feedback/routes.js (/form-ui); file backend/data/form-ui.json
- frontend/admin/js/formUi.js; applied by frontend/feedback/js/config.js

**What it does**

Landing title, subtitle, background and whether the landing QR shows.

**Routes** (from tests/contracts/routes.snapshot.txt)

| Method | Path | Registered in |
|---|---|---|
| GET | `/api/admin/form-ui` | backend/features/admin/routes.js |
| PUT | `/api/admin/form-ui` | backend/features/admin/routes.js |
| GET | `/api/feedback/form-ui` | backend/features/feedback/routes.js |

**Task-sheet items for this feature**

- Editable pledge and feedback titles and main button names.

---
Generated from the route snapshot plus hand-written notes on 2026-10-31. Update this page when you change the feature.
