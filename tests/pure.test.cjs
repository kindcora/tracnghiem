// ============================================
// 🧪 Unit tests for pure helpers (v1.7.0)
// Run with: node --test
// ============================================

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
    _collectQuizAnswers,
    _calculateQuizScore,
    computeStreak,
    computeStatsOverview,
    computePerQuizStats
} = require('../lib/pure.cjs');

// ============================================
// _collectQuizAnswers
// ============================================
test('_collectQuizAnswers: all correct', () => {
    const questions = [
        { correct: 0 }, { correct: 1 }, { correct: 2 }, { correct: 3 }
    ];
    const answers = { 0: 0, 1: 1, 2: 2, 3: 3 };
    const r = _collectQuizAnswers(questions, answers);
    assert.equal(r.total, 4);
    assert.equal(r.correct, 4);
});

test('_collectQuizAnswers: all wrong', () => {
    const questions = [{ correct: 0 }, { correct: 1 }, { correct: 2 }];
    const answers = { 0: 1, 1: 2, 2: 0 };
    const r = _collectQuizAnswers(questions, answers);
    assert.equal(r.total, 3);
    assert.equal(r.correct, 0);
});

test('_collectQuizAnswers: partial + unanswered', () => {
    const questions = [{ correct: 0 }, { correct: 1 }, { correct: 2 }, { correct: 3 }];
    const answers = { 0: 0, 2: 2 }; // 1 and 3 unanswered
    const r = _collectQuizAnswers(questions, answers);
    assert.equal(r.total, 4);
    assert.equal(r.correct, 2);
});

test('_collectQuizAnswers: empty questions', () => {
    const r = _collectQuizAnswers([], {});
    assert.equal(r.total, 0);
    assert.equal(r.correct, 0);
});

// ============================================
// _calculateQuizScore — 4 grade buckets
// ============================================
test('_calculateQuizScore: excellent (>=8)', () => {
    const r = _calculateQuizScore(9, 10);
    assert.equal(r.score, '9.00');
    assert.equal(r.scoreNum, 9);
    assert.equal(r.percent, 90);
    assert.equal(r.grade, 'excellent');
    assert.equal(r.emoji, '🏆');
    assert.equal(r.scoreClass, 'score-excellent');
});

test('_calculateQuizScore: good (6.5..8)', () => {
    const r = _calculateQuizScore(7, 10);
    assert.equal(r.score, '7.00');
    assert.equal(r.grade, 'good');
    assert.equal(r.emoji, '👍');
});

test('_calculateQuizScore: average (5..6.5)', () => {
    const r = _calculateQuizScore(6, 10);
    assert.equal(r.grade, 'average');
    assert.equal(r.emoji, '😊');
});

test('_calculateQuizScore: weak (<5)', () => {
    const r = _calculateQuizScore(3, 10);
    assert.equal(r.grade, 'weak');
    assert.equal(r.emoji, '💪');
    assert.equal(r.scoreClass, 'score-weak');
});

test('_calculateQuizScore: exact boundary 8.00 → excellent', () => {
    const r = _calculateQuizScore(8, 10);
    assert.equal(r.scoreNum, 8);
    assert.equal(r.grade, 'excellent');
});

test('_calculateQuizScore: exact boundary 5.00 → average', () => {
    const r = _calculateQuizScore(5, 10);
    assert.equal(r.scoreNum, 5);
    assert.equal(r.grade, 'average');
});

test('_calculateQuizScore: 0/10 → weak', () => {
    const r = _calculateQuizScore(0, 10);
    assert.equal(r.scoreNum, 0);
    assert.equal(r.grade, 'weak');
    assert.equal(r.percent, 0);
});

// ============================================
// computeStreak
// ============================================
test('computeStreak: empty', () => {
    assert.equal(computeStreak([]), 0);
});

test('computeStreak: last 3 all >=5', () => {
    const h = [
        { score: 4, timestamp: 1 },
        { score: 6, timestamp: 2 },
        { score: 7, timestamp: 3 },
        { score: 8, timestamp: 4 }
    ];
    assert.equal(computeStreak(h), 3);
});

