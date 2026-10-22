
const Suggestion = require('../models/Suggestion');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');

const EXPORT_FORMATS = ['xlsx', 'csv', 'pdf', 'json'];

function safeSpreadsheetText(value) {
  const text = value == null ? '' : String(value);

  // Prevent spreadsheet formula injection.
  return /^[\s]*[=+\-@]/.test(text) ? `'${text}` : text;
}

function formatDate(value) {
  if (!value) return '';

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString();
}

function getExportData(rows) {
  return rows.map((row) => ({
    ID: row.id,
    Title: safeSpreadsheetText(row.title),
    Description: safeSpreadsheetText(row.description),
    Category: safeSpreadsheetText(row.category),
    Status: safeSpreadsheetText(row.status),
    Anonymous: row.is_anonymous ? 'Yes' : 'No',
    Author: row.is_anonymous
      ? 'Anonymous'
      : safeSpreadsheetText(row.author_name),
    'Created At': formatDate(row.created_at),
    'Updated At': formatDate(row.updated_at)
  }));
}

function csvEscape(value) {
  const text = value == null ? '' : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function sendCsv(res, data) {
  const headers = [
    'ID', 'Title', 'Description', 'Category', 'Status',
    'Anonymous', 'Author', 'Created At', 'Updated At'
  ];

  const lines = [
    headers.map(csvEscape).join(','),
    ...data.map((row) =>
      headers.map((header) => csvEscape(row[header])).join(',')
    )
  ];

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader(
    'Content-Disposition',
    'attachment; filename="campus-feedback.csv"'
  );

  return res.send('\uFEFF' + lines.join('\r\n'));
}

async function sendExcel(res, data) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Sherubtsean Suggest';

  const worksheet = workbook.addWorksheet('Campus Feedback');

  worksheet.columns = [
    { header: 'ID', key: 'ID', width: 10 },
    { header: 'Title', key: 'Title', width: 30 },
    { header: 'Description', key: 'Description', width: 55 },
    { header: 'Category', key: 'Category', width: 22 },
    { header: 'Status', key: 'Status', width: 18 },
    { header: 'Anonymous', key: 'Anonymous', width: 14 },
    { header: 'Author', key: 'Author', width: 24 },
    { header: 'Created At', key: 'Created At', width: 25 },
    { header: 'Updated At', key: 'Updated At', width: 25 }
  ];

  worksheet.addRows(data);
  worksheet.getRow(1).font = { bold: true };
  worksheet.views = [{ state: 'frozen', ySplit: 1 }];
  worksheet.autoFilter = { from: 'A1', to: 'I1' };

  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  );
  res.setHeader(
    'Content-Disposition',
    'attachment; filename="campus-feedback.xlsx"'
  );

  await workbook.xlsx.write(res);
  res.end();
}

function sendPdf(res, data) {
  const doc = new PDFDocument({
    size: 'A4',
    layout: 'landscape',
    margins: { top: 40, bottom: 40, left: 35, right: 35 }
  });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader(
    'Content-Disposition',
    'attachment; filename="campus-feedback.pdf"'
  );

  doc.pipe(res);

  doc.fontSize(18).text('Sherubtsean Suggest', { align: 'center' });
  doc.moveDown(0.3);
  doc.fontSize(12).text('Campus Feedback Export', { align: 'center' });
  doc.moveDown();
  doc.fontSize(9).text(`Generated: ${new Date().toISOString()}`);
  doc.moveDown();

  if (data.length === 0) {
    doc.fontSize(11).text('No feedback records found.');
  }

  data.forEach((row) => {
    const description = String(row.Description || '')
      .replace(/\s+/g, ' ')
      .trim();

    const record = [
      `ID: ${row.ID}`,
      `Title: ${row.Title || ''}`,
      `Category: ${row.Category || ''}`,
      `Status: ${row.Status || ''}`,
      `Anonymous: ${row.Anonymous}`,
      `Author: ${row.Author || ''}`,
      `Created: ${row['Created At'] || ''}`,
      `Updated: ${row['Updated At'] || ''}`,
      `Description: ${description || '(No description)'}`
    ].join('\n');

    const width =
      doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const height = doc.heightOfString(record, { width }) + 25;

    if (doc.y + height > doc.page.height - doc.page.margins.bottom) {
      doc.addPage();
    }

    doc.fontSize(9).text(record);
    doc.moveDown(0.5);

    doc.moveTo(doc.page.margins.left, doc.y)
      .lineTo(doc.page.width - doc.page.margins.right, doc.y)
      .strokeColor('#cccccc')
      .stroke();

    doc.moveDown(0.5);
  });

  doc.end();
}

async function exportFeedback(req, res, next) {
  try {
    const format = String(req.params.format || '').toLowerCase();

    if (!EXPORT_FORMATS.includes(format)) {
      return res.status(400).send('Unsupported export format.');
    }

    const rows = await Suggestion.exportAll();
    const data = getExportData(rows);

    if (format === 'csv') return sendCsv(res, data);

    if (format === 'json') {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        'attachment; filename="campus-feedback.json"'
      );
      return res.send(JSON.stringify(data, null, 2));
    }

    if (format === 'xlsx') return await sendExcel(res, data);
    if (format === 'pdf') return sendPdf(res, data);
  } catch (err) {
    if (res.headersSent) return res.destroy(err);
    return next(err);
  }
}

module.exports = { exportFeedback };
