# Admin themes

**Owner:** Role 3, Jun Kai (decided 31 Oct 2026)

**Where the code is**

- routes inside backend/features/admin/routes.js; table saved_themes
- frontend/admin/js/themes.js

**What it does**

Colour themes for the admin page itself, saved per admin user.

**The Style & Theme page** (26 Nov 2026, Jun Kai, redesign option B)

- Saved themes are picture cards on top (at most 6 per account): a strip of the theme's colours, Apply (asks first when there are colour changes that are not saved, because Apply replaces the overall colours and saves them), Rename on the card itself, and Delete. The card next to them saves the current colours as a new theme.
- Every page is a row that folds open, one at a time; the first is the overall theme (tagged Global). A row says whether its page follows the overall theme or has its own colours. The editor (the switch "Use the overall theme on this page", the colour groups) waits in a hidden holder and moves into the open row, so a rebuild of the rows never removes it.
- The preview is a small admin page (header, sidebar, card, buttons) in the colours of the open row.
- "Save colour changes" keeps the colours for this account (browser storage). The page says when there are changes that are not saved yet, and every message is a line on the page instead of a popup, except the questions before Apply, Delete, Reset all and copying the overall colours.
- Colours from storage or a saved theme only reach the page as plain #hex values (themeSafeColor), and theme names are shown as text.
- Known gap: the colours of a page are not mapped onto the new card look of the redesigned pages yet (their own selectors still name the old classes), so a page with its own colours only changes where old elements remain. Mapping the theme onto the new look is a separate step.

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

- Fixed 19 Nov 2026: Save Theme always failed, because it read colour inputs that no longer exist (js/themes.js). The colours now come from themeSettings, where the swatches put them; a colour that was never changed is saved with its default. The swatches on a saved theme card use colour names a theme has today, so a card is no longer grey.
- Fixed 26 Nov 2026: theme card swatches were always grey. The strip now shows up to five colours of the theme.

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
