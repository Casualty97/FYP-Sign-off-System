# Audit logs

**Owner:** shared

**Where the code is**

- routes inside backend/features/admin/routes.js; table audit_logs
- frontend/admin/js/audit.js

**What it does**

Every admin action is logged and listed with filters and CSV export.

**Routes** (from tests/contracts/routes.snapshot.txt)

| Method | Path | Registered in |
|---|---|---|
| GET | `/api/admin/audit-logs` | backend/features/admin/routes.js |

---
Generated from the route snapshot plus hand-written notes on 2026-10-31. Update this page when you change the feature.
