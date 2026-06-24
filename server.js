
import express from 'express';
import cors from 'cors';
import axios from 'axios';
import ExcelJS from 'exceljs';
import nodemailer from 'nodemailer';
import { google } from 'googleapis';
import { Readable } from 'stream';

const app = express();

// --- Configuration ---
const LINGA_API_KEY = process.env.LINGA_API_KEY || "UiSg7JagVOd42IEwAnctfWS6qSTaKxxr";
const LINGAPOS_BASE_URL = "https://api.lingaros.com"; 
const AXIOS_TIMEOUT = 120000; // Adjusted to 2 mins for Vercel limits

// --- Middleware ---
app.use(cors({
    origin: true, 
    credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// --- Helper Function ---
async function callExternalApi(url, params = {}) {
    const start = Date.now();
    console.log(`[Proxy Request] Range: ${params.fromDate} to ${params.toDate} for ${url}`);
    try {
        const response = await axios.get(url, {
            headers: { 
                'apikey': LINGA_API_KEY,
                'Content-Type': 'application/json',
                'User-Agent': 'LingaPOS-Analytics-Enterprise/3.0'
            },
            params: params,
            timeout: AXIOS_TIMEOUT,
            maxContentLength: Infinity,
            maxBodyLength: Infinity
        });
        const duration = Date.now() - start;
        console.log(`[Proxy Response] OK in ${duration}ms: ${url}`);
        return response;
    } catch (error) {
        const duration = Date.now() - start;
        if (axios.isAxiosError(error)) {
            const status = error.response?.status || 500;
            const msg = error.response?.data?.message || error.message;
            console.error(`[Proxy Error ${status}] after ${duration}ms: ${msg}`);
            const err = new Error(msg);
            // @ts-ignore
            err.status = status;
            // @ts-ignore
            err.data = error.response?.data;
            throw err;
        }
        throw error;
    }
}

// --- API Routes ---

app.get('/api/v1/lingapos/store/:storeId/getsale', async (req, res) => {
    try {
        const { storeId } = req.params;
        const { fromDate, toDate } = req.query;
        const url = `${LINGAPOS_BASE_URL}/v1/lingapos/store/${storeId}/getsale`;
        const response = await callExternalApi(url, { fromDate, toDate });
        res.json(response.data);
    } catch (error) {
        res.status(error.status || 500).json(error.data || { error: error.message });
    }
});

app.get('/api/v1/lingapos/store/:storeId/discountReport', async (req, res) => {
    try {
        const { storeId } = req.params;
        const { dateOption, fromDate, toDate, selectedReportType } = req.query;
        const url = `${LINGAPOS_BASE_URL}/v1/lingapos/store/${storeId}/discountReport`;
        const response = await callExternalApi(url, { dateOption, fromDate, toDate, selectedReportType });
        res.json(response.data);
    } catch (error) {
        res.status(error.status || 500).json(error.data || { error: error.message });
    }
});

app.get('/api/v1/lingapos/store/:storeId/layout', async (req, res) => {
    try {
        const { storeId } = req.params;
        const url = `${LINGAPOS_BASE_URL}/v1/lingapos/store/${storeId}/layout`;
        const response = await callExternalApi(url);
        res.json(response.data);
    } catch (error) {
        res.status(error.status || 500).json(error.data || { error: error.message });
    }
});

app.get('/api/v1/lingapos/store/:storeId/users', async (req, res) => {
    try {
        const { storeId } = req.params;
        const url = `${LINGAPOS_BASE_URL}/v1/lingapos/store/${storeId}/users`;
        const response = await callExternalApi(url);
        res.json(response.data);
    } catch (error) {
        res.status(error.status || 500).json(error.data || { error: error.message });
    }
});

app.get('/api/v1/lingapos/store/:storeId/saleReport', async (req, res) => {
    try {
        const { storeId } = req.params;
        const url = `${LINGAPOS_BASE_URL}/v1/lingapos/store/${storeId}/saleReport`;
        const response = await callExternalApi(url, req.query);
        res.json(response.data);
    } catch (error) {
        res.status(error.status || 500).json(error.data || { error: error.message });
    }
});

app.get('/api/v1/lingapos/store/:storeId/saleSummaryReport', async (req, res) => {
    try {
        const { storeId } = req.params;
        const url = `${LINGAPOS_BASE_URL}/v1/lingapos/store/${storeId}/saleSummaryReport`;
        const response = await callExternalApi(url, req.query);
        res.json(response.data);
    } catch (error) {
        res.status(error.status || 500).json(error.data || { error: error.message });
    }
});

// --- GOOGLE DRIVE & EMAIL COVER TRACKER AUTOMATION ---

const firebaseConfig = {
  apiKey: "AIzaSyBwjH6rQVmBPWzBF88ZZR-JIa-d-8bJb0Q",
  authDomain: "linga-sales-api.firebaseapp.com",
  projectId: "linga-sales-api",
  storageBucket: "linga-sales-api.firebasestorage.app",
  appId: "1:410696735630:web:53c6232262daad169622df"
};

const DEFAULT_STORES = [
  { name: "Common Grounds DIFC", id: "5e4be85b7237b70001de9106" },
  { name: "Common Grounds DMCC", id: "5e4be880716db00001c7b6f1" },
  { name: "Common Grounds MOE", id: "5e4be8da7237b70001de914d" },
  { name: "Tom and Serg", id: "5e4be9307237b70001de9193" },
  { name: "The Sum of Us", id: "5e4be949e8ce4c00019fe377" }
];

async function getActiveStores() {
  try {
    const { initializeApp } = await import('firebase/app');
    const { getFirestore, collection, getDocs } = await import('firebase/firestore');
    const firebaseApp = initializeApp(firebaseConfig);
    const db = getFirestore(firebaseApp);
    const snapshot = await getDocs(collection(db, 'stores'));
    if (snapshot.empty) return DEFAULT_STORES;
    const stores = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      stores.push({ id: data.id, name: data.name });
    });
    return stores;
  } catch (err) {
    console.error("Failed to fetch stores from Firestore on backend, using fallback:", err);
    return DEFAULT_STORES;
  }
}

async function getAutomationSettingsBackend() {
  try {
    const { initializeApp } = await import('firebase/app');
    const { getFirestore, doc, getDoc } = await import('firebase/firestore');
    const firebaseApp = initializeApp(firebaseConfig);
    const db = getFirestore(firebaseApp);
    const docRef = doc(db, 'configs', 'cover_tracker_automation');
    const snapshot = await getDoc(docRef);
    if (snapshot.exists()) {
      return snapshot.data();
    }
    return { enabled: true, fetchTime: "08:00" };
  } catch (err) {
    console.error("Failed to fetch automation settings from Firestore, using default:", err);
    return { enabled: true, fetchTime: "08:00" };
  }
}

async function fetchStoreTrendSummaryBackend(storeId, dates) {
  const results = {};

  const formatDateString = (d) => {
    const day = String(d.getDate()).padStart(2, '0');
    const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
    return `${day}-${months[d.getMonth()]}-${d.getFullYear()}`;
  };

  const formatDateParam = (d) => {
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
  };

  const parseFloatVal = (val) => {
    if (typeof val === 'number') return val;
    if (!val) return 0;
    const clean = String(val).replace(/[$,\s]/g, '');
    const num = parseFloat(clean);
    return isNaN(num) ? 0 : num;
  };

  await Promise.all(
    dates.map(async (date) => {
      const formatted = formatDateParam(date);
      const dateKey = formatDateString(date);

      try {
        const salesUrl = `${LINGAPOS_BASE_URL}/v1/lingapos/store/${storeId}/getsale`;
        const summaryUrl = `${LINGAPOS_BASE_URL}/v1/lingapos/store/${storeId}/saleSummaryReport`;

        const [salesRes, summaryRes] = await Promise.all([
          callExternalApi(salesUrl, { fromDate: formatted, toDate: formatted }),
          callExternalApi(summaryUrl, { dateOption: 'DR', fromDate: formatted, toDate: formatted })
        ]);

        const salesData = salesRes.data;
        const summaryData = summaryRes.data;

        let dailyCovers = 0;
        let dailyNet = 0;

        if (salesData?.sales) {
          salesData.sales.forEach((sale) => {
            const summary = Array.isArray(summaryData) ? summaryData.find((s) => s.id === sale.id) : null;
            const netSales = parseFloatVal(summary?.netSales || sale.netSalesStr);
            const discounts = parseFloatVal(summary?.discounts || 0);

            if (netSales > 0 || discounts > 0) {
              dailyCovers += sale.guestCount || 0;
              dailyNet += netSales;
            }
          });
        }

        results[dateKey] = { covers: dailyCovers, netSales: dailyNet };
      } catch (e) {
        console.error(`Backend Trend fetch failed for store ${storeId} date ${formatted}:`, e.message);
        results[dateKey] = { covers: 0, netSales: 0 };
      }
    })
  );

  return results;
}

async function generateExcelBuffer(trendData, totals, selectedDate, anchorDates) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Covers Analysis');
  worksheet.views = [{ showGridLines: true }];

  worksheet.columns = [
    { header: 'Venue Name', key: 'venue', width: 32 },
    { header: 'Selected Day', key: 'thisWk', width: 16 },
    { header: 'Last Week', key: 'lastWk', width: 16 },
    { header: 'Last Month', key: 'lastMth', width: 16 },
    { header: 'Last Year', key: 'lastYr', width: 16 },
    { header: 'Var LW', key: 'varLw', width: 14 },
    { header: 'Var LM', key: 'varLm', width: 14 },
    { header: 'Var LY', key: 'varLy', width: 14 },
  ];

  const formatDate = (d) => {
    const dateObj = new Date(d);
    return `${String(dateObj.getDate()).padStart(2, '0')}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getFullYear()).slice(-2)}`;
  };

  worksheet.addRow([]);
  const titleRow = worksheet.addRow(['Daily Covers Tracker']);
  titleRow.getCell(1).font = { name: 'Arial', size: 16, bold: true, color: { argb: 'FF0F172A' } };
  
  const dateRow = worksheet.addRow([`Report Date: ${selectedDate}`]);
  dateRow.getCell(1).font = { name: 'Arial', size: 11, italic: true, color: { argb: 'FF475569' } };
  worksheet.addRow([]);

  worksheet.addRow([
    'Venue Name',
    'Selected Day',
    'Last Week',
    'Last Month',
    'Last Year',
    'Var LW',
    'Var LM',
    'Var LY'
  ]);
  worksheet.addRow([
    '',
    formatDate(anchorDates[0]),
    formatDate(anchorDates[1]),
    formatDate(anchorDates[2]),
    formatDate(anchorDates[3]),
    '',
    '',
    ''
  ]);

  worksheet.mergeCells('A5:A6');
  worksheet.mergeCells('F5:F6');
  worksheet.mergeCells('G5:G6');
  worksheet.mergeCells('H5:H6');

  const headerCells = [
    'A5', 'B5', 'C5', 'D5', 'E5', 'F5', 'G5', 'H5',
    'B6', 'C6', 'D6', 'E6'
  ];

  headerCells.forEach(cellRef => {
    const cell = worksheet.getCell(cellRef);
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1E293B' }
    };
    cell.font = {
      name: 'Arial',
      size: 10,
      bold: true,
      color: { argb: 'FFFFFFFF' }
    };
    cell.alignment = {
      horizontal: 'center',
      vertical: 'middle',
      wrapText: true
    };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF475569' } },
      bottom: { style: 'thin', color: { argb: 'FF475569' } },
      left: { style: 'thin', color: { argb: 'FF475569' } },
      right: { style: 'thin', color: { argb: 'FF475569' } }
    };
  });

  worksheet.getRow(5).height = 24;
  worksheet.getRow(6).height = 20;

  const totalRow = worksheet.addRow([
    'Company Total',
    totals.thisWk,
    totals.lastWk,
    totals.lastMth,
    totals.lastYr,
    totals.thisWk - totals.lastWk,
    totals.thisWk - totals.lastMth,
    totals.thisWk - totals.lastYr
  ]);

  for (let col = 1; col <= 8; col++) {
    const cell = totalRow.getCell(col);
    cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF0F172A' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF1F5F9' }
    };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      bottom: { style: 'double', color: { argb: 'FF0F172A' } },
      left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
    };
    if (col > 1) {
      cell.alignment = { horizontal: 'right', vertical: 'middle' };
      if (col <= 5) {
        cell.numFmt = '#,##0';
      }
    } else {
      cell.alignment = { horizontal: 'left', vertical: 'middle' };
    }
  }

  for (let col = 6; col <= 8; col++) {
    const cell = totalRow.getCell(col);
    const val = cell.value;
    cell.numFmt = '+#,##0;-#,##0;0';
    if (val > 0) {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } };
      cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF065F46' } };
    } else if (val < 0) {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
      cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF991B1B' } };
    }
  }

  trendData.forEach((row) => {
    const rowData = [
      row.storeName,
      row.thisWk,
      row.lastWk,
      row.lastMth,
      row.lastYr,
      row.thisWk - row.lastWk,
      row.thisWk - row.lastMth,
      row.thisWk - row.lastYr
    ];
    const dataRow = worksheet.addRow(rowData);
    dataRow.height = 20;

    for (let col = 1; col <= 8; col++) {
      const cell = dataRow.getCell(col);
      cell.font = { name: 'Arial', size: 10, color: { argb: 'FF334155' } };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
      };

      if (col > 1) {
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
        if (col <= 5) {
          cell.numFmt = '#,##0';
        }
      } else {
        cell.alignment = { horizontal: 'left', vertical: 'middle' };
        cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF0F172A' } };
      }
    }

    for (let col = 6; col <= 8; col++) {
      const cell = dataRow.getCell(col);
      const val = cell.value;
      cell.numFmt = '+#,##0;-#,##0;0';
      if (val > 0) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } };
        cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF065F46' } };
      } else if (val < 0) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
        cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF991B1B' } };
      }
    }
  });

  return await workbook.xlsx.writeBuffer();
}

