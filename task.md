# Task Checklist — v1.6.1 (Complete Deferred Tasks)

## Previous Versions (DONE)
- [x] v1.4.0 — Mobile crash fix (Zalo/Safari quota, error handlers)
- [x] v1.5.0 — Enhanced statistics + UI/UX
- [x] v1.6.0 — Practice Mode, Flashcards, Dark Mode, Performance (partial)

---

## v1.6.1 — Completing All Deferred Tasks from v1.6.0

### 🌙 OLED Dark Mode
- [x] Task 1: Add OLED (true-black) sub-mode toggle in theme settings
- [x] Task 2: Add CSS `.oled-mode` overrides (#000 background)
- [x] Task 3: Persist OLED preference in localStorage

### ⚡ Performance: Debounce Search
- [x] Task 4: Create generic `debounce(fn, ms)` helper utility
- [x] Task 5: Apply 300ms debounce to `searchQuiz` input (renderQuizList)
- [x] Task 6: Apply 300ms debounce to `historySearch` input

### ⚡ Performance: DocumentFragment (AUDITED — already optimal)
- [x] Task 7: Audit `renderQuizList()` — uses `arr.map().join('')` single innerHTML (faster than DocFragment for HTML strings)
- [x] Task 8: Audit `renderHistoryList()` / `renderPerQuizStats()` / `renderTimeWindowStats()` — same optimal pattern
- [x] Task 9: No `innerHTML +=` patterns found in codebase (grep confirmed 0 matches)

### 🧩 Refactor: Split submitQuiz
- [x] Task 10: Identify logical chunks in `submitQuiz()` (~185 lines)
- [x] Task 11: Extract `_collectQuizAnswers()` helper
- [x] Task 12: Extract `_calculateQuizScore()` helper
- [x] Task 13: Extract `_buildResultHtml()` helper
- [x] Task 14: Extract `_saveQuizHistory()` helper (with stats cache invalidation hook)

### 💾 Performance: Memoize Stats
- [x] Task 15: Add stats cache invalidated on history mutation (saveHistory hook)
- [x] Task 16: Memoize `computeStatsOverview()` / overview numbers
- [x] Task 17: Memoize `computePerQuizStats()` per-quiz aggregation

### 🎯 Performance: Event Delegation
- [x] Task 18: Replace 7×N onclick on quiz cards with delegated #quizList handler (data-action)
- [x] Task 19: Replace per-row onclick on history list with delegated #historyList handler (data-ts)

### 🧪 Verification
- [x] Task 20: Bump versions to `?v=1.6.1` in index.html (style.css, questions-data.js, script.js)
- [x] Task 21: Bump SW CACHE_VERSION to `quizmaster-v1.6.1-deferred-done`
- [x] Task 22: `node --check script.js` — syntax PASS ✅
- [x] Task 23: `node --check sw.js` — syntax PASS ✅
- [x] Task 24: Final report
