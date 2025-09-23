// Import the functions you need from the SDKs you need
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, enableNetwork, disableNetwork } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyA1gnEFXkcNab-1skhtfrcjXEILb6OJz9U",
  authDomain: "trackyourtruckload-20e29.firebaseapp.com",
  projectId: "trackyourtruckload-20e29",
  storageBucket: "trackyourtruckload-20e29.firebasestorage.app",
  messagingSenderId: "693509446728",
  appId: "1:693509446728:web:3aa08a7649e89704160c7d",
  measurementId: "G-JBDYFZC29X"
};
// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

// Connection state monitoring
let isOnline = navigator.onLine;

// Enable/disable network based on connectivity
const handleOnline = async () => {
  if (!isOnline) {
    console.log('🌐 Internet connection restored, enabling Firebase network...');
    try {
      await enableNetwork(db);
      isOnline = true;
    } catch (error) {
      console.warn('Firebase network enable failed:', error.message);
    }
  }
};

const handleOffline = async () => {
  if (isOnline) {
    console.log('📴 Internet connection lost, enabling offline mode...');
    try {
      await disableNetwork(db);
      isOnline = false;
    } catch (error) {
      console.warn('Firebase network disable failed:', error.message);
    }
  }
};

// Add event listeners for connection changes
window.addEventListener('online', handleOnline);
window.addEventListener('offline', handleOffline);

// Initialize connection state
if (!navigator.onLine) {
  handleOffline();
}

export default app;
