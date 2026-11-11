
import React, { useState, useEffect } from 'react';
import { leaveAPI, leaveRecordAPI } from '../api';
import { FiSearch } from 'react-icons/fi';
import { openPrintWindow } from '../components/PrintableLeaveForm';

// Helper to enrich leave object with staff's leave balance data for printing
async function enrichLeaveWithBalance(leave) {
  try {
    if (!leave.staffId) return leave;
    
    const recordsRes = await leaveRecordAPI.getByStaffId(leave.staffId);
    let records = [];
    
    if (recordsRes.data && recordsRes.data.data && Array.isArray(recordsRes.data.data)) {
      records = recordsRes.data.data;
    } else if (recordsRes.data && Array.isArray(recordsRes.data)) {
      records = recordsRes.data;
    }
    
    const getValidDate = (value) => {
      if (!value) return null;
      const parsed = new Date(value);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    };

    const getRecordStartDate = (record) => {
      if (Array.isArray(record.dateRanges) && record.dateRanges.length > 0) {
        const rangeStarts = record.dateRanges
          .map((range) => getValidDate(range?.from || range?.startDate || range?.to || range?.endDate))
          .filter(Boolean)
          .sort((a, b) => a - b);
        if (rangeStarts.length > 0) return rangeStarts[0];
      }
      return getValidDate(record.period) || getValidDate(record.createdAt);
    };

    const getLeaveStartDate = (leaveDoc) => {
      const candidates = [];
      if (Array.isArray(leaveDoc.dateRanges)) {
        leaveDoc.dateRanges.forEach((range) => {
          const start = getValidDate(range?.startDate || range?.from);
          if (start) candidates.push(start);
        });
      }
      const startDate = getValidDate(leaveDoc.startDate);
      if (startDate) candidates.push(startDate);
      if (candidates.length === 0) return null;
      return new Date(Math.min(...candidates.map((date) => date.getTime())));
    };

    const sortedRecords = [...records].sort((a, b) => {
      const aStart = getRecordStartDate(a);
      const bStart = getRecordStartDate(b);
      if (!aStart && !bStart) return 0;
      if (!aStart) return 1;
      if (!bStart) return -1;
      const delta = aStart - bStart;
      if (delta !== 0) return delta;
      const aCreated = getValidDate(a.createdAt);
      const bCreated = getValidDate(b.createdAt);
      if (!aCreated && !bCreated) return 0;
      if (!aCreated) return 1;
      if (!bCreated) return -1;
      return aCreated - bCreated;
    });

    const applicationStartDate = getLeaveStartDate(leave);
    const currentLeaveId = String(leave.leaveId || leave.id || '');

    const recordsBeforeApplication = sortedRecords.filter((record) => {
      if (currentLeaveId && String(record.sourceLeaveId || '') === currentLeaveId) {
        return false;
      }
      const recordStart = getRecordStartDate(record);
      if (!applicationStartDate || !recordStart) return true;
      return recordStart < applicationStartDate;
    });

    let vlBalanceBefore = 0;
    let slBalanceBefore = 0;
    let ctoBalanceBefore = 0;

    recordsBeforeApplication.forEach((record) => {
      const particulars = String(record.particulars || '').toLowerCase();
      const vacationLeaveDeduction = ['mandatory/force leave', 'monetization', 'wellness'].includes(particulars)
        ? parseFloat(record.vlAbsentUndertimeWPay) || parseFloat(record.numberOfDays) || 0
        : parseFloat(record.vlAbsentUndertimeWPay) || 0;
      const vlDelta = (parseFloat(record.vlEarned) || 0) - vacationLeaveDeduction;
      const slDelta = (parseFloat(record.slEarned) || 0) - (parseFloat(record.slAbsentUndertimeWPay) || 0);

      if (
        particulars.includes('vacation leave') ||
        particulars === 'vl' ||
        particulars === 'mandatory/force leave' ||
        particulars === 'monetization' ||
        particulars === 'wellness' ||
        particulars.includes('undertime') ||
        particulars.includes('tardy') ||
        particulars.includes('earned leave')
      ) {
        vlBalanceBefore += vlDelta;
      }

      if (
        particulars.includes('sick leave') ||
        particulars === 'sl' ||
        particulars.includes('undertime') ||
        particulars.includes('tardy') ||
        particulars.includes('earned leave')
      ) {
        slBalanceBefore += slDelta;
      }

      ctoBalanceBefore += parseFloat(record.cto) || 0;
    });

    vlBalanceBefore = Math.max(0, vlBalanceBefore);
    slBalanceBefore = Math.max(0, slBalanceBefore);
    ctoBalanceBefore = Math.max(0, ctoBalanceBefore);
    
    // Determine how many days this application uses
    const normalizedLeaveType = String(leave.leaveType || '').toLowerCase();
    const vlDaysThisApp = (normalizedLeaveType === 'vacation leave' || normalizedLeaveType.includes('vacation')) ? (leave.numberOfDays || 0) : 0;
    const slDaysThisApp = (normalizedLeaveType === 'sick leave' || normalizedLeaveType.includes('sick')) ? (leave.numberOfDays || 0) : 0;
    const ctoDaysThisApp = (normalizedLeaveType.includes('cto') || normalizedLeaveType.includes('compensatory')) ? (leave.numberOfDays || 0) : 0;
    
    return {
      ...leave,
      vacationLeaveEarned: vlBalanceBefore,
      vacationLeaveUsed: vlDaysThisApp,
      vacationLeaveBalance: Math.max(0, vlBalanceBefore - vlDaysThisApp),
      sickLeaveEarned: slBalanceBefore,
      sickLeaveUsed: slDaysThisApp,
      sickLeaveBalance: Math.max(0, slBalanceBefore - slDaysThisApp),
      ctoEarned: ctoBalanceBefore,
      ctoUsed: ctoDaysThisApp,
      ctoBalance: Math.max(0, ctoBalanceBefore - ctoDaysThisApp),
    };
  } catch (err) {
    console.error('Error enriching leave with balance:', err);
    return leave;
  }
}

