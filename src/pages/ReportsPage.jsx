import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, subDays, subMonths, startOfDay, endOfDay } from 'date-fns';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { 
  getUsers, 
  getDrivers, 
  getTrucks, 
  getTrips,
  getRequests,
  getDispatches,
  getAvailableDriversForDate,
  getAvailableTrucksForDate
} from '../services/data';

const ReportsPage = () => {
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState('this-month');
  const [reportData, setReportData] = useState({
    overview: {},
    performance: {},
    activity: {}
  });
  const [generatingPDF, setGeneratingPDF] = useState(false);

  useEffect(() => {
    loadReportData();
  }, [dateRange]);

  const getDateRangeFilter = () => {
    const now = new Date();
    switch (dateRange) {
      case 'today':
        return { start: startOfDay(now), end: endOfDay(now) };
      case 'this-week':
        return { start: startOfWeek(now), end: endOfWeek(now) };
      case 'this-month':
        return { start: startOfMonth(now), end: endOfMonth(now) };
      case 'last-month':
        return { start: startOfMonth(subMonths(now, 1)), end: endOfMonth(subMonths(now, 1)) };
      case 'last-7-days':
        return { start: subDays(now, 7), end: now };
      case 'last-30-days':
        return { start: subDays(now, 30), end: now };
      default:
        return { start: startOfMonth(now), end: endOfMonth(now) };
    }
  };

  const loadReportData = async () => {
    try {
      setLoading(true);
      const { start, end } = getDateRangeFilter();

      // Get real data from correct collections
      const [users, drivers, trucks, requests, dispatches, availableDriversToday, availableTrucksToday] = await Promise.all([
        getUsers(),          // customers
        getDrivers(),        // drivers
        getTrucks(),         // trucks
        getRequests(),       // requests collection
        getDispatches(),     // dispatches/trips collection
        getAvailableDriversForDate(new Date()),
        getAvailableTrucksForDate(new Date())
      ]);

      // Filter data by date range
      const filteredRequests = requests.filter(request => {
        const requestDate = request.createdAt?.toDate ? 
          request.createdAt.toDate() : 
          new Date(request.createdAt || request.timestamp);
        return requestDate >= start && requestDate <= end;
      });

      const filteredDispatches = dispatches.filter(dispatch => {
        const dispatchDate = dispatch.createdAt?.toDate ? 
          dispatch.createdAt.toDate() : 
          new Date(dispatch.createdAt || dispatch.timestamp);
        return dispatchDate >= start && dispatchDate <= end;
      });

      const filteredUsers = users.filter(user => {
        const userDate = user.createdAt?.toDate ? 
          user.createdAt.toDate() : 
          new Date(user.createdAt || user.timestamp);
        return userDate >= start && userDate <= end;
      });

      const filteredDrivers = drivers.filter(driver => {
        const driverDate = driver.createdAt?.toDate ? 
          driver.createdAt.toDate() : 
          new Date(driver.createdAt || driver.timestamp);
        return driverDate >= start && driverDate <= end;
      });

      const filteredTrucks = trucks.filter(truck => {
        const truckDate = truck.createdAt?.toDate ? 
          truck.createdAt.toDate() : 
          new Date(truck.createdAt || truck.timestamp);
        return truckDate >= start && truckDate <= end;
      });

      // Calculate overview metrics with real data
      const overview = {
        // Current totals (all-time)
        totalUsers: users.length,
        totalDrivers: drivers.length,
        totalTrucks: trucks.length,
        
        // New additions in selected period
        newUsers: filteredUsers.length,
        newDrivers: filteredDrivers.length,
        newTrucks: filteredTrucks.length,
        
        // Request metrics (filtered by period)
        totalRequests: filteredRequests.length,
        pendingRequests: filteredRequests.filter(req => req.status === 'pending').length,
        acceptedRequests: filteredRequests.filter(req => req.status === 'accepted').length,
        rejectedRequests: filteredRequests.filter(req => req.status === 'rejected').length,
        
        // Dispatch/Trip metrics (filtered by period)
        totalTrips: filteredDispatches.length,
        completedTrips: filteredDispatches.filter(trip => trip.status === 'completed').length,
        inProgressTrips: filteredDispatches.filter(trip => trip.status === 'in-progress').length,
        canceledTrips: filteredDispatches.filter(trip => 
          trip.status === 'cancelled' || trip.status === 'canceled').length,
        
        // Current availability (real-time)
        availableDrivers: drivers.filter(driver => 
          driver.status === 'available' || driver.status === 'active').length,
        unavailableDrivers: drivers.filter(driver => 
          driver.status === 'unavailable' || driver.status === 'inactive').length,
        onTripDrivers: drivers.filter(driver => driver.status === 'on-trip').length,
        
        operationalTrucks: trucks.filter(truck => truck.status === 'operational').length,
        inactiveTrucks: trucks.filter(truck => truck.status === 'inactive').length,
        assignedTrucks: trucks.filter(truck => truck.status === 'assigned').length
      };

      // Calculate performance metrics using dispatch data
      const driverTrips = {};
      filteredDispatches.forEach(dispatch => {
        const driverId = dispatch.assignedDriverId || (dispatch.assignments?.[0]?.driverId);
        if (driverId) {
          if (!driverTrips[driverId]) {
            driverTrips[driverId] = { completed: 0, total: 0, canceled: 0, inProgress: 0 };
          }
          driverTrips[driverId].total++;
          if (dispatch.status === 'completed') {
            driverTrips[driverId].completed++;
          } else if (dispatch.status === 'cancelled' || dispatch.status === 'canceled') {
            driverTrips[driverId].canceled++;
          } else if (dispatch.status === 'in-progress') {
            driverTrips[driverId].inProgress++;
          }
        }
      });

      const performance = {
        driverPerformance: Object.entries(driverTrips).map(([driverId, stats]) => {
          const driver = drivers.find(d => d.id === driverId || d.driverId === driverId);
          return {
            driverId,
            driverName: driver?.name || driver?.firstName + ' ' + driver?.lastName || 'Unknown Driver',
            completionRate: stats.total > 0 ? (stats.completed / stats.total) * 100 : 0,
            totalTrips: stats.total,
            completedTrips: stats.completed,
            canceledTrips: stats.canceled,
            inProgressTrips: stats.inProgress
          };
        }).sort((a, b) => b.completionRate - a.completionRate),
        topDrivers: Object.entries(driverTrips)
          .map(([driverId, stats]) => {
            const driver = drivers.find(d => d.id === driverId);
            return { driverId, driverName: driver?.name || 'Unknown', ...stats };
          })
          .sort((a, b) => b.completed - a.completed)
          .slice(0, 5)
      };

      // Calculate activity metrics
      const activity = {
        userRegistrations: overview.newUsers,
        driverRegistrations: overview.newDrivers,
        truckRegistrations: overview.newTrucks,
        tripTrends: calculateTripTrends(filteredDispatches, start, end)
      };

      setReportData({ overview, performance, activity });
    } catch (error) {
      console.error('Error loading report data:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateTripTrends = (trips, start, end) => {
    const days = [];
    const current = new Date(start);
    
    while (current <= end) {
      const dayTrips = trips.filter(trip => {
        const tripDate = trip.createdAt?.toDate ? 
          trip.createdAt.toDate() : 
          new Date(trip.createdAt || trip.timestamp);
        return tripDate.toDateString() === current.toDateString();
      });
      
      days.push({
        date: format(current, 'MMM dd'),
        trips: dayTrips.length,
        completed: dayTrips.filter(trip => trip.status === 'completed').length,
        canceled: dayTrips.filter(trip => trip.status === 'cancelled' || trip.status === 'canceled').length
      });
      
      current.setDate(current.getDate() + 1);
    }
    
    return days;
  };

  const generateReport = async () => {
    setGeneratingPDF(true);
    // Simulate PDF generation
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Create a simple text report
    const reportContent = `
TRACK YOUR TRUCK LOAD - BUSINESS REPORT
Generated: ${format(new Date(), 'MMM dd, yyyy - HH:mm')}
Period: ${dateRange.replace('-', ' ').toUpperCase()}

OVERVIEW
========
Current Users: ${reportData.overview.totalUsers}
New Users: ${reportData.overview.newUsers}
Current Drivers: ${reportData.overview.totalDrivers}
New Drivers: ${reportData.overview.newDrivers}
Current Trucks: ${reportData.overview.totalTrucks}
New Trucks: ${reportData.overview.newTrucks}
Available Drivers: ${reportData.overview.availableDrivers}
Available Trucks: ${reportData.overview.operationalTrucks}
Total Trips: ${reportData.overview.totalTrips}
Completed Trips: ${reportData.overview.completedTrips}
Canceled Trips: ${reportData.overview.canceledTrips}
Total Requests: ${reportData.overview.totalRequests}

PERFORMANCE
===========
Completion Rate: ${reportData.overview.totalTrips > 0 ? ((reportData.overview.completedTrips / reportData.overview.totalTrips) * 100).toFixed(1) : 0}%

GROWTH SUMMARY
=============
New Users: ${reportData.activity.userRegistrations}
New Drivers: ${reportData.activity.driverRegistrations}
New Trucks: ${reportData.activity.truckRegistrations}
`;

    // Download as text file
    const blob = new Blob([reportContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `captain-truck-report-${format(new Date(), 'yyyy-MM-dd')}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    setGeneratingPDF(false);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Reports</h1>
          <p className="mt-2 text-gray-600">View analytics and generate reports</p>
        </div>
        <Card>
          <div className="text-center py-12">
            <FontAwesomeIcon icon="spinner" className="fa-spin text-4xl text-blue-600 mb-4" />
            <p className="text-gray-600">Loading report data...</p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Reports</h1>
        <p className="mt-2 text-gray-600">View analytics and generate reports</p>
      </div>

      {/* Date Range Filter & Actions */}
      <Card>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center space-x-4">
            <label className="text-sm font-medium text-gray-700">Time Period:</label>
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="today">Today</option>
              <option value="this-week">This Week</option>
              <option value="this-month">This Month</option>
              <option value="last-month">Last Month</option>
              <option value="last-7-days">Last 7 Days</option>
              <option value="last-30-days">Last 30 Days</option>
            </select>
          </div>
          
          <div className="flex space-x-3">
            <Button
              variant="outline"
              onClick={loadReportData}
              disabled={loading}
            >
              <FontAwesomeIcon icon="refresh" className="mr-2" />
              Refresh
            </Button>
            <Button
              onClick={generateReport}
              disabled={generatingPDF}
            >
              {generatingPDF ? (
                <>
                  <FontAwesomeIcon icon="spinner" className="fa-spin mr-2" />
                  Generating...
                </>
              ) : (
                <>
                  <FontAwesomeIcon icon="download" className="mr-2" />
                  Export Report
                </>
              )}
            </Button>
          </div>
        </div>
      </Card>

      {/* Overview Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <FontAwesomeIcon icon="users" className="text-blue-600 text-xl" />
              </div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Current Users</p>
              <p className="text-2xl font-bold text-gray-900">{reportData.overview.totalUsers}</p>
              <p className="text-sm text-green-600">+{reportData.overview.newUsers} new</p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <FontAwesomeIcon icon="user-tie" className="text-green-600 text-xl" />
              </div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Current Drivers</p>
              <p className="text-2xl font-bold text-gray-900">{reportData.overview.totalDrivers}</p>
              <p className="text-sm text-green-600">+{reportData.overview.newDrivers} new</p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <FontAwesomeIcon icon="truck" className="text-purple-600 text-xl" />
              </div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Current Trucks</p>
              <p className="text-2xl font-bold text-gray-900">{reportData.overview.totalTrucks}</p>
              <p className="text-sm text-green-600">+{reportData.overview.newTrucks} new</p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                <FontAwesomeIcon icon="clipboard-list" className="text-yellow-600 text-xl" />
              </div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Total Requests</p>
              <p className="text-2xl font-bold text-gray-900">{reportData.overview.totalRequests}</p>
              <p className="text-sm text-gray-500">received</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Additional Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-12 h-12 bg-emerald-100 rounded-lg flex items-center justify-center">
                <FontAwesomeIcon icon="user-check" className="text-emerald-600 text-xl" />
              </div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Available Drivers</p>
              <p className="text-2xl font-bold text-gray-900">{reportData.overview.availableDrivers}</p>
              <p className="text-sm text-gray-500">ready for trips</p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center">
                <FontAwesomeIcon icon="truck-loading" className="text-indigo-600 text-xl" />
              </div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Operational Trucks</p>
              <p className="text-2xl font-bold text-gray-900">{reportData.overview.operationalTrucks}</p>
              <p className="text-sm text-gray-500">ready for trips</p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-12 h-12 bg-cyan-100 rounded-lg flex items-center justify-center">
                <FontAwesomeIcon icon="route" className="text-cyan-600 text-xl" />
              </div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Completed Trips</p>
              <p className="text-2xl font-bold text-gray-900">{reportData.overview.completedTrips}</p>
              <p className="text-sm text-green-600">successful</p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
                <FontAwesomeIcon icon="times-circle" className="text-red-600 text-xl" />
              </div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Canceled Trips</p>
              <p className="text-2xl font-bold text-gray-900">{reportData.overview.canceledTrips}</p>
              <p className="text-sm text-red-600">canceled</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Summary Analytics */}
      <Card>
        <div className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Period Summary</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <p className="text-3xl font-bold text-blue-600">{reportData.overview.totalTrips}</p>
              <p className="text-sm text-gray-500">Total Trips</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-green-600">
                {reportData.overview.totalTrips > 0 ? ((reportData.overview.completedTrips / reportData.overview.totalTrips) * 100).toFixed(1) : 0}%
              </p>
              <p className="text-sm text-gray-500">Completion Rate</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-red-600">
                {reportData.overview.totalTrips > 0 ? ((reportData.overview.canceledTrips / reportData.overview.totalTrips) * 100).toFixed(1) : 0}%
              </p>
              <p className="text-sm text-gray-500">Cancellation Rate</p>
            </div>
          </div>
        </div>
      </Card>

      {/* Trip Status Breakdown */}
      <Card>
        <div className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Trip Status Breakdown</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-green-50 p-4 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-green-800">Completed</p>
                  <p className="text-2xl font-bold text-green-900">{reportData.overview.completedTrips}</p>
                </div>
                <FontAwesomeIcon icon="check-circle" className="text-green-600 text-2xl" />
              </div>
            </div>
            <div className="bg-red-50 p-4 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-red-800">Canceled</p>
                  <p className="text-2xl font-bold text-red-900">{reportData.overview.canceledTrips}</p>
                </div>
                <FontAwesomeIcon icon="times-circle" className="text-red-600 text-2xl" />
              </div>
            </div>
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-blue-800">Total Requests</p>
                  <p className="text-2xl font-bold text-blue-900">{reportData.overview.totalRequests}</p>
                </div>
                <FontAwesomeIcon icon="clipboard-list" className="text-blue-600 text-2xl" />
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Growth Summary */}
      <Card>
        <div className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Growth Summary</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <FontAwesomeIcon icon="user-plus" className="text-blue-600 text-2xl mb-2" />
              <p className="text-2xl font-bold text-blue-900">{reportData.activity.userRegistrations}</p>
              <p className="text-sm text-blue-700">New Users</p>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <FontAwesomeIcon icon="id-card-alt" className="text-green-600 text-2xl mb-2" />
              <p className="text-2xl font-bold text-green-900">{reportData.activity.driverRegistrations}</p>
              <p className="text-sm text-green-700">New Drivers</p>
            </div>
            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <FontAwesomeIcon icon="truck" className="text-purple-600 text-2xl mb-2" />
              <p className="text-2xl font-bold text-purple-900">{reportData.activity.truckRegistrations}</p>
              <p className="text-sm text-purple-700">New Trucks</p>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default ReportsPage;
