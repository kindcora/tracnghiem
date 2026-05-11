# Task Checklist — Fix Firefox PC Cache Issue

## Previous Fix (Mobile Crash)
- [x] Task 1: Refactor `startQuiz()` to render questions in chunks (lazy rendering).
- [x] Task 2: Ensure `resetCurrentQuestion()` and `updateQuestionStatusPanel()` still work.
- [x] Task 3: Bump `CACHE_VERSION` in `sw.js`.
- [x] Task 4: Add loading hint while chunks render.
- [x] Task 5: Verify syntax with `node --check`.

## NEW Fix (Firefox PC: clicks do nothing — stuck on home)
- [x] Task 6: Diagnose root cause → **Service Worker serving stale `script.js` on Firefox PC** (Firefox aggressively caches SW, doesn't auto-update like Chrome).
- [x] Task 7: Rewrite `sw.js` fetch strategy → **Network-first for app shell** (html/js/css) so Firefox always gets fresh code; cache-first only for CDN/static assets. Falls back to cache when offline.
- [x] Task 8: Bump cache version to `quizmaster-v1.3.0-firefoxfix`.
- [x] Task 9: Improve `registerServiceWorker()` → auto `reg.update()` on load, auto `postMessage('SKIP_WAITING')` when new SW installed, listen to `controllerchange` to **auto-reload page once** (no manual reload needed).
- [x] Task 10: Add `?v=1.3.0` cache-buster to `script.js`, `style.css`, `questions-data.js` in `index.html` to bypass HTTP cache.
- [x] Task 11: Remove duplicate `<script src="questions-data.js">` tag in `<head>` (keep only the one before `script.js`).
- [x] Task 12: Add emergency `clearCacheAndReload()` function + visible button on home page so users can self-recover when stuck on old cache.
- [x] Task 13: Verify `node --check script.js && node --check sw.js` → PASS.
- [x] Task 14: Final report.
