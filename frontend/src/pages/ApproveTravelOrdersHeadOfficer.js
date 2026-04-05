import React, { useState, useEffect } from 'react';
import { travelOrderAPI } from '../api';
import { FiSearch } from 'react-icons/fi';

const formatDate = (value) => {
  if (!value) return 'N/A';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? 'N/A' : parsed.toLocaleDateString();
};

const formatLongDate = (value) => {
  if (!value) return 'N/A';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? 'N/A'
    : parsed.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
};

const getApproverName = () => {
  try {
    const rawUser = localStorage.getItem('user');
    if (!rawUser) return '';
    const user = JSON.parse(rawUser);
    return (
      user?.name ||
      user?.fullName ||
      [user?.firstName, user?.middleName, user?.lastName].filter(Boolean).join(' ') ||
      ''
    );
  } catch (error) {
    return '';
  }
};

function ApproveTravelOrdersHeadOfficer({ forcedStatus = 'Pending' }) {
  const [travelOrders, setTravelOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [approvalData, setApprovalData] = useState({
    approvedBy: getApproverName(),
    remarks: '',
  });
  const [showDisapproveModal, setShowDisapproveModal] = useState(false);
  const [showRevisionModal, setShowRevisionModal] = useState(false);
  const [disapproveComment, setDisapproveComment] = useState('');
  const [revisionComment, setRevisionComment] = useState('');
  const [searchValue, setSearchValue] = useState('');
  const [viewStatus, setViewStatus] = useState(forcedStatus ?? 'Pending');

  useEffect(() => {
    const approverName = getApproverName();
    if (approverName) {
      setApprovalData((prev) => ({
        ...prev,
        approvedBy: approverName,
      }));
    }
  }, []);

  useEffect(() => {
    setViewStatus(forcedStatus ?? 'Pending');
  }, [forcedStatus]);

  useEffect(() => {
    fetchHeadOfficerTravelOrders(viewStatus);
  }, [viewStatus]);

  const fetchHeadOfficerTravelOrders = async (status) => {
    try {
      setLoading(true);
      const response = await travelOrderAPI.getAll(status || undefined);

      const headOfficerOrders = (response.data || []).filter((order) => {
        const isHeadOfficerPending = order.approvalStage === 'HeadOfficer' && order.status === 'Pending';
        const isHeadOfficerApproved =
          (order.approvalStage === 'Admin' && order.status === 'Pending') || order.status === 'Approved';

        if (status === 'Pending') return isHeadOfficerPending;
        if (status === 'Approved') return isHeadOfficerApproved;
        if (status === 'Disapproved') return order.status === 'Disapproved';

        return isHeadOfficerPending || isHeadOfficerApproved || order.status === 'Disapproved';
      });

      setTravelOrders(headOfficerOrders);
      setSelectedOrder(null);
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
      await travelOrderAPI.approve(selectedOrder.travelOrderId, {
        approvedBy: approvalData.approvedBy,
        remarks: approvalData.remarks,
      });

      setTravelOrders(travelOrders.filter(t => t.travelOrderId !== selectedOrder.travelOrderId));
      setSelectedOrder(null);
      setApprovalData({ approvedBy: getApproverName(), remarks: '' });
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to process travel order');
    }
  };

  const handleDisapprove = async () => {
    if (!approvalData.approvedBy) {
      setError('Approver name is required');
      return;
    }

    if (!disapproveComment.trim()) {
      setError('Disapprove comment is required');
      return;
    }

    try {
      await travelOrderAPI.disapprove(selectedOrder.travelOrderId, {
        approvedBy: approvalData.approvedBy,
        remarks: disapproveComment,
      });

      setTravelOrders(travelOrders.filter(t => t.travelOrderId !== selectedOrder.travelOrderId));
      setSelectedOrder(null);
      setApprovalData({ approvedBy: getApproverName(), remarks: '' });
      setDisapproveComment('');
      setShowDisapproveModal(false);
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to disapprove travel order');
    }
  };

  const handleApproveWithRevision = async () => {
    if (!approvalData.approvedBy) {
      setError('Approver name is required');
      return;
    }

    if (!revisionComment.trim()) {
      setError('Revision comment is required');
      return;
    }

    try {
      await travelOrderAPI.revise(selectedOrder.travelOrderId, {
        approvedBy: approvalData.approvedBy,
        remarks: revisionComment,
      });

      setTravelOrders(travelOrders.filter(t => t.travelOrderId !== selectedOrder.travelOrderId));
      setSelectedOrder(null);
      setApprovalData({ approvedBy: getApproverName(), remarks: '' });
      setRevisionComment('');
      setShowRevisionModal(false);
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to return travel order for revision');
    }
  };

  if (loading) return <div className="text-center p-8">Loading...</div>;

  const filteredOrders = travelOrders.filter((order) => {
    const query = searchValue.toLowerCase();
    return (
      (order.staffName && order.staffName.toLowerCase().includes(query)) ||
      (order.travelOrderId && order.travelOrderId.toLowerCase().includes(query)) ||
      (order.purposeOfTravel && order.purposeOfTravel.toLowerCase().includes(query))
    );
  });

  return (
    <div className="mt-6">
      <h1 className="text-3xl font-bold mb-2">Approve Travel Orders</h1>
      <p className="text-gray-600 mb-6 text-sm">Head Officer Approval Level - First stage of approval</p>

      {error && <div className="mb-4 p-4 bg-red-100 text-red-700 rounded">{error}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Requests List */}
        <div className="lg:col-span-1">
          {/* Search Bar */}
          <div className="mb-4">
            <div className="relative">
              <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                placeholder="Search by staff name, control number..."
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
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
                    <p className="text-gray-600 text-sm">{order.travelOrderId || 'N/A'}</p>
                    <p className="text-gray-600 text-sm">
                      {formatDate(order.dateFrom || order.periodCoveredFrom)} - {formatDate(order.dateTo || order.periodCoveredTo)}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded text-sm block">
                      Pending
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {filteredOrders.length === 0 && (
            <div className="text-center p-8 text-gray-600">
              {searchValue ? 'No travel orders match your search' : 'No travel orders awaiting your approval'}
            </div>
          )}
        </div>

        {/* Approval Panel */}
        {selectedOrder && (
          <div className="bg-white p-6 rounded shadow lg:col-span-1">
            <h2 className="text-xl font-bold mb-4">Travel Order Details</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
              <div>
                <p className="text-gray-600 text-sm">Staff</p>
                <p className="font-bold">{selectedOrder.staffName}</p>
              </div>
              <div>
                <p className="text-gray-600 text-sm">Travel Type</p>
                <p className="font-bold">{selectedOrder.travelType === 'abroad' || selectedOrder.controlNo ? 'Travel Abroad' : 'Travel Order / Office Order'}</p>
              </div>
              {(selectedOrder.travelType === 'abroad' || selectedOrder.controlNo) ? (
                <>
                  <div>
                    <p className="text-gray-600 text-sm">Date Prepared</p>
                    <p className="font-bold">{formatDate(selectedOrder.datePrepared)}</p>
                  </div>
                  <div>
                    <p className="text-gray-600 text-sm">Control Number</p>
                    <p className="font-bold">{selectedOrder.controlNo || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-gray-600 text-sm">Period</p>
                    <p className="font-bold">{selectedOrder.period || `${formatDate(selectedOrder.dateFrom)} - ${formatDate(selectedOrder.dateTo)}`}</p>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <p className="text-gray-600 text-sm">Purpose of Travel</p>
                    <p className="font-bold">{selectedOrder.purposeOfTravel || selectedOrder.purpose || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-gray-600 text-sm">Period Covered</p>
                    <p className="font-bold">{formatDate(selectedOrder.periodCoveredFrom || selectedOrder.dateFrom)} - {formatDate(selectedOrder.periodCoveredTo || selectedOrder.dateTo)}</p>
                  </div>
                  <div>
                    <p className="text-gray-600 text-sm">Venue/Destination</p>
                    <p className="font-bold">{selectedOrder.venueDestination || selectedOrder.destination || 'N/A'}</p>
                  </div>
                </>
              )}
            </div>

            <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); handleApprove(); }}>
              <div>
                <label className="block font-bold mb-2">Approval Remarks (Optional)</label>
                <textarea
                  value={approvalData.remarks}
                  onChange={(e) => setApprovalData({...approvalData, remarks: e.target.value})}
                  rows="3"
                  className="w-full px-4 py-2 border rounded focus:outline-none focus:border-blue-500"
                ></textarea>
              </div>

              <div className="space-y-2">
                <button
                  type="button"
                  onClick={handleApprove}
                  className="w-full py-2 rounded text-white font-bold bg-green-600 hover:bg-green-700"
                >
                  Approve & Forward to Admin
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDisapproveComment('');
                    setShowDisapproveModal(true);
                  }}
                  className="w-full py-2 rounded text-white font-bold bg-red-600 hover:bg-red-700"
                >
                  Disapprove
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setRevisionComment('');
                    setShowRevisionModal(true);
                  }}
                  className="w-full py-2 rounded text-white font-bold bg-amber-600 hover:bg-amber-700"
                >
                  Request Revision
                </button>
              </div>
            </form>
          </div>
        )}
      </div>

      {showDisapproveModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white w-full max-w-md rounded shadow-lg p-6">
            <h3 className="text-lg font-bold mb-3">Disapprove Travel Order</h3>
            <p className="text-sm text-gray-600 mb-3">Please provide a comment. This will be visible to the staff.</p>
            <textarea
              value={disapproveComment}
              onChange={(e) => setDisapproveComment(e.target.value)}
              rows="4"
              className="w-full px-4 py-2 border rounded focus:outline-none focus:border-blue-500"
              placeholder="Reason for disapproval"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowDisapproveModal(false)}
                className="px-4 py-2 rounded bg-gray-200"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDisapprove}
                className="px-4 py-2 rounded bg-red-600 text-white"
              >
                Confirm Disapprove
              </button>
            </div>
          </div>
        </div>
      )}

      {showRevisionModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white w-full max-w-md rounded shadow-lg p-6">
            <h3 className="text-lg font-bold mb-3">Request Revision</h3>
            <p className="text-sm text-gray-600 mb-3">Please provide revision notes. This will be visible to the staff.</p>
            <textarea
              value={revisionComment}
              onChange={(e) => setRevisionComment(e.target.value)}
              rows="4"
              className="w-full px-4 py-2 border rounded focus:outline-none focus:border-blue-500"
              placeholder="Required revisions"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowRevisionModal(false)}
                className="px-4 py-2 rounded bg-gray-200"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApproveWithRevision}
                className="px-4 py-2 rounded bg-amber-600 text-white"
              >
                Send for Revision
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ApproveTravelOrdersHeadOfficer;
