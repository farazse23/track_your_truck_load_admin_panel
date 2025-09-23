// Test Firebase Connection
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, collection, getDocs } from 'firebase/firestore';

// Load environment variables
const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID
};

console.log('Firebase Config:', firebaseConfig);

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Test functions
async function testFirebaseConnection() {
  console.log('Testing Firebase connection...');
  
  try {
    // Test Firestore connection
    const adminsCollection = collection(db, 'admins');
    const snapshot = await getDocs(adminsCollection);
    console.log('Admins collection size:', snapshot.size);
    
    snapshot.forEach(doc => {
      console.log('Admin doc:', doc.id, doc.data());
    });
    
  } catch (error) {
    console.error('Firebase connection error:', error);
  }
}

// Test login
async function testLogin(email, password) {
  try {
    console.log('Testing login with:', email);
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    console.log('Login successful:', userCredential.user);
    return userCredential.user;
  } catch (error) {
    console.error('Login error:', error.code, error.message);
    return null;
  }
}

// Export functions for manual testing
window.testFirebaseConnection = testFirebaseConnection;
window.testLogin = testLogin;

console.log('Firebase test script loaded. Use testFirebaseConnection() and testLogin(email, password) in console.');