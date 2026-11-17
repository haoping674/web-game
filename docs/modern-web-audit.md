# Modern web improvements (2026-11-17)

Scope: the two language homepages and all 12 game routes, retaining the existing visuals, game rules and browser fallbacks. No dependencies added.

## Changes

- Move the existing Google Fonts request from CSS `@import` into the document head and preconnect its two origins. Preserve the font families, weights and `display=swap`. This removes a discovery waterfall; no field Core Web Vitals improvement is claimed.
- Keep an `h1` during Orchard Ten, Color Links and Slide Ten gameplay, using the existing game-name position. Retain compact title bars in landscape.
- Focus the new route's heading after SPA navigation, including lazy-loaded routes. Initial page loads and normal rerenders do not steal focus. Home skip links target focusable headings; game pages have a skip link too.
- Centralize background `inert` handling for shared overlays, preserving attributes owned by paused games. Include native disclosures in keyboard navigation and exclude disabled, hidden and closed-disclosure controls. Callback changes do not reset focus. Stacked share/result dialogs restore the correct background state.
- Retain custom overlays because the independent PWA update prompt must remain operable while a dialog is open. Native `showModal()` would make that prompt inert. The existing keyboard-accessibility test for the prompt remains in place.
- Respect IME composition in custom game/dialog keyboard handlers, including the `keyCode === 229` fallback. Leave native leaderboard form submission alone: the retrieved guide says native implicit submission already suppresses IME-confirmation Enter.
- Remove root horizontal clipping. Keep board geometry and local decorative clipping. Enable the existing safe-area layout through `viewport-fit=cover`; account for all four insets in dialogs. Give compact touch controls a minimum 44px hit area without resizing board cells. Add focus styling for disclosures and preserve Ashbound's dark-theme focus color.

## Validation

- `npm run lint`
- `npm test -- --maxWorkers=4 --reporter=dot`: 45 files, 371 tests passed. The first unrestricted parallel run hit the existing one-second lazy Ashbound lookup timeout; the focused suite and bounded full run passed without changing that timeout.
- `npm run build`: TypeScript, compiled API startup and Vite/PWA output passed.
- `npm run check:seo-build`: 14 generated canonical pages, assets, non-JS content and crawlable links passed.
- `scripts/verify-modern-web-ui.py`: 42 route/viewport checks passed on the final production preview: all 14 routes at 1440×900, 390×900 and 320×900, including settings dialogs. Checks headings, main landmark, page exceptions, page overflow, dialog bounds and mobile settings target heights. Representative before/after screenshots were visually inspected, including home, Length Sense and dark Ashbound.
- `scripts/verify-modern-web-interactions.py`: 52 gameplay checks passed on the final production preview: Chinese/English gameplay and sense-game results; Chinese result/share stack; pause/resume and settings; home skip link and lazy route focus. Runs at 1440×900, 390×844, 320×740 and 844×390. Checks heading presence, overflow, background isolation, focus cycling and removal of inert restrictions after resume/share. Virtual time advances Slide Ten to its result.
- The browser's accessibility tree was also inspected on English Length Sense and its shared settings: the dialog hides background content and receives focus.

Reproduce browser checks after starting `npm run preview -- --host 127.0.0.1 --port 4173`:

```powershell
$env:WEB_GAME_URL='http://127.0.0.1:4173'
$env:AUDIT_PHASE='production'
python scripts/verify-modern-web-ui.py
python scripts/verify-modern-web-interactions.py
```

Requires Python Playwright and installed Chrome. Reports and screenshots are saved under ignored `reports/modern-web/`. Layout and interaction checks mock leaderboard responses; they do not validate the live database or publish scores. Browser runs use OS reduced motion. Existing tests cover settings and PWA behavior.

In this Chrome/Playwright environment, full-page screenshots clear touch emulation. Both scripts explicitly restore it through CDP after a full-page capture; the route checker verifies the coarse-pointer media query before measuring mobile targets.

## Guidance and limits

Retrieved guides: `accessibility`, `form-factor-adaptation`, `performance`, `dialog`, `ime-safe-enter-submit`. The custom-overlay choice above preserves an intentional product behavior rather than forcing a native API migration.

`legacy-scan src --json` reported five copy/sort/reverse array patterns in board analysis, simulators and scoring. They have no confirmed page defect or measured performance cost and were retained to avoid unrelated game-algorithm churn. The scanner covers about 20% of the guidance corpus, so its findings are not a complete audit.

Validation uses desktop Chrome and mobile viewport/touch emulation. It does not establish Safari/iOS behavior, physical-device notch behavior, screen-reader usability, WCAG conformance or measured LCP/INP/CLS gains. No production deployment was performed.
