# Roadmap — Fix Mobile Crash on "Ôn tập" (v1.4.0)

## Problem
On mobile devices — especially **Zalo in-app browser** (URL contains `?zasrc=30...utm_source=zalo`) and **iOS Safari** — clicking **"Ôn tập"** causes the page to crash with:
> Đã có sự cố xảy ra liên tục với https://kindcora.github.io/tracnghiem/?zasrc=30...

This message appears on iOS Safari when the page throws an uncaught error or runs out of memory multiple times — Safari then refuses to keep reloading.

## Root Causes Identified

### 1. localStorage QuotaExceededError (PRIMARY)
`loadPreloadedQuizzes()` and `startPreloadedQuiz()` call:
```js
localStorage.setItem('quizzes', JSON.stringify(quizzes));
```
With 450 questions (~250KB JSON), this can fail on:
- **Zalo WebView** — very restricted storage quota (often <2MB)
- **iOS Safari Private mode** — localStorage quota = 0, every write throws
- **Older iOS** — 5MB total but already filled by other sites

The throw is **uncaught** → page crashes → Safari shows "repeatedly occurred".

### 2. No global error handler
Any uncaught JS error or promise rejection in a mobile WebView triggers the OS-level "page crash" UI.

### 3. Heavy deep clone
`JSON.parse(JSON.stringify(quiz.questions))` on 450 questions allocates ~500KB twice → can trigger OOM on low-RAM phones.

### 4. First 20 questions still sync
Even with chunked rendering, the initial 20 questions are rendered synchronously via `innerHTML` — heavy on low-end devices.

### 5. No try-catch on critical paths
`startQuiz`, `startPreloadedQuiz`, `loadPreloadedQuizzes` — any failure cascades to full page crash.

## Fix Strategy

1. **Safe localStorage wrapper** — `safeSetItem()` that try-catches QuotaExceededError, falls back to in-memory only.
2. **Don't persist preloaded quizzes** — `window.PRELOADED_QUIZZES` is reloaded fresh each visit anyway; only persist user-created quizzes.
3. **Lightweight clone** — only clone the per-question fields actually mutated (options + correct), not the whole object tree.
4. **Global error handlers** — `window.onerror` + `unhandledrejection` → show toast, swallow the error so Safari doesn't kill the page.
5. **try-catch** in critical functions.
6. **Smaller first batch** (10 instead of 20) + RAF-deferred initial paint.
7. **Bump cache version** to force update on all devices.

## Tech Stack
- Vanilla JS
- Service Worker (network-first for app shell)
- localStorage (now with quota-safe wrapper)

## Files to Modify
- `script.js` — safe storage, error handlers, try-catch, lightweight clone
- `sw.js` — bump CACHE_VERSION → v1.4.0-mobilefix
- `index.html` — bump `?v=1.4.0` query params


---

# v1.5.0 — UI/UX + Enhanced Statistics

## Goals
Make the stats page (Thống kê) much more useful and visually appealing:
- Track learning progress over time (streaks, time-based windows)
- Per-quiz performance analysis
- Ability to manage history (delete individual entries, export, filter)
- Modern card UI with icons, animations, better empty states

## New Features

### Statistics
1. **Streak counter** — Count consecutive quiz attempts with score ≥ 5.
2. **Per-quiz stats card** — For each quiz attempted: best score, avg score, attempt count.
3. **Time-window stats** — Quizzes done today / this week / this month.
4. **Time spent tracking** — Add `timeSpent` (seconds) to each history entry (computed from quiz start → submit).
5. **Export history CSV** — Download full history as CSV.
6. **Filter history** — Filter by score range and date range.

### UI/UX
1. **Modern stat cards** — Each card has an icon (📊 📈 🏆 🔥 ⏱️), unique gradient, hover lift animation.
2. **History management** — Per-item delete button (🗑️), clear-all button, search/filter bar.
3. **Empty states** — Friendly illustrations (emoji) + helpful text when no data.
4. **Mobile responsive** — Stack stat cards on small screens, keep readable.

## Files to Modify
- `script.js` — `renderStats()` rewrite, history filter/delete/export, time tracking in `startQuiz` + `submitQuiz`.
- `style.css` — New stat card variants, history item layout, animations.
- `index.html` — Bump asset versions to `?v=1.5.0`, possibly new DOM nodes for new stat sections.
- `sw.js` — Bump CACHE_VERSION to `quizmaster-v1.5.0-uiux-stats`.

## Design Decisions
- Time spent: stored as number of seconds (integer) so older history without it stays compatible (use `?? 0`).
- Streak: walk backwards through history (sorted by timestamp desc); count entries until score < 5.
- Charts: keep existing Chart.js line + doughnut. Add a third bar chart for per-quiz best scores (top 5).
- All new UI must work in light & dark mode (use CSS variables).
- Mobile-first: stat-card grid `repeat(auto-fit, minmax(140px, 1fr))` so 2 cards fit on phones.
