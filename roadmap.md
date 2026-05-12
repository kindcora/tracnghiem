# Roadmap — v1.7.0 (Performance + Quality)

## Previous Versions
- v1.4.0 — Mobile crash fix
- v1.5.0 — Enhanced statistics
- v1.6.0 — Practice Mode, Flashcards, Dark Mode
- v1.6.1 — Deferred performance tasks (memo, debounce, refactor)

---

## v1.7.0 — Goals

### 1. 🔄 Service Worker stale-while-revalidate for `questions-data.js`
**Problem:** `questions-data.js` (~250 KB) is currently treated as app-shell → network-first → forced reload required for fresh data.
**Goal:** Use **stale-while-revalidate (SWR)** so:
- User sees cached version IMMEDIATELY (fast)
- A fresh copy is fetched in background
- New quiz set is available on next page load — no forced reload required

**Implementation:**
- In `sw.js`, special-case requests matching `/questions-data\.js/`
- Return cached response if any (fast), kick off background `fetch` to update cache
- Bump `CACHE_VERSION` to `quizmaster-v1.7.0-swr-worker`

### 2. 👷 Web Worker for stats (history > 500 entries)
**Problem:** `computeStatsOverview` / `computePerQuizStats` block the main thread when history grows huge.
**Goal:** Off-load heavy aggregation to a Web Worker once `history.length > 500`.

**Implementation:**
- New file `stats-worker.js` — pure functions, no DOM access
- `script.js` adds `computeStatsAsync()` wrapper that:
  - If history ≤ 500 → run sync (current behavior, fast already)
  - If > 500 → post message to worker, await reply, then render
- Cache is still invalidated on history mutation
- Worker uses same algorithms (copy-pasted, must stay in sync)

### 3. 📝 JSDoc types for submitQuiz helpers
Add JSDoc `@param` / `@returns` annotations to:
- `_collectQuizAnswers(questions, answers)`
- `_calculateQuizScore(correct, total)`
- `_buildResultHtml(scoreInfo, correct, total, timeStr, reviewVisible)`
- `_saveQuizHistory(score, correct, total)`
- `computeStatsOverview()`
- `computePerQuizStats()`

This gives editors (VS Code) type-checking + auto-complete without TS toolchain.

### 4. 🧪 Unit tests (Vitest)
These functions are pure-ish — perfect for unit tests:
- `_collectQuizAnswers` — counts correct answers
- `_calculateQuizScore` — grade thresholds (4 buckets)
- `computeStatsOverview` — average / max / pass rate / streak
- `computePerQuizStats` — aggregation by quizId

Because the project is a plain `<script>` (no modules), we'll:
- Add `package.json` test config + dev-dep on `vitest`
- Create `tests/` directory with files that import pure helpers via a small `lib/pure.js` (extracted from script.js — or a thin `module.exports`/`export` shim using a Node loader trick).
- **Pragmatic path chosen:** create `lib/pure.js` (ESM) containing the pure helpers ONCE, then `script.js` defines wrappers that delegate (so the page still works as a script tag).
  - However that's invasive. **Better path:** copy the pure functions into `tests/_helpers.js` (re-implement / mirror) so we test the LOGIC. Drift risk = OK for now.
  - Even simpler: load `script.js` partially with a small extraction script that strips `_collectQuizAnswers` & `_calculateQuizScore` into a CommonJS module on the fly inside the test setup.
- **Final choice:** create `lib/pure.cjs` — a CommonJS file with the pure helpers, and have `script.js` re-define them (so the browser path is untouched). Drift mitigated by also adding `node --check` and a comment header pointing to the canonical file.

## Files to Modify / Add
- `sw.js` — SWR rule for `questions-data.js`, bump CACHE_VERSION
- `script.js` — JSDoc, Web Worker integration, computeStatsAsync
- `stats-worker.js` — NEW (Web Worker)
- `lib/pure.cjs` — NEW (pure helpers for Node tests)
- `tests/pure.test.cjs` — NEW (unit tests)
- `package.json` — add `vitest` (or `node --test`) + `test` script
- `index.html` — bump versions to `?v=1.7.0`
- `task.md` — checklist

## Design Decisions
- Use Node's **built-in `node:test`** runner — zero deps, ships with Node 20+. Avoids polluting `package.json` with 100+ MB of vitest. We have Node 24, so `node --test` works perfectly.
- Worker created lazily (only when needed) → no startup cost for typical users.
- Worker file `stats-worker.js` must be cached by SW (otherwise offline breaks).

---

## v1.8.0 — Floating Card UI (Hướng dẫn định dạng & Phím tắt)

