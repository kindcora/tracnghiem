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
