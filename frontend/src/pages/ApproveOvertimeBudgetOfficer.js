import React, { useState, useEffect } from 'react';
import { overtimeAPI } from '../api';
import { FiSearch } from 'react-icons/fi';
import printOvertimeRequest from '../utils/printOvertimeRequest';

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

function ApproveOvertimeBudgetOfficer({ forcedStatus = 'Pending' }) {
  const [overtimes, setOvertimes] = useState([]);
  const [filteredOvertimes, setFilteredOvertimes] = useState([]);
  const [statusFilter, setStatusFilter] = useState(forcedStatus ?? 'Pending');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedOvertime, setSelectedOvertime] = useState(null);
  const [approvalData, setApprovalData] = useState({
    remarks: '',
    approvedBy: getApproverName(),
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    fetchOvertimes();
  }, [statusFilter]);

  useEffect(() => {
    setStatusFilter(forcedStatus ?? 'Pending');
  }, [forcedStatus]);

  useEffect(() => {
    filterOvertimes();
  }, [overtimes, searchQuery, statusFilter]);

  const fetchOvertimes = async () => {
    try {
      setLoading(true);
      // Fetch all overtimes - backend will filter based on user role
      const response = await overtimeAPI.getAll();
      setOvertimes(response.data || []);
    } catch (err) {
      setError('Failed to fetch overtime requests');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const filterOvertimes = () => {
    let filtered = overtimes;

    const isBudgetPending = (overtime) =>
      ['BudgetOfficer', 'budget_officer'].includes(overtime.approvalStage) &&
      overtime.status === 'Pending' &&
      overtime.headRequisitioningOfficerApproval?.status === 'Approved';

    const isBudgetApproved = (overtime) =>
      (['Admin', 'admin'].includes(overtime.approvalStage) && overtime.status === 'Pending') ||
      overtime.status === 'Approved';

    if (statusFilter === 'Pending') {
      filtered = filtered.filter((overtime) => isBudgetPending(overtime));
    } else if (statusFilter === 'Approved') {
      filtered = filtered.filter((overtime) => isBudgetApproved(overtime));
    } else if (statusFilter === 'Disapproved') {
      filtered = filtered.filter((overtime) => overtime.status === 'Disapproved');
    } else {
      filtered = filtered.filter((overtime) =>
        isBudgetPending(overtime) || isBudgetApproved(overtime) || overtime.status === 'Disapproved'
      );
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(overtime =>
        (overtime.staffName && overtime.staffName.toLowerCase().includes(query)) ||
        (overtime.firstName && overtime.firstName.toLowerCase().includes(query)) ||
        (overtime.lastName && overtime.lastName.toLowerCase().includes(query)) ||
        (overtime.purposeOfOvertime && overtime.purposeOfOvertime.toLowerCase().includes(query))
      );
    }

    setFilteredOvertimes(filtered);
  };

  const handleViewDetails = (overtime) => {
    setSelectedOvertime(overtime);
    setApprovalData({ remarks: '', approvedBy: getApproverName() });
    setError('');
    setSuccess('');
  };

  const handleCloseModal = () => {
    setSelectedOvertime(null);
    setApprovalData({ remarks: '', approvedBy: getApproverName() });
  };

  const handleApprove = async () => {
    if (!selectedOvertime) return;

    try {
      setActionLoading(true);
      setError('');
      setSuccess('');

      await overtimeAPI.approve(selectedOvertime.overtimeId, {
        approvedBy: approvalData.approvedBy,
        remarks: approvalData.remarks,
      });

      setSuccess('Overtime request approved and forwarded to Admin for final review');
      setTimeout(() => {
        handleCloseModal();
        fetchOvertimes();
      }, 1500);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to approve overtime request');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDisapprove = async () => {
    if (!selectedOvertime) return;

    if (!approvalData.remarks.trim()) {
      setError('Please provide remarks for disapproval');
      return;
    }

    try {
      setActionLoading(true);
      setError('');
      setSuccess('');

      await overtimeAPI.disapprove(selectedOvertime.overtimeId, {
        approvedBy: approvalData.approvedBy,
        remarks: approvalData.remarks,
      });

      setSuccess('Overtime request disapproved');
      setTimeout(() => {
        handleCloseModal();
        fetchOvertimes();
      }, 1500);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to disapprove overtime request');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRevise = async () => {
    if (!selectedOvertime) return;

    if (!approvalData.remarks.trim()) {
      setError('Please provide remarks for revision');
      return;
    }

    try {
      setActionLoading(true);
      setError('');
      setSuccess('');

      await overtimeAPI.revise(selectedOvertime.overtimeId, {
        approvedBy: approvalData.approvedBy,
        remarks: approvalData.remarks,
      });

      setSuccess('Overtime request sent for revision');
      setTimeout(() => {
        handleCloseModal();
        fetchOvertimes();
      }, 1500);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send for revision');
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Approved':
        return 'bg-green-100 text-green-800';
      case 'Disapproved':
        return 'bg-red-100 text-red-800';
      case 'Pending':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) return <div className="text-center p-8 text-blue-700 font-medium">Loading overtime requests...</div>;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold tracking-tight text-blue-950 mb-6">Approve Overtime Requests (Budget Officer)</h1>
      <p className="text-blue-700/80 mb-6 text-sm">Review overtime requests approved by the Head of Requisitioning Office. Your approval will forward them to Admin for final review.</p>

      {error && <div className="mb-4 p-4 bg-red-50 text-red-700 rounded-lg border border-red-200">{error}</div>}
      {success && <div className="mb-4 p-4 bg-green-50 text-green-700 rounded-lg border border-green-200">{success}</div>}

      {/* Filter Section */}
      <div className="bg-white rounded-lg border border-blue-100 shadow-sm p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Search</label>
            <div className="relative">
              <FiSearch className="absolute left-3 top-3 text-gray-400" />
              <input
                type="text"
                placeholder="Search by staff name or purpose..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-blue-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-500 bg-white"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Overtimes Table */}
      <div className="bg-white rounded-lg border border-blue-100 shadow-sm overflow-hidden">
        {filteredOvertimes.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            {overtimes.length === 0 ? 'No overtime requests pending your approval' : 'No results matching your search'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[13px] text-slate-700">
              <thead>
                <tr className="bg-blue-100/80 text-blue-900">
                  <th className="border border-blue-200 px-3 py-2 text-left text-xs font-semibold">Staff Name</th>
                  <th className="border border-blue-200 px-3 py-2 text-left text-xs font-semibold">Position</th>
                  <th className="border border-blue-200 px-3 py-2 text-left text-xs font-semibold">Purpose</th>
                  <th className="border border-blue-200 px-3 py-2 text-left text-xs font-semibold">From Date</th>
                  <th className="border border-blue-200 px-3 py-2 text-left text-xs font-semibold">To Date</th>
                  <th className="border border-blue-200 px-3 py-2 text-left text-xs font-semibold">Head Office Approval</th>
                  <th className="border border-blue-200 px-3 py-2 text-center text-xs font-semibold">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredOvertimes.map((overtime) => (
                  <tr key={overtime.overtimeId} className="border border-blue-100 hover:bg-blue-50/50">
                    <td className="border border-blue-100 px-3 py-1.5">
                      {`${overtime.firstName || ''} ${overtime.lastName || ''}`.trim()}
                    </td>
                    <td className="border border-blue-100 px-3 py-1.5">{overtime.position}</td>
                    <td className="border border-blue-100 px-3 py-1.5">
                      <div className="max-w-xs truncate" title={overtime.purposeOfOvertime}>
                        {overtime.purposeOfOvertime}
                      </div>
                    </td>
                    <td className="border border-blue-100 px-3 py-1.5">{new Date(overtime.inclusiveDateStart).toLocaleDateString()}</td>
                    <td className="border border-blue-100 px-3 py-1.5">{new Date(overtime.inclusiveDateEnd).toLocaleDateString()}</td>
                    <td className="border border-blue-100 px-3 py-1.5">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(overtime.headRequisitioningOfficerApproval?.status || 'Pending')}`}>
                        {overtime.headRequisitioningOfficerApproval?.status || 'Pending'}
                      </span>
                    </td>
                    <td className="border border-blue-100 px-3 py-1.5 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleViewDetails(overtime)}
                          className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition text-xs font-semibold"
                        >
                          Review
                        </button>
                        {overtime.status === 'Approved' && (
                          <button
                            onClick={() => printOvertimeRequest(overtime)}
                            className="px-4 py-2 bg-slate-600 text-white rounded-md hover:bg-slate-700 transition text-xs font-semibold"
                          >
                            Print
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Details Modal */}
      {selectedOvertime && (
        <div className="fixed inset-0 bg-black/45 backdrop-blur-[1px] flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl border border-blue-100 shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="bg-blue-500 text-white p-6 flex justify-between items-center sticky top-0">
              <h2 className="text-2xl font-bold">Overtime Request - Budget Officer Review</h2>
              <button
                onClick={handleCloseModal}
                className="text-xl hover:text-gray-200 transition"
              >
                ✕
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-6">
              {error && <div className="p-4 bg-red-100 text-red-700 rounded-lg border border-red-300">{error}</div>}
              {success && <div className="p-4 bg-green-100 text-green-700 rounded-lg border border-green-300">{success}</div>}

              {/* Approval Status */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-600 font-semibold mb-2">Approval Stage Information</p>
                <p className="text-gray-800">This overtime request has been approved by the <strong>Head of Requisitioning Office</strong> and is now at the <strong>Budget Officer</strong> approval stage.</p>
                <p className="text-xs text-gray-600 mt-2">After your approval, it will be forwarded to Admin for final review.</p>
              </div>

              {/* Staff Information */}
              <div className="border-b pb-4">
                <h3 className="text-lg font-bold text-gray-800 mb-4">Staff Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">Full Name</p>
                    <p className="text-lg font-semibold">{`${selectedOvertime.firstName || ''} ${selectedOvertime.lastName || ''}`.trim()}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Position</p>
                    <p className="text-lg font-semibold">{selectedOvertime.position}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Office/Department</p>
                    <p className="text-lg font-semibold">{selectedOvertime.office}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Filing Date</p>
                    <p className="text-lg font-semibold">{new Date(selectedOvertime.filingDate).toLocaleDateString()}</p>
                  </div>
                </div>
              </div>

              {/* Overtime Details */}
              <div className="border-b pb-4">
                <h3 className="text-lg font-bold text-gray-800 mb-4">Overtime Details</h3>
                <div className="space-y-3">
                  <div>
                    <p className="text-sm text-gray-600">Purpose of Overtime</p>
                    <p className="text-gray-800">{selectedOvertime.purposeOfOvertime}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-600">From Date</p>
                      <p className="text-gray-800">{new Date(selectedOvertime.inclusiveDateStart).toLocaleDateString()}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">To Date</p>
                      <p className="text-gray-800">{new Date(selectedOvertime.inclusiveDateEnd).toLocaleDateString()}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Head of Requisitioning Office Approval */}
              {selectedOvertime.headRequisitioningOfficerApproval && (
                <div className="border-b pb-4 bg-green-50 rounded-lg p-4">
                  <h3 className="text-lg font-bold text-gray-800 mb-4">Head of Requisitioning Office Approval</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <p className="text-sm text-gray-600">Status:</p>
                      <p className="font-semibold">{selectedOvertime.headRequisitioningOfficerApproval.status}</p>
                    </div>
                    <div className="flex justify-between">
                      <p className="text-sm text-gray-600">Approved By:</p>
                      <p className="font-semibold">{selectedOvertime.headRequisitioningOfficerApproval.approvedBy}</p>
                    </div>
                    {selectedOvertime.headRequisitioningOfficerApproval.approvalDate && (
                      <div className="flex justify-between">
                        <p className="text-sm text-gray-600">Approval Date:</p>
                        <p className="font-semibold">{new Date(selectedOvertime.headRequisitioningOfficerApproval.approvalDate).toLocaleDateString()}</p>
                      </div>
                    )}
                    {selectedOvertime.headRequisitioningOfficerApproval.remarks && (
                      <div>
                        <p className="text-sm text-gray-600 mb-1">Remarks:</p>
                        <p className="text-gray-800">{selectedOvertime.headRequisitioningOfficerApproval.remarks}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Remarks Field */}
              <div className="border-b pb-4">
                <label className="block text-sm font-semibold text-gray-700 mb-2">Your Remarks</label>
                <textarea
                  value={approvalData.remarks}
                  onChange={(e) => setApprovalData({ ...approvalData, remarks: e.target.value })}
                  rows="4"
                  placeholder="Enter remarks for approval/disapproval..."
                  className="w-full px-3 py-2 border border-blue-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-500 bg-white"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex gap-4 justify-end">
                <button
                  onClick={handleCloseModal}
                  className="px-6 py-2 border border-slate-300 rounded-md text-slate-700 hover:bg-slate-100 transition text-sm font-semibold"
                >
                  Close
                </button>
                {selectedOvertime.status === 'Approved' && (
                  <button
                    onClick={() => printOvertimeRequest(selectedOvertime)}
                    className="px-6 py-2 bg-slate-600 text-white rounded-md hover:bg-slate-700 transition text-sm font-semibold"
                  >
                    Print
                  </button>
                )}
                <button
                  onClick={handleDisapprove}
                  disabled={actionLoading}
                  className="px-6 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 disabled:bg-gray-400 transition text-sm font-semibold"
                >
                  {actionLoading ? 'Processing...' : 'Disapprove'}
                </button>
                <button
                  onClick={handleRevise}
                  disabled={actionLoading}
                  className="px-6 py-2 bg-orange-500 text-white rounded-md hover:bg-orange-600 disabled:bg-gray-400 transition text-sm font-semibold"
                >
                  {actionLoading ? 'Processing...' : 'Send for Revision'}
                </button>
                <button
                  onClick={handleApprove}
                  disabled={actionLoading}
                  className="px-6 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 disabled:bg-gray-400 transition text-sm font-semibold"
                >
                  {actionLoading ? 'Processing...' : 'Approve'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ApproveOvertimeBudgetOfficer;
