// ============================================
// 🛡️ SAFE STORAGE & GLOBAL ERROR HANDLERS (v1.4.0)
// Critical for mobile WebView (Zalo, iOS Safari) where:
// - localStorage quota is very small (Zalo) or zero (Safari Private)
// - Any uncaught error triggers "page repeatedly crashed"
// ============================================

// Safe JSON.parse with try-catch
function safeGetItem(key, fallback) {
    try {
        const raw = localStorage.getItem(key);
        if (raw == null) return fallback;
        return JSON.parse(raw);
    } catch (e) {
        console.warn('[safeGetItem] failed for', key, e);
        return fallback;
    }
}

// Safe localStorage.setItem — never throws (catches QuotaExceededError)
function safeSetItem(key, value) {
    try {
        const json = typeof value === 'string' ? value : JSON.stringify(value);
        localStorage.setItem(key, json);
        return true;
    } catch (e) {
        console.warn('[safeSetItem] failed for', key, '— quota exceeded or storage disabled. Continuing in-memory only.', e);
        // Show non-blocking toast (only if toast function ready)
        try {
            if (typeof showToast === 'function') {
                showToast('⚠️ Bộ nhớ trình duyệt đầy — dữ liệu chỉ giữ tạm thời', 'warning', 3000);
            }
        } catch (_) {}
        return false;
    }
}

// Global error handlers — swallow errors so mobile WebView doesn't kill the page
window.addEventListener('error', function (ev) {
    console.error('[GlobalError]', ev.message, ev.error);
    try {
        if (typeof showToast === 'function') {
            showToast('⚠️ Có lỗi xảy ra: ' + (ev.message || 'unknown'), 'error', 3500);
        }
    } catch (_) {}
    // Prevent default crash dialog
    ev.preventDefault?.();
    return true;
});

window.addEventListener('unhandledrejection', function (ev) {
    console.error('[UnhandledRejection]', ev.reason);
    try {
        if (typeof showToast === 'function') {
            showToast('⚠️ Tác vụ bị lỗi: ' + (ev.reason?.message || ev.reason || 'unknown'), 'error', 3500);
        }
    } catch (_) {}
    ev.preventDefault?.();
});

// ============================================
// 🚩 BOOKMARK / FLAG QUESTIONS (v1.9.0)
// Lưu danh sách câu đã đánh dấu "xem lại sau" theo từng quizId.
// Key: 'bookmarks_<quizId>'  →  Array<number> (chỉ số câu trong currentQuiz.questions GỐC)
// ============================================
function _bookmarkKey(quizId) { return 'bookmarks_' + quizId; }
function getBookmarks(quizId) {
    if (quizId == null) return [];
    const arr = safeGetItem(_bookmarkKey(quizId), []);
    return Array.isArray(arr) ? arr : [];
}
function setBookmarks(quizId, arr) {
    if (quizId == null) return false;
    return safeSetItem(_bookmarkKey(quizId), Array.isArray(arr) ? arr : []);
}
function isBookmarked(quizId, origIndex) {
    return getBookmarks(quizId).indexOf(origIndex) !== -1;
}
/** Toggle bookmark theo origIndex. Trả về true nếu giờ đã đánh dấu, false nếu vừa gỡ. */
function toggleBookmarkByOrig(quizId, origIndex) {
    const arr = getBookmarks(quizId);
    const k = arr.indexOf(origIndex);
    if (k === -1) arr.push(origIndex); else arr.splice(k, 1);
    setBookmarks(quizId, arr);
    return k === -1;
}
/** Gọi từ inline onclick — chuyển từ shuffled index sang origIndex rồi toggle + cập nhật UI. */
function toggleBookmark(shuffledIndex, ev) {
    try {
        if (ev) { ev.stopPropagation(); ev.preventDefault(); }
        if (!shuffledQuiz || !shuffledQuiz.questions[shuffledIndex]) return;
        const q = shuffledQuiz.questions[shuffledIndex];
        const quizId = currentQuiz && currentQuiz.id;
        const origIdx = (q.__origIndex !== undefined) ? q.__origIndex : shuffledIndex;
        const nowOn = toggleBookmarkByOrig(quizId, origIdx);
        const btn = document.querySelector('.bookmark-btn[data-qidx="' + shuffledIndex + '"]');
        if (btn) {
            btn.classList.toggle('on', nowOn);
            btn.textContent = nowOn ? '🚩' : '⚐';
            btn.title = nowOn ? 'Đã đánh dấu — bấm để bỏ' : 'Đánh dấu xem lại sau';
        }
        const cell = document.querySelector('.qsp-cell[data-index="' + shuffledIndex + '"]');
        if (cell) cell.classList.toggle('bookmarked', nowOn);
        if (typeof showToast === 'function') {
            showToast(nowOn ? '🚩 Đã đánh dấu câu ' + (shuffledIndex + 1) : '✓ Đã gỡ đánh dấu câu ' + (shuffledIndex + 1), 'success', 1200);
        }
    } catch (e) { console.warn('[toggleBookmark] error:', e); }
}
window.toggleBookmark = toggleBookmark;

/**
 * v1.9.0 — Bắt đầu ôn lại CHỈ những câu đã đánh dấu của một quiz.
 * Tạo một quiz ảo trong bộ nhớ (không persist vào localStorage), gán id âm để phân biệt.
 */
function startBookmarkedReview(quizId) {
    try {
        const baseQuiz = quizzes.find(q => q.id === quizId);
        if (!baseQuiz) return showToast('Không tìm thấy đề gốc!', 'error');
        const bms = getBookmarks(quizId);
        if (!bms.length) return showToast('Chưa có câu nào được đánh dấu', 'info');
        // Build sub-questions theo bookmark (giữ nguyên thứ tự gốc)
        const subQs = bms.slice().sort((a,b) => a-b)
            .map(oi => baseQuiz.questions[oi])
            .filter(Boolean);
        if (!subQs.length) return showToast('Câu đánh dấu không còn hợp lệ', 'error');
        // Tạo quiz tạm — id âm để không bị save
        const tempId = -Math.abs(quizId) * 1000 - 9;
        // Xoá entry cũ nếu có (chạy lại nhiều lần)
        const existIdx = quizzes.findIndex(q => q.id === tempId);
        if (existIdx !== -1) quizzes.splice(existIdx, 1);
        const tempQuiz = {
            id: tempId,
            title: '🚩 Câu đánh dấu — ' + baseQuiz.title,
            desc: 'Ôn lại ' + subQs.length + ' câu đã đánh dấu',
            time: Math.max(5, Math.ceil(subQs.length * 0.5)),
            shuffleQ: false, shuffleO: !!baseQuiz.shuffleO,
            showReviewDetail: true,
            questions: subQs,
            __preloaded: true,  // không persist
            __bookmarkReviewOf: quizId  // tham chiếu về quiz gốc
        };
        quizzes.push(tempQuiz);
        startQuiz(tempId);
    } catch (e) {
        console.error('[startBookmarkedReview]', e);
        try { showToast('Lỗi: ' + (e.message || e), 'error', 3000); } catch (_) {}
    }
}
window.startBookmarkedReview = startBookmarkedReview;

let questions = [];
let quizzes = safeGetItem('quizzes', []);
let history = safeGetItem('history', []);
let currentQuiz = null, shuffledQuiz = null;
let userAnswers = {};
let timerInterval = null, timeLeft = 0;

// Helper: save only user-created quizzes (skip __preloaded ones to avoid quota errors)
function saveQuizzes() {
    try {
        const userQuizzes = quizzes.filter(q => !q.__preloaded);
        return safeSetItem('quizzes', userQuizzes);
    } catch (e) {
        console.warn('[saveQuizzes] failed:', e);
        return false;
    }
}

function saveHistory() {
    try {
        // Keep only last 50 entries to limit storage
        const trimmed = history.length > 50 ? history.slice(-50) : history;
        // v1.6.1 — invalidate memoized stats whenever history changes
        try { invalidateStatsCache(); } catch (_) {}
        return safeSetItem('history', trimmed);
    } catch (e) {
        console.warn('[saveHistory] failed:', e);
        return false;
    }
}
// ============================================
// 🔧 GENERIC UTILITIES (v1.6.1)
// ============================================

// Debounce: delay calling fn until `ms` milliseconds have passed without a new call.
// Useful for search inputs to avoid re-rendering on every keystroke.
function debounce(fn, ms) {
    let timer = null;
    return function debounced(...args) {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => {
            timer = null;
            try { fn.apply(this, args); } catch (e) { console.warn('[debounce] fn error:', e); }
        }, ms);
    };
}

// Stats memoization cache — invalidated whenever history mutates.
// Use invalidateStatsCache() after any push/splice/clear on `history`.
const __statsCache = { overview: null, perQuiz: null, timeWindow: null };
function invalidateStatsCache() {
    __statsCache.overview = null;
    __statsCache.perQuiz = null;
    __statsCache.timeWindow = null;
}

// ============================================
// 👷 v1.7.0 — Web Worker for stats (lazy)
// Only spawn worker when history is large (>500 entries) to avoid blocking
// the main thread during aggregation. For small history the sync path is
// faster than the postMessage round-trip.
// ============================================
const STATS_WORKER_THRESHOLD = 500;
let __statsWorker = null;
let __statsWorkerMsgId = 0;
function _getStatsWorker() {
    if (__statsWorker) return __statsWorker;
    if (typeof Worker === 'undefined') return null;
    try {
        __statsWorker = new Worker('stats-worker.js?v=1.7.0');
        return __statsWorker;
    } catch (e) {
        console.warn('[stats] Worker init failed, falling back to sync:', e);
        return null;
    }
}
/**
 * Async wrapper: returns {overview, perQuiz}. Uses worker for big history,
 * sync compute otherwise. Always resolves (never rejects) — falls back on err.
 * @returns {Promise<{overview:StatsOverview, perQuiz:Array}>}
 */
function computeStatsAsync() {
    return new Promise(resolve => {
        if (history.length <= STATS_WORKER_THRESHOLD) {
            resolve({ overview: computeStatsOverview(), perQuiz: computePerQuizStats() });
            return;
        }
        const w = _getStatsWorker();
        if (!w) {
            resolve({ overview: computeStatsOverview(), perQuiz: computePerQuizStats() });
            return;
        }
        const id = ++__statsWorkerMsgId;
        const onMsg = (ev) => {
            if (!ev.data || ev.data.id !== id) return;
            w.removeEventListener('message', onMsg);
            if (ev.data.ok) {
                __statsCache.overview = ev.data.result.overview;
                __statsCache.perQuiz = ev.data.result.perQuiz;
                resolve(ev.data.result);
            } else {
                console.warn('[stats] Worker error, sync fallback:', ev.data.error);
                resolve({ overview: computeStatsOverview(), perQuiz: computePerQuizStats() });
            }
        };
        w.addEventListener('message', onMsg);
        // Send a shallow copy to avoid leaking live references
        w.postMessage({ id, type: 'both', history: history.slice() });
    });
}
window.computeStatsAsync = computeStatsAsync;


// ============================================
// 📡 OFFLINE MODE - SERVICE WORKER & PWA
// ============================================

let deferredPrompt = null;

// Đăng ký Service Worker
function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('sw.js')
                .then(reg => {
                    console.log('✅ SW registered:', reg.scope);

                    // Chủ động kiểm tra update mỗi khi load trang
                    reg.update().catch(() => {});

                    // Kiểm tra cập nhật
                    reg.addEventListener('updatefound', () => {
                        const newSW = reg.installing;
                        if (!newSW) return;
                        newSW.addEventListener('statechange', () => {
                            if (newSW.state === 'installed' && navigator.serviceWorker.controller) {
                                // Có bản mới + đã có SW cũ kiểm soát → tự kích hoạt và reload
                                console.log('🔄 SW mới đã sẵn sàng, đang kích hoạt...');
                                try { newSW.postMessage('SKIP_WAITING'); } catch (e) {}
                                showToast('🔄 Đang cập nhật phiên bản mới...', 'success', 2000);
                            }
                        });
                    });
                })
                .catch(err => console.log('❌ SW failed:', err));

            // Khi SW mới chiếm quyền → tự reload (chỉ 1 lần) để tải code mới
            let refreshing = false;
            navigator.serviceWorker.addEventListener('controllerchange', () => {
                if (refreshing) return;
                refreshing = true;
                console.log('🔁 SW controller changed, reloading page...');
                window.location.reload();
            });
        });
    }
}

// ============= EMERGENCY: XÓA CACHE & RELOAD =============
// Dùng khi user kẹt với phiên bản cũ (đặc biệt trên Firefox)
function clearCacheAndReload() {
    if (!confirm('Xóa toàn bộ cache và tải lại trang?\n(Dữ liệu đề thi của bạn vẫn được giữ nguyên)')) return;
    const tasks = [];
    // 1. Xóa Cache Storage
    if ('caches' in window) {
        tasks.push(
            caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k))))
        );
    }
    // 2. Gỡ Service Worker
    if ('serviceWorker' in navigator) {
        tasks.push(
            navigator.serviceWorker.getRegistrations()
                .then(regs => Promise.all(regs.map(r => r.unregister())))
        );
    }
    Promise.allSettled(tasks).then(() => {
        // Force reload, bỏ qua cache HTTP
        window.location.reload(true);
    });
}
window.clearCacheAndReload = clearCacheAndReload;

// Theo dõi online/offline
function initConnectionMonitor() {
    function showStatus(isOnline) {
        const el = document.getElementById('connectionStatus');
        if (!el) return;
        el.className = 'connection-status show ' + (isOnline ? 'online' : 'offline');
        el.innerHTML = isOnline ? '🌐 Đã kết nối Internet' : '📴 Đang offline - Vẫn dùng được!';
        
        // Hiện chấm cảnh báo offline
        let dot = document.querySelector('.offline-dot');
        if (!dot) {
            dot = document.createElement('span');
            dot.className = 'offline-dot';
            dot.title = 'Đang offline';
            document.querySelector('.logo')?.appendChild(dot);
        }
        dot.classList.toggle('show', !isOnline);
        
        setTimeout(() => el.classList.remove('show'), 3000);
    }
    
    window.addEventListener('online', () => showStatus(true));
    window.addEventListener('offline', () => showStatus(false));
    
    // Hiện trạng thái ban đầu nếu offline
    if (!navigator.onLine) {
        setTimeout(() => showStatus(false), 1000);
    }
}

