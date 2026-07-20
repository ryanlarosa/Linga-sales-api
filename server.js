
import express from 'express';
import cors from 'cors';
import axios from 'axios';
import ExcelJS from 'exceljs';
import nodemailer from 'nodemailer';
import { google } from 'googleapis';
import { Readable } from 'stream';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { initializeFirestore, memoryLocalCache, doc, getDoc, setDoc, deleteDoc, collection, getDocs } from 'firebase/firestore';

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
    // If it's already in DD-MMM-YYYY format (e.g. 01-JUL-2025)
    if (isNaN(parseInt(parts[1], 10))) {
        return dateStr;
    }
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
        id: m.itemId || m.id || "",
        menuName: m.name || m.menuName || "",
        quantity: m.quantity || 0,
        totalGrossAmountStr: m.saleAmountStr || m.totalGrossAmountStr || "0.00"
    }));
    return { data: pruned };
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
    let useCache = false; // Hardcoded to false to bypass Firestore quota limits
    try {
        const cacheConfigDoc = await getDoc(doc(db, "configs", "caching_settings"));
        if (cacheConfigDoc.exists()) {
            useCache = cacheConfigDoc.data().enabled !== false;
        }
    } catch (e) {
        console.error("Failed to read caching settings:", e.message);
    }

    if (!useCache) {
        console.log(`[Cache Bypass] Fetching ${collectionName} for ${storeId} on range ${fromDateStr} to ${toDateStr} directly...`);
        const apiData = await fetchFn({ isRange: true, from: fromDateStr, to: toDateStr });
        const prunedData = pruneFn ? pruneFn(apiData) : apiData;
        return combineFn([prunedData]);
    }

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
            async (dateOrRange) => {
                const url = `${LINGAPOS_BASE_URL}/v1/lingapos/store/${storeId}/getsale`;
                const from = dateOrRange.isRange ? dateOrRange.from : dateOrRange;
                const to = dateOrRange.isRange ? dateOrRange.to : dateOrRange;
                const response = await callExternalApi(url, { fromDate: formatToLingaDate(from), toDate: formatToLingaDate(to) });
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
            async (dateOrRange) => {
                const url = `${LINGAPOS_BASE_URL}/v1/lingapos/store/${storeId}/discountReport`;
                const from = dateOrRange.isRange ? dateOrRange.from : dateOrRange;
                const to = dateOrRange.isRange ? dateOrRange.to : dateOrRange;
                const response = await callExternalApi(url, { 
                    dateOption: 'DR', 
                    fromDate: formatToLingaDate(from), 
                    toDate: formatToLingaDate(to), 
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
            async (dateOrRange) => {
                const url = `${LINGAPOS_BASE_URL}/v1/lingapos/store/${storeId}/saleReport`;
                const from = dateOrRange.isRange ? dateOrRange.from : dateOrRange;
                const to = dateOrRange.isRange ? dateOrRange.to : dateOrRange;
                const queryParams = { ...req.query, fromDate: formatToLingaDate(from), toDate: formatToLingaDate(to) };
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
            async (dateOrRange) => {
                const url = `${LINGAPOS_BASE_URL}/v1/lingapos/store/${storeId}/saleSummaryReport`;
                const from = dateOrRange.isRange ? dateOrRange.from : dateOrRange;
                const to = dateOrRange.isRange ? dateOrRange.to : dateOrRange;
                const queryParams = { ...req.query, fromDate: formatToLingaDate(from), toDate: formatToLingaDate(to) };
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

let isBackfillPaused = false;
let isBackfillRunning = false;

function chunkArray(array, size) {
    const result = [];
    for (let i = 0; i < array.length; i += size) {
        result.push(array.slice(i, i + size));
    }
    return result;
}

async function executeBackfill(fromDateStr, toDateStr) {
    isBackfillRunning = true;
    isBackfillPaused = false;
    
    try {
        await setDoc(doc(db, 'configs', 'backfill_status'), {
            status: "running",
            completedDays: 0,
            totalDays: 0,
            currentDate: fromDateStr,
            rangeStart: fromDateStr,
            rangeEnd: toDateStr,
            totalSaved: 0,
            updatedAt: new Date().toISOString()
        });

        // 1. Get stores list from Firestore
        let stores = [];
        const snapshot = await getDocs(collection(db, 'stores'));
        snapshot.forEach(doc => {
            const data = doc.data();
            if (data.active !== false) {
                stores.push({ id: data.id, name: data.name, brand: data.brand || "" });
            }
        });
        if (stores.length === 0) {
            stores = DEFAULT_STORES.filter(s => s.active !== false);
        }

        // 2. Generate date range
        const dates = getDatesInRange(fromDateStr, toDateStr);
        const totalDays = dates.length;
        let completedDays = 0;
        let totalSaved = 0;

        for (const dateStr of dates) {
            if (isBackfillPaused) {
                console.log(`[Backfill] Paused at date: ${dateStr}`);
                isBackfillRunning = false;
                await setDoc(doc(db, 'configs', 'backfill_status'), {
                    status: "paused",
                    completedDays,
                    totalDays,
                    currentDate: dateStr,
                    rangeStart: fromDateStr,
                    rangeEnd: toDateStr,
                    totalSaved,
                    updatedAt: new Date().toISOString()
                });
                return;
            }

            console.log(`[Backfill] Syncing day: ${dateStr} (${completedDays + 1}/${totalDays})`);

            // Fetch stores in parallel chunks of 4
            const storeChunks = chunkArray(stores, 4);
            for (const chunk of storeChunks) {
                if (isBackfillPaused) break;

                await Promise.all(chunk.map(async (store) => {
                    const cacheKey = `${store.id}_${dateStr}`;
                    
                    const cacheCollections = [
                        { name: 'sales_cache', endpoint: `/v1/lingapos/store/${store.id}/getsale`, params: { fromDate: formatToLingaDate(dateStr), toDate: formatToLingaDate(dateStr) }, pruneFn: pruneSalesData },
                        { name: 'discounts_cache', endpoint: `/v1/lingapos/store/${store.id}/discountReport`, params: { dateOption: 'DR', fromDate: formatToLingaDate(dateStr), toDate: formatToLingaDate(dateStr), selectedReportType: 'By Discount Type' }, pruneFn: pruneDiscountData },
                        { name: 'sale_reports_cache', endpoint: `/v1/lingapos/store/${store.id}/saleReport`, params: { dateOption: 'DR', employeeGroup: 'N', fromDate: formatToLingaDate(dateStr), toDate: formatToLingaDate(dateStr), isDetailedView: 'false', numberOfDay: '', page: 1, reportType: '', selectedEmployee: '', selectedItemId: '', specificDate: '', type: 'MENUITEM' }, pruneFn: pruneSaleReportData },
                        { name: 'sale_summaries_cache', endpoint: `/v1/lingapos/store/${store.id}/saleSummaryReport`, params: { dateOption: 'DR', fromDate: formatToLingaDate(dateStr), toDate: formatToLingaDate(dateStr) }, pruneFn: pruneSummaryData }
                    ];

                    for (const col of cacheCollections) {
                        if (isBackfillPaused) break;
                        const docRef = doc(db, col.name, cacheKey);
                        try {
                            const snap = await getDoc(docRef);
                            if (snap.exists()) continue;

                            const response = await callExternalApi(`${LINGAPOS_BASE_URL}${col.endpoint}`, col.params);
                            const pruned = col.pruneFn ? col.pruneFn(response.data) : response.data;
                            
                            await setDoc(docRef, {
                                storeId: store.id,
                                date: dateStr,
                                data: pruned,
                                createdAt: new Date().toISOString()
                            });
                            totalSaved++;
                            
                            await new Promise(resolve => setTimeout(resolve, 200));
                        } catch (err) {
                            console.error(`[Backfill Err] Store ${store.name} Date ${dateStr} Col ${col.name}:`, err.message);
                        }
                    }
                }));
            }

            completedDays++;
            
            await setDoc(doc(db, 'configs', 'backfill_status'), {
                status: isBackfillPaused ? "paused" : "running",
                completedDays,
                totalDays,
                currentDate: dateStr,
                rangeStart: fromDateStr,
                rangeEnd: toDateStr,
                totalSaved,
                updatedAt: new Date().toISOString()
            });
        }

        isBackfillRunning = false;
        await setDoc(doc(db, 'configs', 'backfill_status'), {
            status: "completed",
            completedDays,
            totalDays,
            currentDate: toDateStr,
            rangeStart: fromDateStr,
            rangeEnd: toDateStr,
            totalSaved,
            updatedAt: new Date().toISOString()
        });
        console.log(`[Backfill] Completed successfully! Saved ${totalSaved} documents.`);
    } catch (error) {
        console.error("[Backfill Error] Main execution loop failed:", error);
        isBackfillRunning = false;
        await setDoc(doc(db, 'configs', 'backfill_status'), {
            status: "failed",
            error: error.message,
            updatedAt: new Date().toISOString()
        });
    }
}

// --- Backfill API Endpoints ---
app.post('/api/v1/backfill/start', async (req, res) => {
    const { fromDate, toDate } = req.body;
    if (!fromDate || !toDate) {
        return res.status(400).json({ error: "fromDate and toDate parameters are required in the body." });
    }
    if (isBackfillRunning) {
        return res.status(400).json({ error: "A backfill process is already running." });
    }
    
    executeBackfill(fromDate, toDate);
    res.json({ message: "Backfill started in the background." });
});

app.post('/api/v1/backfill/pause', async (req, res) => {
    isBackfillPaused = true;
    res.json({ message: "Backfill pausing signal sent." });
});

app.get('/api/v1/backfill/status', async (req, res) => {
    try {
        const snap = await getDoc(doc(db, 'configs', 'backfill_status'));
        if (snap.exists()) {
            return res.json(snap.data());
        }
        res.json({ status: "idle", completedDays: 0, totalDays: 0, currentDate: "", totalSaved: 0 });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/v1/backfill/reset', async (req, res) => {
    if (isBackfillRunning) {
        return res.status(400).json({ error: "Cannot reset cache while backfill is running. Please pause it first." });
    }
    try {
        console.log("[Backfill] Wiping all cache collections from Firestore...");
        
        const wipeCollection = async (colName) => {
            const snap = await getDocs(collection(db, colName));
            const deletePromises = [];
            snap.forEach(d => {
                deletePromises.push(deleteDoc(d.ref));
            });
            await Promise.all(deletePromises);
        };
        
        await Promise.all([
            wipeCollection('sales_cache'),
            wipeCollection('discounts_cache'),
            wipeCollection('sale_reports_cache'),
            wipeCollection('sale_summaries_cache')
        ]);
        
        await setDoc(doc(db, 'configs', 'backfill_status'), {
            status: "idle",
            completedDays: 0,
            totalDays: 0,
            currentDate: "",
            totalSaved: 0,
            updatedAt: new Date().toISOString()
        });
        
        res.json({ message: "All Firestore cache collections cleared successfully." });
    } catch (err) {
        res.status(500).json({ error: err.message });
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
const db = initializeFirestore(firebaseApp, { localCache: memoryLocalCache() }); // Force trigger Vercel redeploy

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
    if (snapshot.empty) return DEFAULT_STORES.filter(s => s.active !== false);
    const stores = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      if (data.active !== false) {
        stores.push({ id: data.id, name: data.name, brand: data.brand || "", active: data.active !== false });
      }
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

  let useCache = false; // Bypass cache by default
  try {
    const cacheConfigDoc = await getDoc(doc(db, "configs", "caching_settings"));
    if (cacheConfigDoc.exists()) {
      useCache = cacheConfigDoc.data().enabled !== false;
    }
  } catch (e) {
    console.error("Failed to read caching settings in fetchStoreTrendSummaryBackend:", e.message);
  }

  const formatDateString = (d) => {
    const day = String(d.getUTCDate()).padStart(2, '0');
    const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
    return `${day}-${months[d.getUTCMonth()]}-${d.getUTCFullYear()}`;
  };

  const formatDateParam = (d) => {
    const day = String(d.getUTCDate()).padStart(2, '0');
    const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
    const month = months[d.getUTCMonth()];
    const year = d.getUTCFullYear();
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
      const yyyy = date.getUTCFullYear();
      const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
      const dd = String(date.getUTCDate()).padStart(2, "0");
      const dateStrIso = `${yyyy}-${mm}-${dd}`;

      try {
        let salesData;
        let summaryData;

        if (useCache) {
          const salesDocRef = doc(db, 'sales_cache', `${storeId}_${dateStrIso}`);
          const summaryDocRef = doc(db, 'sale_summaries_cache', `${storeId}_${dateStrIso}`);

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
            try {
              await setDoc(salesDocRef, {
                storeId,
                date: dateStrIso,
                data: salesData,
                createdAt: new Date().toISOString()
              });
            } catch (writeErr) {
              console.error(`[Backend Cache Write Error] Failed to write sales cache for ${storeId} on ${dateStrIso}:`, writeErr.message);
            }
          }

          if (snapSummary.exists()) {
            console.log(`[Backend Cache Hit] saleSummaryReport for ${storeId} on ${dateStrIso}`);
            summaryData = snapSummary.data().data;
          } else {
            console.log(`[Backend Cache Miss] Fetching saleSummaryReport for ${storeId} on ${dateStrIso}...`);
            const summaryUrl = `${LINGAPOS_BASE_URL}/v1/lingapos/store/${storeId}/saleSummaryReport`;
            const summaryRes = await callExternalApi(summaryUrl, { dateOption: 'DR', fromDate: formatted, toDate: formatted });
            summaryData = summaryRes.data;
            try {
              await setDoc(summaryDocRef, {
                storeId,
                date: dateStrIso,
                data: summaryData,
                createdAt: new Date().toISOString()
              });
            } catch (writeErr) {
              console.error(`[Backend Cache Write Error] Failed to write summary cache for ${storeId} on ${dateStrIso}:`, writeErr.message);
            }
          }
        } else {
          // Cache bypassed - query LINGAPOS directly
          console.log(`[Backend Cache Bypass] Fetching getsale & summary for ${storeId} on ${dateStrIso}...`);
          const salesUrl = `${LINGAPOS_BASE_URL}/v1/lingapos/store/${storeId}/getsale`;
          const summaryUrl = `${LINGAPOS_BASE_URL}/v1/lingapos/store/${storeId}/saleSummaryReport`;

          const [salesRes, summaryRes] = await Promise.all([
            callExternalApi(salesUrl, { fromDate: formatted, toDate: formatted }),
            callExternalApi(summaryUrl, { dateOption: 'DR', fromDate: formatted, toDate: formatted })
          ]);
          salesData = salesRes.data;
          summaryData = summaryRes.data;
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
    { key: 'venue', width: 25 },
    { key: 'thisWk', width: 11 },
    { key: 'lastWk', width: 11 },
    { key: 'lastMth', width: 11 },
    { key: 'lastYr', width: 11 },
    { key: 'varLw', width: 11 },
    { key: 'varLm', width: 11 },
    { key: 'varLy', width: 11 },
  ];

  const formatDate = (d) => {
    const dateObj = new Date(d);
    return `${String(dateObj.getUTCDate()).padStart(2, '0')}-${String(dateObj.getUTCMonth() + 1).padStart(2, '0')}-${String(dateObj.getUTCFullYear()).slice(-2)}`;
  };

  const dayOfWeek = new Date(anchorDates[0]).toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' });

  // Row 1: Report Date
  const dateStrRow = worksheet.addRow([`Report Date: ${selectedDate}`]);
  dateStrRow.getCell(1).font = { name: 'Arial', size: 10, italic: true, color: { argb: 'FF475569' } };
  dateStrRow.height = 16;

  // Row 2: Primary headers
  const row2 = worksheet.addRow([
    'Daily Covers tracker',
    `Actuals - ${dayOfWeek}`,
    '', '', '', // B2:E2
    'Variance This Wk vs:',
    '', '' // F2:H2
  ]);
  worksheet.mergeCells('B2:E2');
  worksheet.mergeCells('F2:H2');

  // Row 3: Venue sub-headers
  const row5 = worksheet.addRow([
    'Venue',
    'This Wk',
    'Last Wk',
    'Last Mth',
    'Last Yr',
    'Last Wk',
    'Last Mth',
    'Last Yr'
  ]);

  // Row 4: Date rows
  const row6 = worksheet.addRow([
    '', // Venue column merged
    formatDate(anchorDates[0]),
    formatDate(anchorDates[1]),
    formatDate(anchorDates[2]),
    formatDate(anchorDates[3]),
    '', // Merged Last Wk
    '', // Merged Last Mth
    ''  // Merged Last Yr
  ]);

  worksheet.mergeCells('A3:A4');
  worksheet.mergeCells('F3:F4');
  worksheet.mergeCells('G3:G4');
  worksheet.mergeCells('H3:H4');

  // Styling Row 2
  row2.height = 20;
  for (let col = 1; col <= 8; col++) {
    const cell = row2.getCell(col);
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1B365D' } }; // Corporate Navy
    cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.alignment = {
      vertical: 'middle',
      horizontal: col === 1 ? 'left' : 'center'
    };
  }

  // Styling Rows 3 & 4
  const borderStyle = {
    top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
  };

  row5.height = 18;
  row6.height = 18;
  [row5, row6].forEach((r) => {
    for (let col = 1; col <= 8; col++) {
      const cell = r.getCell(col);
      cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF1B365D' } };
      cell.border = borderStyle;
      cell.alignment = {
        vertical: 'middle',
        horizontal: col === 1 ? 'left' : 'center'
      };
    }
  });

  // Helper formatting functions
  const fmtActual = (val) => val === 0 ? "-" : val;
  const fmtVar = (val) => {
    if (val === "na" || val === undefined) return "na";
    return val === 0 ? "-" : val;
  };

  // Group & sequence/sort data by brand
  const getStoreBrand = (storeName, configuredBrand) => {
    if (configuredBrand) return configuredBrand;
    const name = storeName.toLowerCase();
    if (name.includes("common grounds")) return "Common Grounds";
    if (name.includes("ldc")) return "LDC Kitchen+Coffee";
    if (name.includes("the sum of us")) return "The Sum of Us";
    if (name.includes("encounter coffee")) return "Encounter Coffee";
    return "Other";
  };

  // Pre-calculate parsed store-level rows with their variance states
  const parsedRows = trendData.map((row) => {
    const thisWk = row.thisWk || 0;
    const lastWk = row.lastWk || 0;
    const lastMth = row.lastMth || 0;
    const lastYr = row.lastYr || 0;
    
    return {
      ...row,
      thisWk,
      lastWk,
      lastMth,
      lastYr,
      brand: getStoreBrand(row.storeName, row.brand),
      varLw: (thisWk === 0 || lastWk === 0) ? "na" : (thisWk - lastWk),
      varLm: (thisWk === 0 || lastMth === 0) ? "na" : (thisWk - lastMth),
      varLy: (thisWk === 0 || lastYr === 0) ? "na" : (thisWk - lastYr),
    };
  });

  // Calculate Company Level totals (actuals are straight sums)
  const totalThisWk = parsedRows.reduce((sum, r) => sum + r.thisWk, 0);
  const totalLastWk = parsedRows.reduce((sum, r) => sum + r.lastWk, 0);
  const totalLastMth = parsedRows.reduce((sum, r) => sum + r.lastMth, 0);
  const totalLastYr = parsedRows.reduce((sum, r) => sum + r.lastYr, 0);

  // Calculate Company Level variances (summing store variances that are not "na")
  const lwVars = parsedRows.filter(r => r.varLw !== "na").map(r => r.varLw);
  const lmVars = parsedRows.filter(r => r.varLm !== "na").map(r => r.varLm);
  const lyVars = parsedRows.filter(r => r.varLy !== "na").map(r => r.varLy);

  const totalVarLw = lwVars.length > 0 ? lwVars.reduce((sum, v) => sum + v, 0) : "na";
  const totalVarLm = lmVars.length > 0 ? lmVars.reduce((sum, v) => sum + v, 0) : "na";
  const totalVarLy = lyVars.length > 0 ? lyVars.reduce((sum, v) => sum + v, 0) : "na";

  // Add Totals (Company level) first, styled beautifully
  const totalRow = worksheet.addRow([
    'Total (Company level)',
    fmtActual(totalThisWk),
    fmtActual(totalLastWk),
    fmtActual(totalLastMth),
    fmtActual(totalLastYr),
    fmtVar(totalVarLw),
    fmtVar(totalVarLm),
    fmtVar(totalVarLy)
  ]);
  totalRow.height = 18;

  // Styles for totals row cells
  for (let col = 1; col <= 8; col++) {
    const cell = totalRow.getCell(col);
    cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF0F172A' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFDCE6F1' } // Soft steel blue for company total
    };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      bottom: { style: 'double', color: { argb: 'FF0F172A' } }, // Double bottom line for totals
      left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
    };
    if (col > 1) {
      cell.alignment = { horizontal: 'right', vertical: 'middle' };
      const val = cell.value;
      if (typeof val === 'number') {
        cell.numFmt = '#,##0';
      } else {
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      }
    } else {
      cell.alignment = { horizontal: 'left', vertical: 'middle' };
    }
  }

  // Color code Company Total variance cells
  for (let col = 6; col <= 8; col++) {
    const cell = totalRow.getCell(col);
    const val = cell.value;
    if (typeof val === 'number') {
      cell.numFmt = '+#,##0;-#,##0;0';
      if (val > 0) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } };
        cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF065F46' } };
      } else if (val < 0) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
        cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF991B1B' } };
      }
    }
  }

  // Group the parsedRows by brand
  const groupedByBrand = {};
  parsedRows.forEach((row) => {
    if (!groupedByBrand[row.brand]) {
      groupedByBrand[row.brand] = [];
    }
    groupedByBrand[row.brand].push(row);
  });

  let brandOrder = [];
  try {
    const orderDoc = await getDoc(doc(db, "configs", "brand_order"));
    if (orderDoc.exists()) {
      brandOrder = orderDoc.data().brands || [];
    }
  } catch (e) {
    console.error("Failed to fetch brand order:", e.message);
  }

  const sortedBrands = Object.keys(groupedByBrand).sort((a, b) => {
    if (a === "Other") return 1;
    if (b === "Other") return -1;
    const idxA = brandOrder.indexOf(a);
    const idxB = brandOrder.indexOf(b);
    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
    if (idxA !== -1) return -1;
    if (idxB !== -1) return 1;
    return a.localeCompare(b);
  });
  sortedBrands.forEach((brand) => {
    groupedByBrand[brand].sort((a, b) => a.storeName.localeCompare(b.storeName));
  });

  // Write grouped data
  sortedBrands.forEach((brand) => {
    const brandStores = groupedByBrand[brand];
    
    // Sum totals for the brand
    const brandThisWk = brandStores.reduce((sum, r) => sum + r.thisWk, 0);
    const brandLastWk = brandStores.reduce((sum, r) => sum + r.lastWk, 0);
    const brandLastMth = brandStores.reduce((sum, r) => sum + r.lastMth, 0);
    const brandLastYr = brandStores.reduce((sum, r) => sum + r.lastYr, 0);

    const bLwVars = brandStores.filter(r => r.varLw !== "na").map(r => r.varLw);
    const bLmVars = brandStores.filter(r => r.varLm !== "na").map(r => r.varLm);
    const bLyVars = brandStores.filter(r => r.varLy !== "na").map(r => r.varLy);

    const brandVarLw = bLwVars.length > 0 ? bLwVars.reduce((sum, v) => sum + v, 0) : "na";
    const brandVarLm = bLmVars.length > 0 ? bLmVars.reduce((sum, v) => sum + v, 0) : "na";
    const brandVarLy = bLyVars.length > 0 ? bLyVars.reduce((sum, v) => sum + v, 0) : "na";

    const hasMultiple = brandStores.length > 1;

    if (hasMultiple) {
      // 1. Write Brand Header/Total Row (Bold, brand name in column A, sums in others)
      const brandTotalRow = worksheet.addRow([
        brand,
        fmtActual(brandThisWk),
        fmtActual(brandLastWk),
        fmtActual(brandLastMth),
        fmtActual(brandLastYr),
        fmtVar(brandVarLw),
        fmtVar(brandVarLm),
        fmtVar(brandVarLy)
      ]);
      brandTotalRow.height = 18;

      for (let col = 1; col <= 8; col++) {
        const cell = brandTotalRow.getCell(col);
        cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF0F172A' } };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
          bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
          left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
          right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
        };
        if (col > 1) {
          cell.alignment = { horizontal: 'right', vertical: 'middle' };
          const val = cell.value;
          if (typeof val === 'number') {
            cell.numFmt = '#,##0';
          } else {
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
          }
        } else {
          cell.alignment = { horizontal: 'left', vertical: 'middle' };
        }
      }

      // Color code brand variance
      for (let col = 6; col <= 8; col++) {
        const cell = brandTotalRow.getCell(col);
        const val = cell.value;
        if (typeof val === 'number') {
          cell.numFmt = '+#,##0;-#,##0;0';
          if (val > 0) {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } };
            cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF065F46' } };
          } else if (val < 0) {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
            cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF991B1B' } };
          }
        }
      }

      // 2. Write individual stores (regular font, indented name)
      brandStores.forEach((row) => {
        const storeRow = worksheet.addRow([
          `  ${row.storeName}`,
          fmtActual(row.thisWk),
          fmtActual(row.lastWk),
          fmtActual(row.lastMth),
          fmtActual(row.lastYr),
          fmtVar(row.varLw),
          fmtVar(row.varLm),
          fmtVar(row.varLy)
        ]);
        storeRow.height = 16;

        for (let col = 1; col <= 8; col++) {
          const cell = storeRow.getCell(col);
          cell.font = { name: 'Arial', size: 10, color: { argb: 'FF475569' } };
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
          };
          if (col > 1) {
            cell.alignment = { horizontal: 'right', vertical: 'middle' };
            const val = cell.value;
            if (typeof val === 'number') {
              cell.numFmt = '#,##0';
            } else {
              cell.alignment = { horizontal: 'center', vertical: 'middle' };
            }
          } else {
            cell.alignment = { horizontal: 'left', vertical: 'middle' };
          }
        }

        // Color code store variance
        for (let col = 6; col <= 8; col++) {
          const cell = storeRow.getCell(col);
          const val = cell.value;
          if (typeof val === 'number') {
            cell.numFmt = '+#,##0;-#,##0;0';
            if (val > 0) {
              cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } };
              cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF065F46' } };
            } else if (val < 0) {
              cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
              cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF991B1B' } };
            }
          }
        }
      });
    } else {
      // Just a single store for this brand (bold row with the store's data, no indentation)
      const store = brandStores[0];
      const singleRow = worksheet.addRow([
        store.storeName,
        fmtActual(store.thisWk),
        fmtActual(store.lastWk),
        fmtActual(store.lastMth),
        fmtActual(store.lastYr),
        fmtVar(store.varLw),
        fmtVar(store.varLm),
        fmtVar(store.varLy)
      ]);
      singleRow.height = 16;

      for (let col = 1; col <= 8; col++) {
        const cell = singleRow.getCell(col);
        cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF0F172A' } };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
          bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
          left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
          right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
        };
        if (col > 1) {
          cell.alignment = { horizontal: 'right', vertical: 'middle' };
          const val = cell.value;
          if (typeof val === 'number') {
            cell.numFmt = '#,##0';
          } else {
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
          }
        } else {
          cell.alignment = { horizontal: 'left', vertical: 'middle' };
        }
      }

      // Color code single store variance
      for (let col = 6; col <= 8; col++) {
        const cell = singleRow.getCell(col);
        const val = cell.value;
        if (typeof val === 'number') {
          cell.numFmt = '+#,##0;-#,##0;0';
          if (val > 0) {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } };
            cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF065F46' } };
          } else if (val < 0) {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
            cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF991B1B' } };
          }
        }
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
    { key: 'venue', width: 25 },
    { key: 'thisWk', width: 13 },
    { key: 'lastWk', width: 13 },
    { key: 'lastMth', width: 13 },
    { key: 'lastYr', width: 13 },
    { key: 'varLw', width: 13 },
    { key: 'varLm', width: 13 },
    { key: 'varLy', width: 13 },
  ];

  const formatDate = (d) => {
    const dateObj = new Date(d);
    return `${String(dateObj.getUTCDate()).padStart(2, '0')}-${String(dateObj.getUTCMonth() + 1).padStart(2, '0')}-${String(dateObj.getUTCFullYear()).slice(-2)}`;
  };

  const dayOfWeek = new Date(anchorDates[0]).toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' });

  // Row 1: Report Date
  const dateStrRow = worksheet.addRow([`Report Date: ${selectedDate}`]);
  dateStrRow.getCell(1).font = { name: 'Arial', size: 10, italic: true, color: { argb: 'FF475569' } };
  dateStrRow.height = 16;

  // Row 2: Primary headers
  const row2 = worksheet.addRow([
    'Daily Sales tracker',
    `Actuals - ${dayOfWeek}`,
    '', '', '', // B2:E2
    'Variance This Wk vs:',
    '', '' // F2:H2
  ]);
  worksheet.mergeCells('B2:E2');
  worksheet.mergeCells('F2:H2');

  // Row 3: Blank
  // Row 3: Venue sub-headers
  const row5 = worksheet.addRow([
    'Venue',
    'This Wk',
    'Last Wk',
    'Last Mth',
    'Last Yr',
    'Last Wk',
    'Last Mth',
    'Last Yr'
  ]);

  // Row 4: Date rows
  const row6 = worksheet.addRow([
    '', // Venue column merged
    formatDate(anchorDates[0]),
    formatDate(anchorDates[1]),
    formatDate(anchorDates[2]),
    formatDate(anchorDates[3]),
    '', // Merged Last Wk
    '', // Merged Last Mth
    ''  // Merged Last Yr
  ]);

  worksheet.mergeCells('A3:A4');
  worksheet.mergeCells('F3:F4');
  worksheet.mergeCells('G3:G4');
  worksheet.mergeCells('H3:H4');

  // Styling Row 2
  row2.height = 20;
  for (let col = 1; col <= 8; col++) {
    const cell = row2.getCell(col);
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1B365D' } }; // Corporate Navy
    cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.alignment = {
      vertical: 'middle',
      horizontal: col === 1 ? 'left' : 'center'
    };
  }

  // Styling Rows 3 & 4
  const borderStyle = {
    top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
  };

  row5.height = 18;
  row6.height = 18;
  [row5, row6].forEach((r) => {
    for (let col = 1; col <= 8; col++) {
      const cell = r.getCell(col);
      cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF1B365D' } };
      cell.border = borderStyle;
      cell.alignment = {
        vertical: 'middle',
        horizontal: col === 1 ? 'left' : 'center'
      };
    }
  });

  // Helper formatting functions
  const fmtActual = (val) => val === 0 ? "-" : val;
  const fmtVar = (thisWk, otherVal) => {
    const diff = thisWk - otherVal;
    return diff === 0 ? "-" : diff;
  };

  // Add Totals (Company level) first, styled beautifully
  const totalRow = worksheet.addRow([
    'Total (Company level)',
    fmtActual(totals.thisWk),
    fmtActual(totals.lastWk),
    fmtActual(totals.lastMth),
    fmtActual(totals.lastYr),
    fmtVar(totals.thisWk, totals.lastWk),
    fmtVar(totals.thisWk, totals.lastMth),
    fmtVar(totals.thisWk, totals.lastYr)
  ]);
  totalRow.height = 20;

  for (let col = 1; col <= 8; col++) {
    const cell = totalRow.getCell(col);
    cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF0F172A' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFDCE6F1' } // Soft steel blue
    };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      bottom: { style: 'double', color: { argb: 'FF0F172A' } },
      left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
    };
    if (col > 1) {
      cell.alignment = { horizontal: 'right', vertical: 'middle' };
      const val = cell.value;
      if (typeof val === 'number') {
        cell.numFmt = '"AED" #,##0.00';
      } else {
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      }
    } else {
      cell.alignment = { horizontal: 'left', vertical: 'middle' };
    }
  }

  for (let col = 6; col <= 8; col++) {
    const cell = totalRow.getCell(col);
    const val = cell.value;
    if (typeof val === 'number') {
      cell.numFmt = '+"AED" #,##0.00;-"AED" #,##0.00;"AED" 0.00';
      if (val > 0) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } };
        cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF065F46' } };
      } else if (val < 0) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
        cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF991B1B' } };
      }
    }
  }

  // Sort trendData by storeName alphabetically
  const sortedSalesData = [...trendData].sort((a, b) => a.storeName.localeCompare(b.storeName));

  const formatSalesVal = (val) => val === 0 ? "na" : val;
  const formatSalesVar = (thisWk, otherVal) => {
    return thisWk - otherVal;
  };

  sortedSalesData.forEach((row) => {
    const rowData = [
      row.storeName,
      formatSalesVal(row.thisWk),
      formatSalesVal(row.lastWk),
      formatSalesVal(row.lastMth),
      formatSalesVal(row.lastYr),
      formatSalesVar(row.thisWk, row.lastWk),
      formatSalesVar(row.thisWk, row.lastMth),
      formatSalesVar(row.thisWk, row.lastYr)
    ];
    const dataRow = worksheet.addRow(rowData);
    dataRow.height = 16;

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
        const val = cell.value;
        if (typeof val === 'number') {
          cell.numFmt = '"AED" #,##0.00';
        }
      } else {
        cell.alignment = { horizontal: 'left', vertical: 'middle' };
        cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF0F172A' } };
      }
    }

    for (let col = 6; col <= 8; col++) {
      const cell = dataRow.getCell(col);
      const val = cell.value;
      if (typeof val === 'number') {
        cell.numFmt = '+"AED" #,##0.00;-"AED" #,##0.00;"AED" 0.00';
        if (val > 0) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } };
          cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF065F46' } };
        } else if (val < 0) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
          cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF991B1B' } };
        }
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

