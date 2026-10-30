# System and LLM health (planned)

**Owner:** Role 3, Jun Kai

**Where the code is**

- to be created: backend/features/health/ and frontend/admin/js/health.js; today only /api/status, /api/test-db and the dashboard alerts exist

**What it does**

Planned: database, Ollama, disk, kiosk reachability and tablet battery on one page with alerts.

**Routes** (from tests/contracts/routes.snapshot.txt)

| Method | Path | Registered in |
|---|---|---|
| GET | `/api/network-interfaces` | backend/kioskServer.js |
| GET | `/api/server-info` | backend/kioskServer.js |
| GET | `/api/status` | backend/kioskServer.js |
| GET | `/api/test-db` | backend/kioskServer.js |

**Task-sheet items for this feature**

- System and application health monitoring; the supervisor has nothing specific in mind for "LLM training and anomaly detection", so the team defines it.

---
Generated from the route snapshot plus hand-written notes on 2026-10-31. Update this page when you change the feature.
