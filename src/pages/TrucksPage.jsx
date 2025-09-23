import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Badge from '../components/ui/Badge';
import { getTrucks, createTruck, updateTruck, deleteTruck, subscribeToTrucks } from '../services/data';
import { format } from 'date-fns';

const TrucksPage = () => {
  const [trucks, setTrucks] = useState([]);
  const [filteredTrucks, setFilteredTrucks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);
  const [selectedTruck, setSelectedTruck] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [editTruck, setEditTruck] = useState(null);

  const [newTruck, setNewTruck] = useState({
    truckNumber: '',
    plateNumber: '',
    truckType: 'flatbed',
    capacity: '',
    status: 'operational',
    make: '',
    model: '',
    modelYear: '',
    fuelType: 'diesel',
    truckImage: null
  });

  const truckTypes = [
    { value: 'turnpike-double', label: 'Turnpike Double / B-Train' },
    { value: 'container-hauling', label: 'Container Hauling' },
    { value: 'tractor-service', label: 'Tractor Service (Power-Only)' },
    { value: 'temperature-controlled', label: 'Temperature-Controlled' },
    { value: 'step-deck', label: 'Step Deck & Flatdeck' },
    { value: 'dry-van', label: 'Dry Van' },
    { value: 'cross-dock', label: 'Cross Dock' },
    { value: 'expedited-hotshot', label: 'Expedited & Hot Shot / 5-Ton' }
  ];

  const statusOptions = [
    { value: 'operational', label: 'Operational', color: 'green' },
    { value: 'inactive', label: 'Inactive', color: 'red' }
  ];

  useEffect(() => {
    // Set up real-time listener for trucks
    const unsubscribeTrucks = subscribeToTrucks((trucksData) => {
      setTrucks(trucksData);
      setLoading(false);
    });

    return () => {
      unsubscribeTrucks();
    };
  }, []);

  useEffect(() => {
    filterTrucks();
  }, [trucks, searchTerm, statusFilter, typeFilter]);

  const loadTrucks = async () => {
    try {
      setLoading(true);
      const trucksData = await getTrucks();
      setTrucks(trucksData);
    } catch (error) {
      console.error('Error loading trucks:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterTrucks = () => {
    let filtered = trucks;

    if (searchTerm) {
      filtered = filtered.filter(truck => 
        truck.truckNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        truck.plateNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        truck.model?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        truck.type?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(truck => truck.status === statusFilter);
    }

    if (typeFilter !== 'all') {
      filtered = filtered.filter(truck => truck.type === typeFilter);
    }

    setFilteredTrucks(filtered);
  };

  const handleAddTruck = async (e) => {
    e.preventDefault();
    try {
      await createTruck({
        ...newTruck,
        capacity: Number(newTruck.capacity),
        modelYear: Number(newTruck.modelYear),
      });
      setShowAddModal(false);
      setNewTruck({
        truckNumber: '',
        plateNumber: '',
        truckType: 'flatbed',
        capacity: '',
        status: 'operational',
        make: '',
        model: '',
        modelYear: '',
        fuelType: 'diesel',
        truckImage: null
      });
      // Real-time listener will update automatically
    } catch (error) {
      console.error('Error adding truck:', error);
      alert('Error adding truck: ' + error.message);
    }
  };

  const handleStatusChange = async (truckId, newStatus) => {
    try {
      await updateTruckStatus(truckId, newStatus);
      await loadTrucks();
    } catch (error) {
      console.error('Error updating truck status:', error);
    }
  };

  const handleEditTruck = (truck) => {
    setEditTruck({
      ...truck,
      lastMaintenanceDate: truck.lastMaintenanceDate ? new Date(truck.lastMaintenanceDate).toISOString().split('T')[0] : '',
      nextMaintenanceDate: truck.nextMaintenanceDate ? new Date(truck.nextMaintenanceDate).toISOString().split('T')[0] : '',
    });
    setShowEditModal(true);
  };

  const handleUpdateTruck = async (e) => {
    e.preventDefault();
    try {
      const updatedData = {
        ...editTruck,
        capacity: Number(editTruck.capacity),
        modelYear: Number(editTruck.modelYear),
      };
      
      await updateTruck(editTruck.id, updatedData);
      setShowEditModal(false);
      setEditTruck(null);
      await loadTrucks();
      alert('Truck updated successfully!');
    } catch (error) {
      console.error('Error updating truck:', error);
      alert('Error updating truck: ' + error.message);
    }
  };

  const handleDeleteTruck = async (truckId, truckNumber) => {
    try {
      await deleteTruck(truckId);
      setShowDeleteConfirm(null);
      await loadTrucks();
      alert(`Truck ${truckNumber} deleted successfully!`);
    } catch (error) {
      console.error('Error deleting truck:', error);
      alert('Error deleting truck: ' + error.message);
    }
  };

  const handleImageUpload = (e, isEdit = false) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const imageData = e.target.result;
        if (isEdit) {
          setEditTruck({ ...editTruck, truckImage: imageData });
        } else {
          setNewTruck({ ...newTruck, truckImage: imageData });
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const openDetailsModal = (truck) => {
    setSelectedTruck(truck);
    setShowDetailsModal(true);
  };

  const getStatusCount = (status) => {
    return trucks.filter(truck => truck.status === status).length;
  };

  const getTotalCapacity = () => {
    return trucks.reduce((total, truck) => total + (truck.capacity || 0), 0);
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
          <h1 className="text-3xl font-bold text-gray-900">Fleet Management</h1>
          <p className="mt-2 text-gray-600">Manage trucks and fleet operations</p>
        </div>
        <div className="mt-4 md:mt-0 flex space-x-3">
          <Button variant="secondary" icon={['fas', 'wrench']}>
            Maintenance Schedule
          </Button>
          <Button variant="secondary" icon={['fas', 'download']}>
            Export Fleet
          </Button>
          <Button variant="primary" icon={['fas', 'plus']} onClick={() => setShowAddModal(true)}>
            Add New Truck
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
        <Card className="bg-blue-50 border-blue-200">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <FontAwesomeIcon icon={['fas', 'truck']} className="h-8 w-8 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-blue-600">Total Fleet</p>
              <p className="text-2xl font-bold text-blue-900">{trucks.length}</p>
            </div>
          </div>
        </Card>

        <Card className="bg-green-50 border-green-200">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <FontAwesomeIcon icon={['fas', 'check-circle']} className="h-8 w-8 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-green-600">Operational</p>
              <p className="text-2xl font-bold text-green-900">{getStatusCount('operational')}</p>
            </div>
          </div>
        </Card>

        <Card className="bg-red-50 border-red-200">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <FontAwesomeIcon icon={['fas', 'times-circle']} className="h-8 w-8 text-red-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-red-600">Inactive</p>
              <p className="text-2xl font-bold text-red-900">{getStatusCount('inactive')}</p>
            </div>
          </div>
        </Card>

        <Card className="bg-purple-50 border-purple-200">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <FontAwesomeIcon icon={['fas', 'weight-hanging']} className="h-8 w-8 text-purple-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-purple-600">Total Capacity</p>
              <p className="text-2xl font-bold text-purple-900">{getTotalCapacity()}kg</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <div className="flex flex-col md:flex-row md:items-center space-y-4 md:space-y-0 md:space-x-4">
          <div className="flex-1">
            <Input
              placeholder="Search by truck number, plate, model..."
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
              {statusOptions.map(status => (
                <option key={status.value} value={status.value}>{status.label}</option>
              ))}
            </select>
          </div>
          <div className="w-full md:w-48">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">All Types</option>
              {truckTypes.map(type => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>
          </div>
          <div className="text-sm text-gray-500">
            Showing {filteredTrucks.length} of {trucks.length} trucks
          </div>
        </div>
      </Card>

      {/* Trucks Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Truck Info
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Capacity
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Plate Number
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Model Year
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
              {filteredTrucks.length > 0 ? (
                filteredTrucks.map((truck) => (
                  <tr key={truck.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0">
                          {truck.truckImage ? (
                            <img 
                              src={truck.truckImage} 
                              alt={truck.truckNumber}
                              className="h-10 w-10 object-cover rounded-lg border"
                            />
                          ) : (
                            <FontAwesomeIcon icon={['fas', 'truck']} className="h-8 w-8 text-blue-600" />
                          )}
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">{truck.truckId || truck.truckNumber || `Truck ${truck.id?.slice(-4)}`}</div>
                          <div className="text-sm text-gray-500">{truck.make} {truck.model || 'N/A'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900 font-medium">{truck.capacity || 0}kg</div>
                      <div className="text-sm text-gray-500">Capacity</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-mono">
                      {truck.plateNumber || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{truck.year || truck.modelYear || 'N/A'}</div>
                      <div className="text-sm text-gray-500">{truck.make || 'N/A'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Badge 
                        status={truck.status} 
                        customColors={{
                          available: 'green',
                          assigned: 'yellow',
                          maintenance: 'red',
                          'out-of-service': 'gray'
                        }}
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2">
                        <Button
                          size="small"
                          variant="ghost"
                          onClick={() => openDetailsModal(truck)}
                        >
                          <FontAwesomeIcon icon="eye" className="mr-1" />
                          View
                        </Button>
                        <Button
                          size="small"
                          variant="outline"
                          onClick={() => handleEditTruck(truck)}
                        >
                          <FontAwesomeIcon icon="edit" className="mr-1" />
                          Edit
                        </Button>
                        <Button
                          size="small"
                          variant="danger"
                          onClick={() => setShowDeleteConfirm(truck)}
                        >
                          <FontAwesomeIcon icon="trash" className="mr-1" />
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="7" className="px-6 py-12 text-center text-gray-500">
                    <FontAwesomeIcon icon={['fas', 'truck']} className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                    <p>No trucks found</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Add Truck Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">Add New Truck</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <FontAwesomeIcon icon={['fas', 'times']} />
              </button>
            </div>

            <form onSubmit={handleAddTruck} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Plate Number"
                  value={newTruck.plateNumber}
                  onChange={(e) => setNewTruck({...newTruck, plateNumber: e.target.value})}
                  placeholder="TX-ABC-1234"
                  required
                />
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Truck Type</label>
                  <select
                    value={newTruck.truckType}
                    onChange={(e) => setNewTruck({...newTruck, truckType: e.target.value})}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    required
                  >
                    {truckTypes.map(type => (
                      <option key={type.value} value={type.value}>{type.label}</option>
                    ))}
                  </select>
                </div>
                <Input
                  label="Capacity (kg)"
                  type="number"
                  value={newTruck.capacity}
                  onChange={(e) => setNewTruck({...newTruck, capacity: parseInt(e.target.value) || ''})}
                  required
                />
                <Input
                  label="Make"
                  value={newTruck.make}
                  onChange={(e) => setNewTruck({...newTruck, make: e.target.value})}
                  placeholder="Freightliner"
                  required
                />
                <Input
                  label="Model"
                  value={newTruck.model}
                  onChange={(e) => setNewTruck({...newTruck, model: e.target.value})}
                  placeholder="Cascadia"
                  required
                />
                <Input
                  label="Model Year"
                  type="number"
                  value={newTruck.modelYear}
                  onChange={(e) => setNewTruck({...newTruck, modelYear: parseInt(e.target.value) || ''})}
                  min="1990"
                  max="2025"
                  required
                />
                <Input
                  label="Truck Number"
                  value={newTruck.truckNumber}
                  onChange={(e) => setNewTruck({...newTruck, truckNumber: e.target.value})}
                  placeholder="TRK-001"
                  required
                />
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Fuel Type</label>
                  <select
                    value={newTruck.fuelType}
                    onChange={(e) => setNewTruck({...newTruck, fuelType: e.target.value})}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="diesel">Diesel</option>
                    <option value="petrol">Petrol</option>
                    <option value="cng">CNG</option>
                    <option value="electric">Electric</option>
                  </select>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                  <select
                    value={newTruck.status}
                    onChange={(e) => setNewTruck({...newTruck, status: e.target.value})}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  >
                    {statusOptions.map(status => (
                      <option key={status.value} value={status.value}>{status.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Truck Image Upload */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Truck Image (Optional)</label>
                <div className="flex items-center space-x-4">
                  {newTruck.truckImage && (
                    <div className="flex-shrink-0">
                      <img 
                        src={newTruck.truckImage} 
                        alt="Truck" 
                        className="h-20 w-20 object-cover rounded-lg border"
                      />
                    </div>
                  )}
                  <div className="flex-1">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleImageUpload(e, false)}
                      className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                    />
                    <p className="text-xs text-gray-500 mt-1">PNG, JPG, GIF up to 10MB</p>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Notes (Optional)</label>
                <textarea
                  value={newTruck.notes}
                  onChange={(e) => setNewTruck({...newTruck, notes: e.target.value})}
                  rows={3}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Additional notes about the truck..."
                />
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t">
                <Button variant="secondary" onClick={() => setShowAddModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary">
                  Add Truck
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Truck Modal */}
      {showEditModal && editTruck && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">Edit Truck</h3>
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setEditTruck(null);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <FontAwesomeIcon icon={['fas', 'times']} />
              </button>
            </div>

            <form onSubmit={handleUpdateTruck} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Plate Number"
                  value={editTruck.plateNumber}
                  onChange={(e) => setEditTruck({...editTruck, plateNumber: e.target.value})}
                  placeholder="ABC-123"
                  required
                />
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Truck Type</label>
                  <select
                    value={editTruck.type}
                    onChange={(e) => setEditTruck({...editTruck, type: e.target.value})}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    required
                  >
                    {truckTypes.map(type => (
                      <option key={type.value} value={type.value}>{type.label}</option>
                    ))}
                  </select>
                </div>
                <Input
                  label="Capacity (kg)"
                  type="number"
                  value={editTruck.capacity}
                  onChange={(e) => setEditTruck({...editTruck, capacity: e.target.value})}
                  required
                />
                <Input
                  label="Model"
                  value={editTruck.model}
                  onChange={(e) => setEditTruck({...editTruck, model: e.target.value})}
                  placeholder="Toyota Hiace"
                  required
                />
                <Input
                  label="Model Year"
                  type="number"
                  value={editTruck.modelYear}
                  onChange={(e) => setEditTruck({...editTruck, modelYear: e.target.value})}
                  min="1990"
                  max="2025"
                  required
                />
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Fuel Type</label>
                  <select
                    value={editTruck.fuelType}
                    onChange={(e) => setEditTruck({...editTruck, fuelType: e.target.value})}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="diesel">Diesel</option>
                    <option value="petrol">Petrol</option>
                    <option value="cng">CNG</option>
                    <option value="electric">Electric</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                  <select
                    value={editTruck.status}
                    onChange={(e) => setEditTruck({...editTruck, status: e.target.value})}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  >
                    {statusOptions.map(status => (
                      <option key={status.value} value={status.value}>{status.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Truck Image Upload */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Truck Image (Optional)</label>
                <div className="flex items-center space-x-4">
                  {editTruck.truckImage && (
                    <div className="flex-shrink-0">
                      <img 
                        src={editTruck.truckImage} 
                        alt="Truck" 
                        className="h-20 w-20 object-cover rounded-lg border"
                      />
                    </div>
                  )}
                  <div className="flex-1">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleImageUpload(e, true)}
                      className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                    />
                    <p className="text-xs text-gray-500 mt-1">PNG, JPG, GIF up to 10MB</p>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Notes (Optional)</label>
                <textarea
                  value={editTruck.notes || ''}
                  onChange={(e) => setEditTruck({...editTruck, notes: e.target.value})}
                  rows={3}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Additional notes about the truck..."
                />
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t">
                <Button variant="secondary" onClick={() => {
                  setShowEditModal(false);
                  setEditTruck(null);
                }}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary">
                  Update Truck
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Truck Details Modal */}
      {showDetailsModal && selectedTruck && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">Truck Details</h3>
              <button
                onClick={() => setShowDetailsModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <FontAwesomeIcon icon={['fas', 'times']} />
              </button>
            </div>

            <div className="space-y-6">
              <div className="flex items-center space-x-4">
                {selectedTruck.truckImage ? (
                  <img 
                    src={selectedTruck.truckImage} 
                    alt={selectedTruck.truckNumber}
                    className="h-20 w-20 object-cover rounded-lg border"
                  />
                ) : (
                  <FontAwesomeIcon icon={['fas', 'truck']} className="h-16 w-16 text-blue-600" />
                )}
                <div>
                  <h4 className="text-xl font-semibold text-gray-900">{selectedTruck.truckNumber}</h4>
                  <p className="text-gray-600">{selectedTruck.model} ({selectedTruck.modelYear})</p>
                  <Badge 
                    status={selectedTruck.status} 
                    customColors={{
                      available: 'green',
                      assigned: 'yellow',
                      maintenance: 'red',
                      'out-of-service': 'gray'
                    }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h5 className="text-sm font-medium text-gray-500 mb-2">Vehicle Information</h5>
                  <div className="space-y-2">
                    <p><strong>Plate Number:</strong> {selectedTruck.plateNumber}</p>
                    <p><strong>Type:</strong> {selectedTruck.type?.replace('-', ' ')}</p>
                    <p><strong>Capacity:</strong> {selectedTruck.capacity}kg</p>
                    <p><strong>Fuel Type:</strong> {selectedTruck.fuelType}</p>
                  </div>
                </div>

                <div>
                  <h5 className="text-sm font-medium text-gray-500 mb-2">Status Information</h5>
                  <div className="space-y-2">
                    <p><strong>Status:</strong> 
                      <span className={`ml-1 px-2 py-1 rounded-full text-xs ${
                        selectedTruck.status === 'operational' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {selectedTruck.status}
                      </span>
                    </p>
                    <p><strong>Model:</strong> {selectedTruck.model}</p>
                    <p><strong>Year:</strong> {selectedTruck.modelYear}</p>
                  </div>
                </div>
              </div>

              {selectedTruck.notes && (
                <div>
                  <h5 className="text-sm font-medium text-gray-500 mb-2">Notes</h5>
                  <p className="text-gray-700">{selectedTruck.notes}</p>
                </div>
              )}

              <div className="flex justify-end space-x-3 pt-4 border-t">
                <Button variant="secondary" onClick={() => setShowDetailsModal(false)}>
                  Close
                </Button>
                <Button
                  variant={selectedTruck.status === 'operational' ? 'warning' : 'success'}
                  onClick={() => {
                    handleStatusChange(
                      selectedTruck.id,
                      selectedTruck.status === 'operational' ? 'inactive' : 'operational'
                    );
                    setShowDetailsModal(false);
                  }}
                >
                  {selectedTruck.status === 'operational' ? 'Mark Inactive' : 'Mark Operational'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900">Delete Truck</h3>
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
                    Are you sure you want to delete this truck?
                  </p>
                  <p className="text-sm text-gray-500 mt-1">
                    <strong>{showDeleteConfirm.truckNumber}</strong>
                    <br />
                    {showDeleteConfirm.plateNumber} - {showDeleteConfirm.model}
                  </p>
                </div>
              </div>
              
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <div className="flex items-center">
                  <FontAwesomeIcon icon="info-circle" className="text-red-600 mr-2" />
                  <p className="text-sm text-red-700">
                    This action cannot be undone. The truck will be permanently removed from the fleet.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-3">
              <Button
                variant="outline"
                onClick={() => setShowDeleteConfirm(null)}
              >
                Cancel
              </Button>
              <Button
                onClick={() => handleDeleteTruck(showDeleteConfirm.id, showDeleteConfirm.truckNumber)}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                <FontAwesomeIcon icon="trash" className="mr-2" />
                Delete Truck
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TrucksPage;
