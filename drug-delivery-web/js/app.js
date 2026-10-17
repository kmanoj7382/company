import { PAYMENT_STATUS, EXAMPLE_XL_ROWS } from './config.js';
import { InvoiceApi, ApiError } from './api.js';
import { activityStore, connectionStore, staffStore } from './storage.js';
import {
  BarcodeScannerEngine,
  initHardwareBarcodeListener,
  playBeep,
  generateBarcodeSvg,
} from './scanner.js';
import {
  $,
  $$,
  closeModal,
  openModal,
  refreshIcons,
  renderActivity,
  renderConnection,
  renderInvoice,
  renderMetrics,
  renderStaff,
  renderTable,
  renderExampleXlTable,
  setBusy,
  showToast,
} from './ui.js';

const api = new InvoiceApi();
const scannerEngine = new BarcodeScannerEngine();

let allInvoices = [];
let currentInvoice = null;
let currentCapture = null;
let invoiceToDelete = null;
let pendingImportRecords = null;

// Scanner state
let torchActive = false;
let selectedCameraId = null;

// Table state
let activeFilter = 'ALL';
let searchQuery = '';
let sortField = 'invoiceNo';
let sortAsc = true;

async function boot() {
  bindEvents();
  updateManualClock();
  window.setInterval(updateManualClock, 1000);

  const staff = staffStore.get();
  if (staff) {
    await showWorkspace(staff);
  } else {
    $('#staffSetup').classList.remove('hidden');
  }

  // Pre-render Example XL table in modal
  renderExampleXlTable(EXAMPLE_XL_ROWS);
  refreshIcons();

  // Initialize global hardware barcode gun listener (USB / Bluetooth laser scanners)
  initHardwareBarcodeListener((code, source) => {
    handleScannedBarcode(code, source);
  });
}

