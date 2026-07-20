import { User, Store, AutomationSettings, MailerSettings, ReportLog } from "../types";
import { MOCK_USERS, STORE_LIST } from "../constants";

const getAuthHeaders = () => {
  const currentUserStr = localStorage.getItem("linga_analytics_user");
  const currentUser = currentUserStr ? JSON.parse(currentUserStr) : null;
  return {
    "Content-Type": "application/json",
    "x-user-username": currentUser?.username || ""
  };
};

const fetchFromDb = async (url: string, options: RequestInit = {}) => {
  const headers = {
    ...getAuthHeaders(),
    ...options.headers
  };
  const res = await fetch(url, { ...options, headers });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `HTTP error! status: ${res.status}`);
  }
  return res.json();
};

export const initializeDatabase = async (): Promise<boolean> => {
  // Auto-seeding is triggered by backend automatically on login when Firestore user collection is empty.
  return true;
};

// --- USERS ---

export const getUsers = async (): Promise<User[]> => {
  try {
    const res = await fetchFromDb('/api/v1/db/users');
    return res.users || [];
  } catch (error) {
    console.error("Error getting users:", error);
    return MOCK_USERS;
  }
};

export const addUser = async (user: User): Promise<void> => {
  await fetchFromDb('/api/v1/db/users', {
    method: 'POST',
    body: JSON.stringify(user)
  });
};

export const updateUser = async (username: string, updates: Partial<User>): Promise<void> => {
  await fetchFromDb(`/api/v1/db/users/${username}`, {
    method: 'PUT',
    body: JSON.stringify(updates)
  });
};

export const deleteUser = async (username: string): Promise<void> => {
  await fetchFromDb(`/api/v1/db/users/${username}`, {
    method: 'DELETE'
  });
};

export const loginUser = async (username: string, password: string): Promise<User | null> => {
  try {
    const res = await fetch('/api/v1/db/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    if (!res.ok) {
      // Auth fail fallback
      const mock = MOCK_USERS.find(u => u.username === username && u.password === password);
      if (mock) {
        return {
          username: mock.username,
          role: mock.role as 'superuser' | 'admin' | 'user',
          name: mock.name,
          allowedStores: mock.allowedStores
        };
      }
      return null;
    }
    const data = await res.json();
    return data.user;
  } catch (error) {
    console.error("Error logging in:", error);
    // Connection fail fallback
    const mock = MOCK_USERS.find(u => u.username === username && u.password === password);
    if (mock) {
      return {
        username: mock.username,
        role: mock.role as 'superuser' | 'admin' | 'user',
        name: mock.name,
        allowedStores: mock.allowedStores
      };
    }
    return null;
  }
};

// --- STORES ---

export const addStore = async (store: Store): Promise<void> => {
  await fetchFromDb('/api/v1/db/stores', {
    method: 'POST',
    body: JSON.stringify(store)
  });
};

export const deleteStore = async (storeId: string): Promise<void> => {
  await fetchFromDb(`/api/v1/db/stores/${storeId}`, {
    method: 'DELETE'
  });
};

export const getStores = async (): Promise<Store[]> => {
  try {
    const res = await fetchFromDb('/api/v1/db/stores');
    return res.stores || [];
  } catch (error) {
    console.error("Error fetching stores:", error);
    return STORE_LIST;
  }
};

// --- CONFIGS ---

export const getAutomationSettings = async (): Promise<AutomationSettings> => {
  try {
    const res = await fetchFromDb('/api/v1/db/configs/cover_tracker_automation');
    return res.data || { enabled: true, fetchTime: "08:00" };
  } catch (error) {
    console.error("Error getting automation settings:", error);
    return { enabled: true, fetchTime: "08:00" };
  }
};

export const updateAutomationSettings = async (settings: AutomationSettings): Promise<void> => {
  await fetchFromDb('/api/v1/db/configs/cover_tracker_automation', {
    method: 'POST',
    body: JSON.stringify(settings)
  });
};

export const getMailerSettings = async (): Promise<MailerSettings> => {
  try {
    const res = await fetchFromDb('/api/v1/db/configs/mailer_settings');
    return res.data || {};
  } catch (error) {
    console.error("Error getting mailer settings:", error);
    return {};
  }
};

export const updateMailerSettings = async (settings: MailerSettings): Promise<void> => {
  await fetchFromDb('/api/v1/db/configs/mailer_settings', {
    method: 'POST',
    body: JSON.stringify(settings)
  });
};

// --- LOGS ---

export const getReportLogs = async (): Promise<ReportLog[]> => {
  try {
    const res = await fetchFromDb('/api/v1/db/logs');
    return res.logs || [];
  } catch (error) {
    console.error("Error getting report logs:", error);
    return [];
  }
};

export const addReportLog = async (log: ReportLog): Promise<void> => {
  // Managed by server automatically during automated or manual runs.
};

// --- BRAND ORDER ---

export const getBrandOrder = async (): Promise<string[]> => {
  try {
    const res = await fetchFromDb('/api/v1/db/configs/brand_order');
    return res.data?.brands || [];
  } catch (error) {
    console.error("Error getting brand order:", error);
    return [];
  }
};

export const updateBrandOrder = async (brands: string[]): Promise<void> => {
  await fetchFromDb('/api/v1/db/configs/brand_order', {
    method: 'POST',
    body: JSON.stringify({ brands })
  });
};

// --- CACHING SETTINGS ---

export const getCachingSettings = async (): Promise<{ enabled: boolean }> => {
  try {
    const res = await fetchFromDb('/api/v1/db/configs/caching_settings');
    return { enabled: res.data?.enabled !== false };
  } catch (error) {
    console.error("Error getting caching settings:", error);
    return { enabled: true };
  }
};

export const updateCachingSettings = async (enabled: boolean): Promise<void> => {
  await fetchFromDb('/api/v1/db/configs/caching_settings', {
    method: 'POST',
    body: JSON.stringify({ enabled })
  });
};