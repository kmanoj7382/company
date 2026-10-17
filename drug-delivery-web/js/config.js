export const APP_NAME = 'Anand Delivery Payment Desk';

export const PAYMENT_STATUS = Object.freeze({
  UNPAID: 'UNPAID',
  PAID: 'PAID',
  OUTSTANDING: 'OUTSTANDING',
});

export const PAYMENT_MODE = Object.freeze({
  UPI: 'UPI',
  CASH: 'CASH',
  CHEQUE: 'CHEQUE',
});

export const STORAGE_KEYS = Object.freeze({
  staff: 'anand-web-staff',
  connection: 'anand-web-connection',
  activity: 'anand-web-activity',
  invoices: 'anand-web-invoices-v4',
});

// Original 44 invoice records from MARG ERP Excel report (15-09-2026)
export const EXAMPLE_XL_ROWS = [
  { invoiceNo: 'E24323', date: '15-09-2026', drugStore: 'RAM MEDICAL (LAGGERE2)', rawParty: 'LAGA4       RAM MEDICAL          LAGGERE2', amount: 1741.0 },
  { invoiceNo: 'E24324', date: '15-09-2026', drugStore: 'BHAVANI MED & GEN ST (RAJGOPALNAGAR)', rawParty: 'BHAVANI MED & GEN ST RAJGOPALNA', amount: 849.0 },
  { invoiceNo: 'E24325', date: '15-09-2026', drugStore: 'VISHAL MEDICO (RT NAGAR)', rawParty: 'VISHAL MEDICO   RT N R T NAGAR', amount: 2622.0 },
  { invoiceNo: 'E24326', date: '15-09-2026', drugStore: 'MALLESHWARA PHARMA (LAGGERE)', rawParty: 'MALLESHWARA PHARMA   LAGGERE', amount: 3447.0 },
  { invoiceNo: 'E24327', date: '15-09-2026', drugStore: 'SRI MAHALAKSHMI PHARMA (BAGALUNTE)', rawParty: 'SRI MAHALAKSHMI PHAR BAGALUNTE', amount: 263.0 },
  { invoiceNo: 'E24328', date: '15-09-2026', drugStore: 'CHAITANYA MEDICALS (JALAHALLI)', rawParty: 'JALL3       CHAITANYA MEDICALS   JALAHALLI.', amount: 1843.0 },
  { invoiceNo: 'E24329', date: '15-09-2026', drugStore: 'S.L.N MEDICALS PEENYA (JALAHALLI)', rawParty: 'JALL2       S.L.N MEDICALS PEENY JALAHALLI.', amount: 1528.0 },
  { invoiceNo: 'E24330', date: '15-09-2026', drugStore: 'ASWINI MEDICALS (GORAGUNTEPALYA)', rawParty: 'ASWINI MEDICALS      GORGUNTEPA', amount: 484.0 },
  { invoiceNo: 'E24331', date: '15-09-2026', drugStore: 'SRI MARUTHI MEDICALS (HESARGHATTA)', rawParty: 'HES(2)24    SRI MARUTHI MEDICALS HESARGHATA', amount: 4776.0 },
  { invoiceNo: 'E24332', date: '15-09-2026', drugStore: 'SRINIDHI PHARMA (LAGGERE2)', rawParty: 'LAGA5       SRINIDHI PHARMA  LAG LAGGERE2', amount: 1085.0 },
  { invoiceNo: 'E24333', date: '15-09-2026', drugStore: 'PADMASHRI FANCY T D (T.DASARAHALLI)', rawParty: 'PADMASHRI FANCY T D  T.DASARAHA', amount: 851.0 },
  { invoiceNo: 'E24334', date: '15-09-2026', drugStore: 'SRI MANJUNATH MEDICAL (T.DASARAHALLI)', rawParty: 'SRI MANJUNATH MEDICA T.DASARAHA', amount: 211.0 },
  { invoiceNo: 'E24335', date: '15-09-2026', drugStore: 'SRI MARUTHI MEDICALS (VIDHANA SOUDHA)', rawParty: 'SRI MARUTHI MEDICALS VIDHANSOUD', amount: 1307.0 },
  { invoiceNo: 'E24336', date: '15-09-2026', drugStore: 'PADMAVATHI MEDICALS (NELG 2)', rawParty: 'Padmavathi medicals  NELG 2', amount: 2116.0 },
  { invoiceNo: 'E24337', date: '15-09-2026', drugStore: 'SHANKARA PHARMA (NELG 1)', rawParty: 'NEL         SHANKARA PHARMA      NELG 1', amount: 2234.0 },
  { invoiceNo: 'E24338', date: '15-09-2026', drugStore: 'SHANKARA PHARMA (NELG 1 - 2ND BILL)', rawParty: 'NEL         SHANKARA PHARMA      NELG 1', amount: 425.0 },
  { invoiceNo: 'E24339', date: '15-09-2026', drugStore: 'SRI MEDICAL AND GENERAL (NELG 1)', rawParty: 'SRI MEDICAL AND GENE NELG 1', amount: 1404.0 },
  { invoiceNo: 'E24340', date: '15-09-2026', drugStore: 'SRI MARUTHI MEDICALS (VIDHANA SOUDHA)', rawParty: 'SRI MARUTHI MEDICALS VIDHANSOUD', amount: 2342.0 },
  { invoiceNo: 'E24341', date: '15-09-2026', drugStore: 'MAHAVEER MEDICALS & GS (HESARGHATTA)', rawParty: 'HES(2)28    MAHAVEER MEDICALS&GS HESARGHATA', amount: 6108.0 },
  { invoiceNo: 'E24342', date: '15-09-2026', drugStore: 'MAHAVEER MEDICALS & GS (HESARGHATTA)', rawParty: 'HES(2)28    MAHAVEER MEDICALS&GS HESARGHATA', amount: 341.0 },
  { invoiceNo: 'E24343', date: '15-09-2026', drugStore: 'MR MEDICAL & GEN STORES (VIDHANA SOUDHA)', rawParty: '1156        MR MEDICAL & GEN STO VIDHANSOUD', amount: 1435.0 },
  { invoiceNo: 'E24344', date: '15-09-2026', drugStore: 'SRI LAKSHMIRANGANATHA (ANDRAHALLI)', rawParty: 'SRI LAKSHMIRANGANATH ANDRAHALLI', amount: 6807.0 },
  { invoiceNo: 'E24345', date: '15-09-2026', drugStore: 'SRI LAKSHMIRANGANATHA (ANDRAHALLI)', rawParty: 'SRI LAKSHMIRANGANATH ANDRAHALLI', amount: 1683.0 },
  { invoiceNo: 'E24346', date: '15-09-2026', drugStore: 'SRI LAKSHMIRANGANATHA (ANDRAHALLI)', rawParty: 'SRI LAKSHMIRANGANATH ANDRAHALLI', amount: 1142.0 },
  { invoiceNo: 'E24347', date: '15-09-2026', drugStore: 'SRI LAKSHMIRANGANATHA (ANDRAHALLI)', rawParty: 'SRI LAKSHMIRANGANATH ANDRAHALLI', amount: 1160.0 },
  { invoiceNo: 'E24348', date: '15-09-2026', drugStore: 'NANDANAM PHARMA (ANDRAHALLI)', rawParty: 'NANDANAM PHARMA      ANDRAHALLI', amount: 6795.0 },
  { invoiceNo: 'E24349', date: '15-09-2026', drugStore: 'KRISHNA MEDICALS (VIJAYANAGAR 2)', rawParty: 'KRISHNA MEDICALS     VIJAY 2', amount: 545.0 },
  { invoiceNo: 'E24350', date: '15-09-2026', drugStore: 'LIFE CARE PHARMA (BAGALUNTE)', rawParty: 'MATH22      LIFE CARE PHARMA     BAGALUNTE', amount: 1164.0 },
  { invoiceNo: 'E24351', date: '15-09-2026', drugStore: 'SRI MARUTHI MEDICAL (NELG 1)', rawParty: 'NELA13      SRI MARUTHI MEDICAL  NELG 1', amount: 2152.0 },
  { invoiceNo: 'E24352', date: '15-09-2026', drugStore: 'SRI MANJUNATHA MED & GS (HESARGHATTA)', rawParty: 'HESSB3      SRI MANJUNATHA MED & HESARGHATA', amount: 404.0 },
  { invoiceNo: 'E24353', date: '15-09-2026', drugStore: 'ROYAL WHOLESALE MART (ANDRAHALLI)', rawParty: 'ROYAL WHOLESALE MART ANDRAHALLI', amount: 2589.0 },
  { invoiceNo: 'E24354', date: '15-09-2026', drugStore: 'SRI MAHALAKSHMI PHARMA (BAGALUNTE)', rawParty: 'SRI MAHALAKSHMI PHAR BAGALUNTE', amount: 1349.0 },
  { invoiceNo: 'E24355', date: '15-09-2026', drugStore: 'SRI MAHALAKSHMI PHARMA (BAGALUNTE)', rawParty: 'SRI MAHALAKSHMI PHAR BAGALUNTE', amount: 339.0 },
  { invoiceNo: 'E24356', date: '15-09-2026', drugStore: 'KRISHNA MEDICALS (VIJAYANAGAR 2)', rawParty: 'KRISHNA MEDICALS     VIJAY 2', amount: 4517.0 },
  { invoiceNo: 'E24357', date: '15-09-2026', drugStore: 'SLR MEDICALS STORES (MADANAYAKANAHALLI)', rawParty: 'SLR MEDICALS STORES  MADANAYAKA', amount: 1404.0 },
  { invoiceNo: 'E24358', date: '15-09-2026', drugStore: 'RAJATH MEDICALS (ANDRAHALLI)', rawParty: 'RAJATH MEDICALS      ANDRAHALLI', amount: 3546.0 },
  { invoiceNo: 'E24359', date: '15-09-2026', drugStore: 'NAVIK MEDICALS (HESARGHATTA)', rawParty: 'HESSB4      NAVIK MEDICALS       HESARGHATA', amount: 1031.0 },
  { invoiceNo: 'E24360', date: '15-09-2026', drugStore: 'MALLESHWARA PHARMA (LAGGERE)', rawParty: 'MALLESHWARA PHARMA   LAGGERE', amount: 673.0 },
  { invoiceNo: 'E24361', date: '15-09-2026', drugStore: 'NAVIK MEDICALS (HESARGHATTA)', rawParty: 'HESSB4      NAVIK MEDICALS       HESARGHATA', amount: 1789.0 },
  { invoiceNo: 'E24362', date: '15-09-2026', drugStore: 'NAVIK MEDICALS (HESARGHATTA)', rawParty: 'HESSB4      NAVIK MEDICALS       HESARGHATA', amount: 180.0 },
  { invoiceNo: 'E24363', date: '15-09-2026', drugStore: 'SRI BALAJI MEDICALS & GS (BAGALUNTE)', rawParty: 'BAG30       SRI BALAJI MEDICALS& BAGALUNTE', amount: 1112.0 },
  { invoiceNo: 'E24364', date: '15-09-2026', drugStore: 'SRI BALAJI MEDICALS & GS (BAGALUNTE)', rawParty: 'BAG30       SRI BALAJI MEDICALS& BAGALUNTE', amount: 597.0 },
  { invoiceNo: 'E24365', date: '15-09-2026', drugStore: 'SRI MARUTHI MEDICALS (HESARGHATTA)', rawParty: 'HES(2)24    SRI MARUTHI MEDICALS HESARGHATA', amount: 324.0 },
  { invoiceNo: 'E24366', date: '15-09-2026', drugStore: 'RAM MEDICAL 2 (MADANAYAKANAHALLI)', rawParty: 'RAM MEDICAL 2        MADANAYAKA', amount: 1930.0 },
];