function bindEvents() {
  // Staff Identification
  $('#staffForm').addEventListener('submit', saveStaff);
  $('#editStaff').addEventListener('click', showSetup);

  // Quick lookup & camera
  $('#lookupForm').addEventListener('submit', (e) => {
    e.preventDefault();
    lookup($('#invoiceNumber').value, 'manual');
  });
  $('#cameraManualForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const num = $('#cameraInvoice').value.trim();
    if (num) {
      await stopScanner();
      closeModal('scannerModal');
      lookup(num, 'manual');
    }
  });
  $('#openScanner').addEventListener('click', startScanner);
  $('#barcodeImage').addEventListener('change', scanBarcodeImage);

  // Scanner toolbar events (camera select, torch, restart)
  $('#scannerCameraSelect').addEventListener('change', async (e) => {
    selectedCameraId = e.target.value;
    await startScanner();
  });
  $('#scannerTorchBtn').addEventListener('click', async () => {
    torchActive = !torchActive;
    const ok = await scannerEngine.toggleTorch(torchActive);
    if (ok) {
      $('#scannerTorchBtn').classList.toggle('active', torchActive);
    }
  });
  $('#scannerRestartBtn').addEventListener('click', () => startScanner());

  // Test Barcodes toggle
  $('#toggleTestBarcodesBtn').addEventListener('click', () => {
    const content = $('#testBarcodesContent');
    const isHidden = content.classList.toggle('hidden');
    $('#testBarcodesChevron').style.transform = isHidden ? 'none' : 'rotate(180deg)';
    if (!isHidden && !$('#testBarcodesGrid').innerHTML.trim()) {
      renderTestBarcodes();
    }
  });

  // Pill hints
  $$('.pill-hint').forEach((btn) => {
    btn.addEventListener('click', () => {
      const fill = btn.dataset.fill;
      if (fill) {
        $('#invoiceNumber').value = fill;
        lookup(fill, 'manual');
      }
    });
  });

  // Verified Card Actions
  $('#openPaymentModes').addEventListener('click', () => openModal('paymentModal'));
  $('#markOutstanding').addEventListener('click', () => updatePayment(PAYMENT_STATUS.OUTSTANDING, ''));
  $('#undoPaidBtn').addEventListener('click', () => undoPayment());
  $('#cardEditBtn').addEventListener('click', () => {
    if (currentInvoice) openEditModal(currentInvoice.invoiceNo);
  });
  $('#cardDeleteBtn').addEventListener('click', () => {
    if (currentInvoice) openDeleteModal(currentInvoice.invoiceNo);
  });

  // Payment mode selections
  $$('.mode-grid button').forEach((button) => {
    button.addEventListener('click', () => {
      updatePayment(PAYMENT_STATUS.PAID, button.dataset.mode);
    });
  });

  // Table Filters & Search
  $('#tableSearchInput').addEventListener('input', (e) => {
    searchQuery = e.target.value;
    $('#clearSearchBtn').classList.toggle('hidden', !searchQuery);
    refreshTable();
  });
  $('#clearSearchBtn').addEventListener('click', () => {
    searchQuery = '';
    $('#tableSearchInput').value = '';
    $('#clearSearchBtn').classList.add('hidden');
    refreshTable();
  });
  $$('.filter-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      $$('.filter-tab').forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      activeFilter = tab.dataset.filter;
      refreshTable();
    });
  });

  // Table sorting
  $$('#crudTable th[data-sort]').forEach((th) => {
    th.addEventListener('click', () => {
      const field = th.dataset.sort;
      if (sortField === field) {
        sortAsc = !sortAsc;
      } else {
        sortField = field;
        sortAsc = true;
      }
      refreshTable();
    });
  });

  // Table row actions (event delegation)
  $('#tableBody').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    const id = btn.dataset.id;
    if (action === 'view') {
      lookup(id, 'register');
    } else if (action === 'edit') {
      openEditModal(id);
    } else if (action === 'delete') {
      openDeleteModal(id);
    }
  });

  // CRUD: Create (Manual Entry)
  $('#openCreateBtn').addEventListener('click', openCreateModal);
  $('#tableAddInvoiceBtn').addEventListener('click', openCreateModal);
  $('#createStatus').addEventListener('change', (e) => {
    $('#createModeContainer').classList.toggle('hidden', e.target.value !== PAYMENT_STATUS.PAID);
  });
  $('#createInvoiceForm').addEventListener('submit', handleCreateInvoice);

  // CRUD: Edit (Update)
  $('#editStatus').addEventListener('change', (e) => {
    if (e.target.value === PAYMENT_STATUS.PAID && !$('#editMode').value) {
      $('#editMode').value = 'UPI';
    } else if (e.target.value !== PAYMENT_STATUS.PAID) {
      $('#editMode').value = '';
    }
  });
  $('#editInvoiceForm').addEventListener('submit', handleEditInvoice);

  // CRUD: Delete
  $('#confirmDeleteBtn').addEventListener('click', handleDeleteInvoice);

  // Example XL Data explorer
  $('#openExampleXlBtn').addEventListener('click', () => openModal('exampleXlModal'));
  $('#sidebarOpenXl').addEventListener('click', () => openModal('exampleXlModal'));
  $('#xlLoadAllBtn').addEventListener('click', resetToExampleData);
  $('#tableResetBtn').addEventListener('click', resetToExampleData);
  $('#xlDownloadXlsxBtn').addEventListener('click', exportToExcel);
  $('#tableExportBtn').addEventListener('click', exportToExcel);
  $('#sidebarExportXl').addEventListener('click', exportToExcel);
  $('#xlDownloadCsvBtn').addEventListener('click', exportToCsv);

  // Import Excel / CSV
  $('#sidebarImportXl').addEventListener('click', () => openModal('importModal'));
  $('#importFileInput').addEventListener('change', handleFileSelect);
  $('#confirmImportBtn').addEventListener('click', handleConfirmImport);

  // Settings & Activity
  $('#settingsForm').addEventListener('submit', saveConnection);
  $('#openSettings').addEventListener('click', openSettings);
  $('#openSettingsFromSetup').addEventListener('click', openSettings);
  $('#clearActivity').addEventListener('click', () => {
    activityStore.clear();
    renderActivity([]);
    showToast('Local activity history cleared.');
  });

  // Mobile menu
  $('#menuToggle').addEventListener('click', () => $('.sidebar').classList.toggle('open'));

  // Modal close handlers
  $$('[data-close]').forEach((button) => {
    button.addEventListener('click', () => {
      const modalId = button.dataset.close;
      if (modalId === 'scannerModal') stopScanner();
      closeModal(modalId);
    });
  });
  $$('.modal-layer').forEach((layer) => {
    layer.addEventListener('click', (event) => {
      if (event.target === layer) {
        if (layer.id === 'scannerModal') stopScanner();
        closeModal(layer.id);
      }
    });
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      $$('.modal-layer.open').forEach((layer) => {
        if (layer.id === 'scannerModal') stopScanner();
        closeModal(layer.id);
      });
    }
  });
}

