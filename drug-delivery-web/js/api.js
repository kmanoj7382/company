import { PAYMENT_STATUS } from './config.js';
import { connectionStore, invoiceStore } from './storage.js';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const normalise = (value) => String(value || '').trim().toUpperCase();

export class InvoiceApi {
  isLive() {
    const conn = connectionStore.get();
    return Boolean(conn.endpoint && conn.apiKey);
  }

  // READ: List all invoices
  async list() {
    if (!this.isLive()) {
      return this.#demoList();
    }
    return this.#request({ action: 'list' });
  }

  // READ: Lookup single invoice by bill number
  async lookup(invoiceNo) {
    if (!this.isLive()) {
      return this.#demoLookup(invoiceNo);
    }
    return this.#request({ action: 'lookup', invoiceNo });
  }

  // CREATE: Add a new invoice manually
  async create(invoice) {
    if (!this.isLive()) {
      return this.#demoCreate(invoice);
    }
    return this.#request({ action: 'create', ...invoice });
  }

  // UPDATE: Update existing invoice details and/or payment
  async update(invoiceData) {
    if (!this.isLive()) {
      return this.#demoUpdate(invoiceData);
    }
    return this.#request({ action: 'update', ...invoiceData });
  }

  // DELETE: Remove invoice
  async delete(invoiceNo) {
    if (!this.isLive()) {
      return this.#demoDelete(invoiceNo);
    }
    return this.#request({ action: 'delete', invoiceNo });
  }

  // BULK LOAD / RESET
  async bulkLoad(invoices, replace = false) {
    const current = replace ? [] : invoiceStore.get();
    const existingMap = new Map(current.map((inv) => [normalise(inv.invoiceNo), inv]));
    for (const inv of invoices) {
      existingMap.set(normalise(inv.invoiceNo), inv);
    }
    const combined = Array.from(existingMap.values());
    invoiceStore.set(combined);
    return combined;
  }

  async resetToExample() {
    return invoiceStore.reset();
  }

  // --- Remote Apps Script request handler ---
  async #request(body) {
    const { endpoint, apiKey } = connectionStore.get();
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ ...body, apiKey }),
      });
      const data = await response.json();
      if (!data.ok) {
        throw new ApiError(data.code || 'REQUEST_FAILED', data.message || 'The request could not be completed.');
      }
      return data.invoice || data.invoices || data;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError('NETWORK_ERROR', 'Unable to contact the Google Sheet. Working with local register.');
    }
  }

  // --- Local in-browser CRUD methods ---
  async #demoList() {
    await sleep(60);
    return invoiceStore.get();
  }

  async #demoLookup(invoiceNo) {
    await sleep(100);
    const invoices = invoiceStore.get();
    const target = normalise(invoiceNo);
    const invoice = invoices.find((entry) => normalise(entry.invoiceNo) === target);
    if (!invoice) {
      throw new ApiError('INVOICE_NOT_FOUND', `No invoice found for "${invoiceNo}". Check manual entry or import.`);
    }
    return structuredClone(invoice);
  }

  async #demoCreate(data) {
    await sleep(150);
    const invoices = invoiceStore.get();
    const invoiceNo = normalise(data.invoiceNo);
    if (!invoiceNo) {
      throw new ApiError('INVALID_INPUT', 'Invoice / Bill number is required.');
    }
    if (invoices.some((item) => normalise(item.invoiceNo) === invoiceNo)) {
      throw new ApiError('DUPLICATE_INVOICE', `Invoice "${invoiceNo}" already exists in the register.`);
    }

    const numAmount = parseFloat(data.amount) || 0;
    if (numAmount < 0) {
      throw new ApiError('INVALID_AMOUNT', 'Amount cannot be negative.');
    }

    const newRecord = {
      invoiceNo: data.invoiceNo.trim().toUpperCase(),
      date: data.date || '15-09-2026',
      drugStore: data.drugStore ? data.drugStore.trim() : 'Unknown Pharmacy',
      rawParty: data.rawParty || data.drugStore || '',
      amount: numAmount.toFixed(2),
      paymentStatus: data.paymentStatus || PAYMENT_STATUS.UNPAID,
      paymentMode: data.paymentMode || '',
      staffName: data.staffName || '',
      staffPhone: data.staffPhone || '',
      updatedTime: data.updatedTime || new Intl.DateTimeFormat('en-IN', {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: 'Asia/Kolkata',
      }).format(new Date()),
      notes: data.notes || '',
    };

    invoices.unshift(newRecord);
    invoiceStore.set(invoices);
    return structuredClone(newRecord);
  }

  async #demoUpdate(data) {
    await sleep(150);
    const invoices = invoiceStore.get();
    const target = normalise(data.invoiceNo);
    const index = invoices.findIndex((entry) => normalise(entry.invoiceNo) === target);
    if (index < 0) {
      throw new ApiError('INVOICE_NOT_FOUND', `Invoice "${data.invoiceNo}" does not exist.`);
    }

    const existing = invoices[index];
    const updatedStatus = data.paymentStatus !== undefined ? data.paymentStatus : existing.paymentStatus;
    const updatedMode = data.paymentMode !== undefined ? data.paymentMode : existing.paymentMode;
    const updatedAmount = data.amount !== undefined ? parseFloat(data.amount).toFixed(2) : existing.amount;
    const updatedStore = data.drugStore !== undefined ? data.drugStore.trim() : existing.drugStore;
    const updatedDate = data.date !== undefined ? data.date : existing.date;
    const updatedNotes = data.notes !== undefined ? data.notes : existing.notes;

    const timeString = new Intl.DateTimeFormat('en-IN', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'Asia/Kolkata',
    }).format(new Date());

    invoices[index] = {
      ...existing,
      drugStore: updatedStore,
      amount: updatedAmount,
      date: updatedDate,
      paymentStatus: updatedStatus,
      paymentMode: updatedStatus === PAYMENT_STATUS.PAID ? (updatedMode || 'UPI') : '',
      staffName: data.staffName || existing.staffName,
      staffPhone: data.staffPhone || existing.staffPhone,
      updatedTime: timeString,
      notes: updatedNotes,
    };

    invoiceStore.set(invoices);
    return structuredClone(invoices[index]);
  }

  async #demoDelete(invoiceNo) {
    await sleep(100);
    const invoices = invoiceStore.get();
    const target = normalise(invoiceNo);
    const filtered = invoices.filter((entry) => normalise(entry.invoiceNo) !== target);
    if (filtered.length === invoices.length) {
      throw new ApiError('INVOICE_NOT_FOUND', `Invoice "${invoiceNo}" not found.`);
    }
    invoiceStore.set(filtered);
    return true;
  }
}

export class ApiError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}
