import { 
  collection, 
  doc, 
  addDoc, 
  getDocs, 
  getDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  onSnapshot,
  limit,
  serverTimestamp,
  writeBatch
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, storage } from './firebase';
import { getAuth, deleteUser, createUserWithEmailAndPassword, signOut } from 'firebase/auth';

// Add notification to notifications collection
export const addNotification = async (notification) => {
  try {
    await addDoc(collection(db, 'notifications'), notification);
    return true;
  } catch (error) {
    console.error('Error adding notification:', error);
    throw error;
  }
};

// Helper function to find customer document ID by customerId field
export const findCustomerDocumentId = async (customerId) => {
  try {
    // If it's already a short ID like cust_001, use it directly
    if (customerId.length <= 10 && customerId.includes('cust_')) {
      return customerId;
    }
    
    // Search for customer by customerId field
    const querySnapshot = await getDocs(collection(db, 'customers'));
    const customer = querySnapshot.docs.find(doc => 
      doc.data().customerId === customerId || doc.data().uid === customerId
    );
    return customer ? customer.id : customerId;
  } catch (error) {
    console.error('Error finding customer document ID:', error);
    return customerId;
  }
};

// Helper function to find driver document ID by driverId field
export const findDriverDocumentId = async (driverId) => {
  try {
    // If it's already a short ID like drv_001, use it directly
    if (driverId.length <= 10 && driverId.includes('drv_')) {
      return driverId;
    }
    
    // Search for driver by driverId field
    const querySnapshot = await getDocs(collection(db, 'drivers'));
    const driver = querySnapshot.docs.find(doc => 
      doc.data().driverId === driverId || doc.data().uid === driverId
    );
    return driver ? driver.id : driverId;
  } catch (error) {
    console.error('Error finding driver document ID:', error);
    return driverId;
  }
};

// Add notification to customer's subcollection
export const addCustomerNotification = async (customerId, notification) => {
  try {
    // Find the correct document ID
    const documentId = await findCustomerDocumentId(customerId);
    console.log('Creating customer notification for document ID:', documentId);
    
    // Add directly to customers/{documentId}/notifications subcollection
    await addDoc(collection(db, 'customers', documentId, 'notifications'), {
      ...notification,
      createdAt: new Date(),
      isRead: false
    });
    return true;
  } catch (error) {
    console.error('Error adding customer notification:', error);
    throw error;
  }
};

// Add notification to driver's subcollection
export const addDriverNotification = async (driverId, notification) => {
  try {
    // Find the correct document ID
    const documentId = await findDriverDocumentId(driverId);
    console.log('Creating driver notification for document ID:', documentId);
    
    // Add directly to drivers/{documentId}/notifications subcollection
    await addDoc(collection(db, 'drivers', documentId, 'notifications'), {
      ...notification,
      createdAt: new Date(),
      isRead: false
    });
    return true;
  } catch (error) {
    console.error('Error adding driver notification:', error);
    throw error;
  }
};

// Send notification to multiple users (customers or drivers)
export const sendBulkNotifications = async (userType, userIds, notification) => {
  try {
    const promises = userIds.map(userId => {
      if (userType === 'customer') {
        return addCustomerNotification(userId, notification);
      } else if (userType === 'driver') {
        return addDriverNotification(userId, notification);
      }
    });
    
    await Promise.all(promises);
    return true;
  } catch (error) {
    console.error('Error sending bulk notifications:', error);
    throw error;
  }
};