function saveStaff(event) {
  event.preventDefault();
  const name = $('#staffName').value.trim();
  const phone = $('#staffPhone').value.trim();
  if (name.length < 2) {
    $('#staffError').textContent = 'Please enter operator name.';
    return;
  }
  $('#staffError').textContent = '';
  staffStore.set({ name, phone });
  showWorkspace({ name, phone });
}

async function showWorkspace(staff) {
  $('#staffSetup').classList.add('hidden');
  $('#workspace').classList.remove('hidden');
  renderStaff(staff);
  renderConnection(api.isLive());
  renderActivity(activityStore.get());
  await reloadInvoices();
}

function showSetup() {
  const staff = staffStore.get();
  $('#staffName').value = staff?.name || 'Ramesh Kumar';
  $('#staffPhone').value = staff?.phone || '+91 98450 12345';
  $('#workspace').classList.add('hidden');
  $('#staffSetup').classList.remove('hidden');
  window.scrollTo(0, 0);
}

async function reloadInvoices() {
  allInvoices = await api.list();
  renderMetrics(allInvoices);
  refreshTable();
}

function refreshTable() {
  renderTable(allInvoices, activeFilter, searchQuery, sortField, sortAsc);
}

// LOOKUP (READ)
async function lookup(rawInvoiceNo, source = 'manual') {
  const invoiceNo = String(rawInvoiceNo || '').trim();
  if (!invoiceNo) return;

  const btn = $('#lookupForm button');
  setBusy(btn, true, 'Finding…');
  try {
    currentInvoice = await api.lookup(invoiceNo);
    currentCapture = { source, timestamp: indiaTime() };
    renderInvoice(currentInvoice, currentCapture);
    $('#invoiceNumber').value = currentInvoice.invoiceNo;
    $('#invoiceSection').scrollIntoView({ behavior: 'smooth', block: 'center' });
    showToast(`Invoice ${currentInvoice.invoiceNo} verified. Ready for update.`);
  } catch (error) {
    showToast(error.message || 'Unable to find that invoice.', 'error');
  } finally {
    setBusy(btn, false);
  }
}

// SMART BARCODE EXTRACTION
function extractInvoiceNo(raw) {
  if (!raw) return '';
  const trimmed = String(raw).trim();
  // Strip Code 39 leading/trailing asterisks
  const clean = trimmed.replace(/^\*+|\*+$/g, '').trim().toUpperCase();

  // 1. Direct match in active invoices
  const direct = allInvoices.find((inv) => inv.invoiceNo.toUpperCase() === clean);
  if (direct) return direct.invoiceNo;

  // 2. Regex search for E##### in the string
  const matchE = clean.match(/E\d{4,}/i);
  if (matchE) {
    const found = allInvoices.find((inv) => inv.invoiceNo.toUpperCase() === matchE[0].toUpperCase());
    if (found) return found.invoiceNo;
    return matchE[0].toUpperCase();
  }

  // 3. Regex search for INV#####
  const matchInv = clean.match(/INV\d+/i);
  if (matchInv) {
    const found = allInvoices.find((inv) => inv.invoiceNo.toUpperCase() === matchInv[0].toUpperCase());
    if (found) return found.invoiceNo;
    return matchInv[0].toUpperCase();
  }

  return clean;
}

