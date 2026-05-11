// Merge 2 Excel quiz files → 1 unified CSV for QuizMaster Pro
// File 1: Câu hỏi Văn hóa doanh nghiệp 2024 (header at row 3: STT, Nội dung, A, B, C, D, Đáp án)
// File 2: Nâng giữ bậc KD 2026 (header at row 1: STT, Lĩnh vực, Nội dung câu hỏi, A, B, C, D, Đáp án đúng)

const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const ATTACH_DIR = '.opus-attachments/16784486-ff5d-4509-9c0f-2db992dab66f';
const FILE1 = path.join(ATTACH_DIR, '01-02. Phụ lục II. Câu hỏi Văn hóa doanh nghiệp MỚI NĂM 2024.xlsx');
const FILE2 = path.join(ATTACH_DIR, '02-nâng giữ bạc oanh 2026.xlsx');

const OUTPUT_CSV = 'OnTap_TongHop_2026.csv';
const OUTPUT_JSON = 'questions-data.js'; // Pre-loaded into website

function csvCell(v) {
  const s = String(v ?? '').replace(/\r\n/g, ' ').replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
  return '"' + s.replace(/"/g, '""') + '"';
}

function cleanText(v) {
  return String(v ?? '').replace(/\r\n/g, ' ').replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
}

// Generic extractor: given rows + column indexes + start row
function extractQuestions(rows, layout, sourceLabel) {
  const out = [];
  let skipped = 0;
  for (let i = layout.startRow; i < rows.length; i++) {
    const row = rows[i];
    if (!row) { skipped++; continue; }
    const question = cleanText(row[layout.qIdx]);
    const optA = cleanText(row[layout.aIdx]);
    const optB = cleanText(row[layout.bIdx]);
    const optC = cleanText(row[layout.cIdx]);
    const optD = cleanText(row[layout.dIdx]);
    let answer = cleanText(row[layout.ansIdx]).toLowerCase();
    // Sometimes answer has trailing punctuation
    answer = answer.replace(/[^a-d]/g, '');
    if (!question) { skipped++; continue; }
    if (/^\d+$/.test(question)) { skipped++; continue; }
    const ql = question.toLowerCase();
    if (ql === 'nội dung' || ql === 'câu hỏi' || ql === 'nội dung câu hỏi') { skipped++; continue; }
    if (!optA || !optB || !optC || !optD) { skipped++; continue; }
    if (!['a', 'b', 'c', 'd'].includes(answer)) { skipped++; continue; }
    out.push({
      question,
      options: [optA, optB, optC, optD],
      correct: 'abcd'.indexOf(answer),
      source: sourceLabel,
    });
  }
  return { out, skipped };
}

// ===== Process File 1 =====
console.log('📖 Reading file 1: Văn hóa doanh nghiệp 2024');
const wb1 = XLSX.readFile(FILE1);
console.log('  Sheets:', wb1.SheetNames);

const allQuestions = [];

wb1.SheetNames.forEach((sheetName) => {
  const rows = XLSX.utils.sheet_to_json(wb1.Sheets[sheetName], { header: 1, defval: '' });
  // Detect header row & layout
  let layout = null;
  for (let i = 0; i < Math.min(10, rows.length); i++) {
    const row = rows[i].map(c => String(c ?? '').trim().toLowerCase());
    const ndIdx = row.findIndex(c => c === 'nội dung' || c === 'nội dung câu hỏi' || c === 'câu hỏi');
    const ansIdx = row.findIndex(c => c === 'đáp án' || c === 'đáp án đúng' || c === 'dap an');
    if (ndIdx >= 0 && ansIdx >= 0 && ansIdx - ndIdx >= 4) {
      layout = {
        qIdx: ndIdx, aIdx: ndIdx + 1, bIdx: ndIdx + 2, cIdx: ndIdx + 3, dIdx: ndIdx + 4,
        ansIdx, startRow: i + 1,
      };
      break;
    }
  }
  if (!layout) {
    console.log(`  ⚠️ Could not detect layout for sheet "${sheetName}", skipping`);
    return;
  }
  const { out, skipped } = extractQuestions(rows, layout, `VHDN-${sheetName}`);
  console.log(`  Sheet "${sheetName}": +${out.length} questions (skipped ${skipped} rows)`);
  allQuestions.push(...out);
});

// ===== Process File 2 =====
console.log('\n📖 Reading file 2: Nâng giữ bậc KD 2026');
const wb2 = XLSX.readFile(FILE2);
console.log('  Sheets:', wb2.SheetNames);

wb2.SheetNames.forEach((sheetName) => {
  const rows = XLSX.utils.sheet_to_json(wb2.Sheets[sheetName], { header: 1, defval: '' });
  let layout = null;
  for (let i = 0; i < Math.min(10, rows.length); i++) {
    const row = rows[i].map(c => String(c ?? '').trim().toLowerCase());
    const ndIdx = row.findIndex(c => c === 'nội dung' || c === 'nội dung câu hỏi' || c === 'câu hỏi');
    const ansIdx = row.findIndex(c => c === 'đáp án' || c === 'đáp án đúng' || c === 'dap an');
    if (ndIdx >= 0 && ansIdx >= 0 && ansIdx - ndIdx >= 4) {
      layout = {
        qIdx: ndIdx, aIdx: ndIdx + 1, bIdx: ndIdx + 2, cIdx: ndIdx + 3, dIdx: ndIdx + 4,
        ansIdx, startRow: i + 1,
      };
      break;
    }
  }
  if (!layout) {
    console.log(`  ⚠️ Could not detect layout for sheet "${sheetName}", skipping`);
    return;
  }
  const { out, skipped } = extractQuestions(rows, layout, `KD2026-${sheetName}`);
  console.log(`  Sheet "${sheetName}": +${out.length} questions (skipped ${skipped} rows)`);
  allQuestions.push(...out);
});

// ===== Deduplicate by question text =====
console.log(`\n🔍 Total raw questions: ${allQuestions.length}`);
const seen = new Set();
const unique = [];
for (const q of allQuestions) {
  const key = q.question.toLowerCase().replace(/\s+/g, ' ').trim();
  if (seen.has(key)) continue;
  seen.add(key);
  unique.push(q);
}
console.log(`✨ Unique questions after dedup: ${unique.length}`);

// ===== Write CSV =====
let csv = '\uFEFF';
csv += 'Câu hỏi,Đáp án A,Đáp án B,Đáp án C,Đáp án D,Đáp án đúng\n';
for (const q of unique) {
  csv += [
    csvCell(q.question),
    csvCell(q.options[0]),
    csvCell(q.options[1]),
    csvCell(q.options[2]),
    csvCell(q.options[3]),
    csvCell('ABCD'[q.correct]),
  ].join(',') + '\n';
}
fs.writeFileSync(OUTPUT_CSV, csv, 'utf8');
console.log(`💾 Saved CSV → ${OUTPUT_CSV}`);

// ===== Write JS data file (for auto-load on website) =====
// Use exact quiz object schema used by script.js (saveQuiz)
const jsContent = `// Auto-generated by merge-excel.js — DO NOT EDIT MANUALLY
// Bộ đề ôn tập tổng hợp: Văn hóa doanh nghiệp 2024 + Nâng giữ bậc KD 2026
// Total questions: ${unique.length}
window.PRELOADED_QUIZZES = [
  {
    id: 20260001,
    title: '📚 Ôn tập Tổng hợp 2026 (VHDN + Nâng giữ bậc KD)',
    desc: 'Bộ câu hỏi gộp từ 2 file Excel: Văn hóa doanh nghiệp 2024 và Nâng giữ bậc nghề Kinh doanh 2026. Tổng cộng ${unique.length} câu hỏi đã loại trùng.',
    time: 60,
    shuffleQ: true,
    shuffleO: true,
    questions: ${JSON.stringify(unique.map(q => ({ question: q.question, options: q.options, correct: q.correct })), null, 2)},
    createdAt: '${new Date().toLocaleString('vi-VN')}',
    preloaded: true
  }
];
`;
fs.writeFileSync(OUTPUT_JSON, jsContent, 'utf8');
console.log(`💾 Saved JS data → ${OUTPUT_JSON}`);

console.log(`\n🎯 DONE! ${unique.length} unique questions ready.`);
