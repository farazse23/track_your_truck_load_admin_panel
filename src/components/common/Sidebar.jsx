import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { ROUTES } from '../../utils/constants';
import { subscribeToPendingRequests, subscribeToNotifications } from '../../services/data';
import logo from '../../assets/logo.jpg';

const Sidebar = ({ isOpen, onClose }) => {
  const location = useLocation();
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);

  useEffect(() => {
    // Subscribe to real-time pending requests count
    const unsubscribePendingRequests = subscribeToPendingRequests((count) => {
      setPendingRequestsCount(count);
    });

    // Subscribe to real-time notifications count
    const unsubscribeNotifications = subscribeToNotifications((notifications) => {
      const unreadCount = notifications.filter(n => !n.isRead).length;
      setUnreadNotificationsCount(unreadCount);
    });

    return () => {
      unsubscribePendingRequests && unsubscribePendingRequests();
      unsubscribeNotifications && unsubscribeNotifications();
    };
  }, []);

  const navigationItems = [
    {
      name: 'Dashboard',
      href: ROUTES.DASHBOARD,
      icon: ['fas', 'tachometer-alt'],
      badge: null,
    },
    {
      name: 'Drivers',
      href: ROUTES.DRIVERS,
      icon: ['fas', 'id-card'],
      badge: null,
    },
    {
      name: 'Users',
      href: ROUTES.USERS,
      icon: ['fas', 'users'],
      badge: null,
    },
    {
      name: 'Trucks',
      href: ROUTES.TRUCKS,
      icon: ['fas', 'truck'],
      badge: null,
    },
    {
      name: 'Requests',
      href: ROUTES.REQUESTS,
      icon: ['fas', 'clipboard-list'],
      badge: pendingRequestsCount > 0 ? pendingRequestsCount.toString() : null,
    },
    {
      name: 'Trips',
      href: ROUTES.TRIPS,
      icon: ['fas', 'route'],
      badge: null,
    },
    {
      name: 'Schedule',
      href: ROUTES.SCHEDULE,
      icon: ['fas', 'calendar-alt'],
      badge: null,
    },
    {
      name: 'Notifications',
      href: ROUTES.NOTIFICATIONS,
      icon: ['fas', 'bell'],
      badge: unreadNotificationsCount > 0 ? unreadNotificationsCount : null,
    },
    {
      name: 'Reports',
      href: ROUTES.REPORTS,
      icon: ['fas', 'chart-bar'],
      badge: null,
    },
    {
      name: 'Feedback',
      href: ROUTES.FEEDBACK,
      icon: ['fas', 'star'],
      badge: null,
    },
    {
      name: 'Settings',
      href: ROUTES.SETTINGS,
      icon: ['fas', 'cog'],
      badge: null,
    },
  ];

  const isActiveRoute = (path) => {
    if (path === ROUTES.DASHBOARD) {
      return location.pathname === path;
    }
    return location.pathname.startsWith(path);
  };

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-gray-600 bg-opacity-75 z-20 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <div
        className={`
          fixed inset-y-0 left-0 z-30 w-64 bg-slate-800 transform transition-transform duration-300 ease-in-out
          lg:translate-x-0 lg:static lg:inset-0
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        <div className="flex flex-col h-full">
          {/* Logo Section */}
          <div className="flex items-center justify-center h-20 px-4 bg-slate-900">
            <img
              src={logo}
              alt="Track Your Truck Load"
              className="h-10 w-10 rounded-lg"
            />
            <div className="ml-3">
              <h3 className="text-xl font-bold text-white">Track Your <br /> Truck Load</h3>
              <p className="text-xs text-slate-400">Admin Panel</p>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto no-scrollbar">
            {navigationItems.map((item) => {
              const isActive = isActiveRoute(item.href);
              
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  onClick={onClose}
                  className={`
                    flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors duration-200
                    ${
                      isActive
                        ? 'bg-blue-600 text-white shadow-lg'
                        : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                    }
                  `}
                >
                  <FontAwesomeIcon
                    icon={item.icon}
                    className={`mr-3 h-5 w-5 ${isActive ? 'text-white' : 'text-slate-400'}`}
                  />
                  <span className="flex-1">{item.name}</span>
                  
                  {item.badge && (
                    <span className="inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white bg-red-600 rounded-full">
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Footer */}
          <div className="px-4 py-4 border-t border-slate-700">
            <div className="text-xs text-slate-400 text-center">
              <p>Track Your Truck Load Admin</p>
              <p>Version 1.0.0</p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Sidebar;
