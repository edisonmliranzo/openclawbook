// Import the functions you need from the SDKs you need
import { initializeApp } from 'firebase/app'
import { getAnalytics } from 'firebase/analytics'
import { getAuth, GoogleAuthProvider, signInWithPopup, createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth'
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
}

// Initialize Firebase
const app = initializeApp(firebaseConfig)
let analytics = null
try {
  if (typeof window !== 'undefined') {
    analytics = getAnalytics(app)
  }
} catch (err) {
  // Analytics may fail to initialize in some environments (SSR/test/etc.)
  // Swallow the error and continue — analytics is optional.
  // eslint-disable-next-line no-console
  console.warn('Firebase analytics not initialized:', err)
}

const auth = typeof window !== 'undefined' ? getAuth(app) : null
const googleProvider = new GoogleAuthProvider()

export { app, analytics, auth, googleProvider, signInWithPopup, createUserWithEmailAndPassword, signInWithEmailAndPassword }
