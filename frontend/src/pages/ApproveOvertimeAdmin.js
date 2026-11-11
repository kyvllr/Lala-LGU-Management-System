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

const isAdminPending = (overtime) => {
  if (!overtime) return false;
  return overtime.status === 'Pending' && ['Admin', 'admin'].includes(overtime.approvalStage);
};

function ApproveOvertimeAdmin({ forcedStatus = 'Pending' }) {
  const [overtimes, setOvertimes] = useState([]);
  const [filteredOvertimes, setFilteredOvertimes] = useState([]);
  const [statusFilter, setStatusFilter] = useState(forcedStatus ?? 'Pending');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedOvertime, setSelectedOvertime] = useState(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editFormData, setEditFormData] = useState({});
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
      const response = await overtimeAPI.getAll(statusFilter || undefined);
      const adminQueue = (response.data || []).filter((overtime) => {
        if (statusFilter === 'Pending') {
          return isAdminPending(overtime);
        }
        return true;
      });
      setOvertimes(adminQueue);
    } catch (err) {
      setError('Failed to fetch overtime requests');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const filterOvertimes = () => {
    let filtered = overtimes;

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
    setEditFormData({
      purposeOfOvertime: overtime.purposeOfOvertime || '',
      inclusiveDateStart: overtime.inclusiveDateStart ? new Date(overtime.inclusiveDateStart).toISOString().split('T')[0] : '',
      inclusiveDateEnd: overtime.inclusiveDateEnd ? new Date(overtime.inclusiveDateEnd).toISOString().split('T')[0] : '',
    });
    setIsEditMode(false);
    setApprovalData({ remarks: '', approvedBy: getApproverName() });
    setError('');
    setSuccess('');
  };

  const handleCloseModal = () => {
    setSelectedOvertime(null);
    setIsEditMode(false);
    setEditFormData({});
    setApprovalData({ remarks: '', approvedBy: getApproverName() });
  };

  const handleEditChange = (e) => {
    const { name, value } = e.target;
    setEditFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSaveEdit = async () => {
    if (!selectedOvertime) return;

    try {
      setActionLoading(true);
      setError('');
      setSuccess('');

      const updateData = {
        purposeOfOvertime: editFormData.purposeOfOvertime,
        inclusiveDateStart: new Date(editFormData.inclusiveDateStart).toISOString(),
        inclusiveDateEnd: new Date(editFormData.inclusiveDateEnd).toISOString(),
      };

      await overtimeAPI.update(selectedOvertime.overtimeId, updateData);
      setSuccess('Overtime request updated successfully');
      setTimeout(() => {
        setIsEditMode(false);
        fetchOvertimes();
      }, 1000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update overtime request');
    } finally {
      setActionLoading(false);
    }
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

      setSuccess('Overtime request approved successfully');
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

      setSuccess('Overtime request disapproved successfully');
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
      case 'Under Review':
      case 'For Revision':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStageText = (overtime) => {
    if (!overtime) return '';
    if (overtime.status === 'Approved') return 'Final Approval Complete';
    if (overtime.status === 'Disapproved') return 'Final Decision: Disapproved';
    if (['Admin', 'admin'].includes(overtime.approvalStage) && overtime.status === 'Pending') {
      return 'Awaiting Admin Final Review';
    }
    if (['BudgetOfficer', 'budget_officer'].includes(overtime.approvalStage) && overtime.status === 'Pending') {
      return 'Pending Budget Officer Review';
    }
    if (['HeadOfficer', 'pending', 'head_requisitioning_office'].includes(overtime.approvalStage) && overtime.status === 'Pending') {
      return 'Pending Head Officer Review';
    }
    if (overtime.status === 'For Revision' || overtime.status === 'Under Review') {
      return 'Returned for Revision';
    }
    return '';
  };

  if (loading) return <div className="text-center p-8 text-blue-700 font-medium">Loading overtime requests...</div>;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold tracking-tight text-blue-950 mb-6">Approve Overtime Requests (Admin - Final Approval)</h1>
      <p className="text-blue-700/80 mb-6 text-sm">Final approval level. These requests were approved by the Head Officer and Budget Officer.</p>

      {error && <div className="mb-4 p-4 bg-red-50 text-red-700 rounded-lg border border-red-200">{error}</div>}
      {success && <div className="mb-4 p-4 bg-green-50 text-green-700 rounded-lg border border-green-200">{success}</div>}

      {/* Filter Section */}
      <div className="bg-white rounded-lg border border-blue-100 shadow-sm p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Status Filter</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-4 py-2 border border-blue-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-500 bg-white"
            >
              <option value="">All</option>
              <option value="Pending">Pending</option>
              <option value="Approved">Approved</option>
              <option value="Disapproved">Disapproved</option>
              <option value="Under Review">Under Review</option>
            </select>
          </div>

          <div className="md:col-span-2">
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
            {overtimes.length === 0 ? 'No overtime requests found' : 'No results matching your search'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[13px] text-slate-700">
              <thead>
                <tr className="bg-blue-100/80 text-blue-900">
                  <th scope="col" className="border border-blue-200 px-3 py-2 text-left text-xs font-semibold">Staff Name</th>
                  <th scope="col" className="border border-blue-200 px-3 py-2 text-left text-xs font-semibold">Position</th>
                  <th scope="col" className="border border-blue-200 px-3 py-2 text-left text-xs font-semibold">Purpose</th>
                  <th scope="col" className="border border-blue-200 px-3 py-2 text-left text-xs font-semibold">From Date</th>
                  <th scope="col" className="border border-blue-200 px-3 py-2 text-left text-xs font-semibold">To Date</th>
                  <th scope="col" className="border border-blue-200 px-3 py-2 text-left text-xs font-semibold">Status</th>
                  <th scope="col" className="border border-blue-200 px-3 py-2 text-left text-xs font-semibold">Stage</th>
                  <th scope="col" className="border border-blue-200 px-3 py-2 text-center text-xs font-semibold">Action</th>
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
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(overtime.status)}`}>
                        {overtime.status}
                      </span>
                    </td>
                    <td className="border border-blue-100 px-3 py-1.5 text-sm text-gray-700">{getStageText(overtime) || 'N/A'}</td>
                    <td className="border border-blue-100 px-3 py-1.5 text-center">
                      <div className="flex flex-wrap items-center justify-center gap-2">
                        <button
                          onClick={() => handleViewDetails(overtime)}
                          className="px-4 py-2.5 sm:py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition text-xs font-semibold"
                        >
                          View & Approve
                        </button>
                        {overtime.status === 'Approved' && (
                          <button
                            onClick={() => printOvertimeRequest(overtime)}
                            className="px-4 py-2.5 sm:py-2 bg-slate-600 text-white rounded-md hover:bg-slate-700 transition text-xs font-semibold"
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
          <div role="dialog" aria-modal="true" aria-labelledby="overtime-admin-details-title" className="bg-white rounded-xl border border-blue-100 shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="bg-blue-500 text-white p-4 sm:p-6 flex justify-between items-center sticky top-0">
              <h2 id="overtime-admin-details-title" className="text-xl sm:text-2xl font-bold">Overtime Request Details</h2>
              <button
                type="button"
                onClick={handleCloseModal}
                aria-label="Close"
                className="p-2.5 sm:p-0 text-xl hover:text-gray-200 transition"
              >
                ✕
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-4 sm:p-6 space-y-6">
              {error && <div className="p-4 bg-red-100 text-red-700 rounded-lg border border-red-300">{error}</div>}
              {success && <div className="p-4 bg-green-100 text-green-700 rounded-lg border border-green-300">{success}</div>}

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-600 font-semibold mb-1">Final Approval Reminder</p>
                <p className="text-sm text-gray-700">Requests remain pending until they pass Head Officer and Budget Officer stages, then Admin marks final approval.</p>
              </div>

              {/* Staff Information */}
              <div className="border-b pb-4">
                <h3 className="text-lg font-bold text-gray-800 mb-4">Staff Information</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="min-w-0 break-words">
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
                {isEditMode ? (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Purpose of Overtime</label>
                      <textarea
                        name="purposeOfOvertime"
                        value={editFormData.purposeOfOvertime}
                        onChange={handleEditChange}
                        rows="3"
                        className="w-full px-3 py-2 border border-blue-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-500 bg-white"
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">From Date</label>
                        <input
                          type="date"
                          name="inclusiveDateStart"
                          value={editFormData.inclusiveDateStart}
                          onChange={handleEditChange}
                          className="w-full px-3 py-2 border border-blue-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-500 bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">To Date</label>
                        <input
                          type="date"
                          name="inclusiveDateEnd"
                          value={editFormData.inclusiveDateEnd}
                          onChange={handleEditChange}
                          className="w-full px-3 py-2 border border-blue-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-500 bg-white"
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm text-gray-600">Purpose of Overtime</p>
                      <p className="text-gray-800">{selectedOvertime.purposeOfOvertime}</p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                )}
              </div>

              {/* Approvals Required */}
              <div className="border-b pb-4">
                <h3 className="text-lg font-bold text-gray-800 mb-4">Position</h3>
                <div className="space-y-2">
                  {selectedOvertime.officeStaffPersonnel && (
                    <div className="flex items-center gap-2">
                      <span className="inline-block w-3 h-3 bg-green-500 rounded-full"></span>
                      <span className="text-gray-800">Office Staff/Personnel</span>
                    </div>
                  )}
                  {selectedOvertime.departmentHeadOfficer && (
                    <div className="flex items-center gap-2">
                      <span className="inline-block w-3 h-3 bg-green-500 rounded-full"></span>
                      <span className="text-gray-800">Department Head/Officer-In-Charge</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Staff Details Table */}
              {selectedOvertime.staffDetails && selectedOvertime.staffDetails.length > 0 && (
                <div className="border-b pb-4">
                  <h3 className="text-lg font-bold text-gray-800 mb-4">Staff Involved in Overtime</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="bg-gray-100">
                          <th scope="col" className="border px-3 py-2 text-left text-sm font-bold">No.</th>
                          <th scope="col" className="border px-3 py-2 text-left text-sm font-bold">Name</th>
                          <th scope="col" className="border px-3 py-2 text-left text-sm font-bold">Position</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedOvertime.staffDetails.map((detail, index) => (
                          <tr key={index} className="border">
                            <td className="border px-3 py-2 text-center text-sm">{index + 1}</td>
                            <td className="border px-3 py-2 text-sm">{detail.name}</td>
                            <td className="border px-3 py-2 text-sm">{detail.position}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Remarks Field */}
              {selectedOvertime.status === 'Pending' || selectedOvertime.status === 'Under Review' ? (
                <div className="border-b pb-4">
                  <label htmlFor="overtime-admin-approval-remarks" className="block text-sm font-semibold text-gray-700 mb-2">Approval Remarks</label>
                  <textarea
                    id="overtime-admin-approval-remarks"
                    value={approvalData.remarks}
                    onChange={(e) => setApprovalData({ ...approvalData, remarks: e.target.value })}
                    rows="4"
                    placeholder="Enter remarks for approval/disapproval..."
                    className="w-full px-3 py-2 border border-blue-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-500 bg-white"
                  />
                </div>
              ) : (
                <div className="border-b pb-4">
                  <p className="text-sm text-gray-600">Current Status</p>
                  <p className={`text-lg font-semibold ${getStatusColor(selectedOvertime.status)}`}>
                    {selectedOvertime.status}
                  </p>
                  {getStageText(selectedOvertime) && (
                    <p className="text-sm text-gray-600 mt-1">{getStageText(selectedOvertime)}</p>
                  )}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-4 justify-end">
                {isEditMode ? (
                  <>
                    <button
                      onClick={() => setIsEditMode(false)}
                      disabled={actionLoading}
                      className="px-6 py-2.5 sm:py-2 border border-slate-300 rounded-md text-slate-700 hover:bg-slate-100 transition text-sm font-semibold"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveEdit}
                      disabled={actionLoading}
                      className="px-6 py-2.5 sm:py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:bg-gray-400 transition text-sm font-semibold"
                    >
                      {actionLoading ? 'Saving...' : 'Save Changes'}
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={handleCloseModal}
                      className="px-6 py-2.5 sm:py-2 border border-slate-300 rounded-md text-slate-700 hover:bg-slate-100 transition text-sm font-semibold"
                    >
                      Close
                    </button>
                    {selectedOvertime.status === 'Approved' && (
                      <button
                        onClick={() => printOvertimeRequest(selectedOvertime)}
                        className="px-6 py-2.5 sm:py-2 bg-slate-600 text-white rounded-md hover:bg-slate-700 transition text-sm font-semibold"
                      >
                        Print
                      </button>
                    )}
                    {(selectedOvertime.status === 'Pending' || selectedOvertime.status === 'Under Review' || selectedOvertime.status === 'For Revision') && (
                      <>
                        <button
                          onClick={() => setIsEditMode(true)}
                          disabled={actionLoading}
                          className="px-6 py-2.5 sm:py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:bg-gray-400 transition text-sm font-semibold"
                        >
                          Edit
                        </button>
                        <button
                          onClick={handleRevise}
                          disabled={actionLoading}
                          className="px-6 py-2.5 sm:py-2 bg-orange-500 text-white rounded-md hover:bg-orange-600 disabled:bg-gray-400 transition text-sm font-semibold"
                        >
                          {actionLoading ? 'Processing...' : 'Send for Revision'}
                        </button>
                        <button
                          onClick={handleDisapprove}
                          disabled={actionLoading}
                          className="px-6 py-2.5 sm:py-2 bg-red-500 text-white rounded-md hover:bg-red-600 disabled:bg-gray-400 transition text-sm font-semibold"
                        >
                          {actionLoading ? 'Processing...' : 'Disapprove'}
                        </button>
                        <button
                          onClick={handleApprove}
                          disabled={actionLoading}
                          className="px-6 py-2.5 sm:py-2 bg-green-500 text-white rounded-md hover:bg-green-600 disabled:bg-gray-400 transition text-sm font-semibold"
                        >
                          {actionLoading ? 'Processing...' : 'Approve'}
                        </button>
                      </>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ApproveOvertimeAdmin;
