
import express from 'express';
import cors from 'cors';
import axios from 'axios';
import ExcelJS from 'exceljs';
import nodemailer from 'nodemailer';
import { google } from 'googleapis';
import { Readable } from 'stream';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, doc, getDoc, setDoc, collection, getDocs } from 'firebase/firestore';

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

function parseStringToDate(str) {
    if (!str.includes('-')) return new Date(str);
    const parts = str.split('-');
    if (parts[0].length === 4) {
        // YYYY-MM-DD
        return new Date(str);
    }
    // DD-MMM-YYYY
    const day = parseInt(parts[0], 10);
    const monthStr = parts[1].toUpperCase();
    const year = parseInt(parts[2], 10);
    const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
    const monthIndex = months.indexOf(monthStr);
    return new Date(year, monthIndex, day);
}

function formatToLingaDate(dateStr) {
    if (!dateStr.includes('-')) return dateStr;
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    const year = parts[0];
    const monthIndex = parseInt(parts[1], 10) - 1;
    const day = parts[2];
    const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
    return `${day}-${months[monthIndex]}-${year}`;
}

function getDatesInRange(fromDateStr, toDateStr) {
    const dates = [];
    let current = parseStringToDate(fromDateStr);
    const end = parseStringToDate(toDateStr);
    while (current <= end) {
        const yyyy = current.getFullYear();
        const mm = String(current.getMonth() + 1).padStart(2, "0");
        const dd = String(current.getDate()).padStart(2, "0");
        dates.push(`${yyyy}-${mm}-${dd}`);
        current.setDate(current.getDate() + 1);
    }
    return dates;
}

function pruneSalesData(data) {
    if (!data || !data.sales) return data;
    const prunedSales = data.sales.map(sale => {
        const prunedPayments = sale.payments ? sale.payments.map(p => ({
            paymentMethod: p.paymentMethod || "Other",
            paymentType: p.paymentType || "Other",
            authorizedAmountStr: p.authorizedAmountStr || "0.00",
            paymentTipStr: p.paymentTipStr || "0.00"
        })) : [];

        const prunedOrders = sale.orders ? sale.orders.map(o => ({
            departmentName: o.departmentName || "",
            categoryName: o.categoryName || "",
            subCategoryName: o.subCategoryName || "",
            quantity: o.quantity || 0,
            menuName: o.menuName || "",
            grossAmountStr: o.grossAmountStr || "0.00",
            totalGrossAmountStr: o.totalGrossAmountStr || "0.00",
            totalDiscountAmountStr: o.totalDiscountAmountStr || "0.00",
            isVoid: o.isVoid || "false",
            voidError: o.voidError || "",
            voidByEmployee: o.voidByEmployee || "",
            orderHour: o.orderHour || "00",
            orderMin: o.orderMin || "00"
        })) : [];

        return {
            id: sale.id,
            ticketNo: sale.ticketNo || "",
            startDate: sale.startDate || "",
            saleOpenTime: sale.saleOpenTime || "",
            customerName: sale.customerName || "",
            tableNo: sale.tableNo || "",
            floorId: sale.floorId || "",
            employee: sale.employee || "",
            saleCloseEmployee: sale.saleCloseEmployee || "",
            guestCount: sale.guestCount || 0,
            netSalesStr: sale.netSalesStr || sale.netSalesStrStr || "0.00",
            grossAmountStr: sale.grossAmountStr || "0.00",
            totalTaxAmountStr: sale.totalTaxAmountStr || "0.00",
            grossReceiptStr: sale.grossReceiptStr || "0.00",
            payments: prunedPayments,
            orders: prunedOrders
        };
    });

    return {
        ...data,
        sales: prunedSales
    };
}

function pruneDiscountData(data) {
    if (!Array.isArray(data)) return data;
    return data.map(d => ({
        id: d.id || "",
        check: d.check || "",
        approvedBy: d.approvedBy || "",
        date: d.date || "",
        discountAmtStr: d.discountAmtStr || "0.00",
        discountAppliedBy: d.discountAppliedBy || "",
        discountCoupon: d.discountCoupon || "",
        discountName: d.discountName || "",
        discountType: d.discountType || "",
        grossSalesStr: d.grossSalesStr || "0.00",
        isTotal: !!d.isTotal,
        menuItems: d.menuItems || "",
        percent: d.percent || "0.00",
        quantity: d.quantity || 0,
        reason: d.reason || "",
        totalDiscounts: d.totalDiscounts || "0.00"
    }));
}

