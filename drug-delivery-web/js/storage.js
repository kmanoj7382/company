import { STORAGE_KEYS, EXAMPLE_XL_ROWS } from './config.js';

const read = (key, fallback) => {
  try {
    const val = localStorage.getItem(key);
    return val !== null ? JSON.parse(val) : fallback;
  } catch {
    return fallback;
  }
};

const write = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.warn('Storage write failed', err);
  }
};

export function initialSeed() {
  return EXAMPLE_XL_ROWS.map((row) => ({
    invoiceNo: row.invoiceNo,
    date: row.date || '15-09-2026',
    drugStore: row.drugStore,
    rawParty: row.rawParty || row.drugStore,
    amount: Number(row.amount).toFixed(2),
    paymentStatus: row.paymentStatus || 'UNPAID',
    paymentMode: row.paymentMode || '',
    staffName: row.staffName || '',
    staffPhone: row.staffPhone || '',
    updatedTime: row.updatedTime || '',
    notes: row.notes || '',
  }));
}

export const staffStore = {
  get: () => read(STORAGE_KEYS.staff, null),
  set: (staff) => write(STORAGE_KEYS.staff, staff),
};

export const connectionStore = {
  get: () => read(STORAGE_KEYS.connection, { endpoint: '', apiKey: '' }),
  set: (connection) => write(STORAGE_KEYS.connection, connection),
};

export const activityStore = {
  get: () => read(STORAGE_KEYS.activity, []),
  add: (entry) => {
    const history = read(STORAGE_KEYS.activity, []);
    write(STORAGE_KEYS.activity, [entry, ...history].slice(0, 30));
  },
  clear: () => localStorage.removeItem(STORAGE_KEYS.activity),
};

export const invoiceStore = {
  get: () => {
    const saved = read(STORAGE_KEYS.invoices, null);
    if (saved && Array.isArray(saved) && saved.length > 0) {
      return saved;
    }
    const seed = initialSeed();
    write(STORAGE_KEYS.invoices, seed);
    return seed;
  },
  set: (invoices) => write(STORAGE_KEYS.invoices, invoices),
  reset: () => {
    const seed = initialSeed();
    write(STORAGE_KEYS.invoices, seed);
    return seed;
  },
};
