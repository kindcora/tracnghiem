# Roadmap — Fix Mobile Crash on "Ôn tập"

## Problem
When tapping **"Ôn tập"** on mobile (especially **Zalo in-app browser**), the page crashes with:
> A problem repeatedly occurred on https://kindcora.github.io/tracnghiem/...

## Root Cause
`startQuiz()` in `script.js` (line 708) renders **ALL 450 questions at once** via a single `innerHTML` assignment:
- 450 questions × (1 heading + 4 radio labels) ≈ 2,250+ DOM nodes
- Single massive synchronous reflow
- Exceeds memory limit of mobile WebView (especially Zalo's in-app browser)
- Result: "A problem repeatedly occurred" crash

## Fix Strategy — Chunked / Lazy Rendering
1. Render first batch (e.g., 30 questions) immediately so user sees content fast.
2. Defer remaining questions in batches of 30 via `requestIdleCallback` (fallback to `setTimeout`).
3. Keep all existing features:
   - Status panel (qspGrid) — already created separately, works fine
   - `navigateQuestion`, `jumpToQuestion` — both use `querySelectorAll('.do-question')` AFTER they exist
   - Swipe gestures, keyboard shortcuts — unchanged
   - Auto-submit, scoring — unchanged

## Additional Improvements
- Bump service worker cache version to force-refresh old cached code on devices.
- Add a small "Đang tải đề..." hint while chunks render (optional).

## Tech Stack
- Vanilla JS (no framework)
- Service Worker for offline
- localStorage for persistence

## Files to Modify
- `script.js` — refactor `startQuiz()` for chunked rendering
- `sw.js` — bump CACHE_VERSION to invalidate old cached script.js
