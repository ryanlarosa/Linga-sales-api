import { db } from "./firebase";
import { collection, getDocs, query, where, addDoc } from "firebase/firestore";
import { User, Store } from "../types";
import { MOCK_USERS, STORE_LIST } from "../constants";

// --- USERS ---

export const loginUser = async (username: string, password: string): Promise<User | null> => {
  try {
    const usersRef = collection(db, "users");
    // Querying for username only first
    const q = query(usersRef, where("username", "==", username));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      // If no users exist at all in DB, maybe we should check if we need to seed
      // (This is a convenience for the first run)
      const allUsers = await getDocs(usersRef);
      if (allUsers.empty) {
          console.log("Database empty. Seeding mock users...");
          await seedUsers();
          // Retry login after seeding
          return loginUser(username, password);
      }
      return null;
    }

    // Client-side password check (since we are not using Firebase Auth)
    // In production, use Firebase Authentication!
    let foundUser: User | null = null;
    querySnapshot.forEach((doc) => {
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
    console.error("Error logging in:", error);
    // Fallback to MOCK_USERS if Firestore fails (e.g. offline/permission)
    console.warn("Falling back to local mock users due to error.");
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

const seedUsers = async () => {
    const usersRef = collection(db, "users");
    for (const user of MOCK_USERS) {
        await addDoc(usersRef, user);
    }
};

// --- STORES ---

export const getStores = async (): Promise<Store[]> => {
  try {
    const storesRef = collection(db, "stores");
    const snapshot = await getDocs(storesRef);

    if (snapshot.empty) {
        console.log("No stores found in DB. Seeding...");
        await seedStores();
        return STORE_LIST;
    }

    const stores: Store[] = [];
    snapshot.forEach((doc) => {
      const data = doc.data();
      // Ensure we map the firestore fields correctly
      // We assume the document has 'name' and 'id' fields
      stores.push({
        id: data.id || doc.id,
        name: data.name
      });
    });
    
    return stores;
  } catch (error) {
    console.error("Error fetching stores:", error);
    return STORE_LIST; // Fallback
  }
};

const seedStores = async () => {
    const storesRef = collection(db, "stores");
    for (const store of STORE_LIST) {
        // We save the 'id' field explicitly so it matches the API requirements
        await addDoc(storesRef, {
            name: store.name,
            id: store.id 
        });
    }
};