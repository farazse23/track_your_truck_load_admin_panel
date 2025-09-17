import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Badge from '../components/ui/Badge';
import ProfileImageModal from '../components/modals/ProfileImageModal';
import { getUsers, updateUser, deleteUser, createUser, addCustomerNotification, subscribeToCustomers } from '../services/data';
import { formatDistanceToNow, format } from 'date-fns';

// Notification Modal Component
const NotificationModal = ({ open, onClose, onSend, user }) => {
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
        <h2 className="text-lg font-bold mb-2">Send Notification to {user?.name}</h2>
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
    if (dateValue && typeof dateValue.toDate === 'function') {
      // Firebase Timestamp
      date = dateValue.toDate();
    } else if (dateValue instanceof Date) {
      date = dateValue;
    } else if (typeof dateValue === 'string') {
      date = new Date(dateValue);
    } else {
      return 'N/A';
    }
    
    if (isNaN(date.getTime())) return 'N/A';
    return format(date, 'MMM dd, yyyy');
  } catch (error) {
    return 'N/A';
  }
};

const UsersPage = () => {
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedUser, setSelectedUser] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [notifyUser, setNotifyUser] = useState(null);
  const [showNotifyModal, setShowNotifyModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);
  const [profileImageModal, setProfileImageModal] = useState({ open: false, user: null });

  // Fetch users data
  useEffect(() => {
    // Set up real-time listener for customers
    const unsubscribeCustomers = subscribeToCustomers((customersData) => {
      setUsers(customersData);
      setFilteredUsers(customersData);
      setLoading(false);
    });

    return () => {
      unsubscribeCustomers();
    };
  }, []);  // Filter users based on search term and status
  useEffect(() => {
    let filtered = users;

    if (searchTerm) {
      filtered = filtered.filter(user =>
        user.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.phone?.includes(searchTerm) ||
        user.username?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(user => user.status === statusFilter);
    }

    setFilteredUsers(filtered);
  }, [searchTerm, statusFilter, users]);

  // Send notification to user
  const handleSendNotification = async (message) => {
    try {
      await addCustomerNotification(notifyUser.customerId || notifyUser.id, {
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

  // Handle status change
  const handleStatusChange = async (userId, newStatus) => {
    try {
      await updateUser(userId, { status: newStatus });
      setUsers(prev => prev.map(user => 
        user.id === userId ? { ...user, status: newStatus } : user
      ));

      // Find the user to get their name
      const user = users.find(u => u.id === userId);
      const userName = user?.name || 'User';

      // Send notification to the user about status change
      if (newStatus === 'blocked') {
        await addCustomerNotification(userId, {
          type: 'account_blocked',
          title: 'Account Blocked',
          message: `Your account has been temporarily blocked by the administrator. Please contact support if you believe this is an error.`,
          priority: 'high'
        });
        console.log(`✅ Sent blocking notification to ${userName}`);
      } else if (newStatus === 'active') {
        await addCustomerNotification(userId, {
          type: 'account_activated',
          title: 'Account Activated',
          message: `Your account has been activated and you can now access all services. Welcome back!`,
          priority: 'normal'
        });
        console.log(`✅ Sent activation notification to ${userName}`);
      }
    } catch (error) {
      console.error('Error updating user status:', error);
    }
  };

  // Handle delete user
  const handleDeleteUser = async (user) => {
    if (window.confirm(`Are you sure you want to delete user ${user.name}? This action cannot be undone and will remove all associated data.`)) {
      try {
        await deleteUser(user.id);
        // Real-time listener will update the data automatically
      } catch (error) {
        console.error('Error deleting user:', error);
        alert('Failed to delete user. Please try again.');
      }
    }
  };

  // Modal functions
  const openUserModal = (user) => {
    setSelectedUser(user);
    setShowModal(true);
  };

  const closeUserModal = () => {
    setSelectedUser(null);
    setShowModal(false);
  };

  const confirmDeleteUser = (user) => {
    setUserToDelete(user);
    setShowDeleteConfirm(true);
  };

  // Open profile image modal
  const openProfileImageModal = (user) => {
    setProfileImageModal({ open: true, user });
  };

  // Close profile image modal
  const closeProfileImageModal = () => {
    setProfileImageModal({ open: false, user: null });
  };

  // Get status count
  const getStatusCount = (status) => {
    return users.filter(user => user.status === status).length;
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
          <h1 className="text-3xl font-bold text-gray-900">Customer Management</h1>
          <p className="mt-2 text-gray-600">Manage customer accounts and view their activity</p>
        </div>
        <div className="mt-4 md:mt-0">
          <Button variant="primary" icon={['fas', 'download']}>
            Export CSV
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="bg-blue-50 border-blue-200">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <FontAwesomeIcon icon={['fas', 'users']} className="h-8 w-8 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-blue-600">Total Customers</p>
              <p className="text-2xl font-bold text-blue-900">{users.length}</p>
            </div>
          </div>
        </Card>

        <Card className="bg-green-50 border-green-200">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <FontAwesomeIcon icon={['fas', 'check-circle']} className="h-8 w-8 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-green-600">Active</p>
              <p className="text-2xl font-bold text-green-900">{getStatusCount('active')}</p>
            </div>
          </div>
        </Card>

        <Card className="bg-red-50 border-red-200">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <FontAwesomeIcon icon={['fas', 'ban']} className="h-8 w-8 text-red-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-red-600">Blocked</p>
              <p className="text-2xl font-bold text-red-900">{getStatusCount('blocked')}</p>
            </div>
          </div>
        </Card>

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
      </div>

      {/* Filters */}
      <Card>
        <div className="flex flex-col md:flex-row md:items-center space-y-4 md:space-y-0 md:space-x-4">
          <div className="flex-1">
            <Input
              placeholder="Search by name, email, phone, or username..."
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
              <option value="active">Active</option>
              <option value="blocked">Blocked</option>
              <option value="pending">Pending</option>
            </select>
          </div>
          <div className="text-sm text-gray-500">
            Showing {filteredUsers.length} of {users.length} customers
          </div>
        </div>
      </Card>

      {/* Users Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Customer
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  User Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Contact
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Join Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredUsers.length > 0 ? (
                filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="relative">
                          {(user.profileImage || user.profilePicture || user.avatar || user.photoURL) ? (
                            <img
                              src={user.profileImage || user.profilePicture || user.avatar || user.photoURL}
                              alt=""
                              className="h-10 w-10 rounded-full object-cover cursor-pointer hover:ring-2 hover:ring-blue-500 transition-all"
                              onClick={() => openProfileImageModal(user)}
                              onError={(e) => {
                                console.log('Image failed to load:', e.target.src);
                                e.target.style.display = 'none';
                                e.target.nextSibling.style.display = 'flex';
                              }}
                            />
                          ) : null}
                          <div 
                            className={`h-10 w-10 rounded-full bg-blue-500 flex items-center justify-center cursor-pointer hover:ring-2 hover:ring-blue-600 transition-all ${(user.profileImage || user.profilePicture || user.avatar || user.photoURL) ? 'hidden' : ''}`}
                            onClick={() => openProfileImageModal(user)}
                          >
                            <span className="text-white text-sm font-medium">
                              {user.name ? user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : 
                               user.email ? user.email.charAt(0).toUpperCase() : 'U'}
                            </span>
                          </div>
                          <div className="absolute inset-0 rounded-full bg-black bg-opacity-0 hover:bg-opacity-10 cursor-pointer transition-all"
                               onClick={() => openProfileImageModal(user)}></div>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">{user.name || 'N/A'}</div>
                          <div className="text-sm text-gray-500">{user.email || 'N/A'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {user.username || user.displayName || user.name || 'N/A'}
                      </div>
                      <div className="text-sm text-gray-500">
                        {user.email ? user.email.split('@')[0] : 'No username'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{user.phone || 'N/A'}</div>
                      <div className="text-sm text-gray-500 max-w-xs truncate">{user.address || 'No address'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatSafeDate(user.createdAt)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Badge status={user.status || 'active'} />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2">
                        <Button
                          size="small"
                          variant="ghost"
                          onClick={() => openUserModal(user)}
                        >
                          <FontAwesomeIcon icon={['fas', 'eye']} className="mr-1" />
                          View
                        </Button>
                        <Button
                          size="small"
                          variant="primary"
                          onClick={() => { setNotifyUser(user); setShowNotifyModal(true); }}
                        >
                          <FontAwesomeIcon icon={['fas', 'bell']} className="mr-1" />
                          Notify
                        </Button>
                        <Button
                          size="small"
                          variant={user.status === 'active' ? 'danger' : 'success'}
                          onClick={() => handleStatusChange(user.id, user.status === 'active' ? 'blocked' : 'active')}
                        >
                          {user.status === 'active' ? 'Block' : 'Activate'}
                        </Button>
                        <Button
                          size="small"
                          variant="danger"
                          onClick={() => handleDeleteUser(user)}
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
                  <td colSpan="6" className="px-6 py-12 text-center text-gray-500">
                    <FontAwesomeIcon icon={['fas', 'users']} className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                    <p>No customers found</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Notification Modal */}
      <NotificationModal
        open={showNotifyModal}
        onClose={() => setShowNotifyModal(false)}
        onSend={handleSendNotification}
        user={notifyUser}
      />

      {/* User Details Modal */}
      {showModal && selectedUser && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">Customer Details</h3>
              <button
                onClick={closeUserModal}
                className="text-gray-400 hover:text-gray-600"
              >
                <FontAwesomeIcon icon={['fas', 'times']} />
              </button>
            </div>

            <div className="space-y-6">
              {/* Profile Section */}
              <div className="flex items-center space-x-4">
                <div className="relative">
                  <img
                    src={selectedUser.profileImage || `https://ui-avatars.com/api/?name=${encodeURIComponent(selectedUser.name || 'User')}&background=2563eb&color=ffffff&size=200`}
                    alt=""
                    className="h-20 w-20 rounded-full object-cover cursor-pointer hover:ring-2 hover:ring-blue-500 transition-all"
                    onClick={() => openProfileImageModal(selectedUser)}
                  />
                  <div className="absolute inset-0 rounded-full bg-black bg-opacity-0 hover:bg-opacity-10 cursor-pointer transition-all flex items-center justify-center"
                       onClick={() => openProfileImageModal(selectedUser)}>
                    <FontAwesomeIcon icon={['fas', 'expand']} className="text-white opacity-0 hover:opacity-100 transition-opacity" />
                  </div>
                </div>
                <div>
                  <h4 className="text-xl font-semibold text-gray-900">{selectedUser.name}</h4>
                  <p className="text-gray-600">{selectedUser.email}</p>
                  <p className="text-sm text-blue-600">@{selectedUser.username || selectedUser.name?.toLowerCase().replace(/\s+/g, '') || 'user'}</p>
                  <Badge status={selectedUser.status || 'active'} />
                </div>
              </div>

              {/* Details Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h5 className="text-sm font-medium text-gray-500 mb-2">Contact Information</h5>
                  <div className="space-y-2">
                    <p><strong>Phone:</strong> {selectedUser.phone || 'N/A'}</p>
                    <p><strong>Username:</strong> @{selectedUser.username || selectedUser.name?.toLowerCase().replace(/\s+/g, '') || 'user'}</p>
                    <p><strong>Address:</strong> {selectedUser.address || 'Not provided'}</p>
                  </div>
                </div>

                <div>
                  <h5 className="text-sm font-medium text-gray-500 mb-2">Account Information</h5>
                  <div className="space-y-2">
                    <p><strong>Member Since:</strong> {formatSafeDate(selectedUser.createdAt)}</p>
                    <p><strong>User ID:</strong> {selectedUser.id || 'N/A'}</p>
                    <p><strong>Status:</strong> {selectedUser.status || 'active'}</p>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-between pt-4 border-t">
                <Button
                  variant="danger"
                  onClick={() => {
                    closeUserModal();
                    confirmDeleteUser(selectedUser);
                  }}
                >
                  Delete User
                </Button>
                <div className="flex space-x-3">
                  <Button variant="secondary" onClick={closeUserModal}>
                    Close
                  </Button>
                  <Button
                    variant={selectedUser.status === 'active' ? 'danger' : 'success'}
                    onClick={() => {
                      const newStatus = selectedUser.status === 'active' ? 'blocked' : 'active';
                      handleStatusChange(selectedUser.id, newStatus);
                      closeUserModal();
                    }}
                  >
                    {selectedUser.status === 'active' ? 'Block User' : 'Activate User'}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Profile Image Modal */}
      <ProfileImageModal
        open={profileImageModal.open}
        onClose={closeProfileImageModal}
        user={profileImageModal.user}
      />

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && userToDelete && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="text-center">
              <FontAwesomeIcon icon={['fas', 'exclamation-triangle']} className="mx-auto h-12 w-12 text-red-600 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Delete User</h3>
              <p className="text-gray-600 mb-6">
                Are you sure you want to delete <strong>{userToDelete.name}</strong>? 
                This action cannot be undone and will also delete all their trips and related data.
              </p>
              <div className="flex justify-center space-x-3">
                <Button
                  variant="secondary"
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setUserToDelete(null);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  variant="danger"
                  onClick={() => handleDeleteUser(userToDelete.id)}
                >
                  Delete User
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UsersPage;
