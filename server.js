import express from 'express';
import cors from 'cors';
import axios from 'axios';

const app = express();

// 1. Strict CORS policy handled by Node.js
app.use(cors({
    origin: true, // Allow all origins (or specify your frontend URL)
    credentials: true,
    methods: ['GET', 'POST', 'OPTIONS']
}));

// 2. Body Parser
app.use(express.json());

// 3. The Proxy Route
app.post('/api/proxy', async (req, res) => {
    const LINGA_API_KEY = process.env.LINGA_API_KEY || "UiSg7JagVOd42IEwAnctfWS6qSTaKxxr";
    const API_BASE_URL = "https://api.lingapos.com";

    // Debugging Log
    console.log(`[NodeJS Proxy] Request received for: ${req.body?.endpoint}`);

    try {
        const { endpoint, method = 'GET', params, body } = req.body;

        if (!endpoint) {
            return res.status(400).json({ error: "Missing 'endpoint' in request body" });
        }

        // Clean up the endpoint URL
        const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
        const url = `${API_BASE_URL}${cleanEndpoint}`;

        // Forward the request to LingaPOS
        const response = await axios({
            url: url,
            method: method,
            params: params,
            data: body,
            headers: {
                'apikey': LINGA_API_KEY,
                'Content-Type': 'application/json'
            }
        });

        // Send back the data
        res.status(200).json(response.data);

    } catch (error) {
        // Detailed Error Handling
        if (error.response) {
            // The upstream API returned an error (4xx or 5xx)
            console.error(`[Upstream Error] ${error.response.status}:`, JSON.stringify(error.response.data));
            return res.status(error.response.status).json(error.response.data);
        } else if (error.request) {
            // No response received
            console.error("[Network Error] No response from LingaPOS");
            return res.status(503).json({ error: "No response from LingaPOS API" });
        } else {
            // Request setup error
            console.error("[Internal Error]", error.message);
            return res.status(500).json({ error: error.message });
        }
    }
});

// 4. Local Development Helper
// If this file is run directly (node server.js), listen on port 3000
const PORT = process.env.PORT || 3000;
if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, () => {
        console.log(`\n🚀 Local Node.js Server running on http://localhost:${PORT}`);
        console.log(`➜ Proxy available at http://localhost:${PORT}/api/proxy\n`);
    });
}

export default app;