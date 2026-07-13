/* ACEDB - firebase-config.js
   Firebase project configuration for acedb-live
   This file is used on the firebase-live branch only.
*/
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const firebaseConfig = {
  apiKey: "AIzaSyANlLO9eqw9GoKraXHQQmlKfbEVZhgPWuU",
  authDomain: "acedb-live.firebaseapp.com",
  projectId: "acedb-live",
  storageBucket: "acedb-live.firebasestorage.app",
  messagingSenderId: "521707649205",
  appId: "1:521707649205:web:c6225c39b9df165b4da6fc"
};

const firebaseApp = initializeApp(firebaseConfig);
export const fbAuth = getAuth(firebaseApp);
export const db = getFirestore(firebaseApp);