async function generateSalesExcelBuffer(trendData, totals, selectedDate, anchorDates) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Sales Analysis');
  worksheet.views = [{ showGridLines: true }];

  worksheet.columns = [
    { header: 'Venue Name', key: 'venue', width: 32 },
    { header: 'Selected Day', key: 'thisWk', width: 18 },
    { header: 'Last Week', key: 'lastWk', width: 18 },
    { header: 'Last Month', key: 'lastMth', width: 18 },
    { header: 'Last Year', key: 'lastYr', width: 18 },
    { header: 'Var LW', key: 'varLw', width: 16 },
    { header: 'Var LM', key: 'varLm', width: 16 },
    { header: 'Var LY', key: 'varLy', width: 16 },
  ];

  const formatDate = (d) => {
    const dateObj = new Date(d);
    return `${String(dateObj.getDate()).padStart(2, '0')}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getFullYear()).slice(-2)}`;
  };

  worksheet.addRow([]);
  const titleRow = worksheet.addRow(['Daily Sales Tracker']);
  titleRow.getCell(1).font = { name: 'Arial', size: 16, bold: true, color: { argb: 'FF0F172A' } };
  
  const dateRow = worksheet.addRow([`Report Date: ${selectedDate}`]);
  dateRow.getCell(1).font = { name: 'Arial', size: 11, italic: true, color: { argb: 'FF475569' } };
  worksheet.addRow([]);

  worksheet.addRow([
    'Venue Name',
    'Selected Day',
    'Last Week',
    'Last Month',
    'Last Year',
    'Var LW',
    'Var LM',
    'Var LY'
  ]);
  worksheet.addRow([
    '',
    formatDate(anchorDates[0]),
    formatDate(anchorDates[1]),
    formatDate(anchorDates[2]),
    formatDate(anchorDates[3]),
    '',
    '',
    ''
  ]);

  worksheet.mergeCells('A5:A6');
  worksheet.mergeCells('F5:F6');
  worksheet.mergeCells('G5:G6');
  worksheet.mergeCells('H5:H6');

  const headerCells = [
    'A5', 'B5', 'C5', 'D5', 'E5', 'F5', 'G5', 'H5',
    'B6', 'C6', 'D6', 'E6'
  ];

  headerCells.forEach(cellRef => {
    const cell = worksheet.getCell(cellRef);
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1E293B' }
    };
    cell.font = {
      name: 'Arial',
      size: 10,
      bold: true,
      color: { argb: 'FFFFFFFF' }
    };
    cell.alignment = {
      horizontal: 'center',
      vertical: 'middle',
      wrapText: true
    };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF475569' } },
      bottom: { style: 'thin', color: { argb: 'FF475569' } },
      left: { style: 'thin', color: { argb: 'FF475569' } },
      right: { style: 'thin', color: { argb: 'FF475569' } }
    };
  });

  worksheet.getRow(5).height = 24;
  worksheet.getRow(6).height = 20;

  const totalRow = worksheet.addRow([
    'Company Total',
    totals.thisWk,
    totals.lastWk,
    totals.lastMth,
    totals.lastYr,
    totals.thisWk - totals.lastWk,
    totals.thisWk - totals.lastMth,
    totals.thisWk - totals.lastYr
  ]);

  for (let col = 1; col <= 8; col++) {
    const cell = totalRow.getCell(col);
    cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF0F172A' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF1F5F9' }
    };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      bottom: { style: 'double', color: { argb: 'FF0F172A' } },
      left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
    };
    if (col > 1) {
      cell.alignment = { horizontal: 'right', vertical: 'middle' };
      cell.numFmt = '"AED" #,##0.00';
    } else {
      cell.alignment = { horizontal: 'left', vertical: 'middle' };
    }
  }

  for (let col = 6; col <= 8; col++) {
    const cell = totalRow.getCell(col);
    const val = cell.value;
    cell.numFmt = '+"AED" #,##0.00;-"AED" #,##0.00;"AED" 0.00';
    if (val > 0) {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } };
      cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF065F46' } };
    } else if (val < 0) {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
      cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF991B1B' } };
    }
  }

  trendData.forEach((row) => {
    const rowData = [
      row.storeName,
      row.thisWk,
      row.lastWk,
      row.lastMth,
      row.lastYr,
      row.thisWk - row.lastWk,
      row.thisWk - row.lastMth,
      row.thisWk - row.lastYr
    ];
    const dataRow = worksheet.addRow(rowData);
    dataRow.height = 20;

    for (let col = 1; col <= 8; col++) {
      const cell = dataRow.getCell(col);
      cell.font = { name: 'Arial', size: 10, color: { argb: 'FF334155' } };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
      };

      if (col > 1) {
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
        cell.numFmt = '"AED" #,##0.00';
      } else {
        cell.alignment = { horizontal: 'left', vertical: 'middle' };
        cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF0F172A' } };
      }
    }

    for (let col = 6; col <= 8; col++) {
      const cell = dataRow.getCell(col);
      const val = cell.value;
      cell.numFmt = '+"AED" #,##0.00;-"AED" #,##0.00;"AED" 0.00';
      if (val > 0) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } };
        cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF065F46' } };
      } else if (val < 0) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
        cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF991B1B' } };
      }
    }
  });

  return await workbook.xlsx.writeBuffer();
}