function pruneSaleReportData(data) {
    if (!data || !data.data) return data;
    const pruned = data.data.map(m => ({
        id: m.id || "",
        menuName: m.menuName || "",
        quantity: m.quantity || 0,
        totalGrossAmountStr: m.totalGrossAmountStr || "0.00"
    }));
    return { ...data, data: pruned };
}

function pruneSummaryData(data) {
    if (!Array.isArray(data)) return data;
    return data.map(s => ({
        id: s.id || "",
        netSales: s.netSales || "0.00",
        discounts: s.discounts || "0.00",
        totalTaxAmount: s.totalTaxAmount || "0.00",
        saleOpenDate: s.saleOpenDate || "",
        floorNo: s.floorNo || "",
        tableNo: s.tableNo || ""
    }));
}

async function getCachedOrFetchDaily(storeId, fromDateStr, toDateStr, collectionName, fetchFn, combineFn, pruneFn) {
    const dates = getDatesInRange(fromDateStr, toDateStr);
    const results = [];
    
    for (const date of dates) {
        const docId = `${storeId}_${date}`;
        const docRef = doc(db, collectionName, docId);
        try {
            const snap = await getDoc(docRef);
            if (snap.exists()) {
                console.log(`[Cache Hit] ${collectionName} for ${storeId} on ${date}`);
                results.push(snap.data().data);
            } else {
                console.log(`[Cache Miss] Fetching ${collectionName} for ${storeId} on ${date} from LINGAPOS...`);
                // Fetch for this single day
                const apiData = await fetchFn(date);
                // Prune the data
                const prunedData = pruneFn ? pruneFn(apiData) : apiData;
                // Save to Firestore
                await setDoc(docRef, {
                    storeId,
                    date,
                    data: prunedData,
                    createdAt: new Date().toISOString()
                });
                results.push(prunedData);
            }
        } catch (err) {
            console.error(`[Cache Error] Failed for ${collectionName} doc ${docId}:`, err.message);
            // Bypassing cache on error to ensure user gets data anyway
            const apiData = await fetchFn(date);
            const prunedData = pruneFn ? pruneFn(apiData) : apiData;
            results.push(prunedData);
        }
    }
    
    return combineFn(results);
}

// --- API Routes ---

app.get('/api/v1/lingapos/store/:storeId/getsale', async (req, res) => {
    try {
        const { storeId } = req.params;
        const { fromDate, toDate } = req.query;
        if (!fromDate || !toDate) {
            return res.status(400).json({ error: "fromDate and toDate are required query params." });
        }
        
        const combinedData = await getCachedOrFetchDaily(
            storeId,
            fromDate,
            toDate,
            'sales_cache',
            async (date) => {
                const url = `${LINGAPOS_BASE_URL}/v1/lingapos/store/${storeId}/getsale`;
                const response = await callExternalApi(url, { fromDate: formatToLingaDate(date), toDate: formatToLingaDate(date) });
                return response.data;
            },
            (dailyResults) => {
                const combinedSales = [];
                dailyResults.forEach(r => {
                    if (r && r.sales) {
                        combinedSales.push(...r.sales);
                    }
                });
                return { sales: combinedSales };
            },
            pruneSalesData
        );
        res.json(combinedData);
    } catch (error) {
        res.status(error.status || 500).json(error.data || { error: error.message });
    }
});

app.get('/api/v1/lingapos/store/:storeId/discountReport', async (req, res) => {
    try {
        const { storeId } = req.params;
        const { fromDate, toDate, selectedReportType } = req.query;
        if (!fromDate || !toDate) {
            return res.status(400).json({ error: "fromDate and toDate are required query params." });
        }
        
        const combinedData = await getCachedOrFetchDaily(
            storeId,
            fromDate,
            toDate,
            'discounts_cache',
            async (date) => {
                const url = `${LINGAPOS_BASE_URL}/v1/lingapos/store/${storeId}/discountReport`;
                const response = await callExternalApi(url, { 
                    dateOption: 'DR', 
                    fromDate: formatToLingaDate(date), 
                    toDate: formatToLingaDate(date), 
                    selectedReportType: selectedReportType || 'By Discount Type' 
                });
                return response.data;
            },
            (dailyResults) => {
                const combinedDiscounts = [];
                dailyResults.forEach(r => {
                    if (Array.isArray(r)) {
                        combinedDiscounts.push(...r);
                    }
                });
                return combinedDiscounts;
            },
            pruneDiscountData
        );
        res.json(combinedData);
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
        const { fromDate, toDate } = req.query;
        if (!fromDate || !toDate) {
            return res.status(400).json({ error: "fromDate and toDate are required query params." });
        }
        
        const combinedData = await getCachedOrFetchDaily(
            storeId,
            fromDate,
            toDate,
            'sale_reports_cache',
            async (date) => {
                const url = `${LINGAPOS_BASE_URL}/v1/lingapos/store/${storeId}/saleReport`;
                const queryParams = { ...req.query, fromDate: formatToLingaDate(date), toDate: formatToLingaDate(date) };
                const response = await callExternalApi(url, queryParams);
                return response.data;
            },
            (dailyResults) => {
                const combinedMenuData = [];
                dailyResults.forEach(r => {
                    if (r && r.data) {
                        combinedMenuData.push(...r.data);
                    }
                });
                return { data: combinedMenuData };
            },
            pruneSaleReportData
        );
        res.json(combinedData);
    } catch (error) {
        res.status(error.status || 500).json(error.data || { error: error.message });
    }
});

