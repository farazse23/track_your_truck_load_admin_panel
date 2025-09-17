import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Badge from '../components/ui/Badge';
import { getDrivers, createDriver, updateDriver, deleteDriver, getTrips, addDriverNotification, subscribeToDrivers } from '../services/data';
import { format } from 'date-fns';

// Notification Modal Component
const NotificationModal = ({ open, onClose, onSend, driver }) => {
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  
  const handleSend = async () => {
    setSending(true);
    await onSend(message);
    setSending(false);
    setMessage('');
    onClose();
  };
  
  if (!open) return null;
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-30">
      <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md">
        <h2 className="text-lg font-bold mb-2">Send Notification to {driver?.name}</h2>
        <textarea
          className="w-full border rounded p-2 mb-4"
          rows={4}
          placeholder="Write your notification..."
          value={message}
          onChange={e => setMessage(e.target.value)}
        />
        <div className="flex justify-end space-x-2">
          <Button onClick={onClose} variant="secondary">Cancel</Button>
          <Button onClick={handleSend} disabled={sending || !message.trim()}>
            {sending ? 'Sending...' : 'Send'}
          </Button>
        </div>
      </div>
    </div>
  );
};

// Helper function for safe date formatting
const formatSafeDate = (dateValue) => {
  if (!dateValue) return 'N/A';
  try {
    let date;
    
    // Handle Firestore Timestamp
    if (dateValue && typeof dateValue === 'object' && dateValue.toDate) {
      date = dateValue.toDate();
    }
    // Handle ISO string
    else if (typeof dateValue === 'string') {
      date = new Date(dateValue);
    }
    // Handle Date object
    else if (dateValue instanceof Date) {
      date = dateValue;
    }
    // Handle timestamp number
    else if (typeof dateValue === 'number') {
      date = new Date(dateValue);
    }
    else {
      return 'N/A';
    }
    
    if (isNaN(date.getTime())) return 'N/A';
    return format(date, 'MMM dd, yyyy');
  } catch (error) {
    console.error('Date formatting error:', error, dateValue);
    return 'N/A';
  }
};

