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

  if (loading) return <div className="text-center p-8 text-blue-700 font-medium">Loading...</div>;

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
      <h1 className="text-3xl font-bold tracking-tight text-blue-950 mb-2">Approve Travel Orders</h1>
      <p className="text-blue-700/80 mb-6 text-sm">Head Officer Approval Level - First stage of approval</p>

      {error && <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">{error}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Requests List */}
        <div className="lg:col-span-1">
          {/* Search Bar */}
          <div className="mb-4 rounded-lg border border-blue-100 bg-blue-50/60 p-3">
            <div className="relative">
              <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                placeholder="Search by staff name, control number..."
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-blue-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-500"
              />
            </div>
          </div>

          <div className="space-y-4">
            {filteredOrders.map((order) => (
              <div
                key={order.travelOrderId}
                onClick={() => setSelectedOrder(order)}
                className={`bg-white p-4 rounded-lg border border-blue-100 shadow-sm cursor-pointer transition ${
                  selectedOrder?.travelOrderId === order.travelOrderId ? 'border-2 border-blue-500' : ''
                }`}
              >
                <div className="flex flex-wrap justify-between items-start gap-2">
                  <div className="min-w-0">
                    <h3 className="font-semibold text-blue-950 break-words">{order.staffName}</h3>
                    <p className="text-blue-700/80 text-sm break-words">{order.travelOrderId || 'N/A'}</p>
                    <p className="text-blue-700/80 text-sm break-words">
                      {formatDate(order.dateFrom || order.periodCoveredFrom)} - {formatDate(order.dateTo || order.periodCoveredTo)}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="bg-amber-100 text-amber-800 px-3 py-1 rounded-full text-xs font-semibold block">
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
          <div className="bg-white p-6 rounded-lg border border-blue-100 shadow-sm lg:col-span-1">
            <h2 className="text-xl font-bold text-blue-950 mb-4">Travel Order Details</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
              <div>
                <p className="text-blue-700/80 text-xs uppercase tracking-wide">Staff</p>
                <p className="font-bold">{selectedOrder.staffName}</p>
              </div>
              <div>
                <p className="text-blue-700/80 text-xs uppercase tracking-wide">Travel Type</p>
                <p className="font-bold">{selectedOrder.travelType === 'abroad' || selectedOrder.controlNo ? 'Travel Abroad' : 'Travel Order / Office Order'}</p>
              </div>
              {(selectedOrder.travelType === 'abroad' || selectedOrder.controlNo) ? (
                <>
                  <div>
                    <p className="text-blue-700/80 text-xs uppercase tracking-wide">Date Prepared</p>
                    <p className="font-bold">{formatDate(selectedOrder.datePrepared)}</p>
                  </div>
                  <div>
                    <p className="text-blue-700/80 text-xs uppercase tracking-wide">Control Number</p>
                    <p className="font-bold">{selectedOrder.controlNo || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-blue-700/80 text-xs uppercase tracking-wide">Period</p>
                    <p className="font-bold">{selectedOrder.period || `${formatDate(selectedOrder.dateFrom)} - ${formatDate(selectedOrder.dateTo)}`}</p>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <p className="text-blue-700/80 text-xs uppercase tracking-wide">Purpose of Travel</p>
                    <p className="font-bold">{selectedOrder.purposeOfTravel || selectedOrder.purpose || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-blue-700/80 text-xs uppercase tracking-wide">Period Covered</p>
                    <p className="font-bold">{formatDate(selectedOrder.periodCoveredFrom || selectedOrder.dateFrom)} - {formatDate(selectedOrder.periodCoveredTo || selectedOrder.dateTo)}</p>
                  </div>
                  <div>
                    <p className="text-blue-700/80 text-xs uppercase tracking-wide">Please Check</p>
                    <p className="font-bold">{[
                      selectedOrder.officialBusiness ? 'Official Business' : null,
                      selectedOrder.officialTime ? 'Official Time' : null,
                      selectedOrder.meeting ? 'Meeting' : null,
                      selectedOrder.travel ? 'Travel' : null,
                      selectedOrder.training ? 'Training' : null,
                      selectedOrder.seminar ? 'Seminar' : null,
                    ].filter(Boolean).join(', ') || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-blue-700/80 text-xs uppercase tracking-wide">Venue/Destination</p>
                    <p className="font-bold">{selectedOrder.venueDestination || selectedOrder.destination || 'N/A'}</p>
                  </div>
                </>
              )}
            </div>

            <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); handleApprove(); }}>
              <div>
                <label htmlFor="travel-head-approval-remarks" className="block font-bold mb-2">Approval Remarks (Optional)</label>
                <textarea
                  id="travel-head-approval-remarks"
                  value={approvalData.remarks}
                  onChange={(e) => setApprovalData({...approvalData, remarks: e.target.value})}
                  rows="3"
                  className="w-full px-4 py-2 border border-blue-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-500"
                ></textarea>
              </div>

              <div className="space-y-2">
                <button
                  type="button"
                  onClick={handleApprove}
                  className="w-full py-2.5 sm:py-2 rounded-md text-white text-sm font-semibold bg-green-500 hover:bg-green-600"
                >
                  Approve & Forward to Admin
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDisapproveComment('');
                    setShowDisapproveModal(true);
                  }}
                  className="w-full py-2.5 sm:py-2 rounded-md text-white text-sm font-semibold bg-red-500 hover:bg-red-600"
                >
                  Disapprove
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setRevisionComment('');
                    setShowRevisionModal(true);
                  }}
                  className="w-full py-2.5 sm:py-2 rounded-md text-white text-sm font-semibold bg-orange-500 hover:bg-orange-600"
                >
                  Request Revision
                </button>
              </div>
            </form>
          </div>
        )}
      </div>

      {showDisapproveModal && (
        <div className="fixed inset-0 bg-black/45 backdrop-blur-[1px] flex items-center justify-center z-50 p-4">
          <div role="dialog" aria-modal="true" aria-labelledby="travel-head-disapprove-title" className="bg-white w-full max-w-md max-h-[90vh] overflow-y-auto rounded-xl border border-blue-100 shadow-2xl p-4 sm:p-6">
            <h3 id="travel-head-disapprove-title" className="text-lg font-bold mb-3">Disapprove Travel Order</h3>
            <p className="text-sm text-gray-600 mb-3">Please provide a comment. This will be visible to the staff.</p>
            <textarea
              value={disapproveComment}
              onChange={(e) => setDisapproveComment(e.target.value)}
              rows="4"
              className="w-full px-4 py-2 border border-blue-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-500"
              placeholder="Reason for disapproval"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowDisapproveModal(false)}
                className="px-4 py-2 rounded-md bg-slate-200 text-slate-800 text-sm font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDisapprove}
                className="px-4 py-2 rounded-md bg-red-500 text-white text-sm font-semibold"
              >
                Confirm Disapprove
              </button>
            </div>
          </div>
        </div>
      )}

      {showRevisionModal && (
        <div className="fixed inset-0 bg-black/45 backdrop-blur-[1px] flex items-center justify-center z-50 p-4">
          <div role="dialog" aria-modal="true" aria-labelledby="travel-head-revision-title" className="bg-white w-full max-w-md max-h-[90vh] overflow-y-auto rounded-xl border border-blue-100 shadow-2xl p-4 sm:p-6">
            <h3 id="travel-head-revision-title" className="text-lg font-bold mb-3">Request Revision</h3>
            <p className="text-sm text-gray-600 mb-3">Please provide revision notes. This will be visible to the staff.</p>
            <textarea
              value={revisionComment}
              onChange={(e) => setRevisionComment(e.target.value)}
              rows="4"
              className="w-full px-4 py-2 border border-blue-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-500"
              placeholder="Required revisions"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowRevisionModal(false)}
                className="px-4 py-2 rounded-md bg-slate-200 text-slate-800 text-sm font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApproveWithRevision}
                className="px-4 py-2 rounded-md bg-orange-500 text-white text-sm font-semibold"
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
