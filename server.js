import express from 'express';
import cors from 'cors';
import axios from 'axios';

const app = express();

// 1. Strict CORS policy
app.use(cors({
    origin: true, 
    credentials: true,
    methods: ['GET', 'POST', 'OPTIONS']
}));

// 2. Body Parser
app.use(express.json());

// 3. The Proxy Route
app.post('/api/proxy', async (req, res) => {
    // Hardcoded key as fallback if ENV is missing
    const LINGA_API_KEY = process.env.LINGA_API_KEY || "UiSg7JagVOd42IEwAnctfWS6qSTaKxxr";
    const API_BASE_URL = "https://api.lingapos.com";

    try {
        const { endpoint, method = 'GET', params, body } = req.body;

        if (!endpoint) {
            return res.status(400).json({ error: "Missing 'endpoint' in request body" });
        }

        // Clean up the endpoint URL
        const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
        const url = `${API_BASE_URL}${cleanEndpoint}`;

        console.log(`[Proxy] ${method} -> ${url}`);

        // Forward the request to LingaPOS
        // Added User-Agent and extended timeout to prevent Vercel 504/500s
        const response = await axios({
            url: url,
            method: method,
            params: params,
            data: body,
            headers: {
                'apikey': LINGA_API_KEY,
                'Content-Type': 'application/json',
                'User-Agent': 'LingaPOS-Analytics-App/1.0',
                'Accept': 'application/json'
            },
            timeout: 25000 // 25 seconds timeout
        });

        // Send back the data
        res.status(200).json(response.data);

    } catch (error) {
        // Detailed Error Handling for the Frontend
        const status = error.response ? error.response.status : 500;
        const errorMessage = error.response?.data?.message || error.message || "Unknown Proxy Error";
        const errorDetails = error.response?.data || {};

        console.error(`[Proxy Error ${status}]`, errorMessage);

        return res.status(status).json({ 
            error: errorMessage,
            details: errorDetails,
            isProxyError: true
        });
    }
});

// 4. Local Development Helper
const PORT = process.env.PORT || 3000;
if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, () => {
        console.log(`\n🚀 Local Node.js Server running on http://localhost:${PORT}`);
    });
}

export default app;