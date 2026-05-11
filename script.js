let questions = [];
let quizzes = JSON.parse(localStorage.getItem('quizzes')) || [];
let history = JSON.parse(localStorage.getItem('history')) || [];
let currentQuiz = null, shuffledQuiz = null;
let userAnswers = {};
let timerInterval = null, timeLeft = 0;
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
    localStorage.setItem('installDismissed', '1');
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
        
        // === Esc: Đóng modal/menu ===
        if (e.key === 'Escape') {
            document.querySelectorAll('.modal').forEach(m => m.style.display = 'none');
            const nav = document.getElementById('mainNav');
            if (nav?.classList.contains('mobile-open')) toggleMobileMenu();
            return;
        }
        
        // === ? : Mở phím tắt (chỉ khi không gõ) ===
        if (e.key === '?' && !isTyping) {
            e.preventDefault();
            document.getElementById('shortcutModal').style.display = 'block';
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
    grid.innerHTML = '';
    for (let i = 0; i < total; i++) {
        const cell = document.createElement('div');
        cell.className = 'qsp-cell';
        cell.textContent = i + 1;
        cell.title = `Câu ${i + 1} - Bỏ trống`;
        cell.dataset.index = i;
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

    cells.forEach((cell, i) => {
        const ua = userAnswers[i];
        const answered = ua !== undefined;

        // Reset các trạng thái phân loại
        cell.classList.remove('answered', 'correct', 'wrong', 'current');

        if (answered) {
            done++;
            cell.classList.add('answered');
            cell.title = `Câu ${i + 1} - Đã chọn ${String.fromCharCode(65 + ua)}`;
        } else {
            cell.title = `Câu ${i + 1} - Bỏ trống`;
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
// ============= THEME TOGGLE (CHẾ ĐỘ SÁNG/TỐI) =============
function toggleTheme() {
    document.body.classList.toggle('light-mode');
    const isLight = document.body.classList.contains('light-mode');
    document.getElementById('themeToggle').textContent = isLight ? '☀️' : '🌙';
    document.getElementById('themeToggle').title = isLight ? 'Chuyển sang chế độ tối' : 'Chuyển sang chế độ sáng';
    localStorage.setItem('theme', isLight ? 'light' : 'dark');
    
    // Cập nhật biểu đồ nếu đang ở trang thống kê
    if (document.getElementById('stats').classList.contains('active')) {
        renderStats();
    }
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

// Load theme đã lưu (mặc định DARK)
function loadTheme() {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'light') {
        document.body.classList.add('light-mode');
        const btn = document.getElementById('themeToggle');
        if (btn) { btn.textContent = '☀️'; btn.title = 'Chuyển sang chế độ tối'; }
    }
    // Mặc định là DARK (không cần làm gì)
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
                    <h2>📤 Xuất đề thi</h2>
                    <p>Bạn chưa có đề thi nào để xuất. Hãy tạo hoặc nhập đề trước.</p>
                    <div style="margin-top:20px;display:flex;gap:10px;flex-wrap:wrap">
                        <button class="btn-primary" onclick="document.getElementById('modal').style.display='none';showSection('create')">➕ Tạo đề ngay</button>
                        <button class="btn-secondary" onclick="document.getElementById('modal').style.display='none'">Đóng</button>
                    </div>`;
                document.getElementById('modal').style.display = 'block';
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
    localStorage.setItem('quizzes', JSON.stringify(quizzes));
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
    let qs = JSON.parse(JSON.stringify(quiz.questions));
    // Trộn thứ tự đáp án trong mỗi câu
    if (quiz.shuffleO) {
        qs = qs.map(q => {
            const indices = q.options.map((_, i) => i);
            const shuffled = shuffleArray(indices);
            const newOpts = shuffled.map(i => q.options[i]);
            const newCorrect = shuffled.indexOf(q.correct);
            return { ...q, options: newOpts, correct: newCorrect };
        });
    }
    // Trộn thứ tự câu hỏi
    if (quiz.shuffleQ) qs = shuffleArray(qs);
    // Giới hạn số câu hỏi (chọn ngẫu nhiên N câu nếu đã trộn, hoặc N câu đầu nếu chưa)
    const limit = parseInt(quiz.questionLimit, 10);
    if (!isNaN(limit) && limit > 0 && limit < qs.length) {
        // Nếu chưa trộn câu, vẫn nên lấy ngẫu nhiên để "chọn số câu hỏi ngẫu nhiên"
        if (!quiz.shuffleQ) qs = shuffleArray(qs);
        qs = qs.slice(0, limit);
    }
    return { ...quiz, questions: qs };
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
    list.innerHTML = filtered.map(q => `
        <div class="quiz-item">
            <h3>${escapeHtml(q.title)}</h3>
            <p>${escapeHtml(q.desc || 'Không có mô tả')}</p>
            <div class="meta">
                <span>📝 ${q.questions.length} câu</span>
                <span>⏱️ ${q.time} phút</span>
            </div>
            <div class="btn-group">
                <button class="btn-primary" onclick="startQuiz(${q.id})">▶️ Làm bài</button>
                <button class="btn-secondary" onclick="customizeQuiz(${q.id})">⚙️ Tùy chỉnh</button>
                <button class="btn-info" onclick="exportCSV(${q.id})">📄 CSV</button>
                <button class="btn-info" onclick="exportWord(${q.id})">📝 Word</button>
                <button class="btn-danger" onclick="deleteQuiz(${q.id})">🗑️</button>
            </div>
        </div>
    `).join('');
}

function deleteQuiz(id) {
    if (!confirm('Xóa đề này?')) return;
    quizzes = quizzes.filter(q => q.id !== id);
    localStorage.setItem('quizzes', JSON.stringify(quizzes));
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

        <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:20px">
            <button class="btn-primary" onclick="saveQuizCustomization(${id})">💾 Lưu cài đặt</button>
            <button class="btn-secondary" onclick="saveAndStartQuiz(${id})">▶️ Lưu &amp; Làm bài ngay</button>
            <button class="btn-danger" onclick="document.getElementById('modal').style.display='none'" style="width:auto">✕ Hủy</button>
        </div>
    `;
    modal.style.display = 'block';
}

// Đọc dữ liệu từ modal & validate
function readCustomizationForm() {
    const time = parseInt(document.getElementById('cqTime')?.value, 10);
    const limitRaw = document.getElementById('cqLimit')?.value;
    const limit = limitRaw === '' ? NaN : parseInt(limitRaw, 10);
    const shuffleQ = !!document.getElementById('cqShuffleQ')?.checked;
    const shuffleO = !!document.getElementById('cqShuffleO')?.checked;
    return { time, limit, shuffleQ, shuffleO };
}

function applyCustomizationToQuiz(id) {
    const quiz = quizzes.find(q => q.id === id);
    if (!quiz) { showToast('Không tìm thấy đề thi!', 'error'); return null; }
    const { time, limit, shuffleQ, shuffleO } = readCustomizationForm();
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
    quiz.questionLimit = finalLimit;
    localStorage.setItem('quizzes', JSON.stringify(quizzes));
    return quiz;
}

function saveQuizCustomization(id) {
    const quiz = applyCustomizationToQuiz(id);
    if (!quiz) return;
    document.getElementById('modal').style.display = 'none';
    const limitMsg = quiz.questionLimit ? `${quiz.questionLimit} câu ngẫu nhiên` : `tất cả ${quiz.questions.length} câu`;
    showToast(`✅ Đã lưu: ${quiz.time}p · ${limitMsg} · ${quiz.shuffleQ?'trộn câu':'giữ câu'} · ${quiz.shuffleO?'trộn đáp án':'giữ đáp án'}`, 'success', 4000);
    renderQuizList();
}

function saveAndStartQuiz(id) {
    const quiz = applyCustomizationToQuiz(id);
    if (!quiz) return;
    document.getElementById('modal').style.display = 'none';
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
    return `<div class="do-question">
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
    currentQuiz = quizzes.find(q => q.id === id);
    shuffledQuiz = prepareQuizForDoing(currentQuiz);
    userAnswers = {};
    document.getElementById('doQuizTitle').textContent = currentQuiz.title;

    const container = document.getElementById('doQuizContent');
    // Xoá nội dung cũ
    container.innerHTML = '';

    const questions = shuffledQuiz.questions;
    const total = questions.length;
    // Batch đầu tiên render ngay (hiển thị nhanh cho user), phần còn lại render lazy
    const FIRST_BATCH = Math.min(20, total);
    let firstHTML = '';
    for (let i = 0; i < FIRST_BATCH; i++) {
        firstHTML += renderQuestionHTML(questions[i], i);
    }
    container.innerHTML = firstHTML;

    // Nếu còn câu hỏi -> thêm hint + lazy render phần còn lại
    if (total > FIRST_BATCH) {
        const hint = document.createElement('div');
        hint.id = 'quizLoadingHint';
        hint.style.cssText = 'text-align:center;padding:12px;color:#888;font-style:italic;font-size:14px';
        hint.textContent = `⏳ Đang tải đề... ${FIRST_BATCH}/${total} câu`;
        container.appendChild(hint);
        // Lazy render phần còn lại theo chunk
        const remaining = questions.slice(FIRST_BATCH);
        // Tạo wrapper tạm để render tiếp (chèn TRƯỚC hint)
        // Dễ nhất: render vào container, sau đó đảm bảo hint luôn ở cuối
        let idx = FIRST_BATCH;
        const chunkSize = 25;
        const schedule = window.requestIdleCallback
            ? (cb) => window.requestIdleCallback(cb, { timeout: 300 })
            : (cb) => setTimeout(cb, 16);
        function renderNext() {
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
        }
        schedule(renderNext);
    }

    timeLeft = shuffledQuiz.time * 60;
    updateTimer();
    timerInterval = setInterval(() => {
        timeLeft--; updateTimer();
        if (timeLeft <= 0) { clearInterval(timerInterval); submitQuiz(); }
    }, 1000);

    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.getElementById('doQuiz').classList.add('active');
    // Đóng menu mobile nếu đang mở
    if (typeof closeMobileMenu === 'function') closeMobileMenu();
    // Cuộn lên đầu trang NGAY LẬP TỨC
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    requestAnimationFrame(() => {
        window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
        setTimeout(() => {
            window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
        }, 50);
    });
    initQuestionStatusPanel();
    updateProgress();
    resetCurrentQuestion();
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

function submitQuiz() {
    clearInterval(timerInterval);
    hideQuestionStatusPanel();
    let correct = 0;
    const total = shuffledQuiz.questions.length;
    const review = shuffledQuiz.questions.map((q, i) => {
        const ua = userAnswers[i];
        const ok = ua === q.correct;
        if (ok) correct++;
        return `<div class="review-question ${ok?'correct':'wrong'}">
            <strong>Câu ${i+1}: ${escapeHtml(q.question)}</strong><br>
            Đáp án của bạn: ${ua!==undefined ? String.fromCharCode(65+ua)+'. '+escapeHtml(q.options[ua]) : '(không trả lời)'}<br>
            Đáp án đúng: <strong>${String.fromCharCode(65+q.correct)}. ${escapeHtml(q.options[q.correct])}</strong>
        </div>`;
    }).join('');
    
    const score = ((correct/total)*10).toFixed(2);
    
    // Lưu lịch sử
    history.push({
        quizId: currentQuiz.id, quizTitle: currentQuiz.title,
        score: parseFloat(score), correct, total,
        date: new Date().toLocaleString('vi-VN'),
        timestamp: Date.now()
    });
    localStorage.setItem('history', JSON.stringify(history));
    
    document.getElementById('resultContent').innerHTML = `
        <div class="result-box">
            <h3>${score}/10</h3>
            <p>Đúng ${correct}/${total} câu</p>
            <p>${score>=8?'🏆 Xuất sắc!':score>=6.5?'👍 Khá':score>=5?'😊 Trung bình':'💪 Cố gắng thêm!'}</p>
        </div>
        <h3 style="margin:20px 0">📖 Chi tiết:</h3>${review}`;
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.getElementById('result').classList.add('active');
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

// ============= HƯỚNG DẪN ĐỊNH DẠNG =============
function showFormatGuide() {
    document.getElementById('modalContent').innerHTML = `
        <h2>📋 Hướng Dẫn Định Dạng File</h2>
        <h3>📄 File CSV:</h3>
        <p>Cột: Câu hỏi | A | B | C | D | Đáp án đúng (A/B/C/D)</p>
        <pre>Câu hỏi,Đáp án A,Đáp án B,Đáp án C,Đáp án D,Đáp án đúng
"2+2=?","3","4","5","6","B"
"Thủ đô VN?","TPHCM","Hà Nội","Đà Nẵng","Huế","B"</pre>
        <p>👉 Bấm <b>"Tải mẫu CSV"</b> để có file mẫu sẵn.</p>
        
        <h3>📝 File Word (.docx):</h3>
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
        <p>⚠️ Lưu ý:</p>
        <ul style="margin-left:20px">
            <li>Mỗi câu bắt đầu bằng <b>"Câu [số]:"</b></li>
            <li>Đáp án bắt đầu bằng <b>A. B. C. D.</b></li>
            <li>Dòng cuối phải có <b>"Đáp án: [chữ]"</b></li>
        </ul>
    `;
    document.getElementById('modal').style.display = 'block';
}

// ============= THỐNG KÊ =============
let scoreChartObj = null, pieChartObj = null;
function renderStats() {
    const total = history.length;
    const avg = total ? (history.reduce((s,h)=>s+h.score,0)/total).toFixed(2) : 0;
    const max = total ? Math.max(...history.map(h=>h.score)).toFixed(2) : 0;
    const uniqueQuizzes = new Set(history.map(h=>h.quizId)).size;
    
    document.getElementById('statsOverview').innerHTML = `
        <div class="stat-card"><div class="num">${total}</div><div class="label">Lượt làm bài</div></div>
        <div class="stat-card"><div class="num">${avg}</div><div class="label">Điểm trung bình</div></div>
        <div class="stat-card"><div class="num">${max}</div><div class="label">Điểm cao nhất</div></div>
        <div class="stat-card"><div class="num">${uniqueQuizzes}</div><div class="label">Đề đã làm</div></div>
    `;
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
        labels: recent.map((_,i)=>`Lần ${history.length-recent.length+i+1}`),
        datasets: [{ 
            label: 'Điểm', 
            data: recent.map(h=>h.score),
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
            y: { 
                min: 0, max: 10, 
                grid: { color: gridColor },
                ticks: { color: textColor }
            },
            x: {
                grid: { color: gridColor },
                ticks: { color: textColor }
            }
        },
        plugins: { legend: { labels: { color: textColor } } }
    }
});
    
    // Biểu đồ tròn - phân loại
    if (pieChartObj) pieChartObj.destroy();
    const cats = { 'Xuất sắc (≥8)':0, 'Khá (6.5-8)':0, 'TB (5-6.5)':0, 'Yếu (<5)':0 };
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
            backgroundColor: ['#1dd1a1','#54a0ff','#feca57','#ee5253'],
            borderColor: isDark ? '#1e2530' : '#fff',
            borderWidth: 2
        }]
    },
    options: { 
        responsive: true,
        plugins: { legend: { labels: { color: textColor } } }
    }
});
    
    // Lịch sử
    const histList = document.getElementById('historyList');
    if (history.length === 0) {
        histList.innerHTML = '<p style="text-align:center;color:#666;padding:30px">Chưa có lịch sử làm bài</p>';
    } else {
        histList.innerHTML = [...history].reverse().slice(0, 20).map(h => `
            <div class="history-item">
                <div><b>${escapeHtml(h.quizTitle)}</b><br><small>${h.date} • Đúng ${h.correct}/${h.total}</small></div>
                <div class="score-badge">${h.score}/10</div>
            </div>
        `).join('');
    }
}

// ============= BỘ ĐỀ ÔN TẬP CÓ SẴN (PRELOADED) =============
function loadPreloadedQuizzes() {
    if (!window.PRELOADED_QUIZZES || !Array.isArray(window.PRELOADED_QUIZZES)) return;
    let added = 0;
    let syncedQuestions = 0;
    for (const pq of window.PRELOADED_QUIZZES) {
        const existing = quizzes.find(q => q.id === pq.id);
        if (existing) {
            // Đồng bộ NỘI DUNG câu hỏi từ nguồn (khi bộ đề có cập nhật)
            // KHÔNG ghi đè các cài đặt người dùng đã tùy chỉnh:
            // time, shuffleQ, shuffleO, questionLimit
            if (Array.isArray(pq.questions) && pq.questions.length !== existing.questions.length) {
                existing.questions = pq.questions;
                syncedQuestions++;
            }
            continue;
        }
        quizzes.push(pq);
        added++;
    }
    if (added > 0 || syncedQuestions > 0) {
        localStorage.setItem('quizzes', JSON.stringify(quizzes));
        if (added > 0) console.log(`✅ Đã nạp ${added} bộ đề ôn tập có sẵn`);
        if (syncedQuestions > 0) console.log(`🔄 Đã đồng bộ câu hỏi cho ${syncedQuestions} bộ đề`);
    }
}

function startPreloadedQuiz() {
    if (!window.PRELOADED_QUIZZES || window.PRELOADED_QUIZZES.length === 0) {
        return showToast('Chưa có bộ đề ôn tập!', 'error');
    }
    const pq = window.PRELOADED_QUIZZES[0];
    // Ensure it exists in quizzes array
    if (!quizzes.some(q => q.id === pq.id)) {
        quizzes.push(pq);
        localStorage.setItem('quizzes', JSON.stringify(quizzes));
    }
    // Bắt đầu ôn tập ngay với cài đặt mặc định (không mở modal tùy chỉnh)
    startQuiz(pq.id);
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




