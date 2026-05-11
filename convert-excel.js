// Convert Excel quiz file → CSV compatible with QuizMaster Pro website
const XLSX = require('xlsx');
const fs = require('fs');

const file1 = '.opus-attachments/e68305c3-9aa3-4f97-92d7-3d338ee14bc1/01-02. Phụ lục II. Câu hỏi Văn hóa doanh nghiệp MỚI NĂM 2024.xlsx';

const wb = XLSX.readFile(file1);
console.log('Sheets:', wb.SheetNames);

// Helper: escape CSV value
function csvCell(v) {
  const s = String(v ?? '').replace(/\r\n/g, ' ').replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
  return '"' + s.replace(/"/g, '""') + '"';
}

// Detect column layout by scanning header rows
// Returns { qIdx, aIdx, bIdx, cIdx, dIdx, ansIdx }
function detectLayout(rows) {
  for (let i = 0; i < Math.min(10, rows.length); i++) {
    const row = rows[i].map(c => String(c ?? '').trim().toLowerCase());
    const ndIdx = row.findIndex(c => c === 'nội dung' || c === 'noi dung' || c === 'câu hỏi');
    const ansIdx = row.findIndex(c => c === 'đáp án' || c === 'dap an' || c === 'đáp án đúng');
    if (ndIdx >= 0 && ansIdx >= 0 && ansIdx - ndIdx >= 4) {
      return {
        qIdx: ndIdx,
        aIdx: ndIdx + 1,
        bIdx: ndIdx + 2,
        cIdx: ndIdx + 3,
        dIdx: ndIdx + 4,
        ansIdx: ansIdx,
        headerRow: i
      };
    }
  }
  // Fallback (sheet 1 style with no header detected): assume layout
  return { qIdx: 1, aIdx: 2, bIdx: 3, cIdx: 4, dIdx: 5, ansIdx: 6, headerRow: -1 };
}

function sheetToCsv(sheetName, rows) {
  const layout = detectLayout(rows);
  console.log(`  Layout detected for "${sheetName}":`, layout);

  let csv = '\uFEFF';
  csv += 'Câu hỏi,Đáp án A,Đáp án B,Đáp án C,Đáp án D,Đáp án đúng\n';
  let count = 0;
  let skipped = 0;
  const startRow = layout.headerRow >= 0 ? layout.headerRow + 1 : 0;

  for (let i = startRow; i < rows.length; i++) {
    const row = rows[i];
    if (!row) { skipped++; continue; }
    const question = String(row[layout.qIdx] ?? '').trim();
    const optA = String(row[layout.aIdx] ?? '').trim();
    const optB = String(row[layout.bIdx] ?? '').trim();
    const optC = String(row[layout.cIdx] ?? '').trim();
    const optD = String(row[layout.dIdx] ?? '').trim();
    const answer = String(row[layout.ansIdx] ?? '').trim().toLowerCase();

    // Skip header / numeric helper rows
    if (!question || /^\d+$/.test(question)) { skipped++; continue; }
    if (question.toLowerCase() === 'nội dung' || question.toLowerCase() === 'câu hỏi') { skipped++; continue; }
    if (!optA || !optB || !optC || !optD) { skipped++; continue; }
    if (!['a', 'b', 'c', 'd'].includes(answer)) { skipped++; continue; }

    csv += [csvCell(question), csvCell(optA), csvCell(optB), csvCell(optC), csvCell(optD), csvCell(answer.toUpperCase())].join(',') + '\n';
    count++;
  }

  return { csv, count, skipped };
}

let totalCount = 0;
let combinedCsv = '\uFEFF';
combinedCsv += 'Câu hỏi,Đáp án A,Đáp án B,Đáp án C,Đáp án D,Đáp án đúng\n';

const seenQuestions = new Set();

wb.SheetNames.forEach((sheetName, idx) => {
  const ws = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
  const { csv, count, skipped } = sheetToCsv(sheetName, rows);

  const safeName = sheetName.replace(/[^a-zA-Z0-9_\u00C0-\u1EF9 ]/g, '').replace(/\s+/g, '_');
  const outFile = `VHDN_2024_${idx + 1}_${safeName}.csv`;
  fs.writeFileSync(outFile, csv, 'utf8');
  console.log(`✅ Sheet "${sheetName}": ${count} questions saved → ${outFile} (skipped ${skipped} rows)`);
  totalCount += count;

  // Append unique questions to combined CSV
  const lines = csv.split('\n').slice(1); // skip header line (BOM is on first row already in combined)
  // The first element after split contains 'Câu hỏi,...' header — slice handles that.
  // Actually structure: csv starts with BOM+header+\n+data lines. split('\n')[0] is header.
  for (const line of lines) {
    if (!line.trim()) continue;
    // Extract question (first quoted field) to deduplicate
    const m = line.match(/^"((?:[^"]|"")*)"/);
    const qKey = m ? m[1].toLowerCase() : line;
    if (seenQuestions.has(qKey)) continue;
    seenQuestions.add(qKey);
    combinedCsv += line + '\n';
  }
});

fs.writeFileSync('VHDN_2024_TatCa.csv', combinedCsv, 'utf8');
console.log(`\n🎯 TOTAL UNIQUE: ${seenQuestions.size} questions → VHDN_2024_TatCa.csv`);
console.log(`🎯 TOTAL (with duplicates): ${totalCount} questions across all sheets`);
