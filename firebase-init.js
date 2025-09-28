// firebase-init.js

const firebaseConfig = {
  apiKey: "AIzaSyAuQxqnQW7moQq0G50kypElJstiMRPP2eQ",
  authDomain: "bot-event-management.firebaseapp.com",
  projectId: "bot-event-management",
  storageBucket: "bot-event-management.firebasestorage.app",
  messagingSenderId: "358289842841",
  appId: "1:358289842841:web:87a7c00850bc771fa3ce08",
};

// Initialize Firebase
const app = firebase.initializeApp(firebaseConfig);
const auth = app.auth();
const db = app.firestore();