// === PWA Install Prompt ===
function initInstallPrompt() {
    window.addEventListener('beforeinstallprompt', e => {
        e.preventDefault();
        deferredPrompt = e;
        
        // Hiện banner sau 5 giây nếu chưa từ chối
        if (!localStorage.getItem('installDismissed')) {
            setTimeout(() => {
                document.getElementById('installBanner')?.classList.add('show');
            }, 5000);
        }
    });
    
    window.addEventListener('appinstalled', () => {
        document.getElementById('installBanner')?.classList.remove('show');
        showToast('🎉 Đã cài đặt thành công!', 'success');
        deferredPrompt = null;
    });
}

function installPWA() {
    if (!deferredPrompt) {
        showToast('Trình duyệt không hỗ trợ cài đặt. Dùng menu "Thêm vào màn hình chính"', 'warning', 4000);
        return;
    }
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then(choice => {
        if (choice.outcome === 'accepted') {
            showToast('Đang cài đặt...', 'success');
        }
        deferredPrompt = null;
        document.getElementById('installBanner')?.classList.remove('show');
    });
}

function dismissInstall() {
    document.getElementById('installBanner')?.classList.remove('show');
    safeSetItem('installDismissed', '1');
}

/// ============================================
// ⌨️ PHÍM TẮT - PHIÊN BẢN ĐÃ SỬA LỖI
// ============================================

function initKeyboardShortcuts() {
    document.addEventListener('keydown', e => {
        const tag = e.target.tagName;
        const isTyping = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
        const isButton = tag === 'BUTTON' || tag === 'LABEL';
        
        // ⚠️ QUAN TRỌNG: KHÔNG XỬ LÝ khi đang focus vào button/label
        // (để Enter/Space hoạt động bình thường cho click)
        if (isButton && (e.key === 'Enter' || e.key === ' ')) {
            return; // Cho phép browser xử lý mặc định
        }
        
        // === Esc: Đóng floating card/menu ===
        if (e.key === 'Escape') {
            document.querySelectorAll('.floating-card.active').forEach(m => m.classList.remove('active', 'minimized'));
            const nav = document.getElementById('mainNav');
            if (nav?.classList.contains('mobile-open')) toggleMobileMenu();
            return;
        }
        
        // === ? : Mở phím tắt (chỉ khi không gõ) ===
        if (e.key === '?' && !isTyping) {
            e.preventDefault();
            openFloatingCard('shortcutModal');
            return;
        }
        
        // === Alt + 1/2/3/4: Chuyển tab ===
        if (e.altKey && !e.ctrlKey && !e.shiftKey) {
            const sections = { '1': 'home', '2': 'create', '3': 'list', '4': 'stats' };
            if (sections[e.key]) {
                e.preventDefault();
                showSection(sections[e.key]);
                document.querySelectorAll('.nav-btn').forEach((b, i) => {
                    b.classList.toggle('active', i === parseInt(e.key) - 1);
                });
                return;
            }
            if (e.key.toLowerCase() === 'd') {
                e.preventDefault();
                toggleTheme();
                return;
            }
        }
        
         // === Ctrl+S khi đang gõ trong form tạo đề ===
        if (isTyping) {
            if (e.ctrlKey && e.key.toLowerCase() === 's' && document.getElementById('create').classList.contains('active')) {
                e.preventDefault();
                saveQuiz();
            }
            return; // Không xử lý phím khác khi đang gõ
        }
        
                // === PHÍM Ở TRANG TẠO ĐỀ (chỉ khi không focus button) ===
        if (document.getElementById('create').classList.contains('active') && !isButton) {
            if (e.ctrlKey && e.key.toLowerCase() === 'n') {
                e.preventDefault();
                addQuestion();
                showToast('Đã thêm câu hỏi mới', 'success', 1500);
                return;
            }
            if (e.ctrlKey && e.key.toLowerCase() === 's') {
                e.preventDefault();
                saveQuiz();
                return;
            }
            if (e.ctrlKey && e.key === 'Delete') {
                e.preventDefault();
                clearAll();
                return;
            }
        }
        
        // === PHÍM KHI LÀM BÀI ===
        if (document.getElementById('doQuiz').classList.contains('active') && !isButton) {
            const answerMap = { 'a': 0, 'b': 1, 'c': 2, 'd': 3, '1': 0, '2': 1, '3': 2, '4': 3 };
            const key = e.key.toLowerCase();
            if (answerMap[key] !== undefined) {
                e.preventDefault();
                selectAnswerByKeyboard(currentQuestionIndex, answerMap[key]);
                return;
            }
            
            if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
                e.preventDefault();
                navigateQuestion(-1);
                return;
            }
            
            if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
                e.preventDefault();
                navigateQuestion(1);
                return;
            }
            
            if (e.ctrlKey && e.key === 'Enter') {
                e.preventDefault();
                if (confirm('Nộp bài ngay?')) submitQuiz();
                return;
            }
            
            if (e.key === 'Enter' && shuffledQuiz) {
                const done = Object.keys(userAnswers).length;
                if (done === shuffledQuiz.questions.length) {
                    e.preventDefault();
                    if (confirm('Bạn đã làm hết. Nộp bài?')) submitQuiz();
                }
            }
        }
    });
}

// Chọn đáp án bằng phím
function selectAnswerByKeyboard(qIdx, ansIdx) {
    if (!shuffledQuiz || qIdx >= shuffledQuiz.questions.length) return;
    const q = shuffledQuiz.questions[qIdx];
    if (ansIdx >= q.options.length) return;
    
    // Tick radio
    const radio = document.querySelector(`input[name="q_${qIdx}"][value="${ansIdx}"]`);
    if (radio) {
        radio.checked = true;
        userAnswers[qIdx] = ansIdx;
        updateProgress();
        
        // Hiệu ứng highlight
        const questionEl = document.querySelectorAll('.do-question')[qIdx];
        if (questionEl) {
            questionEl.querySelectorAll('label').forEach((l, i) => {
                l.classList.toggle('keyboard-selected', i === ansIdx);
            });
        }
        
        showToast(`Câu ${qIdx+1}: ${String.fromCharCode(65+ansIdx)}`, 'success', 800);
    }
}

// Chuyển câu hỏi
function navigateQuestion(direction) {
    if (!shuffledQuiz) return;
    const total = shuffledQuiz.questions.length;
    currentQuestionIndex = Math.max(0, Math.min(total - 1, currentQuestionIndex + direction));
    
    const questions = document.querySelectorAll('.do-question');
    questions.forEach((q, i) => q.classList.toggle('current-question', i === currentQuestionIndex));
    
    const target = questions[currentQuestionIndex];
    if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    updateQuestionStatusPanel();
}

// Reset câu hỏi hiện tại khi bắt đầu bài mới
function resetCurrentQuestion() {
    currentQuestionIndex = 0;
    setTimeout(() => {
        const first = document.querySelector('.do-question');
        if (first) first.classList.add('current-question');
        updateQuestionStatusPanel();
    }, 100);
}

// ============= TAB TRẠNG THÁI CÂU HỎI =============

// Hiển thị/tạo panel trạng thái khi bắt đầu làm bài
function initQuestionStatusPanel() {
    const panel = document.getElementById('questionStatusPanel');
    const grid = document.getElementById('qspGrid');
    if (!panel || !grid || !shuffledQuiz) return;

    const total = shuffledQuiz.questions.length;
    document.getElementById('qspTotal').textContent = total;
    document.getElementById('qspDone').textContent = 0;

    // Render các ô trạng thái câu hỏi
    // v1.9.0 — Mark bookmarked cells
    const __quizIdInit = currentQuiz && currentQuiz.id;
    const __bmsInit = __quizIdInit != null ? getBookmarks(__quizIdInit) : [];
    grid.innerHTML = '';
    for (let i = 0; i < total; i++) {
        const cell = document.createElement('div');
        cell.className = 'qsp-cell';
        cell.textContent = i + 1;
        cell.dataset.index = i;
        const __qq = shuffledQuiz.questions[i];
        const __oi = (__qq && __qq.__origIndex !== undefined) ? __qq.__origIndex : i;
        const __isBM = __bmsInit.indexOf(__oi) !== -1;
        if (__isBM) cell.classList.add('bookmarked');
        cell.title = `Câu ${i + 1} - Bỏ trống` + (__isBM ? ' • 🚩 Đã đánh dấu' : '');
        cell.onclick = () => jumpToQuestion(i);
        grid.appendChild(cell);
    }

    // Hiện panel
    panel.classList.add('visible');
    panel.classList.remove('collapsed');
    // Trên mobile: mặc định ẨN panel (chỉ hiện khi user bấm nút FAB)
    panel.classList.remove('mobile-shown');
    // Đánh dấu body đang ở trạng thái làm bài (để hiện nút FAB mobile)
    document.body.classList.add('qsp-active');
    const fab = document.getElementById('qspMobileToggle');
    if (fab) fab.classList.remove('active');
}

// Cập nhật trạng thái từng câu (đã làm / bỏ trống / hiện tại / đúng / sai)
function updateQuestionStatusPanel() {
    if (!shuffledQuiz) return;
    const grid = document.getElementById('qspGrid');
    if (!grid) return;

    const total = shuffledQuiz.questions.length;
    const cells = grid.querySelectorAll('.qsp-cell');
    let done = 0;

    // v1.9.0 — Re-sync bookmark class on each update
    const __quizIdU = currentQuiz && currentQuiz.id;
    const __bmsU = __quizIdU != null ? getBookmarks(__quizIdU) : [];
    cells.forEach((cell, i) => {
        const ua = userAnswers[i];
        const answered = ua !== undefined;
        const __qq = shuffledQuiz.questions[i];
        const __oi = (__qq && __qq.__origIndex !== undefined) ? __qq.__origIndex : i;
        const __isBM = __bmsU.indexOf(__oi) !== -1;

        // Reset các trạng thái phân loại
        cell.classList.remove('answered', 'correct', 'wrong', 'current');
        cell.classList.toggle('bookmarked', __isBM);

        if (answered) {
            done++;
            cell.classList.add('answered');
            cell.title = `Câu ${i + 1} - Đã chọn ${String.fromCharCode(65 + ua)}` + (__isBM ? ' • 🚩 Đã đánh dấu' : '');
        } else {
            cell.title = `Câu ${i + 1} - Bỏ trống` + (__isBM ? ' • 🚩 Đã đánh dấu' : '');
        }
    });

    const doneEl = document.getElementById('qspDone');
    const totalEl = document.getElementById('qspTotal');
    if (doneEl) doneEl.textContent = done;
    if (totalEl) totalEl.textContent = total;
}

// Thu gọn/mở rộng panel
function toggleQuestionStatusPanel() {
    const panel = document.getElementById('questionStatusPanel');
    if (panel) panel.classList.toggle('collapsed');
}

// Ẩn panel khi nộp bài / rời trang làm bài
function hideQuestionStatusPanel() {
    const panel = document.getElementById('questionStatusPanel');
    if (panel) {
        panel.classList.remove('visible');
        panel.classList.remove('mobile-shown');
    }
    document.body.classList.remove('qsp-active');
    const fab = document.getElementById('qspMobileToggle');
    if (fab) fab.classList.remove('active');
}

// Ẩn/hiện panel trên mobile (gọi từ nút FAB)
function toggleQspVisibility() {
    const panel = document.getElementById('questionStatusPanel');
    const fab = document.getElementById('qspMobileToggle');
    if (!panel) return;
    const willShow = !panel.classList.contains('mobile-shown');
    panel.classList.toggle('mobile-shown', willShow);
    if (fab) fab.classList.toggle('active', willShow);
    // Khi mở lại, đảm bảo không bị ở trạng thái collapsed
    if (willShow) panel.classList.remove('collapsed');
}

// Nhảy tới câu hỏi cụ thể (click vào ô trong panel)
function jumpToQuestion(index) {
    if (!shuffledQuiz) return;
    const total = shuffledQuiz.questions.length;
    currentQuestionIndex = Math.max(0, Math.min(total - 1, index));

    const questions = document.querySelectorAll('.do-question');
    questions.forEach((q, i) => q.classList.toggle('current-question', i === currentQuestionIndex));

    const target = questions[currentQuestionIndex];
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'center' });

    updateQuestionStatusPanel();
}
// ============= THEME TOGGLE (4 MODES: LIGHT / DARK / OLED / AUTO) =============
// v1.6.1 — Added OLED true-black mode for AMOLED displays (saves battery)
const THEME_ORDER = ['dark', 'light', 'oled', 'auto'];
const THEME_ICON = { dark: '🌙', light: '☀️', oled: '⚫', auto: '🌓' };
const THEME_LABEL = {
    dark: 'Chế độ tối (bấm: sáng)',
    light: 'Chế độ sáng (bấm: OLED đen)',
    oled: 'Chế độ OLED đen tuyệt đối (bấm: tự động)',
    auto: 'Tự động theo hệ thống (bấm: tối)'
};
const THEME_TOAST_LABEL = {
    dark: '🌙 Tối',
    light: '☀️ Sáng',
    oled: '⚫ OLED đen',
    auto: '🌓 Tự động'
};

function getSystemPrefersDark() {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function applyTheme(mode) {
    let effective = mode;
    if (mode === 'auto') effective = getSystemPrefersDark() ? 'dark' : 'light';
    document.body.classList.toggle('light-mode', effective === 'light');
    document.body.classList.toggle('oled-mode', effective === 'oled');
    document.body.setAttribute('data-theme-mode', mode);
    const btn = document.getElementById('themeToggle');
    if (btn) {
        btn.textContent = THEME_ICON[mode] || '🌙';
        btn.title = THEME_LABEL[mode] || '';
    }
}

function setTheme(mode) {
    if (!THEME_ORDER.includes(mode)) mode = 'dark';
    safeSetItem('theme', mode);
    applyTheme(mode);
    // Refresh charts if stats page is open (colors depend on theme)
    if (document.getElementById('stats')?.classList.contains('active')) {
        renderStats();
    }
}

function toggleTheme() {
    const current = localStorage.getItem('theme') || 'dark';
    const idx = THEME_ORDER.indexOf(current);
    const next = THEME_ORDER[(idx + 1) % THEME_ORDER.length];
    setTheme(next);
    showToast(`Chế độ: ${THEME_TOAST_LABEL[next] || next}`, 'success', 1500);
}
// ============= HIỆU ỨNG PARTICLE BACKGROUND =============
function createParticles() {
    const container = document.getElementById('particles');
    if (!container) return;
    container.innerHTML = '';
    const count = 25;
    for (let i = 0; i < count; i++) {
        const p = document.createElement('div');
        p.className = 'particle';
        const size = Math.random() * 8 + 4;
        p.style.width = size + 'px';
        p.style.height = size + 'px';
        p.style.left = Math.random() * 100 + '%';
        p.style.animationDuration = (Math.random() * 15 + 10) + 's';
        p.style.animationDelay = Math.random() * 5 + 's';
        p.style.opacity = Math.random() * 0.5 + 0.2;
        container.appendChild(p);
    }
}
// ============= TOAST NOTIFICATION =============
function showToast(message, type = 'success', duration = 3000) {
    const toast = document.createElement('div');
    toast.className = 'toast ' + type;
    const icon = type === 'success' ? '✅' : type === 'error' ? '❌' : '⚠️';
    toast.innerHTML = `${icon} ${message}`;
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.classList.add('hide');
        setTimeout(() => toast.remove(), 400);
    }, duration);
}
// ============= ĐẾM SỐ TĂNG DẦN (COUNT UP) =============
function animateNumber(element, target, duration = 1000) {
    const start = 0;
    const startTime = performance.now();
    const isDecimal = target % 1 !== 0;
    
    function update(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const easeOut = 1 - Math.pow(1 - progress, 3);
        const current = start + (target - start) * easeOut;
        element.textContent = isDecimal ? current.toFixed(2) : Math.floor(current);
        if (progress < 1) requestAnimationFrame(update);
        else element.textContent = isDecimal ? target.toFixed(2) : target;
    }
    requestAnimationFrame(update);
}

