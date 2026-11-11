
import React, { useState, useEffect } from 'react';
import { leaveAPI, leaveRecordAPI, staffAPI } from '../api';
import { FiSearch } from 'react-icons/fi';
import { openPrintWindow } from '../components/PrintableLeaveForm';
import { normalizeRole, ROLES } from '../constants';

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

    console.log('[enrichLeaveWithBalance] Using records before application:', recordsBeforeApplication.length, 'of', records.length);
    console.log('[enrichLeaveWithBalance] Final balances - VL:', vlBalanceBefore, 'SL:', slBalanceBefore, 'CTO:', ctoBalanceBefore);
    
    // Determine how many days this application uses
    const normalizedLeaveType = String(leave.leaveType || '').toLowerCase();
    const vlDaysThisApp = (
      normalizedLeaveType === 'vacation leave'
      || normalizedLeaveType.includes('vacation')
      || normalizedLeaveType === 'mandatory/force leave'
    ) ? (leave.numberOfDays || 0) : 0;
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
  const authorizedOfficerName = 'WARNIE B. EDREA';
  const customAuthorizedOfficerOption = '__custom_authorized_officer__';
  const customAssessorOption = '__custom_assessor__';
  const printSetupStorageKey = 'leave_print_setup_by_id_v1';
  const getDefaultPrintForm = () => ({
    recommendation: 'For Approval',
    disapprovalRemark: '',
    disapprovedDueTo: '',
    authorizedOfficer: customAuthorizedOfficerOption,
    customAuthorizedOfficer: '',
    municipalAssessor: customAssessorOption,
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
  const [authorizedOfficerOptions, setAuthorizedOfficerOptions] = useState([]);
  const [municipalAssessors, setMunicipalAssessors] = useState([]);

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

  // Move staff list loading to a function so it can be called on demand
  const loadPrintSignatoryOptions = async () => {
    try {
      const response = await staffAPI.getAll();
      const list = Array.isArray(response?.data) ? response.data : [];
      const mappedAuthorizedOfficer = list
        .map((staff) => {
          const role = normalizeRole(staff?.role || staff?.userRole);
          const isAdminRole = role === ROLES.ADMIN_HR;
          const isMayorRole = role === ROLES.SUPER_ADMIN;
          if (!isAdminRole && !isMayorRole) return null;

          const name = String(
            staff?.name ||
            staff?.fullName ||
            [staff?.firstName, staff?.middleName, staff?.lastName].filter(Boolean).join(' ') ||
            ''
          ).trim().toUpperCase();
          if (!name) return null;

          return {
            value: name,
            roleType: isAdminRole ? 'admin' : 'mayor',
            label: `${name} (${isAdminRole ? 'Admin' : 'Mayor'})`,
          };
        })
        .filter(Boolean);

      const mappedHeadOfficer = list
        .map((staff) => {
          const role = normalizeRole(staff?.role || staff?.userRole);
          if (role !== ROLES.HEAD_OFFICER) return null;

          const name = String(
            staff?.name ||
            staff?.fullName ||
            [staff?.firstName, staff?.middleName, staff?.lastName].filter(Boolean).join(' ') ||
            ''
          ).trim().toUpperCase();
          return name || null;
        })
        .filter(Boolean);

      const deduped = [];
      const seen = new Set();
      mappedAuthorizedOfficer.forEach((option) => {
        const key = option.value;
        if (seen.has(key)) return;
        seen.add(key);
        deduped.push(option);
      });

      deduped.sort((a, b) => {
        if (a.roleType !== b.roleType) return a.roleType === 'admin' ? -1 : 1;
        return a.value.localeCompare(b.value);
      });

      setAuthorizedOfficerOptions(deduped);

      const dedupedHeadOfficer = [];
      const seenHeadOfficer = new Set();
      mappedHeadOfficer.forEach((name) => {
        if (seenHeadOfficer.has(name)) return;
        seenHeadOfficer.add(name);
        dedupedHeadOfficer.push(name);
      });
      dedupedHeadOfficer.sort((a, b) => a.localeCompare(b));
      setMunicipalAssessors(dedupedHeadOfficer);
    } catch (err) {
      setAuthorizedOfficerOptions([]);
      setMunicipalAssessors([]);
    }
  };

  // Only load staff list on mount for initial display (optional, can be removed if not needed)
  useEffect(() => {
    loadPrintSignatoryOptions();
  }, []);

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

  const openPrintSetupModal = async (leave) => {
    // Always reload staff list before opening modal for real-time data
    await loadPrintSignatoryOptions();
    const leaveKey = getLeaveKey(leave);
    const savedPrintForm = loadSavedPrintForm(leaveKey);
    const defaultAuthorizedOfficer = authorizedOfficerOptions[0]?.value || customAuthorizedOfficerOption;
    const defaultMunicipalAssessor = municipalAssessors[0] || customAssessorOption;
    const nextPrintForm = savedPrintForm
      ? savedPrintForm
      : {
          ...getDefaultPrintForm(),
          authorizedOfficer: defaultAuthorizedOfficer,
          municipalAssessor: defaultMunicipalAssessor,
        };

    setPrintTargetLeave(leave);
    setPrintForm(nextPrintForm);
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

    const selectedAuthorizedOfficerOption = authorizedOfficerOptions.find(
      (option) => option.value === printForm.authorizedOfficer
    );
    const isCustomAuthorizedOfficer =
      printForm.authorizedOfficer === customAuthorizedOfficerOption || !selectedAuthorizedOfficerOption;
    const selectedAuthorizedOfficerName = isCustomAuthorizedOfficer
      ? printForm.customAuthorizedOfficer.trim().toUpperCase()
      : selectedAuthorizedOfficerOption.value;

    if (!selectedAuthorizedOfficerName) {
      setError('Authorized Officer is required before printing.');
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
      authorizedOfficer: printForm.authorizedOfficer,
      customAuthorizedOfficer: printForm.customAuthorizedOfficer,
      municipalAssessor: printForm.municipalAssessor,
      customMunicipalAssessor: printForm.customMunicipalAssessor,
    });

    const enrichedLeave = await enrichLeaveWithBalance(printTargetLeave);
    openPrintWindow({
      ...enrichedLeave,
      printRecommendation: printForm.recommendation,
      printRecommendationRemark: printForm.disapprovalRemark.trim(),
      printDisapprovedDueTo: printForm.disapprovedDueTo.trim(),
      secondAuthorizedOfficerName: selectedAuthorizedOfficerName,
      secondAuthorizedOfficerRoleType: isCustomAuthorizedOfficer
        ? 'other'
        : selectedAuthorizedOfficerOption.roleType,
      municipalAssessor: selectedMunicipalAssessor,
    });

    setShowPrintModal(false);
    setPrintTargetLeave(null);
    setError('');
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
      <p className="text-blue-700/80 mb-6 text-sm">Admin - Final Approval Level - These leaves have been approved by the Head Officer</p>

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
                    {leave.status === 'Approved' && (
                      <button
                        type="button"
                        onClick={async (e) => { 
                          e.stopPropagation();
                          openPrintSetupModal(leave);
                        }}
                        className="mt-2 w-full bg-slate-600 text-white px-3 py-2.5 sm:py-1 rounded-md hover:bg-slate-700 text-xs font-semibold"
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
                <p className="text-blue-700/80 text-xs uppercase tracking-wide">Commutation</p>
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
                <label htmlFor="leave-approval-remarks" className="block font-bold mb-2">Approval Remarks (Optional)</label>
                <textarea
                  id="leave-approval-remarks"
                  value={approvalData.remarks}
                  onChange={(e) => setApprovalData({...approvalData, remarks: e.target.value})}
                  rows="3"
                  className="w-full px-4 py-2 border border-blue-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-500"
                ></textarea>
              </div>

              <div className="space-y-2">
                <div className="flex flex-col sm:flex-row gap-2">
                  <button
                    type="button"
                    onClick={() => openPrintSetupModal(selectedLeave)}
                    className="w-full py-2.5 sm:py-2 rounded-md text-white text-sm font-semibold bg-blue-500 hover:bg-blue-600"
                  >                    Print
                  </button>
                </div>
                <button
                  type="button"
                  onClick={handleApprove}
                  className="w-full py-2.5 sm:py-2 rounded-md text-white text-sm font-semibold bg-green-500 hover:bg-green-600"
                >
                  Approve
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
                  Approve with Revision
                </button>
              </div>
            </form>
          </div>
        )}
      </div>

      {showDisapproveModal && (
        <div className="fixed inset-0 bg-black/45 backdrop-blur-[1px] flex items-center justify-center z-50 p-4">
          <div role="dialog" aria-modal="true" aria-labelledby="disapprove-leave-title" className="bg-white w-full max-w-md max-h-[90vh] overflow-y-auto rounded-xl border border-blue-100 shadow-2xl p-4 sm:p-6">
            <h3 id="disapprove-leave-title" className="text-lg font-bold mb-3">Disapprove Leave Request</h3>
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
          <div role="dialog" aria-modal="true" aria-labelledby="revision-leave-title" className="bg-white w-full max-w-md max-h-[90vh] overflow-y-auto rounded-xl border border-blue-100 shadow-2xl p-4 sm:p-6">
            <h3 id="revision-leave-title" className="text-lg font-bold mb-3">Approve with Revision</h3>
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

      {showPrintModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4">
          <div role="dialog" aria-modal="true" aria-labelledby="print-setup-leave-title" className="bg-white w-full max-w-lg max-h-[90vh] overflow-y-auto rounded shadow-lg p-4 sm:p-6">
            <h3 id="print-setup-leave-title" className="text-lg font-bold mb-3">Print Setup (7.B Recommendation)</h3>
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
                  <label htmlFor="leave-print-disapproval-remark" className="block text-sm font-semibold mb-2">Disapproval Remark</label>
                  <textarea
                    id="leave-print-disapproval-remark"
                    value={printForm.disapprovalRemark}
                    onChange={(e) => updatePrintForm((prev) => ({ ...prev, disapprovalRemark: e.target.value }))}
                    rows="3"
                    className="w-full px-4 py-2 border rounded focus:outline-none focus:border-blue-500"
                    placeholder="Reason for disapproval"
                  />
                </div>
              )}

              <div>
                <label htmlFor="leave-print-disapproved-due-to" className="block text-sm font-semibold mb-2">7.D Disapproved Due To</label>
                <textarea
                  id="leave-print-disapproved-due-to"
                  value={printForm.disapprovedDueTo}
                  onChange={(e) => updatePrintForm((prev) => ({ ...prev, disapprovedDueTo: e.target.value }))}
                  rows="3"
                  className="w-full px-4 py-2 border rounded focus:outline-none focus:border-blue-500"
                  placeholder="Reason to appear in section 7.D"
                />
              </div>

              <div>
                <label htmlFor="leave-print-authorized-officer" className="block text-sm font-semibold mb-2">Authorized Officer</label>
                <div className="mb-2 text-xs text-gray-500 break-words">
                  First signature is fixed: {authorizedOfficerName}
                </div>
                <select
                  id="leave-print-authorized-officer"
                  value={printForm.authorizedOfficer}
                  onChange={(e) => updatePrintForm((prev) => ({ ...prev, authorizedOfficer: e.target.value }))}
                  className="w-full px-4 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  {authorizedOfficerOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                  <option value={customAuthorizedOfficerOption}>Other (manual input)</option>
                </select>
              </div>

              {printForm.authorizedOfficer === customAuthorizedOfficerOption && (
                <div>
                  <label htmlFor="leave-print-custom-authorized-officer" className="block text-sm font-semibold mb-2">Custom Authorized Officer</label>
                  <input
                    id="leave-print-custom-authorized-officer"
                    type="text"
                    value={printForm.customAuthorizedOfficer}
                    onChange={(e) => updatePrintForm((prev) => ({ ...prev, customAuthorizedOfficer: e.target.value }))}
                    className="w-full px-4 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter authorized officer name"
                  />
                </div>
              )}

              <div>
                <label htmlFor="leave-print-municipal-assessor" className="block text-sm font-semibold mb-2">Municipal Assessor</label>
                <select
                  id="leave-print-municipal-assessor"
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
                  <label htmlFor="leave-print-custom-municipal-assessor" className="block text-sm font-semibold mb-2">Custom Municipal Assessor</label>
                  <input
                    id="leave-print-custom-municipal-assessor"
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