// Get customer notifications from subcollection
export const getCustomerNotifications = async (customerId) => {
  try {
    const q = query(
      collection(db, 'customers', customerId, 'notifications'), 
      orderBy('createdAt', 'desc')
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('Error fetching customer notifications:', error);
    return [];
  }
};

// Get driver notifications from subcollection
export const getDriverNotifications = async (driverId) => {
  try {
    const q = query(
      collection(db, 'drivers', driverId, 'notifications'), 
      orderBy('createdAt', 'desc')
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('Error fetching driver notifications:', error);
    return [];
  }
};

// Test notification function (for debugging)
export const testNotificationCreation = async () => {
  try {
    console.log('Testing notification creation...');
    
    // Test customer notification
    await addCustomerNotification('cust_001', {
      type: 'test',
      title: 'Test Notification',
      message: 'This is a test notification for customer',
      priority: 'normal'
    });
    
    console.log('Customer notification created successfully');
    return true;
  } catch (error) {
    console.error('Error testing notification creation:', error);
    throw error;
  }
};

// Notify about dispatch status change
export const notifyDispatchStatusChange = async (dispatchId, newStatus, tripDetails) => {
  try {
    // Add to global admin notifications
    await addNotification({
      type: 'dispatch_status_changed',
      title: `Trip Status Updated`,
      message: `Trip #${dispatchId} status changed to ${newStatus}`,
      dispatchId,
      status: newStatus,
      tripDetails: {
        customerId: tripDetails.customerId,
        sourceLocation: tripDetails.sourceLocation,
        destinationLocation: tripDetails.destinationLocation,
        customerName: tripDetails.customerName
      },
      isRead: false,
      createdAt: new Date(),
      priority: 'normal',
      recipientId: 'admin'
    });

    // Notify customer about their trip status change
    if (tripDetails.customerId) {
      await addCustomerNotification(tripDetails.customerId, {
        type: 'trip_status_update',
        title: `Your Trip Status Updated`,
        message: `Your trip from ${tripDetails.sourceLocation?.address} to ${tripDetails.destinationLocation?.address} is now ${newStatus}`,
        dispatchId,
        status: newStatus,
        priority: newStatus === 'completed' ? 'high' : 'normal'
      });
    }

    // Notify assigned drivers about trip status change
    if (tripDetails.assignments && tripDetails.assignments.length > 0) {
      const driverNotifications = tripDetails.assignments.map(assignment => 
        addDriverNotification(assignment.driverId, {
          type: 'trip_status_update',
          title: `Trip Status Updated`,
          message: `Trip #${dispatchId} status changed to ${newStatus}`,
          dispatchId,
          status: newStatus,
          priority: 'normal'
        })
      );
      await Promise.all(driverNotifications);
    }

    return true;
  } catch (error) {
    console.error('Error sending dispatch status notifications:', error);
    throw error;
  }
};

// Notify about image uploads for trip inconvenience
export const notifyImageUpload = async (dispatchId, driverId, imageType, tripDetails, notes = '') => {
  try {
    // Get the trip source and destination from tripDetails
    const sourceAddress = tripDetails.sourceLocation?.address || 'Unknown Source';
    const destinationAddress = tripDetails.destinationLocation?.address || 'Unknown Destination';
    
    // Add to global admin notifications
    await addNotification({
      type: 'trip_image_uploaded',
      title: `Trip Inconvenience - ${imageType} Image Uploaded`,
      message: `Driver uploaded ${imageType} image for Trip #${dispatchId} (${sourceAddress} → ${destinationAddress})${notes ? ` - ${notes}` : ''}`,
      dispatchId,
      driverId,
      imageType,
      notes,
      tripDetails: {
        customerId: tripDetails.customerId,
        sourceLocation: tripDetails.sourceLocation,
        destinationLocation: tripDetails.destinationLocation,
        driverName: tripDetails.driverName
      },
      isRead: false,
      createdAt: new Date(),
      priority: imageType === 'inconvenience' ? 'high' : 'normal',
      recipientId: 'admin',
      category: 'trip_management'
    });

    // Notify customer about image upload
    if (tripDetails.customerId) {
      await addCustomerNotification(tripDetails.customerId, {
        type: 'trip_image_uploaded',
        title: `Trip Update - ${imageType} Image Available`,
        message: `Driver has uploaded ${imageType} image for your trip from ${sourceAddress} to ${destinationAddress}`,
        dispatchId,
        driverId,
        imageType,
        priority: 'normal'
      });
    }

    return true;
  } catch (error) {
    console.error('Error sending image upload notifications:', error);
    throw error;
  }
};

// Notify about new trip requests
export const notifyNewRequest = async (dispatchId, tripDetails) => {
  try {
    // Get the trip source and destination from tripDetails
    const sourceAddress = tripDetails.sourceLocation?.address || 'Unknown Source';
    const destinationAddress = tripDetails.destinationLocation?.address || 'Unknown Destination';
    const customerName = tripDetails.customerName || 'Unknown Customer';
    
    // Add to global admin notifications
    await addNotification({
      type: 'new_request',
      title: `New Trip Request`,
      message: `New trip request from ${customerName}: ${sourceAddress} → ${destinationAddress}`,
      dispatchId,
      tripId: dispatchId,
      tripDetails: {
        customerId: tripDetails.customerId,
        customerName,
        sourceLocation: tripDetails.sourceLocation,
        destinationLocation: tripDetails.destinationLocation,
        requestedTime: tripDetails.requestedTime,
        status: tripDetails.status || 'pending'
      },
      isRead: false,
      createdAt: new Date(),
      priority: 'high',
      recipientId: 'admin',
      category: 'new_requests'
    });

    return true;
  } catch (error) {
    console.error('Error sending new request notification:', error);
    throw error;
  }
};
// Firebase data service for admin dashboard
import { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy,
  onSnapshot,
  limit as limitQuery
} from 'firebase/firestore';
import { 
  ref, 
  uploadBytes, 
  getDownloadURL, 
  deleteObject 
} from 'firebase/storage';
import { 
  createUserWithEmailAndPassword,
  getAuth,
  signOut
} from 'firebase/auth';
import { db, storage } from './firebase';

// Save dispatch image information to dispatch_images collection
export const saveDispatchImage = async (dispatchId, driverId, imageType, imageUrl, notes = '', additionalData = {}) => {
  try {
    const imageData = {
      dispatchId,
      driverId,
      imageType,
      imageUrl,
      notes,
      uploadedAt: new Date(),
      visibleTo: ['admin', driverId], // Only admins and the driver who uploaded can see
      ...additionalData
    };

    const docRef = await addDoc(collection(db, 'dispatch_images'), imageData);
    return docRef.id;
  } catch (error) {
    console.error('Error saving dispatch image:', error);
    throw error;
  }
};

// Get dispatch images for a specific trip
export const getDispatchImages = async (dispatchId) => {
  try {
    const q = query(
      collection(db, 'dispatch_images'), 
      where('dispatchId', '==', dispatchId),
      orderBy('uploadedAt', 'desc')
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('Error fetching dispatch images:', error);
    return [];
  }
};

// Upload trip inconvenience image
export const uploadTripImage = async (file, dispatchId, driverId, imageType, notes = '') => {
  try {
    // Upload image to Firebase Storage
    const fileName = `${imageType}_${driverId}_${Date.now()}.${file.name.split('.').pop()}`;
    const imageUrl = await uploadImage(file, `dispatches/${dispatchId}/trip_images`, fileName);
    
    // Save image information to dispatch_images collection
    const imageDocId = await saveDispatchImage(dispatchId, driverId, imageType, imageUrl, notes, {
      fileName,
      fileSize: file.size,
      mimeType: file.type
    });

    // Get trip details for notification
    const dispatchDoc = await getDoc(doc(db, 'dispatches', dispatchId));
    if (dispatchDoc.exists()) {
      const tripDetails = dispatchDoc.data();
      
      // Send notification about image upload
      await notifyImageUpload(dispatchId, driverId, imageType, tripDetails, notes);
    }

    return { imageUrl, imageDocId };
  } catch (error) {
    console.error('Error uploading trip image:', error);
    throw error;
  }
};

// Image upload utility functions
export const uploadImage = async (file, folder, fileName) => {
  try {
    const fileExtension = file.name.split('.').pop();
    const fullFileName = `${fileName}.${fileExtension}`;
    const imageRef = ref(storage, `${folder}/${fullFileName}`);
    
    const snapshot = await uploadBytes(imageRef, file);
    const downloadURL = await getDownloadURL(snapshot.ref);
    
    return downloadURL;
  } catch (error) {
    console.error('Error uploading image:', error);
    throw error;
  }
};

export const deleteImage = async (imageUrl) => {
  try {
    if (imageUrl && imageUrl.includes('firebase')) {
      const imageRef = ref(storage, imageUrl);
      await deleteObject(imageRef);
    }
  } catch (error) {
    console.error('Error deleting image:', error);
    // Don't throw error for image deletion failures
  }
};

// Convert base64 to file (for handling pasted images or data URLs)
const base64ToFile = (base64String, fileName) => {
  const arr = base64String.split(',');
  const mime = arr[0].match(/:(.*?);/)[1];
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new File([u8arr], fileName, { type: mime });
};

// Dashboard stats calculation
const calculateDashboardStats = async () => {
  try {
    const customersSnapshot = await getDocs(collection(db, 'customers'));
    const driversSnapshot = await getDocs(collection(db, 'drivers'));
    const dispatchesSnapshot = await getDocs(collection(db, 'dispatches'));
    const trucksSnapshot = await getDocs(collection(db, 'trucks'));
    
    const totalCustomers = customersSnapshot.size;
    const totalDrivers = driversSnapshot.size;
    const totalDispatches = dispatchesSnapshot.size;
    const totalTrucks = trucksSnapshot.size;
    
    // Count pending requests
    const pendingQuery = query(collection(db, 'dispatches'), where('status', '==', 'pending'));
    const pendingSnapshot = await getDocs(pendingQuery);
    const pendingRequests = pendingSnapshot.size;
    
    // Count in-progress trips
    const inProgressQuery = query(collection(db, 'dispatches'), where('status', '==', 'in_progress'));
    const inProgressSnapshot = await getDocs(inProgressQuery);
    const inProgressTrips = inProgressSnapshot.size;
    
    // Count completed trips
    const completedQuery = query(collection(db, 'dispatches'), where('status', '==', 'completed'));
    const completedSnapshot = await getDocs(completedQuery);
    const completedTrips = completedSnapshot.size;
    
    // Count available trucks
    const availableTrucksQuery = query(collection(db, 'trucks'), where('status', '==', 'available'));
    const availableTrucksSnapshot = await getDocs(availableTrucksQuery);
    const availableTrucks = availableTrucksSnapshot.size;
    
    // Count active drivers
    const activeDriversQuery = query(collection(db, 'drivers'), where('isAvailable', '==', true));
    const activeDriversSnapshot = await getDocs(activeDriversQuery);
    const activeDrivers = activeDriversSnapshot.size;
    
    // Calculate today's completed trips
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayCompletedTrips = completedSnapshot.docs.filter(doc => {
      const data = doc.data();
      const completedAt = data.completedAt ? new Date(data.completedAt) : null;
      return completedAt && completedAt >= today;
    }).length;
    
    return {
      totalUsers: totalCustomers,
      totalDrivers: totalDrivers,
      activeDrivers: activeDrivers,
      totalTrips: totalDispatches,
      pendingRequests: pendingRequests,
      pendingTrips: pendingRequests,
      inProgressTrips: inProgressTrips,
      completedTrips: completedTrips,
      completedTripsToday: todayCompletedTrips,
      availableTrucks: availableTrucks,
      totalTrucks: totalTrucks,
      monthlyRevenue: 45678 // This would be calculated from actual trip data
    };
  } catch (error) {
    console.error('Error calculating dashboard stats:', error);
    return {
      totalUsers: 0,
      totalDrivers: 0,
      activeDrivers: 0,
      totalTrips: 0,
      pendingRequests: 0,
      pendingTrips: 0,
      inProgressTrips: 0,
      completedTrips: 0,
      completedTripsToday: 0,
      availableTrucks: 0,
      totalTrucks: 0,
      monthlyRevenue: 0
    };
  }
};

// Dashboard API
export const getDashboardStats = calculateDashboardStats;

// Users/Customers API
export const getUsers = async () => {
  try {
    const querySnapshot = await getDocs(collection(db, 'customers'));
    return querySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt || new Date().toISOString()
      };
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    return [];
  }
};

// Alias for getUsers - same data, different name for clarity
export const getCustomers = async () => {
  return await getUsers();
};

export const getUserById = async (userId) => {
  try {
    const docRef = doc(db, 'customers', userId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() };
    }
    return null;
  } catch (error) {
    console.error('Error fetching user:', error);
    return null;
  }
};

export const createUser = async (userData) => {
  try {
    const docRef = await addDoc(collection(db, 'customers'), {
      ...userData,
      status: 'active',
      createdAt: new Date().toISOString()
    });
    return { id: docRef.id, ...userData };
  } catch (error) {
    console.error('Error creating user:', error);
    throw error;
  }
};

export const updateUser = async (userId, userData) => {
  try {
    const userRef = doc(db, 'customers', userId);
    await updateDoc(userRef, userData);
    return { id: userId, ...userData };
  } catch (error) {
    console.error('Error updating user:', error);
    throw error;
  }
};

export const deleteUser = async (userId) => {
  try {
    // Get user data first
    const userDoc = await getDoc(doc(db, 'customers', userId));
    if (!userDoc.exists()) {
      throw new Error('User not found');
    }
    
    const userData = userDoc.data();
    
    // Delete from Firebase Auth if uid exists
    if (userData.uid) {
      try {
        // Note: Deleting users from Firebase Auth requires Admin SDK on backend
        // For now, we'll just mark it as deleted in the database
        console.warn('Firebase Auth user deletion requires Admin SDK on backend');
      } catch (authError) {
        console.warn('Could not delete from Firebase Auth:', authError);
      }
    }
    
    // Delete user profile image from Storage if exists
    if (userData.profileImage) {
      try {
        await deleteImage(userData.profileImage);
      } catch (error) {
        console.warn('Could not delete profile image:', error);
      }
    }
    
    // Update any dispatches that reference this customer to "unknown/removed"
    const dispatchesQuery = query(collection(db, 'dispatches'));
    const dispatchSnapshot = await getDocs(dispatchesQuery);
    
    const updatePromises = [];
    dispatchSnapshot.docs.forEach(dispatchDoc => {
      const dispatchData = dispatchDoc.data();
      if (dispatchData.customerId === userId || dispatchData.customerId === userData.customerId) {
        updatePromises.push(
          updateDoc(doc(db, 'dispatches', dispatchDoc.id), {
            customerId: 'unknown/removed',
            customerName: 'Unknown/Removed Customer'
          })
        );
      }
    });
    
    await Promise.all(updatePromises);
    
    // Delete user document
    await deleteDoc(doc(db, 'customers', userId));
    
    return true;
  } catch (error) {
    console.error('Error deleting user:', error);
    throw error;
  }
};

// Drivers API
export const getDrivers = async () => {
  try {
    const querySnapshot = await getDocs(collection(db, 'drivers'));
    return querySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt || new Date()
      };
    });
  } catch (error) {
    console.error('Error fetching drivers:', error);
    return [];
  }
};

