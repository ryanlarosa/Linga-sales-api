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
                { name: 'sales_cache', endpoint: `/v1/lingapos/store/${store.id}/getsale`, params: { fromDate: dateStr, toDate: dateStr } },
                { name: 'discounts_cache', endpoint: `/v1/lingapos/store/${store.id}/discountReport`, params: { dateOption: 'DR', fromDate: dateStr, toDate: dateStr, selectedReportType: 'By Discount Type' } },
                { name: 'sale_reports_cache', endpoint: `/v1/lingapos/store/${store.id}/saleReport`, params: { dateOption: 'DR', employeeGroup: 'N', fromDate: dateStr, toDate: dateStr, isDetailedView: 'false', numberOfDay: '', page: 1, reportType: '', selectedEmployee: '', selectedItemId: '', specificDate: '', type: 'MENUITEM' } },
                { name: 'sale_summaries_cache', endpoint: `/v1/lingapos/store/${store.id}/saleSummaryReport`, params: { dateOption: 'DR', fromDate: dateStr, toDate: dateStr } }
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
                    
                    // Save to Firestore
                    await setDoc(docRef, {
                        storeId: store.id,
                        date: dateStr,
                        data: data,
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