async function handleScannedBarcode(rawCode, source = 'camera') {
  const invoiceNo = extractInvoiceNo(rawCode);
  if (!invoiceNo) return;

  // Visual success flash on camera reticle
  const box = $('#cameraBox');
  if (box) {
    const flash = document.createElement('div');
    flash.className = 'scan-success-flash';
    box.appendChild(flash);
    setTimeout(() => flash.remove(), 400);
  }

  playBeep();

  // Close scanner modal if open
  await stopScanner();
  closeModal('scannerModal');

  // Trigger invoice lookup
  await lookup(invoiceNo, source === 'hardware_gun' ? 'barcode_gun' : 'barcode');

  const sourceLabel = source === 'hardware_gun' ? 'USB / Handheld Barcode Gun' : 'Camera Barcode Scanner';
  showToast(`⚡ Barcode verified: "${invoiceNo}" via ${sourceLabel}`);
}

// CRUD: CREATE
function openCreateModal() {
  let nextNum = 'E24367';
  const existingNums = allInvoices
    .map((i) => i.invoiceNo)
    .filter((no) => no.startsWith('E'))
    .map((no) => parseInt(no.replace(/\D/g, ''), 10))
    .filter((n) => !isNaN(n));
  if (existingNums.length > 0) {
    const max = Math.max(...existingNums);
    nextNum = 'E' + (max + 1);
  }

  $('#createInvoiceNo').value = nextNum;
  $('#createDate').value = '15-09-2026';
  $('#createStore').value = '';
  $('#createAmount').value = '';
  $('#createStatus').value = 'UNPAID';
  $('#createMode').value = 'UPI';
  $('#createModeContainer').classList.add('hidden');
  $('#createNotes').value = '';
  $('#createError').textContent = '';
  openModal('createModal');
}

async function handleCreateInvoice(event) {
  event.preventDefault();
  const invoiceNo = $('#createInvoiceNo').value.trim();
  const date = $('#createDate').value.trim() || '15-09-2026';
  const drugStore = $('#createStore').value.trim();
  const amount = $('#createAmount').value.trim();
  const paymentStatus = $('#createStatus').value;
  const paymentMode = paymentStatus === PAYMENT_STATUS.PAID ? $('#createMode').value : '';
  const notes = $('#createNotes').value.trim();

  if (!invoiceNo) {
    $('#createError').textContent = 'Invoice / Bill number is required.';
    return;
  }
  if (!drugStore) {
    $('#createError').textContent = 'Drug store / Party name is required.';
    return;
  }
  const amtNum = parseFloat(amount);
  if (isNaN(amtNum) || amtNum < 0) {
    $('#createError').textContent = 'Enter a valid positive bill amount.';
    return;
  }

  const staff = staffStore.get();
  try {
    const created = await api.create({
      invoiceNo,
      date,
      drugStore,
      rawParty: drugStore,
      amount: amtNum,
      paymentStatus,
      paymentMode,
      staffName: staff?.name || '',
      staffPhone: staff?.phone || '',
      notes,
    });

    closeModal('createModal');
    await reloadInvoices();

    activityStore.add({
      invoiceNo: created.invoiceNo,
      drugStore: created.drugStore,
      paymentStatus: created.paymentStatus,
      paymentMode: created.paymentMode,
      staffName: staff?.name,
      updatedTime: created.updatedTime,
    });
    renderActivity(activityStore.get());

    showToast(`Invoice ${created.invoiceNo} created successfully!`);
    lookup(created.invoiceNo, 'create');
  } catch (error) {
    $('#createError').textContent = error.message;
  }
}

