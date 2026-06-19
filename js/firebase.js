// ── Firebase Setup (compat SDK) ──
const firebaseConfig = {
  apiKey: "AIzaSyD5WMGSGviZzDT3yowDQF4Z5P5rZyrZLiI",
  authDomain: "learn-and-drive.firebaseapp.com",
  projectId: "learn-and-drive",
  storageBucket: "learn-and-drive.firebasestorage.app",
  messagingSenderId: "867179750516",
  appId: "1:867179750516:web:cd51e4c02435c2c0431d21"
};

firebase.initializeApp(firebaseConfig);

const db = firebase.firestore();
const auth = firebase.auth();