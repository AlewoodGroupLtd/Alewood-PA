import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, browserLocalPersistence, setPersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyD8L5UHZwAFzCOO936J4-uZVnAA6T3lXpI",
  authDomain: "alewood-uk-trinity-d1e8a.firebaseapp.com",
  projectId: "alewood-uk-trinity",
  storageBucket: "alewood-uk-trinity.firebasestorage.app",
  messagingSenderId: "343832934198",
  appId: "1:343832934198:web:c05ffa0f07c8bdc6236597"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Ensure session persists across reloads and PWA closures
setPersistence(auth, browserLocalPersistence);

const googleProvider = new GoogleAuthProvider();
googleProvider.addScope('https://www.googleapis.com/auth/gmail.modify');
googleProvider.addScope('https://www.googleapis.com/auth/calendar.events');
googleProvider.addScope('https://www.googleapis.com/auth/drive');
// We can force prompt to ensure passkey/biometrics is utilized by Google Accounts
googleProvider.setCustomParameters({
  prompt: 'consent select_account'
});

export { app, auth, googleProvider, db };
