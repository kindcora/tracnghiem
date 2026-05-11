# Task Checklist — Fix Mobile Crash (Zalo / Safari)

## Previous Fixes
- [x] Task 1-5: Chunked rendering for `startQuiz()`.
- [x] Task 6-14: Firefox cache fix + service worker improvements.

## NEW Fix (Mobile crash on "Ôn tập" — Zalo in-app browser + iOS Safari)
Error: "đã có sự cố xảy ra liên tục với https://kindcora.github.io/tracnghiem/?zasrc=30...zalo"

Root causes:
1. **localStorage QuotaExceededError** — saving 450 questions (~250KB) every page load; Zalo WebView has tiny quota → uncaught exception → page crash.
2. **No global error handler** — any uncaught error in mobile WebView triggers "repeatedly occurred" message.
3. **Heavy `JSON.parse(JSON.stringify())`** on 450 questions in `prepareQuizForDoing()` — memory spike on low-end devices.
4. **First 20 questions rendered synchronously** — still too heavy for older mobile.
5. **No try-catch** in critical paths (`startQuiz`, `startPreloadedQuiz`, `loadPreloadedQuizzes`).

- [x] Task 15: Wrap `localStorage.setItem` in safe helper with try-catch + quota fallback. (`safeSetItem` + `safeGetItem` added)
- [x] Task 16: Stop persisting preloaded quizzes to localStorage (kept in memory with `__preloaded` flag; `saveQuizzes()` filters them out).
- [x] Task 17: Replace `JSON.parse(JSON.stringify())` with lightweight shallow clone in `prepareQuizForDoing()`.
- [x] Task 18: Added global `window.error` + `unhandledrejection` handlers showing toast instead of crashing.
- [x] Task 19: Wrapped `startQuiz`, `startPreloadedQuiz`, `loadPreloadedQuizzes` in try-catch.
- [x] Task 20: Reduced FIRST_BATCH from 20 → 10; chunkSize 25 → 15; switch view immediately before lazy render.
- [x] Task 21: Bumped service worker `CACHE_VERSION` → `quizmaster-v1.4.0-mobilefix`.
- [x] Task 22: Bumped asset version `?v=1.4.0` in `index.html`.
- [x] Task 23: Verified with `node --check script.js && node --check sw.js` — both PASS.
- [x] Task 24: Final report.
