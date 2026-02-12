import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { travelOrderAPI } from '../api';

function MyTravelOrders({ staffId }) {
  const [searchParams] = useSearchParams();
  const [travelOrders, setTravelOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterStatus, setFilterStatus] = useState(searchParams.get('status') || '');

  useEffect(() => {
    // Update filter status when query parameter changes
    const statusParam = searchParams.get('status');
    if (statusParam) {
      setFilterStatus(statusParam);
    }
  }, [searchParams]);

  useEffect(() => {
    if (staffId) {
      fetchTravelOrders();
    }
  }, [staffId]);

  const fetchTravelOrders = async () => {
    try {
      setLoading(true);
      const response = await travelOrderAPI.getByStaffId(staffId);
      setTravelOrders(response.data);
    } catch (err) {
      setError('Failed to load travel orders');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const deleteTravelOrder = async (id) => {
    if (window.confirm('Are you sure you want to delete this travel order?')) {
      try {
        await travelOrderAPI.delete(id);
        setTravelOrders(travelOrders.filter(t => t.travelOrderId !== id));
      } catch (err) {
        setError('Failed to delete travel order');
      }
    }
  };

  const markComplete = async (id) => {
    try {
      await travelOrderAPI.complete(id);
      fetchTravelOrders();
    } catch (err) {
      setError('Failed to mark as complete');
    }
  };

  const filteredOrders = filterStatus ? travelOrders.filter(t => t.status === filterStatus) : travelOrders;

  if (!staffId) {
    return <div className="text-center p-8 text-red-600">Please enter your Staff ID in the navigation bar</div>;
  }

  if (loading) return <div className="text-center p-8">Loading...</div>;

  return (
    <div className="mt-6">
      <h1 className="text-3xl font-bold mb-6">My Travel Orders</h1>

      {error && <div className="mb-4 p-4 bg-red-100 text-red-700 rounded">{error}</div>}

      <div className="mb-4">
        <label className="mr-4">
          <input
            type="radio"
            value=""
            checked={filterStatus === ''}
            onChange={(e) => setFilterStatus(e.target.value)}
          />
          {' '}All
        </label>
        <label className="mr-4">
          <input
            type="radio"
            value="Pending"
            checked={filterStatus === 'Pending'}
            onChange={(e) => setFilterStatus(e.target.value)}
          />
          {' '}Pending
        </label>
        <label className="mr-4">
          <input
            type="radio"
            value="Approved"
            checked={filterStatus === 'Approved'}
            onChange={(e) => setFilterStatus(e.target.value)}
          />
          {' '}Approved
        </label>
        <label className="mr-4">
          <input
            type="radio"
            value="Rejected"
            checked={filterStatus === 'Rejected'}
            onChange={(e) => setFilterStatus(e.target.value)}
          />
          {' '}Rejected
        </label>
        <label>
          <input
            type="radio"
            value="Completed"
            checked={filterStatus === 'Completed'}
            onChange={(e) => setFilterStatus(e.target.value)}
          />
          {' '}Completed
        </label>
      </div>

      <div className="space-y-4">
        {filteredOrders.map((order) => (
          <div key={order.travelOrderId} className="bg-white p-6 rounded shadow">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-xl font-bold">{order.destination}</h3>
                <p className="text-gray-600">ID: {order.travelOrderId}</p>
              </div>
              <span className={`px-4 py-2 rounded text-white font-bold ${
                order.status === 'Approved' ? 'bg-green-600' :
                order.status === 'Rejected' ? 'bg-red-600' :
                order.status === 'Completed' ? 'bg-blue-600' :
                'bg-yellow-600'
              }`}>
                {order.status}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <p className="text-gray-600 text-sm">Purpose</p>
                <p className="font-bold">{order.purpose}</p>
              </div>
              <div>
                <p className="text-gray-600 text-sm">Transport</p>
                <p className="font-bold">{order.transportMode}</p>
              </div>
              <div>
                <p className="text-gray-600 text-sm">From</p>
                <p className="font-bold">{new Date(order.dateFrom).toLocaleDateString()}</p>
              </div>
              <div>
                <p className="text-gray-600 text-sm">To</p>
                <p className="font-bold">{new Date(order.dateTo).toLocaleDateString()}</p>
              </div>
              <div>
                <p className="text-gray-600 text-sm">Days</p>
                <p className="font-bold">{order.numberOfDays}</p>
              </div>
              <div>
                <p className="text-gray-600 text-sm">Budget</p>
                <p className="font-bold">₱{order.estimatedBudget?.toLocaleString() || '0'}</p>
              </div>
            </div>

            {order.status !== 'Pending' && (
              <div className="border-t pt-4">
                <p className="text-gray-600 text-sm">Approved By</p>
                <p className="font-bold">{order.approvedBy}</p>
                {order.remarks && (
                  <>
                    <p className="text-gray-600 text-sm mt-2">Remarks</p>
                    <p>{order.remarks}</p>
                  </>
                )}
              </div>
            )}

            <div className="mt-4 flex gap-2">
              {order.status === 'Pending' && (
                <button
                  onClick={() => deleteTravelOrder(order.travelOrderId)}
                  className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
                >
                  Delete Order
                </button>
              )}
              {order.status === 'Approved' && (
                <button
                  onClick={() => markComplete(order.travelOrderId)}
                  className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                >
                  Mark as Complete
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {filteredOrders.length === 0 && (
        <div className="text-center p-8 text-gray-600">No travel orders found</div>
      )}
    </div>
  );
}

export default MyTravelOrders;
