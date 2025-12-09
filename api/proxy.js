import axios from 'axios';

export default async function handler(req, res) {
  // 1. Force CORS Headers on EVERY response (Success or Error)
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, apikey'
  );

  // 2. Handle Preflight OPTIONS
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // 3. Get API Key
  const LINGA_API_KEY = process.env.LINGA_API_KEY || "UiSg7JagVOd42IEwAnctfWS6qSTaKxxr";
  const API_BASE_URL = "https://api.lingapos.com";

  // Debug Log (Visible in Vercel Logs)
  console.log("Request received. API Key Present:", !!LINGA_API_KEY);

  try {
    let bodyData = req.body;
    
    // Parse body if it came as a string
    if (typeof bodyData === 'string') {
        try { bodyData = JSON.parse(bodyData); } catch (e) {}
    }
    if (!bodyData) bodyData = {};

    const { endpoint, method = 'GET', params, body: requestBody } = bodyData;

    if (!endpoint) {
      console.error("Error: Missing endpoint");
      return res.status(400).json({ error: "Missing 'endpoint' in request body" });
    }

    console.log(`Forwarding ${method} request to: ${API_BASE_URL}${endpoint}`);

    const response = await axios({
      url: `${API_BASE_URL}${endpoint}`,
      method: method,
      params: params,
      data: requestBody,
      headers: {
        'apikey': LINGA_API_KEY,
        'Content-Type': 'application/json'
      }
    });

    return res.status(200).json(response.data);

  } catch (error) {
    console.error("PROXY FAILED:", error.message);
    
    if (error.response) {
      // Log the full error from LingaPOS to Vercel logs
      console.error("Upstream Status:", error.response.status);
      console.error("Upstream Data:", JSON.stringify(error.response.data));
      
      return res.status(error.response.status).json(error.response.data);
    }
    
    return res.status(500).json({ 
      error: "Internal Server Error", 
      details: error.message 
    });
  }
}