// ============= CẢNH BÁO TIMER SẮP HẾT =============
function checkTimerWarning() {
    const timerEl = document.querySelector('.timer');
    if (!timerEl) return;
    if (timeLeft <= 30 && timeLeft > 0) {
        timerEl.classList.add('warning');
    } else {
        timerEl.classList.remove('warning');
    }
}

// Load theme đã lưu (mặc định DARK). v1.6.0: hỗ trợ 3 mode + auto theo hệ thống
function loadTheme() {
    let mode = localStorage.getItem('theme');
    if (!THEME_ORDER.includes(mode)) mode = 'dark'; // mặc định
    applyTheme(mode);

    // Lắng nghe thay đổi system preference khi đang ở mode 'auto'
    if (window.matchMedia) {
        const mq = window.matchMedia('(prefers-color-scheme: dark)');
        const handler = () => {
            const current = localStorage.getItem('theme') || 'dark';
            if (current === 'auto') applyTheme('auto');
        };
        if (mq.addEventListener) mq.addEventListener('change', handler);
        else if (mq.addListener) mq.addListener(handler); // Safari cũ
    }
}
// ============= MOBILE MENU TOGGLE =============
function toggleMobileMenu() {
    const nav = document.getElementById('mainNav');
    const overlay = document.getElementById('menuOverlay');
    const hamburger = document.getElementById('hamburger');
    
    nav.classList.toggle('mobile-open');
    overlay.classList.toggle('active');
    
    if (nav.classList.contains('mobile-open')) {
        hamburger.textContent = '✕';
        document.body.style.overflow = 'hidden';
    } else {
        hamburger.textContent = '☰';
        document.body.style.overflow = '';
    }
}

// Tự đóng menu khi chọn 1 mục (mobile)
function closeMobileMenu() {
    const nav = document.getElementById('mainNav');
    if (nav.classList.contains('mobile-open')) {
        toggleMobileMenu();
    }
}

// ============= SWIPE GESTURE (VUỐT CHUYỂN TRANG) =============
let touchStartX = 0, touchEndX = 0, touchStartY = 0, touchEndY = 0;

function initSwipeGesture() {
    document.addEventListener('touchstart', e => {
        touchStartX = e.changedTouches[0].screenX;
        touchStartY = e.changedTouches[0].screenY;
    }, { passive: true });
    
    document.addEventListener('touchend', e => {
        touchEndX = e.changedTouches[0].screenX;
        touchEndY = e.changedTouches[0].screenY;
        handleSwipe();
    }, { passive: true });
}

function handleSwipe() {
    const dx = touchEndX - touchStartX;
    const dy = touchEndY - touchStartY;
    
    // Chỉ xử lý swipe ngang (không phải scroll dọc)
    if (Math.abs(dx) < 80 || Math.abs(dy) > Math.abs(dx)) return;
    
    // Vuốt phải mở menu (từ mép trái)
    if (dx > 0 && touchStartX < 30) {
        const nav = document.getElementById('mainNav');
        if (!nav.classList.contains('mobile-open')) toggleMobileMenu();
    }
    // Vuốt trái đóng menu
    else if (dx < 0) {
        const nav = document.getElementById('mainNav');
        if (nav.classList.contains('mobile-open')) toggleMobileMenu();
    }
}