export const getTrucks = async () => {
  try {
    const querySnapshot = await getDocs(collection(db, 'trucks'));
    return querySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt || new Date().toISOString()
      };
    });
  } catch (error) {
    console.error('Error fetching trucks:', error);
    return [];
  }
};

// Real-time listeners
export const subscribeToDrivers = (callback) => {
  try {
    const q = query(collection(db, 'drivers'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (querySnapshot) => {
      const drivers = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt || new Date()
      }));
      callback(drivers);
    });
  } catch (error) {
    console.error('Error subscribing to drivers:', error);
    return () => {};
  }
};

export const subscribeToCustomers = (callback) => {
  try {
    const q = query(collection(db, 'customers'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (querySnapshot) => {
      const customers = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt || new Date().toISOString()
      }));
      callback(customers);
    });
  } catch (error) {
    console.error('Error subscribing to customers:', error);
    return () => {};
  }
};

export const subscribeToTrucks = (callback) => {
  try {
    const q = query(collection(db, 'trucks'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (querySnapshot) => {
      const trucks = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt || new Date().toISOString()
      }));
      callback(trucks);
    });
  } catch (error) {
    console.error('Error subscribing to trucks:', error);
    return () => {};
  }
};

export const subscribeToDispatches = (callback) => {
  try {
    const q = query(collection(db, 'dispatches'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (querySnapshot) => {
      const dispatches = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      callback(dispatches);
    });
  } catch (error) {
    console.error('Error subscribing to dispatches:', error);
    return () => {};
  }
};

export const subscribeToNotifications = (callback) => {
  try {
    const q = query(collection(db, 'notifications'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (querySnapshot) => {
      const notifications = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      callback(notifications);
    });
  } catch (error) {
    console.error('Error subscribing to notifications:', error);
    return () => {};
  }
};

export const getDriverById = async (driverId) => {
  try {
    const docRef = doc(db, 'drivers', driverId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() };
    }
    return null;
  } catch (error) {
    console.error('Error fetching driver:', error);
    return null;
  }
};

// Helper function to generate random password
const generateRandomPassword = (length = 8) => {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  let password = '';
  for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
};

// Helper function to create auth user without logging out admin
const createDriverAuthUser = async (email, password) => {
  try {
    // Note: This is a limitation of Firebase Client SDK
    // In a production environment, you would use Firebase Admin SDK on the server
    // For now, we'll create the auth user but handle the sign-out issue
    const auth = getAuth();
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    
    // The admin will be signed out, but we return the UID
    return {
      uid: userCredential.user.uid,
      email: userCredential.user.email,
      signedOutAdmin: true
    };
  } catch (error) {
    console.error('Error creating auth user:', error);
    throw error;
  }
};

export const createDriver = async (driverData) => {
  try {
    let profileImageUrl = '';
    let licenseImageUrl = '';
    
    // Generate unique ID for file names
    const driverId = `drv_${Date.now()}`;
    
    // Generate temporary password
    const tempPassword = generateRandomPassword(8);
    
    // Handle profile image upload first
    if (driverData.profileImage && driverData.profileImage.startsWith('data:')) {
      const profileFile = base64ToFile(driverData.profileImage, 'profile.jpg');
      profileImageUrl = await uploadImage(profileFile, `drivers/${driverId}`, 'profile');
    }
    
    // Handle license image upload
    if (driverData.licenseImage && driverData.licenseImage.startsWith('data:')) {
      const licenseFile = base64ToFile(driverData.licenseImage, 'license.jpg');
      licenseImageUrl = await uploadImage(licenseFile, `drivers/${driverId}`, 'license');
    }

    // Create driver document first
    const docRef = await addDoc(collection(db, 'drivers'), {
      ...driverData,
      driverId,
      uid: null, // Will be updated after Firebase Auth user creation
      tempPassword: tempPassword,
      passwordChanged: false, // Flag to force password change on first login  
      role: 'driver', // Automatically set role
      profileImage: profileImageUrl || driverData.profileImage || '',
      licenseImage: licenseImageUrl || driverData.licenseImage || '',
      status: driverData.status || 'available',
      isAvailable: driverData.status !== 'not-available',
      rating: 5.0,
      totalTrips: 0,
      createdAt: new Date().toISOString(), // Store as ISO string for consistent formatting
      updatedAt: new Date().toISOString()
    });

    // For now, skip Firebase Auth creation to prevent admin logout
    // TODO: Implement proper Firebase Admin SDK or Cloud Function for user creation
    console.log('Driver created successfully. Firebase Auth user creation skipped to prevent admin logout.');
    console.log('You can manually create the auth user later or implement server-side user creation.');
    
    return { 
      id: docRef.id, 
      ...driverData,
      driverId,
      uid: null, // Will be null until auth user is created
      tempPassword: tempPassword, // Return temp password so admin can share with driver
      profileImage: profileImageUrl || driverData.profileImage || '',
      licenseImage: licenseImageUrl || driverData.licenseImage || '',
      role: 'driver',
      passwordChanged: false,
      createdAt: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error creating driver:', error);
    throw error;
  }
};

export const updateDriver = async (driverId, driverData) => {
  try {
    let updatedData = { ...driverData };
    
    // Get existing driver data to preserve image URLs if new ones aren't provided
    const existingDriver = await getDriverById(driverId);
    const driverDocId = existingDriver?.driverId || `drv_${Date.now()}`;
    
    // Handle profile image upload
    if (driverData.profileImage && driverData.profileImage.startsWith('data:')) {
      // Delete old image if exists
      if (existingDriver?.profileImage) {
        await deleteImage(existingDriver.profileImage);
      }
      const profileFile = base64ToFile(driverData.profileImage, 'profile.jpg');
      updatedData.profileImage = await uploadImage(profileFile, `drivers/${driverDocId}`, 'profile');
    }
    
    // Handle license image upload
    if (driverData.licenseImage && driverData.licenseImage.startsWith('data:')) {
      // Delete old image if exists
      if (existingDriver?.licenseImage) {
        await deleteImage(existingDriver.licenseImage);
      }
      const licenseFile = base64ToFile(driverData.licenseImage, 'license.jpg');
      updatedData.licenseImage = await uploadImage(licenseFile, `drivers/${driverDocId}`, 'license');
    }
    
    const driverRef = doc(db, 'drivers', driverId);
    await updateDoc(driverRef, updatedData);
    return { id: driverId, ...updatedData };
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
    
    // Delete from Firebase Auth if uid exists
    if (driverData.uid) {
      try {
        // Note: Deleting users from Firebase Auth requires Admin SDK on backend
        // For now, we'll just mark it as deleted in the database
        console.warn('Firebase Auth user deletion requires Admin SDK on backend');
      } catch (authError) {
        console.warn('Could not delete from Firebase Auth:', authError);
      }
    }
    
    // Delete driver images from Storage
    if (driverData.profileImage) {
      try {
        await deleteImage(driverData.profileImage);
      } catch (error) {
        console.warn('Could not delete profile image:', error);
      }
    }
    
    if (driverData.licenseImage) {
      try {
        await deleteImage(driverData.licenseImage);
      } catch (error) {
        console.warn('Could not delete license image:', error);
      }
    }
    
    // Update any dispatches that reference this driver to "unknown/removed"
    const dispatchesQuery = query(collection(db, 'dispatches'));
    const dispatchSnapshot = await getDocs(dispatchesQuery);
    
    const updatePromises = [];
    dispatchSnapshot.docs.forEach(dispatchDoc => {
      const dispatchData = dispatchDoc.data();
      let needsUpdate = false;
      let updatedData = { ...dispatchData };
      
      // Update assignments if this driver is assigned
      if (dispatchData.assignments && Array.isArray(dispatchData.assignments)) {
        updatedData.assignments = dispatchData.assignments.map(assignment => {
          if (assignment.driverId === driverId) {
            needsUpdate = true;
            return {
              ...assignment,
              driverId: 'unknown/removed',
              driverName: 'Unknown/Removed Driver'
            };
          }
          return assignment;
        });
      }
      
      if (needsUpdate) {
        updatePromises.push(updateDoc(doc(db, 'dispatches', dispatchDoc.id), updatedData));
      }
    });
    
    await Promise.all(updatePromises);
    
    // Delete driver document
    await deleteDoc(doc(db, 'drivers', driverId));
    
    return true;
  } catch (error) {
    console.error('Error deleting driver:', error);
    throw error;
  }
};

export const getTruckById = async (truckId) => {
  try {
    const docRef = doc(db, 'trucks', truckId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() };
    }
    return null;
  } catch (error) {
    console.error('Error fetching truck:', error);
    return null;
  }
};

export const createTruck = async (truckData) => {
  try {
    let truckImageUrl = '';
    
    // Generate unique ID for file names
    const truckId = `truck_${Date.now()}`;
    
    // Handle truck image upload
    if (truckData.truckImage && truckData.truckImage.startsWith('data:')) {
      const truckFile = base64ToFile(truckData.truckImage, 'truck.jpg');
      truckImageUrl = await uploadImage(truckFile, `trucks/${truckId}`, 'truck');
    }
    
    const docRef = await addDoc(collection(db, 'trucks'), {
      ...truckData,
      truckId,
      truckImage: truckImageUrl || truckData.truckImage || '',
      status: 'available',
      assignedDriver: null,
      createdAt: new Date()
    });
    
    return { 
      id: docRef.id, 
      ...truckData,
      truckId,
      truckImage: truckImageUrl || truckData.truckImage || ''
    };
  } catch (error) {
    console.error('Error creating truck:', error);
    throw error;
  }
};

export const updateTruck = async (truckId, truckData) => {
  try {
    let updatedData = { ...truckData };
    
    // Get existing truck data to preserve image URL if new one isn't provided
    const existingTruck = await getTruckById(truckId);
    const truckDocId = existingTruck?.truckId || `truck_${Date.now()}`;
    
    // Handle truck image upload
    if (truckData.truckImage && truckData.truckImage.startsWith('data:')) {
      // Delete old image if exists
      if (existingTruck?.truckImage) {
        await deleteImage(existingTruck.truckImage);
      }
      const truckFile = base64ToFile(truckData.truckImage, 'truck.jpg');
      updatedData.truckImage = await uploadImage(truckFile, `trucks/${truckDocId}`, 'truck');
    }
    
    const truckRef = doc(db, 'trucks', truckId);
    await updateDoc(truckRef, updatedData);
    return { id: truckId, ...updatedData };
  } catch (error) {
    console.error('Error updating truck:', error);
    throw error;
  }
};
  


export const deleteTruck = async (truckId) => {
  try {
    // Get truck data first
    const truckDoc = await getDoc(doc(db, 'trucks', truckId));
    if (!truckDoc.exists()) {
      throw new Error('Truck not found');
    }
    
    const truckData = truckDoc.data();
    
    // Delete truck image from Storage
    if (truckData.truckImage) {
      try {
        await deleteImage(truckData.truckImage);
      } catch (error) {
        console.warn('Could not delete truck image:', error);
      }
    }
    
    // Update any dispatches that reference this truck to "unknown/removed"
    const dispatchesQuery = query(collection(db, 'dispatches'));
    const dispatchSnapshot = await getDocs(dispatchesQuery);
    
    const updatePromises = [];
    dispatchSnapshot.docs.forEach(dispatchDoc => {
      const dispatchData = dispatchDoc.data();
      let needsUpdate = false;
      let updatedData = { ...dispatchData };
      
      // Update assignments if this truck is assigned
      if (dispatchData.assignments && Array.isArray(dispatchData.assignments)) {
        updatedData.assignments = dispatchData.assignments.map(assignment => {
          if (assignment.truckId === truckId) {
            needsUpdate = true;
            return {
              ...assignment,
              truckId: 'unknown/removed',
              truckNumber: 'Unknown/Removed Truck'
            };
          }
          return assignment;
        });
      }
      
      if (needsUpdate) {
        updatePromises.push(updateDoc(doc(db, 'dispatches', dispatchDoc.id), updatedData));
      }
    });
    
    await Promise.all(updatePromises);
    
    // Delete truck document
    await deleteDoc(doc(db, 'trucks', truckId));
    
    return true;
  } catch (error) {
    console.error('Error deleting truck:', error);
    throw error;
  }
};

// Create a new dispatch and send notification
export const createDispatch = async (dispatchData) => {
  try {
    // Add the dispatch to Firestore
    const docRef = await addDoc(collection(db, 'dispatches'), {
      ...dispatchData,
      status: 'pending',
      createdAt: new Date(),
      isRead: false
    });

    // Send notification about the new request
    await notifyNewRequest(docRef.id, dispatchData);

    return docRef.id;
  } catch (error) {
    console.error('Error creating dispatch:', error);
    throw error;
  }
};

// Dispatches/Trips API
export const getDispatches = async () => {
  try {
    const querySnapshot = await getDocs(collection(db, 'dispatches'));
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt
    }));
  } catch (error) {
    console.error('Error fetching dispatches:', error);
    return [];
  }
};

