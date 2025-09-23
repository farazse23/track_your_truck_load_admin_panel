import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/FirebaseAuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import Button from '../ui/Button';
import ChangePasswordModal from '../modals/ChangePasswordModal';
import { subscribeToNotifications, getAdminByUID } from '../../services/data';
import logo from '../../assets/logo.jpg';

const Header = ({ onMenuToggle }) => {
  const navigate = useNavigate();
  const { currentUser, logout } = useAuth();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [currentAdmin, setCurrentAdmin] = useState(null);

  useEffect(() => {
    // Subscribe to notifications to get unread count
    const unsubscribe = subscribeToNotifications((notifications) => {
      const unreadCount = notifications.filter(n => !n.isRead).length;
      setUnreadNotifications(unreadCount);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    // Load current admin data
    const loadCurrentAdmin = async () => {
      if (currentUser?.uid) {
        try {
          const adminData = await getAdminByUID(currentUser.uid);
          setCurrentAdmin(adminData);
        } catch (error) {
          console.error('Error loading admin data:', error);
        }
      }
    };

    loadCurrentAdmin();
  }, [currentUser]);

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const handleProfileClick = () => {
    setShowUserMenu(false);
    navigate('/settings', { state: { activeTab: 'account' } });
  };

  const handleSettingsClick = () => {
    setShowUserMenu(false);
    navigate('/settings');
  };

  const handleChangePasswordClick = () => {
    setShowUserMenu(false);
    setShowChangePasswordModal(true);
  };

  return (
    <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-50">
      <div className="flex items-center justify-between px-4 py-3">
        {/* Left Section */}
        <div className="flex items-center space-x-4">
          {/* Mobile Menu Button */}
          <button
            onClick={onMenuToggle}
            className="lg:hidden p-2 rounded-md text-gray-500 hover:text-gray-900 hover:bg-gray-100"
          >
            <FontAwesomeIcon icon={['fas', 'bars']} />
          </button>
          
          {/* Logo */}
          <div className="flex items-center space-x-3">
            <img
              src={logo}
              alt="Track Your Truck Load"
              className="h-10 w-10 rounded-lg bg-blue-500"
            />
            <div className="hidden sm:block">
              <h1 className="text-xl font-bold text-gray-900">Track Your Truck Load</h1>
              <p className="text-xs text-gray-500">Admin Dashboard</p>
            </div>
          </div>
        </div>

        {/* Right Section */}
        <div className="flex items-center space-x-4">
          {/* Search Bar */}
          <div className="hidden md:block relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <FontAwesomeIcon icon={['fas', 'search']} className="text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Search..."
              className="block w-80 pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Notifications */}
          <button 
            onClick={() => navigate('/notifications')}
            className="relative p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
          >
            <FontAwesomeIcon icon={['fas', 'bell']} />
            {unreadNotifications > 0 && (
              <span className="absolute -top-1 -right-1 flex items-center justify-center h-5 w-5 text-xs font-bold text-white bg-red-500 rounded-full ring-2 ring-white">
                {unreadNotifications > 99 ? '99+' : unreadNotifications}
              </span>
            )}
          </button>

          {/* User Menu */}
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center space-x-3 p-2 rounded-md text-gray-700 hover:bg-gray-100"
            >
              <img
                src={currentAdmin?.profileImage || `https://ui-avatars.com/api/?name=${encodeURIComponent(currentAdmin?.name || currentUser?.displayName || 'Admin')}&background=2563eb&color=ffffff`}
                alt="Profile"
                className="h-8 w-8 rounded-full object-cover"
              />
              <div className="hidden md:block text-left">
                <p className="text-sm font-medium text-gray-900">
                  {currentAdmin?.name || currentUser?.displayName || currentUser?.email?.split('@')[0] || 'Admin'}
                </p>
                <p className="text-xs text-gray-500">Administrator</p>
              </div>
              <FontAwesomeIcon 
                icon={['fas', 'chevron-down']} 
                className="text-gray-400" 
              />
            </button>

            {/* User Dropdown */}
            {showUserMenu && (
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg ring-1 ring-black ring-opacity-5">
                <div className="py-1">
                  <button
                    onClick={handleProfileClick}
                    className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    <FontAwesomeIcon icon={['fas', 'user']} className="mr-3 text-gray-400" />
                    Account
                  </button>
                  <button
                    onClick={handleChangePasswordClick}
                    className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    <FontAwesomeIcon icon={['fas', 'key']} className="mr-3 text-gray-400" />
                    Change Password
                  </button>
                  <button
                    onClick={handleSettingsClick}
                    className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    <FontAwesomeIcon icon={['fas', 'cog']} className="mr-3 text-gray-400" />
                    Settings
                  </button>
                  <hr className="my-1" />
                  <button
                    onClick={handleLogout}
                    className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    <FontAwesomeIcon icon={['fas', 'sign-out-alt']} className="mr-3 text-gray-400" />
                    Sign out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Change Password Modal */}
      <ChangePasswordModal
        isOpen={showChangePasswordModal}
        onClose={() => setShowChangePasswordModal(false)}
      />
    </header>
  );
};

export default Header;
