// ============================================
// 🧪 Pure helpers — Node-side mirror of script.js functions
// (v1.7.0)
//
// ⚠️ KEEP IN SYNC with script.js:
//   - _collectQuizAnswers   (script.js ~line 1332)
//   - _calculateQuizScore   (script.js ~line 1342)
//   - computeStatsOverview  (script.js ~line 1994)
//   - computePerQuizStats   (script.js ~line 1929)
//   - computeStreak         (script.js — see streak logic)
//
// These are used ONLY for unit tests (`node --test`).
// The browser still uses the canonical copies in script.js.
// ============================================

'use strict';

/**
 * Collect answers + count correct in a single pass.
 * @param {Array<{correct:number}>} questions
 * @param {Object<number, number>} answers
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
 * Compute score (0–10), percent, grade label/emoji/CSS class.
 * @param {number} correct
 * @param {number} total
 * @returns {{score:string, scoreNum:number, percent:number, grade:string, emoji:string, label:string, scoreClass:string}}
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
 * Streak: longest tail of consecutive entries (sorted by timestamp ASC) with score >= 5.
 * @param {Array<{score:number, timestamp?:number}>} history
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
 * @param {Array<{score:number,timeSpent?:number,quizId:number,quizTitle:string,timestamp?:number}>} history
 * @returns {{total:number,avg:string,max:string,uniqueQuizzes:number,streak:number,totalTime:number,passRate:number}}
 */
function computeStatsOverview(history) {
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
 * @param {Array} history
 * @returns {Array<{title:string,attempts:number,sum:number,best:number}>}
 */
function computePerQuizStats(history) {
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

module.exports = {
    _collectQuizAnswers,
    _calculateQuizScore,
    computeStreak,
    computeStatsOverview,
    computePerQuizStats
};