async function getMailerSettingsBackend() {
  try {
    const { initializeApp } = await import('firebase/app');
    const { getFirestore, doc, getDoc } = await import('firebase/firestore');
    const firebaseApp = initializeApp(firebaseConfig);
    const db = getFirestore(firebaseApp);
    const docRef = doc(db, 'configs', 'mailer_settings');
    const snapshot = await getDoc(docRef);
    if (snapshot.exists()) {
      return snapshot.data();
    }
    return null;
  } catch (err) {
    console.error("Failed to fetch mailer settings from Firestore on backend, fallback to env:", err.message);
    return null;
  }
}

async function getOrCreateSubfolder(drive, parentId, folderName) {
  try {
    let query = `mimeType = 'application/vnd.google-apps.folder' and name = '${folderName}' and trashed = false`;
    if (parentId) {
      query += ` and '${parentId}' in parents`;
    }
    const response = await drive.files.list({
      q: query,
      fields: 'files(id, name)',
      spaces: 'drive'
    });

    const files = response.data.files;
    if (files && files.length > 0) {
      return files[0].id;
    }

    const fileMetadata = {
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
      parents: parentId ? [parentId] : []
    };

    const folder = await drive.files.create({
      requestBody: fileMetadata,
      fields: 'id'
    });

    console.log(`Created subfolder '${folderName}' with ID: ${folder.data.id}`);
    return folder.data.id;
  } catch (error) {
    console.error(`Failed to get/create subfolder '${folderName}':`, error);
    throw error;
  }
}

