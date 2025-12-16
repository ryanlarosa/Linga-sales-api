import { db } from "./firebase";
import { collection, getDocs, query, where, doc, setDoc, QueryDocumentSnapshot, DocumentData } from "firebase/firestore";
import { User, Store } from "../types";
import { MOCK_USERS, STORE_LIST } from "../constants";

// --- DB INITIALIZATION ---

export const initializeDatabase = async () => {
  try {
    console.log("Starting Database Initialization...");
    
    // 1. Seed Users (using username as ID to prevent duplicates)
    for (const user of MOCK_USERS) {
        await setDoc(doc(db, "users", user.username), user);
    }
    console.log("Users seeded.");

    // 2. Seed Stores (using store ID as ID)
    for (const store of STORE_LIST) {
        await setDoc(doc(db, "stores", store.id), {
            id: store.id,
            name: store.name
        });
    }
    console.log("Stores seeded.");
    
    return true;
  } catch (error) {
    console.error("Failed to initialize database:", error);
    throw error;
  }
};

// --- USERS ---

export const loginUser = async (username: string, password: string): Promise<User | null> => {
  try {
    const usersRef = collection(db, "users");
    const q = query(usersRef, where("username", "==", username));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      // If DB is empty, try auto-seeding once
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
      // Simple client-side password check
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
    console.error("Error logging in:", error);
    // Fallback to MOCK constants if Firestore connection fails completely
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
    console.error("Error fetching stores:", error);
    return STORE_LIST; 
  }
};