
import express from 'express';
import cors from 'cors';
import axios from 'axios';

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
app.use(express.json());

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

const PORT = process.env.PORT || 3000;
if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, () => {
        console.log(`Backend Active: http://localhost:${PORT}`);
    });
}

export default app;