async function uploadToGoogleDrive(fileBuffer, fileName, mailerSettings = null, selectedDate = null) {
  try {
    const authJson = mailerSettings?.googleServiceAccountKey || process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
    const folderId = mailerSettings?.googleDriveFolderId || process.env.GOOGLE_DRIVE_FOLDER_ID;

    if (!authJson) {
      console.warn("GOOGLE_SERVICE_ACCOUNT_KEY is not defined. Skipping Google Drive upload.");
      return null;
    }
    
    let credentials;
    try {
      credentials = JSON.parse(authJson);
    } catch (e) {
      throw new Error("Failed to parse GOOGLE_SERVICE_ACCOUNT_KEY JSON string. Ensure it is valid JSON.");
    }

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/drive.file']
    });

    const drive = google.drive({ version: 'v3', auth });

    let currentParentId = folderId || null;
    if (currentParentId) {
      let dateObj = new Date();
      if (selectedDate) {
        const parsedDate = new Date(selectedDate);
        if (!isNaN(parsedDate.getTime())) {
          dateObj = parsedDate;
        }
      }
      const yearStr = String(dateObj.getFullYear());
      const monthIndex = dateObj.getMonth();
      const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
      const monthStr = `${String(monthIndex + 1).padStart(2, '0')}-${months[monthIndex]}`;

      currentParentId = await getOrCreateSubfolder(drive, currentParentId, yearStr);
      currentParentId = await getOrCreateSubfolder(drive, currentParentId, monthStr);
    }
    
    const fileMetadata = {
      name: fileName,
      parents: currentParentId ? [currentParentId] : []
    };

    const media = {
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      body: Readable.from(Buffer.from(fileBuffer))
    };

    const response = await drive.files.create({
      requestBody: fileMetadata,
      media: media,
      fields: 'id, webViewLink'
    });

    console.log(`Uploaded file to Google Drive. File ID: ${response.data.id}`);
    return response.data;
  } catch (error) {
    console.error("Google Drive Upload Error:", error);
    throw error;
  }
}

