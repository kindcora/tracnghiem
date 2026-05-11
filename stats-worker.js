// ============================================
// 📊 Stats Web Worker (v1.7.0)
// Off-thread aggregation for large history (>500 entries).
// Receives the raw `history` array, returns the same shape as
// computeStatsOverview() + computePerQuizStats() in script.js.
//
// ⚠️ KEEP IN SYNC with the canonical functions in script.js.
// ============================================

'use strict';

/**
 * @param {Array<{score:number,timeSpent?:number,quizId:number,quizTitle:string,timestamp?:number,date?:string}>} history
 * @returns {{total:number,avg:string,max:string,uniqueQuizzes:number,streak:number,totalTime:number,passRate:number}}
 */
function computeOverview(history) {
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
    return {
        total,
        avg: total ? (sum / total).toFixed(2) : '0.00',
        max: total ? max.toFixed(2) : '0.00',
        uniqueQuizzes: quizIds.size,
        streak: computeStreak(history),
        totalTime,
        passRate: total ? Math.round((passCount / total) * 100) : 0
    };
}

/**
 * Streak: longest tail of consecutive entries (sorted by timestamp ASC) with score >= 5.
 * @param {Array} history
 * @returns {number}
 */
function computeStreak(history) {
    if (!history.length) return 0;
    const sorted = [...history].sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
    let streak = 0;
    for (let i = sorted.length - 1; i >= 0; i--) {
        if (sorted[i].score >= 5) streak++;
        else break;
    }
    return streak;
}

/**
 * @param {Array} history
 * @returns {Array<{title:string,attempts:number,sum:number,best:number}>}
 */
function computePerQuiz(history) {
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
        o.title = h.quizTitle;
    }
    return [...map.values()]
        .sort((a, b) => b.attempts - a.attempts || b.best - a.best)
        .slice(0, 6);
}

// === Worker message handler ===
// Only runs in Web Worker context — `self.onmessage` doesn't exist in Node.
if (typeof self !== 'undefined' && typeof self.addEventListener === 'function') {
    self.addEventListener('message', (ev) => {
        const { id, type, history } = ev.data || {};
        try {
            let result;
            if (type === 'overview') result = computeOverview(history || []);
            else if (type === 'perQuiz') result = computePerQuiz(history || []);
            else if (type === 'both') {
                result = {
                    overview: computeOverview(history || []),
                    perQuiz: computePerQuiz(history || [])
                };
            } else {
                throw new Error('Unknown message type: ' + type);
            }
            self.postMessage({ id, ok: true, result });
        } catch (e) {
            self.postMessage({ id, ok: false, error: String(e && e.message || e) });
        }
    });
}

// Export for Node tests (CommonJS-like; safe-guarded so worker still works in browser)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { computeOverview, computePerQuiz, computeStreak };
}
