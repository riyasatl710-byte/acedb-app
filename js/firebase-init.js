/* ACEDB - firebase-init.js
   Loads Firebase SDK modules and exposes them globally as window.acedbFirebase
   so that api.js (non-module script) can use them.
   This script must be loaded as type="module" before api.js.
*/
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  createUserWithEmailAndPassword,
  onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const firebaseConfig = {
  apiKey: "AIzaSyANlLO9eqw9GoKraXHQQmlKfbEVZhgPWuU",
  authDomain: "acedb-live.firebaseapp.com",
  projectId: "acedb-live",
  storageBucket: "acedb-live.firebasestorage.app",
  messagingSenderId: "521707649205",
  appId: "1:521707649205:web:c6225c39b9df165b4da6fc"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Expose to global scope for non-module scripts (api.js, auth.js etc.)
window.acedbFirebase = {
  app,
  auth,
  db,
  apiKey: firebaseConfig.apiKey,
  authFns: { signInWithEmailAndPassword, signOut, createUserWithEmailAndPassword, onAuthStateChanged },
  firestoreFns: { collection, doc, getDoc, getDocs, setDoc, addDoc, updateDoc, deleteDoc, query, where, orderBy, limit }
};

console.log('[ACEDB] Firebase initialized ✓');
