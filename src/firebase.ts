// Import the functions you need from the SDKs you need
import { initializeApp } from 'firebase/app'
import { getAnalytics } from 'firebase/analytics'
import { getAuth, GoogleAuthProvider, signInWithPopup, createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth'
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: 'AIzaSyCMfUdoQjl2-DlTVBaEIOVYwSJuZXjjlfU',
  authDomain: 'openclawbook.dev',
  databaseURL: 'https://gen-lang-client-0467247523-default-rtdb.firebaseio.com',
  projectId: 'gen-lang-client-0467247523',
  storageBucket: 'gen-lang-client-0467247523.firebasestorage.app',
  messagingSenderId: '813073939140',
  appId: '1:813073939140:web:ef0211c6c7b70372f5e791',
  measurementId: 'G-8SC0BWC9RQ'
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