// ============= PHÁT HIỆN THIẾT BỊ =============
function isMobile() {
    return window.innerWidth <= 768 || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

// ============= NGĂN ZOOM KHI DOUBLE TAP (iOS) =============
function preventDoubleTapZoom() {
    let lastTouchEnd = 0;
    document.addEventListener('touchend', e => {
        const now = Date.now();
        if (now - lastTouchEnd <= 300) {
            e.preventDefault();
        }
        lastTouchEnd = now;
    }, false);
}


// ============= ĐIỀU HƯỚNG =============
function showSection(id, event) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    if (event && event.target) event.target.classList.add('active');
    else {
        // Khi gọi showSection không có event, tự đồng bộ nav-btn active dựa trên id
        const mapBtn = { home: 0, create: 1, list: 2, stats: 3 };
        const navBtns = document.querySelectorAll('.nav-btn');
        if (mapBtn[id] !== undefined && navBtns[mapBtn[id]]) navBtns[mapBtn[id]].classList.add('active');
    }
    if (id === 'list') renderQuizList();
    if (id === 'stats') renderStats();
    if (id === 'create' && questions.length === 0) addQuestion();

    // Ẩn panel trạng thái câu hỏi khi rời trang làm bài
    if (id !== 'doQuiz') hideQuestionStatusPanel();
    
    // Đóng các floating card đang mở (hướng dẫn, phím tắt...) khi chuyển trang
    closeFloatingCard('modal');
    closeFloatingCard('shortcutModal');
    
    // Tự đóng menu mobile sau khi chọn
    closeMobileMenu();
    
    // Cuộn lên đầu trang
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ============= XỬ LÝ CLICK FEATURE CARD (HOME) =============
function handleFeatureClick(action) {
    switch (action) {
        case 'import': {
            // Chuyển sang trang Tạo đề, cuộn tới khu vực import và highlight nó
            showSection('create');
            setTimeout(() => {
                const importBox = document.querySelector('.import-box');
                if (importBox) {
                    importBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    importBox.style.transition = 'box-shadow 0.4s, transform 0.4s';
                    importBox.style.boxShadow = '0 0 0 4px rgba(124,140,248,0.6)';
                    importBox.style.transform = 'scale(1.02)';
                    setTimeout(() => {
                        importBox.style.boxShadow = '';
                        importBox.style.transform = '';
                    }, 1500);
                }
            }, 200);
            break;
        }
        case 'export': {
            // Nếu có đề thi đã lưu thì chuyển tới danh sách (nơi có nút Xuất CSV/Word)
            // Nếu chưa có thì thông báo và mở trang tạo đề
            const quizzes = JSON.parse(localStorage.getItem('quizzes') || '[]');
            if (quizzes.length === 0) {
                document.getElementById('modalContent').innerHTML = `
                    <h3>📤 Xuất đề thi</h3>
                    <p>Bạn chưa có đề thi nào để xuất. Hãy tạo hoặc nhập đề trước.</p>
                    <div style="margin-top:20px;display:flex;gap:10px;flex-wrap:wrap">
                        <button class="btn-primary" onclick="closeFloatingCard('modal');showSection('create')">➕ Tạo đề ngay</button>
                        <button class="btn-secondary" onclick="closeFloatingCard('modal')">Đóng</button>
                    </div>`;
                openFloatingCard('modal');
            } else {
                showSection('list');
                setTimeout(() => {
                    const list = document.getElementById('quizList');
                    if (list) {
                        list.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                }, 200);
            }
            break;
        }
        case 'shuffle': {
            // Chuyển sang trang Tạo đề, cuộn xuống ô "Trộn câu hỏi" và highlight
            showSection('create');
            setTimeout(() => {
                const sq = document.getElementById('shuffleQuestions');
                const so = document.getElementById('shuffleOptions');
                if (sq) {
                    sq.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    [sq, so].forEach(el => {
                        if (!el) return;
                        el.style.transition = 'box-shadow 0.4s, transform 0.4s';
                        el.style.boxShadow = '0 0 0 3px rgba(124,140,248,0.6)';
                        setTimeout(() => { el.style.boxShadow = ''; }, 1800);
                    });
                    sq.focus();
                }
            }, 200);
            break;
        }
        case 'stats': {
            showSection('stats');
            break;
        }
        default:
            console.warn('Unknown feature action:', action);
    }
}


// ============= QUẢN LÝ CÂU HỎI =============
function addQuestion() {
    questions.push({ question: '', options: ['','','',''], correct: 0 });
    renderQuestions();
}

function renderQuestions() {
    const container = document.getElementById('questionsContainer');
    container.innerHTML = questions.map((q, i) => `
        <div class="question-card">
            <h4>Câu ${i+1} <button class="btn-danger" style="float:right;padding:5px 10px;font-size:13px" onclick="removeQuestion(${i})">🗑️</button></h4>
            <div class="form-group"><label>Câu hỏi:</label>
                <textarea onchange="questions[${i}].question=this.value">${escapeHtml(q.question)}</textarea></div>
            ${q.options.map((opt, j) => `
                <div class="option-row">
                    <input type="radio" name="c_${i}" ${q.correct===j?'checked':''} onchange="questions[${i}].correct=${j}">
                    <input type="text" value="${escapeHtml(opt)}" placeholder="Đáp án ${String.fromCharCode(65+j)}" onchange="questions[${i}].options[${j}]=this.value">
                </div>
            `).join('')}
        </div>
    `).join('');
}

function removeQuestion(i) { questions.splice(i, 1); renderQuestions(); }

function clearAll() {
    if (!confirm('Xóa toàn bộ câu hỏi đang soạn?')) return;
    questions = []; renderQuestions();
}

function escapeHtml(text) {
    return String(text || '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}

// ============= DEBOUNCE HELPER (v1.6.1) =============
// Generic debounce: delays calling fn until ms has passed since last call.
// Useful for input handlers to avoid heavy renders on every keystroke.
function debounce(fn, ms = 300) {
    let timer = null;
    return function debounced(...args) {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => {
            timer = null;
            try { fn.apply(this, args); } catch (e) { console.error('[debounce]', e); }
        }, ms);
    };
}

// Debounced renderers — exposed on window for inline `oninput` handlers
window.renderQuizListDebounced = null;  // assigned in DOMContentLoaded
window.renderHistoryListDebounced = null;

// ============= LƯU ĐỀ =============
function saveQuiz() {
    const title = document.getElementById('quizTitle').value.trim();
    if (!title) return showToast('Vui lòng nhập tên đề thi!', 'warning');
    if (questions.length === 0) return showToast('Cần ít nhất 1 câu hỏi!', 'warning');
    
    const quiz = {
        id: Date.now(),
        title, desc: document.getElementById('quizDesc').value,
        time: parseInt(document.getElementById('quizTime').value) || 15,
        shuffleQ: document.getElementById('shuffleQuestions').value === 'true',
        shuffleO: document.getElementById('shuffleOptions').value === 'true',
        questions: JSON.parse(JSON.stringify(questions)),
        createdAt: new Date().toLocaleString('vi-VN')
    };
    quizzes.push(quiz);
    saveQuizzes();
   showToast('Đã lưu đề thi!', 'success');
    questions = [];
    ['quizTitle','quizDesc'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('quizTime').value = '15';
    showSection('list');
}

// ============= TRỘN CÂU HỎI =============
function shuffleArray(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

function prepareQuizForDoing(quiz) {
    // v1.9.0 — Tag chỉ số gốc lên từng câu hỏi (idempotent) để bookmark/SRS tham chiếu được bất chấp shuffle.
    if (quiz && Array.isArray(quiz.questions)) {
        for (let _i = 0; _i < quiz.questions.length; _i++) {
            const _q = quiz.questions[_i];
            if (_q && _q.__origIndex === undefined) _q.__origIndex = _i;
        }
    }
    // v1.4.0 — Lightweight clone instead of JSON.parse(JSON.stringify(...))
    // which doubles memory usage (~500KB for 450 questions). On low-RAM phones
    // (Zalo WebView) this can trigger OOM crash.
    // We only need to clone fields that get mutated: options (array) + correct (number).
    // The original `quiz.questions` array stays untouched.
    let qs;
    if (quiz.shuffleO) {
        // Shallow-clone each question with NEW options array + correct index
        qs = quiz.questions.map(q => {
            const n = q.options.length;
            const indices = new Array(n);
            for (let i = 0; i < n; i++) indices[i] = i;
            const shuffled = shuffleArray(indices);
            const newOpts = new Array(n);
            for (let i = 0; i < n; i++) newOpts[i] = q.options[shuffled[i]];
            const newCorrect = shuffled.indexOf(q.correct);
            // Only include fields we use during rendering / scoring
            return { question: q.question, options: newOpts, correct: newCorrect, __origIndex: q.__origIndex };
        });
    } else {
        // No option shuffle → just keep a shallow copy of the array (references original questions)
        qs = quiz.questions.slice();
    }
    // Trộn thứ tự câu hỏi
    if (quiz.shuffleQ) qs = shuffleArray(qs);
    // Giới hạn số câu hỏi
    const limit = parseInt(quiz.questionLimit, 10);
    if (!isNaN(limit) && limit > 0 && limit < qs.length) {
        if (!quiz.shuffleQ) qs = shuffleArray(qs);
        qs = qs.slice(0, limit);
    }
    // Return a shallow-copied quiz (don't mutate original)
    return { id: quiz.id, title: quiz.title, desc: quiz.desc, time: quiz.time,
             shuffleQ: quiz.shuffleQ, shuffleO: quiz.shuffleO,
             showReviewDetail: quiz.showReviewDetail,
             questionLimit: quiz.questionLimit, questions: qs };
}

// ============= DANH SÁCH ĐỀ =============
function renderQuizList() {
    const list = document.getElementById('quizList');
    const search = (document.getElementById('searchQuiz')?.value || '').toLowerCase();
    const filtered = quizzes.filter(q => q.title.toLowerCase().includes(search));
    if (filtered.length === 0) {
        list.innerHTML = '<p style="text-align:center;color:#666;padding:40px;">Không có đề thi nào.</p>';
        return;
    }
    // v1.6.1 — Event delegation: replace 7 inline onclicks per card with
    // data-action attributes + 1 delegated container listener (see below).
    list.innerHTML = filtered.map(q => `
        <div class="quiz-item" data-quiz-id="${q.id}">
            <h3>${escapeHtml(q.title)}</h3>
            <p>${escapeHtml(q.desc || 'Không có mô tả')}</p>
            <div class="meta">
                <span>📝 ${q.questions.length} câu</span>
                <span>⏱️ ${q.time} phút</span>
            </div>
            <div class="btn-group">
                <button class="btn-primary" data-action="start">▶️ Làm bài</button>
                <button class="btn-success" data-action="practice" title="Luyện tập với phản hồi tức thì">📖 Luyện tập</button>
                <button class="btn-warning" data-action="flashcard" title="Học bằng flashcard">🃏 Flashcard</button>
                <button class="btn-secondary" data-action="customize">⚙️ Tùy chỉnh</button>
                <button class="btn-info" data-action="csv">📄 CSV</button>
                <button class="btn-info" data-action="word">📝 Word</button>
            </div>
        </div>
    `).join('');

    // Bind delegated handler ONCE per #quizList lifetime (idempotent).
    if (!list.__delegatedBound) {
        list.addEventListener('click', (ev) => {
            const btn = ev.target.closest('button[data-action]');
            if (!btn) return;
            const card = btn.closest('.quiz-item[data-quiz-id]');
            if (!card) return;
            const id = parseInt(card.getAttribute('data-quiz-id'), 10);
            if (isNaN(id)) return;
            const action = btn.getAttribute('data-action');
            switch (action) {
                case 'start':     return startQuiz(id);
                case 'practice':  return startPractice(id);
                case 'flashcard': return startFlashcard(id);
                case 'customize': return customizeQuiz(id);
                case 'csv':       return exportCSV(id);
                case 'word':      return exportWord(id);
                case 'delete':    return deleteQuiz(id);
            }
        });
        list.__delegatedBound = true;
    }
}

function deleteQuiz(id) {
    if (!confirm('Xóa đề này?')) return;
    quizzes = quizzes.filter(q => q.id !== id);
    saveQuizzes();
    renderQuizList();
}

// ============= TÙY CHỈNH ĐỀ ÔN TẬP =============
// Mở modal tùy chỉnh: thời gian, trộn câu, trộn đáp án, số câu hỏi ngẫu nhiên
function customizeQuiz(id) {
    const quiz = quizzes.find(q => q.id === id);
    if (!quiz) return showToast('Không tìm thấy đề thi!', 'error');

    const totalQuestions = quiz.questions.length;
    const curTime = quiz.time || 15;
    const curShuffleQ = !!quiz.shuffleQ;
    const curShuffleO = !!quiz.shuffleO;
    // Mặc định: hiện chi tiết câu sai. Người dùng có thể tắt ở modal tùy chỉnh.
    const curShowReviewDetail = (quiz.showReviewDetail === undefined) ? true : !!quiz.showReviewDetail;
    const curLimit = parseInt(quiz.questionLimit, 10);
    const curLimitVal = (!isNaN(curLimit) && curLimit > 0) ? curLimit : totalQuestions;

    const modal = document.getElementById('modal');
    const modalContent = document.getElementById('modalContent');
    if (!modal || !modalContent) return showToast('Không thể mở hộp tùy chỉnh!', 'error');

    modalContent.innerHTML = `
        <h2>⚙️ Tùy chỉnh đề ôn tập</h2>
        <p style="color:#666;margin-bottom:16px"><b>${escapeHtml(quiz.title)}</b><br>
        <small>Tổng số câu hỏi: <b>${totalQuestions}</b></small></p>

        <div class="form-group">
            <label>⏱️ Thời gian làm bài (phút):</label>
            <input type="number" id="cqTime" min="1" max="600" value="${curTime}" style="padding:10px;border:2px solid #e0e0e0;border-radius:8px;width:100%">
        </div>

        <div class="form-group">
            <label>🎯 Số câu hỏi (chọn ngẫu nhiên):</label>
            <input type="number" id="cqLimit" min="1" max="${totalQuestions}" value="${curLimitVal}" style="padding:10px;border:2px solid #e0e0e0;border-radius:8px;width:100%">
            <small style="color:#888">Để trống hoặc bằng ${totalQuestions} = dùng tất cả câu hỏi</small>
            <div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap">
                <button type="button" class="btn-info" style="width:auto;padding:6px 12px;font-size:13px" onclick="document.getElementById('cqLimit').value=10">10 câu</button>
                <button type="button" class="btn-info" style="width:auto;padding:6px 12px;font-size:13px" onclick="document.getElementById('cqLimit').value=20">20 câu</button>
                <button type="button" class="btn-info" style="width:auto;padding:6px 12px;font-size:13px" onclick="document.getElementById('cqLimit').value=50">50 câu</button>
                <button type="button" class="btn-info" style="width:auto;padding:6px 12px;font-size:13px" onclick="document.getElementById('cqLimit').value=100">100 câu</button>
                <button type="button" class="btn-info" style="width:auto;padding:6px 12px;font-size:13px" onclick="document.getElementById('cqLimit').value=${totalQuestions}">Tất cả</button>
            </div>
        </div>

        <div class="form-group">
            <label style="display:flex;align-items:center;gap:10px;cursor:pointer">
                <input type="checkbox" id="cqShuffleQ" ${curShuffleQ ? 'checked' : ''} style="width:20px;height:20px;cursor:pointer">
                <span>🔀 Đảo thứ tự <b>câu hỏi</b></span>
            </label>
        </div>

        <div class="form-group">
            <label style="display:flex;align-items:center;gap:10px;cursor:pointer">
                <input type="checkbox" id="cqShuffleO" ${curShuffleO ? 'checked' : ''} style="width:20px;height:20px;cursor:pointer">
                <span>🎲 Đảo thứ tự <b>đáp án</b> trong mỗi câu</span>
            </label>
        </div>

        <div class="form-group">
            <label style="display:flex;align-items:center;gap:10px;cursor:pointer">
                <input type="checkbox" id="cqShowDetail" ${curShowReviewDetail ? 'checked' : ''} style="width:20px;height:20px;cursor:pointer">
                <span>📖 Hiện <b>chi tiết câu đúng/sai</b> ngay trong trang kết quả</span>
            </label>
            <small style="color:#888;display:block;margin-left:30px;margin-top:4px">Tắt nếu đề lớn (&gt;150 câu) để tránh chậm/treo trên điện thoại</small>
        </div>

        <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:20px">
            <button class="btn-primary" onclick="saveQuizCustomization(${id})">💾 Lưu cài đặt</button>
            <button class="btn-secondary" onclick="saveAndStartQuiz(${id})">▶️ Lưu &amp; Làm bài ngay</button>
            <button class="btn-danger" onclick="closeFloatingCard('modal')" style="width:auto">✕ Hủy</button>
        </div>
    `;
    openFloatingCard('modal');
}

// Đọc dữ liệu từ modal & validate
function readCustomizationForm() {
    const time = parseInt(document.getElementById('cqTime')?.value, 10);
    const limitRaw = document.getElementById('cqLimit')?.value;
    const limit = limitRaw === '' ? NaN : parseInt(limitRaw, 10);
    const shuffleQ = !!document.getElementById('cqShuffleQ')?.checked;
    const shuffleO = !!document.getElementById('cqShuffleO')?.checked;
    const showReviewDetail = !!document.getElementById('cqShowDetail')?.checked;
    return { time, limit, shuffleQ, shuffleO, showReviewDetail };
}

function applyCustomizationToQuiz(id) {
    const quiz = quizzes.find(q => q.id === id);
    if (!quiz) { showToast('Không tìm thấy đề thi!', 'error'); return null; }
    const { time, limit, shuffleQ, shuffleO, showReviewDetail } = readCustomizationForm();
    if (isNaN(time) || time < 1) { showToast('Thời gian phải là số nguyên dương!', 'error'); return null; }
    if (time > 600 && !confirm(`Thời gian ${time} phút khá lớn. Bạn có chắc chắn?`)) return null;

    const total = quiz.questions.length;
    let finalLimit;
    if (isNaN(limit) || limit <= 0 || limit >= total) {
        finalLimit = null; // dùng tất cả
    } else {
        finalLimit = limit;
    }

    quiz.time = time;
    quiz.shuffleQ = shuffleQ;
    quiz.shuffleO = shuffleO;
    quiz.showReviewDetail = showReviewDetail;
    quiz.questionLimit = finalLimit;
    saveQuizzes();
    return quiz;
}

function saveQuizCustomization(id) {
    const quiz = applyCustomizationToQuiz(id);
    if (!quiz) return;
    closeFloatingCard('modal');
    const limitMsg = quiz.questionLimit ? `${quiz.questionLimit} câu ngẫu nhiên` : `tất cả ${quiz.questions.length} câu`;
    showToast(`✅ Đã lưu: ${quiz.time}p · ${limitMsg} · ${quiz.shuffleQ?'trộn câu':'giữ câu'} · ${quiz.shuffleO?'trộn đáp án':'giữ đáp án'}`, 'success', 4000);
    renderQuizList();
}

function saveAndStartQuiz(id) {
    const quiz = applyCustomizationToQuiz(id);
    if (!quiz) return;
    closeFloatingCard('modal');
    startQuiz(id);
}

// Tương thích ngược: editQuizTime giờ mở modal tùy chỉnh đầy đủ
function editQuizTime(id) { customizeQuiz(id); }

// ============= LÀM BÀI =============
// Helper: render 1 câu hỏi thành HTML
function renderQuestionHTML(q, i) {
    const opts = q.options.map((opt, j) =>
        `<label><input type="radio" name="q_${i}" value="${j}" onchange="userAnswers[${i}]=${j};updateProgress()">
            ${String.fromCharCode(65+j)}. ${escapeHtml(opt)}</label>`
    ).join('');
    // v1.9.0 — Bookmark button (cờ xem lại sau)
    const __quizId = currentQuiz && currentQuiz.id;
    const __origIdx = (q && q.__origIndex !== undefined) ? q.__origIndex : i;
    const __bm = __quizId != null && isBookmarked(__quizId, __origIdx);
    const __bmIcon = __bm ? '🚩' : '⚐';
    const __bmTitle = __bm ? 'Đã đánh dấu — bấm để bỏ' : 'Đánh dấu xem lại sau';
    return `<div class="do-question">
        <button type="button" class="bookmark-btn${__bm ? ' on' : ''}" data-qidx="${i}" title="${__bmTitle}" aria-label="${__bmTitle}" onclick="toggleBookmark(${i}, event)">${__bmIcon}</button>
        <h4>Câu ${i+1}: ${escapeHtml(q.question)}</h4>
        ${opts}
    </div>`;
}

// Render câu hỏi theo từng batch để tránh crash trên mobile (Zalo WebView…)
function renderQuestionsInChunks(container, questions, chunkSize = 30) {
    let idx = 0;
    const total = questions.length;
    const schedule = window.requestIdleCallback
        ? (cb) => window.requestIdleCallback(cb, { timeout: 200 })
        : (cb) => setTimeout(cb, 16);

    function renderNext() {
        if (idx >= total) {
            // Hoàn tất — bỏ hint loading nếu có
            const hint = document.getElementById('quizLoadingHint');
            if (hint) hint.remove();
            return;
        }
        const end = Math.min(idx + chunkSize, total);
        let html = '';
        for (let i = idx; i < end; i++) {
            html += renderQuestionHTML(questions[i], i);
        }
        // insertAdjacentHTML nhanh hơn & không xoá node hiện có
        container.insertAdjacentHTML('beforeend', html);
        idx = end;
        // Cập nhật hint tiến độ
        const hint = document.getElementById('quizLoadingHint');
        if (hint) hint.textContent = `⏳ Đang tải đề... ${idx}/${total} câu`;
        schedule(renderNext);
    }
    schedule(renderNext);
}

function startQuiz(id) {
    try {
        currentQuiz = quizzes.find(q => q.id === id);
        if (!currentQuiz) {
            showToast('Không tìm thấy đề thi!', 'error');
            return;
        }
        shuffledQuiz = prepareQuizForDoing(currentQuiz);
        userAnswers = {};
        // v1.5.0 — record start time so we can compute timeSpent on submit
        window.__quizStartedAt = Date.now();
        document.getElementById('doQuizTitle').textContent = currentQuiz.title;

        const container = document.getElementById('doQuizContent');
        // Xoá nội dung cũ
        container.innerHTML = '';

        const questions = shuffledQuiz.questions;
        const total = questions.length;
        // v1.4.0 — Reduced FIRST_BATCH for low-end mobile (Zalo WebView)
        // v1.4.1 — Đề >150 câu: chỉ render 5 câu đầu để Safari/Zalo commit DOM ngay, tránh OOM/reload loop
        const FIRST_BATCH = total > 150 ? Math.min(5, total) : Math.min(10, total);
        let firstHTML = '';
        for (let i = 0; i < FIRST_BATCH; i++) {
            firstHTML += renderQuestionHTML(questions[i], i);
        }
        container.innerHTML = firstHTML;

        // Switch view IMMEDIATELY so user sees content, before lazy-rendering rest
        document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
        document.getElementById('doQuiz').classList.add('active');
        if (typeof closeMobileMenu === 'function') closeMobileMenu();
        window.scrollTo({ top: 0, left: 0, behavior: 'instant' });

        // Nếu còn câu hỏi -> thêm hint + lazy render phần còn lại
        if (total > FIRST_BATCH) {
            const hint = document.createElement('div');
            hint.id = 'quizLoadingHint';
            hint.style.cssText = 'text-align:center;padding:12px;color:#888;font-style:italic;font-size:14px';
            hint.textContent = `⏳ Đang tải đề... ${FIRST_BATCH}/${total} câu`;
            container.appendChild(hint);
            // Lazy render phần còn lại theo chunk nhỏ (8 hoặc 15) để mượt trên mobile
            // v1.4.1 — Đề lớn (>150): chunk 8 thay vì 15 để Safari/Zalo không bị block UI thread
            let idx = FIRST_BATCH;
            const chunkSize = total > 150 ? 8 : 15;
            const schedule = window.requestIdleCallback
                ? (cb) => window.requestIdleCallback(cb, { timeout: 300 })
                : (window.requestAnimationFrame
                    ? (cb) => window.requestAnimationFrame(() => setTimeout(cb, 0))
                    : (cb) => setTimeout(cb, 16));
            function renderNext() {
                try {
                    if (idx >= total) {
                        const h = document.getElementById('quizLoadingHint');
                        if (h) h.remove();
                        return;
                    }
                    const end = Math.min(idx + chunkSize, total);
                    let html = '';
                    for (let i = idx; i < end; i++) {
                        html += renderQuestionHTML(questions[i], i);
                    }
                    const h = document.getElementById('quizLoadingHint');
                    if (h) {
                        h.insertAdjacentHTML('beforebegin', html);
                        idx = end;
                        h.textContent = `⏳ Đang tải đề... ${idx}/${total} câu`;
                        if (idx >= total) h.remove();
                    } else {
                        container.insertAdjacentHTML('beforeend', html);
                        idx = end;
                    }
                    schedule(renderNext);
                } catch (e) {
                    console.error('[renderNext] chunk render error:', e);
                    const h = document.getElementById('quizLoadingHint');
                    if (h) h.textContent = '⚠️ Lỗi tải câu hỏi — đã dừng lazy render';
                }
            }
            schedule(renderNext);
        }

        timeLeft = shuffledQuiz.time * 60;
        updateTimer();
        timerInterval = setInterval(() => {
            timeLeft--; updateTimer();
            if (timeLeft <= 0) { clearInterval(timerInterval); submitQuiz(); }
        }, 1000);

        requestAnimationFrame(() => {
            window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
            setTimeout(() => {
                window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
            }, 50);
        });
        initQuestionStatusPanel();
        updateProgress();
        resetCurrentQuestion();
    } catch (e) {
        console.error('[startQuiz] fatal error:', e);
        try { clearInterval(timerInterval); } catch (_) {}
        try { showToast('⚠️ Lỗi khi bắt đầu bài thi: ' + (e.message || e), 'error', 5000); } catch (_) {}
    }
}

function updateTimer() {
    const m = Math.floor(timeLeft / 60), s = timeLeft % 60;
    document.getElementById('timer').textContent = `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
    checkTimerWarning();
}

function updateProgress() {
    const total = shuffledQuiz.questions.length;
    const done = Object.keys(userAnswers).length;
    document.getElementById('progressFill').style.width = (done/total*100) + '%';
    updateQuestionStatusPanel();
}

// ============= submitQuiz HELPERS (v1.6.1 refactor, v1.7.0 typed) =============
// Split into 4 helpers for clarity & testability. All keep the same
// defensive try/catch + WebView-safe semantics as the original code.
//
// v1.7.0: JSDoc typedefs (gives VS Code type-checking & autocomplete)
/**
 * @typedef {Object} QuizQuestion
 * @property {string} question
 * @property {string[]} options
 * @property {number} correct - Index of the correct option
 * @property {string} [explanation]
 */
/**
 * @typedef {Object} ScoreInfo
 * @property {string} score - Score 0–10 (2 decimals)
 * @property {number} scoreNum - Score as float
 * @property {number} percent - 0–100
 * @property {'excellent'|'good'|'average'|'weak'} grade
 * @property {string} emoji
 * @property {string} label
 * @property {string} scoreClass - CSS class
 */
/**
 * @typedef {Object} HistoryEntry
 * @property {number} quizId
 * @property {string} quizTitle
 * @property {number} score
 * @property {number} correct
 * @property {number} total
 * @property {number} [timeSpent]
 * @property {number} [timestamp]
 * @property {string} [date]
 */
/**
 * @typedef {Object} StatsOverview
 * @property {number} total
 * @property {string} avg
 * @property {string} max
 * @property {number} uniqueQuizzes
 * @property {number} streak
 * @property {number} totalTime
 * @property {number} passRate
 */

/**
 * (1) Collect answers + count correct in a single pass.
 * @param {QuizQuestion[]} questions
 * @param {Object<number, number>} answers - Map of questionIndex → selectedOptionIndex
 * @returns {{total:number, correct:number}}
 */
function _collectQuizAnswers(questions, answers) {
    const total = questions.length;
    let correct = 0;
    for (let i = 0; i < total; i++) {
        if (answers[i] === questions[i].correct) correct++;
    }
    return { total, correct };
}

/**
 * (2) Compute score (0–10), percent, grade label/emoji/CSS class.
 * @param {number} correct
 * @param {number} total
 * @returns {ScoreInfo}
 */
function _calculateQuizScore(correct, total) {
    const score = ((correct / total) * 10).toFixed(2);
    const percent = Math.round((correct / total) * 100);
    const scoreNum = parseFloat(score);
    const grade = scoreNum >= 8 ? 'excellent'
        : scoreNum >= 6.5 ? 'good'
        : scoreNum >= 5 ? 'average'
        : 'weak';
    const emoji = grade === 'excellent' ? '🏆'
        : grade === 'good' ? '👍'
        : grade === 'average' ? '😊'
        : '💪';
    const label = grade === 'excellent' ? 'Xuất sắc!'
        : grade === 'good' ? 'Khá'
        : grade === 'average' ? 'Trung bình'
        : 'Cố gắng thêm!';
    const scoreClass = 'score-' + grade;
    return { score, scoreNum, percent, grade, emoji, label, scoreClass };
}

/**
 * (3) Build the result HTML shown to the user (top score box + review header).
 * @param {ScoreInfo} scoreInfo
 * @param {number} correct
 * @param {number} total
 * @param {string} timeStr - Formatted duration (e.g. '1:23')
 * @param {boolean} reviewVisible - Whether the detailed review is currently shown
 * @returns {string} HTML string
 */
function _buildResultHtml(scoreInfo, correct, total, timeStr, reviewVisible) {
    const { score, percent, emoji, label, scoreClass } = scoreInfo;
    // v1.9.0 — Bookmark count cho banner & nút làm lại câu đánh dấu
    const __bmQuizId = currentQuiz && currentQuiz.id;
    const __bmList = __bmQuizId != null ? getBookmarks(__bmQuizId) : [];
    const __bmCount = __bmList.length;
    const __bmBanner = __bmCount > 0
        ? `<div class="result-bookmark-row"><span>🚩 Bạn đã đánh dấu <b>${__bmCount}</b> câu xem lại</span><button class="btn-info" style="padding:6px 14px;font-size:13px;width:auto;margin-left:auto" onclick="startBookmarkedReview(${__bmQuizId})">🔁 Làm lại các câu đánh dấu</button></div>`
        : '';
    return `
        <div class="result-box ${scoreClass}">
            <div class="result-emoji-big">${emoji}</div>
            <h3 class="result-score-big">${score}<span class="result-score-max">/10</span></h3>
            <p class="result-grade">${label}</p>
            <div class="result-stats-row">
                <div class="result-stat"><span class="result-stat-icon">✅</span><span class="result-stat-val">${correct}/${total}</span><span class="result-stat-lbl">Câu đúng</span></div>
                <div class="result-stat"><span class="result-stat-icon">📊</span><span class="result-stat-val">${percent}%</span><span class="result-stat-lbl">Tỉ lệ</span></div>
                <div class="result-stat"><span class="result-stat-icon">⏱️</span><span class="result-stat-val">${timeStr}</span><span class="result-stat-lbl">Thời gian</span></div>
            </div>
            <div class="result-progress-ring">
                <div class="result-progress-bar"><div class="result-progress-fill" style="width:${percent}%"></div></div>
            </div>
            ${__bmBanner}
        </div>
        <div class="result-actions">
            <button class="btn-primary" onclick="if(currentQuiz){startQuiz(currentQuiz.id)}">🔁 Làm lại</button>
            <button class="btn-secondary" onclick="showSection('quizzes')">📚 Danh sách đề</button>
            <button class="btn-info" onclick="showSection('stats')">📊 Xem thống kê</button>
        </div>
        <div class="review-header-bar">
            <h3 style="margin:0">📖 Chi tiết câu trả lời</h3>
            <button id="toggleReviewBtn" class="btn-secondary" style="padding:8px 14px;font-size:14px;width:auto">${reviewVisible ? '🙈 Ẩn chi tiết' : '👁️ Hiện chi tiết'}</button>
        </div>
        <div id="reviewContainer"></div>
    `;
}

/**
 * (4) Persist the attempt into history (safe against localStorage quota).
 * Also invalidates the stats memo cache (v1.6.1).
 * @param {number} score - Score 0–10
 * @param {number} correct
 * @param {number} total
 * @returns {void}
 */
function _saveQuizHistory(score, correct, total) {
    try {
        const timeSpent = window.__quizStartedAt
            ? Math.max(0, Math.round((Date.now() - window.__quizStartedAt) / 1000))
            : 0;
        history.push({
            quizId: currentQuiz ? currentQuiz.id : 0,
            quizTitle: currentQuiz ? currentQuiz.title : '(Không tên)',
            score: parseFloat(score), correct, total,
            date: new Date().toLocaleString('vi-VN'),
            timestamp: Date.now(),
            timeSpent: timeSpent
        });
        saveHistory();
        // Invalidate memoized stats (v1.6.1)
        if (typeof invalidateStatsCache === 'function') invalidateStatsCache();
        return timeSpent;
    } catch (e) {
        console.warn('Không lưu được lịch sử:', e);
        return 0;
    }
}

function submitQuiz() {
    try {
        clearInterval(timerInterval);
        timerInterval = null;
    } catch (e) {}
    try { hideQuestionStatusPanel(); } catch (e) {}

    if (!shuffledQuiz || !shuffledQuiz.questions || shuffledQuiz.questions.length === 0) {
        showToast && showToast('Không có dữ liệu bài làm!', 'error');
        return;
    }

    const questions = shuffledQuiz.questions;

    // 1) Collect answers + count correct (fast — no HTML to avoid Zalo WebView OOM)
    const { total, correct } = _collectQuizAnswers(questions, userAnswers);

    // 2) Calculate score + grade meta
    const scoreInfo = _calculateQuizScore(correct, total);
    const score = scoreInfo.score;

    // 3) Save history (defensive against localStorage quota)
    const timeSpentDisp = _saveQuizHistory(score, correct, total);

    // 4) Show result UI first (lightweight) — guarantees user sees score even if review fails
    // ⚠️ BUG FIX (v1.5.2): use `var` to avoid TDZ on buggy WebView (Zalo) where `let` may throw ReferenceError.
    var userWantsDetail = (shuffledQuiz && shuffledQuiz.showReviewDetail === false) ? false : true;
    var reviewVisible = userWantsDetail && (total <= 150);
    var reviewRendered = false;

    const resultEl = document.getElementById('resultContent');
    const minutes = Math.floor(timeSpentDisp / 60);
    const seconds = timeSpentDisp % 60;
    const timeStr = minutes > 0 ? `${minutes}p ${seconds}s` : `${seconds}s`;

    resultEl.innerHTML = _buildResultHtml(scoreInfo, correct, total, timeStr, reviewVisible);

    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.getElementById('result').classList.add('active');
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });

    // 4) Lazy render review theo CHUNK — tránh crash WebView khi đề lớn
    const reviewContainer = document.getElementById('reviewContainer');
    const toggleBtn = document.getElementById('toggleReviewBtn');

    function buildItemHTML(q, i) {
        try {
            const ua = userAnswers[i];
            const ok = ua === q.correct;
            const userAnsText = (ua !== undefined && q.options[ua] !== undefined)
                ? String.fromCharCode(65 + ua) + '. ' + escapeHtml(q.options[ua])
                : '(không trả lời)';
            const correctAnsText = (q.options[q.correct] !== undefined)
                ? String.fromCharCode(65 + q.correct) + '. ' + escapeHtml(q.options[q.correct])
                : '(N/A)';
            if (ok) {
                // Câu ĐÚNG: chỉ hiển thị câu hỏi + dấu ✓, click bỏ qua (không làm gì)
                return `<div class="review-question correct" data-correct="1">
                    <strong>✅ Câu ${i + 1}: ${escapeHtml(q.question)}</strong>
                </div>`;
            }
            // Câu SAI: hiển thị thu gọn, click để mở chi tiết bên dưới
            return `<div class="review-question wrong collapsed" data-correct="0" onclick="toggleReviewDetail(this)" title="Bấm để xem chi tiết">
                <strong>❌ Câu ${i + 1}: ${escapeHtml(q.question)}</strong>
                <span class="review-toggle-hint">▼ Bấm để xem đáp án</span>
                <div class="review-detail" style="display:none;margin-top:10px;padding-top:10px;border-top:1px dashed rgba(238,82,83,0.4)">
                    Đáp án của bạn: ${userAnsText}<br>
                    Đáp án đúng: <strong>${correctAnsText}</strong>
                </div>
            </div>`;
        } catch (e) {
            return `<div class="review-question wrong"><strong>Câu ${i + 1}: (lỗi hiển thị)</strong></div>`;
        }
    }

    function renderReviewLazy() {
        if (reviewRendered) return;
        reviewRendered = true;
        reviewContainer.innerHTML = '';
        const FIRST = Math.min(20, total);
        let firstHTML = '';
        for (let i = 0; i < FIRST; i++) firstHTML += buildItemHTML(questions[i], i);
        reviewContainer.innerHTML = firstHTML;

        if (total <= FIRST) return;

        const hint = document.createElement('div');
        hint.style.cssText = 'text-align:center;padding:12px;color:#888;font-style:italic;font-size:14px';
        hint.textContent = `⏳ Đang tải chi tiết... ${FIRST}/${total}`;
        reviewContainer.appendChild(hint);

        let idx = FIRST;
        const CHUNK = 25;
        const schedule = window.requestIdleCallback
            ? (cb) => window.requestIdleCallback(cb, { timeout: 300 })
            : (cb) => setTimeout(cb, 16);

        function next() {
            try {
                if (idx >= total) { hint.remove(); return; }
                const end = Math.min(idx + CHUNK, total);
                let html = '';
                for (let i = idx; i < end; i++) html += buildItemHTML(questions[i], i);
                hint.insertAdjacentHTML('beforebegin', html);
                idx = end;
                hint.textContent = `⏳ Đang tải chi tiết... ${idx}/${total}`;
                if (idx >= total) hint.remove();
                else schedule(next);
            } catch (e) {
                console.error('Render review error:', e);
                hint.textContent = '⚠️ Lỗi tải chi tiết';
            }
        }
        schedule(next);
    }

    if (toggleBtn) {
        toggleBtn.addEventListener('click', () => {
            if (!reviewVisible) {
                reviewVisible = true;
                toggleBtn.textContent = '🙈 Ẩn chi tiết';
                renderReviewLazy();
            } else {
                reviewVisible = false;
                toggleBtn.textContent = '👁️ Hiện chi tiết';
                reviewContainer.innerHTML = '';
                reviewRendered = false;
            }
        });
    }

    if (reviewVisible) {
        // Render sau 1 tick để UI điểm hiện trước
        setTimeout(renderReviewLazy, 30);
    }
}

// ============= XUẤT CSV =============
function exportCSV(id) {
    const quiz = quizzes.find(q => q.id === id);
    let csv = '\uFEFF'; // BOM cho UTF-8
    csv += 'Câu hỏi,Đáp án A,Đáp án B,Đáp án C,Đáp án D,Đáp án đúng\n';
    quiz.questions.forEach(q => {
        const cells = [q.question, ...q.options, String.fromCharCode(65+q.correct)];
        csv += cells.map(c => `"${String(c).replace(/"/g,'""')}"`).join(',') + '\n';
    });
    downloadFile(csv, `${quiz.title}.csv`, 'text/csv;charset=utf-8;');
}

function downloadTemplate() {
    let csv = '\uFEFF';
    csv += 'Câu hỏi,Đáp án A,Đáp án B,Đáp án C,Đáp án D,Đáp án đúng\n';
    csv += '"2 + 2 = ?","3","4","5","6","B"\n';
    csv += '"Thủ đô Việt Nam?","TPHCM","Hà Nội","Đà Nẵng","Huế","B"\n';
    downloadFile(csv, 'mau_cau_hoi.csv', 'text/csv;charset=utf-8;');
}

function downloadFile(content, filename, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

// ============= NHẬP CSV =============
function importCSV(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
        try {
            const text = e.target.result;
            const rows = parseCSV(text);
            if (rows.length < 2) return showToast('File CSV không có dữ liệu!', 'error');
            const imported = [];
            for (let i = 1; i < rows.length; i++) {
                const r = rows[i];
                if (r.length < 6 || !r[0].trim()) continue;
                const correctLetter = r[5].trim().toUpperCase();
                const correctIdx = ['A','B','C','D'].indexOf(correctLetter);
                if (correctIdx === -1) continue;
                imported.push({
                    question: r[0].trim(),
                    options: [r[1], r[2], r[3], r[4]].map(s => s.trim()),
                    correct: correctIdx
                });
            }
            if (imported.length === 0) return alert('⚠️ Không nhập được câu hỏi nào!');
            questions = questions.concat(imported);
            renderQuestions();
            showToast(`Đã nhập ${imported.length} câu hỏi!`, 'success');
        } catch (err) { showToast('Lỗi: ' + err.message, 'error'); }
    };
    reader.readAsText(file, 'UTF-8');
    event.target.value = '';
}

function parseCSV(text) {
    const rows = [];
    let row = [], cur = '', inQuote = false;
    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (inQuote) {
            if (ch === '"' && text[i+1] === '"') { cur += '"'; i++; }
            else if (ch === '"') inQuote = false;
            else cur += ch;
        } else {
            if (ch === '"') inQuote = true;
            else if (ch === ',') { row.push(cur); cur = ''; }
            else if (ch === '\n' || ch === '\r') {
                if (cur || row.length) { row.push(cur); rows.push(row); row = []; cur = ''; }
                if (ch === '\r' && text[i+1] === '\n') i++;
            } else cur += ch;
        }
    }
    if (cur || row.length) { row.push(cur); rows.push(row); }
    return rows;
}

