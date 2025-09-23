import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Badge from '../components/ui/Badge';
import ChangePasswordModal from '../components/modals/ChangePasswordModal';
import { useAuth } from '../contexts/FirebaseAuthContext';
import { getSettings, updateSettings, createAdmin, createAdminWithRoleCheck, createAdminUser, getAdmins, deleteAdmin, updateAdmin, sendAdminPasswordReset, updateAdminPassword } from '../services/data';

const SettingsPage = () => {
  const location = useLocation();
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [activeTab, setActiveTab] = useState(location.state?.activeTab || 'account');
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [admins, setAdmins] = useState([]);
  const [showAddAdminModal, setShowAddAdminModal] = useState(false);
  const [showAdminPasswordModal, setShowAdminPasswordModal] = useState(false);
  const [generatedAdminPassword, setGeneratedAdminPassword] = useState('');
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [newAdmin, setNewAdmin] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    profileImage: null
  });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);
  const [showEditProfileModal, setShowEditProfileModal] = useState(false);
  const [editingProfile, setEditingProfile] = useState({
    name: '',
    profileImage: null
  });
  const [currentAdmin, setCurrentAdmin] = useState(null);
  const [settings, setSettings] = useState({
    general: {
  companyName: 'Track Your Truck Load',
      companyEmail: 'admin@captaintruck.com',
      companyPhone: '+1 (555) 123-4567',
      supportEmail: 'support@captaintruck.com',
      timezone: 'America/New_York',
      currency: 'USD',
      language: 'en'
    },
    notifications: {
      emailNotifications: true,
      smsNotifications: false,
      pushNotifications: true,
      notifyOnNewUser: true,
      notifyOnNewTrip: true,
      notifyOnTripCompletion: true,
      notifyOnDriverRegistration: true,
      dailyReports: true,
      weeklyReports: false,
      monthlyReports: true
    },
    maintenance: {
      maintenanceMode: false,
      maintenanceMessage: 'We are currently performing scheduled maintenance. Please check back later.',
      allowAdminAccess: true,
      backupFrequency: 'daily',
      retentionPeriod: 30,
      autoBackup: true
    }
  });

  useEffect(() => {
    loadSettings();
    loadAdmins();
    loadCurrentAdmin();
  }, [currentUser]);

  const loadCurrentAdmin = async () => {
    if (currentUser?.uid) {
      try {
        const { getAdminByUID } = await import('../services/data');
        const adminData = await getAdminByUID(currentUser.uid);
        setCurrentAdmin(adminData);
      } catch (error) {
        console.error('Error loading current admin:', error);
      }
    }
  };

  const loadSettings = async () => {
    try {
      setLoading(true);
      // In a real app, this would load from your backend/database
      const savedSettings = localStorage.getItem('captainTruckSettings');
      if (savedSettings) {
        setSettings(prevSettings => ({
          ...prevSettings,
          ...JSON.parse(savedSettings)
        }));
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    try {
      setLoading(true);
      // In a real app, this would save to your backend/database
      localStorage.setItem('captainTruckSettings', JSON.stringify(settings));
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (error) {
      console.error('Error saving settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadAdmins = async () => {
    try {
      const adminsList = await getAdmins();
      setAdmins(adminsList);
    } catch (error) {
      console.error('Error loading admins:', error);
    }
  };

  const handleAddAdmin = async () => {
    try {
      setLoading(true);
      
      if (!newAdmin.name || !newAdmin.email || !newAdmin.password) {
        alert('Name, email, and password are required fields.');
        setLoading(false);
        return;
      }
      
      if (newAdmin.password.length < 6) {
        alert('Password must be at least 6 characters long.');
        setLoading(false);
        return;
      }
      
      const adminData = {
        name: newAdmin.name,
        email: newAdmin.email,
        password: newAdmin.password,
        phone: newAdmin.phone
      };
      
      const result = await createAdminUser(adminData);
      
      if (result.success) {
        alert(`Admin with owner role created successfully!\n\nLogin Details:\nEmail: ${adminData.email}\nPassword: [Use the password you entered]\nRole: Owner\n\n✅ The admin can now login with these credentials.`);
        
        resetAddAdminForm();
        loadAdmins();
      }
      
      setLoading(false);
    } catch (error) {
      console.error('Error creating admin:', error);
      alert('Error creating admin: ' + error.message);
      setLoading(false);
    }
  };

  const handleDeleteAdmin = async (adminId, adminEmail) => {
    try {
      setLoading(true);
      await deleteAdmin(adminId);
      alert(`Admin ${adminEmail} deleted successfully!`);
      setShowDeleteConfirm(null);
      loadAdmins(); // Refresh the list
      setLoading(false);
    } catch (error) {
      console.error('Error deleting admin:', error);
      alert('Error deleting admin: ' + error.message);
      setLoading(false);
    }
  };

  const resetAddAdminForm = () => {
    setNewAdmin({ name: '', email: '', phone: '', password: '', profileImage: null });
    setShowAddAdminModal(false);
  };

  const updateSetting = (category, key, value) => {
    setSettings(prev => ({
      ...prev,
      [category]: {
        ...prev[category],
        [key]: value
      }
    }));
  };

  const resetToDefaults = (category) => {
    if (window.confirm(`Are you sure you want to reset ${category} settings to defaults?`)) {
      // Reset logic would go here
      console.log(`Resetting ${category} settings to defaults`);
    }
  };

  const tabs = [
    { id: 'account', name: 'Account', icon: 'user' },
    { id: 'admins', name: 'Admin Management', icon: 'user-shield' }
  ];

  const renderGeneralSettings = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">Company Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Company Name"
            value={settings.general.companyName}
            onChange={(e) => updateSetting('general', 'companyName', e.target.value)}
          />
          <Input
            label="Company Email"
            type="email"
            value={settings.general.companyEmail}
            onChange={(e) => updateSetting('general', 'companyEmail', e.target.value)}
          />
          <Input
            label="Company Phone"
            value={settings.general.companyPhone}
            onChange={(e) => updateSetting('general', 'companyPhone', e.target.value)}
          />
          <Input
            label="Support Email"
            type="email"
            value={settings.general.supportEmail}
            onChange={(e) => updateSetting('general', 'supportEmail', e.target.value)}
          />
        </div>
      </div>

      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">Regional Settings</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Timezone</label>
            <select
              value={settings.general.timezone}
              onChange={(e) => updateSetting('general', 'timezone', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="America/New_York">Eastern Time</option>
              <option value="America/Chicago">Central Time</option>
              <option value="America/Denver">Mountain Time</option>
              <option value="America/Los_Angeles">Pacific Time</option>
              <option value="UTC">UTC</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Currency</label>
            <select
              value={settings.general.currency}
              onChange={(e) => updateSetting('general', 'currency', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="USD">USD - US Dollar</option>
              <option value="EUR">EUR - Euro</option>
              <option value="GBP">GBP - British Pound</option>
              <option value="CAD">CAD - Canadian Dollar</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Language</label>
            <select
              value={settings.general.language}
              onChange={(e) => updateSetting('general', 'language', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="en">English</option>
              <option value="es">Spanish</option>
              <option value="fr">French</option>
              <option value="de">German</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );

  const renderNotificationSettings = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">Notification Channels</h3>
        <div className="space-y-4">
          {[
            { key: 'emailNotifications', label: 'Email Notifications', description: 'Receive notifications via email' },
            { key: 'smsNotifications', label: 'SMS Notifications', description: 'Receive notifications via SMS' },
            { key: 'pushNotifications', label: 'Push Notifications', description: 'Receive browser push notifications' }
          ].map(({ key, label, description }) => (
            <div key={key} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
              <div>
                <p className="text-sm font-medium text-gray-900">{label}</p>
                <p className="text-sm text-gray-500">{description}</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.notifications[key]}
                  onChange={(e) => updateSetting('notifications', key, e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">Event Notifications</h3>
        <div className="space-y-4">
          {[
            { key: 'notifyOnNewUser', label: 'New User Registration', description: 'Get notified when a new user registers' },
            { key: 'notifyOnNewTrip', label: 'New Trip Request', description: 'Get notified when a new trip is requested' },
            { key: 'notifyOnTripCompletion', label: 'Trip Completion', description: 'Get notified when trips are completed' },
            { key: 'notifyOnDriverRegistration', label: 'Driver Registration', description: 'Get notified when new drivers register' }
          ].map(({ key, label, description }) => (
            <div key={key} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
              <div>
                <p className="text-sm font-medium text-gray-900">{label}</p>
                <p className="text-sm text-gray-500">{description}</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.notifications[key]}
                  onChange={(e) => updateSetting('notifications', key, e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">Report Schedules</h3>
        <div className="space-y-4">
          {[
            { key: 'dailyReports', label: 'Daily Reports', description: 'Receive daily business reports' },
            { key: 'weeklyReports', label: 'Weekly Reports', description: 'Receive weekly summary reports' },
            { key: 'monthlyReports', label: 'Monthly Reports', description: 'Receive monthly business analytics' }
          ].map(({ key, label, description }) => (
            <div key={key} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
              <div>
                <p className="text-sm font-medium text-gray-900">{label}</p>
                <p className="text-sm text-gray-500">{description}</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.notifications[key]}
                  onChange={(e) => updateSetting('notifications', key, e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderMaintenanceSettings = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">Maintenance Mode</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
            <div>
              <p className="text-sm font-medium text-gray-900">Enable Maintenance Mode</p>
              <p className="text-sm text-gray-500">Temporarily disable public access</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.maintenance.maintenanceMode}
                onChange={(e) => updateSetting('maintenance', 'maintenanceMode', e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>

          <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
            <div>
              <p className="text-sm font-medium text-gray-900">Allow Admin Access</p>
              <p className="text-sm text-gray-500">Allow admin users during maintenance</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.maintenance.allowAdminAccess}
                onChange={(e) => updateSetting('maintenance', 'allowAdminAccess', e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Maintenance Message</label>
            <textarea
              value={settings.maintenance.maintenanceMessage}
              onChange={(e) => updateSetting('maintenance', 'maintenanceMessage', e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Message to display during maintenance"
            />
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">Backup Settings</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
            <div>
              <p className="text-sm font-medium text-gray-900">Automatic Backups</p>
              <p className="text-sm text-gray-500">Enable automatic data backups</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.maintenance.autoBackup}
                onChange={(e) => updateSetting('maintenance', 'autoBackup', e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Backup Frequency</label>
              <select
                value={settings.maintenance.backupFrequency}
                onChange={(e) => updateSetting('maintenance', 'backupFrequency', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="hourly">Hourly</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>
            <Input
              label="Retention Period (days)"
              type="number"
              min="1"
              max="365"
              value={settings.maintenance.retentionPeriod}
              onChange={(e) => updateSetting('maintenance', 'retentionPeriod', parseInt(e.target.value))}
            />
          </div>

          <div className="flex space-x-3">
            <Button variant="outline">
              <FontAwesomeIcon icon="download" className="mr-2" />
              Create Backup Now
            </Button>
            <Button variant="outline">
              <FontAwesomeIcon icon="upload" className="mr-2" />
              Restore from Backup
            </Button>
          </div>
        </div>
      </div>
    </div>
  );

  const renderAdminManagement = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium text-gray-900">Admin Management</h3>
        <Button 
          onClick={() => setShowAddAdminModal(true)}
          className="bg-blue-600 hover:bg-blue-700"
        >
          <FontAwesomeIcon icon="plus" className="mr-2" />
          Add New Admin
        </Button>
      </div>

      {/* Admin List */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h4 className="text-md font-medium text-gray-900">Current Administrators</h4>
        </div>
        <div className="divide-y divide-gray-200">
          {admins.length === 0 ? (
            <div className="px-6 py-8 text-center text-gray-500">
              No administrators found
            </div>
          ) : (
            admins.map((admin) => (
              <div key={admin.id} className="px-6 py-4 flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="h-10 w-10 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center">
                    {admin.profileImage ? (
                      <img src={admin.profileImage} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <FontAwesomeIcon icon="user-shield" className="text-blue-600" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{admin.name}</p>
                    <p className="text-sm text-gray-500">{admin.email}</p>
                    {admin.phone && <p className="text-sm text-gray-500">{admin.phone}</p>}
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <Badge variant="success" className="bg-blue-100 text-blue-800">
                    {admin.role || 'Admin'}
                  </Badge>
                  <Badge variant={admin.status === 'active' ? 'success' : 'warning'}>
                    {admin.status}
                  </Badge>
                  <span className="text-sm text-gray-500">
                    Created: {admin.createAt ? new Date(admin.createAt.toDate ? admin.createAt.toDate() : admin.createAt).toLocaleDateString() : 'N/A'}
                  </span>
                  <button
                    onClick={() => setShowDeleteConfirm(admin)}
                    className="text-red-600 hover:text-red-800 p-2 rounded-lg hover:bg-red-50 transition-colors"
                    title="Delete Admin"
                  >
                    <FontAwesomeIcon icon="trash" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );

  const renderAccountSettings = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">Account Information</h3>
        
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Email Address</label>
              <div className="px-3 py-2 border border-gray-300 bg-gray-50 rounded-md text-gray-700">
                {currentUser?.email || 'Not available'}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">User ID</label>
              <div className="px-3 py-2 border border-gray-300 bg-gray-50 rounded-md text-gray-700 font-mono text-xs">
                {currentUser?.uid || 'Not available'}
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Display Name</label>
              <div className="px-3 py-2 border border-gray-300 bg-gray-50 rounded-md text-gray-700">
                {currentUser?.displayName || 'Admin User'}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Email Verified</label>
              <div className="px-3 py-2 border border-gray-300 bg-gray-50 rounded-md">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  currentUser?.emailVerified 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-red-100 text-red-800'
                }`}>
                  <FontAwesomeIcon 
                    icon={currentUser?.emailVerified ? 'check-circle' : 'times-circle'} 
                    className="mr-1" 
                  />
                  {currentUser?.emailVerified ? 'Verified' : 'Not Verified'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">Profile Management</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
            <div>
              <p className="text-sm font-medium text-gray-900">Update Profile</p>
              <p className="text-sm text-gray-500">Change your display name and profile picture</p>
            </div>
            <Button
              variant="outline"
              onClick={() => {
                setEditingProfile({
                  name: currentUser?.displayName || '',
                  profileImage: null
                });
                setShowEditProfileModal(true);
              }}
            >
              <FontAwesomeIcon icon="edit" className="mr-2" />
              Edit Profile
            </Button>
          </div>

          <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
            <div>
              <p className="text-sm font-medium text-gray-900">Reset Password</p>
              <p className="text-sm text-gray-500">Send password reset email to your account</p>
            </div>
            <Button
              variant="outline"
              onClick={async () => {
                try {
                  await sendAdminPasswordReset(currentUser?.email);
                  alert('Password reset email sent successfully! Please check your inbox.');
                } catch (error) {
                  alert('Error sending password reset email: ' + error.message);
                }
              }}
            >
              <FontAwesomeIcon icon="key" className="mr-2" />
              Reset Password
            </Button>
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">Security Actions</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
            <div>
              <p className="text-sm font-medium text-gray-900">Change Password</p>
              <p className="text-sm text-gray-500">Update your current password</p>
            </div>
            <Button
              variant="outline"
              onClick={() => setShowChangePasswordModal(true)}
            >
              <FontAwesomeIcon icon="key" className="mr-2" />
              Change Password
            </Button>
          </div>
          
          <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
            <div>
              <p className="text-sm font-medium text-gray-900">Account Role</p>
              <p className="text-sm text-gray-500">Your current access level</p>
            </div>
            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
              <FontAwesomeIcon icon="shield-alt" className="mr-2" />
              Administrator
            </span>
          </div>
        </div>
      </div>
    </div>
  );

  const renderTabContent = () => {
    switch (activeTab) {
      case 'account':
        return renderAccountSettings();
      case 'admins':
        return renderAdminManagement();
      default:
        return renderAccountSettings();
    }
  };

  return (
    <div className="space-y-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
        <p className="mt-2 text-gray-600">Manage application settings and configuration</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Settings Navigation */}
        <div className="lg:w-64 flex-shrink-0">
          <Card className="p-0">
            <nav className="space-y-1">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center px-4 py-3 text-sm font-medium text-left rounded-lg transition-colors ${
                    activeTab === tab.id
                      ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-700'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <FontAwesomeIcon icon={tab.icon} className="mr-3 text-lg" />
                  {tab.name}
                </button>
              ))}
            </nav>
          </Card>
        </div>

        {/* Settings Content */}
        <div className="flex-1">
          <Card>
            <div className="p-6">
              {renderTabContent()}
              
              {/* Save Actions */}
              <div className="mt-8 pt-6 border-t border-gray-200">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="flex items-center space-x-4">
                    {saved && (
                      <div className="flex items-center text-green-600">
                        <FontAwesomeIcon icon="check-circle" className="mr-2" />
                        <span className="text-sm">Settings saved successfully!</span>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex space-x-3">
                    <Button
                      variant="outline"
                      onClick={() => resetToDefaults(activeTab)}
                    >
                      Reset to Defaults
                    </Button>
                    <Button
                      onClick={saveSettings}
                      disabled={loading}
                    >
                      {loading ? (
                        <>
                          <FontAwesomeIcon icon="spinner" className="fa-spin mr-2" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <FontAwesomeIcon icon="save" className="mr-2" />
                          Save Settings
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Change Password Modal */}
      <ChangePasswordModal
        isOpen={showChangePasswordModal}
        onClose={() => setShowChangePasswordModal(false)}
      />

      {/* Add Admin Modal */}
      {showAddAdminModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900">Add New Administrator</h3>
              <button
                onClick={resetAddAdminForm}
                className="text-gray-400 hover:text-gray-600"
              >
                <FontAwesomeIcon icon="times" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newAdmin.name}
                  onChange={(e) => setNewAdmin({ ...newAdmin, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="System Administrator"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email Address <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  value={newAdmin.email}
                  onChange={(e) => setNewAdmin({ ...newAdmin, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="admin@captaintruck.com"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Password <span className="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  value={newAdmin.password}
                  onChange={(e) => setNewAdmin({ ...newAdmin, password: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter secure password"
                  minLength="6"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">Minimum 6 characters</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={newAdmin.phone}
                  onChange={(e) => setNewAdmin({ ...newAdmin, phone: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="+1-555-0100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Profile Image
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setNewAdmin({ ...newAdmin, profileImage: e.target.files[0] })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">Optional. Recommended size: 200x200px</p>
              </div>

              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                <div className="flex items-center">
                  <FontAwesomeIcon icon="info-circle" className="text-green-600 mr-2" />
                  <p className="text-sm text-green-700">
                    Admin accounts are created with "Owner" role and can access all system features.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <Button
                variant="outline"
                onClick={resetAddAdminForm}
              >
                Cancel
              </Button>
              <Button
                onClick={handleAddAdmin}
                disabled={loading || !newAdmin.email || !newAdmin.name || !newAdmin.password}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {loading ? (
                  <>
                    <FontAwesomeIcon icon="spinner" className="fa-spin mr-2" />
                    Creating...
                  </>
                ) : (
                  <>
                    <FontAwesomeIcon icon="plus" className="mr-2" />
                    Create Admin
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Admin Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900">Delete Administrator</h3>
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <FontAwesomeIcon icon="times" />
              </button>
            </div>

            <div className="mb-6">
              <div className="flex items-center mb-4">
                <div className="h-12 w-12 bg-red-100 rounded-full flex items-center justify-center mr-4">
                  <FontAwesomeIcon icon="exclamation-triangle" className="text-red-600 text-xl" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    Are you sure you want to delete this administrator?
                  </p>
                  <p className="text-sm text-gray-500 mt-1">
                    <strong>{showDeleteConfirm.name}</strong>
                    <br />
                    {showDeleteConfirm.email}
                  </p>
                </div>
              </div>
              
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <div className="flex items-center">
                  <FontAwesomeIcon icon="info-circle" className="text-red-600 mr-2" />
                  <p className="text-sm text-red-700">
                    This action cannot be undone. The admin will lose access to the dashboard immediately.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-3">
              <Button
                variant="outline"
                onClick={() => setShowDeleteConfirm(null)}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button
                onClick={() => handleDeleteAdmin(showDeleteConfirm.id, showDeleteConfirm.email)}
                disabled={loading}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                {loading ? (
                  <>
                    <FontAwesomeIcon icon="spinner" className="fa-spin mr-2" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <FontAwesomeIcon icon="trash" className="mr-2" />
                    Delete Admin
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Profile Modal */}
      {showEditProfileModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900">Edit Profile</h3>
              <button
                onClick={() => setShowEditProfileModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <FontAwesomeIcon icon="times" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Display Name
                </label>
                <input
                  type="text"
                  value={editingProfile.name}
                  onChange={(e) => setEditingProfile({ ...editingProfile, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Your display name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Profile Image
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setEditingProfile({ ...editingProfile, profileImage: e.target.files[0] })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">Optional. Upload a new profile picture</p>
              </div>
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <Button
                variant="outline"
                onClick={() => setShowEditProfileModal(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={async () => {
                  try {
                    setLoading(true);
                    // Update the current admin's profile
                    if (currentAdmin) {
                      await updateAdmin(currentAdmin.id, {
                        name: editingProfile.name,
                        profileImage: editingProfile.profileImage
                      });
                      alert('Profile updated successfully!');
                      loadAdmins();
                    }
                    setShowEditProfileModal(false);
                    setLoading(false);
                  } catch (error) {
                    console.error('Error updating profile:', error);
                    alert('Error updating profile: ' + error.message);
                    setLoading(false);
                  }
                }}
                disabled={loading}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {loading ? (
                  <>
                    <FontAwesomeIcon icon="spinner" className="fa-spin mr-2" />
                    Updating...
                  </>
                ) : (
                  <>
                    <FontAwesomeIcon icon="save" className="mr-2" />
                    Update Profile
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SettingsPage;
