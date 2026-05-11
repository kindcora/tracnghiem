# Task Checklist — v1.7.0

## 🔄 Service Worker SWR
- [x] Task 1: Detect `questions-data.js` request in sw.js fetch handler
- [x] Task 2: Implement stale-while-revalidate (return cached, refresh in background)
- [x] Task 3: Add `stats-worker.js` to STATIC_FILES (precache)
- [x] Task 4: Bump CACHE_VERSION to `quizmaster-v1.7.0-swr-worker`

## 👷 Web Worker for stats
- [x] Task 5: Create `stats-worker.js` — pure compute on `self.onmessage`
- [x] Task 6: Add `computeStatsAsync()` wrapper in script.js (uses worker if history>500)
- [x] Task 7: Wire `renderStats` to await async path when needed (still sync if small)
- [x] Task 8: Cache worker instance + terminate on idle

## 📝 JSDoc types
- [x] Task 9: JSDoc `_collectQuizAnswers`
- [x] Task 10: JSDoc `_calculateQuizScore`
- [x] Task 11: JSDoc `_buildResultHtml`
- [x] Task 12: JSDoc `_saveQuizHistory`
- [x] Task 13: JSDoc `computeStatsOverview` / `computePerQuizStats`
- [x] Task 14: Add typedef `QuizQuestion`, `HistoryEntry`, `ScoreInfo`, `StatsOverview`

## 🧪 Unit tests (node:test)
- [x] Task 15: Create `lib/pure.cjs` with the four pure helpers (mirror of script.js)
- [x] Task 16: Create `tests/pure.test.cjs` — tests for `_collectQuizAnswers`
- [x] Task 17: Tests for `_calculateQuizScore` (all 4 grade buckets)
- [x] Task 18: Tests for `computeStatsOverview`
- [x] Task 19: Tests for `computePerQuizStats`
- [x] Task 20: Update `package.json` — add `test` script using `node --test`

## 🔁 Verification
- [x] Task 21: Bump versions to `?v=1.7.0` in index.html
- [x] Task 22: `node --check sw.js` PASS
- [x] Task 23: `node --check script.js` PASS
- [x] Task 24: `node --check stats-worker.js` PASS
- [x] Task 25: `npm test` (node --test) PASS — 22/22 ✅
- [x] Task 26: Final report
