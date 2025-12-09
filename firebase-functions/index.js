/**
 * FIREBASE CLOUD FUNCTION PROXY
 * 
 * This file is designed to run on Firebase Cloud Functions.
 * It acts as a secure middleman between your React App and the LingaPOS API.
 * 
 * deployment: firebase deploy --only functions
 */

const functions = require("firebase-functions");
const axios = require("axios");
const cors = require("cors")({ origin: true });

// You should store this in Firebase config: firebase functions:config:set linga.key="YOUR_KEY"
// For now, we use the hardcoded key or a process environment variable
const LINGA_API_KEY = process.env.LINGA_API_KEY || "UiSg7JagVOd42IEwAnctfWS6qSTaKxxr";
const API_BASE_URL = "https://api.lingapos.com";

exports.lingaProxy = functions.https.onRequest((req, res) => {
  // Enable CORS (Cross-Origin Resource Sharing)
  cors(req, res, async () => {
    try {
      // 1. Extract the target endpoint and method from the client request
      // The client sends: { endpoint: "/v1/lingapos/...", method: "GET" }
      const { endpoint, method = 'GET', params, body } = req.body;

      if (!endpoint) {
        return res.status(400).json({ error: "Missing 'endpoint' in request body" });
      }

      console.log(`Proxying request to: ${endpoint}`);

      // 2. Make the actual server-to-server call to LingaPOS
      const response = await axios({
        url: `${API_BASE_URL}${endpoint}`,
        method: method,
        params: params, // Query parameters (e.g., ?fromDate=...)
        data: body,     // Body for POST requests
        headers: {
          'apikey': LINGA_API_KEY,
          'Content-Type': 'application/json'
        }
      });

      // 3. Return the data to the React App
      return res.status(200).json(response.data);

    } catch (error) {
      console.error("LingaPOS API Error:", error.message);
      
      const status = error.response ? error.response.status : 500;
      const data = error.response ? error.response.data : { error: error.message };
      
      return res.status(status).json(data);
    }
  });
});