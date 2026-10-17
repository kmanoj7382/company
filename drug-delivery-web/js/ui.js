export const $ = (selector, root = document) => root.querySelector(selector);
export const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

export function refreshIcons() {
  if (window.lucide) {
    window.lucide.createIcons();
  }
}

export function openModal(id) {
  const element = $(`#${id}`);
  if (element) {
    element.classList.add('open');
    element.setAttribute('aria-hidden', 'false');
  }
}

export function closeModal(id) {
  const element = $(`#${id}`);
  if (element) {
    element.classList.remove('open');
    element.setAttribute('aria-hidden', 'true');
  }
}

export function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<i data-lucide="${type === 'error' ? 'circle-alert' : 'circle-check'}"></i><span></span>`;
  $('span', toast).textContent = message;
  $('#toastRegion').append(toast);
  refreshIcons();
  window.setTimeout(() => toast.remove(), 4000);
}

export function formatCurrency(amount) {
  const num = parseFloat(amount) || 0;
  return '₹ ' + num.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function renderStaff(staff) {
  if (!staff) return;
  $('#operatorName').textContent = staff.name || 'Staff Member';
  $('#operatorPhone').textContent = staff.phone || 'Phone';
  const initials = (staff.name || 'RK')
    .trim()
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  $('#operatorInitials').textContent = initials;
}

export function renderConnection(isLive) {
  $('#sidebarConnection').classList.toggle('live', isLive);
  $('#connectionPill').classList.toggle('live', isLive);
  $('#connectionPill b').textContent = isLive ? 'Google Sheet Live' : 'Demo Mode';
  $('#connectionPill small').textContent = isLive ? 'Master Cloud' : 'Local Storage';
}

export function renderMetrics(invoices = []) {
  const totalCount = invoices.length;
  let totalValue = 0;
  let paidValue = 0;
  let paidCount = 0;
  let outValue = 0;
  let outCount = 0;
  let unpaidValue = 0;
  let unpaidCount = 0;

  for (const inv of invoices) {
    const amt = parseFloat(inv.amount) || 0;
    totalValue += amt;
    const status = String(inv.paymentStatus || 'UNPAID').toUpperCase();
    if (status === 'PAID') {
      paidValue += amt;
      paidCount++;
    } else if (status === 'OUTSTANDING') {
      outValue += amt;
      outCount++;
    } else {
      unpaidValue += amt;
      unpaidCount++;
    }
  }

  $('#metricTotalCount').textContent = totalCount;
  $('#metricTotalValue').textContent = formatCurrency(totalValue);
  $('#metricPaidValue').textContent = formatCurrency(paidValue);
  $('#metricPaidCount').textContent = `${paidCount} bill${paidCount === 1 ? '' : 's'} paid`;
  $('#metricOutValue').textContent = formatCurrency(outValue);
  $('#metricOutCount').textContent = `${outCount} bill${outCount === 1 ? '' : 's'} not received`;
  $('#metricUnpaidValue').textContent = formatCurrency(unpaidValue);
  $('#metricUnpaidCount').textContent = `${unpaidCount} pending collection`;

  $('#sidebarInvoiceCount').textContent = totalCount;
  $('#filterCountAll').textContent = totalCount;
  $('#filterCountUnpaid').textContent = unpaidCount;
  $('#filterCountPaid').textContent = paidCount;
  $('#filterCountOut').textContent = outCount;
}

export function renderInvoice(invoice, capture = null) {
  if (!invoice) {
    $('#emptyInvoice').classList.remove('hidden');
    $('#invoiceCard').classList.add('hidden');
    return;
  }

  $('#emptyInvoice').classList.add('hidden');
  $('#invoiceCard').classList.remove('hidden');

  $('#verifiedInvoiceNo').textContent = invoice.invoiceNo;
  $('#invoiceStore').textContent = invoice.drugStore || invoice.rawParty || '—';
  $('#invoiceDate').textContent = invoice.date || '—';
  $('#invoiceAmount').textContent = formatCurrency(invoice.amount);
  $('#invoiceMode').textContent = invoice.paymentMode ? `${invoice.paymentMode}` : (invoice.paymentStatus === 'PAID' ? 'Collected' : 'Not recorded');

  const status = String(invoice.paymentStatus || 'UNPAID').toUpperCase();
  const statusElement = $('#invoiceStatus');
  statusElement.textContent = status;
  statusElement.className = `invoice-status ${status.toLowerCase()}`;

  const isPaid = status === 'PAID';
  $('#paymentActions').classList.toggle('hidden', isPaid);
  $('#paidLock').classList.toggle('hidden', !isPaid);
  if (isPaid) {
    $('#paidDetailsText').textContent = `Paid by ${invoice.paymentMode || 'Payment'} on ${invoice.updatedTime || 'today'}${invoice.staffName ? ` (${invoice.staffName})` : ''}.`;
  }

  const captureElement = $('#entryCapture');
  if (capture) {
    captureElement.classList.remove('hidden');
    $('#entrySource').textContent = capture.source === 'barcode' ? 'Barcode Scan Captured' : 'Manual Entry Captured';
    $('#entryCapturedAt').textContent = capture.timestamp;
  } else {
    captureElement.classList.add('hidden');
  }
}

export function renderTable(invoices = [], filter = 'ALL', query = '', sortField = 'invoiceNo', sortAsc = true) {
  const tbody = $('#tableBody');
  const lowerQuery = query.trim().toLowerCase();

  const filtered = invoices.filter((inv) => {
    const status = String(inv.paymentStatus || 'UNPAID').toUpperCase();
    if (filter !== 'ALL' && status !== filter) {
      return false;
    }
    if (lowerQuery) {
      const matchNo = inv.invoiceNo.toLowerCase().includes(lowerQuery);
      const matchStore = (inv.drugStore || '').toLowerCase().includes(lowerQuery);
      const matchParty = (inv.rawParty || '').toLowerCase().includes(lowerQuery);
      const matchAmt = String(inv.amount || '').includes(lowerQuery);
      if (!matchNo && !matchStore && !matchParty && !matchAmt) return false;
    }
    return true;
  });

  filtered.sort((a, b) => {
    let valA = a[sortField];
    let valB = b[sortField];
    if (sortField === 'amount') {
      valA = parseFloat(valA) || 0;
      valB = parseFloat(valB) || 0;
    } else {
      valA = String(valA || '').toLowerCase();
      valB = String(valB || '').toLowerCase();
    }
    if (valA < valB) return sortAsc ? -1 : 1;
    if (valA > valB) return sortAsc ? 1 : -1;
    return 0;
  });

  let sum = 0;
  tbody.innerHTML = filtered.map((inv) => {
    const amt = parseFloat(inv.amount) || 0;
    sum += amt;
    const status = String(inv.paymentStatus || 'UNPAID').toUpperCase();
    const modeBadge = inv.paymentMode ? `<span class="pill-hint">${escapeHtml(inv.paymentMode)}</span>` : '<span style="color:#a0aec0">—</span>';
    const auditInfo = inv.updatedTime ? `<small style="font-family:'DM Mono';color:#718096">${escapeHtml(inv.updatedTime)}<br/>${escapeHtml(inv.staffName || '')}</small>` : '<span style="color:#cbd5e0">—</span>';

    return `
      <tr data-invoice-no="${escapeHtml(inv.invoiceNo)}">
        <td><span class="invoice-num">${escapeHtml(inv.invoiceNo)}</span></td>
        <td>${escapeHtml(inv.date || '15-09-2026')}</td>
        <td>
          <span class="store-name">${escapeHtml(inv.drugStore || inv.rawParty)}</span>
          ${inv.rawParty && inv.rawParty !== inv.drugStore ? `<span class="store-area">${escapeHtml(inv.rawParty)}</span>` : ''}
        </td>
        <td class="text-right amount-cell">${formatCurrency(inv.amount)}</td>
        <td><span class="badge ${status.toLowerCase()}">${status}</span></td>
        <td>${modeBadge}</td>
        <td>${auditInfo}</td>
        <td class="text-center">
          <div class="action-btns">
            <button class="btn-action pay" data-action="view" data-id="${escapeHtml(inv.invoiceNo)}" title="View in collection card"><i data-lucide="eye"></i> View</button>
            <button class="btn-action edit" data-action="edit" data-id="${escapeHtml(inv.invoiceNo)}" title="Edit invoice details"><i data-lucide="pencil"></i> Edit</button>
            <button class="btn-action delete" data-action="delete" data-id="${escapeHtml(inv.invoiceNo)}" title="Delete invoice"><i data-lucide="trash-2"></i></button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:32px;color:#718096;">No invoices found matching current search or filter.</td></tr>`;
  }

  $('#tableSummaryText').textContent = `Showing ${filtered.length} of ${invoices.length} invoices`;
  $('#tableTotalSum').textContent = `Filtered Total: ${formatCurrency(sum)}`;

  refreshIcons();
}