const DriversPage = () => {
  const [drivers, setDrivers] = useState([]);
  const [trips, setTrips] = useState([]);
  const [filteredDrivers, setFilteredDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedDriver, setSelectedDriver] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [newDriver, setNewDriver] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    cnic: '',
    licenseNumber: '',
    status: 'available',
    notes: '',
    profileImage: '',
    licenseImage: '',
  });
  const [editDriver, setEditDriver] = useState({});
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [driverToDelete, setDriverToDelete] = useState(null);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [generatedPassword, setGeneratedPassword] = useState('');
  const [newDriverEmail, setNewDriverEmail] = useState('');
  const [newDriverId, setNewDriverId] = useState('');
  const [notifyDriver, setNotifyDriver] = useState(null);
  const [showNotifyModal, setShowNotifyModal] = useState(false);

  // Send notification to driver
  const handleSendNotification = async (message) => {
    try {
      console.log('Sending notification to driver:', notifyDriver);
      console.log('Driver document ID:', notifyDriver.id);
      
      await addDriverNotification(notifyDriver.id, {
        title: 'Admin Notification',
        message,
        type: 'admin_message',
        priority: 'normal',
        senderId: 'admin_001'
      });
      alert('Notification sent successfully!');
    } catch (error) {
      console.error('Error sending notification:', error);
      alert('Failed to send notification. Please try again.');
    }
  };

  // Get driver's current status based on trip assignments
  const getDriverCurrentStatus = (driverId) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const todayTrips = trips.filter(trip => {
      const tripDate = new Date(trip.date);
      tripDate.setHours(0, 0, 0, 0);
      
      // Check both new format (assignments array) and old format (direct fields)
      if (trip.assignments && Array.isArray(trip.assignments)) {
        return tripDate.getTime() === today.getTime() && 
               trip.assignments.some(assignment => assignment.driverId === driverId);
      } else {
        return tripDate.getTime() === today.getTime() && trip.driverId === driverId;
      }
    });

    if (todayTrips.length === 0) {
      return 'available';
    }

    // Check if any trip is currently active (ongoing)
    const currentTime = new Date();
    const hasActiveTrip = todayTrips.some(trip => {
      if (trip.status === 'completed') return false;
      
      const tripDateTime = new Date(`${trip.date}T${trip.time}`);
      const tripEndTime = new Date(tripDateTime.getTime() + (trip.estimatedDuration || 2) * 60 * 60 * 1000);
      
      return currentTime >= tripDateTime && currentTime <= tripEndTime;
    });

    return hasActiveTrip ? 'on-trip' : 'assigned';
  };

  useEffect(() => {
    // Set up real-time listeners
    const unsubscribeDrivers = subscribeToDrivers((driversData) => {
      setDrivers(driversData);
      setLoading(false);
    });
    
    loadTrips();

    return () => {
      unsubscribeDrivers();
    };
  }, []);

  useEffect(() => {
    filterDrivers();
  }, [drivers, trips, searchTerm, statusFilter]);

  const loadDrivers = async () => {
    try {
      const driversData = await getDrivers();
      setDrivers(driversData);
    } catch (error) {
      console.error('Error loading drivers:', error);
    }
  };

  const loadTrips = async () => {
    try {
      const tripsData = await getTrips();
      setTrips(tripsData);
    } catch (error) {
      console.error('Error loading trips:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterDrivers = () => {
    let filtered = drivers;

    if (searchTerm) {
      filtered = filtered.filter(driver => 
        driver.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        driver.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        driver.phone.includes(searchTerm) ||
        (driver.licenseNumber && driver.licenseNumber.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    if (statusFilter !== 'all') {
      if (statusFilter === 'not-available') {
        filtered = filtered.filter(driver => driver.status === 'not-available');
      } else {
        // Filter by dynamic status for available drivers
        filtered = filtered.filter(driver => {
          if (driver.status === 'not-available') return false;
          return getDriverCurrentStatus(driver.id) === statusFilter;
        });
      }
    }

    setFilteredDrivers(filtered);
  };

  const handleAddDriver = async (e) => {
    e.preventDefault();
    try {
      const result = await createDriver(newDriver);
      
      // Show password to admin
      setGeneratedPassword(result.tempPassword);
      setNewDriverEmail(result.email);
      setNewDriverId(result.driverId);
      setShowPasswordModal(true);
      
      setShowAddModal(false);
      setNewDriver({
        name: '',
        email: '',
        phone: '',
        address: '',
        cnic: '',
        licenseNumber: '',
        status: 'available',
        notes: '',
        profileImage: '',
        licenseImage: '',
      });
      // Real-time listener will update the data automatically
    } catch (error) {
      console.error('Error adding driver:', error);
      alert('Error adding driver: ' + error.message);
    }
  };

  const handleStatusChange = async (driverId, newStatus) => {
    try {
      console.log(`Updating driver ${driverId} status to: ${newStatus}`);
      await updateDriver(driverId, { status: newStatus });
      console.log(`Driver status updated successfully`);
      
      // Find the driver to get their name
      const driver = drivers.find(d => d.id === driverId);
      const driverName = driver?.name || 'Driver';

      // Send notification to the driver about status change
      if (newStatus === 'not-available' || newStatus === 'unavailable') {
        await addDriverNotification(driverId, {
          type: 'status_unavailable',
          title: 'Status Changed to Unavailable',
          message: `Your status has been changed to unavailable by the administrator. You will not receive new trip assignments until your status is activated again.`,
          priority: 'high'
        });
        console.log(`✅ Sent unavailable notification to ${driverName}`);
      } else if (newStatus === 'available' || newStatus === 'active') {
        await addDriverNotification(driverId, {
          type: 'status_available', 
          title: 'Status Activated',
          message: `Your status has been activated and you are now available for new trip assignments. You can start receiving dispatch requests.`,
          priority: 'normal'
        });
        console.log(`✅ Sent available notification to ${driverName}`);
      }
      
      // Real-time listener will update the data automatically
    } catch (error) {
      console.error('Error updating driver status:', error);
      alert('Failed to update driver status. Please try again.');
    }
  };

  const handleDeleteDriver = async (driver) => {
    if (window.confirm(`Are you sure you want to delete driver ${driver.name}? This action cannot be undone and will remove all associated data.`)) {
      try {
        await deleteDriver(driver.id);
        // Real-time listener will update the data automatically
      } catch (error) {
        console.error('Error deleting driver:', error);
        alert('Failed to delete driver. Please try again.');
      }
    }
  };

  const handleEditDriver = async (e) => {
    e.preventDefault();
    try {
      await updateDriver(editDriver.id, editDriver);
      setShowEditModal(false);
      setEditDriver({});
      // Real-time listener will update the data automatically
    } catch (error) {
      console.error('Error updating driver:', error);
    }
  };

  const confirmDeleteDriver = (driver) => {
    setDriverToDelete(driver);
    setShowDeleteConfirm(true);
  };

  const openEditModal = (driver) => {
    setEditDriver({...driver});
    setShowEditModal(true);
  };

  const handleImageUpload = (e, type) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (type === 'profile') {
          setNewDriver({...newDriver, profileImage: reader.result});
        } else if (type === 'license') {
          setNewDriver({...newDriver, licenseImage: reader.result});
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleEditImageUpload = (e, type) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (type === 'profile') {
          setEditDriver({...editDriver, profileImage: reader.result});
        } else if (type === 'license') {
          setEditDriver({...editDriver, licenseImage: reader.result});
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(() => {
      alert('Password copied to clipboard!');
    }).catch(() => {
      alert('Failed to copy password. Please copy manually.');
    });
  };

  const openDetailsModal = (driver) => {
    setSelectedDriver(driver);
    setShowDetailsModal(true);
  };

  const getStatusCount = (status) => {
    if (status === 'not-available') {
      return drivers.filter(driver => driver.status === 'not-available').length;
    }
    
    // Count by dynamic status for available drivers
    return drivers.filter(driver => {
      if (driver.status === 'not-available') return false;
      return getDriverCurrentStatus(driver.id) === status;
    }).length;
  };

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
          <h1 className="text-3xl font-bold text-gray-900">Driver Management</h1>
          <p className="mt-2 text-gray-600">Manage drivers and their assignments</p>
        </div>
        <div className="mt-4 md:mt-0 flex space-x-3">
          <Button variant="secondary" icon={['fas', 'download']}>
            Export Drivers
          </Button>
          <Button variant="primary" icon={['fas', 'plus']} onClick={() => setShowAddModal(true)}>
            Add New Driver
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="bg-blue-50 border-blue-200">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <FontAwesomeIcon icon={['fas', 'id-card']} className="h-8 w-8 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-blue-600">Total Drivers</p>
              <p className="text-2xl font-bold text-blue-900">{drivers.length}</p>
            </div>
          </div>
        </Card>

        <Card className="bg-green-50 border-green-200">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <FontAwesomeIcon icon={['fas', 'check-circle']} className="h-8 w-8 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-green-600">Available</p>
              <p className="text-2xl font-bold text-green-900">{getStatusCount('available')}</p>
            </div>
          </div>
        </Card>

        <Card className="bg-purple-50 border-purple-200">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <FontAwesomeIcon icon={['fas', 'user-clock']} className="h-8 w-8 text-purple-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-purple-600">Assigned</p>
              <p className="text-2xl font-bold text-purple-900">{getStatusCount('assigned')}</p>
            </div>
          </div>
        </Card>

        <Card className="bg-yellow-50 border-yellow-200">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <FontAwesomeIcon icon={['fas', 'truck']} className="h-8 w-8 text-yellow-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-yellow-600">On Trip</p>
              <p className="text-2xl font-bold text-yellow-900">{getStatusCount('on-trip')}</p>
            </div>
          </div>
        </Card>

        <Card className="bg-red-50 border-red-200">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <FontAwesomeIcon icon={['fas', 'user-slash']} className="h-8 w-8 text-red-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-red-600">Not Available</p>
              <p className="text-2xl font-bold text-red-900">{getStatusCount('not-available')}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <div className="flex flex-col md:flex-row md:items-center space-y-4 md:space-y-0 md:space-x-4">
          <div className="flex-1">
            <Input
              placeholder="Search by name, email, phone, or license..."
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
              <option value="available">Available</option>
              <option value="assigned">Assigned</option>
              <option value="on-trip">On Trip</option>
              <option value="not-available">Not Available</option>
            </select>
          </div>
          <div className="text-sm text-gray-500">
            Showing {filteredDrivers.length} of {drivers.length} drivers
          </div>
        </div>
      </Card>

      {/* Drivers Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Driver
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Contact
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  License
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  CNIC
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Join Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredDrivers.length > 0 ? (
                filteredDrivers.map((driver) => (
                  <tr key={driver.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <img
                          src={driver.profileImage || `https://ui-avatars.com/api/?name=${driver.name}&background=2563eb&color=ffffff`}
                          alt=""
                          className="h-10 w-10 rounded-full"
                        />
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">{driver.name}</div>
                          <div className="text-sm text-gray-500">{driver.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{driver.phone}</div>
                      <div className="text-sm text-gray-500 max-w-xs truncate">{driver.address}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {driver.licenseNumber}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {driver.cnic}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Badge status={driver.status === 'not-available' ? 'not-available' : getDriverCurrentStatus(driver.id)} />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatSafeDate(driver.createdAt)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2">
                        <Button
                          size="small"
                          variant="ghost"
                          onClick={() => openDetailsModal(driver)}
                        >
                          <FontAwesomeIcon icon={['fas', 'eye']} className="mr-1" />
                          View
                        </Button>
                        <Button
                          size="small"
                          variant="primary"
                          onClick={() => { setNotifyDriver(driver); setShowNotifyModal(true); }}
                        >
                          <FontAwesomeIcon icon={['fas', 'bell']} className="mr-1" />
                          Notify
                        </Button>
                        <Button
                          size="small"
                          variant="secondary"
                          onClick={() => openEditModal(driver)}
                        >
                          <FontAwesomeIcon icon={['fas', 'edit']} className="mr-1" />
                          Edit
                        </Button>
                        <Button
                          size="small"
                          variant={driver.status === 'not-available' ? 'success' : 'warning'}
                          onClick={() => handleStatusChange(driver.id, driver.status === 'not-available' ? 'available' : 'not-available')}
                        >
                          {driver.status === 'not-available' ? 'Make Available' : 'Mark Not Available'}
                        </Button>
                        <Button
                          size="small"
                          variant="danger"
                          onClick={() => handleDeleteDriver(driver)}
                        >
                          <FontAwesomeIcon icon={['fas', 'trash']} className="mr-1" />
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="7" className="px-6 py-12 text-center text-gray-500">
                    <FontAwesomeIcon icon={['fas', 'id-card']} className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                    <p>No drivers found</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Add Driver Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">Add New Driver</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <FontAwesomeIcon icon={['fas', 'times']} />
              </button>
            </div>

            <form onSubmit={handleAddDriver} className="space-y-4">
              {/* Image Upload Section */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Profile Image</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleImageUpload(e, 'profile')}
                    className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                  />
                  {newDriver.profileImage && (
                    <img src={newDriver.profileImage} alt="Profile Preview" className="mt-2 h-16 w-16 rounded-full object-cover" />
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">License Image</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleImageUpload(e, 'license')}
                    className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                  />
                  {newDriver.licenseImage && (
                    <img src={newDriver.licenseImage} alt="License Preview" className="mt-2 h-16 w-24 rounded object-cover" />
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Full Name"
                  value={newDriver.name}
                  onChange={(e) => setNewDriver({...newDriver, name: e.target.value})}
                  required
                />
                <Input
                  label="Email"
                  type="email"
                  value={newDriver.email}
                  onChange={(e) => setNewDriver({...newDriver, email: e.target.value})}
                  required
                />
                <Input
                  label="Phone Number"
                  value={newDriver.phone}
                  onChange={(e) => setNewDriver({...newDriver, phone: e.target.value})}
                  required
                />
                <Input
                  label="CNIC"
                  value={newDriver.cnic}
                  onChange={(e) => setNewDriver({...newDriver, cnic: e.target.value})}
                  placeholder="12345-1234567-1"
                  required
                />
                <Input
                  label="License Number"
                  value={newDriver.licenseNumber}
                  onChange={(e) => setNewDriver({...newDriver, licenseNumber: e.target.value})}
                  required
                />
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                  <select
                    value={newDriver.status}
                    onChange={(e) => setNewDriver({...newDriver, status: e.target.value})}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="available">Available</option>
                    <option value="not-available">Not Available</option>
                  </select>
                </div>
              </div>
              
              <Input
                label="Address"
                value={newDriver.address}
                onChange={(e) => setNewDriver({...newDriver, address: e.target.value})}
                required
              />

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Notes (Optional)</label>
                <textarea
                  value={newDriver.notes}
                  onChange={(e) => setNewDriver({...newDriver, notes: e.target.value})}
                  rows={3}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Additional notes about the driver..."
                />
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t">
                <Button variant="secondary" onClick={() => setShowAddModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary">
                  Add Driver
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Driver Details Modal */}
      {showDetailsModal && selectedDriver && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">Driver Details</h3>
              <button
                onClick={() => setShowDetailsModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <FontAwesomeIcon icon={['fas', 'times']} />
              </button>
            </div>

            <div className="space-y-6">
              <div className="flex items-center space-x-4">
                <img
                  src={selectedDriver.profileImage || `https://ui-avatars.com/api/?name=${selectedDriver.name}&background=2563eb&color=ffffff`}
                  alt=""
                  className="h-20 w-20 rounded-full"
                />
                <div>
                  <h4 className="text-xl font-semibold text-gray-900">{selectedDriver.name}</h4>
                  <p className="text-gray-600">{selectedDriver.email}</p>
                  <Badge status={selectedDriver.status === 'not-available' ? 'not-available' : getDriverCurrentStatus(selectedDriver.id)} />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h5 className="text-sm font-medium text-gray-500 mb-2">Contact Information</h5>
                  <div className="space-y-2">
                    <p><strong>Phone:</strong> {selectedDriver.phone}</p>
                    <p><strong>Address:</strong> {selectedDriver.address}</p>
                    <p><strong>Email:</strong> {selectedDriver.email}</p>
                  </div>
                </div>

                <div>
                  <h5 className="text-sm font-medium text-gray-500 mb-2">License Information</h5>
                  <div className="space-y-2">
                    <p><strong>License Number:</strong> {selectedDriver.licenseNumber}</p>
                    <p><strong>CNIC:</strong> {selectedDriver.cnic}</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-6">
                <div>
                  <h5 className="text-sm font-medium text-gray-500 mb-2">Account Information</h5>
                  <div className="space-y-2">
                    <p><strong>UID:</strong> {selectedDriver.uid || 'N/A'}</p>
                    <p><strong>Role:</strong> {selectedDriver.role || 'Driver'}</p>
                    <p>
                      <strong>Password Status:</strong> 
                      <span className={`ml-2 px-2 py-1 text-xs rounded ${
                        selectedDriver.passwordChanged 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {selectedDriver.passwordChanged ? 'Changed by driver' : 'Default password'}
                      </span>
                    </p>
                  </div>
                </div>
              </div>

              {/* License Image */}
              {selectedDriver.licenseImage && (
                <div>
                  <h5 className="text-sm font-medium text-gray-500 mb-2">License Image</h5>
                  <img 
                    src={selectedDriver.licenseImage} 
                    alt="Driver License" 
                    className="max-w-xs rounded-lg border"
                  />
                </div>
              )}

              {selectedDriver.notes && (
                <div>
                  <h5 className="text-sm font-medium text-gray-500 mb-2">Notes</h5>
                  <p className="text-gray-700">{selectedDriver.notes}</p>
                </div>
              )}

              <div className="flex justify-between pt-4 border-t">
                <Button
                  variant="danger"
                  onClick={() => {
                    setShowDetailsModal(false);
                    confirmDeleteDriver(selectedDriver);
                  }}
                >
                  Delete Driver
                </Button>
                <div className="flex space-x-3">
                  <Button variant="secondary" onClick={() => setShowDetailsModal(false)}>
                    Close
                  </Button>
                  <Button
                    variant="primary"
                    onClick={() => {
                      setShowDetailsModal(false);
                      openEditModal(selectedDriver);
                    }}
                  >
                    Edit Driver
                  </Button>
                  <Button
                    variant={selectedDriver.status === 'not-available' ? 'success' : 'warning'}
                    onClick={() => {
                      handleStatusChange(selectedDriver.id, selectedDriver.status === 'not-available' ? 'available' : 'not-available');
                      setShowDetailsModal(false);
                    }}
                  >
                    {selectedDriver.status === 'not-available' ? 'Make Available' : 'Mark Not Available'}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Driver Modal */}
      {showEditModal && editDriver && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">Edit Driver</h3>
              <button
                onClick={() => setShowEditModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <FontAwesomeIcon icon={['fas', 'times']} />
              </button>
            </div>

            <form onSubmit={handleEditDriver} className="space-y-4">
              {/* Image Upload Section */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Profile Image</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleEditImageUpload(e, 'profile')}
                    className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                  />
                  {editDriver.profileImage && (
                    <img src={editDriver.profileImage} alt="Profile Preview" className="mt-2 h-16 w-16 rounded-full object-cover" />
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">License Image</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleEditImageUpload(e, 'license')}
                    className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                  />
                  {editDriver.licenseImage && (
                    <img src={editDriver.licenseImage} alt="License Preview" className="mt-2 h-16 w-24 rounded object-cover" />
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Full Name"
                  value={editDriver.name || ''}
                  onChange={(e) => setEditDriver({...editDriver, name: e.target.value})}
                  required
                />
                <Input
                  label="Email"
                  type="email"
                  value={editDriver.email || ''}
                  onChange={(e) => setEditDriver({...editDriver, email: e.target.value})}
                  required
                />
                <Input
                  label="Phone Number"
                  value={editDriver.phone || ''}
                  onChange={(e) => setEditDriver({...editDriver, phone: e.target.value})}
                  required
                />
                <Input
                  label="CNIC"
                  value={editDriver.cnic || ''}
                  onChange={(e) => setEditDriver({...editDriver, cnic: e.target.value})}
                  required
                />
                <Input
                  label="License Number"
                  value={editDriver.licenseNumber || ''}
                  onChange={(e) => setEditDriver({...editDriver, licenseNumber: e.target.value})}
                  required
                />
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                  <select
                    value={editDriver.status || 'available'}
                    onChange={(e) => setEditDriver({...editDriver, status: e.target.value})}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="available">Available</option>
                    <option value="not-available">Not Available</option>
                  </select>
                </div>
              </div>
              
              <Input
                label="Address"
                value={editDriver.address || ''}
                onChange={(e) => setEditDriver({...editDriver, address: e.target.value})}
                required
              />

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
                <textarea
                  value={editDriver.notes || ''}
                  onChange={(e) => setEditDriver({...editDriver, notes: e.target.value})}
                  rows={3}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Additional notes about the driver..."
                />
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t">
                <Button variant="secondary" onClick={() => setShowEditModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary">
                  Update Driver
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && driverToDelete && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="text-center">
              <FontAwesomeIcon icon={['fas', 'exclamation-triangle']} className="mx-auto h-12 w-12 text-red-600 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Delete Driver</h3>
              <p className="text-gray-600 mb-6">
                Are you sure you want to delete <strong>{driverToDelete.name}</strong>? 
                This action cannot be undone and will unassign the driver from any current trips.
              </p>
              <div className="flex justify-center space-x-3">
                <Button
                  variant="secondary"
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setDriverToDelete(null);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  variant="danger"
                  onClick={() => handleDeleteDriver(driverToDelete.id)}
                >
                  Delete Driver
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Notification Modal */}
      <NotificationModal
        open={showNotifyModal}
        onClose={() => setShowNotifyModal(false)}
        onSend={handleSendNotification}
        driver={notifyDriver}
      />

      {/* Password Display Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-2/3 lg:w-1/2 shadow-lg rounded-md bg-white">
            <div className="text-center">
              <FontAwesomeIcon icon={['fas', 'key']} className="mx-auto h-12 w-12 text-blue-600 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Driver Account Created Successfully!</h3>
              <p className="text-gray-600 mb-4">
                The driver has been added to the system. Please share these login credentials securely:
              </p>
              
              <div className="bg-gray-50 p-4 rounded-lg mb-4">
                <div className="text-left space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <strong>Email:</strong> 
                      <span className="ml-2 font-mono text-sm bg-white px-3 py-2 rounded border">
                        {newDriverEmail}
                      </span>
                    </div>
                    <div className="flex space-x-2">
                      <button 
                        onClick={() => copyToClipboard(newDriverEmail)}
                        className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center"
                        title="Copy Email"
                      >
                        <FontAwesomeIcon icon={['fas', 'copy']} className="mr-1" />
                        Copy
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <strong>Temporary Password:</strong> 
                      <span className="ml-2 font-mono text-sm bg-white px-3 py-2 rounded border">
                        {generatedPassword}
                      </span>
                    </div>
                    <div className="flex space-x-2">
                      <button 
                        onClick={() => copyToClipboard(generatedPassword)}
                        className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center"
                        title="Copy Password"
                      >
                        <FontAwesomeIcon icon={['fas', 'copy']} className="mr-1" />
                        Copy
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg mb-4 text-left">
                <div className="flex">
                  <FontAwesomeIcon icon={['fas', 'info-circle']} className="h-5 w-5 text-yellow-600 mr-2 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-yellow-800">
                    <p><strong>Important Information:</strong></p>
                    <ul className="list-disc list-inside mt-2 space-y-1">
                      <li>Driver must change password on first login</li>
                      <li>Account has been created with role: <strong>driver</strong></li>
                      <li>Password changed status: <strong>false</strong> (requires change)</li>
                      <li>Share these credentials securely with the driver</li>
                      <li>This information won't be shown again</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg mb-6 text-left">
                <div className="flex">
                  <FontAwesomeIcon icon={['fas', 'envelope']} className="h-5 w-5 text-blue-600 mr-2 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-blue-800">
                    <p><strong>Email Template for Driver:</strong></p>
                    <div className="mt-2 p-3 bg-white border rounded text-gray-700 font-mono text-xs">
                      <p><strong>Subject:</strong> Your Captain Truck Driver Account - Login Credentials</p>
                      <div className="mt-2">
                        <p>Dear Driver,</p>
                        <p className="mt-2">Welcome to Captain Truck! Your driver account has been created.</p>
                        <p className="mt-2"><strong>Login Details:</strong></p>
                        <p>Driver ID: {newDriverId}</p>
                        <p>Email: {newDriverEmail}</p>
                        <p>Temporary Password: {generatedPassword}</p>
                        <p className="mt-2"><strong>Important:</strong> Please change your password immediately after your first login for security.</p>
                        <p className="mt-2">Best regards,<br/>Captain Truck Admin Team</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row justify-center space-y-2 sm:space-y-0 sm:space-x-3">
                <button
                  onClick={() => {
                    const emailTemplate = `Subject: Your Captain Truck Driver Account - Login Credentials

Dear Driver,

Welcome to Captain Truck! Your driver account has been created.

Login Details:
Email: ${newDriverEmail}
Temporary Password: ${generatedPassword}

Important: Please change your password immediately after your first login for security.

Best regards,
Captain Truck Admin Team`;
                    copyToClipboard(emailTemplate);
                    alert('Email template copied to clipboard!');
                  }}
                  className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 flex items-center justify-center"
                >
                  <FontAwesomeIcon icon={['fas', 'envelope']} className="mr-2" />
                  Copy Email Template
                </button>
                <button
                  onClick={() => {
                    const credentials = `Email: ${newDriverEmail}\nPassword: ${generatedPassword}`;
                    copyToClipboard(credentials);
                    alert('Credentials copied to clipboard!');
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center justify-center"
                >
                  <FontAwesomeIcon icon={['fas', 'copy']} className="mr-2" />
                  Copy Both Credentials
                </button>
                <Button
                  variant="primary"
                  onClick={() => {
                    setShowPasswordModal(false);
                    setGeneratedPassword('');
                    setNewDriverEmail('');
                    setNewDriverId('');
                  }}
                >
                  <FontAwesomeIcon icon={['fas', 'check']} className="mr-2" />
                  Done
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DriversPage;
