// Service Worker - QuizMaster Pro
const CACHE_VERSION = 'quizmaster-v2.3.0-practice';
const CACHE_NAME = CACHE_VERSION;

// Files cần cache để chạy offline
const STATIC_FILES = [
    './',
    './index.html',
    './style.css',
    './script.js',
    './questions-data.js',
    './stats-worker.js',
    './manifest.json'
];

// v1.7.0 — Stale-While-Revalidate target: questions-data.js
// Show cached version instantly + refresh in background → no forced reload
function isQuestionsData(url) {
    return /questions-data\.js(\?|$)/i.test(url);
}

// CDN libraries (cache khi load lần đầu)
const CDN_FILES = [
    'https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/docx/8.5.0/docx.umd.min.js',
    'https://cdn.jsdelivr.net/npm/chart.js'
];

// File type cần dùng NETWORK-FIRST (luôn lấy bản mới, fallback cache khi offline)
// → Tránh được tình trạng Firefox stuck với phiên bản cũ
function isAppShell(url) {
    return /\.(html|js|css)(\?|$)/i.test(url) || url.endsWith('/') || url.endsWith('/index.html');
}

// === INSTALL: Cache files khi cài đặt ===
self.addEventListener('install', event => {
    console.log('[SW] Installing v' + CACHE_VERSION);
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            console.log('[SW] Caching static files');
            return cache.addAll(STATIC_FILES).then(() => {
                // Cache CDN (không block nếu lỗi)
                return Promise.allSettled(
                    CDN_FILES.map(url =>
                        fetch(url, { mode: 'no-cors' })
                            .then(res => cache.put(url, res))
                            .catch(err => console.log('[SW] CDN cache failed:', url))
                    )
                );
            });
        }).then(() => self.skipWaiting())
    );
});

// === ACTIVATE: Xóa cache cũ ===
self.addEventListener('activate', event => {
    console.log('[SW] Activating v' + CACHE_VERSION);
    event.waitUntil(
        caches.keys().then(keys => {
            return Promise.all(
                keys.filter(k => k !== CACHE_NAME).map(k => {
                    console.log('[SW] Deleting old cache:', k);
                    return caches.delete(k);
                })
            );
        }).then(() => self.clients.claim())
    );
});

// === FETCH: Network-first cho app shell, Cache-first cho asset khác ===
self.addEventListener('fetch', event => {
    const { request } = event;

    // Bỏ qua non-GET requests
    if (request.method !== 'GET') return;

    const url = request.url;

    // 🆕 v1.7.0 — STALE-WHILE-REVALIDATE for questions-data.js (~250 KB)
    // → Fast initial paint (cached) + fresh quizzes on next load (background refresh)
    if (isQuestionsData(url)) {
        event.respondWith(
            caches.match(request).then(cached => {
                const networkFetch = fetch(request).then(fresh => {
                    if (fresh && fresh.status === 200) {
                        const clone = fresh.clone();
                        caches.open(CACHE_NAME).then(c => c.put(request, clone));
                    }
                    return fresh;
                }).catch(() => null);
                // Return cached immediately if available; otherwise wait for network
                return cached || networkFetch;
            })
        );
        return;
    }

    // 🔥 NETWORK-FIRST cho app shell (html/js/css) → Firefox sẽ luôn nhận bản mới
    if (isAppShell(url)) {
        event.respondWith(
            fetch(request).then(response => {
                if (response && response.status === 200) {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then(c => c.put(request, clone));
                }
                return response;
            }).catch(() => {
                // Offline fallback
                return caches.match(request).then(cached => {
                    if (cached) return cached;
                    if (request.destination === 'document') {
                        return caches.match('./index.html');
                    }
                });
            })
        );
        return;
    }

    // CACHE-FIRST cho asset khác (images, fonts, CDN libraries, …)
    event.respondWith(
        caches.match(request).then(cached => {
            if (cached) {
                // Cache-first, background update
                fetch(request).then(fresh => {
                    if (fresh && fresh.status === 200) {
                        caches.open(CACHE_NAME).then(c => c.put(request, fresh));
                    }
                }).catch(() => {});
                return cached;
            }

            // Network-first cho file mới
            return fetch(request).then(response => {
                if (response && response.status === 200) {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then(c => c.put(request, clone));
                }
                return response;
            }).catch(() => {
                if (request.destination === 'document') {
                    return caches.match('./index.html');
                }
            });
        })
    );
});

// === MESSAGE: Nhận lệnh từ trang ===
self.addEventListener('message', event => {
    if (event.data === 'SKIP_WAITING') self.skipWaiting();
    if (event.data === 'CLEAR_CACHE') {
        caches.keys().then(keys => keys.forEach(k => caches.delete(k)));
    }
});
