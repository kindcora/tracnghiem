# Task Checklist — Fix Mobile Crash on "Ôn tập"

- [x] Task 1: Refactor `startQuiz()` in `script.js` to render questions in chunks (lazy rendering) to prevent mobile WebView crash.
- [x] Task 2: Ensure `resetCurrentQuestion()` and `updateQuestionStatusPanel()` still work correctly after chunked render. (First batch of 20 questions renders synchronously → first `.do-question` always exists when `resetCurrentQuestion` runs.)
- [x] Task 3: Bump `CACHE_VERSION` in `sw.js` (now `quizmaster-v1.2.0-lazyrender`) so mobile devices fetch the fixed code (invalidate old cache).
- [x] Task 4: Add a small loading hint (`⏳ Đang tải đề... X/Y câu`) while chunks render.
- [x] Task 5: Verify syntax with `node --check script.js` and `node --check sw.js` → both PASS.
- [x] Task 6: Final report with summary of changes.
