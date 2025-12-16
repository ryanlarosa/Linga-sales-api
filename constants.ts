import { Store, User } from './types';

// NOTE: These hardcoded stores are a fallback. The app will prioritize Firestore data if available.
export const STORE_LIST: Store[] = [
  { name: "Common Grounds DIFC", id: "5e4be85b7237b70001de9106" },
  { name: "Common Grounds DMCC", id: "5e4be880716db00001c7b6f1" },
  { name: "Common Grounds MOE", id: "5e4be8da7237b70001de914d" },
  { name: "Tom and Serg", id: "5e4be9307237b70001de9193" },
  { name: "The Sum of Us", id: "5e4be949e8ce4c00019fe377" }
];

// --- MOCK DATABASE USERS ---
export const MOCK_USERS: User[] = [
  { 
    username: 'admin', 
    password: 'admin', 
    role: 'superuser', // CHANGED: 'admin' username is now the Superuser (You)
    name: 'System Owner', 
    allowedStores: [] // Superuser sees everything
  },
  {
    username: 'manager',
    password: 'password',
    role: 'admin', // CHANGED: 'admin' role now means "Read All, No Config"
    name: 'Operations Manager',
    allowedStores: [] // Admin sees everything
  },
  { 
    username: 'user', 
    password: 'user', 
    role: 'user', 
    name: 'Store Manager', 
    allowedStores: ['5e4be85b7237b70001de9106'] // Restricted access
  }
];

export const API_KEY = "UiSg7JagVOd42IEwAnctfWS6qSTaKxxr";
export const API_BASE_URL = "https://api.lingaros.com";
export const BACKEND_URL = "/api/proxy"; 
export const USE_MOCK_DATA = false;