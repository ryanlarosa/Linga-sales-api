/**
 * VERCEL SERVERLESS FUNCTION
 * This file automatically becomes an API endpoint at /api/proxy
 */
import axios from 'axios';

const LINGA_API_KEY = process.env.LINGA_API_KEY || "UiSg7JagVOd42IEwAnctfWS6qSTaKxxr";
const API_BASE_URL = "https://api.lingapos.com";

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const { endpoint, method = 'GET', params, body } = req.body;

  if (!endpoint) {
    return res.status(400).json({ error: "Missing 'endpoint' in request body" });
  }

  try {
    const response = await axios({
      url: `${API_BASE_URL}${endpoint}`,
      method: method,
      params: params,
      data: body,
      headers: {
        'apikey': LINGA_API_KEY,
        'Content-Type': 'application/json'
      }
    });

    res.status(200).json(response.data);
  } catch (error) {
    const status = error.response ? error.response.status : 500;
    const data = error.response ? error.response.data : { error: error.message };
    res.status(status).json(data);
  }
}