// ============= NHẬP WORD =============
function importWord(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
        mammoth.extractRawText({ arrayBuffer: e.target.result })
            .then(result => {
                const text = result.value;
                const imported = parseWordText(text);
                if (imported.length === 0) {
                    alert('⚠️ Không tìm thấy câu hỏi! Xem hướng dẫn định dạng.');
                    showFormatGuide(); return;
                }
                questions = questions.concat(imported);
                renderQuestions();
                alert(`✅ Đã nhập ${imported.length} câu hỏi từ Word!`);
            })
            .catch(err => alert('❌ Lỗi đọc Word: ' + err.message));
    };
    reader.readAsArrayBuffer(file);
    event.target.value = '';
}

// Định dạng Word: 
// Câu 1: [Nội dung]
// A. ...
// B. ...
// C. ...
// D. ...
// Đáp án: B
function parseWordText(text) {
    const lines = text.split('\n').map(l => l.trim()).filter(l => l);
    const imported = [];
    let cur = null;
    for (const line of lines) {
        if (/^(câu|c[aâ]u)\s*\d+\s*[:.\)]/i.test(line)) {
            if (cur && cur.options.filter(o=>o).length >= 2) imported.push(cur);
            cur = { question: line.replace(/^(câu|c[aâ]u)\s*\d+\s*[:.\)]\s*/i,''), options: ['','','',''], correct: 0 };
        } else if (/^[A-D][\.\):]/i.test(line) && cur) {
            const letter = line[0].toUpperCase();
            const idx = letter.charCodeAt(0) - 65;
            cur.options[idx] = line.substring(2).trim().replace(/^[\.\):\s]+/,'');
        } else if (/^(đáp án|dap an|answer)\s*[:=]/i.test(line) && cur) {
            const m = line.match(/[A-D]/i);
            if (m) cur.correct = m[0].toUpperCase().charCodeAt(0) - 65;
        } else if (cur && !cur.options[0]) {
            cur.question += ' ' + line;
        }
    }
    if (cur && cur.options.filter(o=>o).length >= 2) imported.push(cur);
    return imported;
}