export const getTrips = async () => {
  try {
    const querySnapshot = await getDocs(collection(db, 'dispatches'));
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt
    }));
  } catch (error) {
    console.error('Error fetching trips:', error);
    return [];
  }
};

export const getTripById = async (tripId) => {
  try {
    const docRef = doc(db, 'dispatches', tripId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() };
    }
    return null;
  } catch (error) {
    console.error('Error fetching trip:', error);
    return null;
  }
};

export const createTrip = async (tripData) => {
  try {
    const docRef = await addDoc(collection(db, 'dispatches'), {
      ...tripData,
      status: 'pending',
      createdAt: new Date().toISOString(),
      ownerApproval: null,
      assignments: [],
      currentStatus: {
        status: 'pending',
        updatedAt: new Date().toISOString()
      }
    });
    return { id: docRef.id, ...tripData };
  } catch (error) {
    console.error('Error creating trip:', error);
    throw error;
  }
};

export const updateTrip = async (tripId, tripData) => {
  try {
    const tripRef = doc(db, 'dispatches', tripId);
    await updateDoc(tripRef, tripData);
    return { id: tripId, ...tripData };
  } catch (error) {
    console.error('Error updating trip:', error);
    throw error;
  }
};

export const deleteTrip = async (tripId) => {
  try {
    await deleteDoc(doc(db, 'dispatches', tripId));
    return true;
  } catch (error) {
    console.error('Error deleting trip:', error);
    throw error;
  }
};

