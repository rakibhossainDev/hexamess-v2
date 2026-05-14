import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import {
  getFirestore,
  collection,
  doc,
  onSnapshot,
  addDoc,
  updateDoc,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc,
  writeBatch,
  increment,
  serverTimestamp,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
} from "firebase/firestore";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyCj1M4g4KkhTzajtwbNY9p0h0s1a2uz5dk",
  authDomain: "hexamess-v2.firebaseapp.com",
  projectId: "hexamess-v2",
  storageBucket: "hexamess-v2.firebasestorage.app",
  messagingSenderId: "198810108185",
  appId: "1:198810108185:web:d6ad3dbf1ef9b778ff4588"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

export {
  auth,
  db,
  storage,
  ref,
  uploadBytes,
  getDownloadURL,
  collection,
  doc,
  onSnapshot,
  addDoc,
  updateDoc,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc,
  writeBatch,
  increment,
  serverTimestamp,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
};