// ============= XUẤT WORD =============
function exportWord(id) {
    const quiz = quizzes.find(q => q.id === id);
    const { Document, Paragraph, TextRun, HeadingLevel, Packer, AlignmentType } = docx;
    
    const children = [
        new Paragraph({ text: quiz.title, heading: HeadingLevel.HEADING_1, alignment: AlignmentType.CENTER }),
        new Paragraph({ text: quiz.desc || '', alignment: AlignmentType.CENTER }),
        new Paragraph({ text: `Thời gian: ${quiz.time} phút | Số câu: ${quiz.questions.length}`, alignment: AlignmentType.CENTER }),
        new Paragraph({ text: '' })
    ];
    
    quiz.questions.forEach((q, i) => {
        children.push(new Paragraph({ children: [new TextRun({ text: `Câu ${i+1}: ${q.question}`, bold: true })] }));
        q.options.forEach((opt, j) => {
            children.push(new Paragraph({ text: `${String.fromCharCode(65+j)}. ${opt}` }));
        });
        children.push(new Paragraph({ children: [new TextRun({ text: `Đáp án: ${String.fromCharCode(65+q.correct)}`, italics: true, color: '008000' })] }));
        children.push(new Paragraph({ text: '' }));
    });
    
    const doc = new Document({ sections: [{ children }] });
    Packer.toBlob(doc).then(blob => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `${quiz.title}.docx`; a.click();
        URL.revokeObjectURL(url);
    });
}

// ============= HƯỚNG DẪN ĐỊNH DẠNG (v1.8.0 — floating card) =============
function showFormatGuide() {
    document.getElementById('modalContent').innerHTML = `
        <h3>📄 File CSV</h3>
        <p>Cột: <b>Câu hỏi | A | B | C | D | Đáp án đúng</b> (A/B/C/D)</p>
        <pre>Câu hỏi,Đáp án A,Đáp án B,Đáp án C,Đáp án D,Đáp án đúng
"2+2=?","3","4","5","6","B"
"Thủ đô VN?","TPHCM","Hà Nội","Đà Nẵng","Huế","B"</pre>
        <p>👉 Bấm <b>"Tải mẫu CSV"</b> để có file mẫu sẵn.</p>

        <h3>📝 File Word (.docx)</h3>
        <p>Định dạng mỗi câu hỏi theo mẫu sau:</p>
        <pre>Câu 1: 2 + 2 = ?
A. 3
B. 4
C. 5
D. 6
Đáp án: B

Câu 2: Thủ đô Việt Nam?
A. TPHCM
B. Hà Nội
C. Đà Nẵng
D. Huế
Đáp án: B</pre>
        <h3>⚠️ Lưu ý</h3>
        <ul>
            <li>Mỗi câu bắt đầu bằng <b>"Câu [số]:"</b></li>
            <li>Đáp án bắt đầu bằng <b>A. B. C. D.</b></li>
            <li>Dòng cuối phải có <b>"Đáp án: [chữ]"</b></li>
        </ul>
        <div class="fc-tip">💡 Kéo header để di chuyển thẻ nổi này đến vị trí bạn muốn!</div>
    `;
    openFloatingCard('modal');
}

// ============= FLOATING CARD HELPERS (v1.8.0) =============
/** Open a floating card by id and bring to front */
function openFloatingCard(id) {
    const el = document.getElementById(id);
    if (!el) return;
    // Bring to front by raising z-index above siblings
    document.querySelectorAll('.floating-card.active').forEach(c => { c.style.zIndex = 1500; });
    el.style.zIndex = 1501;
    el.classList.add('active');
    el.classList.remove('minimized');
    // Restore saved position if any
    try {
        const saved = JSON.parse(localStorage.getItem('fc_pos_' + id) || 'null');
        if (saved && typeof saved.left === 'number' && typeof saved.top === 'number') {
            clampAndApplyPos(el, saved.left, saved.top);
        }
    } catch (_) { /* ignore */ }
    initFloatingCardDrag(el);
}

/** Close a floating card by id */
function closeFloatingCard(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.remove('active', 'minimized');
}

/** Toggle minimize/maximize */
function toggleFloatingCard(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.toggle('minimized');
    const btn = el.querySelector('.fc-min');
    if (btn) btn.textContent = el.classList.contains('minimized') ? '▢' : '—';
}

/** Clamp position to viewport and apply via inline style */
function clampAndApplyPos(el, left, top) {
    const rect = el.getBoundingClientRect();
    const w = rect.width || el.offsetWidth || 320;
    const h = rect.height || el.offsetHeight || 60;
    const maxLeft = Math.max(0, window.innerWidth - w);
    const maxTop = Math.max(0, window.innerHeight - h);
    const cL = Math.min(Math.max(0, left), maxLeft);
    const cT = Math.min(Math.max(0, top), maxTop);
    el.style.left = cL + 'px';
    el.style.top = cT + 'px';
    el.style.right = 'auto';
    el.style.bottom = 'auto';
}

/** Attach drag behavior to a floating card (idempotent) */
function initFloatingCardDrag(card) {
    if (!card || card._dragInit) return;
    card._dragInit = true;
    const header = card.querySelector('.fc-header');
    if (!header) return;
    let startX = 0, startY = 0, startLeft = 0, startTop = 0, dragging = false;

    const onDown = (e) => {
        // Ignore clicks on buttons inside header
        if (e.target.closest('.fc-btn')) return;
        const point = e.touches ? e.touches[0] : e;
        const rect = card.getBoundingClientRect();
        startLeft = rect.left;
        startTop = rect.top;
        startX = point.clientX;
        startY = point.clientY;
        dragging = true;
        card.classList.add('dragging');
        // Lock to inline position so dragging works
        card.style.left = startLeft + 'px';
        card.style.top = startTop + 'px';
        card.style.right = 'auto';
        card.style.bottom = 'auto';
        e.preventDefault();
    };
    const onMove = (e) => {
        if (!dragging) return;
        const point = e.touches ? e.touches[0] : e;
        const dx = point.clientX - startX;
        const dy = point.clientY - startY;
        clampAndApplyPos(card, startLeft + dx, startTop + dy);
        e.preventDefault();
    };
    const onUp = () => {
        if (!dragging) return;
        dragging = false;
        card.classList.remove('dragging');
        // Persist position
        try {
            const id = card.id;
            localStorage.setItem('fc_pos_' + id, JSON.stringify({
                left: parseFloat(card.style.left) || 0,
                top: parseFloat(card.style.top) || 0
            }));
        } catch (_) { /* ignore */ }
    };

    header.addEventListener('mousedown', onDown);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    header.addEventListener('touchstart', onDown, { passive: false });
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onUp);
}

// Auto-init all floating cards once DOM is ready
if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
        document.querySelectorAll('.floating-card').forEach(initFloatingCardDrag);
    });
}

// ============= THỐNG KÊ (v1.5.0 — enhanced) =============
let scoreChartObj = null, pieChartObj = null;

// Helper: format seconds into human-readable Vietnamese duration
function formatDuration(sec) {
    sec = Math.max(0, Math.floor(sec || 0));
    if (sec < 60) return sec + 's';
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    if (m < 60) return s ? `${m}p ${s}s` : `${m}p`;
    const h = Math.floor(m / 60);
    const mm = m % 60;
    return mm ? `${h}h ${mm}p` : `${h}h`;
}

// Helper: compute current streak — consecutive recent entries with score >= 5
function computeStreak() {
    if (!history.length) return 0;
    const sorted = [...history].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    let s = 0;
    for (const h of sorted) {
        if (h.score >= 5) s++;
        else break;
    }
    return s;
}

// Helper: count history within time window (ms)
function countWithin(ms) {
    const cutoff = Date.now() - ms;
    return history.filter(h => (h.timestamp || 0) >= cutoff);
}

// Helper: classify score → CSS variant
function scoreClass(score) {
    if (score >= 8) return 'excellent';
    if (score >= 6.5) return 'good';
    if (score >= 5) return 'average';
    return 'weak';
}

// Helper: apply current history filters (search/score/date) → filtered array
function getFilteredHistory() {
    const searchEl = document.getElementById('historySearch');
    const scoreEl = document.getElementById('historyScoreFilter');
    const dateEl = document.getElementById('historyDateFilter');
    const q = (searchEl && searchEl.value || '').trim().toLowerCase();
    const sf = scoreEl ? scoreEl.value : 'all';
    const df = dateEl ? dateEl.value : 'all';
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    return history.filter(h => {
        if (q && !(h.quizTitle || '').toLowerCase().includes(q)) return false;
        if (sf !== 'all') {
            const cls = scoreClass(h.score);
            if (cls !== sf) return false;
        }
        if (df !== 'all' && h.timestamp) {
            const age = now - h.timestamp;
            if (df === 'today' && age > dayMs) return false;
            if (df === 'week' && age > 7 * dayMs) return false;
            if (df === 'month' && age > 30 * dayMs) return false;
        }
        return true;
    });
}

