export default async function handler(req, res) {
  // 1. Force CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, apikey'
  );

  // 2. Handle Preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // 3. Configuration
  const LINGA_API_KEY = process.env.LINGA_API_KEY || "UiSg7JagVOd42IEwAnctfWS6qSTaKxxr";
  const API_BASE_URL = "https://api.lingapos.com";

  try {
    // 4. Parse Body safely
    let bodyData = req.body;
    if (typeof bodyData === 'string') {
        try { bodyData = JSON.parse(bodyData); } catch (e) {}
    }
    if (!bodyData) bodyData = {};

    const { endpoint, method = 'GET', body: requestBody } = bodyData;

    if (!endpoint) {
      return res.status(400).json({ error: "Missing 'endpoint' in request body" });
    }

    console.log(`[Proxy] ${method} -> ${endpoint}`);

    // 5. Native Fetch Request (No Axios dependency)
    // Note: 'endpoint' usually contains the query string already (e.g. /v1/sale?date=...)
    // We construct the full URL carefully.
    const fullUrl = `${API_BASE_URL}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;

    const response = await fetch(fullUrl, {
      method: method,
      headers: {
        'apikey': LINGA_API_KEY,
        'Content-Type': 'application/json'
      },
      body: (method !== 'GET' && method !== 'HEAD') ? JSON.stringify(requestBody) : undefined
    });

    // 6. Handle Response
    const responseText = await response.text();
    let responseData;
    
    try {
        responseData = JSON.parse(responseText);
    } catch (e) {
        responseData = { message: responseText };
    }

    if (!response.ok) {
      console.error(`[Proxy Error] Upstream ${response.status}:`, responseData);
      return res.status(response.status).json(responseData);
    }

    return res.status(200).json(responseData);

  } catch (error) {
    console.error("[Proxy Critical Fail]", error);
    return res.status(500).json({ 
      error: "Internal Proxy Error", 
      details: error.message 
    });
  }
}