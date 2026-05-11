# Roadmap — Fix Mobile Crash on "Ôn tập" (v1.4.0)

## Problem
On mobile devices — especially **Zalo in-app browser** (URL contains `?zasrc=30...utm_source=zalo`) and **iOS Safari** — clicking **"Ôn tập"** causes the page to crash.

## Fix Strategy (Done)
1. Safe localStorage wrapper — `safeSetItem()` that try-catches QuotaExceededError
2. Don't persist preloaded quizzes
3. Lightweight clone instead of deep JSON clone
4. Global error handlers
5. Smaller first batch + RAF-deferred paint
6. Cache version bump

---

# v1.5.0 — UI/UX + Enhanced Statistics (DONE)
- Streak counter, per-quiz stats, time-window stats
- Export history CSV, filter history
- Modern stat cards, history management

---

# v1.6.0 — Practice Mode, Flashcards, Dark Mode, Performance

## Goals
1. **Practice Mode (Luyện tập)** — Learn-by-doing without time pressure
2. **Flashcard Mode** — Visual card-based study for memorization
3. **Better Dark Mode** — Improved contrast, OLED black, system-pref detection
4. **Performance refactor** — Optimize hot paths, event delegation, reduce reflows

## New Features Detailed

### 🎯 Practice Mode (Luyện tập)
- New button on each quiz card: "📖 Luyện tập"
- **No timer** — relaxed learning
- **Immediate feedback** — when user picks an answer:
  - Correct → highlight green + show ✅
  - Wrong → highlight red + show correct answer in green + explanation if any
- **No history saved** (not a real test attempt)
- **Navigation** — Prev/Next buttons + question jump grid
- **Progress shown** — "3/20 đúng so far"
- **Restart button** — reset and re-practice with new shuffle

### 🃏 Flashcard Mode
- New button on each quiz card: "🃏 Flashcard"
- **Front of card** — Question text only (large, centered)
- **Back of card** — All options + the correct answer highlighted
- **Click/tap card** → flip animation (CSS 3D transform)
- **Swipe / arrow keys / buttons** → next or previous card
- **Mark known/unknown** — 👍 "Đã thuộc" / 👎 "Cần ôn lại" buttons
- **Cycle through unknowns** — option to filter only "unknowns" on next round
- **Progress bar** — X/total seen, Y marked known
- **Auto-flip option** — flip back after N seconds (off by default)

### 🌙 Improved Dark Mode
- **System preference detection** — `prefers-color-scheme: dark`
- **3 modes**: Light / Dark / Auto (system)
- **Better contrast ratios** — WCAG AA compliant
- **Smoother transitions** — `transition: background-color 0.3s, color 0.3s` everywhere
- **OLED-friendly option** — true black (`#000`) for OLED screens (toggle)
- **Fix any low-contrast text** in current dark theme

### ⚡ Performance & Refactor
- **Event delegation** — Replace inline `onclick` on rendered items with delegated listeners where possible
- **Debounce search inputs** — `historySearch`, `searchQuiz` (300ms)
- **DocumentFragment** instead of `innerHTML +=` in loops
- **Memoize computed stats** — recompute only when history changes
- **Lazy-load Chart.js** — only when stats page is opened
- **Remove duplicate code** — share helpers between `startQuiz` lazy-render and review render
- **Split very long functions** — `submitQuiz` (185 lines) → break into helpers
- **Use `passive: true`** on scroll/touch listeners

## Tech Stack
- Vanilla JS (no framework added)
- CSS variables for theming
- CSS 3D transforms for flashcard flip
- Service Worker bump → `quizmaster-v1.6.0-practice-flashcard`

## Files to Modify
- `index.html` — New sections (`practice`, `flashcard`), theme toggle UI, bump `?v=1.6.0`
- `script.js` — New functions: `startPractice()`, `startFlashcard()`, `initTheme()`, refactors
- `style.css` — Practice/flashcard styles, improved dark theme, transitions
- `sw.js` — Bump CACHE_VERSION
- `task.md` — New task checklist

## Design Decisions
- Practice mode does **NOT** save to history (it's learning, not testing)
- Flashcard uses **same quiz data** (no new data structure needed); "known" state stored in `sessionStorage` only (not persisted long-term)
- Theme stored in `localStorage` as `theme` = `'light' | 'dark' | 'auto'`
- All new UI mobile-first; flashcard sized to fit phone screen with comfortable swipe area
- Use CSS `prefers-reduced-motion` to disable flip animation for accessibility
