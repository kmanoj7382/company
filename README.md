# Atlas Desk — Travel Agency Operations

An advanced single-page travel-agency booking desk. It works immediately in local demo mode and can use a Google Sheet as its shared live database.

## What is included

- Full booking CRUD: create, view, update, and delete booking records.
- Barcode / QR scanning with a device camera where the browser supports `BarcodeDetector`; manual code entry works everywhere.
- Barcode lookup opens the matching booking; unknown codes prefill a new booking reference. Every scan is recorded in the Google Sheet `Scan Log` tab when connected.
- Excel report import for `.xls`, `.xlsx`, and `.csv` using in-browser parsing. It recognises common invoice-style columns such as `BILL NO.`, `DATE`, `PARTY`, and `AMOUNT` and maps them into the travel register for review.
- Business dashboard with revenue, active booking, traveller, and payment-due signals.
- Google Sheets data source through a lightweight Google Apps Script API.

## Your provided report: `REPORT_1 (1).XLS`

The report is an invoice-style MARG ERP report, not a travel manifest:

| Finding | Value |
| --- | --- |
| Worksheet | `MARG ERP AI+ Excel Report` |
| Columns | `BILL NO.`, `DATE`, `PARTY`, `AMOUNT` |
| Records | 44 invoice entries (45 rows including headers) |
| Dates present | 15-09-2026 |

Its data is not used as instructions and is not treated as real travel bookings. The importer can still ingest this form of report: bill number becomes the reference, party becomes traveller, amount becomes booking value, and unmatched travel fields are explicitly marked as imported placeholders.

## Run the site

Open `index.html` in a modern Chromium-based browser, or use a local static server:

```powershell
python -m http.server 8080
```

Then visit `http://localhost:8080`. A local server is recommended for camera permissions; browsers normally require HTTPS or `localhost` for camera access.

## Connect Google Sheets

1. Create a new Google Sheet to hold the agency data.
2. Go to **Extensions → Apps Script**, remove the placeholder code, and paste the complete contents of `google-apps-script.js`.
3. Choose **Deploy → New deployment → Web app**.
4. Set **Execute as** to yourself and allow the people/devices that will use your desk. Copy the deployment URL ending in `/exec`.
5. In Atlas Desk, open **Sheet connection** in the left navigation, paste the URL, and click **Save connection**.
6. Click **Sync data** to read the central Bookings tab. New edits go to the sheet at the moment they are saved.

The script automatically creates and formats `Bookings` and `Scan Log` tabs. Do not change the Bookings header names after connection.

## Important production notes

- The web-app deployment access controls who can reach the Sheet; select the most restrictive setting compatible with your team.
- For a public or larger team deployment, place an authenticated API/proxy in front of Apps Script rather than exposing the endpoint broadly.
- The page stores a local copy as an offline-friendly fallback. Google Sheets becomes the shared source of truth after you connect and sync.
