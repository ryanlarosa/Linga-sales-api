import { Store } from './types';

export const STORE_LIST: Store[] = [
  { name: "Common Grounds DIFC", id: "5e4be85b7237b70001de9106" },
  { name: "Common Grounds DMCC", id: "5e4be880716db00001c7b6f1" },
  { name: "Common Grounds MOE", id: "5e4be8da7237b70001de914d" },
  { name: "Common Grounds Upside", id: "685aa0048e86c4a0e4df9880" },
  { name: "Tom and Serg", id: "5e4be9307237b70001de9193" },
  { name: "The Sum of Us", id: "5e4be949e8ce4c00019fe377" },
  { name: "Encounter Coffee ICD L1", id: "5f4c8bbd338ef10001f51fa5" },
  { name: "Encounter Coffee Al Salam", id: "5f75d775dcc6a000019f146f" },
  { name: "Common Grounds JBR", id: "5ffef53e48ba470001488fd6" },
  { name: "Encounter Coffee ICD L30", id: "6196416b8e33cb5327d6d05c" },
  { name: "Harvest & Co (Warehouse Gym)", id: "6204e66bead709e70bb08682" },
  { name: "Byron Bathers Club", id: "621f7b908f050b110a7987f9" },
  { name: "Splendour Fields", id: "621f7bf38f050b110a798d76" },
  { name: "Hawkerboi", id: "621f7c1a8f050b110a799088" },
  { name: "Harvest & Co (Garden Centre)", id: "622aec3cf972f86c1ea86514" },
  { name: "Encounter Coffee MOE", id: "627a00d81f1f2c58435a227a" },
  { name: "Common Grounds DHM", id: "62bac76eda6ec1a3cd72a67f" },
  { name: "Common Grounds Nakheel Mall", id: "6315e7c878d1380be53c0d70" },
  { name: "DMCC Lounge", id: "6363685d16d6b00e0d27b773" },
  { name: "Encounter Coffee H&H", id: "63b3f318386d34df337fa131" },
  { name: "Frankys Pizzeria", id: "63d0d31fc2091c1ff32eb975" },
  { name: "Encounter Coffee Internet City", id: "64c0d6baefad72745ad3bba4" },
  { name: "Common Grounds Kite Beach", id: "6530e1cf5f90feddc15e651c" },
  { name: "The Guild Restaurant", id: "64a7fd77e6251d77d453b0f5" }
];

// --- MOCK DATABASE USERS ---
// In a real Firestore app, this would be a collection 'users'
export const MOCK_USERS = [
  { 
    username: 'admin', 
    password: 'admin', 
    role: 'admin', 
    name: 'Administrator', 
    allowedStores: [] // Empty implies ALL access for admin
  },
  { 
    username: 'user', 
    password: 'user', 
    role: 'user', 
    name: 'Sales Associate', 
    allowedStores: ['5e4be85b7237b70001de9106'] // Only Common Grounds DIFC
  },
  {
    username: 'area',
    password: 'area',
    role: 'user',
    name: 'Area Manager',
    allowedStores: [
      '5e4be85b7237b70001de9106', // DIFC
      '5e4be880716db00001c7b6f1', // DMCC
      '5e4be8da7237b70001de914d'  // MOE
    ]
  }
];

export const API_KEY = "UiSg7JagVOd42IEwAnctfWS6qSTaKxxr";
// Updated to lingaros.com based on working backend reference
export const API_BASE_URL = "https://api.lingaros.com";

// On Vercel, the API lives at the same domain in the /api folder
export const BACKEND_URL = "/api/proxy"; 

// Set to true to force using the mock data generator engine
export const USE_MOCK_DATA = false;