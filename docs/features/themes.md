# Admin themes

**Owner:** Role 3, Jun Kai (decided 31 Oct 2026)

**Where the code is**

- routes inside backend/features/admin/routes.js; table saved_themes
- frontend/admin/js/themes.js

**What it does**

Colour themes for the admin page itself, saved per admin user.

**Routes** (from tests/contracts/routes.snapshot.txt)

| Method | Path | Registered in |
|---|---|---|
| GET | `/api/admin/saved-themes` | backend/features/admin/routes.js |
| POST | `/api/admin/saved-themes` | backend/features/admin/routes.js |
| DELETE | `/api/admin/saved-themes/:id` | backend/features/admin/routes.js |
| PUT | `/api/admin/saved-themes/:id` | backend/features/admin/routes.js |
| PUT | `/api/admin/saved-themes/:id/activate` | backend/features/admin/routes.js |
| GET | `/api/admin/saved-themes/active` | backend/features/admin/routes.js |
| POST | `/api/admin/saved-themes/deactivate-all` | backend/features/admin/routes.js |

**Known issues (from the October 2026 review, line numbers refer to the layout before the restructure where noted)**

- Save Theme always fails: it reads colour inputs that no longer exist (js/themes.js).
- Theme card swatches are always grey.

---
Generated from the route snapshot plus hand-written notes on 2026-10-31. Update this page when you change the feature.

## Light / Dark mode (12 Nov 2026, supervisor meeting 04 admin UI review)
- One button in the top bar, left of the user name: a moon in light mode, a sun in dark mode. The choice is kept per
  browser (`localStorage.adminColorScheme`) and also applies to the login page.
- `frontend/admin/js/colorScheme.js` is loaded in `<head>` right after `admin.css`, so a dark page never flashes
  white. It sets `data-theme` on `<html>` and builds, once per page load, a dark twin of every colour rule in
  `admin.css` under `html[data-theme="dark"]`: light surfaces become dark (keeping a hint of their hue), dark text
  becomes light, light lines become dim, mid colours (a blue button, a red badge) stay. Every colour declaration of a
  rule is copied, changed or not, so the cascade between rules stays as in light mode. Pages added later follow
  without extra CSS.
- Colours that page scripts write into `style=""` get the same treatment while dark mode is on (a MutationObserver),
  and go back to their light values when light mode returns.
- `admin.css` holds only the dark values of the theme variables (`--theme-*`, the greys, the login card) and the button.
- The Style & Theme Settings colours are made for light mode: they rest while dark mode is on (the
  `#dynamic-theme-styles` element gets `media="not all"`); the theme preview keeps showing the light theme.
- Chart.js graphs get light text and grid lines; the Hardware graphs redraw at once (the `admin-color-scheme` event)
  and the dark-slate Disk line turns light grey.
- Checked with a script that opens all 27 admin pages in dark mode and lists text under 3:1 contrast: 87 spots before
  the fixes, 12 after, and those 12 are the same in light mode (greyed-out Previous / Next buttons, white text on the
  green and amber buttons, the light theme preview).
