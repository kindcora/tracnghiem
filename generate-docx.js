// Script to generate .docx file from quiz content
const { Document, Paragraph, TextRun, HeadingLevel, Packer, AlignmentType, TabStopType, TabStopPosition } = require('docx');
const fs = require('fs');

const quizData = {
    title: 'ĐỀ TRẮC NGHIỆM LỊCH SỬ',
    description: 'Phần 1. TRẮC NGHIỆM',
    questions: [
        {
            question: 'Trong cuộc khai thác thuộc địa lần thứ hai ở Đông Dương 1919-1929, thực dân Pháp tập trung đầu tư vào',
            options: [
                'Ngành chế tạo máy.',
                'Công nghiệp luyện kim.',
                'Đồn điền cao su.',
                'Công nghiệp hóa chất.'
            ],
            correct: 0, // A
            layout: '2col' // 2 options per line
        },
        {
            question: 'Nội dung nào sau đây phản ánh đúng tình hình Việt Nam sau Hiệp định Giơnevơ năm 1954 về Đông Dương?',
            options: [
                'Đất nước tạm thời bị chia cắt làm hai miền Nam, Bắc.',
                'Miền Bắc chưa được giải phóng.',
                'Miền Nam đã được giải phóng.',
                'Cả nước được giải phóng và tiến lên xây dựng chủ nghĩa xã hội.'
            ],
            correct: 1, // B
            layout: '1col' // 1 option per line (long answers)
        },
        {
            question: 'Trong Đông - Xuân 1953-1954, bộ đội chủ lực Việt Nam mở chiến dịch tiến công quân Pháp ở',
            options: [
                'Đông Khê.',
                'Thái Nguyên.',
                'Thị xã Lai Châu.',
                'Quảng Trị.'
            ],
            correct: 2, // C
            layout: '4col' // 4 options on one line
        }
    ]
};

const children = [
    new Paragraph({
        children: [new TextRun({ text: quizData.title, bold: true, size: 32 })],
        heading: HeadingLevel.HEADING_1,
        alignment: AlignmentType.CENTER
    }),
    new Paragraph({
        children: [new TextRun({ text: quizData.description, bold: true, size: 26 })],
        alignment: AlignmentType.LEFT
    }),
    new Paragraph({ text: '' })
];

quizData.questions.forEach((q, i) => {
    // Question line
    children.push(new Paragraph({
        children: [new TextRun({ text: `Câu ${i + 1}. ${q.question}`, bold: true })]
    }));

    const letters = q.options.map((opt, j) => `${String.fromCharCode(65 + j)}. ${opt}`);

    if (q.layout === '2col') {
        // 2 options per line
        children.push(new Paragraph({
            text: `${letters[0]}\t\t${letters[1]}`
        }));
        children.push(new Paragraph({
            text: `${letters[2]}\t\t${letters[3]}`
        }));
    } else if (q.layout === '4col') {
        // All 4 options on one line
        children.push(new Paragraph({
            text: letters.join('\t')
        }));
    } else {
        // 1 option per line
        letters.forEach(line => {
            children.push(new Paragraph({ text: line }));
        });
    }

    children.push(new Paragraph({ text: '' }));
});

// Separator
children.push(new Paragraph({
    children: [new TextRun({ text: '------HẾT------', bold: true })],
    alignment: AlignmentType.CENTER
}));
children.push(new Paragraph({ text: '' }));

// Bảng đáp án
children.push(new Paragraph({
    children: [new TextRun({ text: 'BẢNG ĐÁP ÁN', bold: true, size: 28 })],
    alignment: AlignmentType.CENTER
}));
const answerKey = quizData.questions.map((q, i) => `${i + 1}${String.fromCharCode(65 + q.correct)}`).join('  ');
children.push(new Paragraph({
    children: [new TextRun({ text: answerKey, bold: true })],
    alignment: AlignmentType.CENTER
}));

const doc = new Document({ sections: [{ children }] });

Packer.toBuffer(doc).then(buffer => {
    fs.writeFileSync('de-trac-nghiem-lich-su.docx', buffer);
    console.log('✅ File de-trac-nghiem-lich-su.docx đã được tạo thành công!');
}).catch(err => {
    console.error('❌ Lỗi:', err);
});
