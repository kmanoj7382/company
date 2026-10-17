/**
 * Atlas Desk Google Sheets backend
 *
 * Setup
 * 1. Create a new Google Sheet (this becomes your database).
 * 2. In that Sheet: Extensions -> Apps Script, replace the starter code with this file.
 * 3. Deploy -> New deployment -> Web app. Execute as: Me. Who has access: Anyone.
 * 4. Copy the /exec URL into Atlas Desk -> Sheet connection.
 *
 * Sheet tabs are created automatically: Bookings and Scan Log.
 */
const BOOKING_HEADERS = ['id','reference','traveller','destination','travelDate','returnDate','guests','amount','status','agent','notes','createdAt','updatedAt'];
const SCAN_HEADERS = ['code','scannedAt','createdAt'];

function doGet(e) {
  return respond_({ ok: true, service: 'Atlas Desk Google Sheets API', action: e.parameter.action || 'status' });
}
function doPost(e) {
  try {
    const body = JSON.parse(e.postData && e.postData.contents ? e.postData.contents : '{}');
    const action = body.action;
    const payload = body.payload || {};
    if (action === 'list') return respond_({ ok: true, records: listBookings_() });
    if (action === 'create') return respond_({ ok: true, record: createBooking_(payload) });
    if (action === 'update') return respond_({ ok: true, record: updateBooking_(payload) });
    if (action === 'delete') return respond_({ ok: true, deleted: deleteBooking_(payload.id) });
    if (action === 'bulkCreate') return respond_({ ok: true, imported: bulkCreate_(payload.records || []) });
    if (action === 'scan') return respond_({ ok: true, scan: logScan_(payload) });
    return respond_({ ok: false, error: 'Unknown action: ' + action });
  } catch (error) { return respond_({ ok: false, error: error.message }); }
}
function respond_(data) { return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON); }
function sheet_(name, headers) { const ss = SpreadsheetApp.getActive(); let sh = ss.getSheetByName(name); if (!sh) { sh = ss.insertSheet(name); sh.getRange(1,1,1,headers.length).setValues([headers]); sh.setFrozenRows(1); sh.getRange(1,1,1,headers.length).setFontWeight('bold').setBackground('#DCEEF4'); sh.autoResizeColumns(1,headers.length); } return sh; }
function listBookings_() { const sh = sheet_('Bookings', BOOKING_HEADERS); const rows = sh.getDataRange().getValues(); if (rows.length < 2) return []; const headers = rows.shift(); return rows.filter(row => row[0]).map(row => object_(headers,row)).reverse(); }
function createBooking_(record) { const sh = sheet_('Bookings', BOOKING_HEADERS); record.createdAt = record.createdAt || new Date().toISOString(); record.updatedAt = new Date().toISOString(); sh.appendRow(BOOKING_HEADERS.map(h => record[h] || '')); return record; }
function updateBooking_(record) { const sh = sheet_('Bookings', BOOKING_HEADERS); const values = sh.getDataRange().getValues(); const idColumn = 1; for (let row = 2; row <= values.length; row++) { if (String(values[row-1][0]) === String(record.id)) { record.updatedAt = new Date().toISOString(); sh.getRange(row,1,1,BOOKING_HEADERS.length).setValues([BOOKING_HEADERS.map((h,i) => record[h] !== undefined ? record[h] : values[row-1][i])]); return record; } } return createBooking_(record); }
function deleteBooking_(id) { const sh = sheet_('Bookings', BOOKING_HEADERS); const ids = sh.getRange(2,1,Math.max(sh.getLastRow()-1,1),1).getValues().flat(); const index = ids.findIndex(v => String(v) === String(id)); if (index === -1) return false; sh.deleteRow(index + 2); return true; }
function bulkCreate_(records) { records.forEach(createBooking_); return records.length; }
function logScan_(scan) { const sh = sheet_('Scan Log', SCAN_HEADERS); scan.createdAt = new Date().toISOString(); sh.appendRow(SCAN_HEADERS.map(h => scan[h] || '')); return scan; }
function object_(headers, values) { const out = {}; headers.forEach((header,index) => out[header] = values[index] instanceof Date ? Utilities.formatDate(values[index], Session.getScriptTimeZone(), 'yyyy-MM-dd') : values[index]); return out; }