export function renderExampleXlTable(rows = []) {
  const tbody = $('#xlPreviewBody');
  if (!tbody) return;
  tbody.innerHTML = rows.map((r, i) => `
    <tr>
      <td>${i + 1}</td>
      <td><b>${escapeHtml(r.invoiceNo)}</b></td>
      <td>${escapeHtml(r.date)}</td>
      <td>${escapeHtml(r.rawParty || r.drugStore)}</td>
      <td class="text-right">${formatCurrency(r.amount)}</td>
    </tr>
  `).join('');
}

export function renderActivity(entries = []) {
  const list = $('#activityList');
  if (!entries.length) {
    list.innerHTML = '<p class="empty-activity">Device activity and payment audit history will appear here.</p>';
    return;
  }
  list.innerHTML = entries.map((entry) => `
    <article class="activity-item">
      <span class="activity-icon ${entry.paymentStatus === 'OUTSTANDING' ? 'outstanding' : ''}">
        <i data-lucide="${entry.paymentStatus === 'OUTSTANDING' ? 'clock-3' : 'circle-check'}"></i>
      </span>
      <span>
        <b>${escapeHtml(entry.invoiceNo)} · ${entry.paymentStatus === 'PAID' ? `Paid by ${escapeHtml(entry.paymentMode || 'UPI')}` : (entry.paymentStatus === 'OUTSTANDING' ? 'Payment Outstanding' : 'Invoice Created/Updated')}</b>
        <small>${escapeHtml(entry.drugStore || entry.rawParty)} · ${entry.staffName ? `Operated by ${escapeHtml(entry.staffName)}` : 'Local device'}</small>
      </span>
      <time>${escapeHtml(entry.updatedTime || 'Recently')}</time>
    </article>
  `).join('');
  refreshIcons();
}

export function setBusy(button, busy, label = 'Working…') {
  if (!button) return;
  if (!button.dataset.label) button.dataset.label = button.innerHTML;
  button.disabled = busy;
  button.innerHTML = busy ? `<i data-lucide="loader-circle"></i> ${label}` : button.dataset.label;
  refreshIcons();
}

const escapeHtml = (value = '') => {
  const node = document.createElement('div');
  node.textContent = String(value || '');
  return node.innerHTML;
};
