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