// Requests API (same as dispatches but filtered by status)
export const getRequests = async () => {
  try {
    const q = query(collection(db, 'dispatches'), where('status', '==', 'pending'));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt
    }));
  } catch (error) {
    console.error('Error fetching requests:', error);
    return [];
  }
};

export const approveRequest = async (requestId, approvalData) => {
  try {
    const requestRef = doc(db, 'dispatches', requestId);
    await updateDoc(requestRef, {
      status: 'approved',
      ownerApproval: {
        approved: true,
        comments: approvalData.comments || '',
        approvedAt: new Date().toISOString()
      },
      'currentStatus.status': 'approved',
      'currentStatus.updatedAt': new Date().toISOString()
    });
    return true;
  } catch (error) {
    console.error('Error approving request:', error);
    throw error;
  }
};

export const rejectRequest = async (requestId, rejectionData) => {
  try {
    const requestRef = doc(db, 'dispatches', requestId);
    await updateDoc(requestRef, {
      status: 'rejected',
      ownerApproval: {
        approved: false,
        comments: rejectionData.comments || '',
        rejectedAt: new Date().toISOString()
      },
      'currentStatus.status': 'rejected',
      'currentStatus.updatedAt': new Date().toISOString()
    });
    return true;
  } catch (error) {
    console.error('Error rejecting request:', error);
    throw error;
  }
};

// Notifications API
export const getNotifications = async () => {
  try {
    const q = query(collection(db, 'notifications'), orderBy('createdAt', 'desc'));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt
    }));
  } catch (error) {
    console.error('Error fetching notifications:', error);
    return [];
  }
};

export const markNotificationAsRead = async (notificationId) => {
  try {
    const notificationRef = doc(db, 'notifications', notificationId);
    await updateDoc(notificationRef, { isRead: true });
    return true;
  } catch (error) {
    console.error('Error marking notification as read:', error);
    throw error;
  }
};

