import express from 'express';
import cors from 'cors';
import axios from 'axios';

const app = express();

// --- Configuration ---
const LINGA_API_KEY = process.env.LINGA_API_KEY || "UiSg7JagVOd42IEwAnctfWS6qSTaKxxr";
const LINGAPOS_BASE_URL = "https://api.lingaros.com"; 
const AXIOS_TIMEOUT = 240000; // Increase to 4 minutes for large ranges

// --- Middleware ---
app.use(cors({
    origin: true, 
    credentials: true
}));
app.use(express.json());

// --- Helper Function ---
async function callExternalApi(url, params = {}) {
    const start = Date.now();
    console.log(`[Backend] Requesting: ${url} with params: ${JSON.stringify(params)}`);
    try {
        const response = await axios.get(url, {
            headers: { 
                'apikey': LINGA_API_KEY,
                'Content-Type': 'application/json',
                'User-Agent': 'LingaPOS-Analytics/2.5'
            },
            params: params,
            timeout: AXIOS_TIMEOUT
        });
        const duration = Date.now() - start;
        console.log(`[Backend] Success (${duration}ms): ${url}`);
        return response;
    } catch (error) {
        const duration = Date.now() - start;
        if (axios.isAxiosError(error)) {
            const status = error.response?.status || 500;
            const msg = error.response?.data?.message || error.message;
            console.error(`[Backend Error ${status}] after ${duration}ms for ${url}: ${msg}`);
            
            const err = new Error(msg);
            // @ts-ignore
            err.status = status;
            // @ts-ignore
            err.data = error.response?.data;
            throw err;
        }
        console.error(`[Unexpected Error] after ${duration}ms for ${url}: ${error.message}`);
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
        console.log(`\n🚀 Backend running on http://localhost:${PORT}`);
    });
}

export default app;