async function sendEmailReport(fileBuffer, fileName, selectedDate, mailerSettings = null, reportType = "Covers") {
  const host = mailerSettings?.smtpHost || process.env.SMTP_HOST;
  const port = parseInt(mailerSettings?.smtpPort || process.env.SMTP_PORT || '587');
  const user = mailerSettings?.smtpUser || process.env.SMTP_USER;
  const pass = mailerSettings?.smtpPass || process.env.SMTP_PASS;
  const recipients = mailerSettings?.reportRecipients || process.env.REPORT_RECIPIENTS;

  if (!host || !user || !pass || !recipients) {
    console.warn("SMTP configuration or REPORT_RECIPIENTS is missing. Skipping email send.");
    return false;
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: {
      user,
      pass
    }
  });

  const subjectTemplate = mailerSettings?.emailSubjectTemplate || "{type} Report - {date}";
  const bodyTemplate = mailerSettings?.emailBodyTemplate || "Hello,\n\nPlease find attached the Consolidated {type} Report for {date}.\n\nThis is an automated system message.";

  const typePlaceholder = reportType;
  const datePlaceholder = selectedDate;

  const interpolatedSubject = subjectTemplate
    .replace(/{type}/gi, typePlaceholder)
    .replace(/{date}/gi, datePlaceholder);
  
  const interpolatedBody = bodyTemplate
    .replace(/{type}/gi, typePlaceholder)
    .replace(/{date}/gi, datePlaceholder);

  const mailOptions = {
    from: `"Linga Reports" <${user}>`,
    to: recipients,
    subject: interpolatedSubject,
    text: interpolatedBody,
    attachments: [
      {
        filename: fileName,
        content: fileBuffer
      }
    ]
  };

  const info = await transporter.sendMail(mailOptions);
  console.log("Email sent successfully:", info.messageId);
  return true;
}