export const sendNotification = async (notificationData) => {
  try {
    const { audience, recipientId, ...baseNotification } = notificationData;
    
    // Determine where to send the notification based on audience
    switch (audience) {
      case 'all-users':
        // Send to global notifications collection for admins
        await addDoc(collection(db, 'notifications'), {
          ...baseNotification,
          audience,
          recipientId: 'admin',
          createdAt: new Date(),
          isRead: false
        });
        
        // Send to all customers
        const customers = await getCustomers();
        const customerNotifications = customers.map(customer => 
          addCustomerNotification(customer.id, {
            type: 'admin_announcement',
            title: baseNotification.title,
            message: baseNotification.message,
            priority: baseNotification.priority || 'normal'
          })
        );
        await Promise.all(customerNotifications);
        
        // Send to all drivers  
        const drivers = await getDrivers();
        const driverNotifications = drivers.map(driver => 
          addDriverNotification(driver.id, {
            type: 'admin_announcement',
            title: baseNotification.title,
            message: baseNotification.message,
            priority: baseNotification.priority || 'normal'
          })
        );
        await Promise.all(driverNotifications);
        break;
        
      case 'all-drivers':
        // Send to global notifications collection for admins
        await addDoc(collection(db, 'notifications'), {
          ...baseNotification,
          audience,
          recipientId: 'admin',
          createdAt: new Date(),
          isRead: false
        });
        
        // Send to all drivers
        const allDrivers = await getDrivers();
        const allDriverNotifications = allDrivers.map(driver => 
          addDriverNotification(driver.id, {
            type: 'admin_announcement',
            title: baseNotification.title,
            message: baseNotification.message,
            priority: baseNotification.priority || 'normal'
          })
        );
        await Promise.all(allDriverNotifications);
        break;
        
      case 'all-customers':
        // Send to global notifications collection for admins
        await addDoc(collection(db, 'notifications'), {
          ...baseNotification,
          audience,
          recipientId: 'admin',
          createdAt: new Date(),
          isRead: false
        });
        
        // Send to all customers
        const allCustomers = await getCustomers();
        const allCustomerNotifications = allCustomers.map(customer => 
          addCustomerNotification(customer.id, {
            type: 'admin_announcement',
            title: baseNotification.title,
            message: baseNotification.message,
            priority: baseNotification.priority || 'normal'
          })
        );
        await Promise.all(allCustomerNotifications);
        break;
        
      case 'specific-driver':
        if (!recipientId) throw new Error('Recipient ID required for specific driver notification');
        
        // Send to global notifications collection for admins
        await addDoc(collection(db, 'notifications'), {
          ...baseNotification,
          audience,
          recipientId,
          createdAt: new Date(),
          isRead: false
        });
        
        // Send to specific driver
        await addDriverNotification(recipientId, {
          type: 'admin_message',
          title: baseNotification.title,
          message: baseNotification.message,
          priority: baseNotification.priority || 'normal'
        });
        break;
        
      case 'specific-customer':
        if (!recipientId) throw new Error('Recipient ID required for specific customer notification');
        
        // Send to global notifications collection for admins
        await addDoc(collection(db, 'notifications'), {
          ...baseNotification,
          audience,
          recipientId,
          createdAt: new Date(),
          isRead: false
        });
        
        // Send to specific customer
        await addCustomerNotification(recipientId, {
          type: 'admin_message',
          title: baseNotification.title,
          message: baseNotification.message,
          priority: baseNotification.priority || 'normal'
        });
        break;
        
      default:
        // Default to admin-only notification
        await addDoc(collection(db, 'notifications'), {
          ...baseNotification,
          audience: audience || 'admin-only',
          recipientId: 'admin',
          createdAt: new Date(),
          isRead: false
        });
    }
    
    return true;
  } catch (error) {
    console.error('Error sending notification:', error);
    throw error;
  }
};

// Schedule API
export const getSchedule = async () => {
  try {
    const querySnapshot = await getDocs(collection(db, 'schedules'));
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('Error fetching schedule:', error);
    return [];
  }
};

// Reports API
export const getReports = async () => {
  try {
    // This would generate reports based on dispatches data
    const dispatches = await getTrips();
    
    return {
      totalRevenue: 45678,
      totalTrips: dispatches.length,
      completedTrips: dispatches.filter(trip => trip.status === 'completed').length,
      pendingTrips: dispatches.filter(trip => trip.status === 'pending').length,
      monthlyData: [
        { month: 'Jan', revenue: 12000, trips: 45 },
        { month: 'Feb', revenue: 15000, trips: 52 },
        { month: 'Mar', revenue: 18678, trips: 67 },
      ]
    };
  } catch (error) {
    console.error('Error generating reports:', error);
    return {
      totalRevenue: 0,
      totalTrips: 0,
      completedTrips: 0,
      pendingTrips: 0,
      monthlyData: []
    };
  }
};

// Settings API
export const getSettings = async () => {
  try {
    const docRef = doc(db, 'settings', 'app_settings');
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return docSnap.data();
    }
    return {
  companyName: 'Track Your Truck Load',
      email: 'admin@captaintruck.com',
      phone: '+1-555-0100',
      address: '123 Business St, City, State'
    };
  } catch (error) {
    console.error('Error fetching settings:', error);
    return {};
  }
};

export const updateSettings = async (settingsData) => {
  try {
    const settingsRef = doc(db, 'settings', 'app_settings');
    await updateDoc(settingsRef, settingsData);
    return settingsData;
  } catch (error) {
    console.error('Error updating settings:', error);
    throw error;
  }
};

// Trip-related functions for handling user subcollections
export const getAllTripsFromAllUsers = async () => {
  try {
    const users = await getUsers();
    const allTrips = [];
    
    for (const user of users) {
      try {
        const tripsRef = collection(db, 'customers', user.id, 'trips');
        const tripsSnapshot = await getDocs(tripsRef);
        
        const userTrips = tripsSnapshot.docs.map(doc => ({
          id: doc.id,
          customerId: user.id,
          customerName: user.name,
          customerPhone: user.phone || user.phoneNumber,
          customerEmail: user.email,
          ...doc.data()
        }));
        
        allTrips.push(...userTrips);
      } catch (error) {
        console.warn(`Error fetching trips for user ${user.id}:`, error);
      }
    }
    
    // Sort by creation date, newest first
    return allTrips.sort((a, b) => {
      const dateA = new Date(a.createdAt || 0);
      const dateB = new Date(b.createdAt || 0);
      return dateB - dateA;
    });
  } catch (error) {
    console.error('Error fetching all trips from all users:', error);
    return [];
  }
};

export const subscribeToAllUserTrips = (callback) => {
  let unsubscribeFunctions = [];
  let allTrips = [];
  let completedUsers = 0;
  let totalUsers = 0;

  const setupSubscriptions = async () => {
    try {
      const users = await getUsers();
      totalUsers = users.length;
      
      if (totalUsers === 0) {
        callback([]);
        return;
      }

      users.forEach(user => {
        try {
          const tripsRef = collection(db, 'customers', user.id, 'trips');
          const q = query(tripsRef, orderBy('createdAt', 'desc'));
          
          const unsubscribe = onSnapshot(q, (snapshot) => {
            const userTrips = snapshot.docs.map(doc => ({
              id: doc.id,
              customerId: user.id,
              customerName: user.name,
              customerPhone: user.phone || user.phoneNumber,
              customerEmail: user.email,
              ...doc.data()
            }));
            
            // Update trips for this user
            allTrips = allTrips.filter(trip => trip.customerId !== user.id);
            allTrips.push(...userTrips);
            
            // Sort by creation date
            allTrips.sort((a, b) => {
              const dateA = new Date(a.createdAt || 0);
              const dateB = new Date(b.createdAt || 0);
              return dateB - dateA;
            });
            
            callback([...allTrips]);
            completedUsers++;
          }, (error) => {
            console.warn(`Error in trip subscription for user ${user.id}:`, error);
            completedUsers++;
          });
          
          unsubscribeFunctions.push(unsubscribe);
        } catch (error) {
          console.warn(`Error setting up subscription for user ${user.id}:`, error);
          completedUsers++;
        }
      });
    } catch (error) {
      console.error('Error setting up trip subscriptions:', error);
      callback([]);
    }
  };

  setupSubscriptions();

  // Return cleanup function
  return () => {
    unsubscribeFunctions.forEach(unsubscribe => {
      try {
        unsubscribe();
      } catch (error) {
        console.warn('Error unsubscribing from trips:', error);
      }
    });
  };
};

export const assignTrip = async (customerId, tripId, assignments, additionalData = {}) => {
  try {
    const tripRef = doc(db, 'customers', customerId, 'trips', tripId);
    
    const updateData = {
      status: 'assigned',
      assignments: assignments,
      assignedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...additionalData
    };
    
    // For backward compatibility, also set single assignment fields if there's only one assignment
    if (assignments.length === 1) {
      updateData.assignedDriverId = assignments[0].driverId;
      updateData.assignedTruckId = assignments[0].truckId;
    }
    
    await updateDoc(tripRef, updateData);
    return true;
  } catch (error) {
    console.error('Error assigning trip:', error);
    throw error;
  }
};

