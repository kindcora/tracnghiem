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

---

# Task Checklist — v1.8.0 (Floating Card UI)

## 🎨 CSS
- [x] Task 1: Add `.floating-card` styles (fixed pos, glassmorphism, shadow, animation)
- [x] Task 2: Add `.fc-header`, `.fc-body`, `.fc-controls` styles
- [x] Task 3: Add `.fc-minimized` state (collapsed to header)
- [x] Task 4: Mobile responsive styles

## 🏗️ HTML
- [x] Task 5: Replace `#modal` markup with floating card structure (keep id for JS compat)
- [x] Task 6: Replace `#shortcutModal` markup with floating card structure

## ⚙️ JS
- [x] Task 7: Update `showFormatGuide()` — open as floating card
- [x] Task 8: Add `openFloatingCard(id)` / `closeFloatingCard(id)` helpers
- [x] Task 9: Add drag logic (pointer events + touch)
- [x] Task 10: Add minimize/maximize toggle
- [x] Task 11: Keep Esc closes, ? toggles shortcut card
- [x] Task 11b: Migrate customizeQuiz/saveQuizCustomization/export-no-quizzes to floating card
- [x] Task 11c: Bump version to v1.8.0 (CSS, JS, SW cache)

## ✅ Verify
- [x] Task 12: `node --check script.js` PASS
- [x] Task 13: `node --check sw.js` PASS
- [ ] Task 14: Manual test desktop + mobile (user action)

---

# Task Checklist — v1.9.0

## 🚩 Feature 1: Bookmark
- [x] Helper block `getBookmarks/setBookmarks/toggleBookmark` (origIndex-based, idempotent)
- [x] `__origIndex` tagging trong `prepareQuizForDoing`
- [x] Nút bookmark trong `renderQuestionHTML`
- [x] Sync class `.bookmarked` cho qsp-cell trong init + update
- [x] Banner kết quả + nút "Làm lại các câu đánh dấu"
- [x] `startBookmarkedReview` (quiz tạm id âm, `__bookmarkReviewOf`)
- [x] CSS .bookmark-btn + .qsp-cell.bookmarked + .result-bookmark-row

## 📝 Feature 2: Notes
- [x] Helper block `getNote/setNote` + debounce save
- [x] Textarea trong .review-detail câu SAI
- [x] Banner accordion trên .do-question khi câu có note
- [x] Tương thích với quiz tạm — đọc note quiz gốc qua __bookmarkReviewOf
- [x] CSS .do-question-note + .review-note + .note-save-status

## 🔁 Feature 3: Wrong-set review
- [x] Helper `getWrongSet/updateWrongSet/startWrongReview`
- [x] Hook trong submitQuiz cập nhật set sau khi tính điểm
- [x] Badge `meta-warn` trên quiz card + nút "Ôn câu sai"
- [x] Case 'wrong' trong delegated switch
- [x] Banner kết quả `result-wrong-row` (đỏ nếu còn / xanh "🎉 Tuyệt!" nếu hết)
- [x] CSS .meta-warn + .meta-bm + .result-wrong-row

## 💾 Feature 4: Resume
- [x] Helper block `snapshotResume/startResumeAutoSave/findResumes/resumeQuiz/clearResume/renderResumeBanner`
- [x] Hook trong startQuiz: clear + start autosave (chỉ id ≥ 0)
- [x] Hook trong submitQuiz: stop autosave + clear resume
- [x] `<div id="resumeBannerHost">` trong index.html
- [x] Gọi `renderResumeBanner()` trong window.onload
- [x] CSS .resume-banner + animation

## Release
- [x] Bump sw.js CACHE_VERSION → quizmaster-v1.9.0-learnsmart
- [x] Bump index.html ?v=1.9.0
- [x] `node --check script.js` PASS
- [x] `node --check sw.js` PASS
- [ ] Manual test 4 features trên desktop + mobile (user action)

