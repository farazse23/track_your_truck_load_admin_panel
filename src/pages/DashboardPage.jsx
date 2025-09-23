import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import Card from '../components/ui/Card';
import { getDashboardStats } from '../services/data';

const DashboardPage = () => {
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalDrivers: 0,
    activeDrivers: 0,
    totalTrips: 0,
    pendingTrips: 0,
    inProgressTrips: 0,
    completedTripsToday: 0,
    availableTrucks: 0,
    totalTrucks: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadDashboardData = async () => {
      try {
        const dashboardStats = await getDashboardStats();
        setStats(dashboardStats);
      } catch (error) {
        console.error('Error loading dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadDashboardData();
  }, []);

  const statCards = [
    {
      title: 'Total Users',
      value: stats.totalUsers,
      subtitle: `${stats.totalUsers} active customers`,
      icon: ['fas', 'users'],
      color: 'text-green-600',
      bgColor: 'bg-green-100',
      link: '/users',
    },
    {
      title: 'Total Drivers',
      value: stats.totalDrivers,
      subtitle: `${stats.totalDrivers} registered drivers`,
      icon: ['fas', 'id-card'],
      color: 'text-blue-600',
      bgColor: 'bg-blue-100',
      link: '/drivers',
    },
    {
      title: 'Total Trips',
      value: stats.totalTrips,
      subtitle: `${stats.pendingTrips} pending requests`,
      icon: ['fas', 'route'],
      color: 'text-purple-600',
      bgColor: 'bg-purple-100',
      link: '/trips',
    },
    {
      title: 'Available Trucks',
      value: `${stats.availableTrucks}/${stats.totalTrucks}`,
      subtitle: `${Math.round((stats.availableTrucks / stats.totalTrucks) * 100) || 0}% availability`,
      icon: ['fas', 'truck'],
      color: 'text-orange-600',
      bgColor: 'bg-orange-100',
      link: '/trucks',
    },
  ];

  const activityCards = [
    {
      title: 'Pending Trips',
      value: stats.pendingTrips,
      subtitle: 'Awaiting assignment',
      icon: ['fas', 'clock'],
      bgColor: 'bg-pink-500',
      link: '/requests',
    },
  ];

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
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
  <p className="mt-2 text-gray-600">Welcome to Track Your Truck Load Admin Dashboard</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((card, index) => (
          <Link key={index} to={card.link}>
            <Card className="hover:shadow-lg transition-shadow duration-200 cursor-pointer">
              <div className="flex items-center">
                <div className={`flex-shrink-0 p-3 rounded-lg ${card.bgColor}`}>
                  <FontAwesomeIcon 
                    icon={card.icon} 
                    className={`h-6 w-6 ${card.color}`} 
                  />
                </div>
                <div className="ml-4 flex-1">
                  <p className="text-sm font-medium text-gray-500">{card.title}</p>
                  <p className="text-2xl font-bold text-gray-900">{card.value}</p>
                  <p className="text-sm text-gray-500">{card.subtitle}</p>
                </div>
              </div>
            </Card>
          </Link>
        ))}
      </div>

      {/* Activity Overview */}
      <div className="flex justify-center">
        <div className="w-full max-w-sm">
          {activityCards.map((card, index) => (
            <Link key={index} to={card.link}>
              <div className={`${card.bgColor} text-white hover:opacity-90 transition-opacity duration-200 cursor-pointer rounded-lg shadow-md p-6`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-white opacity-80 text-sm font-medium">{card.title}</p>
                    <p className="text-3xl font-bold text-white">{card.value}</p>
                    <p className="text-white opacity-80 text-sm">{card.subtitle}</p>
                  </div>
                  <FontAwesomeIcon 
                    icon={card.icon} 
                    className="h-8 w-8 text-white opacity-80" 
                  />
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Quick Actions */}
      <Card title="Quick Actions" subtitle="Manage your fleet and operations">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Link to="/users">
            <div className="flex items-center p-6 bg-gradient-to-r from-green-50 to-green-100 rounded-lg hover:from-green-100 hover:to-green-200 transition-colors cursor-pointer">
              <FontAwesomeIcon icon={['fas', 'users']} className="h-8 w-8 text-green-600 mr-4" />
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Manage Users</h3>
                <p className="text-sm text-gray-600">View and manage customer accounts</p>
              </div>
            </div>
          </Link>

          <Link to="/drivers">
            <div className="flex items-center p-6 bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg hover:from-blue-100 hover:to-blue-200 transition-colors cursor-pointer">
              <FontAwesomeIcon icon={['fas', 'id-card']} className="h-8 w-8 text-blue-600 mr-4" />
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Manage Drivers</h3>
                <p className="text-sm text-gray-600">Add and manage driver profiles</p>
              </div>
            </div>
          </Link>

          <Link to="/trucks">
            <div className="flex items-center p-6 bg-gradient-to-r from-orange-50 to-orange-100 rounded-lg hover:from-orange-100 hover:to-orange-200 transition-colors cursor-pointer">
              <FontAwesomeIcon icon={['fas', 'truck']} className="h-8 w-8 text-orange-600 mr-4" />
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Manage Trucks</h3>
                <p className="text-sm text-gray-600">Add and manage fleet vehicles</p>
              </div>
            </div>
          </Link>

          <Link to="/requests">
            <div className="flex items-center p-6 bg-gradient-to-r from-purple-50 to-purple-100 rounded-lg hover:from-purple-100 hover:to-purple-200 transition-colors cursor-pointer">
              <FontAwesomeIcon icon={['fas', 'clock']} className="h-8 w-8 text-purple-600 mr-4" />
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Trip Requests</h3>
                <p className="text-sm text-gray-600">View and assign pending trips</p>
              </div>
            </div>
          </Link>

          <Link to="/trips">
            <div className="flex items-center p-6 bg-gradient-to-r from-indigo-50 to-indigo-100 rounded-lg hover:from-indigo-100 hover:to-indigo-200 transition-colors cursor-pointer">
              <FontAwesomeIcon icon={['fas', 'route']} className="h-8 w-8 text-indigo-600 mr-4" />
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Trip History</h3>
                <p className="text-sm text-gray-600">View all completed trips</p>
              </div>
            </div>
          </Link>

          <Link to="/settings">
            <div className="flex items-center p-6 bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg hover:from-gray-100 hover:to-gray-200 transition-colors cursor-pointer">
              <FontAwesomeIcon icon={['fas', 'cog']} className="h-8 w-8 text-gray-600 mr-4" />
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Settings</h3>
                <p className="text-sm text-gray-600">Configure system settings</p>
              </div>
            </div>
          </Link>
        </div>
      </Card>
    </div>
  );
};

export default DashboardPage;
