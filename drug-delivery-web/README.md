# Anand Delivery — Payment Desk & Pharma Register

A full-featured pharmaceutical distribution desk with live barcode scanner, manual invoice entry, complete CRUD operations, KPI dashboard, and Excel/CSV data interchange.

---

## 📊 Dataset Analysis: `MARG ERP AI+ Excel Report`

The report provided in `REPORT_1.XLS` / `media_1792249247025_c4891f04.xls` represents a live delivery run across Bengaluru:

| Metric | Value |
| :--- | :--- |
| **Total Invoices** | **44 delivery bills** (`E24323` to `E24366`) |
| **Total Manifest Value** | **₹ 80,644.00** |
| **Manifest Date** | **15-09-2026** |
| **Primary Route Clusters** | Laggere, Rajgopalnagar, RT Nagar, Jalahalli, Peenya, Goraguntepalya, Hesarghatta, T. Dasarahalli, Vidhana Soudha, Nelamangala, Andrahalli, Vijayanagar, Madanayanakanahalli |
| **Highest Value Invoices** | `E24344` (₹6,807.00), `E24348` (₹6,795.00), `E24341` (₹6,108.00) |

---

## 🛠️ Implemented Features

### 1. Manual Entry & CRUD Operations
- **Create (Manual Entry)**:
  - Click **Manual Entry** or **+ New Invoice** to add a new delivery bill.
  - Automatically suggests the next sequential bill number (e.g. `E24367`).
  - Supports Bill Number, Date, Drug Store / Party Name, Amount (₹), Initial Status, Payment Mode, and Notes.
- **Read**:
  - Live search bar by Bill Number, Drug Store, or Delivery Area (e.g., *Laggere*, *Peenya*, *E24323*).
  - Status filters: `All (44)`, `Unpaid (44)`, `Paid (0)`, `Outstanding (0)`.
  - Column sorting on all fields (Bill No., Date, Store Name, Amount, Status).
  - Quick lookup box with one-click test pills (`E24323`, `E24344`, etc.).
- **Update**:
  - Fast Payment update: **Payment Received** with mode selection (UPI, Cash, Cheque) or **Payment Not Received** (Outstanding).
  - Detailed **Edit Invoice** modal to modify Pharmacy name, Amount, Date, Status, or remarks.
  - Automatic operator timestamp stamping.
- **Delete**:
  - Delete invoice with safety confirmation dialog.

### 2. Example XL Data Explorer
- One-click modal displaying the exact 44 rows from the original `MARG ERP` Excel sheet.
- **Load / Reset to Example XL**: Instantly reload or reset the live delivery register with the 44 records.
- **Download Excel (.xlsx)**: Generates and downloads a real Excel file using SheetJS (`xlsx.full.min.js`).
- **Download CSV**: Generates standard CSV export.
- **Import Excel / CSV**: Ingest custom Excel files and merge or replace the register.

### 3. Barcode & Package Scanner
- Live camera barcode scanning using `Html5Qrcode`.
- Image file barcode scanning.
- Manual barcode code entry fallback.

---

## 🚀 Running the Project

The server is running on port **3000**:

```powershell
python -m http.server 3000 --bind 127.0.0.1
```

Visit in your browser:
- [http://localhost:3000/](http://localhost:3000/) (auto-redirects to the payment desk)
- [http://localhost:3000/drug-delivery-web/](http://localhost:3000/drug-delivery-web/)
