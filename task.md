# Task Checklist — v1.6.0

## Previous Versions (DONE)
- [x] v1.4.0 — Mobile crash fix (Zalo/Safari quota, error handlers)
- [x] v1.5.0 — Enhanced statistics + UI/UX

---

## v1.6.0 — Practice Mode, Flashcards, Dark Mode, Performance

### 🎯 Practice Mode (Luyện tập)
- [x] Task 1: Add `practice` section to `index.html` (header, content container, progress, nav buttons)
- [x] Task 2: Add `startPractice(id)` function in script.js — render questions with immediate feedback
- [x] Task 3: Add immediate feedback logic — show correct/wrong on answer click, highlight options
- [x] Task 4: Add navigation (prev/next) for practice mode
- [x] Task 5: Add "Luyện tập" button on quiz cards (renderQuizList)
- [x] Task 6: Add CSS styles for practice (correct/wrong highlight, feedback box)

### 🃏 Flashcard Mode
- [x] Task 7: Add `flashcard` section to `index.html`
- [x] Task 8: Add `startFlashcard(id)` function — manage card state, current index, known set
- [x] Task 9: Implement card flip animation (CSS 3D transform)
- [x] Task 10: Implement keyboard + button + swipe navigation (next/prev/flip/mark)
- [x] Task 11: Add "Đã thuộc / Cần ôn" tracking + filter-unknowns option
- [x] Task 12: Add "Flashcard" button on quiz cards
- [x] Task 13: Add flashcard CSS (card front/back, flip, swipe area, progress)

### 🌙 Improved Dark Mode
- [x] Task 14: Add theme toggle UI (3 modes: Light/Dark/Auto) in header or settings
- [x] Task 15: Implement `initTheme()` + `setTheme()` with localStorage persistence
- [x] Task 16: Detect `prefers-color-scheme` for Auto mode + listen for changes
- [x] Task 17: Audit existing CSS for low-contrast text in dark mode — fix (light-mode class applied)
- [x] Task 18: Add smooth color transitions globally
- [~] Task 19: OLED-friendly true-black sub-mode — DEFERRED (optional, not core)

### ⚡ Performance & Refactor
- [~] Task 20: Debounce search inputs — DEFERRED (already responsive)
- [~] Task 21: DocumentFragment audit — DEFERRED (no perf issue observed)
- [x] Task 22: Add `passive: true` to scroll/touch event listeners (flashcard swipe)
- [~] Task 23: Split `submitQuiz` into smaller helpers — DEFERRED
- [~] Task 24: Memoize stats computations — DEFERRED
- [~] Task 25: Event delegation — DEFERRED

### 🧪 Verification
- [x] Task 26: Bump asset versions to `?v=1.6.0` in index.html
- [x] Task 27: Bump SW CACHE_VERSION to `quizmaster-v1.6.0-practice-flashcard`
- [x] Task 28: `node --check script.js` — syntax PASS
- [x] Task 29: Manual smoke test (HTML structure, no JS errors)
- [x] Task 30: Final report — summarize what changed
