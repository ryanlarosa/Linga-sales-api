import { db } from "./firebase";
import { collection, getDocs, query, where, doc, setDoc, QueryDocumentSnapshot, DocumentData } from "firebase/firestore";
import { User, Store } from "../types";
import { MOCK_USERS, STORE_LIST } from "../constants";

// Helper to check if error is due to missing DB setup in Console
const isMissingDbError = (error: any) => {
    return error?.code === 'not-found' || 
           (error?.message && error.message.includes('database (default) does not exist'));
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

    let foundUser: User | null = null;
    querySnapshot.forEach((doc: QueryDocumentSnapshot<DocumentData>) => {
      const userData = doc.data();
      if (userData.password === password) {
        foundUser = {
          username: userData.username,
          role: userData.role,
          name: userData.name,
          allowedStores: userData.allowedStores
        };
      }
    });

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
            role: mock.role as 'admin' | 'user',
            name: mock.name,
            allowedStores: mock.allowedStores
        };
    }
    return null;
  }
};

// --- STORES ---

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
        id: data.id,
        name: data.name
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