// Helper to format non-consecutive date ranges as 'Month (2-4, 8) 2026'
function formatDateRanges(dateRanges) {
  if (!Array.isArray(dateRanges) || dateRanges.length === 0) return 'N/A';
  let allDates = [];
  dateRanges.forEach(range => {
    if (range.startDate && range.endDate) {
      let start = new Date(range.startDate);
      let end = new Date(range.endDate);
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        allDates.push(new Date(d));
      }
    }
  });
  if (allDates.length === 0) return 'N/A';
  allDates.sort((a, b) => a - b);
  const groups = {};
  allDates.forEach(date => {
    const key = `${date.getFullYear()}-${date.getMonth()}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(date.getDate());
  });
  const result = Object.entries(groups).map(([key, days]) => {
    const [year, monthIdx] = key.split('-');
    const month = new Date(year, monthIdx).toLocaleString('default', { month: 'long' });
    days.sort((a, b) => a - b);
    let ranges = [];
    let start = days[0], end = days[0];
    for (let i = 1; i < days.length; i++) {
      if (days[i] === end + 1) {
        end = days[i];
      } else {
        ranges.push(start === end ? `${start}` : `${start}-${end}`);
        start = end = days[i];
      }
    }
    ranges.push(start === end ? `${start}` : `${start}-${end}`);
    return `${month} (${ranges.join(', ')}) ${year}`;
  });
  return result.join(', ');
}

const formatDate = (value) => {
  if (!value) return 'N/A';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? 'N/A' : parsed.toLocaleDateString();
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

function ApproveLeavesHeadOfficer({ forcedStatus = 'Pending' }) {
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedLeave, setSelectedLeave] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterAttribute, setFilterAttribute] = useState('staffName');
  const [viewStatus, setViewStatus] = useState(forcedStatus ?? 'Pending');
  const [approvalData, setApprovalData] = useState({
    approvedBy: getApproverName(),
    remarks: '',
  });
  const [showDisapproveModal, setShowDisapproveModal] = useState(false);
  const [showRevisionModal, setShowRevisionModal] = useState(false);
  const [disapproveComment, setDisapproveComment] = useState('');
  const [revisionComment, setRevisionComment] = useState('');

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
    fetchHeadOfficerLeaves();
  }, [viewStatus]);

  const fetchHeadOfficerLeaves = async () => {
    try {
      setLoading(true);
      const response = await leaveAPI.getAll(viewStatus || undefined);

      const headOfficerLeaves = (response.data || []).filter((leave) => {
        const isHeadOfficerPending = leave.approvalStage === 'HeadOfficer' && leave.status === 'Pending';
        const isHeadOfficerApproved =
          (leave.approvalStage === 'Admin' && leave.status === 'Pending') || leave.status === 'Approved';
        const isDisapproved = leave.status === 'Disapproved' || leave.status === 'Disapproved';

        if (viewStatus === 'Pending') return isHeadOfficerPending;
        if (viewStatus === 'Approved') return isHeadOfficerApproved;
        if (viewStatus === 'Disapproved') return isDisapproved;

        return isHeadOfficerPending || isHeadOfficerApproved || isDisapproved;
      });

      setLeaves(headOfficerLeaves);
      setSelectedLeave(null);
    } catch (err) {
      setError('Failed to load leaves');
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
      await leaveAPI.approve(selectedLeave.leaveId, {
        approvedBy: approvalData.approvedBy,
        remarks: approvalData.remarks,
      });

      setLeaves(leaves.filter(l => l.leaveId !== selectedLeave.leaveId));
      setSelectedLeave(null);
      setApprovalData({ approvedBy: getApproverName(), remarks: '' });
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to process leave');
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
      await leaveAPI.disapprove(selectedLeave.leaveId, {
        approvedBy: approvalData.approvedBy,
        remarks: disapproveComment,
      });

      setLeaves(leaves.filter(l => l.leaveId !== selectedLeave.leaveId));
      setSelectedLeave(null);
      setApprovalData({ approvedBy: getApproverName(), remarks: '' });
      setDisapproveComment('');
      setShowDisapproveModal(false);
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to disapprove leave');
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
      await leaveAPI.revise(selectedLeave.leaveId, {
        approvedBy: approvalData.approvedBy,
        remarks: revisionComment,
      });

      setLeaves(leaves.filter(l => l.leaveId !== selectedLeave.leaveId));
      setSelectedLeave(null);
      setApprovalData({ approvedBy: getApproverName(), remarks: '' });
      setRevisionComment('');
      setShowRevisionModal(false);
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to return leave for revision');
    }
  };

  if (loading) return <div className="text-center p-8 text-blue-700 font-medium">Loading...</div>;

  // Filter leaves based on search query and attribute
  const filteredLeaves = leaves.filter((leave) => {
    switch (filterAttribute) {
      case 'staffName':
        return leave.staffName.toLowerCase().includes(searchQuery.toLowerCase());
      case 'leaveType':
        return leave.leaveType.toLowerCase().includes(searchQuery.toLowerCase());
      case 'reason':
        return leave.reason.toLowerCase().includes(searchQuery.toLowerCase());
      case 'numberOfDays':
        return leave.numberOfDays.toString().includes(searchQuery);
      default:
        return true;
    }
  });

  return (
    <div className="mt-6">
      <h1 className="text-3xl font-bold tracking-tight text-blue-950 mb-2">Approve Leave Requests</h1>
      <p className="text-blue-700/80 mb-6 text-sm">Head Officer Approval Level - First stage of approval</p>

      {error && <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">{error}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Requests List */}
        <div className="lg:col-span-1">
          {/* Search and Filter Bar */}
          <div className="mb-4 flex flex-col sm:flex-row gap-2 w-full rounded-lg border border-blue-100 bg-blue-50/60 p-3">
            <div className="relative flex-1">
              <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                placeholder="Search leave requests..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-blue-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-500"
              />
            </div>
            <select
              value={filterAttribute}
              onChange={(e) => {
                setFilterAttribute(e.target.value);
                setSearchQuery('');
              }}
              className="w-full sm:w-40 sm:shrink-0 px-4 py-2 border border-blue-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-500 text-sm font-medium bg-white cursor-pointer"
            >
              <option value="staffName">Staff Name</option>
              <option value="leaveType">Leave Type</option>
              <option value="reason">Reason</option>
              <option value="numberOfDays">Days</option>
            </select>
          </div>

          <div className="space-y-4">
            {filteredLeaves.map((leave) => (
              <div
                key={leave.leaveId}
                onClick={() => setSelectedLeave(leave)}
                className={`bg-white p-4 rounded-lg border border-blue-100 shadow-sm cursor-pointer transition ${
                  selectedLeave?.leaveId === leave.leaveId ? 'border-2 border-blue-500' : ''
                }`}
              >
                <div className="flex flex-wrap justify-between items-start gap-2">
                  <div className="min-w-0">
                    <h3 className="font-semibold text-blue-950 break-words">{leave.staffName}</h3>
                    <p className="text-blue-700/80 text-sm break-words">{leave.leaveType}</p>
                    <p className="text-blue-700/80 text-sm break-words">
                      {formatDate(leave.startDate)} - {formatDate(leave.endDate)}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="bg-amber-100 text-amber-800 px-3 py-1 rounded-full text-xs font-semibold block">
                      {leave.numberOfDays} days
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {filteredLeaves.length === 0 && (
            <div className="text-center p-8 text-gray-600">
              {searchQuery ? 'No leave requests match your search' : 'No pending leave requests awaiting your approval'}
            </div>
          )}
        </div>

        {/* Approval Panel */}
        {selectedLeave && (
          <div className="bg-white p-6 rounded-lg border border-blue-100 shadow-sm lg:col-span-1">
            <h2 className="text-xl font-bold text-blue-950 mb-4">Leave Details</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
              <div>
                <p className="text-blue-700/80 text-xs uppercase tracking-wide">Staff</p>
                <p className="font-bold">{selectedLeave.staffName}</p>
              </div>
              <div>
                <p className="text-blue-700/80 text-xs uppercase tracking-wide">Date Filed</p>
                <p className="font-bold">{formatDate(selectedLeave.filingDate || selectedLeave.createdAt)}</p>
              </div>
              <div>
                <p className="text-blue-700/80 text-xs uppercase tracking-wide">Office/Department</p>
                <p className="font-bold">{selectedLeave.office || selectedLeave.staffDepartment || 'N/A'}</p>
              </div>
              <div>
                <p className="text-blue-700/80 text-xs uppercase tracking-wide">Type</p>
                <p className="font-bold">{selectedLeave.leaveType}</p>
              </div>
              <div>
                <p className="text-blue-700/80 text-xs uppercase tracking-wide">Duration</p>
                <p className="font-bold">
                  {Array.isArray(selectedLeave.dateRanges) && selectedLeave.dateRanges.length > 0
                    ? formatDateRanges(selectedLeave.dateRanges)
                    : `${formatDate(selectedLeave.startDate)} - ${formatDate(selectedLeave.endDate)}`}
                </p>
              </div>
              <div>
                <p className="text-blue-700/80 text-xs uppercase tracking-wide">Days</p>
                <p className="font-bold">{selectedLeave.numberOfDays ?? 'N/A'}</p>
              </div>
              <div>
                <p className="text-blue-700/80 text-xs uppercase tracking-wide">Communication</p>
                <p className="font-bold">
                  {selectedLeave.communicationRequested
                    ? 'Requested'
                    : selectedLeave.communicationNotRequested
                      ? 'Not Requested'
                      : 'N/A'}
                </p>
              </div>
            </div>

            {/* Late Filing Explanation */}
            {selectedLeave.lateFilingExplanation && (
              <div className="mb-4">
                <p className="text-blue-700/80 text-xs uppercase tracking-wide font-semibold">Explanation for Late Filing</p>
                <p className="font-bold text-red-600 whitespace-pre-line">{selectedLeave.lateFilingExplanation}</p>
              </div>
            )}
            
            <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); handleApprove(); }}>
              <div>
                <label htmlFor="leave-head-approval-remarks" className="block font-bold mb-2">Approval Remarks (Optional)</label>
                <textarea
                  id="leave-head-approval-remarks"
                  value={approvalData.remarks}
                  onChange={(e) => setApprovalData({...approvalData, remarks: e.target.value})}
                  rows="3"
                  className="w-full px-4 py-2 border border-blue-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-500"
                ></textarea>
              </div>

              <div className="space-y-2">
                <button
                  type="button"
                  onClick={async () => {
                    const enrichedLeave = await enrichLeaveWithBalance(selectedLeave);
                    openPrintWindow(enrichedLeave);
                  }}
                  className="w-full py-2.5 sm:py-2 rounded-md text-white text-sm font-semibold bg-blue-500 hover:bg-blue-600"
                >
                  Print
                </button>
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
          <div role="dialog" aria-modal="true" aria-labelledby="head-disapprove-leave-title" className="bg-white w-full max-w-md max-h-[90vh] overflow-y-auto rounded-xl border border-blue-100 shadow-2xl p-4 sm:p-6">
            <h3 id="head-disapprove-leave-title" className="text-lg font-bold mb-3">Disapprove Leave Request</h3>
            <p className="text-sm text-gray-600 mb-3">Please provide a comment. This will be visible to the staff.</p>
            <textarea
              value={disapproveComment}
              onChange={(e) => setDisapproveComment(e.target.value)}
              rows="4"
              className="w-full px-4 py-2 border border-blue-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-500"
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
          <div role="dialog" aria-modal="true" aria-labelledby="head-revision-leave-title" className="bg-white w-full max-w-md max-h-[90vh] overflow-y-auto rounded-xl border border-blue-100 shadow-2xl p-4 sm:p-6">
            <h3 id="head-revision-leave-title" className="text-lg font-bold mb-3">Request Revision</h3>
            <p className="text-sm text-gray-600 mb-3">Please provide revision notes. This will be visible to the staff.</p>
            <textarea
              value={revisionComment}
              onChange={(e) => setRevisionComment(e.target.value)}
              rows="4"
              className="w-full px-4 py-2 border border-blue-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-500"
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

export default ApproveLeavesHeadOfficer;