async function writeReportLogBackend({ type, reportType, reportDate, status, recipients, driveLink, errorMsg }) {
  try {
    const { initializeApp } = await import('firebase/app');
    const { getFirestore, doc, setDoc } = await import('firebase/firestore');
    const firebaseApp = initializeApp(firebaseConfig);
    const db = getFirestore(firebaseApp);
    
    const id = `${reportType.toLowerCase()}_${type.toLowerCase()}_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const log = {
      id,
      timestamp: new Date().toISOString(),
      type,
      reportType,
      reportDate,
      status,
      recipients: recipients || "",
      driveLink: driveLink || null,
      errorMsg: errorMsg || null
    };

    await setDoc(doc(db, "report_logs", id), log);
    console.log(`[Firestore Log] Recorded ${status} log for ${reportType} run (${type}) on ${reportDate}`);
  } catch (err) {
    console.error("Failed to write report log to Firestore:", err.message);
  }
}

// --- Email and Drive Report Route (Manual UI Trigger) ---
app.post('/api/v1/reports/email-cover-tracker', async (req, res) => {
    try {
        const { selectedDate, trendData, totals } = req.body;
        if (!selectedDate || !trendData || !totals) {
            return res.status(400).json({ error: "Missing required fields: selectedDate, trendData, or totals." });
        }

        const mailerSettings = await getMailerSettingsBackend();

        // Calculate the anchor dates based on selectedDate
        const today = new Date(selectedDate);
        const lastWk = new Date(today);
        lastWk.setDate(today.getDate() - 7);
        const lastMth = new Date(today);
        lastMth.setDate(today.getDate() - 28);
        const lastYr = new Date(today);
        lastYr.setDate(today.getDate() - 364);
        const anchorDates = [today, lastWk, lastMth, lastYr];

        // 1. Generate Excel workbook
        const excelBuffer = await generateExcelBuffer(trendData, totals, selectedDate, anchorDates);
        const fileName = `Consolidated_Cover_Report_${selectedDate}.xlsx`;

        // 2. Upload to Google Drive
        let driveResult = null;
        let driveError = null;
        try {
            driveResult = await uploadToGoogleDrive(excelBuffer, fileName, mailerSettings, selectedDate);
        } catch (err) {
            console.error("[Backend] Google Drive Upload Failed:", err.message);
            driveError = err.message;
        }

        // 3. Email report
        let emailResult = false;
        let emailError = null;
        try {
            emailResult = await sendEmailReport(excelBuffer, fileName, selectedDate, mailerSettings, "Covers");
        } catch (err) {
            console.error("[Backend] Email Send Failed:", err.message);
            emailError = err.message;
        }

        const runStatus = (emailResult || driveResult) ? "SUCCESS" : "FAILED";
        const runRecipients = mailerSettings?.reportRecipients || process.env.REPORT_RECIPIENTS || "";
        const runErrorMsg = (!emailResult && !driveResult) 
          ? `Email error: ${emailError || 'unknown'}, Drive error: ${driveError || 'unknown'}`
          : (emailError || driveError || null);

        await writeReportLogBackend({
            type: "Manual",
            reportType: "Covers",
            reportDate: selectedDate,
            status: runStatus,
            recipients: runRecipients,
            driveLink: driveResult?.webViewLink || null,
            errorMsg: runErrorMsg
        });

        if (!emailResult && !driveResult) {
            return res.status(500).json({
                success: false,
                error: `Failed to process report: Email error: ${emailError || 'unknown'}, Drive error: ${driveError || 'unknown'}`
            });
        }

        res.json({
            success: true,
            driveUploaded: !!driveResult,
            driveLink: driveResult?.webViewLink || null,
            emailSent: emailResult,
            warnings: {
                email: emailError,
                drive: driveError
            }
        });

    } catch (error) {
        console.error("[Backend] Email and upload report error:", error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/v1/reports/email-sales-tracker', async (req, res) => {
    try {
        const { selectedDate, trendData, totals } = req.body;
        if (!selectedDate || !trendData || !totals) {
            return res.status(400).json({ error: "Missing required fields: selectedDate, trendData, or totals." });
        }

        const mailerSettings = await getMailerSettingsBackend();

        const today = new Date(selectedDate);
        const lastWk = new Date(today);
        lastWk.setDate(today.getDate() - 7);
        const lastMth = new Date(today);
        lastMth.setDate(today.getDate() - 28);
        const lastYr = new Date(today);
        lastYr.setDate(today.getDate() - 364);
        const anchorDates = [today, lastWk, lastMth, lastYr];

        // 1. Generate Excel workbook
        const excelBuffer = await generateSalesExcelBuffer(trendData, totals, selectedDate, anchorDates);
        const fileName = `Consolidated_Sales_Report_${selectedDate}.xlsx`;

        // 2. Upload to Google Drive
        let driveResult = null;
        let driveError = null;
        try {
            driveResult = await uploadToGoogleDrive(excelBuffer, fileName, mailerSettings, selectedDate);
        } catch (err) {
            console.error("[Backend] Google Drive Upload Failed:", err.message);
            driveError = err.message;
        }

        // 3. Email report
        let emailResult = false;
        let emailError = null;
        try {
            emailResult = await sendEmailReport(excelBuffer, fileName, selectedDate, mailerSettings, "Sales");
        } catch (err) {
            console.error("[Backend] Sales Email Send Failed:", err.message);
            emailError = err.message;
        }

        const runStatus = (emailResult || driveResult) ? "SUCCESS" : "FAILED";
        const runRecipients = mailerSettings?.reportRecipients || process.env.REPORT_RECIPIENTS || "";
        const runErrorMsg = (!emailResult && !driveResult) 
          ? `Email error: ${emailError || 'unknown'}, Drive error: ${driveError || 'unknown'}`
          : (emailError || driveError || null);

        await writeReportLogBackend({
            type: "Manual",
            reportType: "Sales",
            reportDate: selectedDate,
            status: runStatus,
            recipients: runRecipients,
            driveLink: driveResult?.webViewLink || null,
            errorMsg: runErrorMsg
        });

        if (!emailResult && !driveResult) {
            return res.status(500).json({
                success: false,
                error: `Failed to process report: Email error: ${emailError || 'unknown'}, Drive error: ${driveError || 'unknown'}`
            });
        }

        res.json({
            success: true,
            driveUploaded: !!driveResult,
            driveLink: driveResult?.webViewLink || null,
            emailSent: emailResult,
            warnings: {
                email: emailError,
                drive: driveError
            }
        });

    } catch (error) {
        console.error("[Backend] Email and upload sales report error:", error);
        res.status(500).json({ error: error.message });
    }
});

// --- Scheduled Cron Job Route ---
app.get('/api/v1/cron/daily-cover-tracker', async (req, res) => {
    // 1. Authorization Check
    const authHeader = req.headers.authorization;
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && authHeader !== `Bearer ${cronSecret}` && req.query.secret !== cronSecret) {
        return res.status(401).json({ error: "Unauthorized" });
    }

    try {
        // 2. Fetch automation settings
        const settings = await getAutomationSettingsBackend();
        const mailerSettings = await getMailerSettingsBackend();

        // 3. Check enabled/disabled state
        if (!settings.enabled) {
            console.log("[Cron] Daily automation is disabled in settings.");
            return res.json({ success: true, message: "Daily automation is disabled in settings." });
        }

        // 4. Check hour match (Dubai Time GST / UTC+4)
        const isForced = req.query.force === 'true';
        if (!isForced) {
            const targetHour = parseInt(settings.fetchTime.split(':')[0], 10);
            const dubaiTimeStr = new Date().toLocaleString("en-US", { timeZone: "Asia/Dubai" });
            const dubaiHour = new Date(dubaiTimeStr).getHours();

            if (dubaiHour !== targetHour) {
                console.log(`[Cron] Skipping: Dubai hour is ${dubaiHour}, configured hour is ${targetHour}.`);
                return res.json({
                    success: true,
                    message: `Skipped: current Dubai hour (${dubaiHour}) does not match configured automation hour (${targetHour}).`
                });
            }
        }

        console.log("[Cron] Running scheduled Daily Cover Report generation...");

        // 5. Resolve anchor date (yesterday)
        const today = new Date();
        today.setDate(today.getDate() - 1);
        const selectedDate = today.toISOString().split('T')[0];

        // 3. Calculate 4 anchor dates
        const lastWk = new Date(today);
        lastWk.setDate(today.getDate() - 7);
        const lastMth = new Date(today);
        lastMth.setDate(today.getDate() - 28);
        const lastYr = new Date(today);
        lastYr.setDate(today.getDate() - 364);
        const anchorDates = [today, lastWk, lastMth, lastYr];

        const formatDateString = (d) => {
          const day = String(d.getDate()).padStart(2, '0');
          const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
          return `${day}-${months[d.getMonth()]}-${d.getFullYear()}`;
        };

        // 4. Fetch stores
        const stores = await getActiveStores();

        // 5. Fetch covers for all stores and periods
        const trendData = [];
        const totals = { thisWk: 0, lastWk: 0, lastMth: 0, lastYr: 0 };

        for (let i = 0; i < stores.length; i++) {
            const store = stores[i];
            console.log(`[Cron] Fetching data for ${store.name}...`);
            const summary = await fetchStoreTrendSummaryBackend(store.id, anchorDates);
            
            const storeData = {
                storeId: store.id,
                storeName: store.name,
                thisWk: summary[formatDateString(anchorDates[0])]?.covers || 0,
                lastWk: summary[formatDateString(anchorDates[1])]?.covers || 0,
                lastMth: summary[formatDateString(anchorDates[2])]?.covers || 0,
                lastYr: summary[formatDateString(anchorDates[3])]?.covers || 0,
            };

            trendData.push(storeData);
            totals.thisWk += storeData.thisWk;
            totals.lastWk += storeData.lastWk;
            totals.lastMth += storeData.lastMth;
            totals.lastYr += storeData.lastYr;
        }

        // 6. Generate Excel workbook
        const excelBuffer = await generateExcelBuffer(trendData, totals, selectedDate, anchorDates);
        const fileName = `Consolidated_Cover_Report_${selectedDate}.xlsx`;

        // 7. Upload to Google Drive
        let driveResult = null;
        let driveError = null;
        try {
            driveResult = await uploadToGoogleDrive(excelBuffer, fileName, mailerSettings, selectedDate);
        } catch (err) {
            console.error("[Cron] Google Drive Upload Failed:", err.message);
            driveError = err.message;
        }

        // 8. Email report
        let emailResult = false;
        let emailError = null;
        try {
            emailResult = await sendEmailReport(excelBuffer, fileName, selectedDate, mailerSettings, "Covers");
        } catch (err) {
            console.error("[Cron] Email Send Failed:", err.message);
            emailError = err.message;
        }

        const runStatus = (emailResult || driveResult) ? "SUCCESS" : "FAILED";
        const runRecipients = mailerSettings?.reportRecipients || process.env.REPORT_RECIPIENTS || "";
        const runErrorMsg = (!emailResult && !driveResult) 
          ? `Email error: ${emailError || 'unknown'}, Drive error: ${driveError || 'unknown'}`
          : (emailError || driveError || null);

        await writeReportLogBackend({
            type: "Automated",
            reportType: "Covers",
            reportDate: selectedDate,
            status: runStatus,
            recipients: runRecipients,
            driveLink: driveResult?.webViewLink || null,
            errorMsg: runErrorMsg
        });

        res.json({
            success: true,
            date: selectedDate,
            storesSynced: stores.length,
            driveUploaded: !!driveResult,
            driveLink: driveResult?.webViewLink || null,
            emailSent: emailResult
        });

    } catch (error) {
        console.error("[Cron] Execution error:", error);
        res.status(500).json({ error: error.message });
    }
});

const PORT = process.env.PORT || 3000;
if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, () => {
        console.log(`Backend Active: http://localhost:${PORT}`);
    });
}

export default app;
