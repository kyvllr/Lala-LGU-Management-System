
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
    
    console.log('[enrichLeaveWithBalance] Fetched', records.length, 'records for staffId:', leave.staffId);
    if (records.length > 0) {
      console.log('[enrichLeaveWithBalance] First record:', records[0]);
      console.log('[enrichLeaveWithBalance] Last record:', records[records.length - 1]);
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
      const vlDelta = (parseFloat(record.vlEarned) || 0) - (parseFloat(record.vlAbsentUndertimeWPay) || 0);
      const slDelta = (parseFloat(record.slEarned) || 0) - (parseFloat(record.slAbsentUndertimeWPay) || 0);

      if (
        particulars.includes('vacation leave') ||
        particulars === 'vl' ||
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

    console.log('[enrichLeaveWithBalance] Using records before application:', recordsBeforeApplication.length, 'of', records.length);
    console.log('[enrichLeaveWithBalance] Final balances - VL:', vlBalanceBefore, 'SL:', slBalanceBefore, 'CTO:', ctoBalanceBefore);
    
    // Determine how many days this application uses
    const normalizedLeaveType = String(leave.leaveType || '').toLowerCase();
    const vlDaysThisApp = (normalizedLeaveType === 'vacation leave' || normalizedLeaveType.includes('vacation')) ? (leave.numberOfDays || 0) : 0;
    const slDaysThisApp = (normalizedLeaveType === 'sick leave' || normalizedLeaveType.includes('sick')) ? (leave.numberOfDays || 0) : 0;
    const ctoDaysThisApp = (normalizedLeaveType.includes('cto') || normalizedLeaveType.includes('compensatory')) ? (leave.numberOfDays || 0) : 0;
    
    console.log('[enrichLeaveWithBalance] Leave type:', leave.leaveType, 'VL days this app:', vlDaysThisApp, 'SL days this app:', slDaysThisApp, 'CTO days this app:', ctoDaysThisApp);
    
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
  // Flatten all dates in the ranges
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
  // Sort and group by month/year
  allDates.sort((a, b) => a - b);
  const groups = {};
  allDates.forEach(date => {
    const key = `${date.getFullYear()}-${date.getMonth()}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(date.getDate());
  });
  // Format each group
  const result = Object.entries(groups).map(([key, days]) => {
    const [year, monthIdx] = key.split('-');
    const month = new Date(year, monthIdx).toLocaleString('default', { month: 'long' });
    // Group consecutive days
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

function ApproveLeavesAdmin({ forcedStatus = 'Pending' }) {
  const municipalAssessors = [
    'MICHAEL V. POGOY',
    'JANE A. DOE',
    'JUAN D. CRUZ',
  ];
  const customAssessorOption = '__custom_assessor__';
  const printSetupStorageKey = 'leave_print_setup_by_id_v1';
  const getDefaultPrintForm = () => ({
    recommendation: 'For Approval',
    disapprovalRemark: '',
    disapprovedDueTo: '',
    municipalAssessor: municipalAssessors[0],
    customMunicipalAssessor: '',
  });
  const getLeaveKey = (leave) => String(leave?.leaveId || leave?.id || '');

  const loadSavedPrintForm = (leaveKey) => {
    if (!leaveKey) return null;
    try {
      const raw = localStorage.getItem(printSetupStorageKey);
      if (!raw) return null;
      const all = JSON.parse(raw);
      const saved = all?.[leaveKey];
      if (!saved || typeof saved !== 'object') return null;
      return {
        ...getDefaultPrintForm(),
        ...saved,
      };
    } catch (e) {
      return null;
    }
  };

  const savePrintForm = (leaveKey, formData) => {
    if (!leaveKey) return;
    try {
      const raw = localStorage.getItem(printSetupStorageKey);
      const all = raw ? JSON.parse(raw) : {};
      all[leaveKey] = formData;
      localStorage.setItem(printSetupStorageKey, JSON.stringify(all));
    } catch (e) {
      // Ignore storage errors to avoid blocking printing.
    }
  };
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
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [printTargetLeave, setPrintTargetLeave] = useState(null);
  const [printForm, setPrintForm] = useState(getDefaultPrintForm());

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
    fetchAdminLeaves();
  }, [viewStatus]);

  const fetchAdminLeaves = async () => {
    try {
      setLoading(true);
      const response = await leaveAPI.getAll(viewStatus || undefined);

      const adminLeaves = (response.data || []).filter((leave) => {
        const isAdminPending = leave.approvalStage === 'Admin' && leave.status === 'Pending';
        const isDisapproved = leave.status === 'Disapproved' || leave.status === 'Disapproved';

        if (viewStatus === 'Pending') return isAdminPending;
        if (viewStatus === 'Approved') return leave.status === 'Approved';
        if (viewStatus === 'Disapproved') return isDisapproved;

        return isAdminPending || leave.status === 'Approved' || isDisapproved;
      });

      setLeaves(adminLeaves);
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

  const openPrintSetupModal = (leave) => {
    const leaveKey = getLeaveKey(leave);
    const savedPrintForm = loadSavedPrintForm(leaveKey);

    setPrintTargetLeave(leave);
    setPrintForm(savedPrintForm || getDefaultPrintForm());
    setShowPrintModal(true);
    setError('');
  };

  const updatePrintForm = (updater) => {
    setPrintForm((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      const leaveKey = getLeaveKey(printTargetLeave);
      if (leaveKey) {
        savePrintForm(leaveKey, next);
      }
      return next;
    });
  };

  const handlePrintWithSetup = async () => {
    if (!printTargetLeave) return;

    if (printForm.recommendation === 'For Disapproval' && !printForm.disapprovalRemark.trim()) {
      setError('Disapproval remark is required before printing.');
      return;
    }

    const selectedMunicipalAssessor =
      printForm.municipalAssessor === customAssessorOption
        ? printForm.customMunicipalAssessor.trim()
        : printForm.municipalAssessor;

    if (!selectedMunicipalAssessor) {
      setError('Municipal Assessor is required before printing.');
      return;
    }

    const leaveKey = getLeaveKey(printTargetLeave);
    savePrintForm(leaveKey, {
      ...printForm,
      municipalAssessor: printForm.municipalAssessor,
      customMunicipalAssessor: printForm.customMunicipalAssessor,
    });

    const enrichedLeave = await enrichLeaveWithBalance(printTargetLeave);
    openPrintWindow({
      ...enrichedLeave,
      printRecommendation: printForm.recommendation,
      printRecommendationRemark: printForm.disapprovalRemark.trim(),
      printDisapprovedDueTo: printForm.disapprovedDueTo.trim(),
      municipalAssessor: selectedMunicipalAssessor,
    });

    setShowPrintModal(false);
    setPrintTargetLeave(null);
    setError('');
  };

  if (loading) return <div className="text-center p-8">Loading...</div>;

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
      <h1 className="text-3xl font-bold mb-2">Approve Leave Requests</h1>
      <p className="text-gray-600 mb-6 text-sm">Admin - Final Approval Level - These leaves have been approved by the Head Officer</p>

      {error && <div className="mb-4 p-4 bg-red-100 text-red-700 rounded">{error}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Requests List */}
        <div className="lg:col-span-1">
          {/* Search and Filter Bar */}
          <div className="mb-4 flex flex-col sm:flex-row gap-2 w-full">
            <div className="relative flex-1">
              <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                placeholder="Search leave requests..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <select
              value={filterAttribute}
              onChange={(e) => {
                setFilterAttribute(e.target.value);
                setSearchQuery('');
              }}
              className="w-full sm:w-40 sm:shrink-0 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium bg-white cursor-pointer"
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
                className={`bg-white p-4 rounded shadow cursor-pointer transition ${
                  selectedLeave?.leaveId === leave.leaveId ? 'border-2 border-blue-600' : ''
                }`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-bold">{leave.staffName}</h3>
                    <p className="text-gray-600 text-sm">{leave.leaveType}</p>
                    <p className="text-gray-600 text-sm">
                      {formatDate(leave.startDate)} - {formatDate(leave.endDate)}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded text-sm block">
                      {leave.numberOfDays} days
                    </span>
                    {leave.status === 'Approved' && (
                      <button
                        type="button"
                        onClick={async (e) => { 
                          e.stopPropagation();
                          openPrintSetupModal(leave);
                        }}
                        className="mt-2 w-full bg-gray-700 text-white px-3 py-1 rounded hover:bg-gray-800"
                      >
                        Print
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {filteredLeaves.length === 0 && (
            <div className="text-center p-8 text-gray-600">
              {searchQuery ? 'No leave requests match your search' : 'No leave requests awaiting final admin approval'}
            </div>
          )}
        </div>

        {/* Approval Panel */}
        {selectedLeave && (
          <div className="bg-white p-6 rounded shadow lg:col-span-1">
            <h2 className="text-xl font-bold mb-4">Leave Details</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
              <div>
                <p className="text-gray-600 text-sm">Staff</p>
                <p className="font-bold">{selectedLeave.staffName}</p>
              </div>
              <div>
                <p className="text-gray-600 text-sm">Date Filed</p>
                <p className="font-bold">{formatDate(selectedLeave.filingDate || selectedLeave.createdAt)}</p>
              </div>
              <div>
                <p className="text-gray-600 text-sm">Office/Department</p>
                <p className="font-bold">{selectedLeave.office || selectedLeave.staffDepartment || 'N/A'}</p>
              </div>
              <div>
                <p className="text-gray-600 text-sm">Type</p>
                <p className="font-bold">{selectedLeave.leaveType}</p>
              </div>
              <div>
                <p className="text-gray-600 text-sm">Duration</p>
                <p className="font-bold">
                  {Array.isArray(selectedLeave.dateRanges) && selectedLeave.dateRanges.length > 0
                    ? formatDateRanges(selectedLeave.dateRanges)
                    : `${formatDate(selectedLeave.startDate)} - ${formatDate(selectedLeave.endDate)}`}
                </p>
              </div>
              <div>
                <p className="text-gray-600 text-sm">Days</p>
                <p className="font-bold">{selectedLeave.numberOfDays ?? 'N/A'}</p>
              </div>
              <div>
                <p className="text-gray-600 text-sm">Commutation</p>
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
                <p className="text-gray-600 text-sm font-semibold">Explanation for Late Filing</p>
                <p className="font-bold text-red-600 whitespace-pre-line">{selectedLeave.lateFilingExplanation}</p>
              </div>
            )}
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
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => openPrintSetupModal(selectedLeave)}
                    className="w-full py-2 rounded text-white font-bold bg-blue-600 hover:bg-blue-700"
                  >
                    Print
                  </button>
                </div>
                <button
                  type="button"
                  onClick={handleApprove}
                  className="w-full py-2 rounded text-white font-bold bg-green-600 hover:bg-green-700"
                >
                  Approve
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
                  Approve with Revision
                </button>
              </div>
            </form>
          </div>
        )}
      </div>

      {showDisapproveModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white w-full max-w-md rounded shadow-lg p-6">
            <h3 className="text-lg font-bold mb-3">Disapprove Leave Request</h3>
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
            <h3 className="text-lg font-bold mb-3">Approve with Revision</h3>
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

      {showPrintModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white w-full max-w-lg rounded shadow-lg p-6">
            <h3 className="text-lg font-bold mb-3">Print Setup (7.B Recommendation)</h3>
            <p className="text-sm text-gray-600 mb-4">Please complete this before printing the leave form.</p>

            <div className="space-y-4">
              <div>
                <p className="text-sm font-semibold mb-2">Recommendation</p>
                <label className="flex items-center gap-2 text-sm mb-2">
                  <input
                    type="radio"
                    name="recommendation"
                    checked={printForm.recommendation === 'For Approval'}
                    onChange={() => updatePrintForm((prev) => ({ ...prev, recommendation: 'For Approval' }))}
                  />
                  For Approval
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="recommendation"
                    checked={printForm.recommendation === 'For Disapproval'}
                    onChange={() => updatePrintForm((prev) => ({ ...prev, recommendation: 'For Disapproval' }))}
                  />
                  Disapproval due to
                </label>
              </div>

              {printForm.recommendation === 'For Disapproval' && (
                <div>
                  <label className="block text-sm font-semibold mb-2">Disapproval Remark</label>
                  <textarea
                    value={printForm.disapprovalRemark}
                    onChange={(e) => updatePrintForm((prev) => ({ ...prev, disapprovalRemark: e.target.value }))}
                    rows="3"
                    className="w-full px-4 py-2 border rounded focus:outline-none focus:border-blue-500"
                    placeholder="Reason for disapproval"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-semibold mb-2">7.D Disapproved Due To</label>
                <textarea
                  value={printForm.disapprovedDueTo}
                  onChange={(e) => updatePrintForm((prev) => ({ ...prev, disapprovedDueTo: e.target.value }))}
                  rows="3"
                  className="w-full px-4 py-2 border rounded focus:outline-none focus:border-blue-500"
                  placeholder="Reason to appear in section 7.D"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2">Municipal Assessor</label>
                <select
                  value={printForm.municipalAssessor}
                  onChange={(e) => updatePrintForm((prev) => ({ ...prev, municipalAssessor: e.target.value }))}
                  className="w-full px-4 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  {municipalAssessors.map((assessor) => (
                    <option key={assessor} value={assessor}>{assessor}</option>
                  ))}
                  <option value={customAssessorOption}>Other (type manually)</option>
                </select>
              </div>

              {printForm.municipalAssessor === customAssessorOption && (
                <div>
                  <label className="block text-sm font-semibold mb-2">Custom Municipal Assessor</label>
                  <input
                    type="text"
                    value={printForm.customMunicipalAssessor}
                    onChange={(e) => updatePrintForm((prev) => ({ ...prev, customMunicipalAssessor: e.target.value }))}
                    className="w-full px-4 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter assessor name"
                  />
                </div>
              )}
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowPrintModal(false);
                  setPrintTargetLeave(null);
                }}
                className="px-4 py-2 rounded bg-gray-200"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handlePrintWithSetup}
                className="px-4 py-2 rounded bg-blue-600 text-white"
              >
                Continue to Print
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ApproveLeavesAdmin;