export const updateTripStatus = async (customerId, tripId, status, additionalData = {}) => {
  try {
    const tripRef = doc(db, 'customers', customerId, 'trips', tripId);
    
    const updateData = {
      status: status,
      updatedAt: new Date().toISOString(),
      ...additionalData
    };
    
    await updateDoc(tripRef, updateData);
    return true;
  } catch (error) {
    console.error('Error updating trip status:', error);
    throw error;
  }
};

export const checkAvailability = async (driverId, truckId, date) => {
  try {
    // Get all trips to check for conflicts
    const allTrips = await getAllTripsFromAllUsers();
    
    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);
    
    const conflicts = allTrips.filter(trip => {
      if (trip.status === 'completed' || trip.status === 'cancelled') {
        return false;
      }
      
      const tripDate = new Date(trip.pickupDate || trip.createdAt || trip.date);
      tripDate.setHours(0, 0, 0, 0);
      
      if (tripDate.getTime() !== targetDate.getTime()) {
        return false;
      }
      
      // Check if either resource is assigned to this trip
      const hasDriverConflict = trip.assignedDriverId === driverId ||
        (trip.assignments && trip.assignments.some(a => a.driverId === driverId));
      
      const hasTruckConflict = trip.assignedTruckId === truckId ||
        (trip.assignments && trip.assignments.some(a => a.truckId === truckId));
      
      return hasDriverConflict || hasTruckConflict;
    });
    
    const driverAvailable = !conflicts.some(trip => 
      trip.assignedDriverId === driverId ||
      (trip.assignments && trip.assignments.some(a => a.driverId === driverId))
    );
    
    const truckAvailable = !conflicts.some(trip => 
      trip.assignedTruckId === truckId ||
      (trip.assignments && trip.assignments.some(a => a.truckId === truckId))
    );
    
    return {
      driverAvailable,
      truckAvailable,
      conflicts: conflicts.length
    };
  } catch (error) {
    console.error('Error checking availability:', error);
    return {
      driverAvailable: true,
      truckAvailable: true,
      conflicts: 0
    };
  }
};

export const getAvailableTrucks = async () => {
  try {
    const trucks = await getTrucks();
    return trucks.filter(truck => truck.status !== 'maintenance' && truck.status !== 'out-of-service');
  } catch (error) {
    console.error('Error getting available trucks:', error);
    return [];
  }
};

// Helper function to get user (customer) data - alias for getUserById
export const getUser = getUserById;

// Helper function to get driver data - alias for getDriverById
export const getDriver = getDriverById;

// Helper function to get truck data - alias for getTruckById
export const getTruck = getTruckById;

// Real-time listeners
export const subscribeToCollection = (collectionName, callback) => {
  try {
    const q = query(collection(db, collectionName), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (querySnapshot) => {
      const docs = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      callback(docs);
    });
  } catch (error) {
    console.error(`Error subscribing to ${collectionName}:`, error);
    return () => {}; // Return empty unsubscribe function
  }
};

export const getPendingRequestsCount = async () => {
  try {
    const pendingQuery = query(collection(db, 'dispatches'), where('status', '==', 'pending'));
    const querySnapshot = await getDocs(pendingQuery);
    return querySnapshot.size;
  } catch (error) {
    console.error('Error getting pending requests count:', error);
    return 0;
  }
};

// Accept or Reject Dispatch Request
export const acceptDispatchRequest = async (dispatchId, adminId) => {
  try {
    const dispatchRef = doc(db, 'dispatches', dispatchId);
    await updateDoc(dispatchRef, {
      status: 'accepted',
      acceptedBy: adminId,
      acceptedAt: new Date().toISOString(),
      updatedAt: new Date()
    });

    // Get dispatch data for notification
    const dispatchDoc = await getDoc(dispatchRef);
    const dispatchData = dispatchDoc.data();
    
    // Create notification for customer
    await createNotification({
      type: 'dispatch_accepted',
      title: 'Request Accepted',
      message: `Your dispatch request #${dispatchData.dispatchId} has been accepted and is being processed.`,
      userId: dispatchData.customerId,
      dispatchId: dispatchId,
      read: false,
      createdAt: new Date()
    });

    return { success: true };
  } catch (error) {
    console.error('Error accepting dispatch request:', error);
    throw error;
  }
};

export const rejectDispatchRequest = async (dispatchId, adminId, reason) => {
  try {
    const dispatchRef = doc(db, 'dispatches', dispatchId);
    await updateDoc(dispatchRef, {
      status: 'rejected',
      rejectedBy: adminId,
      rejectedAt: new Date().toISOString(),
      rejectionReason: reason,
      updatedAt: new Date()
    });

    // Get dispatch data for notification
    const dispatchDoc = await getDoc(dispatchRef);
    const dispatchData = dispatchDoc.data();
    
    // Create notification for customer
    await createNotification({
      type: 'dispatch_rejected',
      title: 'Request Rejected',
      message: `Your dispatch request #${dispatchData.dispatchId} has been rejected. Reason: ${reason}`,
      userId: dispatchData.customerId,
      dispatchId: dispatchId,
      read: false,
      createdAt: new Date()
    });

    return { success: true };
  } catch (error) {
    console.error('Error rejecting dispatch request:', error);
    throw error;
  }
};

