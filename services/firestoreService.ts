import { db } from "./firebase";
import { collection, getDocs, query, where, doc, setDoc, deleteDoc, updateDoc, QueryDocumentSnapshot, DocumentData, getDoc, orderBy } from "firebase/firestore";
import { User, Store, AutomationSettings, MailerSettings, ReportLog } from "../types";
import { MOCK_USERS, STORE_LIST } from "../constants";

// Helper to check if error is due to missing DB setup in Console
const isMissingDbError = (error: any) => {
    return error?.code === 'not-found' || 
           (error?.message && error.message.includes('database (default) does not exist'));
};

const hashPassword = async (password: string): Promise<string> => {
  const msgBuffer = new TextEncoder().encode(password);
  const hashBuffer = await window.crypto.subtle.digest("SHA-256", msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
};

// --- DB INITIALIZATION ---

export const initializeDatabase = async () => {
  try {
    console.log("Starting Database Initialization...");
    
    // Check connection by trying to write one user first
    try {
        await setDoc(doc(db, "users", MOCK_USERS[0].username), MOCK_USERS[0]);
    } catch (e: any) {
        if (isMissingDbError(e)) {
            throw new Error("FIRESTORE NOT SETUP: Please go to the Firebase Console, select 'Firestore Database' and click 'Create Database'.");
        }
        throw e;
    }
    
    // 1. Seed Remaining Users
    for (const user of MOCK_USERS) {
        if(user.username !== MOCK_USERS[0].username) {
             await setDoc(doc(db, "users", user.username), user);
        }
    }
    console.log("Users seeded.");

    // 2. Seed Stores
    for (const store of STORE_LIST) {
        await setDoc(doc(db, "stores", store.id), {
            id: store.id,
            name: store.name
        });
    }
    console.log("Stores seeded.");
    
    return true;
  } catch (error: any) {
    console.error("Failed to initialize database:", error);
    throw error;
  }
};

// --- USERS ---

export const getUsers = async (): Promise<User[]> => {
    try {
        const usersRef = collection(db, "users");
        const snapshot = await getDocs(usersRef);
        const users: User[] = [];
        snapshot.forEach((doc) => {
            users.push(doc.data() as User);
        });
        return users;
    } catch (error) {
        console.error("Error getting users:", error);
        return MOCK_USERS;
    }
};

export const addUser = async (user: User): Promise<void> => {
    try {
        const userToSave = { ...user };
        if (userToSave.password) {
            userToSave.password = await hashPassword(userToSave.password);
        }
        await setDoc(doc(db, "users", user.username), userToSave);
    } catch (error) {
        console.error("Error adding user:", error);
        throw error;
    }
};

export const updateUser = async (username: string, updates: Partial<User>): Promise<void> => {
    try {
        const updatesToSave = { ...updates };
        if (updatesToSave.password) {
            updatesToSave.password = await hashPassword(updatesToSave.password);
        }
        const userRef = doc(db, "users", username);
        await updateDoc(userRef, updatesToSave);
    } catch (error) {
        console.error("Error updating user:", error);
        throw error;
    }
}

export const deleteUser = async (username: string): Promise<void> => {
    try {
        await deleteDoc(doc(db, "users", username));
    } catch (error) {
        console.error("Error deleting user:", error);
        throw error;
    }
}

export const loginUser = async (username: string, password: string): Promise<User | null> => {
  try {
    const usersRef = collection(db, "users");
    const q = query(usersRef, where("username", "==", username));
    
    // We try to fetch. If the DB doesn't exist, this throws.
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      // If DB exists but is empty, try seeding
      const allUsers = await getDocs(usersRef);
      if (allUsers.empty) {
          console.log("Database appears empty. Auto-seeding...");
          await initializeDatabase();
          return loginUser(username, password);
      }
      return null;
    }

    const hashedPassword = await hashPassword(password);
    let foundUser: User | null = null;
    
    for (const d of querySnapshot.docs) {
      const userData = d.data();
      if (userData.password === password || userData.password === hashedPassword) {
        // Auto-upgrade if it's plaintext
        if (userData.password === password) {
          try {
            await updateDoc(doc(db, "users", username), { password: hashedPassword });
            console.log(`[Security] Auto-upgraded password hash for user ${username}`);
          } catch (e: any) {
            console.error("Failed to auto-upgrade legacy plaintext password:", e.message);
          }
        }
        foundUser = {
          username: userData.username,
          role: userData.role as 'superuser' | 'admin' | 'user',
          name: userData.name,
          allowedStores: userData.allowedStores
        };
        break;
      }
    }

    return foundUser;
  } catch (error) {
    // Graceful fallback without scary console errors if it's just missing setup
    if (isMissingDbError(error)) {
        console.warn("Firestore not configured. Using local mock users.");
    } else {
        console.error("Error logging in via Firestore:", error);
    }

    // Fallback to MOCK_USERS
    const mock = MOCK_USERS.find(u => u.username === username && u.password === password);
    if(mock) {
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
    try {
        await setDoc(doc(db, "stores", store.id), store);
    } catch (error) {
        console.error("Error adding store:", error);
        throw error;
    }
};

export const deleteStore = async (storeId: string): Promise<void> => {
    try {
        await deleteDoc(doc(db, "stores", storeId));
    } catch (error) {
        console.error("Error deleting store:", error);
        throw error;
    }
};

export const getStores = async (): Promise<Store[]> => {
  try {
    const storesRef = collection(db, "stores");
    const snapshot = await getDocs(storesRef);

    if (snapshot.empty) {
        // Only try seeding if we didn't crash on getDocs
        await initializeDatabase();
        return STORE_LIST;
    }

    const stores: Store[] = [];
    snapshot.forEach((doc: QueryDocumentSnapshot<DocumentData>) => {
      const data = doc.data();
      stores.push({
        id: data.id || doc.id,
        name: data.name,
        brand: data.brand,
        active: data.active !== false
      });
    });
    
    return stores;
  } catch (error) {
    if (isMissingDbError(error)) {
        console.warn("Firestore not configured. Using local store list.");
    } else {
        console.error("Error fetching stores:", error);
    }
    return STORE_LIST; 
  }
};

export const getAutomationSettings = async (): Promise<AutomationSettings> => {
  try {
    const docRef = doc(db, "configs", "cover_tracker_automation");
    const snapshot = await getDoc(docRef);
    if (snapshot.exists()) {
      return snapshot.data() as AutomationSettings;
    }
    return { enabled: true, fetchTime: "08:00" };
  } catch (error) {
    if (isMissingDbError(error)) {
        console.warn("Firestore not configured. Using default automation settings.");
    } else {
        console.error("Error getting automation settings:", error);
    }
    return { enabled: true, fetchTime: "08:00" };
  }
};

export const updateAutomationSettings = async (settings: AutomationSettings): Promise<void> => {
  try {
    const docRef = doc(db, "configs", "cover_tracker_automation");
    await setDoc(docRef, settings, { merge: true });
  } catch (error) {
    console.error("Error updating automation settings:", error);
    throw error;
  }
};

export const getMailerSettings = async (): Promise<MailerSettings> => {
  try {
    const docRef = doc(db, "configs", "mailer_settings");
    const snapshot = await getDoc(docRef);
    if (snapshot.exists()) {
      return snapshot.data() as MailerSettings;
    }
    return {};
  } catch (error) {
    if (isMissingDbError(error)) {
        console.warn("Firestore not configured. Using empty mailer settings.");
    } else {
        console.error("Error getting mailer settings:", error);
    }
    return {};
  }
};

export const updateMailerSettings = async (settings: MailerSettings): Promise<void> => {
  try {
    const docRef = doc(db, "configs", "mailer_settings");
    await setDoc(docRef, settings, { merge: true });
  } catch (error) {
    console.error("Error updating mailer settings:", error);
    throw error;
  }
};

export const getReportLogs = async (): Promise<ReportLog[]> => {
  try {
    const logsRef = collection(db, "report_logs");
    const q = query(logsRef, orderBy("timestamp", "desc"));
    const snapshot = await getDocs(q);
    const logs: ReportLog[] = [];
    snapshot.forEach((doc: QueryDocumentSnapshot<DocumentData>) => {
      logs.push(doc.data() as ReportLog);
    });
    return logs;
  } catch (error) {
    console.error("Error getting report logs:", error);
    return [];
  }
};

export const addReportLog = async (log: ReportLog): Promise<void> => {
  try {
    await setDoc(doc(db, "report_logs", log.id), log);
  } catch (error) {
    console.error("Error adding report log:", error);
    throw error;
  }
};

export const getBrandOrder = async (): Promise<string[]> => {
  try {
    const docRef = doc(db, "configs", "brand_order");
    const snapshot = await getDoc(docRef);
    if (snapshot.exists()) {
      return snapshot.data().brands || [];
    }
    return [];
  } catch (error) {
    console.error("Error getting brand order:", error);
    return [];
  }
};

export const updateBrandOrder = async (brands: string[]): Promise<void> => {
  try {
    const docRef = doc(db, "configs", "brand_order");
    await setDoc(docRef, { brands });
  } catch (error) {
    console.error("Error updating brand order:", error);
    throw error;
  }
};

export const getCachingSettings = async (): Promise<{ enabled: boolean }> => {
  try {
    const docRef = doc(db, "configs", "caching_settings");
    const snapshot = await getDoc(docRef);
    if (snapshot.exists()) {
      return { enabled: snapshot.data().enabled !== false };
    }
    return { enabled: true };
  } catch (error) {
    console.error("Error getting caching settings:", error);
    return { enabled: true };
  }
};

export const updateCachingSettings = async (enabled: boolean): Promise<void> => {
  try {
    const docRef = doc(db, "configs", "caching_settings");
    await setDoc(docRef, { enabled });
  } catch (error) {
    console.error("Error updating caching settings:", error);
    throw error;
  }
};