# Kiosk parameters (shared settings)

**Owner:** Role 1, Zihan and Role 3, Jun Kai

**Where the code is**

- backend/features/parameters/store.js (defaults and backend/data/parametersConfig.json)
- parameters routes still inside backend/features/admin/routes.js; public GET /api/parameters in server.js
- frontend/admin/js/parameters.js; read by frontend/feedback/js/config.js and tree.js

**What it does**

One JSON file with the consent and pledge wording, validation rules, feature flags, photo settings, archive settings, tree parameters and email texts. The admin form edits it; the kiosk and tree read it.

**Routes** (from tests/contracts/routes.snapshot.txt)

| Method | Path | Registered in |
|---|---|---|
| GET | `/api/admin/parameters` | backend/features/admin/routes.js |
| PUT | `/api/admin/parameters` | backend/features/admin/routes.js |
| GET | `/api/admin/parameters/:category` | backend/features/admin/routes.js |
| PUT | `/api/admin/parameters/:category` | backend/features/admin/routes.js |
| POST | `/api/admin/parameters/reset` | backend/features/admin/routes.js |
| GET | `/api/parameters` | backend/kioskServer.js |

**Task-sheet items for this feature**

- Hide the email-pattern setting from the admin page.
- Editable pledge and feedback titles and button names.

**Known issues (from the October 2026 review, line numbers refer to the layout before the restructure where noted)**

- getNumberValue turns an empty box into 0, and blank text fields are saved as "" (store.js 217; parameters.js 529): the form should keep the previous value or the default instead.
- Settings files are written non-atomically and a corrupt parametersConfig.json is silently replaced by the defaults on the next save (store.js 248-271; same pattern in email/configStore.js, templateStore.js, assets/store.js, analysis/cacheStore.js).

---
Generated from the route snapshot plus hand-written notes on 2026-10-31. Update this page when you change the feature.
