import express from 'express';
import cors from 'cors';
import axios from 'axios';

const app = express();

// --- Configuration ---
const LINGA_API_KEY = process.env.LINGA_API_KEY || "UiSg7JagVOd42IEwAnctfWS6qSTaKxxr";
// Correcting the base URL based on standard Linga docs, but keeping structure of your reference
const LINGAPOS_BASE_URL = "https://api.lingapos.com"; 
const AXIOS_TIMEOUT = 120000; // 120 seconds

// --- Middleware ---
app.use(cors({
    origin: true, 
    credentials: true
}));
app.use(express.json());

// --- Helper Function ---
async function callExternalApi(url, params = {}) {
    console.log(`[Backend] Requesting: ${url}`);
    try {
        const response = await axios.get(url, {
            headers: { 
                'apikey': LINGA_API_KEY,
                'Content-Type': 'application/json',
                'User-Agent': 'LingaPOS-Analytics/2.0'
            },
            params: params,
            timeout: AXIOS_TIMEOUT
        });
        return response;
    } catch (error) {
        if (axios.isAxiosError(error)) {
            const status = error.response?.status || 500;
            const msg = error.response?.data?.message || error.message;
            console.error(`[Backend Error ${status}] ${url}: ${msg}`);
            
            // Re-throw with status attached for the route handler
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

// --- API Routes (Prefix with /api to match Vercel routing) ---

// 1. Get Sale
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

// 2. Discount Report
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

// 3. Layout (Floors)
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

// 4. Users
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

// 5. Sale Report (Menu Items)
app.get('/api/v1/lingapos/store/:storeId/saleReport', async (req, res) => {
    try {
        const { storeId } = req.params;
        // Pass all query params through
        const url = `${LINGAPOS_BASE_URL}/v1/lingapos/store/${storeId}/saleReport`;
        const response = await callExternalApi(url, req.query);
        res.json(response.data);
    } catch (error) {
        res.status(error.status || 500).json(error.data || { error: error.message });
    }
});

// 6. Sale Summary Report
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

// --- Local Dev Server ---
const PORT = process.env.PORT || 3000;
if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, () => {
        console.log(`\n🚀 Backend running on http://localhost:${PORT}`);
    });
}

export default app;