// Assign Driver and Truck to Dispatch
export const assignDispatch = async (dispatchId, assignments, adminId) => {
  try {
    const dispatchRef = doc(db, 'dispatches', dispatchId);
    const dispatchDoc = await getDoc(dispatchRef);
    const dispatchData = dispatchDoc.data();

    // Update dispatch with assignments
    await updateDoc(dispatchRef, {
      status: 'assigned',
      assignments: assignments,
      assignedBy: adminId,
      assignedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    // Create notifications for each assigned driver using subcollections
    for (const assignment of assignments) {
      await addDriverNotification(assignment.driverId, {
        type: 'dispatch_assigned',
        title: 'New Assignment',
        message: `You have been assigned to dispatch #${dispatchData.dispatchId || dispatchId}. Route: ${dispatchData.sourceLocation?.address} → ${dispatchData.destinationLocation?.address}`,
        dispatchId: dispatchId,
        priority: 'high',
        actionRequired: true
      });
    }

    // Create notification for customer using subcollection
    await addCustomerNotification(dispatchData.customerId, {
      type: 'dispatch_assigned',
      title: 'Driver Assigned',
      message: `${assignments.length} driver(s) have been assigned to your dispatch request #${dispatchData.dispatchId || dispatchId}. Your shipment will be processed soon.`,
      dispatchId: dispatchId,
      priority: 'normal'
    });

    return { success: true };
  } catch (error) {
    console.error('Error assigning dispatch:', error);
    throw error;
  }
};

// Start Dispatch Trip
export const startDispatchTrip = async (dispatchId, adminId) => {
  try {
    const dispatchRef = doc(db, 'dispatches', dispatchId);
    const dispatchDoc = await getDoc(dispatchRef);
    const dispatchData = dispatchDoc.data();

    await updateDoc(dispatchRef, {
      status: 'in-progress',
      startedBy: adminId,
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    // Add to global notifications for admin tracking
    await addNotification({
      type: 'trip_started',
      title: 'Trip Started',
      message: `Dispatch #${dispatchData.dispatchId || dispatchId} has been started by driver.`,
      dispatchId: dispatchId,
      adminOnly: true
    });

    // Notify customer via subcollection
    await addCustomerNotification(dispatchData.customerId, {
      type: 'trip_started',
      title: 'Trip Started',
      message: `Your dispatch #${dispatchData.dispatchId || dispatchId} has started. Driver is on the way to pickup location.`,
      dispatchId: dispatchId,
      priority: 'high'
    });

    // Notify assigned drivers via subcollection
    if (dispatchData.assignments) {
      for (const assignment of dispatchData.assignments) {
        await addDriverNotification(assignment.driverId, {
          type: 'trip_started',
          title: 'Trip Started',
          message: `Dispatch #${dispatchData.dispatchId || dispatchId} has been started. Please proceed to pickup location.`,
          dispatchId: dispatchId,
          priority: 'high',
          actionRequired: true
        });
      }
    }

    return { success: true };
  } catch (error) {
    console.error('Error starting dispatch trip:', error);
    throw error;
  }
};

// Complete Dispatch Trip
export const completeDispatchTrip = async (dispatchId, adminId) => {
  try {
    const dispatchRef = doc(db, 'dispatches', dispatchId);
    const dispatchDoc = await getDoc(dispatchRef);
    const dispatchData = dispatchDoc.data();

    await updateDoc(dispatchRef, {
      status: 'completed',
      completedBy: adminId,
      completedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    // Add to global notifications for admin tracking
    await addNotification({
      type: 'trip_completed',
      title: 'Trip Completed',
      message: `Dispatch #${dispatchData.dispatchId || dispatchId} has been completed successfully.`,
      dispatchId: dispatchId,
      adminOnly: true
    });

    // Notify customer via subcollection
    await addCustomerNotification(dispatchData.customerId, {
      type: 'trip_completed',
      title: 'Trip Completed',
      message: `Your dispatch #${dispatchData.dispatchId || dispatchId} has been completed successfully. Thank you for choosing our service!`,
      dispatchId: dispatchId,
      priority: 'normal'
    });

    // Notify assigned drivers via subcollection
    if (dispatchData.assignments) {
      for (const assignment of dispatchData.assignments) {
        await addDriverNotification(assignment.driverId, {
          type: 'trip_completed',
          title: 'Trip Completed',
          message: `Dispatch #${dispatchData.dispatchId || dispatchId} has been completed. Great job!`,
          dispatchId: dispatchId,
          priority: 'normal'
        });
      }
    }

    // Create admin notification for completion
    await createNotification({
      type: 'trip_completed_admin',
      title: 'Trip Completed',
      message: `Dispatch #${dispatchData.dispatchId} has been completed by the driver.`,
      isAdminNotification: true,
      dispatchId: dispatchId,
      createdAt: new Date().toISOString()
    });

    return { success: true };
  } catch (error) {
    console.error('Error completing dispatch trip:', error);
    throw error;
  }
};

// Create general notification function
export const createNotification = async (notificationData) => {
  try {
    const notificationRef = collection(db, 'notifications');
    await addDoc(notificationRef, {
      ...notificationData,
      read: false,
      createdAt: new Date().toISOString()
    });
    return { success: true };
  } catch (error) {
    console.error('Error creating notification:', error);
    throw error;
  }
};

// Get admin notifications
export const getAdminNotifications = async (limit = 50) => {
  try {
    const notificationsQuery = query(
      collection(db, 'notifications'),
      where('isAdminNotification', '==', true),
      orderBy('createdAt', 'desc'),
      limitQuery(limit)
    );
    
    const querySnapshot = await getDocs(notificationsQuery);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('Error fetching admin notifications:', error);
    return [];
  }
};

export const updateDispatchStatus = async (dispatchId, status, additionalData = {}) => {
  try {
    const dispatchRef = doc(db, 'dispatches', dispatchId);
    
    // Get dispatch details for notifications
    const dispatchDoc = await getDoc(dispatchRef);
    if (dispatchDoc.exists()) {
      const tripDetails = dispatchDoc.data();
      
      // Update dispatch status
      await updateDoc(dispatchRef, {
        status,
        updatedAt: new Date(),
        ...additionalData
      });

      // Send notifications about status change
      await notifyDispatchStatusChange(dispatchId, status, tripDetails);
      
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('Error updating dispatch status:', error);
    throw error;
  }
};

// Subscribe to pending requests for real-time badge updates
export const subscribeToPendingRequests = (callback) => {
  try {
    const q = query(
      collection(db, 'dispatches'),
      where('status', '==', 'pending')
    );
    return onSnapshot(q, (querySnapshot) => {
      const requests = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      // Sort on client side to avoid compound index requirement
      requests.sort((a, b) => {
        const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
        const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
        return dateB - dateA;
      });
      callback(requests.length);
    });
  } catch (error) {
    console.error('Error subscribing to pending requests:', error);
    return () => {};
  }
};

// Admin Management Functions
export const createAdmin = async (adminData) => {
  try {
    const { profileImage, ...adminInfo } = adminData;
    
    // Generate admin ID
    const adminId = `admin_${Date.now()}`;
    
    // Generate password if not provided
    const tempPassword = adminInfo.password || Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-8).toUpperCase();
    
    // Create Firebase Auth user
    const auth = getAuth();
    const currentAdmin = auth.currentUser;
    
    let profileImageUrl = null;
    
    // Upload profile image if provided
    if (profileImage) {
      profileImageUrl = await uploadImage(profileImage, `admins/${adminId}`, 'profile');
    }
    
    // Create user in Firebase Auth
    const userCredential = await createUserWithEmailAndPassword(auth, adminInfo.email, tempPassword);
    const user = userCredential.user;
    
    // Sign back in as the current admin to avoid logout
    if (currentAdmin) {
      await signOut(auth);
      // Note: In production, you should use Firebase Admin SDK on backend
      console.warn('Admin creation should be done with Firebase Admin SDK on backend');
    }
    
    // Save admin data to Firestore
    await addDoc(collection(db, 'admins'), {
      adminId,
      uid: user.uid,
      firstName: adminInfo.firstName,
      lastName: adminInfo.lastName,
      email: adminInfo.email,
      phone: adminInfo.phone,
      profileImage: profileImageUrl,
      role: 'owner',
      status: 'active',
      createdAt: new Date(),
      tempPassword,
      passwordChanged: false
    });
    
    return { 
      success: true, 
      tempPassword,
      adminId 
    };
  } catch (error) {
    console.error('Error creating admin:', error);
    throw error;
  }
};

// Get all admins
export const getAdmins = async () => {
  try {
    const querySnapshot = await getDocs(collection(db, 'admins'));
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('Error fetching admins:', error);
    return [];
  }
};

// Delete admin
export const deleteAdmin = async (adminId) => {
  try {
    // Get admin data first
    const adminDoc = await getDoc(doc(db, 'admins', adminId));
    if (!adminDoc.exists()) {
      throw new Error('Admin not found');
    }
    
    const adminData = adminDoc.data();
    
    // Delete profile image from Storage if exists
    if (adminData.profileImage) {
      try {
        await deleteImage(adminData.profileImage);
      } catch (error) {
        console.warn('Could not delete profile image:', error);
      }
    }
    
    // Delete admin document
    await deleteDoc(doc(db, 'admins', adminId));
    
    return true;
  } catch (error) {
    console.error('Error deleting admin:', error);
    throw error;
  }
};
