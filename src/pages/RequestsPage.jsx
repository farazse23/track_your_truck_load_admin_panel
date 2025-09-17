import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { format } from 'date-fns';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Badge from '../components/ui/Badge';
import DispatchImagesGallery from '../components/DispatchImagesGallery';
import { useAuth } from '../contexts/FirebaseAuthContext';
import {
  getDispatches,
  getDrivers,
  getTrucks,
  getCustomers,
  acceptDispatchRequest,
  rejectDispatchRequest,
  assignDispatch,
  startDispatchTrip,
  completeDispatchTrip,
  addCustomerNotification,
  addDriverNotification,
  subscribeToDispatches,
  subscribeToDrivers,
  subscribeToTrucks,
  subscribeToCustomers,
  getDispatchImages,
  notifyNewRequest,
  checkAvailability,
  getAvailableDriversForDate,
  getAvailableTrucksForDate,
  createAssignment,
  adminStartDispatch,
  updateDriverAssignmentStatus,
  updateDoc,
  doc,
  db
} from '../services/data';
import { updateOverallDispatchStatus } from '../services/data/driverAssignmentService';

const RequestsPage = () => {
  const { currentUser } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [lastSyncTime, setLastSyncTime] = useState(new Date());
  const [dispatches, setDispatches] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [trucks, setTrucks] = useState([]);
  const [customers, setCustomers] = useState([]);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [highlightedTrip, setHighlightedTrip] = useState(null);
  
  // Modal states
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [selectedDispatch, setSelectedDispatch] = useState(null);
  
  // Assignment states
    const [assignments, setAssignments] = useState([{ 
    driverId: '', 
    truckId: '', 
    notes: '',
    assignmentDate: ''
  }]);
  const [rejectionReason, setRejectionReason] = useState('');
  const [dispatchImages, setDispatchImages] = useState({});
  const [availableDrivers, setAvailableDrivers] = useState([]);
  const [availableTrucks, setAvailableTrucks] = useState([]);
  const [assignmentErrors, setAssignmentErrors] = useState({});
  const [checkingAvailability, setCheckingAvailability] = useState(false);

  useEffect(() => {
    // Check if we're coming from a notification with a trip to highlight
    if (location.state?.highlightTrip) {
      setHighlightedTrip(location.state.highlightTrip);
      
      // Clear the highlight after 5 seconds
      setTimeout(() => {
        setHighlightedTrip(null);
        // Clear the navigation state
        navigate('/requests', { replace: true });
      }, 5000);
    }
  }, [location.state, navigate]);

  useEffect(() => {
    // Set up real-time listeners
    const unsubscribeDispatches = subscribeToDispatches((dispatchesData) => {
      setDispatches(dispatchesData);
      setLoading(false);
    });
    
    const unsubscribeDrivers = subscribeToDrivers((driversData) => {
      setDrivers(driversData);
    });
    
    const unsubscribeTrucks = subscribeToTrucks((trucksData) => {
      setTrucks(trucksData);
    });
    
    const unsubscribeCustomers = subscribeToCustomers((customersData) => {
      setCustomers(customersData);
    });

    // Setup online/offline detection
    const handleOnline = () => {
      setIsOnline(true);
      console.log('🟢 Admin panel back online - syncing all dispatch statuses...');
      // Small delay to ensure connection is stable
      setTimeout(async () => {
        try {
          // Force reload all data from Firebase
          const latestDispatches = await getDispatches();
          setDispatches(latestDispatches);
          
          // Sync status for all dispatches with assignments
          for (const dispatch of latestDispatches) {
            if (dispatch.driverAssignments && Object.keys(dispatch.driverAssignments).length > 0) {
              console.log(`🔄 Syncing status for dispatch ${dispatch.dispatchId || dispatch.id}`);
              await updateOverallDispatchStatus(dispatch.id);
            }
          }
          console.log('✅ Full sync completed');
        } catch (error) {
          console.error('❌ Error during reconnection sync:', error);
        }
        setLastSyncTime(new Date());
      }, 2000);
    };

    const handleOffline = () => {
      setIsOnline(false);
      console.log('🔴 Admin panel offline - status updates may be delayed');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      unsubscribeDispatches();
      unsubscribeDrivers();
      unsubscribeTrucks();
      unsubscribeCustomers();
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [dispatchesData, driversData, trucksData, customersData] = await Promise.all([
        getDispatches(),
        getDrivers(),
        getTrucks(),
        getCustomers()
      ]);

      setDispatches(dispatchesData);
      setDrivers(driversData);
      setTrucks(trucksData);
      setCustomers(customersData);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Helper functions
  const getCustomerName = (customerId) => {
    const customer = customers.find(c => c.customerId === customerId || c.id === customerId);
    return customer?.name || 'Unknown Customer';
  };

  const getCustomerDetails = (customerId) => {
    return customers.find(c => c.customerId === customerId || c.id === customerId) || { 
      name: 'Unknown Customer', 
      email: 'N/A',
      phone: 'N/A',
      address: 'N/A'
    };
  };

  const getDriverName = (driverId) => {
    const driver = drivers.find(d => d.driverId === driverId || d.id === driverId);
    return driver?.name || 'N/A';
  };

  const getDriverDetails = (driverId) => {
    return drivers.find(d => d.driverId === driverId || d.id === driverId) || { 
      name: 'Unknown Driver',
      email: 'N/A', 
      phone: 'N/A',
      licenseNumber: 'N/A'
    };
  };

  const getTruckInfo = (truckId) => {
    const truck = trucks.find(t => t.truckId === truckId || t.id === truckId);
    return truck ? `${truck.make} ${truck.model} (${truck.plateNumber})` : 'N/A';
  };

  const getTruckDetails = (truckId) => {
    return trucks.find(t => t.truckId === truckId || t.id === truckId) || {
      truckNumber: 'Unknown',
      type: 'N/A',
      capacity: 'N/A',
      status: 'N/A'
    };
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return 'N/A';
    
    try {
      // Handle Firebase Timestamp
      if (timestamp.toDate && typeof timestamp.toDate === 'function') {
        return format(timestamp.toDate(), 'MMM dd, yyyy HH:mm');
      }
      // Handle regular Date or timestamp
      return format(new Date(timestamp), 'MMM dd, yyyy HH:mm');
    } catch (error) {
      console.error('Error formatting date:', error);
      return 'Invalid Date';
    }
  };

  const getStatusCount = (status) => {
    return dispatches.filter(dispatch => dispatch.status === status).length;
  };

  // Action handlers
  const handleAcceptRequest = async (dispatchId) => {
    try {
      const dispatch = dispatches.find(d => d.id === dispatchId);
      await acceptDispatchRequest(dispatchId, 'admin_id');
      
      // Send notification to customer
      if (dispatch) {
        await addCustomerNotification(dispatch.customerId, {
          type: 'dispatch_accepted',
          title: 'Request Accepted',
          message: `Your dispatch request #${dispatch.dispatchId || dispatchId} has been accepted. Route: ${dispatch.sourceLocation?.address || dispatch.sourceLocation} → ${dispatch.destinationLocation?.address || dispatch.destinationLocation}`,
          dispatchId: dispatchId,
          priority: 'normal',
          senderId: currentUser?.uid || 'admin',
          senderName: currentUser?.displayName || currentUser?.email || 'Admin'
        });
      }
      
      // Real-time listener will update the data automatically
    } catch (error) {
      console.error('Error accepting request:', error);
      alert('Error accepting request: ' + error.message);
    }
  };

  const handleRejectRequest = async () => {
    try {
      await rejectDispatchRequest(selectedDispatch.id, 'admin_id', rejectionReason);
      
      // Send notification to customer
      await addCustomerNotification(selectedDispatch.customerId, {
        type: 'dispatch_rejected',
        title: 'Request Rejected',
        message: `Your dispatch request #${selectedDispatch.dispatchId || selectedDispatch.id} has been rejected. Reason: ${rejectionReason}. Please contact support for assistance.`,
        dispatchId: selectedDispatch.id,
        priority: 'high',
        senderId: currentUser?.uid || 'admin',
        senderName: currentUser?.displayName || currentUser?.email || 'Admin'
      });
      
      // Real-time listener will update the data automatically
      setShowRejectModal(false);
      setRejectionReason('');
      setSelectedDispatch(null);
    } catch (error) {
      console.error('Error rejecting request:', error);
      alert('Error rejecting request: ' + error.message);
    }
  };

  const handleAssignDispatch = async () => {
    try {
      // Validate all assignments
      const validAssignments = assignments.filter(a => a.driverId && a.truckId);
      if (validAssignments.length === 0) {
        alert('Please assign at least one driver and truck');
        return;
      }
      
      // Check for any assignment errors
      const hasErrors = Object.values(assignmentErrors).some(error => error !== null);
      if (hasErrors) {
        alert('Please resolve assignment conflicts before proceeding');
        return;
      }

      // Create individual driver assignments object
      const driverAssignments = {};
      const assignmentRecords = [];
      
      for (const assignment of validAssignments) {
        // Create driver assignment object
        driverAssignments[assignment.driverId] = {
          driverId: assignment.driverId,
          truckId: assignment.truckId,
          status: 'assigned',
          assignedAt: new Date(),
          assignedFor: selectedDispatch.pickupDateTime || new Date(), // Date when trip should be accomplished
          startedAt: null,
          completedAt: null,
          assignmentDate: assignment.assignmentDate,
          assignmentNotes: assignment.notes || '',
          assignedBy: currentUser?.uid || 'admin'
        };

        // Create assignment record in assignments collection (for backward compatibility)
        console.log('🔍 Creating assignment record with data:', {
          dispatchId: selectedDispatch.id,
          driverId: assignment.driverId,
          truckId: assignment.truckId,
          assignedDate: assignment.assignmentDate,
          notes: assignment.notes,
          dispatchDetails: {
            dispatchId: selectedDispatch.dispatchId,
            customerId: selectedDispatch.customerId,
            sourceLocation: selectedDispatch.sourceLocation,
            destinationLocation: selectedDispatch.destinationLocation,
            trucksRequired: selectedDispatch.trucksRequired
          }
        });
        
        const assignmentRecord = await createAssignment({
          dispatchId: selectedDispatch.id,
          driverId: assignment.driverId,
          truckId: assignment.truckId,
          assignedDate: assignment.assignmentDate,
          notes: assignment.notes,
          dispatchDetails: {
            dispatchId: selectedDispatch.dispatchId,
            customerId: selectedDispatch.customerId,
            sourceLocation: selectedDispatch.sourceLocation,
            destinationLocation: selectedDispatch.destinationLocation,
            trucksRequired: selectedDispatch.trucksRequired
          },
          assignedBy: currentUser?.uid || 'admin'
        });
        
        console.log('✅ Assignment record created:', assignmentRecord);
        assignmentRecords.push(assignmentRecord);
      }

      // Update dispatch with new structure
      await updateDoc(doc(db, 'dispatches', selectedDispatch.id), {
        status: 'assigned',
        driverAssignments,
        assignmentRecords: assignmentRecords.map(record => record.id),
        assignedAt: new Date(),
        assignedBy: currentUser?.uid || 'admin',
        updatedAt: new Date()
      });
      
      // Send notifications after successful assignment
      // Create notifications for each assigned driver
      for (const assignment of validAssignments) {
        const assignedDriver = drivers.find(d => d.id === assignment.driverId);
        await addDriverNotification(assignment.driverId, {
          type: 'dispatch_assigned',
          title: 'New Assignment',
          message: `You have been assigned to dispatch #${selectedDispatch.dispatchId || selectedDispatch.id}. Route: ${selectedDispatch.sourceLocation?.address || selectedDispatch.sourceLocation} → ${selectedDispatch.destinationLocation?.address || selectedDispatch.destinationLocation}. Date: ${assignment.assignmentDate}`,
          dispatchId: selectedDispatch.id,
          priority: 'high',
          actionRequired: true,
          senderId: currentUser?.uid || 'admin',
          senderName: currentUser?.displayName || currentUser?.email || 'Admin'
        });
      }

      // Create notification for customer
      if (selectedDispatch.customerId) {
        await addCustomerNotification(selectedDispatch.customerId, {
          type: 'dispatch_assigned',
          title: 'Driver Assigned',
          message: `${validAssignments.length} driver(s) and truck(s) have been assigned to your dispatch request #${selectedDispatch.dispatchId || selectedDispatch.id}. Scheduled date: ${validAssignments[0].assignmentDate}. Your shipment will be processed soon.`,
          dispatchId: selectedDispatch.id,
          priority: 'normal',
          senderId: currentUser?.uid || 'admin',
          senderName: currentUser?.displayName || currentUser?.email || 'Admin'
        });
      }
      
      setShowAssignModal(false);
      setAssignments([{ driverId: '', truckId: '', notes: '', assignmentDate: '' }]);
      setSelectedDispatch(null);
      setAssignmentErrors({});
      alert('Assignment successful! Drivers and trucks have been scheduled.');
    } catch (error) {
      console.error('Error assigning dispatch:', error);
      alert('Error assigning dispatch: ' + error.message);
    }
  };

  const handleCompleteTrip = async (dispatch) => {
    if (!confirm(`Mark trip as completed for dispatch #${dispatch.dispatchId}? This will mark all drivers as completed.`)) {
      return;
    }
    
    try {
      console.log(`🔄 Admin manually completing trip for dispatch ${dispatch.id}`);
      
      // Mark all drivers as completed
      const driverAssignments = dispatch.driverAssignments || {};
      const driverIds = Object.keys(driverAssignments);
      
      if (driverIds.length === 0) {
        alert('No drivers assigned to this dispatch');
        return;
      }
      
      // Update each driver's status to completed
      const updatePromises = driverIds.map(async (driverId) => {
        console.log(`📝 Marking driver ${driverId} as completed by admin`);
        return updateDriverAssignmentStatus(dispatch.id, driverId, 'completed', {
          adminInitiated: true,
          adminId: currentUser?.uid,
          adminName: currentUser?.name || 'Admin'
        });
      });
      
      await Promise.all(updatePromises);
      
      // Send special admin completion notification to customer
      if (dispatch.customerId) {
        await addCustomerNotification(dispatch.customerId, {
          type: 'dispatch_completed_by_admin',
          title: 'Trip Completed by Admin',
          message: `Your dispatch #${dispatch.dispatchId || dispatch.id} has been marked as completed by the administrator. All drivers have been notified.`,
          dispatchId: dispatch.id,
          priority: 'high'
        });
        console.log(`📧 Admin completion notification sent to customer`);
      }
      
      // Send notification to all drivers that admin completed the trip
      for (const driverId of driverIds) {
        await addDriverNotification(driverId, {
          type: 'trip_completed_by_admin',
          title: 'Trip Completed by Admin',
          message: `Your trip for dispatch #${dispatch.dispatchId || dispatch.id} has been marked as completed by the administrator.`,
          dispatchId: dispatch.id,
          priority: 'high'
        });
      }
      console.log(`📧 Admin completion notifications sent to ${driverIds.length} drivers`);
      
      alert(`Trip completed successfully! All ${driverIds.length} drivers have been marked as completed and notified.`);
    } catch (error) {
      console.error('Error completing trip:', error);
      alert('Failed to complete trip: ' + error.message);
    }
  };

  const handleAdminStartTrip = async (dispatch) => {
    if (!confirm(`Start trip for all drivers assigned to dispatch #${dispatch.dispatchId}? This will mark all drivers as in-progress.`)) {
      return;
    }
    
    try {
      console.log(`🔄 Admin manually starting trip for dispatch ${dispatch.id}`);
      
      // Mark all drivers as in-progress
      const driverAssignments = dispatch.driverAssignments || {};
      const driverIds = Object.keys(driverAssignments);
      
      if (driverIds.length === 0) {
        alert('No drivers assigned to this dispatch');
        return;
      }
      
      // Update each driver's status to in-progress
      const updatePromises = driverIds.map(async (driverId) => {
        console.log(`📝 Marking driver ${driverId} as in-progress by admin`);
        return updateDriverAssignmentStatus(dispatch.id, driverId, 'in-progress', {
          adminInitiated: true,
          adminId: currentUser?.uid,
          adminName: currentUser?.name || 'Admin'
        });
      });
      
      await Promise.all(updatePromises);
      
      // Send special admin start notification to customer
      if (dispatch.customerId) {
        await addCustomerNotification(dispatch.customerId, {
          type: 'dispatch_started_by_admin',
          title: 'Trip Started by Admin',
          message: `Your dispatch #${dispatch.dispatchId || dispatch.id} has been started by the administrator. All drivers have been notified and are now in progress.`,
          dispatchId: dispatch.id,
          priority: 'high'
        });
        console.log(`📧 Admin start notification sent to customer`);
      }
      
      // Send notification to all drivers that admin started the trip
      for (const driverId of driverIds) {
        await addDriverNotification(driverId, {
          type: 'trip_started_by_admin',
          title: 'Trip Started by Admin',
          message: `Your trip for dispatch #${dispatch.dispatchId || dispatch.id} has been started by the administrator. You are now in progress.`,
          dispatchId: dispatch.id,
          priority: 'high'
        });
      }
      console.log(`📧 Admin start notifications sent to ${driverIds.length} drivers`);
      
      alert(`Trip started successfully! All ${driverIds.length} drivers have been marked as in-progress and notified.`);
    } catch (error) {
      console.error('Error starting trip:', error);
      alert('Failed to start trip: ' + error.message);
    }
  };

  const handleDriverStatusChange = async (driverId, newStatus) => {
    if (!selectedDispatch) return;
    
    const statusMessages = {
      'in-progress': 'start',
      'completed': 'complete',
      'assigned': 'reset'
    };
    
    const action = statusMessages[newStatus] || 'update';
    const driver = drivers.find(d => d.id === driverId || d.driverId === driverId);
    const driverName = driver?.name || driver?.firstName || `Driver ${driverId}`;
    
    if (!confirm(`Are you sure you want to ${action} ${driverName}'s trip?`)) {
      return;
    }
    
    try {
      console.log(`🔄 Admin updating driver ${driverId} (${driverName}) status to ${newStatus}`);
      
      // Update driver status with admin context
      await updateDriverAssignmentStatus(selectedDispatch.id, driverId, newStatus, {
        adminInitiated: true,
        adminId: currentUser?.uid,
        adminName: currentUser?.name || 'Admin'
      });
      
      console.log('✅ Driver status updated successfully');
      
      // Send specific notification to the affected driver
      const notificationMessages = {
        'in-progress': {
          title: 'Trip Started by Admin',
          message: `Your trip for dispatch #${selectedDispatch.dispatchId || selectedDispatch.id} has been started by the administrator.`,
          type: 'trip_started_by_admin'
        },
        'completed': {
          title: 'Trip Completed by Admin',
          message: `Your trip for dispatch #${selectedDispatch.dispatchId || selectedDispatch.id} has been marked as completed by the administrator.`,
          type: 'trip_completed_by_admin'
        },
        'assigned': {
          title: 'Trip Status Reset by Admin',
          message: `Your trip status for dispatch #${selectedDispatch.dispatchId || selectedDispatch.id} has been reset by the administrator.`,
          type: 'trip_reset_by_admin'
        }
      };
      
      if (notificationMessages[newStatus]) {
        await addDriverNotification(driverId, {
          ...notificationMessages[newStatus],
          dispatchId: selectedDispatch.id,
          priority: 'high'
        });
        console.log(`📧 Admin action notification sent to driver ${driverName}`);
      }
      
      // Send notification to customer if status change is significant
      if ((newStatus === 'in-progress' || newStatus === 'completed') && selectedDispatch.customerId) {
        const customerMessages = {
          'in-progress': `Driver ${driverName} has started their trip for dispatch #${selectedDispatch.dispatchId || selectedDispatch.id}.`,
          'completed': `Driver ${driverName} has completed their trip for dispatch #${selectedDispatch.dispatchId || selectedDispatch.id}.`
        };
        
        await addCustomerNotification(selectedDispatch.customerId, {
          type: `driver_${newStatus}_by_admin`,
          title: newStatus === 'in-progress' ? 'Driver Started Trip' : 'Driver Completed Trip',
          message: customerMessages[newStatus],
          dispatchId: selectedDispatch.id,
          driverId: driverId,
          priority: 'normal'
        });
        console.log(`📧 Customer notification sent for driver status change`);
      }
      
      // Update local state to reflect changes immediately
      const updatedDispatch = { ...selectedDispatch };
      if (updatedDispatch.driverAssignments && updatedDispatch.driverAssignments[driverId]) {
        updatedDispatch.driverAssignments[driverId].status = newStatus;
        if (newStatus === 'in-progress') {
          updatedDispatch.driverAssignments[driverId].startedAt = new Date();
        } else if (newStatus === 'completed') {
          updatedDispatch.driverAssignments[driverId].completedAt = new Date();
        }
      }
      setSelectedDispatch(updatedDispatch);
      
      alert(`${driverName}'s trip status updated to ${newStatus} successfully!`);
      
    } catch (error) {
      console.error('Error updating driver status:', error);
      alert('Failed to update driver status: ' + error.message);
    }
  };

  const handleStatusChange = async (dispatchId, newStatus) => {
    try {
      const dispatch = dispatches.find(d => d.id === dispatchId);
      
      if (newStatus === 'in-progress') {
        await startDispatchTrip(dispatchId, 'admin_id');
        
        // Send notifications for trip start
        if (dispatch) {
          // Notify customer
          if (dispatch.customerId) {
            await addCustomerNotification(dispatch.customerId, {
              type: 'trip_started',
              title: 'Trip Started',
              message: `Your dispatch #${dispatch.dispatchId || dispatchId} has started. Driver is on the way to pickup location.`,
              dispatchId: dispatchId,
              priority: 'high',
              senderId: currentUser?.uid || 'admin',
              senderName: currentUser?.displayName || currentUser?.email || 'Admin'
            });
          }

          // Notify assigned drivers
          if (dispatch.assignments) {
            for (const assignment of dispatch.assignments) {
              await addDriverNotification(assignment.driverId, {
                type: 'trip_started',
                title: 'Trip Started',
                message: `Dispatch #${dispatch.dispatchId || dispatchId} has been started. Please proceed to pickup location.`,
                dispatchId: dispatchId,
                priority: 'high',
                actionRequired: true,
                senderId: currentUser?.uid || 'admin',
                senderName: currentUser?.displayName || currentUser?.email || 'Admin'
              });
            }
          }
        }
        
      } else if (newStatus === 'completed') {
        await completeDispatchTrip(dispatchId, 'admin_id');
        
        // Send notifications for trip completion
        if (dispatch) {
          // Notify customer
          if (dispatch.customerId) {
            await addCustomerNotification(dispatch.customerId, {
              type: 'trip_completed',
              title: 'Trip Completed',
              message: `Your dispatch #${dispatch.dispatchId || dispatchId} has been completed successfully. Thank you for choosing our service!`,
              dispatchId: dispatchId,
              priority: 'normal',
              senderId: currentUser?.uid || 'admin',
              senderName: currentUser?.displayName || currentUser?.email || 'Admin'
            });
          }

          // Notify assigned drivers
          if (dispatch.assignments) {
            for (const assignment of dispatch.assignments) {
              await addDriverNotification(assignment.driverId, {
                type: 'trip_completed',
                title: 'Trip Completed',
                message: `Dispatch #${dispatch.dispatchId || dispatchId} has been completed. Great job!`,
                dispatchId: dispatchId,
                priority: 'normal',
                senderId: currentUser?.uid || 'admin',
                senderName: currentUser?.displayName || currentUser?.email || 'Admin'
              });
            }
          }
        }
      }
      
      await loadData();
    } catch (error) {
      console.error('Error updating status:', error);
      alert('Error updating status: ' + error.message);
    }
  };

  // Modal handlers
  const openDetailsModal = async (dispatch) => {
    setSelectedDispatch(dispatch);
    setShowDetailsModal(true);
    
    // Load dispatch images for this trip
    try {
      const images = await getDispatchImages(dispatch.id);
      setDispatchImages(prev => ({
        ...prev,
        [dispatch.id]: images
      }));
    } catch (error) {
      console.error('Error loading dispatch images:', error);
    }
  };

  const openAssignModal = async (dispatch) => {
    setSelectedDispatch(dispatch);
    
    // Initialize assignments with pickup date
    const pickupDate = getDispatchPickupDate(dispatch);
    const requiredTruckTypes = dispatch.trucksRequired?.map(req => req.truckType) || [];
    
    // Initialize assignment with date
    setAssignments([{ 
      driverId: '', 
      truckId: '', 
      notes: '', 
      assignmentDate: pickupDate 
    }]);
    
    // Load available resources for the pickup date
    await loadAvailableResourcesForDate(pickupDate, requiredTruckTypes);
    
    setShowAssignModal(true);
  };

  const openRejectModal = (dispatch) => {
    setSelectedDispatch(dispatch);
    setShowRejectModal(true);
  };

  const addAssignment = () => {
    const pickupDate = getDispatchPickupDate(selectedDispatch);
    setAssignments([...assignments, { 
      driverId: '', 
      truckId: '', 
      notes: '',
      assignmentDate: pickupDate 
    }]);
  };

  const removeAssignment = (index) => {
    setAssignments(assignments.filter((_, i) => i !== index));
  };

  const updateAssignment = (index, field, value) => {
    const updated = assignments.map((assignment, i) => 
      i === index ? { ...assignment, [field]: value } : assignment
    );
    setAssignments(updated);
    
    // Clear any error for this assignment when updating
    if (assignmentErrors[index]) {
      setAssignmentErrors(prev => ({
        ...prev,
        [index]: null
      }));
    }
    
    // If updating driver or truck, check availability
    if (field === 'driverId' || field === 'truckId') {
      const assignmentDate = updated[index].assignmentDate || getDispatchPickupDate(selectedDispatch);
      if (assignmentDate && updated[index].driverId && updated[index].truckId) {
        checkAssignmentAvailability(index, updated[index].driverId, updated[index].truckId, assignmentDate);
      }
    }
  };

  const getDispatchPickupDate = (dispatch = selectedDispatch) => {
    console.log('🔍 getDispatchPickupDate called with dispatch:', {
      id: dispatch?.id,
      dispatchId: dispatch?.dispatchId,
      pickupDateTime: dispatch?.pickupDateTime,
      pickupDate: dispatch?.pickupDate
    });
    
    // Try pickupDateTime first (new format)
    if (dispatch?.pickupDateTime) {
      // Handle Firebase Timestamp
      if (dispatch.pickupDateTime.toDate && typeof dispatch.pickupDateTime.toDate === 'function') {
        const pickupDate = format(dispatch.pickupDateTime.toDate(), 'yyyy-MM-dd');
        console.log('✅ Using pickupDateTime (Firebase Timestamp):', pickupDate);
        return pickupDate;
      }
      // Handle regular Date
      const pickupDate = format(new Date(dispatch.pickupDateTime), 'yyyy-MM-dd');
      console.log('✅ Using pickupDateTime (regular Date):', pickupDate);
      return pickupDate;
    }
    // Try pickupDate (legacy format)
    if (dispatch?.pickupDate) {
      if (dispatch.pickupDate.toDate && typeof dispatch.pickupDate.toDate === 'function') {
        const pickupDate = format(dispatch.pickupDate.toDate(), 'yyyy-MM-dd');
        console.log('✅ Using pickupDate (Firebase Timestamp):', pickupDate);
        return pickupDate;
      }
      const pickupDate = format(new Date(dispatch.pickupDate), 'yyyy-MM-dd');
      console.log('✅ Using pickupDate (regular Date):', pickupDate);
      return pickupDate;
    }
    
    const todayDate = format(new Date(), 'yyyy-MM-dd');
    console.log('⚠️ No pickup date found, defaulting to today:', todayDate);
    return todayDate; // Default to today
  };

  const getFormattedPickupDate = () => {
    // Try pickupDateTime first (new format)
    if (selectedDispatch?.pickupDateTime) {
      // Handle Firebase Timestamp
      if (selectedDispatch.pickupDateTime.toDate && typeof selectedDispatch.pickupDateTime.toDate === 'function') {
        return format(selectedDispatch.pickupDateTime.toDate(), 'MMM dd, yyyy');
      }
      // Handle regular Date
      return format(new Date(selectedDispatch.pickupDateTime), 'MMM dd, yyyy');
    }
    // Try pickupDate (legacy format)
    if (selectedDispatch?.pickupDate) {
      if (selectedDispatch.pickupDate.toDate && typeof selectedDispatch.pickupDate.toDate === 'function') {
        return format(selectedDispatch.pickupDate.toDate(), 'MMM dd, yyyy');
      }
      return format(new Date(selectedDispatch.pickupDate), 'MMM dd, yyyy');
    }
    return 'Not specified';
  };

  const checkAssignmentAvailability = async (index, driverId, truckId, date) => {
    if (!driverId || !truckId || !date) return;
    
    setCheckingAvailability(true);
    try {
      const availability = await checkAvailability(driverId, truckId, date);
      
      if (!availability.bothAvailable) {
        let errorMessage = '';
        if (!availability.driverAvailable) {
          errorMessage += `Driver already assigned on ${date}. `;
        }
        if (!availability.truckAvailable) {
          errorMessage += `Truck already assigned on ${date}.`;
        }
        
        setAssignmentErrors(prev => ({
          ...prev,
          [index]: errorMessage.trim()
        }));
      } else {
        setAssignmentErrors(prev => ({
          ...prev,
          [index]: null
        }));
      }
    } catch (error) {
      console.error('Error checking availability:', error);
    }
    setCheckingAvailability(false);
  };

  const loadAvailableResourcesForDate = async (date, requiredTruckTypes = []) => {
    try {
      console.log('Loading resources for date:', date, 'required types:', requiredTruckTypes);
      console.log('Total trucks:', trucks.length);
      
      // Get available drivers for the selected date
      const availDrivers = await getAvailableDriversForDate(drivers, date);
      setAvailableDrivers(availDrivers);
      console.log('Available drivers:', availDrivers.length);
      
      // For now, get all available trucks regardless of type to allow admin flexibility
      // TODO: In the future, we can make this more strict based on truck type matching
      const availTrucks = await getAvailableTrucksForDate(trucks, date);
      
      console.log('Available trucks:', availTrucks.length, availTrucks);
      setAvailableTrucks(availTrucks);
    } catch (error) {
      console.error('Error loading available resources:', error);
    }
  };

  const dispatchStatuses = [
    { value: 'pending', label: 'Pending' },
    { value: 'accepted', label: 'Accepted' },
    { value: 'assigned', label: 'Assigned' },
    { value: 'in-progress', label: 'In Progress' },
    { value: 'completed', label: 'Completed' },
    { value: 'rejected', label: 'Rejected' }
  ];

  const filteredDispatches = dispatches.filter(dispatch => {
    // Only show active requests (not completed/rejected/cancelled)
    const isActiveRequest = ['pending', 'accepted', 'assigned', 'in-progress'].includes(dispatch.status);
    
    const matchesSearch = searchTerm === '' || 
      dispatch.dispatchId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      getCustomerName(dispatch.customerId).toLowerCase().includes(searchTerm.toLowerCase()) ||
      dispatch.sourceLocation?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      dispatch.destinationLocation?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || dispatch.status === statusFilter;
    
    return isActiveRequest && matchesSearch && matchesStatus;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <FontAwesomeIcon icon={['fas', 'spinner']} spin className="text-4xl text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold text-gray-900">Dispatch Requests</h1>
            {getStatusCount('pending') > 0 && (
              <Badge 
                status="warning" 
                customColors={{ 'warning': 'yellow' }}
              >
                {getStatusCount('pending')} New
              </Badge>
            )}
            {!isOnline && (
              <Badge 
                status="danger" 
                customColors={{ 'danger': 'red' }}
              >
                <FontAwesomeIcon icon={['fas', 'wifi']} className="mr-1" />
                Offline
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-4 mt-2">
            <p className="text-gray-600">Manage and process dispatch requests</p>
            {!isOnline && (
              <p className="text-sm text-red-600">
                Status updates may be delayed while offline • Last sync: {lastSyncTime.toLocaleTimeString()}
              </p>
            )}
          </div>
        </div>
        <div className="mt-4 md:mt-0 flex space-x-3">
          <Button 
            variant="secondary" 
            icon={['fas', 'sync-alt']}
            onClick={() => {
              console.log('🔄 Manual status sync triggered');
              dispatches.forEach(dispatch => {
                if (dispatch.driverAssignments && Object.keys(dispatch.driverAssignments).length > 0) {
                  updateOverallDispatchStatus(dispatch.id);
                }
              });
              setLastSyncTime(new Date());
            }}
          >
            Sync Status
          </Button>
          <Button variant="secondary" icon={['fas', 'map']}>
            View on Map
          </Button>
          <Button variant="secondary" icon={['fas', 'download']}>
            Export Requests
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="bg-yellow-50 border-yellow-200">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <FontAwesomeIcon icon={['fas', 'clock']} className="h-8 w-8 text-yellow-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-yellow-600">Pending</p>
              <p className="text-2xl font-bold text-yellow-900">{getStatusCount('pending')}</p>
            </div>
          </div>
        </Card>

        <Card className="bg-blue-50 border-blue-200">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <FontAwesomeIcon icon={['fas', 'check']} className="h-8 w-8 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-blue-600">Accepted</p>
              <p className="text-2xl font-bold text-blue-900">{getStatusCount('accepted')}</p>
            </div>
          </div>
        </Card>

        <Card className="bg-indigo-50 border-indigo-200">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <FontAwesomeIcon icon={['fas', 'user-check']} className="h-8 w-8 text-indigo-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-indigo-600">Assigned</p>
              <p className="text-2xl font-bold text-indigo-900">{getStatusCount('assigned')}</p>
            </div>
          </div>
        </Card>

        <Card className="bg-purple-50 border-purple-200">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <FontAwesomeIcon icon={['fas', 'route']} className="h-8 w-8 text-purple-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-purple-600">In Progress</p>
              <p className="text-2xl font-bold text-purple-900">{getStatusCount('in-progress')}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <div className="flex flex-col md:flex-row md:items-center space-y-4 md:space-y-0 md:space-x-4">
          <div className="flex-1">
            <Input
              placeholder="Search by dispatch ID, customer, or location..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              icon={['fas', 'search']}
            />
          </div>
          <div className="w-full md:w-48">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">All Status</option>
              {dispatchStatuses.map(status => (
                <option key={status.value} value={status.value}>{status.label}</option>
              ))}
            </select>
          </div>
          <div className="text-sm text-gray-500">
            Showing {filteredDispatches.length} of {dispatches.length} requests
          </div>
        </div>
      </Card>

      {/* Requests Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Dispatch Details
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Customer
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Route
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Created
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredDispatches.length > 0 ? (
                filteredDispatches.map((dispatch) => (
                  <tr 
                    key={dispatch.id} 
                    className={`hover:bg-gray-50 transition-colors ${
                      highlightedTrip === dispatch.id 
                        ? 'bg-yellow-100 border-l-4 border-yellow-500 animate-pulse' 
                        : ''
                    }`}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0">
                          <FontAwesomeIcon icon={['fas', 'truck']} className="h-8 w-8 text-blue-600" />
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">#{dispatch.dispatchId}</div>
                          <div className="text-sm text-gray-500">{dispatch.trucksRequired?.[0]?.truckType || 'N/A'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{getCustomerName(dispatch.customerId)}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900 max-w-xs">
                        <p className="flex items-center font-medium">
                          <FontAwesomeIcon icon={['fas', 'map-marker-alt']} className="text-green-500 mr-1" />
                          {dispatch.sourceLocation?.address || dispatch.sourceLocation || 'N/A'}
                        </p>
                        <p className="flex items-center text-gray-500 mt-1">
                          <FontAwesomeIcon icon={['fas', 'flag-checkered']} className="text-red-500 mr-1" />
                          {dispatch.destinationLocation?.address || dispatch.destinationLocation || 'N/A'}
                        </p>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        dispatch.status === 'pending' ? 'bg-orange-100 text-orange-800' :
                        dispatch.status === 'accepted' ? 'bg-blue-100 text-blue-800' :
                        dispatch.status === 'assigned' ? 'bg-blue-100 text-blue-800' :
                        dispatch.status === 'in-progress' ? 'bg-purple-100 text-purple-800' :
                        dispatch.status === 'completed' ? 'bg-green-100 text-green-800' :
                        dispatch.status === 'rejected' ? 'bg-red-100 text-red-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {dispatch.status.charAt(0).toUpperCase() + dispatch.status.slice(1)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {dispatch.createdAt && dispatch.createdAt.toDate ? 
                        format(dispatch.createdAt.toDate(), 'MMM dd, HH:mm') : 
                        dispatch.createdAt ? format(new Date(dispatch.createdAt), 'MMM dd, HH:mm') : 'N/A'
                      }
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2">
                        <Button
                          size="small"
                          variant="ghost"
                          onClick={() => openDetailsModal(dispatch)}
                        >
                          Details
                        </Button>
                        
                        {/* Pending status actions */}
                        {dispatch.status === 'pending' && (
                          <>
                            <Button
                              size="small"
                              variant="success"
                              onClick={() => handleAcceptRequest(dispatch.id)}
                            >
                              Accept
                            </Button>
                            <Button
                              size="small"
                              variant="danger"
                              onClick={() => openRejectModal(dispatch)}
                            >
                              Reject
                            </Button>
                          </>
                        )}
                        
                        {/* Accepted status actions */}
                        {dispatch.status === 'accepted' && (
                          <Button
                            size="small"
                            variant="primary"
                            onClick={() => openAssignModal(dispatch)}
                          >
                            Assign
                          </Button>
                        )}
                        
                        {/* Dynamic action buttons based on driver statuses */}
                        {(() => {
                          const driverAssignments = dispatch.driverAssignments || {};
                          const assignmentStatuses = Object.values(driverAssignments).map(assignment => assignment.status);
                          console.log(`🔍 Dispatch ${dispatch.dispatchId || dispatch.id}: Assignment statuses:`, assignmentStatuses, 'Dispatch status:', dispatch.status);
                          
                          if (assignmentStatuses.length === 0) {
                            return null; // No assignments
                          } else if (assignmentStatuses.every(status => status === 'completed')) {
                            return (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                <FontAwesomeIcon icon={['fas', 'check-circle']} className="mr-1" />
                                Completed
                              </span>
                            );
                          } else if (assignmentStatuses.some(status => status === 'in-progress')) {
                            return (
                              <Button
                                size="small"
                                variant="success"
                                onClick={() => handleCompleteTrip(dispatch)}
                              >
                                <FontAwesomeIcon icon={['fas', 'check-circle']} className="mr-1" />
                                Complete Trip
                              </Button>
                            );
                          } else if (assignmentStatuses.every(status => status === 'assigned')) {
                            return (
                              <Button
                                size="small"
                                variant="warning"
                                onClick={() => handleAdminStartTrip(dispatch)}
                              >
                                <FontAwesomeIcon icon={['fas', 'play']} className="mr-1" />
                                Start Trip
                              </Button>
                            );
                          } else {
                            return (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                                Mixed Status
                              </span>
                            );
                          }
                        })()}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="6" className="px-6 py-4 text-center text-gray-500">
                    No dispatch requests found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Assignment Modal */}
      {showAssignModal && selectedDispatch && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold">Assign Dispatch #{selectedDispatch.dispatchId || selectedDispatch.id}</h2>
              <button 
                onClick={() => setShowAssignModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <FontAwesomeIcon icon={['fas', 'times']} />
              </button>
            </div>
            
            {/* Dispatch Details */}
            <div className="bg-gray-50 p-4 rounded-lg mb-6">
              <h3 className="font-semibold text-gray-800 mb-3">Dispatch Details</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium">Pickup Location:</span>
                  <p className="text-gray-600">{selectedDispatch.sourceLocation?.address || selectedDispatch.sourceLocation}</p>
                </div>
                <div>
                  <span className="font-medium">Delivery Location:</span>
                  <p className="text-gray-600">{selectedDispatch.destinationLocation?.address || selectedDispatch.destinationLocation}</p>
                </div>
                <div>
                  <span className="font-medium">Pickup Date:</span>
                  <p className="text-gray-600">{getFormattedPickupDate()}</p>
                </div>
                <div>
                  <span className="font-medium">Trucks Required:</span>
                  <p className="text-gray-600">
                    {Array.isArray(selectedDispatch.trucksRequired) 
                      ? selectedDispatch.trucksRequired.map(req => `${Number(req.count) || 0} ${String(req.truckType) || 'N/A'}`).join(', ')
                      : Number(selectedDispatch.trucksRequired) || 1
                    }
                  </p>
                </div>
              </div>
            </div>
            
            {assignments.map((assignment, index) => (
              <div key={index} className="border border-gray-200 rounded-lg p-4 mb-4">
                <div className="flex justify-between items-center mb-3">
                  <h4 className="font-medium">Assignment {index + 1}</h4>
                  {assignments.length > 1 && (
                    <Button
                      size="small"
                      variant="danger"
                      onClick={() => removeAssignment(index)}
                    >
                      Remove
                    </Button>
                  )}
                </div>
                
                <div className="grid grid-cols-2 gap-4 mb-4">
                  {/* Assignment Date */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Assignment Date * <span className="text-gray-500">(Auto-filled from pickup date)</span>
                    </label>
                    <input
                      type="date"
                      value={assignment.assignmentDate}
                      readOnly
                      className="w-full p-2 border border-gray-300 rounded-lg bg-gray-50 cursor-not-allowed"
                      title="Assignment date is automatically set from the dispatch pickup date"
                    />
                    {assignmentErrors[`${index}_date`] && (
                      <p className="text-red-500 text-xs mt-1">{assignmentErrors[`${index}_date`]}</p>
                    )}
                  </div>
                  
                  {/* Notes */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Notes
                    </label>
                    <input
                      type="text"
                      value={assignment.notes}
                      onChange={(e) => updateAssignment(index, 'notes', e.target.value)}
                      placeholder="Optional assignment notes"
                      className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  {/* Driver Selection */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Driver * 
                      {assignment.assignmentDate && (
                        <span className="text-xs text-gray-500 ml-2">
                          ({availableDrivers.length} available on {assignment.assignmentDate})
                        </span>
                      )}
                    </label>
                    <select
                      value={assignment.driverId}
                      onChange={(e) => updateAssignment(index, 'driverId', e.target.value)}
                      className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      disabled={!assignment.assignmentDate}
                    >
                      <option value="">
                        {assignment.assignmentDate ? 'Select driver' : 'Select date first'}
                      </option>
                      {assignment.assignmentDate && availableDrivers.map(driver => (
                        <option key={driver.id} value={driver.id}>
                          {driver.name}{driver.licenseType ? ` (${driver.licenseType})` : ''} - {driver.status}
                        </option>
                      ))}
                    </select>
                    {assignmentErrors[`${index}_driver`] && (
                      <p className="text-red-500 text-xs mt-1">{assignmentErrors[`${index}_driver`]}</p>
                    )}
                  </div>
                  
                  {/* Truck Selection */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Truck *
                      {assignment.assignmentDate && (
                        <span className="text-xs text-gray-500 ml-2">
                          ({availableTrucks.length} available on {assignment.assignmentDate})
                        </span>
                      )}
                    </label>
                    <select
                      value={assignment.truckId}
                      onChange={(e) => updateAssignment(index, 'truckId', e.target.value)}
                      className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      disabled={!assignment.assignmentDate}
                    >
                      <option value="">
                        {assignment.assignmentDate ? 'Select truck' : 'Select date first'}
                      </option>
                      {assignment.assignmentDate && availableTrucks.map(truck => (
                        <option key={truck.id} value={truck.id}>
                          {truck.plateNumber} - {truck.truckType} ({truck.status})
                        </option>
                      ))}
                    </select>
                    {assignmentErrors[`${index}_truck`] && (
                      <p className="text-red-500 text-xs mt-1">{assignmentErrors[`${index}_truck`]}</p>
                    )}
                  </div>
                </div>
                
                {/* Assignment Conflicts Display */}
                {(assignmentErrors[`${index}_driver_conflict`] || assignmentErrors[`${index}_truck_conflict`]) && (
                  <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <h5 className="font-medium text-red-800 mb-2">Assignment Conflicts:</h5>
                    {assignmentErrors[`${index}_driver_conflict`] && (
                      <p className="text-red-700 text-sm mb-1">• Driver: {assignmentErrors[`${index}_driver_conflict`]}</p>
                    )}
                    {assignmentErrors[`${index}_truck_conflict`] && (
                      <p className="text-red-700 text-sm">• Truck: {assignmentErrors[`${index}_truck_conflict`]}</p>
                    )}
                  </div>
                )}
              </div>
            ))}
            
            <div className="flex justify-between items-center mb-6">
              <Button
                variant="secondary"
                icon={['fas', 'plus']}
                onClick={addAssignment}
                disabled={assignments.length >= (Array.isArray(selectedDispatch.trucksRequired) 
                  ? selectedDispatch.trucksRequired.reduce((sum, req) => sum + (Number(req.count) || 0), 0)
                  : Number(selectedDispatch.trucksRequired) || 5)}
              >
                Add Another Assignment
              </Button>
              
              <div className="text-sm text-gray-600">
                {assignments.length} / {Array.isArray(selectedDispatch.trucksRequired) 
                  ? selectedDispatch.trucksRequired.reduce((sum, req) => sum + (Number(req.count) || 0), 0)
                  : Number(selectedDispatch.trucksRequired) || 1} trucks assigned
              </div>
            </div>
            
            <div className="flex space-x-3 mt-6 border-t pt-4">
              <Button
                onClick={() => setShowAssignModal(false)}
                variant="ghost"
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleAssignDispatch}
                variant="primary"
                className="flex-1"
                disabled={assignments.every(a => !a.driverId || !a.truckId) || Object.values(assignmentErrors).some(error => error !== null)}
              >
                Assign Dispatch
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Rejection Modal */}
      {showRejectModal && selectedDispatch && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-red-600">
                Reject Request #{selectedDispatch.dispatchId}
              </h3>
              <button
                onClick={() => setShowRejectModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <FontAwesomeIcon icon={['fas', 'times']} />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Rejection Reason *
                </label>
                <textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-red-500 focus:border-red-500"
                  placeholder="Please provide a reason for rejecting this request..."
                  required
                />
              </div>
            </div>

            <div className="flex space-x-3 mt-6">
              <Button
                onClick={() => setShowRejectModal(false)}
                variant="ghost"
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleRejectRequest}
                variant="danger"
                className="flex-1"
                disabled={!rejectionReason.trim()}
              >
                Reject Request
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Details Modal */}
      {showDetailsModal && selectedDispatch && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">
                Dispatch Details - #{selectedDispatch.dispatchId}
              </h3>
              <button
                onClick={() => setShowDetailsModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <FontAwesomeIcon icon={['fas', 'times']} />
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Customer Information */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="text-md font-semibold text-gray-800 mb-4 flex items-center">
                  <FontAwesomeIcon icon={['fas', 'user']} className="mr-2 text-blue-500" />
                  Customer Information
                </h4>
                {(() => {
                  const customer = getCustomerDetails(selectedDispatch.customerId);
                  return (
                    <div className="space-y-2 text-sm">
                      <p><strong>Name:</strong> {customer.name}</p>
                      <p><strong>Email:</strong> {customer.email}</p>
                      <p><strong>Phone:</strong> {customer.phone}</p>
                      <p><strong>Address:</strong> {customer.address}</p>
                    </div>
                  );
                })()}
              </div>
              
              {/* Dispatch Information */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="text-md font-semibold text-gray-800 mb-4 flex items-center">
                  <FontAwesomeIcon icon={['fas', 'truck']} className="mr-2 text-green-500" />
                  Dispatch Information
                </h4>
                <div className="space-y-2 text-sm">
                  <p><strong>Dispatch ID:</strong> #{selectedDispatch.dispatchId}</p>
                  <p><strong>Status:</strong> 
                    <span className="ml-2">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        selectedDispatch.status === 'pending' ? 'bg-orange-100 text-orange-800' :
                        selectedDispatch.status === 'accepted' ? 'bg-blue-100 text-blue-800' :
                        selectedDispatch.status === 'assigned' ? 'bg-blue-100 text-blue-800' :
                        selectedDispatch.status === 'in-progress' ? 'bg-purple-100 text-purple-800' :
                        selectedDispatch.status === 'completed' ? 'bg-green-100 text-green-800' :
                        selectedDispatch.status === 'rejected' ? 'bg-red-100 text-red-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {selectedDispatch.status.charAt(0).toUpperCase() + selectedDispatch.status.slice(1)}
                      </span>
                    </span>
                  </p>
                  <p><strong>Created:</strong> {formatDate(selectedDispatch.createdAt)}</p>
                  {selectedDispatch.pickupDateTime && (
                    <p><strong>Pickup Date:</strong> {formatDate(selectedDispatch.pickupDateTime)}</p>
                  )}
                </div>
              </div>              <div className="md:col-span-2">
                <h4 className="font-medium text-gray-900 mb-3">Route Information</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p><strong>Pickup Location:</strong></p>
                    <p className="text-gray-700 bg-gray-50 p-2 rounded">{selectedDispatch.sourceLocation}</p>
                    <p><strong>Pickup Date:</strong> {selectedDispatch.pickupDateTime && format(new Date(selectedDispatch.pickupDateTime.toDate()), 'MMM dd, yyyy')}</p>
                  </div>
                  <div>
                    <p><strong>Dropoff Location:</strong></p>
                    <p className="text-gray-700 bg-gray-50 p-2 rounded">{selectedDispatch.destinationLocation}</p>
                    {selectedDispatch.distance && (
                      <p><strong>Distance:</strong> <span className="text-blue-600 font-semibold">{selectedDispatch.distance}</span></p>
                    )}
                  </div>
                </div>
              </div>

              <div className="md:col-span-2">
                <h4 className="font-medium text-gray-900 mb-3">Truck Requirements</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {selectedDispatch.trucksRequired && Array.isArray(selectedDispatch.trucksRequired) && selectedDispatch.trucksRequired.map((truck, index) => (
                    <div key={index} className="border border-gray-200 rounded p-3">
                      <p><strong>Type:</strong> {String(truck.truckType || 'N/A')}</p>
                      <p><strong>Count:</strong> {String(truck.count || 0)}</p>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Individual Driver Assignment Status */}
              {selectedDispatch.driverAssignments && Object.keys(selectedDispatch.driverAssignments).length > 0 && (
                <div className="md:col-span-2">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-medium text-gray-900 flex items-center">
                      <FontAwesomeIcon icon={['fas', 'users']} className="mr-2 text-purple-500" />
                      Driver Assignment Status
                    </h4>
                    <Button
                      size="small"
                      variant="secondary"
                      onClick={async () => {
                        console.log('🔄 Manually updating dispatch status...');
                        try {
                          await updateOverallDispatchStatus(selectedDispatch.id);
                          console.log('✅ Status update completed');
                        } catch (error) {
                          console.error('❌ Status update failed:', error);
                        }
                      }}
                    >
                      <FontAwesomeIcon icon={['fas', 'sync-alt']} className="mr-1" />
                      Refresh Status
                    </Button>
                  </div>
                  <div className="space-y-3">
                    {Object.values(selectedDispatch.driverAssignments).map((assignment, index) => {
                      const driver = getDriverDetails(assignment.driverId);
                      const truck = getTruckDetails(assignment.truckId);
                      return (
                        <div key={assignment.driverId} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                          <div className="flex items-center justify-between mb-2">
                            <h5 className="font-medium text-gray-800">
                              {driver.name || `Driver ${assignment.driverId.slice(-4)}`}
                            </h5>
                            <div className="flex items-center space-x-2">
                              <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                assignment.status === 'assigned' ? 'bg-blue-100 text-blue-800' :
                                assignment.status === 'in-progress' ? 'bg-yellow-100 text-yellow-800' :
                                assignment.status === 'completed' ? 'bg-green-100 text-green-800' :
                                'bg-gray-100 text-gray-800'
                              }`}>
                                {assignment.status === 'in-progress' ? 'In Progress' : 
                                 assignment.status.charAt(0).toUpperCase() + assignment.status.slice(1)}
                              </span>
                              
                              {/* Driver Status Change Controls */}
                              <div className="flex space-x-1">
                                {assignment.status === 'assigned' && (
                                  <Button
                                    size="small"
                                    variant="warning"
                                    onClick={() => handleDriverStatusChange(assignment.driverId, 'in-progress')}
                                  >
                                    Start
                                  </Button>
                                )}
                                {assignment.status === 'in-progress' && (
                                  <Button
                                    size="small"
                                    variant="success"
                                    onClick={() => handleDriverStatusChange(assignment.driverId, 'completed')}
                                  >
                                    Complete
                                  </Button>
                                )}
                                {assignment.status === 'completed' && (
                                  <Button
                                    size="small"
                                    variant="secondary"
                                    onClick={() => handleDriverStatusChange(assignment.driverId, 'in-progress')}
                                  >
                                    Restart
                                  </Button>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                            <div>
                              <p><strong>Truck:</strong> {truck.plateNumber || truck.truckId || 'N/A'}</p>
                              <p><strong>Assigned:</strong> {assignment.assignedAt && format(new Date(assignment.assignedAt.seconds ? assignment.assignedAt.seconds * 1000 : assignment.assignedAt), 'MMM dd, yyyy HH:mm')}</p>
                            </div>
                            <div>
                              {assignment.startedAt && (
                                <p><strong>Started:</strong> {format(new Date(assignment.startedAt.seconds ? assignment.startedAt.seconds * 1000 : assignment.startedAt), 'MMM dd, yyyy HH:mm')}</p>
                              )}
                              {assignment.completedAt && (
                                <p><strong>Completed:</strong> {format(new Date(assignment.completedAt.seconds ? assignment.completedAt.seconds * 1000 : assignment.completedAt), 'MMM dd, yyyy HH:mm')}</p>
                              )}
                            </div>
                          </div>
                          {assignment.assignmentNotes && (
                            <div className="mt-2">
                              <p className="text-xs text-gray-600"><strong>Notes:</strong> {assignment.assignmentNotes}</p>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              
              {selectedDispatch.assignments && selectedDispatch.assignments.length > 0 && (
                <div className="md:col-span-2">
                  <h4 className="font-medium text-gray-900 mb-3">Assignment Details</h4>
                  {selectedDispatch.assignments.map((assignment, index) => (
                    <div key={index} className="border border-gray-200 rounded-lg p-4 mb-3">
                      <h5 className="font-medium text-gray-800 mb-2">Assignment #{index + 1}</h5>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <p><strong>Driver:</strong> {getDriverName(assignment.driverId)}</p>
                          <p><strong>Truck:</strong> {getTruckInfo(assignment.truckId)}</p>
                        </div>
                        {assignment.notes && (
                          <div>
                            <p><strong>Notes:</strong></p>
                            <p className="text-gray-700 bg-gray-50 p-2 rounded">{assignment.notes}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {selectedDispatch.notes && (
                <div className="md:col-span-2">
                  <h4 className="font-medium text-gray-900 mb-3">Additional Notes</h4>
                  <p className="text-gray-700 bg-gray-50 p-3 rounded">{selectedDispatch.notes}</p>
                </div>
              )}

              {/* Dispatch Images Section */}
              <div className="md:col-span-2">
                <h4 className="font-medium text-gray-900 mb-3 flex items-center">
                  <FontAwesomeIcon icon={['fas', 'camera']} className="mr-2 text-green-500" />
                  Dispatch Images
                </h4>
                {console.log('🖼️ Selected dispatch data:', selectedDispatch)}
                {console.log('🖼️ Dispatch ID being passed:', selectedDispatch.dispatchId || selectedDispatch.id)}
                <DispatchImagesGallery dispatchId={selectedDispatch.dispatchId || selectedDispatch.id} />
              </div>
            </div>

            <div className="flex justify-end mt-6 border-t pt-4">
              <Button
                onClick={() => setShowDetailsModal(false)}
                variant="primary"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RequestsPage;