test('computeStreak: latest <5 → 0', () => {
    const h = [
        { score: 9, timestamp: 1 },
        { score: 8, timestamp: 2 },
        { score: 4, timestamp: 3 }
    ];
    assert.equal(computeStreak(h), 0);
});

test('computeStreak: respects timestamp sort', () => {
    // unsorted input — newest=timestamp 100 has score 9 → streak should count from there
    const h = [
        { score: 4, timestamp: 50 },
        { score: 9, timestamp: 100 },
        { score: 8, timestamp: 90 }
    ];
    assert.equal(computeStreak(h), 2);
});

// ============================================
// computeStatsOverview
// ============================================
test('computeStatsOverview: empty history', () => {
    const r = computeStatsOverview([]);
    assert.equal(r.total, 0);
    assert.equal(r.avg, '0.00');
    assert.equal(r.max, '0.00');
    assert.equal(r.uniqueQuizzes, 0);
    assert.equal(r.streak, 0);
    assert.equal(r.totalTime, 0);
    assert.equal(r.passRate, 0);
});

test('computeStatsOverview: full history', () => {
    const h = [
        { score: 9, quizId: 1, quizTitle: 'A', timeSpent: 60, timestamp: 1 },
        { score: 7, quizId: 1, quizTitle: 'A', timeSpent: 50, timestamp: 2 },
        { score: 5, quizId: 2, quizTitle: 'B', timeSpent: 30, timestamp: 3 },
        { score: 3, quizId: 2, quizTitle: 'B', timeSpent: 20, timestamp: 4 }
    ];
    const r = computeStatsOverview(h);
    assert.equal(r.total, 4);
    assert.equal(r.avg, '6.00'); // (9+7+5+3)/4 = 6
    assert.equal(r.max, '9.00');
    assert.equal(r.uniqueQuizzes, 2);
    assert.equal(r.totalTime, 160);
    assert.equal(r.passRate, 75); // 3 of 4 are >=5
    assert.equal(r.streak, 0); // last entry score=3 → streak resets
});

test('computeStatsOverview: tolerates missing timeSpent', () => {
    const h = [
        { score: 8, quizId: 1, quizTitle: 'X', timestamp: 1 }
    ];
    const r = computeStatsOverview(h);
    assert.equal(r.totalTime, 0);
    assert.equal(r.avg, '8.00');
});

// ============================================
// computePerQuizStats
// ============================================
test('computePerQuizStats: groups by quizId', () => {
    const h = [
        { score: 9, quizId: 1, quizTitle: 'A' },
        { score: 7, quizId: 1, quizTitle: 'A' },
        { score: 5, quizId: 2, quizTitle: 'B' }
    ];
    const list = computePerQuizStats(h);
    assert.equal(list.length, 2);
    const a = list.find(o => o.title === 'A');
    const b = list.find(o => o.title === 'B');
    assert.equal(a.attempts, 2);
    assert.equal(a.sum, 16);
    assert.equal(a.best, 9);
    assert.equal(b.attempts, 1);
    assert.equal(b.best, 5);
});

test('computePerQuizStats: sort by attempts desc then best desc', () => {
    const h = [
        { score: 6, quizId: 1, quizTitle: 'Only-1-attempt' },
        { score: 4, quizId: 2, quizTitle: 'Two-attempts' },
        { score: 7, quizId: 2, quizTitle: 'Two-attempts' }
    ];
    const list = computePerQuizStats(h);
    assert.equal(list[0].title, 'Two-attempts'); // more attempts
    assert.equal(list[1].title, 'Only-1-attempt');
});

test('computePerQuizStats: cap at 6 entries', () => {
    const h = [];
    for (let id = 1; id <= 10; id++) {
        h.push({ score: id, quizId: id, quizTitle: 'Q' + id });
    }
    const list = computePerQuizStats(h);
    assert.equal(list.length, 6);
});

test('computePerQuizStats: empty', () => {
    assert.deepEqual(computePerQuizStats([]), []);
});