// Render the history list — re-callable on filter change
function renderHistoryList() {
    const histList = document.getElementById('historyList');
    if (!histList) return;
    const filtered = getFilteredHistory();
    if (history.length === 0) {
        histList.innerHTML = `<div class="history-empty"><span class="emoji">📭</span>Chưa có lịch sử làm bài.<br>Hãy thử làm một đề thi nhé!</div>`;
        return;
    }
    if (filtered.length === 0) {
        histList.innerHTML = `<div class="history-empty"><span class="emoji">🔍</span>Không tìm thấy lịch sử khớp với bộ lọc.</div>`;
        return;
    }
    // Newest first, capped at 50 entries for performance
    const display = [...filtered].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)).slice(0, 50);
    // v1.6.1 — Event delegation: replace per-row onclick with data-ts + 1 listener.
    histList.innerHTML = display.map(h => {
        const cls = scoreClass(h.score);
        const timeText = h.timeSpent ? ` • ⏱️ ${formatDuration(h.timeSpent)}` : '';
        return `
            <div class="history-item left-${cls}" data-ts="${h.timestamp || 0}">
                <div class="h-info">
                    <b>${escapeHtml(h.quizTitle)}</b>
                    <small>${escapeHtml(h.date || '')} • Đúng ${h.correct}/${h.total}${timeText}</small>
                </div>
                <div class="h-actions">
                    <div class="score-badge ${cls}">${h.score}/10</div>
                    <button class="h-delete" data-action="delete" title="Xóa mục này">🗑️</button>
                </div>
            </div>
        `;
    }).join('');

    // Bind delegated handler ONCE per #historyList lifetime (idempotent).
    if (!histList.__delegatedBound) {
        histList.addEventListener('click', (ev) => {
            const btn = ev.target.closest('button[data-action="delete"]');
            if (!btn) return;
            const row = btn.closest('.history-item[data-ts]');
            if (!row) return;
            const ts = parseInt(row.getAttribute('data-ts'), 10);
            if (!ts) return;
            deleteHistoryEntry(ts);
        });
        histList.__delegatedBound = true;
    }
}

// Delete one history entry by timestamp
function deleteHistoryEntry(timestamp) {
    if (!timestamp) return;
    if (!confirm('Xóa mục lịch sử này?')) return;
    const idx = history.findIndex(h => h.timestamp === timestamp);
    if (idx === -1) return;
    history.splice(idx, 1);
    try { saveHistory(); } catch (e) { console.warn(e); }
    renderStats();
    try { showToast('🗑️ Đã xóa mục lịch sử', 'success', 1500); } catch (_) {}
}

// Clear all history
function clearAllHistory() {
    if (!history.length) {
        try { showToast('Chưa có lịch sử để xóa', 'info', 1500); } catch (_) {}
        return;
    }
    if (!confirm(`Xóa TẤT CẢ ${history.length} mục lịch sử? Hành động này không thể hoàn tác.`)) return;
    history.length = 0;
    try { saveHistory(); } catch (e) { console.warn(e); }
    // v1.6.1 — explicit cache invalidation (saveHistory also does this, belt-and-braces)
    try { invalidateStatsCache(); } catch (_) {}
    renderStats();
    try { showToast('✅ Đã xóa toàn bộ lịch sử', 'success', 1800); } catch (_) {}
}

// Export history as CSV file
function exportHistoryCSV() {
    if (!history.length) {
        try { showToast('Chưa có lịch sử để xuất', 'info', 1800); } catch (_) {}
        return;
    }
    const esc = (v) => {
        const s = String(v == null ? '' : v);
        return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    const header = ['STT', 'Tên đề', 'Điểm', 'Đúng', 'Tổng', 'Thời gian (giây)', 'Ngày'];
    const rows = [...history]
        .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0))
        .map((h, i) => [i + 1, h.quizTitle, h.score, h.correct, h.total, h.timeSpent || 0, h.date || '']);
    const csv = '\uFEFF' + [header, ...rows].map(r => r.map(esc).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lich-su-lam-bai-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    try { showToast('📥 Đã xuất CSV', 'success', 1800); } catch (_) {}
}

/**
 * Render per-quiz stats card (top 6 most attempted).
 * v1.6.1 — Memoized per-quiz aggregation. Cache invalidated on history mutation.
 * v1.7.0 — JSDoc typed.
 * @returns {Array<{title:string, attempts:number, sum:number, best:number}>}
 */
function computePerQuizStats() {
    if (__statsCache.perQuiz) return __statsCache.perQuiz;
    const map = new Map();
    for (const h of history) {
        const key = h.quizId || 0;
        if (!map.has(key)) {
            map.set(key, { title: h.quizTitle, attempts: 0, sum: 0, best: 0 });
        }
        const o = map.get(key);
        o.attempts++;
        o.sum += h.score;
        if (h.score > o.best) o.best = h.score;
        o.title = h.quizTitle; // keep latest title
    }
    const list = [...map.values()]
        .sort((a, b) => b.attempts - a.attempts || b.best - a.best)
        .slice(0, 6);
    __statsCache.perQuiz = list;
    return list;
}

function renderPerQuizStats() {
    const el = document.getElementById('perQuizStats');
    if (!el) return;
    if (!history.length) {
        el.innerHTML = `<div class="pq-empty">Chưa có dữ liệu — hãy làm vài đề trước nhé!</div>`;
        return;
    }
    const list = computePerQuizStats();
    el.innerHTML = list.map(o => `
        <div class="pq-row">
            <div class="pq-title" title="${escapeHtml(o.title)}">${escapeHtml(o.title)}</div>
            <div class="pq-metric">Số lần: <b>${o.attempts}</b></div>
            <div class="pq-metric">TB: <b>${(o.sum / o.attempts).toFixed(2)}</b></div>
            <div class="pq-best">🏆 ${o.best.toFixed(2)}</div>
        </div>
    `).join('');
}

// Render time-window stats (today/week/month/all-time)
function renderTimeWindowStats() {
    const el = document.getElementById('statsTimeWindow');
    if (!el) return;
    const dayMs = 24 * 60 * 60 * 1000;
    const buckets = [
        { label: 'Hôm nay', items: countWithin(dayMs), emoji: '☀️' },
        { label: '7 ngày', items: countWithin(7 * dayMs), emoji: '📅' },
        { label: '30 ngày', items: countWithin(30 * dayMs), emoji: '🗓️' },
        { label: 'Tất cả', items: history, emoji: '∞' },
    ];
    el.innerHTML = buckets.map(b => {
        const n = b.items.length;
        const avg = n ? (b.items.reduce((s, h) => s + h.score, 0) / n).toFixed(2) : '—';
        return `
            <div class="tw-card">
                <div class="tw-num">${b.emoji} ${n}</div>
                <div class="tw-label">${b.label}</div>
                <div class="tw-avg">TB: ${avg}</div>
            </div>
        `;
    }).join('');
}

/**
 * v1.6.1 — Memoized overview computation. Cache is invalidated on every
 * saveHistory() / clearHistory() via invalidateStatsCache().
 * v1.7.0 — JSDoc typed.
 * @returns {StatsOverview}
 */
function computeStatsOverview() {
    if (__statsCache.overview) return __statsCache.overview;
    const total = history.length;
    let sum = 0, max = 0, passCount = 0, totalTime = 0;
    const quizIds = new Set();
    for (let i = 0; i < total; i++) {
        const h = history[i];
        sum += h.score;
        if (h.score > max) max = h.score;
        if (h.score >= 5) passCount++;
        totalTime += (h.timeSpent || 0);
        quizIds.add(h.quizId);
    }
    const overview = {
        total,
        avg: total ? (sum / total).toFixed(2) : '0.00',
        max: total ? max.toFixed(2) : '0.00',
        uniqueQuizzes: quizIds.size,
        streak: computeStreak(),
        totalTime,
        passRate: total ? Math.round((passCount / total) * 100) : 0
    };
    __statsCache.overview = overview;
    return overview;
}

function renderStats() {
    const ov = computeStatsOverview();
    const total = ov.total;
    const avg = ov.avg;
    const max = ov.max;
    const uniqueQuizzes = ov.uniqueQuizzes;
    const streak = ov.streak;
    const totalTime = ov.totalTime;
    const passRate = ov.passRate;

    document.getElementById('statsOverview').innerHTML = `
        <div class="stat-card variant-1">
            <span class="icon">📊</span>
            <div class="num">${total}</div>
            <div class="label">Lượt làm bài</div>
        </div>
        <div class="stat-card variant-2">
            <span class="icon">📈</span>
            <div class="num">${avg}</div>
            <div class="label">Điểm trung bình</div>
            <div class="sub">Tỉ lệ đạt: ${passRate}%</div>
        </div>
        <div class="stat-card variant-3">
            <span class="icon">🏆</span>
            <div class="num">${max}</div>
            <div class="label">Điểm cao nhất</div>
        </div>
        <div class="stat-card variant-4">
            <span class="icon">🔥</span>
            <div class="num">${streak}</div>
            <div class="label">Chuỗi đạt ≥5</div>
            <div class="sub">(liên tiếp gần nhất)</div>
        </div>
        <div class="stat-card variant-5">
            <span class="icon">📚</span>
            <div class="num">${uniqueQuizzes}</div>
            <div class="label">Đề đã làm</div>
        </div>
        <div class="stat-card variant-6">
            <span class="icon">⏱️</span>
            <div class="num" style="font-size:22px">${formatDuration(totalTime)}</div>
            <div class="label">Tổng thời gian</div>
        </div>
    `;

    // Time-window stats
    renderTimeWindowStats();

    // Lấy màu theo theme
    const isDark = !document.body.classList.contains('light-mode');
    const gridColor = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';
    const textColor = isDark ? '#e4e6eb' : '#333';

    // Biểu đồ đường - điểm theo thời gian
    if (scoreChartObj) scoreChartObj.destroy();
    const recent = history.slice(-15);
    scoreChartObj = new Chart(document.getElementById('scoreChart'), {
        type: 'line',
        data: {
            labels: recent.map((_, i) => `Lần ${history.length - recent.length + i + 1}`),
            datasets: [{
                label: 'Điểm',
                data: recent.map(h => h.score),
                borderColor: '#7c8cf8',
                backgroundColor: 'rgba(124,140,248,0.2)',
                fill: true,
                tension: 0.3,
                pointBackgroundColor: '#ff6b6b',
                pointRadius: 5
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: { min: 0, max: 10, grid: { color: gridColor }, ticks: { color: textColor } },
                x: { grid: { color: gridColor }, ticks: { color: textColor } }
            },
            plugins: { legend: { labels: { color: textColor } } }
        }
    });

    // Biểu đồ tròn - phân loại
    if (pieChartObj) pieChartObj.destroy();
    const cats = { 'Xuất sắc (≥8)': 0, 'Khá (6.5-8)': 0, 'TB (5-6.5)': 0, 'Yếu (<5)': 0 };
    history.forEach(h => {
        if (h.score >= 8) cats['Xuất sắc (≥8)']++;
        else if (h.score >= 6.5) cats['Khá (6.5-8)']++;
        else if (h.score >= 5) cats['TB (5-6.5)']++;
        else cats['Yếu (<5)']++;
    });
    pieChartObj = new Chart(document.getElementById('pieChart'), {
        type: 'doughnut',
        data: {
            labels: Object.keys(cats),
            datasets: [{
                data: Object.values(cats),
                backgroundColor: ['#1dd1a1', '#54a0ff', '#feca57', '#ee5253'],
                borderColor: isDark ? '#1e2530' : '#fff',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            plugins: { legend: { labels: { color: textColor } } }
        }
    });

    // Per-quiz stats
    renderPerQuizStats();

    // History list (with filters)
    renderHistoryList();

    // Wire filter event listeners (idempotent — bind only once)
    // v1.6.1: use debounced handler for the search input (avoid heavy renders on every keystroke)
    if (!window.__historyFiltersBound) {
        const debouncedRender = (typeof debounce === 'function') ? debounce(renderHistoryList, 300) : renderHistoryList;
        window.renderHistoryListDebounced = debouncedRender;
        const ids = ['historySearch', 'historyScoreFilter', 'historyDateFilter'];
        ids.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                if (el.tagName === 'INPUT') {
                    el.addEventListener('input', debouncedRender);
                } else {
                    el.addEventListener('change', renderHistoryList);
                }
            }
        });
        window.__historyFiltersBound = true;
    }
}

// ============= BỘ ĐỀ ÔN TẬP CÓ SẴN (PRELOADED) =============
// IMPORTANT (v1.4.0): Do NOT persist preloaded quizzes to localStorage.
// They're loaded fresh every page from questions-data.js, and persisting them
// (450 questions × ~250KB JSON) causes QuotaExceededError on Zalo WebView / iOS Safari Private mode
// → uncaught error → "Đã có sự cố xảy ra liên tục" page crash.
// Only user-created quizzes are persisted.
function loadPreloadedQuizzes() {
    try {
        if (!window.PRELOADED_QUIZZES || !Array.isArray(window.PRELOADED_QUIZZES)) return;
        let added = 0;
        let syncedQuestions = 0;
        for (const pq of window.PRELOADED_QUIZZES) {
            const existing = quizzes.find(q => q.id === pq.id);
            if (existing) {
                // Mark as preloaded so we can skip saving later
                existing.__preloaded = true;
                // Đồng bộ NỘI DUNG câu hỏi từ nguồn (khi bộ đề có cập nhật)
                // KHÔNG ghi đè các cài đặt người dùng đã tùy chỉnh:
                // time, shuffleQ, shuffleO, questionLimit
                if (Array.isArray(pq.questions) && pq.questions.length !== existing.questions.length) {
                    existing.questions = pq.questions;
                    syncedQuestions++;
                }
                continue;
            }
            // Add in-memory only; mark as preloaded so we don't write 250KB to localStorage
            quizzes.push({ ...pq, __preloaded: true });
            added++;
        }
        // Do NOT call localStorage.setItem here — keep preloaded quizzes in memory only.
        if (added > 0) console.log(`✅ Đã nạp ${added} bộ đề ôn tập có sẵn (in-memory)`);
        if (syncedQuestions > 0) console.log(`🔄 Đã đồng bộ câu hỏi cho ${syncedQuestions} bộ đề`);
    } catch (e) {
        console.error('[loadPreloadedQuizzes] error:', e);
        try { showToast('⚠️ Không thể nạp bộ đề ôn tập: ' + (e.message || e), 'error', 3500); } catch (_) {}
    }
}

function startPreloadedQuiz() {
    try {
        if (!window.PRELOADED_QUIZZES || window.PRELOADED_QUIZZES.length === 0) {
            return showToast('Chưa có bộ đề ôn tập!', 'error');
        }
        const pq = window.PRELOADED_QUIZZES[0];
        // Ensure it exists in in-memory quizzes array (no localStorage write)
        if (!quizzes.some(q => q.id === pq.id)) {
            quizzes.push({ ...pq, __preloaded: true });
        }
        // Bắt đầu ôn tập ngay với cài đặt mặc định (không mở modal tùy chỉnh)
        startQuiz(pq.id);
    } catch (e) {
        console.error('[startPreloadedQuiz] error:', e);
        try { showToast('⚠️ Không thể bắt đầu ôn tập: ' + (e.message || e), 'error', 4000); } catch (_) {}
    }
}

