import React, { useState, useEffect } from 'react';
import { travelOrderAPI } from '../api';
import { MdExpandMore, MdExpandLess } from 'react-icons/md';
import { FiSearch } from 'react-icons/fi';

function ApproveTravelOrdersAdmin() {
  const [travelOrders, setTravelOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [approvalData, setApprovalData] = useState({
    approvedBy: '',
    remarks: '',
    action: 'approve',
  });
  const [filters, setFilters] = useState({
    staffName: '',
    transportMode: '',
    dateFrom: '',
    dateTo: '',
    minDays: '',
    maxDays: '',
  });
  const [showFilters, setShowFilters] = useState(false);
  const [filterAttribute, setFilterAttribute] = useState('staffName');
  const [searchValue, setSearchValue] = useState('');

  useEffect(() => {
    fetchPendingOrders();
  }, []);

  const fetchPendingOrders = async () => {
    try {
      setLoading(true);
      const response = await travelOrderAPI.getAll('Pending');
      setTravelOrders(response.data);
    } catch (err) {
      setError('Failed to load travel orders');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!approvalData.approvedBy) {
      setError('Approver name is required');
      return;
    }

    try {
      if (approvalData.action === 'approve') {
        await travelOrderAPI.approve(selectedOrder.travelOrderId, {
          approvedBy: approvalData.approvedBy,
          remarks: approvalData.remarks,
        });
      } else {
        await travelOrderAPI.reject(selectedOrder.travelOrderId, {
          approvedBy: approvalData.approvedBy,
          remarks: approvalData.remarks,
        });
      }

      setTravelOrders(travelOrders.filter(t => t.travelOrderId !== selectedOrder.travelOrderId));
      setSelectedOrder(null);
      setApprovalData({ approvedBy: '', remarks: '', action: 'approve' });
      setError('');
    } catch (err) {
      setError('Failed to process travel order');
    }
  };

  if (loading) return <div className="text-center p-8">Loading...</div>;

  // Apply filters
  const filteredOrders = travelOrders.filter((order) => {
    let matches = true;

    switch (filterAttribute) {
      case 'staffName':
        matches = order.staffName.toLowerCase().includes(searchValue.toLowerCase());
        break;
      case 'destination':
        matches = order.destination.toLowerCase().includes(searchValue.toLowerCase());
        break;
      case 'transportMode':
        matches = order.transportMode.toLowerCase().includes(searchValue.toLowerCase());
        break;
      case 'numberOfDays':
        matches = order.numberOfDays.toString().includes(searchValue);
        break;
      default:
        matches = true;
    }

    return matches;
  });

  // Get unique transport modes for dropdown
  const uniqueModes = [...new Set(travelOrders.map(t => t.transportMode))];

  const resetFilters = () => {
    setFilters({
      staffName: '',
      transportMode: '',
      dateFrom: '',
      dateTo: '',
      minDays: '',
      maxDays: '',
    });
  };

  return (
    <div className="mt-6">
      <h1 className="text-3xl font-bold mb-6">Approve Travel Orders</h1>

      {error && <div className="mb-4 p-4 bg-red-100 text-red-700 rounded">{error}</div>}

      {/* Search and Filter Bar */}
      <div className="mb-6 flex gap-2">
        <div className="relative w-96">
          <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Search travel orders..."
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select
          value={filterAttribute}
          onChange={(e) => {
            setFilterAttribute(e.target.value);
            setSearchValue('');
          }}
          className="w-40 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium bg-white cursor-pointer"
        >
          <option value="staffName">Staff Name</option>
          <option value="destination">Destination</option>
          <option value="transportMode">Transport Mode</option>
          <option value="numberOfDays">Days</option>
        </select>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Orders List */}
        <div className="lg:col-span-2">
          <div className="mb-4">
            <p className="text-sm text-gray-600">
              Showing <span className="font-bold">{filteredOrders.length}</span> of <span className="font-bold">{travelOrders.length}</span> travel orders
            </p>
          </div>

          <div className="space-y-4">
            {filteredOrders.map((order) => (
              <div
                key={order.travelOrderId}
                onClick={() => setSelectedOrder(order)}
                className={`bg-white p-4 rounded shadow cursor-pointer transition ${
                  selectedOrder?.travelOrderId === order.travelOrderId ? 'border-2 border-blue-600' : ''
                }`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-bold">{order.staffName}</h3>
                    <p className="text-gray-600 text-sm">{order.destination}</p>
                    <p className="text-gray-600 text-sm">
                      {new Date(order.dateFrom).toLocaleDateString()} - {new Date(order.dateTo).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="bg-orange-100 text-orange-800 px-3 py-1 rounded text-sm block">
                      {order.numberOfDays} days
                    </span>
                    <span className="text-gray-600 text-sm">₱{order.estimatedBudget?.toLocaleString() || '0'}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {filteredOrders.length === 0 && (
            <div className="text-center p-8 text-gray-600">
              {travelOrders.length === 0 ? 'No pending travel orders' : 'No travel orders match your filters'}
            </div>
          )}
        </div>

        {/* Approval Panel */}
        {selectedOrder && (
          <div className="bg-white p-6 rounded shadow">
            <h2 className="text-xl font-bold mb-4">Travel Order Details</h2>

            <div className="space-y-3 mb-6">
              <div>
                <p className="text-gray-600 text-sm">Staff</p>
                <p className="font-bold">{selectedOrder.staffName}</p>
              </div>
              <div>
                <p className="text-gray-600 text-sm">Destination</p>
                <p className="font-bold">{selectedOrder.destination}</p>
              </div>
              <div>
                <p className="text-gray-600 text-sm">Purpose</p>
                <p>{selectedOrder.purpose}</p>
              </div>
              <div>
                <p className="text-gray-600 text-sm">Transport Mode</p>
                <p className="font-bold">{selectedOrder.transportMode}</p>
              </div>
              <div>
                <p className="text-gray-600 text-sm">Duration</p>
                <p className="font-bold">
                  {new Date(selectedOrder.dateFrom).toLocaleDateString()} - {new Date(selectedOrder.dateTo).toLocaleDateString()}
                </p>
              </div>
              <div>
                <p className="text-gray-600 text-sm">Days</p>
                <p className="font-bold">{selectedOrder.numberOfDays}</p>
              </div>
              <div>
                <p className="text-gray-600 text-sm">Budget</p>
                <p className="font-bold">₱{selectedOrder.estimatedBudget?.toLocaleString() || '0'}</p>
              </div>
            </div>

            <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); handleApprove(); }}>
              <div>
                <label className="block font-bold mb-2">Your Name *</label>
                <input
                  type="text"
                  value={approvalData.approvedBy}
                  onChange={(e) => setApprovalData({...approvalData, approvedBy: e.target.value})}
                  className="w-full px-4 py-2 border rounded focus:outline-none focus:border-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block font-bold mb-2">Remarks</label>
                <textarea
                  value={approvalData.remarks}
                  onChange={(e) => setApprovalData({...approvalData, remarks: e.target.value})}
                  rows="3"
                  className="w-full px-4 py-2 border rounded focus:outline-none focus:border-blue-500"
                ></textarea>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setApprovalData({...approvalData, action: 'approve'})}
                  className={`flex-1 py-2 rounded font-bold ${
                    approvalData.action === 'approve'
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-200'
                  }`}
                >
                  Approve
                </button>
                <button
                  type="button"
                  onClick={() => setApprovalData({...approvalData, action: 'reject'})}
                  className={`flex-1 py-2 rounded font-bold ${
                    approvalData.action === 'reject'
                      ? 'bg-red-600 text-white'
                      : 'bg-gray-200'
                  }`}
                >
                  Reject
                </button>
              </div>

              <button
                type="submit"
                className={`w-full py-2 rounded text-white font-bold ${
                  approvalData.action === 'approve'
                    ? 'bg-green-600 hover:bg-green-700'
                    : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                {approvalData.action === 'approve' ? 'Approve Order' : 'Reject Order'}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}

export default ApproveTravelOrdersAdmin;