### Goal
Replace 2 existing modals (`#modal` for Format Guide, `#shortcutModal` for Shortcuts) with **draggable floating cards** that:
- Float above page content (don't block interaction with the page)
- Can be dragged around the screen by header bar
- Can be minimized / closed
- Have smooth slide-in animation
- Snap to viewport edges (stay in bounds)
- Persist position in localStorage (optional)

### Design
- New CSS class `.floating-card` — fixed positioning, top-right initial, drop-shadow, glassmorphism background
- Header with: title, minimize button, close button — also serves as drag handle
- Body with content (scrollable)
- Min/max controls: minimize → only shows header (40px tall)
- Dragging: pointer events, clamp to viewport, no select during drag
- Mobile responsive: full-width with margin, drag still works via touch

### Implementation Plan
1. Add `.floating-card` CSS in `style.css`
2. Replace `#modal` & `#shortcutModal` HTML structure to floating cards (keep IDs for JS compatibility OR add new wrappers)
3. Update `showFormatGuide()` to use new floating card
4. Update shortcut button onclick to use new floating card
5. Add drag logic in `script.js` — pointer events for desktop + touch
6. Test desktop + mobile

---

# v1.9.0 — Learn Smart (4 features)

## Goals
Biến app từ "máy chấm trắc nghiệm" thành công cụ ÔN TẬP THÔNG MINH.

## 4 Features

### 1. 🚩 Bookmark câu hỏi
- Nút ⚐/🚩 góc trên-phải mỗi câu trong lúc làm bài
- Ô câu trong panel trạng thái có viền vàng + dấu cờ nhỏ nếu đã đánh dấu
- Storage `bookmarks_<quizId>` (array origIndex, idempotent qua shuffle)
- Banner trong trang kết quả + nút "🔁 Làm lại các câu đánh dấu"
- Quiz tạm `__bookmarkReviewOf` không persist

### 2. 📝 Ghi chú câu sai
- Textarea "Vì sao mình sai" trong .review-detail mỗi câu sai
- Auto-save 800ms debounce + indicator trạng thái (⏳/✅/⚠️)
- Storage `notes_<quizId>` → `{[origIndex]: text}` (giới hạn 2000 ký tự)
- Khi làm lại đề, banner accordion 📝 hiện ghi chú cũ trên câu đó
- Tương thích với quiz tạm — đọc/ghi note vào quiz GỐC

### 3. 🔁 Ôn lại câu sai
- Storage `wrongQuestions_<quizId>` → set origIndex
- `updateWrongSet` sau mỗi submit: thêm câu sai, gỡ câu đúng (đã khắc phục)
- Quiz card hiển thị badge "🔁 N sai" + nút "🔁 Ôn câu sai (N)"
- Banner trong trang kết quả: nút "🔁 Ôn câu sai ngay" hoặc "🎉 Tuyệt!" nếu sạch
- Quiz tạm `__wrongReviewOf` — submit cập nhật set quiz GỐC

### 4. 💾 Resume bài đang dở
- Auto-save mỗi 5s + trên visibilitychange/pagehide/beforeunload
- Storage `resume_<quizId>` → snapshot (answers, timeLeft, qOrder, oOrders)
- Hạn fresh 24h, quiz tạm (id<0) không lưu
- Banner xanh lá trên trang chủ liệt kê các bài đang dở (mới nhất trước)
- `resumeQuiz(id)` tái tạo shuffledQuiz từ snapshot, tick lại radio đã chọn
- Tự xóa snapshot khi submit hoặc bắt đầu làm lại

## Files Modified
- `script.js` — 4 feature blocks + hook vào renderQuestionHTML / submitQuiz / startQuiz / _buildResultHtml / renderQuizList / window.onload
- `style.css` — bookmark btn, notes accordion + textarea, wrong/bookmark badges, result-wrong/bookmark rows, resume banner
- `index.html` — `<div id="resumeBannerHost">` trong section #home; bump `?v=1.9.0`
- `sw.js` — CACHE_VERSION → `quizmaster-v1.9.0-learnsmart`

## Verify
- `node --check script.js` PASS
- `node --check sw.js` PASS


---

# v2.0.0 — Compare Mode + Accessibility Polish

## Shipped
- ✅ **Compare Mode** — so sánh 2 lần làm bài (cùng quiz hoặc khác quiz) song song: điểm, thời gian, breakdown câu đúng/sai, highlight chênh lệch.
- ✅ **Accessibility polish** — focus ring rõ hơn, aria-labels cho nút icon, keyboard nav cho floating cards, contrast tăng cho dark mode, skip-to-content link, role="dialog" + aria-modal cho floating cards.
- ✅ Bump `?v=2.0.0` ở `index.html` (style.css, questions-data.js, script.js).
- ✅ Bump `sw.js` CACHE_VERSION → `quizmaster-v2.0.0-polish`.

## Skipped / Deferred
- ⏭️ **#19 Gzip thủ công cho `questions-data.js`** — **Skipped**.
  - **Lý do:** GitHub Pages tự gzip mọi file `.js`/`.html`/`.css` trên đường truyền (transfer compression) → user thực tế đã nhận ~60 KB chứ không phải 250 KB.
  - **ROI thấp:** Chỉ tiết kiệm ở SW cache offline (vài chục KB) và case host nơi khác (chưa có kế hoạch).
  - **Chi phí cao:** Pipeline build (`build-gz.js` hoặc GitHub Actions) + loader fallback `CompressionStream` + risk regression không tương xứng với lợi ích.
  - **Re-open khi nào:** Nếu chuyển host sang nơi không tự gzip, hoặc khi `questions-data.js` vượt 1 MB.

## Verify
- `?v=2.0.0` ở `index.html` ✅
- `CACHE_VERSION = 'quizmaster-v2.0.0-polish'` ở `sw.js` ✅


---

# v2.1.0 — Tag & Progress by Topic

## Goal
Cho phép user tự gắn tag (flat, 1 cấp) vào từng câu hỏi để theo dõi tiến độ theo chủ đề, biết chỗ yếu của mình.

## Shipped (Phương án A — wrong-set snapshot)
- ✅ **Tag storage helpers** — getQuestionTags / setQuestionTags / addTagToQuestion / removeTagFromQuestion / getTagsCatalog / addToTagsCatalog / countTaggedQuestions. Cap 5 tag/câu × 30 ký tự, dedupe case-insensitive, sort theo locale i. Storage keys userTags_<quizId> + 	agsCatalog_<quizId> (đồng nhất pattern bookmark/note/wrong).
- ✅ **Tag editor floating card** — #tagEditorCard (reuse pattern v1.8.0). Mở từ nút 🏷️ Tag trên quiz card. Hiển thị: summary đếm câu đã gán + catalog count, danh sách từng câu với chip tag (× để gỡ) + input autocomplete từ <datalist> + nút Thêm/Enter.
- ✅ **Stats per-tag tab** (#tagStatsContent trong trang Stats). Bảng: Tag | Số câu | Còn sai | Accuracy | Hành động. Sort accuracy tăng dần. Highlight <70% đỏ / 70–85% vàng / ≥85% xanh. Có hàng riêng cho (Chưa phân loại). Dropdown chọn quiz tự populate khi vào trang Stats.
- ✅ **Wrong-by-tag review** — startWrongByTagReview(quizId, tag) tạo quiz tạm id âm với flag __wrongByTagOf + __wrongByTagName. Submit quiz tạm cập nhật wrong-set của quiz GỐC. Notes + result banner đọc từ quiz gốc qua chuỗi fallback __bookmarkReviewOf → __wrongByTagOf → __wrongReviewOf → id.
- ✅ Bump ?v=2.1.0 ở index.html (style.css, questions-data.js, script.js).
- ✅ Bump sw.js CACHE_VERSION → quizmaster-v2.1.0-tags.

## Deferred sang v2.2.0
- ⏭️ **Trend 7 ngày per-tag** — yêu cầu mở rộng history schema (correctMap: number[]) để biết câu nào đúng/sai trong từng lần làm. Hiện stats per-tag chỉ là snapshot wrong-set hiện tại (không có chiều thời gian). Re-open nếu thấy cần trend.

## Files Modified
- script.js — block tag storage helpers + tag editor UI + computeTagStats + populateTagStatsDropdown + renderTagStats + startWrongByTagReview + hook trong submitQuiz/note rendering.
- index.html — #tagEditorCard floating card + section #tagStatsContent + dropdown #tagStatsQuiz trong trang Stats.
- style.css — chip, row, btn-mini, meta-tag (editor) + tag-stats-table với 3 mức màu accuracy.
- sw.js — CACHE_VERSION bump.

## Design Decisions
- Phương án A (wrong-set snapshot) thay vì B (mở rộng history schema) — ship được nhanh, không bloat localStorage, đường lui rõ ràng (bump v2.2.0 thêm correctMap nếu cần).
- Tag flat, không hierarchical — đơn giản, dễ dùng cho lần đầu.
- Không preset tag mặc định — user tự gõ, autocomplete xuất hiện từ tag thứ 2 trở đi (datalist).
- Không bulk action — gán/gỡ từng câu để code gọn.
- Storage key dùng origIndex (idempotent qua shuffle) — đồng nhất với bookmark/note/wrong hiện có.
- Tag editor card reuse exact pattern floating-card của v1.8.0 — không tạo CSS mới cho header/min/close.

## Verify
- 
ode --check script.js PASS
- 
ode --check sw.js PASS
- ?v=2.1.0 ở index.html ✅
- CACHE_VERSION = 'quizmaster-v2.1.0-tags' ở sw.js ✅

---

# v2.2.0 — Performance & UX Polish

## Goal
Fix pain point UI mobile đã báo (Tùy chỉnh đề + Trạng thái câu hỏi xung đột trên iPhone Safari) + 10 targeted fix cải thiện trải nghiệm cả mobile lẫn desktop, không refactor toàn bộ.

## Shipped

### P0 — Mobile pain points (Batch A)
- ✅ **Fix #1 QSP panel** — bump z-index 110/111 + env(safe-area-inset-bottom) cho iPhone notch, đảm bảo không bị nút Nộp bài che.
- ✅ **Fix #2 Customize floating card** — full-width edge-to-edge trên mobile (10px margin), dùng dvh xử lý iOS Safari viewport shrink khi keyboard mở, tắt animation tránh giật, -webkit-overflow-scrolling:touch.
- ✅ **Fix #5 iOS Safari input zoom** — universal ont-size:16px !important cho mọi input/textarea/select trong @media (max-width:768px), cover cả #searchQuiz, #historySearch, .history-filter, #tagStatsQuiz, .tag-row-input input (input ngoài .form-group).

### P1 — Mobile UX (Batch B)
- ✅ **Fix #3 Touch target ≥44×44px** — expand (hover:none) and (pointer:coarse) cover .fc-btn, .bookmark-btn, .tag-chip-x, .qsp-toggle, .qsp-mobile-toggle, .btn-mini, .shortcut-btn, .close-btn. Tag chip × dùng padding+negative margin để vùng cảm ứng rộng mà không phá layout.
- ✅ **Fix #4 Sticky bottom action bar** — #doQuiz .btn-primary sticky bottom trên mobile, full-width edge-to-edge, font 17px bold, shadow phía trên, safe-area-inset cho iPhone notch.

### P2 — Performance + Desktop (Batch C)
- ✅ **Fix #6 Lazy-load Chart.js** — gỡ <script src="chart.js"> eager khỏi index.html, thêm ensureChartJs() Promise-based idempotent, enderStats() async await trước khi vẽ chart. Tiết kiệm ~150KB JS cho lần load đầu cho user không vào trang Stats.
- ✅ **Fix #7 Debounce search** — oninput="renderQuizList()" → debouncedRenderQuizList() 180ms (tránh re-render với 450 câu mỗi keystroke).
- ✅ **Fix #8 Hover transitions desktop** — @media (hover:hover) and (pointer:fine) smooth transitions cho .quiz-item:hover, .btn-*, .nav-btn (tránh apply lên touch device gây dính hover state).
- ✅ **Fix #9 Wide-screen layout** — container max-width 1440px (>1400px) và 1680px (>1800px), quiz-list min-card 340px gap 24px trên màn hình rộng.
- ✅ **Fix #10 Release** — bump ?v=2.2.0 + CACHE_VERSION → quizmaster-v2.2.0-polish.

## Files Modified
- style.css — 3 block append: Batch A (P0 mobile fixes), Batch B (touch+sticky), Batch C (hover+wide-screen). Tổng ~70 dòng CSS mới.
- script.js — ensureChartJs() + debouncedRenderQuizList() + enderStats thành async.
- index.html — Chart.js script tag → lazy comment, oninput → debounced, ?v=2.2.0.
- sw.js — CACHE_VERSION bump.

## Design Decisions
- Audit + targeted fixes (Phương án A) thay vì full rewrite — ROI cao, rủi ro thấp.
- Chia 3 batch (P0/P1/P2) để user test được sớm sau từng batch.
- dvh cho iOS Safari viewport (fallback h) — xử lý zoom keyboard.
- Giữ 8 console.log debug — không cleanup vì giúp debug user bug sau này.
- Quiz list đã dùng grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)) nên Fix #9 chỉ cần expand container max-width + bump min-card cho dày hơn.

## Verify
- 
ode --check script.js PASS
- 
ode --check sw.js PASS
- ?v=2.2.0 ở index.html ✅
- CACHE_VERSION = 'quizmaster-v2.2.0-polish' ở sw.js ✅
