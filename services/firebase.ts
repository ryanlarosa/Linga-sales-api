import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBwjH6rQVmBPWzBF88ZZR-JIa-d-8bJb0Q",
  authDomain: "linga-sales-api.firebaseapp.com",
  projectId: "linga-sales-api",
  storageBucket: "linga-sales-api.firebasestorage.app",
  messagingSenderId: "410696735630",
  appId: "1:410696735630:web:53c6232262daad169622df",
  measurementId: "G-FVFEDYBNZ1"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);