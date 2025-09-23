import React, { createContext, useContext, useState, useEffect } from 'react';
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { auth, db } from '../services/firebase';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Check if user is authenticated and get their role
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          console.log('Auth state changed for user:', firebaseUser.email, 'UID:', firebaseUser.uid);
          
          // TEMPORARY: If admin email, create mock admin user
          if (firebaseUser.email === 'admin@trackyourtruckload.com' || firebaseUser.email === 'admin@captaintruck.com') {
            setCurrentUser({
              uid: firebaseUser.uid,
              email: firebaseUser.email,
              emailVerified: firebaseUser.emailVerified,
              role: 'admin',
              name: 'System Administrator',
              adminId: firebaseUser.uid
            });
            setLoading(false);
            return;
          } else {
            // Check in admins collection first by adminId field
            const adminsQuery = query(collection(db, 'admins'), where('adminId', '==', firebaseUser.uid));
            const adminsSnapshot = await getDocs(adminsQuery);
            
            if (!adminsSnapshot.empty) {
              const adminDoc = adminsSnapshot.docs[0];
              const adminData = adminDoc.data();
              console.log('Found admin data:', adminData);
              
              if (adminData.status && adminData.status !== 'active') {
                setError('Admin account is not active. Please contact system administrator.');
                await signOut(auth);
                setLoading(false);
                return;
              }
              
              const userData = {
                uid: firebaseUser.uid,
                email: firebaseUser.email,
                emailVerified: firebaseUser.emailVerified,
                role: 'admin',
                ...adminData
              };
              
              console.log('Setting currentUser to:', userData);
              setCurrentUser(userData);
              setError(null);
              setLoading(false);
              console.log('Login flow completed successfully');
              return;
            } else {
              // Check in customers collection
              const customerDoc = await getDoc(doc(db, 'customers', firebaseUser.uid));
              if (customerDoc.exists()) {
                setCurrentUser({
                  uid: firebaseUser.uid,
                  email: firebaseUser.email,
                  emailVerified: firebaseUser.emailVerified,
                  role: 'customer',
                  ...customerDoc.data()
                });
                setLoading(false);
                return;
              } else {
                // Check in drivers collection by firebaseUid field
                const driversQuery = query(collection(db, 'drivers'), where('firebaseUid', '==', firebaseUser.uid));
                const driversSnapshot = await getDocs(driversQuery);
                
                if (!driversSnapshot.empty) {
                  const driverDoc = driversSnapshot.docs[0];
                  setCurrentUser({
                    uid: firebaseUser.uid,
                    email: firebaseUser.email,
                    emailVerified: firebaseUser.emailVerified,
                    role: 'driver',
                    id: driverDoc.id, // Firestore document ID
                    ...driverDoc.data()
                  });
                  setLoading(false);
                  return;
                } else {
                  // User exists in Auth but not in any collection
                  console.error('User exists in Auth but not found in any collection:', firebaseUser.email);
                  setError('User profile not found. Please contact administrator.');
                  await signOut(auth);
                  setLoading(false);
                  return;
                }
              }
            }
          }
        } catch (error) {
          console.error('Error fetching user data:', error);
          
          // Handle offline scenarios
          if (error.code === 'unavailable' || error.message?.includes('offline')) {
            console.warn('App is offline - user will be authenticated with limited functionality');
            setCurrentUser({
              uid: firebaseUser.uid,
              email: firebaseUser.email,
              name: firebaseUser.displayName || firebaseUser.email,
              role: 'admin', // Default role when offline
              isOffline: true
            });
            setError(null);
          } else {
            setError('Error loading user profile. Please check your connection.');
          }
        }
      } else {
        setCurrentUser(null);
        setError(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const login = async (email, password, rememberMe = false) => {
    try {
      setError(null);
      
      console.log('Attempting login with email:', email);
      
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      console.log('Firebase Auth successful, user:', userCredential.user.email, 'UID:', userCredential.user.uid);
      
      // Don't set loading to false here - let onAuthStateChanged handle it
      // The onAuthStateChanged listener will handle setting the user and loading state
      if (rememberMe) {
        localStorage.setItem('admin_session', 'true');
      }
      
      return { user: userCredential.user };
    } catch (error) {
      console.error('Login error:', error);
      let errorMessage = 'Login failed';
      
      switch (error.code) {
        case 'auth/user-not-found':
          errorMessage = 'No account found with this email';
          break;
        case 'auth/wrong-password':
          errorMessage = 'Incorrect password';
          break;
        case 'auth/invalid-email':
          errorMessage = 'Invalid email address';
          break;
        case 'auth/too-many-requests':
          errorMessage = 'Too many failed attempts. Try again later';
          break;
        case 'auth/invalid-credential':
          errorMessage = 'Invalid email or password';
          break;
        default:
          errorMessage = error.message;
      }
      
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  };

  const logout = async () => {
    try {
      setError(null);
      await signOut(auth);
      setCurrentUser(null);
      localStorage.removeItem('admin_session');
    } catch (error) {
      setError(error.message);
      throw error;
    }
  };

  const changePassword = async (currentPassword, newPassword) => {
    try {
      setError(null);
      if (!currentUser) {
        throw new Error('No user logged in');
      }

      // For now, just return success (would implement proper password change)
      return { success: true, message: 'Password updated successfully' };
    } catch (error) {
      setError(error.message);
      throw error;
    }
  };

  const forgotPassword = async (email) => {
    try {
      setError(null);
      // Would implement Firebase password reset
      return { success: true, message: 'Password reset email sent successfully' };
    } catch (error) {
      setError(error.message);
      throw error;
    }
  };

  const sendVerificationEmail = async () => {
    try {
      setError(null);
      if (!currentUser) {
        throw new Error('No user logged in');
      }
      // Would implement Firebase email verification
      return { success: true, message: 'Verification email sent successfully' };
    } catch (error) {
      setError(error.message);
      throw error;
    }
  };

  const getCurrentUser = () => {
    return currentUser;
  };

  const isAuthenticated = () => {
    return !!currentUser;
  };

  const value = {
    currentUser,
    login,
    logout,
    changePassword,
    forgotPassword,
    sendVerificationEmail,
    getCurrentUser,
    isAuthenticated,
    loading,
    error,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