window.onload = () => { 
    loadTheme();
    createParticles();
    initSwipeGesture();
    preventDoubleTapZoom();
    registerServiceWorker();    // 👈 MỚI
    initConnectionMonitor();    // 👈 MỚI
    initInstallPrompt();        // 👈 MỚI
    initKeyboardShortcuts();    // 👈 MỚI
    loadPreloadedQuizzes();     // 👈 MỚI: Nạp bộ đề ôn tập tổng hợp
    if (quizzes.length === 0) renderQuizList(); 

    // v1.6.1: Wire up debounced search handlers (300ms) — avoid heavy renders on every keystroke
    window.renderQuizListDebounced = debounce(renderQuizList, 300);
    window.renderHistoryListDebounced = debounce(renderHistoryList, 300);
    const sq = document.getElementById('searchQuiz');
    if (sq && !sq.__debouncedBound) {
        sq.removeAttribute('oninput');
        sq.addEventListener('input', window.renderQuizListDebounced);
        sq.__debouncedBound = true;
    }
    
    // Đóng menu khi resize
    window.addEventListener('resize', () => {
        if (window.innerWidth > 768) {
            const nav = document.getElementById('mainNav');
            const overlay = document.getElementById('menuOverlay');
            nav?.classList.remove('mobile-open');
            overlay?.classList.remove('active');
            document.body.style.overflow = '';
            const ham = document.getElementById('hamburger');
            if (ham) ham.textContent = '☰';
        }
    });
};





// ============= TOGGLE CHI TIẾT CÂU SAI (kết quả trắc nghiệm) =============
// Khi ấn vào 1 câu trong phần kết quả:
//  - Nếu là câu SAI -> hiển thị chi tiết đáp án (user / đúng) ngay bên dưới.
//  - Nếu là câu ĐÚNG -> bỏ qua (không làm gì).
function toggleReviewDetail(el) {
    try {
        if (!el) return;
        // Câu đúng: bỏ qua hoàn toàn
        if (el.dataset && el.dataset.correct === '1') return;
        const detail = el.querySelector('.review-detail');
        const hint = el.querySelector('.review-toggle-hint');
        if (!detail) return;
        const isOpen = detail.style.display !== 'none';
        if (isOpen) {
            detail.style.display = 'none';
            el.classList.add('collapsed');
            if (hint) hint.textContent = '▼ Bấm để xem đáp án';
        } else {
            detail.style.display = 'block';
            el.classList.remove('collapsed');
            if (hint) hint.textContent = '▲ Bấm để ẩn';
        }
    } catch (e) {
        console.warn('toggleReviewDetail error:', e);
    }
}
// Phơi ra global để onclick inline gọi được
window.toggleReviewDetail = toggleReviewDetail;

// ============================================================
// v1.6.0 — PRACTICE MODE (Luyện tập với phản hồi tức thì)
// ============================================================
let practiceState = null;

function startPractice(id) {
    try {
        const quiz = quizzes.find(q => q.id === id);
        if (!quiz) { showToast('Không tìm thấy đề thi!', 'error'); return; }
        // Use shuffled options always, but no time limit, no save to history
        const prepared = prepareQuizForDoing({ ...quiz, shuffleQ: true, shuffleO: true });
        practiceState = {
            quizId: id,
            title: quiz.title,
            questions: prepared.questions,
            current: 0,
            answers: {}, // { qIndex: selectedOptionIndex }
            correctCount: 0,
            wrongCount: 0
        };
        document.getElementById('practiceTitle').textContent = '📖 Luyện tập: ' + quiz.title;
        document.getElementById('practiceTotal').textContent = prepared.questions.length;
        document.getElementById('practiceCorrect').textContent = '0';
        document.getElementById('practiceWrong').textContent = '0';
        document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
        document.getElementById('practice').classList.add('active');
        if (typeof closeMobileMenu === 'function') closeMobileMenu();
        window.scrollTo({ top: 0, behavior: 'instant' });
        renderPracticeQuestion();
    } catch (e) {
        console.error('[startPractice] error:', e);
        showToast('Lỗi khi bắt đầu luyện tập: ' + e.message, 'error');
    }
}

function renderPracticeQuestion() {
    if (!practiceState) return;
    const { questions, current, answers } = practiceState;
    const q = questions[current];
    if (!q) return;
    const answered = answers[current];
    const answeredIdx = (typeof answered === 'number') ? answered : -1;
    const correctIdx = q.correct;

    let html = `<div class="practice-question">
        <div class="practice-q-number">Câu ${current + 1} / ${questions.length}</div>
        <div class="practice-q-text">${escapeHtml(q.question)}</div>
        <div class="practice-options">`;
    q.options.forEach((opt, i) => {
        let cls = 'practice-option';
        if (answeredIdx !== -1) {
            if (i === correctIdx) cls += ' correct';
            else if (i === answeredIdx) cls += ' wrong';
            else cls += ' disabled';
        }
        const letter = String.fromCharCode(65 + i);
        const onclickAttr = answeredIdx === -1 ? `onclick="practiceAnswer(${i})"` : '';
        html += `<div class="${cls}" ${onclickAttr}>
            <span class="practice-letter">${letter}.</span>
            <span class="practice-opt-text">${escapeHtml(opt)}</span>
        </div>`;
    });
    html += '</div>';
    if (answeredIdx !== -1) {
        const isRight = answeredIdx === correctIdx;
        html += `<div class="practice-feedback ${isRight ? 'right' : 'wrong'}">
            ${isRight
                ? '✅ <b>Chính xác!</b> Tốt lắm 🎉'
                : `❌ <b>Sai rồi.</b> Đáp án đúng là <b>${String.fromCharCode(65 + correctIdx)}. ${escapeHtml(q.options[correctIdx])}</b>`}
        </div>`;
    }
    html += '</div>';
    document.getElementById('practiceContent').innerHTML = html;
    document.getElementById('practiceCurrent').textContent = current + 1;
    const progressPct = ((current + 1) / questions.length) * 100;
    document.getElementById('practiceProgressFill').style.width = progressPct + '%';
    document.getElementById('practicePrevBtn').disabled = current === 0;
    document.getElementById('practiceNextBtn').disabled = current === questions.length - 1;
}

function practiceAnswer(optIdx) {
    if (!practiceState) return;
    const { questions, current, answers } = practiceState;
    if (typeof answers[current] === 'number') return; // already answered
    answers[current] = optIdx;
    if (optIdx === questions[current].correct) practiceState.correctCount++;
    else practiceState.wrongCount++;
    document.getElementById('practiceCorrect').textContent = practiceState.correctCount;
    document.getElementById('practiceWrong').textContent = practiceState.wrongCount;
    renderPracticeQuestion();
}

function practiceNext() {
    if (!practiceState) return;
    if (practiceState.current < practiceState.questions.length - 1) {
        practiceState.current++;
        renderPracticeQuestion();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
        showToast('🎉 Đã hết câu! Tổng: ' + practiceState.correctCount + ' đúng / ' + practiceState.wrongCount + ' sai', 'success', 4000);
    }
}

function practicePrev() {
    if (!practiceState) return;
    if (practiceState.current > 0) {
        practiceState.current--;
        renderPracticeQuestion();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
}

function practiceRestart() {
    if (!practiceState) return;
    if (!confirm('Bắt đầu lại từ đầu? Tiến độ hiện tại sẽ bị xoá.')) return;
    startPractice(practiceState.quizId);
}

function practiceExit() {
    if (practiceState && Object.keys(practiceState.answers).length > 0) {
        if (!confirm('Thoát khỏi luyện tập?')) return;
    }
    practiceState = null;
    showSection('list');
}

// ============================================================
// v1.6.0 — FLASHCARD MODE
// ============================================================
let flashcardState = null;

function startFlashcard(id) {
    try {
        const quiz = quizzes.find(q => q.id === id);
        if (!quiz) { showToast('Không tìm thấy đề thi!', 'error'); return; }
        // Clone & optionally shuffle
        const shuffleChk = document.getElementById('fcShuffleChk');
        const doShuffle = shuffleChk ? shuffleChk.checked : false;
        let cards = quiz.questions.slice();
        if (doShuffle) cards = shuffleArray(cards);
        flashcardState = {
            quizId: id,
            title: quiz.title,
            allCards: cards,
            cards: cards.slice(), // filtered view
            current: 0,
            flipped: false,
            known: new Set(),    // indices in allCards
            unknown: new Set(),  // indices in allCards
            onlyUnknown: false
        };
        document.getElementById('flashcardTitle').textContent = '🃏 Flashcard: ' + quiz.title;
        document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
        document.getElementById('flashcard').classList.add('active');
        if (typeof closeMobileMenu === 'function') closeMobileMenu();
        window.scrollTo({ top: 0, behavior: 'instant' });
        renderFlashcard();
    } catch (e) {
        console.error('[startFlashcard] error:', e);
        showToast('Lỗi khi bắt đầu flashcard: ' + e.message, 'error');
    }
}

function renderFlashcard() {
    if (!flashcardState) return;
    const { cards, current, flipped, known, unknown } = flashcardState;
    if (cards.length === 0) {
        document.getElementById('fcQuestion').textContent = '🎉 Không còn thẻ nào! Bạn đã thuộc hết.';
        document.getElementById('fcOptions').innerHTML = '';
        document.getElementById('fcCurrent').textContent = '0';
        document.getElementById('fcTotal').textContent = '0';
        document.getElementById('fcProgressFill').style.width = '100%';
        return;
    }
    const card = cards[current];
    document.getElementById('fcQuestion').textContent = card.question;
    const correctIdx = card.correct;
    let optsHtml = '';
    card.options.forEach((opt, i) => {
        const cls = i === correctIdx ? 'fc-opt fc-opt-correct' : 'fc-opt';
        const letter = String.fromCharCode(65 + i);
        optsHtml += `<div class="${cls}"><b>${letter}.</b> ${escapeHtml(opt)}${i === correctIdx ? ' ✅' : ''}</div>`;
    });
    document.getElementById('fcOptions').innerHTML = optsHtml;
    document.getElementById('fcCurrent').textContent = current + 1;
    document.getElementById('fcTotal').textContent = cards.length;
    document.getElementById('fcKnown').textContent = known.size;
    document.getElementById('fcUnknown').textContent = unknown.size;
    document.getElementById('fcProgressFill').style.width = (((current + 1) / cards.length) * 100) + '%';
    const inner = document.getElementById('flashcardInner');
    inner.classList.toggle('flipped', !!flipped);
}

function flashcardFlip() {
    if (!flashcardState) return;
    flashcardState.flipped = !flashcardState.flipped;
    renderFlashcard();
}

function flashcardNext() {
    if (!flashcardState) return;
    if (flashcardState.cards.length === 0) return;
    flashcardState.flipped = false;
    if (flashcardState.current < flashcardState.cards.length - 1) {
        flashcardState.current++;
    } else {
        flashcardState.current = 0; // loop
        showToast('🔁 Quay lại đầu bộ thẻ', 'success', 1500);
    }
    renderFlashcard();
}

function flashcardPrev() {
    if (!flashcardState) return;
    if (flashcardState.cards.length === 0) return;
    flashcardState.flipped = false;
    flashcardState.current = (flashcardState.current - 1 + flashcardState.cards.length) % flashcardState.cards.length;
    renderFlashcard();
}

function flashcardMark(isKnown) {
    if (!flashcardState || flashcardState.cards.length === 0) return;
    const card = flashcardState.cards[flashcardState.current];
    // Find index in allCards by reference
    const realIdx = flashcardState.allCards.indexOf(card);
    if (isKnown) {
        flashcardState.known.add(realIdx);
        flashcardState.unknown.delete(realIdx);
    } else {
        flashcardState.unknown.add(realIdx);
        flashcardState.known.delete(realIdx);
    }
    // Auto next
    flashcardNext();
}

function flashcardFilterToggle() {
    if (!flashcardState) return;
    const chk = document.getElementById('fcOnlyUnknownChk');
    flashcardState.onlyUnknown = !!(chk && chk.checked);
    if (flashcardState.onlyUnknown) {
        flashcardState.cards = flashcardState.allCards.filter((c, i) => !flashcardState.known.has(i));
    } else {
        flashcardState.cards = flashcardState.allCards.slice();
    }
    flashcardState.current = 0;
    flashcardState.flipped = false;
    renderFlashcard();
}

function flashcardRestart() {
    if (!flashcardState) return;
    const id = flashcardState.quizId;
    startFlashcard(id);
}

function flashcardExit() {
    if (!confirm('Thoát khỏi flashcard?')) return;
    flashcardState = null;
    showSection('list');
}

// Keyboard shortcuts for flashcard
document.addEventListener('keydown', (e) => {
    const fcActive = document.getElementById('flashcard')?.classList.contains('active');
    if (!fcActive || !flashcardState) return;
    // ignore when typing in inputs
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    switch (e.key) {
        case ' ': case 'Enter': e.preventDefault(); flashcardFlip(); break;
        case 'ArrowRight': case 'ArrowDown': e.preventDefault(); flashcardNext(); break;
        case 'ArrowLeft': case 'ArrowUp': e.preventDefault(); flashcardPrev(); break;
        case '1': case 'k': case 'K': e.preventDefault(); flashcardMark(true); break;
        case '0': case 'j': case 'J': e.preventDefault(); flashcardMark(false); break;
    }
});

// Touch swipe gestures for flashcard
(function setupFlashcardSwipe(){
    const wrapper = document.getElementById('flashcardWrapper');
    if (!wrapper) return;
    let sx = 0, sy = 0, ex = 0, ey = 0;
    wrapper.addEventListener('touchstart', (e) => {
        const t = e.changedTouches[0];
        sx = t.screenX; sy = t.screenY;
    }, { passive: true });
    wrapper.addEventListener('touchend', (e) => {
        const t = e.changedTouches[0];
        ex = t.screenX; ey = t.screenY;
        const dx = ex - sx, dy = ey - sy;
        if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
            if (dx < 0) flashcardNext();
            else flashcardPrev();
        }
    }, { passive: true });
})();

// Expose to global scope for inline onclick handlers
window.startPractice = startPractice;
window.practiceAnswer = practiceAnswer;
window.practiceNext = practiceNext;
window.practicePrev = practicePrev;
window.practiceRestart = practiceRestart;
window.practiceExit = practiceExit;
window.startFlashcard = startFlashcard;
window.flashcardFlip = flashcardFlip;
window.flashcardNext = flashcardNext;
window.flashcardPrev = flashcardPrev;
window.flashcardMark = flashcardMark;
window.flashcardRestart = flashcardRestart;
window.flashcardExit = flashcardExit;
window.flashcardFilterToggle = flashcardFilterToggle;