// CRUD: EDIT (UPDATE)
async function openEditModal(invoiceNo) {
  try {
    const inv = await api.lookup(invoiceNo);
    $('#editInvoiceNoOriginal').value = inv.invoiceNo;
    $('#editInvoiceNo').value = inv.invoiceNo;
    $('#editDate').value = inv.date || '15-09-2026';
    $('#editStore').value = inv.drugStore || inv.rawParty || '';
    $('#editAmount').value = inv.amount;
    $('#editStatus').value = inv.paymentStatus || 'UNPAID';
    $('#editMode').value = inv.paymentMode || '';
    $('#editNotes').value = inv.notes || '';
    $('#editError').textContent = '';
    openModal('editModal');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function handleEditInvoice(event) {
  event.preventDefault();
  const invoiceNo = $('#editInvoiceNoOriginal').value;
  const date = $('#editDate').value.trim();
  const drugStore = $('#editStore').value.trim();
  const amount = $('#editAmount').value.trim();
  const paymentStatus = $('#editStatus').value;
  const paymentMode = paymentStatus === PAYMENT_STATUS.PAID ? ($('#editMode').value || 'UPI') : '';
  const notes = $('#editNotes').value.trim();

  if (!drugStore) {
    $('#editError').textContent = 'Store name is required.';
    return;
  }
  const amtNum = parseFloat(amount);
  if (isNaN(amtNum) || amtNum < 0) {
    $('#editError').textContent = 'Enter a valid amount.';
    return;
  }

  const staff = staffStore.get();
  try {
    const updated = await api.update({
      invoiceNo,
      date,
      drugStore,
      amount: amtNum,
      paymentStatus,
      paymentMode,
      staffName: staff?.name,
      staffPhone: staff?.phone,
      notes,
    });

    closeModal('editModal');
    await reloadInvoices();

    if (currentInvoice && currentInvoice.invoiceNo === updated.invoiceNo) {
      currentInvoice = updated;
      renderInvoice(currentInvoice, currentCapture);
    }

    activityStore.add({
      invoiceNo: updated.invoiceNo,
      drugStore: updated.drugStore,
      paymentStatus: updated.paymentStatus,
      paymentMode: updated.paymentMode,
      staffName: staff?.name,
      updatedTime: updated.updatedTime,
    });
    renderActivity(activityStore.get());

    showToast(`Invoice ${updated.invoiceNo} updated successfully!`);
  } catch (error) {
    $('#editError').textContent = error.message;
  }
}

// CRUD: DELETE
function openDeleteModal(invoiceNo) {
  invoiceToDelete = invoiceNo;
  $('#deleteInvoiceNo').textContent = invoiceNo;
  openModal('deleteModal');
}

async function handleDeleteInvoice() {
  if (!invoiceToDelete) return;
  const btn = $('#confirmDeleteBtn');
  setBusy(btn, true, 'Deleting…');
  try {
    await api.delete(invoiceToDelete);
    if (currentInvoice && currentInvoice.invoiceNo === invoiceToDelete) {
      currentInvoice = null;
      renderInvoice(null);
    }
    closeModal('deleteModal');
    await reloadInvoices();
    showToast(`Invoice ${invoiceToDelete} has been deleted.`);
    invoiceToDelete = null;
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    setBusy(btn, false);
  }
}

// PAYMENT STATUS UPDATES
async function updatePayment(paymentStatus, paymentMode) {
  if (!currentInvoice) return;
  const staff = staffStore.get();
  const activeButton = paymentStatus === PAYMENT_STATUS.PAID ? $(`[data-mode="${paymentMode}"]`) : $('#markOutstanding');
  setBusy(activeButton, true, 'Saving…');

  try {
    const invoice = await api.update({
      invoiceNo: currentInvoice.invoiceNo,
      paymentStatus,
      paymentMode,
      staffName: staff?.name,
      staffPhone: staff?.phone,
    });

    currentInvoice = invoice;
    renderInvoice(invoice, currentCapture);
    activityStore.add({
      invoiceNo: invoice.invoiceNo,
      drugStore: invoice.drugStore,
      paymentStatus: invoice.paymentStatus,
      paymentMode: invoice.paymentMode,
      staffName: staff?.name,
      updatedTime: invoice.updatedTime,
    });
    renderActivity(activityStore.get());
    closeModal('paymentModal');

    await reloadInvoices();

    $('#confirmCopy').textContent = `${invoice.invoiceNo} is marked as ${invoice.paymentStatus}${invoice.paymentMode ? ` via ${invoice.paymentMode}` : ''}. Stamped at ${invoice.updatedTime}.`;
    openModal('confirmModal');
  } catch (error) {
    showToast(error.message || 'The payment could not be updated.', 'error');
  } finally {
    setBusy(activeButton, false);
  }
}

async function undoPayment() {
  if (!currentInvoice) return;
  const staff = staffStore.get();
  try {
    const invoice = await api.update({
      invoiceNo: currentInvoice.invoiceNo,
      paymentStatus: PAYMENT_STATUS.UNPAID,
      paymentMode: '',
      staffName: staff?.name,
      staffPhone: staff?.phone,
    });
    currentInvoice = invoice;
    renderInvoice(invoice, currentCapture);
    await reloadInvoices();
    showToast(`Payment reset to UNPAID for ${invoice.invoiceNo}.`);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// EXAMPLE XL DATA & EXPORT
async function resetToExampleData() {
  if (confirm('Load/Reset all 44 MARG ERP Excel records into the active register?')) {
    await api.resetToExample();
    await reloadInvoices();
    closeModal('exampleXlModal');
    showToast('Loaded all 44 MARG ERP records into register!');
  }
}

function exportToExcel() {
  if (!window.XLSX) {
    showToast('Excel exporter library not loaded. Use CSV export.', 'error');
    return;
  }
  const exportData = allInvoices.map((inv, idx) => ({
    'SL NO.': idx + 1,
    'BILL NO.': inv.invoiceNo,
    'DATE': inv.date,
    'PARTY': inv.rawParty || inv.drugStore,
    'AMOUNT': parseFloat(inv.amount) || 0,
    'PAYMENT STATUS': inv.paymentStatus || 'UNPAID',
    'PAYMENT MODE': inv.paymentMode || '',
    'STAFF OPERATOR': inv.staffName || '',
    'UPDATED TIME': inv.updatedTime || '',
    'NOTES': inv.notes || '',
  }));

  const ws = window.XLSX.utils.json_to_sheet(exportData);
  const wb = window.XLSX.utils.book_new();
  window.XLSX.utils.book_append_sheet(wb, ws, 'Delivery Manifest');
  window.XLSX.writeFile(wb, `Anand_Delivery_Manifest_${new Date().toISOString().slice(0, 10)}.xlsx`);
  showToast('Excel report downloaded successfully!');
}

function exportToCsv() {
  let csv = 'SL NO.,BILL NO.,DATE,PARTY,AMOUNT,PAYMENT STATUS,PAYMENT MODE,UPDATED TIME\n';
  allInvoices.forEach((inv, i) => {
    const party = (inv.rawParty || inv.drugStore).replace(/"/g, '""');
    csv += `${i + 1},${inv.invoiceNo},${inv.date},"${party}",${inv.amount},${inv.paymentStatus || 'UNPAID'},${inv.paymentMode || ''},"${inv.updatedTime || ''}"\n`;
  });
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Anand_Delivery_Manifest_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('CSV downloaded successfully!');
}

// IMPORT EXCEL / CSV
function handleFileSelect(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (event) => {
    try {
      const data = new Uint8Array(event.target.result);
      const workbook = window.XLSX.read(data, { type: 'array' });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const rawRows = window.XLSX.utils.sheet_to_json(firstSheet, { header: 1 });

      if (rawRows.length < 2) {
        showToast('Spreadsheet contains no data rows.', 'error');
        return;
      }

      let headerIdx = -1;
      let billCol = -1;
      let dateCol = -1;
      let partyCol = -1;
      let amountCol = -1;

      for (let r = 0; r < Math.min(10, rawRows.length); r++) {
        const row = rawRows[r].map((c) => String(c || '').toUpperCase().trim());
        billCol = row.findIndex((c) => c.includes('BILL') || c.includes('INVOICE') || c === 'NO.');
        partyCol = row.findIndex((c) => c.includes('PARTY') || c.includes('STORE') || c.includes('CUSTOMER'));
        amountCol = row.findIndex((c) => c.includes('AMOUNT') || c.includes('TOTAL') || c.includes('VALUE'));
        dateCol = row.findIndex((c) => c.includes('DATE'));
        if (billCol !== -1 && (partyCol !== -1 || amountCol !== -1)) {
          headerIdx = r;
          break;
        }
      }

      if (headerIdx === -1) {
        headerIdx = 0;
        billCol = 0;
        dateCol = 1;
        partyCol = 2;
        amountCol = 3;
      }

      const parsedRecords = [];
      for (let r = headerIdx + 1; r < rawRows.length; r++) {
        const row = rawRows[r];
        if (!row || !row[billCol]) continue;
        const invNo = String(row[billCol]).trim();
        const date = dateCol !== -1 && row[dateCol] ? String(row[dateCol]).trim() : '15-09-2026';
        const party = partyCol !== -1 && row[partyCol] ? String(row[partyCol]).trim() : 'General Pharmacy';
        const amt = amountCol !== -1 ? parseFloat(String(row[amountCol]).replace(/[^0-9.]/g, '')) || 0 : 0;

        parsedRecords.push({
          invoiceNo: invNo.toUpperCase(),
          date,
          drugStore: party,
          rawParty: party,
          amount: amt.toFixed(2),
          paymentStatus: 'UNPAID',
          paymentMode: '',
          staffName: '',
          staffPhone: '',
          updatedTime: '',
          notes: 'Imported from spreadsheet',
        });
      }

      if (parsedRecords.length === 0) {
        showToast('Could not parse any valid invoice rows from file.', 'error');
        return;
      }

      pendingImportRecords = parsedRecords;
      $('#importFileName').textContent = `File: ${file.name}`;
      $('#importStats').textContent = `Found ${parsedRecords.length} records ready to import.`;
      $('#importPreviewBox').classList.remove('hidden');
      $('#confirmImportBtn').disabled = false;
    } catch (err) {
      showToast('Error reading spreadsheet: ' + err.message, 'error');
    }
  };
  reader.readAsArrayBuffer(file);
}

async function handleConfirmImport() {
  if (!pendingImportRecords || pendingImportRecords.length === 0) return;
  const replace = $('#importReplaceCheckbox').checked;
  const btn = $('#confirmImportBtn');
  setBusy(btn, true, 'Importing…');
  try {
    await api.bulkLoad(pendingImportRecords, replace);
    await reloadInvoices();
    closeModal('importModal');
    showToast(`Successfully imported ${pendingImportRecords.length} invoices!`);
    pendingImportRecords = null;
    $('#importFileInput').value = '';
    $('#importPreviewBox').classList.add('hidden');
    $('#confirmImportBtn').disabled = true;
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    setBusy(btn, false);
  }
}

// SETTINGS (GOOGLE SHEETS)
function openSettings() {
  const connection = connectionStore.get();
  $('#endpoint').value = connection.endpoint || '';
  $('#apiKey').value = connection.apiKey || '';
  openModal('settingsModal');
}

function saveConnection(event) {
  event.preventDefault();
  const endpoint = $('#endpoint').value.trim();
  const apiKey = $('#apiKey').value.trim();

  if (Boolean(endpoint) !== Boolean(apiKey)) {
    showToast('Enter both deployment URL and API key, or leave both blank for demo mode.', 'error');
    return;
  }
  if (endpoint && !endpoint.startsWith('https://script.google.com/')) {
    showToast('Use the secure Apps Script deployment URL ending in /exec.', 'error');
    return;
  }

  connectionStore.set({ endpoint, apiKey });
  renderConnection(api.isLive());
  closeModal('settingsModal');
  showToast(api.isLive() ? 'Google Sheet connection saved.' : 'Demo mode is active.');
}

// HIGH-EFFICIENCY BARCODE SCANNER
async function startScanner() {
  openModal('scannerModal');
  $('#cameraPlaceholder').classList.remove('hidden');
  $('#scanMessage').innerHTML = '<i data-lucide="loader-circle"></i> Initializing high-speed scanner…';
  refreshIcons();

  // Populate camera devices in dropdown
  try {
    const cameras = await scannerEngine.getCameras();
    const select = $('#scannerCameraSelect');
    if (cameras.length > 0) {
      select.innerHTML = cameras
        .map((c) => `<option value="${c.id}" ${c.id === selectedCameraId ? 'selected' : ''}>${c.label}</option>`)
        .join('');
    } else {
      select.innerHTML = '<option value="">Default Camera (Auto-Detect)</option>';
    }
  } catch (_) {}

  try {
    await scannerEngine.start({
      nativeVideoEl: $('#nativeVideo'),
      html5ContainerId: 'html5Reader',
      deviceId: selectedCameraId,
      onSuccess: (code, meta) => handleScannedBarcode(code, meta?.engine || 'camera'),
      onStatusUpdate: ({ status, engine, canTorch }) => {
        $('#cameraPlaceholder').classList.add('hidden');
        $('#scanMessage').innerHTML = '<i data-lucide="scan-line"></i> Align barcode in frame…';
        $('#scannerEngineBadge').innerHTML = `<i data-lucide="cpu"></i> ${engine}`;
        const torchBtn = $('#scannerTorchBtn');
        if (canTorch) {
          torchBtn.classList.remove('hidden');
        } else {
          torchBtn.classList.add('hidden');
        }
        refreshIcons();
      },
    });
  } catch (err) {
    scanUnavailable(err.message || 'Camera access was not available. Check browser permissions or upload an image.');
  }
}

function scanUnavailable(message) {
  $('#scanMessage').innerHTML = `<i data-lucide="triangle-alert"></i> ${message}`;
  $('#cameraPlaceholder').classList.remove('hidden');
  refreshIcons();
}

async function scanBarcodeImage(event) {
  const image = event.target.files[0];
  if (!image) return;
  openModal('scannerModal');
  $('#scanMessage').innerHTML = '<i data-lucide="loader-circle"></i> Decoding barcode from photo…';
  refreshIcons();

  try {
    await stopScanner();
    const decodedCode = await scannerEngine.scanFile(image);
    if (decodedCode) {
      await handleScannedBarcode(decodedCode, 'image_file');
    } else {
      scanUnavailable('No barcode found in that image. Try a sharper photo or manual entry.');
    }
  } catch (err) {
    scanUnavailable('Could not decode barcode from image. Try a sharper photo or manual entry.');
  } finally {
    event.target.value = '';
  }
}

async function stopScanner() {
  await scannerEngine.stop();
  $('#cameraPlaceholder').classList.remove('hidden');
  $('#nativeVideo').classList.add('hidden');
  $('#scannerTorchBtn').classList.add('hidden');
  torchActive = false;
}

function indiaTime() {
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    dateStyle: 'medium',
    timeStyle: 'medium',
  }).format(new Date());
}

function updateManualClock() {
  const el = $('#manualEntryTime');
  if (el) el.textContent = indiaTime();
}

function renderTestBarcodes() {
  const samples = [
    { no: 'E24323', store: 'RAM MEDICAL (LAGGERE2)', amt: '₹ 1,741.00' },
    { no: 'E24324', store: 'BHAVANI MED & GEN ST', amt: '₹ 849.00' },
    { no: 'E24344', store: 'SRI LAKSHMIRANGANATHA', amt: '₹ 6,807.00' },
    { no: 'E24348', store: 'NANDANAM PHARMA', amt: '₹ 6,795.00' },
  ];

  const grid = $('#testBarcodesGrid');
  grid.innerHTML = samples.map((s) => `
    <div class="barcode-card">
      <div style="width:100%;">${generateBarcodeSvg(s.no)}</div>
      <p>${s.no} · ${s.amt}</p>
      <small>${s.store}</small>
      <div style="display:flex;gap:4px;">
        <button type="button" data-sim-code="${s.no}"><i data-lucide="zap"></i> Simulate Scan</button>
        <button type="button" data-dl-code="${s.no}"><i data-lucide="download"></i> Save Barcode</button>
      </div>
    </div>
  `).join('');

  $$('[data-sim-code]', grid).forEach((btn) => {
    btn.addEventListener('click', () => {
      handleScannedBarcode(btn.dataset.simCode, 'simulated');
    });
  });

  $$('[data-dl-code]', grid).forEach((btn) => {
    btn.addEventListener('click', () => {
      const code = btn.dataset.dlCode;
      const svg = generateBarcodeSvg(code);
      const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Barcode_${code}.svg`;
      a.click();
      URL.revokeObjectURL(url);
      showToast(`Saved barcode image for ${code}`);
    });
  });

  refreshIcons();
}

boot();