app.get('/api/v1/lingapos/store/:storeId/saleSummaryReport', async (req, res) => {
    try {
        const { storeId } = req.params;
        const { fromDate, toDate } = req.query;
        if (!fromDate || !toDate) {
            return res.status(400).json({ error: "fromDate and toDate are required query params." });
        }
        
        const combinedData = await getCachedOrFetchDaily(
            storeId,
            fromDate,
            toDate,
            'sale_summaries_cache',
            async (date) => {
                const url = `${LINGAPOS_BASE_URL}/v1/lingapos/store/${storeId}/saleSummaryReport`;
                const queryParams = { ...req.query, fromDate: formatToLingaDate(date), toDate: formatToLingaDate(date) };
                const response = await callExternalApi(url, queryParams);
                return response.data;
            },
            (dailyResults) => {
                const combinedSummary = [];
                dailyResults.forEach(r => {
                    if (Array.isArray(r)) {
                        combinedSummary.push(...r);
                    }
                });
                return combinedSummary;
            },
            pruneSummaryData
        );
        res.json(combinedData);
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

const firebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(firebaseApp);

const DEFAULT_STORES = [
  { name: "Common Grounds DIFC", id: "5e4be85b7237b70001de9106" },
  { name: "Common Grounds DMCC", id: "5e4be880716db00001c7b6f1" },
  { name: "Common Grounds MOE", id: "5e4be8da7237b70001de914d" },
  { name: "Tom and Serg", id: "5e4be9307237b70001de9193" },
  { name: "The Sum of Us", id: "5e4be949e8ce4c00019fe377" }
];

async function getActiveStores() {
  try {
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

      // YYYY-MM-DD for Cache doc key
      const yyyy = date.getFullYear();
      const mm = String(date.getMonth() + 1).padStart(2, "0");
      const dd = String(date.getDate()).padStart(2, "0");
      const dateStrIso = `${yyyy}-${mm}-${dd}`;

      try {
        const salesDocRef = doc(db, 'sales_cache', `${storeId}_${dateStrIso}`);
        const summaryDocRef = doc(db, 'sale_summaries_cache', `${storeId}_${dateStrIso}`);

        let salesData;
        let summaryData;

        // Try load from cache first
        const [snapSales, snapSummary] = await Promise.all([
          getDoc(salesDocRef),
          getDoc(summaryDocRef)
        ]);

        if (snapSales.exists()) {
          console.log(`[Backend Cache Hit] getsale for ${storeId} on ${dateStrIso}`);
          salesData = snapSales.data().data;
        } else {
          console.log(`[Backend Cache Miss] Fetching getsale for ${storeId} on ${dateStrIso}...`);
          const salesUrl = `${LINGAPOS_BASE_URL}/v1/lingapos/store/${storeId}/getsale`;
          const salesRes = await callExternalApi(salesUrl, { fromDate: formatted, toDate: formatted });
          salesData = salesRes.data;
          await setDoc(salesDocRef, {
            storeId,
            date: dateStrIso,
            data: salesData,
            createdAt: new Date().toISOString()
          });
        }

        if (snapSummary.exists()) {
          console.log(`[Backend Cache Hit] saleSummaryReport for ${storeId} on ${dateStrIso}`);
          summaryData = snapSummary.data().data;
        } else {
          console.log(`[Backend Cache Miss] Fetching saleSummaryReport for ${storeId} on ${dateStrIso}...`);
          const summaryUrl = `${LINGAPOS_BASE_URL}/v1/lingapos/store/${storeId}/saleSummaryReport`;
          const summaryRes = await callExternalApi(summaryUrl, { dateOption: 'DR', fromDate: formatted, toDate: formatted });
          summaryData = summaryRes.data;
          await setDoc(summaryDocRef, {
            storeId,
            date: dateStrIso,
            data: summaryData,
            createdAt: new Date().toISOString()
          });
        }

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

async function fetchStoreDiscountsBackend(storeId, dateStr) {
  try {
    const discountUrl = `${LINGAPOS_BASE_URL}/v1/lingapos/store/${storeId}/discountReport`;
    const response = await callExternalApi(discountUrl, {
      dateOption: 'DR',
      fromDate: dateStr,
      toDate: dateStr,
      selectedReportType: 'By Discount Type'
    });
    return response.data || [];
  } catch (error) {
    console.error(`Backend discount fetch failed for store ${storeId} on ${dateStr}:`, error.message);
    return [];
  }
}

async function generateSalesExcelBuffer(trendData, totals, selectedDate, anchorDates, discountsData = []) {
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

  // Add second sheet for raw sales data
  const dataSheet = workbook.addWorksheet('SalesData');
  dataSheet.views = [{ showGridLines: true }];

  dataSheet.columns = [
    { header: 'Store', key: 'store', width: 25 },
    { header: 'Ticket No', key: 'ticket', width: 14 },
    { header: 'Customer Name', key: 'customer', width: 20 },
    { header: 'Open Time', key: 'openTime', width: 22 },
    { header: 'Floor', key: 'floor', width: 12 },
    { header: 'Table', key: 'table', width: 10 },
    { header: 'Net Sales', key: 'netSales', width: 14 },
    { header: 'Total Tax', key: 'tax', width: 12 },
    { header: 'Discount', key: 'discount', width: 12 },
    { header: 'Gross Receipt', key: 'gross', width: 14 },
    { header: 'Guest Count', key: 'guests', width: 12 },
    { header: 'Date', key: 'date', width: 14 }
  ];

  const dataHeaderCells = ['A1', 'B1', 'C1', 'D1', 'E1', 'F1', 'G1', 'H1', 'I1', 'J1', 'K1', 'L1'];
  dataHeaderCells.forEach(cellRef => {
    const cell = dataSheet.getCell(cellRef);
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
    cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
  });

  const parseFloatVal = (val) => {
    if (typeof val === 'number') return val;
    if (!val) return 0;
    const clean = String(val).replace(/[$,\s]/g, '');
    const num = parseFloat(clean);
    return isNaN(num) ? 0 : num;
  };

  trendData.forEach(storeRow => {
    const rawSales = storeRow.salesData || [];
    rawSales.forEach((sale) => {
      const saleRow = dataSheet.addRow([
        storeRow.storeName,
        sale.ticketNo,
        sale.customerName || 'Walk-in Guest',
        sale.saleOpenTime,
        sale.floorNo,
        sale.tableNo,
        parseFloatVal(sale.netSalesVal),
        parseFloatVal(sale.taxVal),
        parseFloatVal(sale.discountVal),
        parseFloatVal(sale.grossReceiptStr),
        sale.guestCount,
        selectedDate
      ]);

      for (let col = 7; col <= 10; col++) {
        const cell = saleRow.getCell(col);
        cell.numFmt = '"AED" #,##0.00';
        cell.alignment = { horizontal: 'right' };
      }
      saleRow.getCell(11).numFmt = '#,##0';
      saleRow.getCell(11).alignment = { horizontal: 'right' };
    });
  });

  // Add third sheet for Discount Summary
  const discountSheet = workbook.addWorksheet('Discount Summary');
  discountSheet.views = [{ showGridLines: true }];

  discountSheet.columns = [
    { header: 'Store', key: 'store', width: 25 },
    { header: 'Approved By', key: 'approvedBy', width: 18 },
    { header: 'Check/Ticket No', key: 'check', width: 14 },
    { header: 'Discount Amount', key: 'discountAmt', width: 16 },
    { header: 'Applied By', key: 'appliedBy', width: 18 },
    { header: 'Discount Coupon', key: 'coupon', width: 18 },
    { header: 'Discount Name', key: 'name', width: 20 },
    { header: 'Discount Type', key: 'type', width: 16 },
    { header: 'Gross Sales', key: 'grossSales', width: 14 },
    { header: 'Quantity', key: 'quantity', width: 10 },
    { header: 'Reason', key: 'reason', width: 25 }
  ];

  const discountHeaderCells = ['A1', 'B1', 'C1', 'D1', 'E1', 'F1', 'G1', 'H1', 'I1', 'J1', 'K1'];
  discountHeaderCells.forEach(cellRef => {
    const cell = discountSheet.getCell(cellRef);
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
    cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
  });

  discountsData.forEach(item => {
    const row = discountSheet.addRow([
      item.storeName,
      item.approvedBy,
      item.check,
      parseFloatVal(item.discountAmtStr),
      item.discountAppliedBy,
      item.discountCoupon,
      item.discountName,
      item.discountType,
      parseFloatVal(item.grossSalesStr),
      item.quantity,
      item.reason
    ]);

    row.getCell(4).numFmt = '"AED" #,##0.00';
    row.getCell(4).alignment = { horizontal: 'right' };
    row.getCell(9).numFmt = '"AED" #,##0.00';
    row.getCell(9).alignment = { horizontal: 'right' };
    row.getCell(10).numFmt = '#,##0';
    row.getCell(10).alignment = { horizontal: 'right' };
  });

  return await workbook.xlsx.writeBuffer();
}

async function getMailerSettingsBackend() {
  try {
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

        // Fetch discounts in parallel for all stores in trendData
        const discountsData = [];
        try {
            await Promise.all(trendData.map(async (storeRow) => {
                const discounts = await fetchStoreDiscountsBackend(storeRow.storeId, selectedDate);
                discounts.forEach(d => {
                    discountsData.push({
                        storeName: storeRow.storeName,
                        ...d
                    });
                });
            }));
        } catch (err) {
            console.error("[Backend] Failed to fetch store discounts:", err.message);
        }

        // 1. Generate Excel workbook
        const excelBuffer = await generateSalesExcelBuffer(trendData, totals, selectedDate, anchorDates, discountsData);
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

async function fetchStoreSalesBackend(storeId, dates) {
  const results = {};
  const formatDateParam = (d) => {
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
  };
  const formatDateString = (d) => {
    const day = String(d.getDate()).padStart(2, '0');
    const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
    return `${day}-${months[d.getMonth()]}-${d.getFullYear()}`;
  };
  const parseFloatVal = (val) => {
    if (typeof val === 'number') return val;
    if (!val) return 0;
    const clean = String(val).replace(/[$,\s]/g, '');
    const num = parseFloat(clean);
    return isNaN(num) ? 0 : num;
  };

  await Promise.all(
    dates.map(async (date, index) => {
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

        let dailyNet = 0;
        const salesList = [];

        if (salesData?.sales) {
          salesData.sales.forEach((sale) => {
            const summary = Array.isArray(summaryData) ? summaryData.find((s) => s.id === sale.id) : null;
            const netSales = parseFloatVal(summary?.netSales || sale.netSalesStr);
            const discounts = parseFloatVal(summary?.discounts || 0);

            if (netSales > 0 || discounts > 0) {
              dailyNet += netSales;
              if (index === 0) {
                salesList.push({
                  ticketNo: sale.ticketNo,
                  customerName: sale.customerName || 'Walk-in Guest',
                  saleOpenTime: sale.saleOpenTime,
                  floorNo: summary?.floorNo || 'Unknown',
                  tableNo: summary?.tableNo || 'Unknown',
                  netSalesVal: netSales,
                  taxVal: parseFloatVal(summary?.totalTaxAmount || sale.totalTaxAmountStr),
                  discountVal: discounts,
                  grossReceiptStr: sale.grossReceiptStr,
                  guestCount: sale.guestCount
                });
              }
            }
          });
        }

        results[dateKey] = { netSales: dailyNet, sales: salesList };
      } catch (e) {
        console.error(`Backend Sales fetch failed for store ${storeId} date ${formatted}:`, e.message);
        results[dateKey] = { netSales: 0, sales: [] };
      }
    })
  );

  return results;
}

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

        console.log("[Cron] Running scheduled Daily Report generation...");

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

        const reportTypes = settings.reportTypes && settings.reportTypes.length > 0
            ? settings.reportTypes
            : ["Covers"];

        const filteredStores = settings.selectedStores && settings.selectedStores.length > 0
            ? stores.filter(s => settings.selectedStores.includes(s.id))
            : stores;

        const resultsSummary = {
            date: selectedDate,
            storesSynced: filteredStores.length,
            reportsRun: []
        };

        for (const reportType of reportTypes) {
            if (reportType === "Covers") {
                const trendData = [];
                const totals = { thisWk: 0, lastWk: 0, lastMth: 0, lastYr: 0 };

                for (let i = 0; i < filteredStores.length; i++) {
                    const store = filteredStores[i];
                    console.log(`[Cron-Covers] Fetching data for ${store.name}...`);
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

                const excelBuffer = await generateExcelBuffer(trendData, totals, selectedDate, anchorDates);
                const fileName = `Consolidated_Cover_Report_${selectedDate}.xlsx`;

                let driveResult = null;
                let driveError = null;
                try {
                    driveResult = await uploadToGoogleDrive(excelBuffer, fileName, mailerSettings, selectedDate);
                } catch (err) {
                    console.error("[Cron-Covers] Google Drive Upload Failed:", err.message);
                    driveError = err.message;
                }

                let emailResult = false;
                let emailError = null;
                try {
                    emailResult = await sendEmailReport(excelBuffer, fileName, selectedDate, mailerSettings, "Covers");
                } catch (err) {
                    console.error("[Cron-Covers] Email Send Failed:", err.message);
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

                resultsSummary.reportsRun.push({
                    type: "Covers",
                    emailSent: emailResult,
                    driveUploaded: !!driveResult,
                    driveLink: driveResult?.webViewLink || null
                });
            } else if (reportType === "Sales") {
                const trendData = [];
                const totals = { thisWk: 0, lastWk: 0, lastMth: 0, lastYr: 0 };
                const discountsData = [];

                for (let i = 0; i < filteredStores.length; i++) {
                    const store = filteredStores[i];
                    console.log(`[Cron-Sales] Fetching data for ${store.name}...`);
                    const salesSummary = await fetchStoreSalesBackend(store.id, anchorDates);
                    
                    const storeData = {
                        storeId: store.id,
                        storeName: store.name,
                        thisWk: salesSummary[formatDateString(anchorDates[0])]?.netSales || 0,
                        lastWk: salesSummary[formatDateString(anchorDates[1])]?.netSales || 0,
                        lastMth: salesSummary[formatDateString(anchorDates[2])]?.netSales || 0,
                        lastYr: salesSummary[formatDateString(anchorDates[3])]?.netSales || 0,
                        salesData: salesSummary[formatDateString(anchorDates[0])]?.sales || []
                    };

                    trendData.push(storeData);
                    totals.thisWk += storeData.thisWk;
                    totals.lastWk += storeData.lastWk;
                    totals.lastMth += storeData.lastMth;
                    totals.lastYr += storeData.lastYr;

                    // Fetch discounts for this store
                    const discounts = await fetchStoreDiscountsBackend(store.id, selectedDate);
                    discounts.forEach(d => {
                        discountsData.push({
                            storeName: store.name,
                            ...d
                        });
                    });
                }

                const excelBuffer = await generateSalesExcelBuffer(trendData, totals, selectedDate, anchorDates, discountsData);
                const fileName = `Consolidated_Sales_Report_${selectedDate}.xlsx`;

                let driveResult = null;
                let driveError = null;
                try {
                    driveResult = await uploadToGoogleDrive(excelBuffer, fileName, mailerSettings, selectedDate);
                } catch (err) {
                    console.error("[Cron-Sales] Google Drive Upload Failed:", err.message);
                    driveError = err.message;
                }

                let emailResult = false;
                let emailError = null;
                try {
                    emailResult = await sendEmailReport(excelBuffer, fileName, selectedDate, mailerSettings, "Sales");
                } catch (err) {
                    console.error("[Cron-Sales] Email Send Failed:", err.message);
                    emailError = err.message;
                }

                const runStatus = (emailResult || driveResult) ? "SUCCESS" : "FAILED";
                const runRecipients = mailerSettings?.reportRecipients || process.env.REPORT_RECIPIENTS || "";
                const runErrorMsg = (!emailResult && !driveResult) 
                  ? `Email error: ${emailError || 'unknown'}, Drive error: ${driveError || 'unknown'}`
                  : (emailError || driveError || null);

                await writeReportLogBackend({
                    type: "Automated",
                    reportType: "Sales",
                    reportDate: selectedDate,
                    status: runStatus,
                    recipients: runRecipients,
                    driveLink: driveResult?.webViewLink || null,
                    errorMsg: runErrorMsg
                });

                resultsSummary.reportsRun.push({
                    type: "Sales",
                    emailSent: emailResult,
                    driveUploaded: !!driveResult,
                    driveLink: driveResult?.webViewLink || null
                });
            }
        }

        res.json({
            success: true,
            ...resultsSummary
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
