# Audit logs

**Owner:** shared

**Where the code is**

- routes inside backend/features/admin/routes.js; table audit_logs
- frontend/admin/js/audit.js

**What it does**

Every admin action is logged and listed with filters and CSV export (since 31 Oct logAudit records every action; text target ids go into target_type).

**Routes** (from tests/contracts/routes.snapshot.txt)

| Method | Path | Registered in |
|---|---|---|
| GET | `/api/admin/audit-logs` | backend/features/admin/routes.js |

**Known issues (from the October 2026 review, line numbers refer to the layout before the restructure where noted)**

- Several routes write the audit row before the auth or password check succeeds (old 3545, 3647, 4182, 4368, 4516, 4738, 5090), and EDIT_USER names the target instead of the actor (old 3850).

---
Generated from the route snapshot plus hand-written notes on 2026-10-31. Update this page when you change the feature.