async function buildHtmlReport(trendData, totals, selectedDate, anchorDates, reportType, interpolatedBody = null) {
  if (!trendData || !totals || !anchorDates) return "";

  const formatDate = (d) => {
    const dateObj = new Date(d);
    return `${String(dateObj.getUTCDate()).padStart(2, '0')}-${String(dateObj.getUTCMonth() + 1).padStart(2, '0')}-${String(dateObj.getUTCFullYear()).slice(-2)}`;
  };

  const dayOfWeek = new Date(anchorDates[0]).toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' });
  const isSales = reportType.toLowerCase() === "sales";
  
  const fmtActual = (val) => {
    if (val === 0) return "-";
    if (isSales) {
      return "AED " + val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    return val.toLocaleString();
  };

  const fmtVar = (val) => {
    if (val === "na" || val === undefined) return "na";
    if (val === 0) return "-";
    const absVal = Math.abs(val);
    if (isSales) {
      return "AED " + absVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    return absVal.toLocaleString();
  };

  // Group & sequence/sort data by brand
  const getStoreBrand = (storeName, configuredBrand) => {
    if (configuredBrand) return configuredBrand;
    const name = storeName.toLowerCase();
    if (name.includes("common grounds")) return "Common Grounds";
    if (name.includes("ldc")) return "LDC Kitchen+Coffee";
    if (name.includes("the sum of us")) return "The Sum of Us";
    if (name.includes("encounter coffee")) return "Encounter Coffee";
    return "Other";
  };

  // Pre-calculate parsed store-level rows with their variance states
  const parsedRows = trendData.map((row) => {
    const thisWk = row.thisWk || 0;
    const lastWk = row.lastWk || 0;
    const lastMth = row.lastMth || 0;
    const lastYr = row.lastYr || 0;
    
    return {
      ...row,
      thisWk,
      lastWk,
      lastMth,
      lastYr,
      brand: getStoreBrand(row.storeName, row.brand),
      varLw: (thisWk === 0 || lastWk === 0) ? "na" : (thisWk - lastWk),
      varLm: (thisWk === 0 || lastMth === 0) ? "na" : (thisWk - lastMth),
      varLy: (thisWk === 0 || lastYr === 0) ? "na" : (thisWk - lastYr),
    };
  });

  // Calculate Company Level totals (actuals are straight sums)
  const totalThisWk = parsedRows.reduce((sum, r) => sum + r.thisWk, 0);
  const totalLastWk = parsedRows.reduce((sum, r) => sum + r.lastWk, 0);
  const totalLastMth = parsedRows.reduce((sum, r) => sum + r.lastMth, 0);
  const totalLastYr = parsedRows.reduce((sum, r) => sum + r.lastYr, 0);

  // Calculate Company Level variances (summing store variances that are not "na")
  const lwVars = parsedRows.filter(r => r.varLw !== "na").map(r => r.varLw);
  const lmVars = parsedRows.filter(r => r.varLm !== "na").map(r => r.varLm);
  const lyVars = parsedRows.filter(r => r.varLy !== "na").map(r => r.varLy);

  const totalVarLw = lwVars.length > 0 ? lwVars.reduce((sum, v) => sum + v, 0) : "na";
  const totalVarLm = lmVars.length > 0 ? lmVars.reduce((sum, v) => sum + v, 0) : "na";
  const totalVarLy = lyVars.length > 0 ? lyVars.reduce((sum, v) => sum + v, 0) : "na";

  // Group the parsedRows by brand
  const groupedByBrand = {};
  parsedRows.forEach((row) => {
    if (!groupedByBrand[row.brand]) {
      groupedByBrand[row.brand] = [];
    }
    groupedByBrand[row.brand].push(row);
  });

  let brandOrder = [];
  try {
    const orderDoc = await getDoc(doc(db, "configs", "brand_order"));
    if (orderDoc.exists()) {
      brandOrder = orderDoc.data().brands || [];
    }
  } catch (e) {
    console.error("Failed to fetch brand order for HTML mail:", e.message);
  }

  const sortedBrands = Object.keys(groupedByBrand).sort((a, b) => {
    if (a === "Other") return 1;
    if (b === "Other") return -1;
    const idxA = brandOrder.indexOf(a);
    const idxB = brandOrder.indexOf(b);
    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
    if (idxA !== -1) return -1;
    if (idxB !== -1) return 1;
    return a.localeCompare(b);
  });
  sortedBrands.forEach((brand) => {
    groupedByBrand[brand].sort((a, b) => a.storeName.localeCompare(b.storeName));
  });

  function getStyledVarTd(val) {
    if (typeof val === 'number') {
      if (val > 0) {
        return `<td style="padding: 4px 8px; border: 1px solid #CBD5E1; text-align: right; background-color: #D1FAE5; color: #065F46; font-weight: bold;">+${fmtVar(val)}</td>`;
      } else if (val < 0) {
        return `<td style="padding: 4px 8px; border: 1px solid #CBD5E1; text-align: right; background-color: #FFFEE2E2; color: #991B1B; font-weight: bold;">(${fmtVar(val)})</td>`;
      } else {
        return `<td style="padding: 4px 8px; border: 1px solid #CBD5E1; text-align: right; font-weight: bold; color: #334155;">-</td>`;
      }
    }
    return `<td style="padding: 4px 8px; border: 1px solid #CBD5E1; text-align: center; color: #64748B;">na</td>`;
  }

  let bodyHtml = `<p style="margin: 0 0 10px 0;">Good morning,</p><p style="margin: 0 0 10px 0;">PFB ${reportType} report for ${selectedDate} (${dayOfWeek}).</p>`;
  if (interpolatedBody) {
    bodyHtml = interpolatedBody.split('\n').map(line => `<p style="margin: 0 0 10px 0;">${line}</p>`).join('');
  }

  // Start HTML construction
  let html = `
  <div style="font-family: Arial, sans-serif; font-size: 14px; color: #334155; max-width: 800px; line-height: 1.5;">
    ${bodyHtml}
    
    <table style="border-collapse: collapse; width: 100%; max-width: 800px; font-family: Arial, sans-serif; font-size: 12px; margin-top: 15px; margin-bottom: 20px;">
      <thead>
        <!-- Row 1: Primary headers -->
        <tr>
          <th style="background-color: #1B365D; color: #FFFFFF; font-weight: bold; padding: 6px 8px; border: 1px solid #CBD5E1; text-align: left; font-size: 13px;">Daily ${reportType} tracker</th>
          <th colspan="4" style="background-color: #1B365D; color: #FFFFFF; font-weight: bold; padding: 6px 8px; border: 1px solid #CBD5E1; text-align: center; font-size: 13px;">Actuals - ${dayOfWeek}</th>
          <th colspan="3" style="background-color: #1B365D; color: #FFFFFF; font-weight: bold; padding: 6px 8px; border: 1px solid #CBD5E1; text-align: center; font-size: 13px;">Variance This Wk vs:</th>
        </tr>
        <!-- Row 2: Date and sub-headers -->
        <tr>
          <th style="background-color: #FFFFFF; color: #1B365D; font-weight: bold; padding: 6px 8px; border: 1px solid #CBD5E1; text-align: left;">Venue</th>
          <th style="background-color: #FFFFFF; color: #1B365D; font-weight: bold; padding: 6px 8px; border: 1px solid #CBD5E1; text-align: center;">This Wk<br><span style="font-size: 10px; font-weight: normal; color: #64748B;">${formatDate(anchorDates[0])}</span></th>
          <th style="background-color: #FFFFFF; color: #1B365D; font-weight: bold; padding: 6px 8px; border: 1px solid #CBD5E1; text-align: center;">Last Wk<br><span style="font-size: 10px; font-weight: normal; color: #64748B;">${formatDate(anchorDates[1])}</span></th>
          <th style="background-color: #FFFFFF; color: #1B365D; font-weight: bold; padding: 6px 8px; border: 1px solid #CBD5E1; text-align: center;">Last Mth<br><span style="font-size: 10px; font-weight: normal; color: #64748B;">${formatDate(anchorDates[2])}</span></th>
          <th style="background-color: #FFFFFF; color: #1B365D; font-weight: bold; padding: 6px 8px; border: 1px solid #CBD5E1; text-align: center;">Last Yr<br><span style="font-size: 10px; font-weight: normal; color: #64748B;">${formatDate(anchorDates[3])}</span></th>
          <th style="background-color: #FFFFFF; color: #1B365D; font-weight: bold; padding: 6px 8px; border: 1px solid #CBD5E1; text-align: center;">Last Wk</th>
          <th style="background-color: #FFFFFF; color: #1B365D; font-weight: bold; padding: 6px 8px; border: 1px solid #CBD5E1; text-align: center;">Last Mth</th>
          <th style="background-color: #FFFFFF; color: #1B365D; font-weight: bold; padding: 6px 8px; border: 1px solid #CBD5E1; text-align: center;">Last Yr</th>
        </tr>
      </thead>
      <tbody>
        <!-- Company Total Row -->
        <tr style="background-color: #DCE6F1; font-weight: bold; color: #0F172A;">
          <td style="padding: 6px 8px; border: 1px solid #CBD5E1; text-align: left;">Total (Company level)</td>
          <td style="padding: 6px 8px; border: 1px solid #CBD5E1; text-align: right;">${fmtActual(totalThisWk)}</td>
          <td style="padding: 6px 8px; border: 1px solid #CBD5E1; text-align: right;">${fmtActual(totalLastWk)}</td>
          <td style="padding: 6px 8px; border: 1px solid #CBD5E1; text-align: right;">${fmtActual(totalLastMth)}</td>
          <td style="padding: 6px 8px; border: 1px solid #CBD5E1; text-align: right;">${fmtActual(totalLastYr)}</td>
          ${getStyledVarTd(totalVarLw)}
          ${getStyledVarTd(totalVarLm)}
          ${getStyledVarTd(totalVarLy)}
        </tr>
      `;

  sortedBrands.forEach((brand) => {
    const brandStores = groupedByBrand[brand];
    
    const brandThisWk = brandStores.reduce((sum, r) => sum + r.thisWk, 0);
    const brandLastWk = brandStores.reduce((sum, r) => sum + r.lastWk, 0);
    const brandLastMth = brandStores.reduce((sum, r) => sum + r.lastMth, 0);
    const brandLastYr = brandStores.reduce((sum, r) => sum + r.lastYr, 0);

    const bLwVars = brandStores.filter(r => r.varLw !== "na").map(r => r.varLw);
    const bLmVars = brandStores.filter(r => r.varLm !== "na").map(r => r.varLm);
    const bLyVars = brandStores.filter(r => r.varLy !== "na").map(r => r.varLy);

    const brandVarLw = bLwVars.length > 0 ? bLwVars.reduce((sum, v) => sum + v, 0) : "na";
    const brandVarLm = bLmVars.length > 0 ? bLmVars.reduce((sum, v) => sum + v, 0) : "na";
    const brandVarLy = bLyVars.length > 0 ? bLyVars.reduce((sum, v) => sum + v, 0) : "na";

    const hasMultiple = brandStores.length > 1;

    if (hasMultiple) {
      // Write Brand Header Row
      html += `
        <tr style="font-weight: bold; color: #0F172A; background-color: #F8FAFC;">
          <td style="padding: 5px 8px; border: 1px solid #CBD5E1; text-align: left;">${brand}</td>
          <td style="padding: 5px 8px; border: 1px solid #CBD5E1; text-align: right;">${fmtActual(brandThisWk)}</td>
          <td style="padding: 5px 8px; border: 1px solid #CBD5E1; text-align: right;">${fmtActual(brandLastWk)}</td>
          <td style="padding: 5px 8px; border: 1px solid #CBD5E1; text-align: right;">${fmtActual(brandLastMth)}</td>
          <td style="padding: 5px 8px; border: 1px solid #CBD5E1; text-align: right;">${fmtActual(brandLastYr)}</td>
          ${getStyledVarTd(brandVarLw)}
          ${getStyledVarTd(brandVarLm)}
          ${getStyledVarTd(brandVarLy)}
        </tr>
      `;

      // Write stores
      brandStores.forEach((store) => {
        html += `
          <tr style="color: #475569;">
            <td style="padding: 4px 8px 4px 20px; border: 1px solid #E2E8F0; text-align: left;">${store.storeName}</td>
            <td style="padding: 4px 8px; border: 1px solid #E2E8F0; text-align: right;">${fmtActual(store.thisWk)}</td>
            <td style="padding: 4px 8px; border: 1px solid #E2E8F0; text-align: right;">${fmtActual(store.lastWk)}</td>
            <td style="padding: 4px 8px; border: 1px solid #E2E8F0; text-align: right;">${fmtActual(store.lastMth)}</td>
            <td style="padding: 4px 8px; border: 1px solid #E2E8F0; text-align: right;">${fmtActual(store.lastYr)}</td>
            ${getStyledVarTd(store.varLw)}
            ${getStyledVarTd(store.varLm)}
            ${getStyledVarTd(store.varLy)}
          </tr>
        `;
      });
    } else {
      // Single store brand
      const store = brandStores[0];
      html += `
        <tr style="font-weight: bold; color: #0F172A;">
          <td style="padding: 5px 8px; border: 1px solid #CBD5E1; text-align: left;">${store.storeName}</td>
          <td style="padding: 5px 8px; border: 1px solid #CBD5E1; text-align: right;">${fmtActual(store.thisWk)}</td>
          <td style="padding: 5px 8px; border: 1px solid #CBD5E1; text-align: right;">${fmtActual(store.lastWk)}</td>
          <td style="padding: 5px 8px; border: 1px solid #CBD5E1; text-align: right;">${fmtActual(store.lastMth)}</td>
          <td style="padding: 5px 8px; border: 1px solid #CBD5E1; text-align: right;">${fmtActual(store.lastYr)}</td>
          ${getStyledVarTd(store.varLw)}
          ${getStyledVarTd(store.varLm)}
          ${getStyledVarTd(store.varLy)}
        </tr>
      `;
    }
  });

  const footerHtml = interpolatedBody ? "" : "<p>Thanks and Regards,</p>";

  html += `
      </tbody>
    </table>
    
    ${footerHtml}
  </div>
  `;

  return html;
}

async function sendEmailReport(fileBuffer, fileName, selectedDate, mailerSettings = null, reportType = "Covers", trendData = null, totals = null, anchorDates = null) {
  const host = mailerSettings?.smtpHost || process.env.SMTP_HOST;
  const port = parseInt(mailerSettings?.smtpPort || process.env.SMTP_PORT || '587');
  const user = mailerSettings?.smtpUser || process.env.SMTP_USER;
  const pass = mailerSettings?.smtpPass || process.env.SMTP_PASS;
  const recipients = mailerSettings?.reportRecipients || process.env.REPORT_RECIPIENTS;
  const senderName = mailerSettings?.senderName || "Linga Reports";

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

  let htmlContent = null;
  if (trendData && totals && anchorDates) {
    try {
      htmlContent = await buildHtmlReport(trendData, totals, selectedDate, anchorDates, reportType, interpolatedBody);
    } catch (err) {
      console.error("Failed to build HTML body for email:", err.message);
    }
  }

  const mailOptions = {
    from: `"${senderName}" <${user}>`,
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

  if (htmlContent) {
    mailOptions.html = htmlContent;
  }

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
            emailResult = await sendEmailReport(excelBuffer, fileName, selectedDate, mailerSettings, "Covers", trendData, totals, anchorDates);
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
            emailResult = await sendEmailReport(excelBuffer, fileName, selectedDate, mailerSettings, "Sales", trendData, totals, anchorDates);
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
    const day = String(d.getUTCDate()).padStart(2, '0');
    const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
    const month = months[d.getUTCMonth()];
    const year = d.getUTCFullYear();
    return `${day}-${month}-${year}`;
  };
  const formatDateString = (d) => {
    const day = String(d.getUTCDate()).padStart(2, '0');
    const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
    return `${day}-${months[d.getUTCMonth()]}-${d.getUTCFullYear()}`;
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
async function runDailyAutomation(isForced = false) {
    const resultsSummary = {
        message: "Scheduled Daily automation run completed.",
        timeChecked: new Date().toISOString(),
        reportsRun: []
    };

    // 2. Fetch automation settings
    const settings = await getAutomationSettingsBackend();
    const mailerSettings = await getMailerSettingsBackend();

    // 3. Check enabled/disabled state
    if (!settings.enabled) {
        console.log("[Cron] Daily automation is disabled in settings.");
        resultsSummary.message = "Daily automation is disabled in settings.";
        return resultsSummary;
    }

    // 4. Check time match (Dubai Time GST / UTC+4)
    if (!isForced) {
        const [targetHour, targetMinute] = (settings.fetchTime || "08:00").split(':').map(Number);
        
        const dubaiTimeStr = new Date().toLocaleString("en-US", { timeZone: "Asia/Dubai" });
        const dubaiDate = new Date(dubaiTimeStr);
        const dubaiHour = dubaiDate.getHours();
        const dubaiMinute = dubaiDate.getMinutes();

        const currentMinOfDay = dubaiHour * 60 + dubaiMinute;
        const targetMinOfDay = targetHour * 60 + targetMinute;

        // Check if current time has passed the target time and is within a 10-minute execution window
        const diff = currentMinOfDay - targetMinOfDay;
        if (diff < 0 || diff >= 10) {
            console.log(`[Cron] Skipping: Dubai time is ${dubaiHour}:${dubaiMinute}, configured time is ${settings.fetchTime}.`);
            resultsSummary.message = `Skipped: current Dubai time (${dubaiHour}:${dubaiMinute}) does not match configured automation time (${settings.fetchTime}).`;
            return resultsSummary;
        }
    }

    console.log("[Cron] Running scheduled Daily Report generation...");

    // 5. Resolve anchor date (yesterday)
    const today = new Date();
    today.setUTCDate(today.getUTCDate() - 1);
    today.setUTCHours(0, 0, 0, 0);
    const selectedDate = today.toISOString().split('T')[0];

    // 3. Calculate 4 anchor dates
    const lastWk = new Date(today);
    lastWk.setUTCDate(today.getUTCDate() - 7);
    const lastMth = new Date(today);
    lastMth.setUTCDate(today.getUTCDate() - 28);
    const lastYr = new Date(today);
    lastYr.setUTCDate(today.getUTCDate() - 364);
    const anchorDates = [today, lastWk, lastMth, lastYr];

    const formatDateString = (d) => {
      const day = String(d.getUTCDate()).padStart(2, '0');
      const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
      return `${day}-${months[d.getUTCMonth()]}-${d.getUTCFullYear()}`;
    };

    // 4. Fetch stores
    const allStores = await getActiveStores();
    const targetStoreIds = settings.selectedStores || [];
    const filteredStores = allStores.filter(store => {
        if (targetStoreIds.length > 0) {
            return targetStoreIds.includes(store.id);
        }
        return true;
    });

    if (filteredStores.length === 0) {
        console.warn("[Cron] No stores resolved for report execution.");
        resultsSummary.message = "No stores resolved for report execution.";
        return resultsSummary;
    }

    // 5. Run Reports depending on Settings
    const reportTypes = settings.reportTypes || ["Covers"];
    
    // -- Covers Tracker execution --
    if (reportTypes.includes("Covers")) {
        console.log(`[Cron] Executing Covers Report for date ${selectedDate}...`);
        const trendData = [];
        const totals = { thisWk: 0, lastWk: 0, lastMth: 0, lastYr: 0 };

        for (let i = 0; i < filteredStores.length; i++) {
            const store = filteredStores[i];
            console.log(`[Cron-Covers] Fetching data for ${store.name}...`);
            const summary = await fetchStoreTrendSummaryBackend(store.id, anchorDates);
            
            const storeData = {
                storeId: store.id,
                storeName: store.name,
                brand: store.brand,
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
            emailResult = await sendEmailReport(excelBuffer, fileName, selectedDate, mailerSettings, "Covers", trendData, totals, anchorDates);
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
    }

    // -- Sales Tracker execution --
    if (reportTypes.includes("Sales")) {
        console.log(`[Cron] Executing Sales Report for date ${selectedDate}...`);
        const trendData = [];
        const totals = { thisWk: 0, lastWk: 0, lastMth: 0, lastYr: 0 };
        const discountsData = [];

        for (let i = 0; i < filteredStores.length; i++) {
            const store = filteredStores[i];
            console.log(`[Cron-Sales] Fetching data for ${store.name}...`);
            const salesSummary = await fetchStoreSalesTrendSummaryBackend(store.id, anchorDates);
            
            const storeData = {
                storeId: store.id,
                storeName: store.name,
                brand: store.brand,
                thisWk: salesSummary[formatDateString(anchorDates[0])]?.netSales || 0,
                lastWk: salesSummary[formatDateString(anchorDates[1])]?.netSales || 0,
                lastMth: salesSummary[formatDateString(anchorDates[2])]?.netSales || 0,
                lastYr: salesSummary[formatDateString(anchorDates[3])]?.netSales || 0,
            };

            trendData.push(storeData);
            totals.thisWk += storeData.thisWk;
            totals.lastWk += storeData.lastWk;
            totals.lastMth += storeData.lastMth;
            totals.lastYr += storeData.lastYr;

            // Fetch discounts for this store's anchor date
            try {
                const discounts = await fetchStoreDiscountsBackend(store.id, selectedDate);
                if (discounts && discounts.length > 0) {
                    discounts.forEach(d => {
                        discountsData.push({
                            storeName: store.name,
                            ...d
                        });
                    });
                }
            } catch (err) {
                console.error("[Cron-Sales] Discount fetch error:", err.message);
            }
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
            emailResult = await sendEmailReport(excelBuffer, fileName, selectedDate, mailerSettings, "Sales", trendData, totals, anchorDates);
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

    return resultsSummary;
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
        const isForced = req.query.force === 'true';
        const summary = await runDailyAutomation(isForced);
        res.json({ success: true, ...summary });
    } catch (error) {
        console.error("[Cron] Execution error:", error);
        res.status(500).json({ error: error.message });
    }
});

// --- Test Automation Trigger Route (Authorized UI Sessions) ---
app.post('/api/v1/cron/test-automation', async (req, res) => {
    try {
        // Forces execution bypassing Dubai time check
        const summary = await runDailyAutomation(true);
        res.json({ success: true, ...summary });
    } catch (error) {
        console.error("[Manual Cron Trigger] Execution error:", error);
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
