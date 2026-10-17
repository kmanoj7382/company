/**
 * Anand Delivery Payment API — Google Apps Script
 *
 * Keep your existing Google Sheet as the only master record. This script only
 * changes the five app-owned audit/payment columns after locating an invoice.
 */
const CONFIG = {
  spreadsheetId: 'REPLACE_WITH_MASTER_SPREADSHEET_ID',
  sheetName: 'Invoices',
  headerRow: 1,
  headers: {
    invoiceNo: 'Invoice No.', date: 'Date', drugStore: 'Drug Store', amount: 'Amount',
    paymentStatus: 'Payment Status', paymentMode: 'Payment Mode', staffName: 'Staff Name',
    staffPhone: 'Staff Phone', updatedTime: 'Updated Time',
  },
};
const PAYMENT_MODES = new Set(['UPI', 'CASH', 'CHEQUE']);

function doGet() { return respond_({ ok: true, service: 'Anand Delivery Payment API' }); }
function doPost(event) {
  try {
    const request = parseRequest_(event); verifyKey_(request.apiKey);
    if (request.action === 'lookup') return respond_({ ok: true, invoice: lookup_(request.invoiceNo) });
    if (request.action === 'update') return respond_({ ok: true, invoice: update_(request) });
    throw new AppError('INVALID_ACTION', 'Unsupported action.');
  } catch (error) {
    if (error instanceof AppError) return respond_({ ok: false, code: error.code, message: error.message });
    console.error(error.stack || error); return respond_({ ok: false, code: 'SERVER_ERROR', message: 'The service could not complete the request.' });
  }
}

function lookup_(invoiceNo) { const { sheet, columns } = configuredSheet_(); const row = findRow_(sheet, columns.invoiceNo, required_(invoiceNo, 'invoiceNo')); if (!row) throw new AppError('INVOICE_NOT_FOUND', `No invoice was found for "${invoiceNo}".`); return invoice_(sheet, columns, row); }
function update_(request) {
  const invoiceNo = required_(request.invoiceNo, 'invoiceNo'); const staffName = required_(request.staffName, 'staffName'); const staffPhone = required_(request.staffPhone, 'staffPhone'); const status = normalise_(required_(request.paymentStatus, 'paymentStatus')); const mode = normalise_(request.paymentMode || '');
  if (!['PAID', 'OUTSTANDING'].includes(status)) throw new AppError('INVALID_PAYMENT_STATUS', 'Payment status must be PAID or OUTSTANDING.');
  if (status === 'PAID' && !PAYMENT_MODES.has(mode)) throw new AppError('INVALID_PAYMENT_MODE', 'Paid invoices require UPI, CASH, or CHEQUE.');
  if (status === 'OUTSTANDING' && mode) throw new AppError('INVALID_PAYMENT_MODE', 'Outstanding invoices must not have a payment mode.');
  const lock = LockService.getScriptLock();
  try { lock.waitLock(20_000); } catch (_) { throw new AppError('BUSY', 'Another update is in progress. Please try again.'); }
  try {
    const { sheet, columns } = configuredSheet_(); const row = findRow_(sheet, columns.invoiceNo, invoiceNo); if (!row) throw new AppError('INVOICE_NOT_FOUND', `No invoice was found for "${invoiceNo}".`);
    const current = normalise_(sheet.getRange(row, columns.paymentStatus).getDisplayValue());
    if (current === 'PAID') throw new AppError('ALREADY_PAID', 'This invoice is already marked as paid. No changes were made.');
    if (current === 'OUTSTANDING' && status === 'OUTSTANDING') throw new AppError('ALREADY_OUTSTANDING', 'This invoice is already marked as outstanding. No changes were made.');
    if (current && current !== 'OUTSTANDING') throw new AppError('UNEXPECTED_CURRENT_STATUS', `This invoice has status "${current}" and was not changed.`);
    const writes = [[columns.paymentStatus, status], [columns.paymentMode, mode], [columns.staffName, staffName], [columns.staffPhone, staffPhone]];
    writes.forEach(([column, value]) => sheet.getRange(row, column).setValue(value)); sheet.getRange(row, columns.updatedTime).setValue(new Date()).setNumberFormat('dd-MMM-yyyy HH:mm'); SpreadsheetApp.flush();
    return invoice_(sheet, columns, row);
  } finally { lock.releaseLock(); }
}

function configuredSheet_() { if (!CONFIG.spreadsheetId || CONFIG.spreadsheetId.startsWith('REPLACE_')) throw new AppError('NOT_CONFIGURED', 'Set CONFIG.spreadsheetId before deployment.'); const sheet = SpreadsheetApp.openById(CONFIG.spreadsheetId).getSheetByName(CONFIG.sheetName); if (!sheet) throw new AppError('SHEET_NOT_FOUND', `Sheet "${CONFIG.sheetName}" was not found.`); const labels = sheet.getRange(CONFIG.headerRow, 1, 1, sheet.getLastColumn()).getDisplayValues()[0].map(normalise_); const columns = Object.fromEntries(Object.entries(CONFIG.headers).map(([field, label]) => { const column = labels.indexOf(normalise_(label)) + 1; if (!column) throw new AppError('MISSING_COLUMN', `Missing required header: ${label}`); return [field, column]; })); return { sheet, columns }; }
function findRow_(sheet, column, invoiceNo) { const firstRow = CONFIG.headerRow + 1; const count = sheet.getLastRow() - CONFIG.headerRow; if (count <= 0) return null; const rows = sheet.getRange(firstRow, column, count, 1).getDisplayValues().flat().map(normalise_); const matches = rows.reduce((found, value, index) => value === normalise_(invoiceNo) ? [...found, firstRow + index] : found, []); if (matches.length > 1) throw new AppError('DUPLICATE_INVOICE_NUMBER', `More than one row has invoice number "${invoiceNo}".`); return matches[0] || null; }
function invoice_(sheet, columns, row) { const read = (field) => sheet.getRange(row, columns[field]).getDisplayValue(); return Object.fromEntries(Object.keys(columns).map((field) => [field, read(field)])); }
function parseRequest_(event) { try { return JSON.parse(event?.postData?.contents || ''); } catch (_) { throw new AppError('INVALID_JSON', 'A JSON request body is required.'); } }
function verifyKey_(apiKey) { const expected = PropertiesService.getScriptProperties().getProperty('ANAND_API_KEY'); if (!expected) throw new AppError('NOT_CONFIGURED', 'Set the ANAND_API_KEY script property before deployment.'); if (apiKey !== expected) throw new AppError('UNAUTHORIZED', 'This application is not authorised.'); }
function required_(value, name) { const text = String(value || '').trim(); if (!text) throw new AppError('INVALID_REQUEST', `${name} is required.`); return text; }
function normalise_(value) { return String(value || '').trim().toUpperCase(); }
function respond_(body) { return ContentService.createTextOutput(JSON.stringify(body)).setMimeType(ContentService.MimeType.JSON); }
class AppError extends Error { constructor(code, message) { super(message); this.code = code; } }
