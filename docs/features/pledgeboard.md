# Pledgeboard

**Owner:** Role 1, Zihan (decided 31 Oct 2026; it is on nobody's task sheet)

**Where the code is**

- backend/features/pledgeboard/routes.js
- frontend/Pledgeboard/
- frontend/admin/js/pledgeboard.js (moderation tab)

**What it does**

Public list of pledges with likes and a search box; phones reach it after submitting feedback. The admin tab approves or rejects pledges and edits the topic list.

**Routes** (from tests/contracts/routes.snapshot.txt)

| Method | Path | Registered in |
|---|---|---|
| GET | `/api/pledgeboard` | backend/features/pledgeboard/routes.js |
| GET | `/api/pledgeboard/admin/pledges` | backend/features/pledgeboard/routes.js |
| PUT | `/api/pledgeboard/admin/pledges/:feedbackId/status` | backend/features/pledgeboard/routes.js |
| GET | `/api/pledgeboard/admin/topics` | backend/features/pledgeboard/routes.js |
| PUT | `/api/pledgeboard/admin/topics` | backend/features/pledgeboard/routes.js |
| GET | `/api/pledgeboard/check-like/:feedbackId` | backend/features/pledgeboard/routes.js |
| POST | `/api/pledgeboard/like/:feedbackId` | backend/features/pledgeboard/routes.js |
| GET | `/api/pledgeboard/pledges` | backend/features/pledgeboard/routes.js |
| GET | `/api/pledgeboard/topics` | backend/features/pledgeboard/routes.js |
| DELETE | `/api/pledgeboard/unlike/:feedbackId` | backend/features/pledgeboard/routes.js |
| GET | `/pledgeboard` | backend/kioskServer.js |

**Known issues (from the October 2026 review, line numbers refer to the layout before the restructure where noted)**

- Phones are always bounced off /pledgeboard: server.js 150 needs a session flag that nothing sets.
- Unlimited likes: the identity is a browser-made string sent in the body (Pledgeboard.js 65, routes 161).
- The public /pledges API returns every visitor's survey answers and photo ids (routes 62).
- One check-like request per pledge on every search keystroke (Pledgeboard.js 386).
- Moderation and topic routes have no auth (routes 378, 423).

---
Generated from the route snapshot plus hand-written notes on 2026-10-31. Update this page when you change the feature.
