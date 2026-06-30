import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, doc, getDoc, setDoc, collection, getDocs } from 'firebase/firestore';
import axios from 'axios';

const firebaseConfig = {
  apiKey: "AIzaSyBwjH6rQVmBPWzBF88ZZR-JIa-d-8bJb0Q",
  authDomain: "linga-sales-api.firebaseapp.com",
  projectId: "linga-sales-api",
  storageBucket: "linga-sales-api.firebasestorage.app",
  appId: "1:410696735630:web:53c6232262daad169622df"
};

const LINGA_API_KEY = "UiSg7JagVOd42IEwAnctfWS6qSTaKxxr";
const LINGAPOS_BASE_URL = "https://api.lingaros.com";

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);

// Helper to delay between requests to prevent API rate-limiting
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function callLingaApi(endpoint, params = {}) {
    try {
        const response = await axios.get(`${LINGAPOS_BASE_URL}${endpoint}`, {
            headers: { 
                'apikey': LINGA_API_KEY,
                'Content-Type': 'application/json',
                'User-Agent': 'LingaPOS-Analytics-Enterprise/3.0'
            },
            params: params,
            timeout: 60000
        });
        return response.data;
    } catch (err) {
        console.error(`  [Linga API Error] endpoint: ${endpoint}, params: ${JSON.stringify(params)}, error: ${err.message}`);
        throw err;
    }
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

async function runBackfill() {
    console.log("=== LingaPOS Analytics Historical Database Backfill ===");
    console.log("Initializing database connection...");

    // 1. Get stores list from Firestore
    let stores = [];
    try {
        const snapshot = await getDocs(collection(db, 'stores'));
        snapshot.forEach(doc => {
            const data = doc.data();
            stores.push({ id: data.id, name: data.name });
        });
    } catch (err) {
        console.error("Failed to read stores collection:", err.message);
        return;
    }

    if (stores.length === 0) {
        console.log("No stores found in Firestore 'stores' collection. Seeding fallbacks.");
        stores = [
            { name: "Common Grounds DIFC", id: "5e4be85b7237b70001de9106" },
            { name: "Common Grounds DMCC", id: "5e4be880716db00001c7b6f1" },
            { name: "Common Grounds MOE", id: "5e4be8da7237b70001de914d" },
            { name: "Tom and Serg", id: "5e4be9307237b70001de9193" },
            { name: "The Sum of Us", id: "5e4be949e8ce4c00019fe377" }
        ];
    }

    console.log(`Targeting ${stores.length} venues:`, stores.map(s => s.name).join(", "));

    // 2. Generate date range (Jan 1, 2025 to today)
    const startDate = new Date('2025-01-01');
    const endDate = new Date();
    const dateStrings = [];
    let current = new Date(startDate);
    while (current <= endDate) {
        dateStrings.push(current.toISOString().split('T')[0]);
        current.setDate(current.getDate() + 1);
    }

    console.log(`Generated date range: ${dateStrings[0]} to ${dateStrings[dateStrings.length - 1]} (${dateStrings.length} days total)`);
    console.log("Starting backfill sequence sequentially to respect rate limits...\n");

    let totalSaved = 0;
    let totalSkipped = 0;

    for (let d = 0; d < dateStrings.length; d++) {
        const dateStr = dateStrings[d];

        console.log(`[Progress] Day ${d + 1}/${dateStrings.length} (${((d + 1) / dateStrings.length * 100).toFixed(1)}%) - Target: ${dateStr}`);

        for (const store of stores) {
            const cacheKey = `${store.id}_${dateStr}`;
            
            // Define collections to cache
            const cacheCollections = [
                { name: 'sales_cache', endpoint: `/v1/lingapos/store/${store.id}/getsale`, params: { fromDate: formatToLingaDate(dateStr), toDate: formatToLingaDate(dateStr) } },
                { name: 'discounts_cache', endpoint: `/v1/lingapos/store/${store.id}/discountReport`, params: { dateOption: 'DR', fromDate: formatToLingaDate(dateStr), toDate: formatToLingaDate(dateStr), selectedReportType: 'By Discount Type' } },
                { name: 'sale_reports_cache', endpoint: `/v1/lingapos/store/${store.id}/saleReport`, params: { dateOption: 'DR', employeeGroup: 'N', fromDate: formatToLingaDate(dateStr), toDate: formatToLingaDate(dateStr), isDetailedView: 'false', numberOfDay: '', page: 1, reportType: '', selectedEmployee: '', selectedItemId: '', specificDate: '', type: 'MENUITEM' } },
                { name: 'sale_summaries_cache', endpoint: `/v1/lingapos/store/${store.id}/saleSummaryReport`, params: { dateOption: 'DR', fromDate: formatToLingaDate(dateStr), toDate: formatToLingaDate(dateStr) } }
            ];

            for (const col of cacheCollections) {
                const docRef = doc(db, col.name, cacheKey);
                try {
                    // Check if already cached
                    const snap = await getDoc(docRef);
                    if (snap.exists()) {
                        totalSkipped++;
                        continue; // Already cached, skip to next collection
                    }

                    // Miss, fetch from API
                    console.log(`  -> Fetching ${col.name} for ${store.name}...`);
                    const data = await callLingaApi(col.endpoint, col.params);
                    
                    // Prune data before saving to keep it under 1MB Limit
                    let prunedData = data;
                    if (col.name === 'sales_cache') prunedData = pruneSalesData(data);
                    else if (col.name === 'discounts_cache') prunedData = pruneDiscountData(data);
                    else if (col.name === 'sale_reports_cache') prunedData = pruneSaleReportData(data);
                    else if (col.name === 'sale_summaries_cache') prunedData = pruneSummaryData(data);
                    
                    // Save to Firestore
                    await setDoc(docRef, {
                        storeId: store.id,
                        date: dateStr,
                        data: prunedData,
                        createdAt: new Date().toISOString()
                    });
                    
                    totalSaved++;
                    // Delay between fetches to respect API limits
                    await delay(800);
                } catch (err) {
                    console.error(`  [Cache Save Failure] Store: ${store.name}, date: ${dateStr}, collection: ${col.name}, error: ${err.message}`);
                    // Wait a bit longer on error before retrying
                    await delay(3000);
                }
            }
        }
    }

    console.log("\n=== Backfill Completed ===");
    console.log(`Total items cached successfully: ${totalSaved}`);
    console.log(`Total cached items skipped: ${totalSkipped}`);
    process.exit(0);
}

runBackfill();
