import { collection, getDocs, getDoc, doc, addDoc, updateDoc, deleteDoc, writeBatch, query, where, onSnapshot, orderBy, getAuth, deleteAuthUser, createUserWithEmailAndPassword, signOut, initializeApp, getApps, db, storage, ref, deleteObject } from './firebase-imports.js';
import { deleteImage, uploadImage } from './imageService.js';

// Drivers API
export const getDrivers = async () => {
  try {
    const querySnapshot = await getDocs(collection(db, 'drivers'));
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('Error fetching drivers:', error);
    return [];
  }
};

export const getDriverById = async (driverId) => {
  try {
    const driverDoc = await getDoc(doc(db, 'drivers', driverId));
    if (driverDoc.exists()) {
      return {
        id: driverDoc.id,
        ...driverDoc.data()
      };
    }
    return null;
  } catch (error) {
    console.error('Error fetching driver:', error);
    return null;
  }
};

// Generate random password
const generateRandomPassword = (length = 10) => {
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
  let password = '';
  for (let i = 0; i < length; i++) {
    password += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  return password;
};

// Generate unique driver ID
const generateDriverId = () => {
  return `drv_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
};

export const createDriver = async (driverData) => {
  try {
    // Use a secondary Firebase app to avoid logging out the current admin
    let secondaryApp;
    const existingApps = getApps();
    const secondaryAppName = 'secondary';
    
    if (existingApps.find(app => app.name === secondaryAppName)) {
      secondaryApp = existingApps.find(app => app.name === secondaryAppName);
    } else {
      // Get Firebase config from the main app
      const mainApp = existingApps[0];
      secondaryApp = initializeApp(mainApp.options, secondaryAppName);
    }
    
    const secondaryAuth = getAuth(secondaryApp);
    const tempPassword = generateRandomPassword();
    const driverId = generateDriverId();
    
    // Create Firebase Auth user using secondary auth instance
    const userCredential = await createUserWithEmailAndPassword(secondaryAuth, driverData.email, tempPassword);
    const firebaseUid = userCredential.user.uid;
    
    // Sign out from secondary auth to clean up
    await signOut(secondaryAuth);
    
    // Prepare driver data for Firestore
    let processedDriverData = {
      ...driverData,
      driverId: driverId, // Main identifier for the driver
      firebaseUid: firebaseUid, // Store Firebase UID for auth purposes only
      role: 'driver', // Automatically add driver role
      tempPassword: tempPassword, // Store temporarily for admin
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    // Upload profile image if provided
    if (driverData.profileImage && driverData.profileImage.startsWith('data:')) {
      try {
        // Convert base64 to file
        const base64Data = driverData.profileImage;
        const arr = base64Data.split(',');
        const mime = arr[0].match(/:(.*?);/)[1];
        const bstr = atob(arr[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while (n--) {
          u8arr[n] = bstr.charCodeAt(n);
        }
        const file = new File([u8arr], 'profile.jpg', { type: mime });
        
        // Upload to Firebase Storage under driver/driverId/
        const profileImageUrl = await uploadImage(file, `driver/${driverId}`, `profile_${Date.now()}`);
        processedDriverData.profileImage = profileImageUrl;
      } catch (error) {
        console.warn('Failed to upload profile image:', error);
        // Keep the base64 data as fallback
      }
    }
    
    // Upload license image if provided
    if (driverData.licenseImage && driverData.licenseImage.startsWith('data:')) {
      try {
        // Convert base64 to file
        const base64Data = driverData.licenseImage;
        const arr = base64Data.split(',');
        const mime = arr[0].match(/:(.*?);/)[1];
        const bstr = atob(arr[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while (n--) {
          u8arr[n] = bstr.charCodeAt(n);
        }
        const file = new File([u8arr], 'license.jpg', { type: mime });
        
        // Upload to Firebase Storage under driver/driverId/
        const licenseImageUrl = await uploadImage(file, `driver/${driverId}`, `license_${Date.now()}`);
        processedDriverData.licenseImage = licenseImageUrl;
      } catch (error) {
        console.warn('Failed to upload license image:', error);
        // Keep the base64 data as fallback
      }
    }
    
    // Save driver data to Firestore
    const docRef = await addDoc(collection(db, 'drivers'), processedDriverData);
    
    return {
      id: docRef.id,
      driverId: driverId,
      tempPassword: tempPassword,
      email: driverData.email
    };
  } catch (error) {
    console.error('Error creating driver:', error);
    throw error;
  }
};

export const updateDriver = async (driverId, driverData) => {
  try {
    const driverRef = doc(db, 'drivers', driverId);
    await updateDoc(driverRef, {
      ...driverData,
      updatedAt: new Date()
    });
    return true;
  } catch (error) {
    console.error('Error updating driver:', error);
    throw error;
  }
};

export const deleteDriver = async (driverId) => {
  try {
    // Get driver data first
    const driverDoc = await getDoc(doc(db, 'drivers', driverId));
    if (!driverDoc.exists()) {
      throw new Error('Driver not found');
    }
    
    const driverData = driverDoc.data();
    const batch = writeBatch(db);
    
    // Delete entire driver folder from Storage if driverId exists
    if (driverData.driverId) {
      try {
        // Delete all files in the driver's storage folder
        // Since Firebase Storage doesn't have a direct way to delete folders,
        // we'll delete the files by their URLs if they exist
        
        if (driverData.profileImage && driverData.profileImage.includes('firebase')) {
          try {
            await deleteImage(driverData.profileImage);
            console.log('Deleted profile image from storage');
          } catch (error) {
            console.warn('Profile image not found or already deleted:', error);
          }
        }
        
        if (driverData.licenseImage && driverData.licenseImage.includes('firebase')) {
          try {
            await deleteImage(driverData.licenseImage);
            console.log('Deleted license image from storage');
          } catch (error) {
            console.warn('License image not found or already deleted:', error);
          }
        }
        
        console.log(`Deleted storage files for driver: ${driverData.driverId}`);
      } catch (error) {
        console.warn('Could not delete driver storage files:', error);
      }
    }
    
    // Delete Firebase Auth user if firebaseUid exists
    if (driverData.firebaseUid || driverData.uid) {
      try {
        const auth = getAuth();
        const uid = driverData.firebaseUid || driverData.uid;
        
        // Use deleteUser function from Firebase Auth Admin
        await deleteAuthUser(uid);
        console.log(`Deleted Firebase Auth user: ${uid}`);
        
      } catch (error) {
        console.warn('Could not delete Firebase Auth user:', error);
        // Continue with deletion even if auth user deletion fails
      }
    }
    
    // Update related trip documents - set driver info to "unknown"
    const tripsQuery = query(collection(db, 'trips'), where('driverId', '==', driverData.driverId || driverId));
    const tripsSnapshot = await getDocs(tripsQuery);
    
    tripsSnapshot.docs.forEach(tripDoc => {
      batch.update(tripDoc.ref, {
        driverId: 'unknown',
        driverName: 'Unknown Driver',
        driverPhone: 'N/A'
      });
    });
    
    // Update related dispatch documents
    const dispatchQuery = query(collection(db, 'dispatches'), where('driverId', '==', driverData.driverId || driverId));
    const dispatchSnapshot = await getDocs(dispatchQuery);
    
    dispatchSnapshot.docs.forEach(dispatchDoc => {
      batch.update(dispatchDoc.ref, {
        driverId: 'unknown',
        driverName: 'Unknown Driver',
        driverPhone: 'N/A'
      });
    });
    
    // Update trucks assigned to this driver
    const trucksQuery = query(collection(db, 'trucks'), where('assignedDriver', '==', driverData.driverId || driverId));
    const trucksSnapshot = await getDocs(trucksQuery);
    
    trucksSnapshot.docs.forEach(truckDoc => {
      batch.update(truckDoc.ref, {
        assignedDriver: null,
        driverName: null,
        status: 'available'
      });
    });
    
    // Delete all notifications in the driver's notifications subcollection
    const notificationsQuery = collection(db, 'drivers', driverId, 'notifications');
    const notificationsSnapshot = await getDocs(notificationsQuery);
    
    notificationsSnapshot.docs.forEach(notificationDoc => {
      batch.delete(notificationDoc.ref);
    });
    
    // Delete the driver document
    batch.delete(doc(db, 'drivers', driverId));
    
    // Commit all changes
    await batch.commit();
    
    return true;
  } catch (error) {
    console.error('Error deleting driver:', error);
    throw error;
  }
};

// Real-time listeners
export const subscribeToDrivers = (callback) => {
  try {
    const q = query(collection(db, 'drivers'), orderBy('name'));
    return onSnapshot(q, (snapshot) => {
      const drivers = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      callback(drivers);
    });
  } catch (error) {
    console.error('Error subscribing to drivers:', error);
    return () => {};
  }
};
