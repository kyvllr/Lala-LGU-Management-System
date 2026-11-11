import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { leaveAPI, leaveRecordAPI, staffAPI } from '../api';
import { exportToCsv } from '../exportCsv';
import { openPrintWindow } from '../components/PrintableLeaveForm';
import { normalizeRole, ROLES } from '../constants';
// Print Setup Modal logic (reused from ApproveLeavesAdmin)
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
  } catch (e) {}
};

const formatDate = (value) => {
  if (!value) return 'N/A';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? 'N/A' : parsed.toLocaleDateString();
};

// Helper to enrich leave object with staff's leave balance data for printing  
async function enrichLeaveWithBalance(leave, staffId) {
  try {
    if (!staffId) return leave;
    
    const recordsRes = await leaveRecordAPI.getByStaffId(staffId);
    let records = [];
    
    if (recordsRes.data && recordsRes.data.data && Array.isArray(recordsRes.data.data)) {
      records = recordsRes.data.data;
    } else if (recordsRes.data && Array.isArray(recordsRes.data)) {
      records = recordsRes.data;
    }
    
    console.log('[enrichLeaveWithBalance] Fetched', records.length, 'records for staffId:', staffId);
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

function MyLeaves({ staffId }) {
  // Print modal state
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [printTargetLeave, setPrintTargetLeave] = useState(null);
  const [printForm, setPrintForm] = useState(getDefaultPrintForm());
  const [authorizedOfficerOptions, setAuthorizedOfficerOptions] = useState([]);
  const [municipalAssessors, setMunicipalAssessors] = useState([]);
    // Print signatory loader (real-time)
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
    const openPrintSetupModal = async (leave) => {
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
        alert('Disapproval remark is required before printing.');
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
        alert('Authorized Officer is required before printing.');
        return;
      }
      const selectedMunicipalAssessor =
        printForm.municipalAssessor === customAssessorOption
          ? printForm.customMunicipalAssessor.trim()
          : printForm.municipalAssessor;
      if (!selectedMunicipalAssessor) {
        alert('Municipal Assessor is required before printing.');
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
      const enrichedLeave = await enrichLeaveWithBalance(printTargetLeave, staffId);
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
    };
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterStatus, setFilterStatus] = useState(searchParams.get('status') || '');
  const [searchAttribute, setSearchAttribute] = useState('leaveId');
  const [searchValue, setSearchValue] = useState('');

  useEffect(() => {
    // Update filter status when query parameter changes
    const statusParam = searchParams.get('status');
    setFilterStatus(statusParam || '');
  }, [searchParams]);

  useEffect(() => {
    if (staffId) {
      fetchLeaves();
    }
  }, [staffId]);

  const fetchLeaves = async () => {
    try {
      setLoading(true);
      const response = await leaveAPI.getByStaffId(staffId);
      setLeaves(response.data);
    } catch (err) {
      setError('Failed to load leaves');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const deleteLeave = async (id) => {
    if (window.confirm('Are you sure you want to delete this leave request?')) {
      try {
        await leaveAPI.delete(id);
        setLeaves(leaves.filter(l => l.leaveId !== id));
      } catch (err) {
        setError('Failed to delete leave request');
      }
    }
  };

  const filteredLeaves = leaves.filter((leave) => {
    if (filterStatus && leave.status !== filterStatus) {
      return false;
    }

    const query = searchValue.trim().toLowerCase();
    if (!query) {
      return true;
    }

    const inclusiveDates = Array.isArray(leave.dateRanges) && leave.dateRanges.length > 0
      ? formatDateRanges(leave.dateRanges)
      : (leave.startDate && leave.endDate)
        ? `${formatDate(leave.startDate)} - ${formatDate(leave.endDate)}`
        : 'N/A';

    switch (searchAttribute) {
      case 'name':
        return String(leave.staffName || '').toLowerCase().includes(query);
      case 'leaveType':
        return String(leave.leaveType || '').toLowerCase().includes(query);
      case 'dateFiled':
        return formatDate(leave.filingDate || leave.createdAt).toLowerCase().includes(query);
      case 'inclusiveDate':
        return inclusiveDates.toLowerCase().includes(query);
      case 'office':
        return String(leave.office || leave.staffDepartment || '').toLowerCase().includes(query);
      case 'days':
        return String(leave.numberOfDays ?? '').toLowerCase().includes(query);
      case 'leaveId':
      default:
        return String(leave.leaveId || '').toLowerCase().includes(query);
    }
  });

  // CSV Export handler
  const handleExportCsv = () => {
    if (!filteredLeaves.length) return;
    exportToCsv('my_leaves.csv', filteredLeaves);
  };

  if (!staffId) {
    return <div className="text-center p-8 text-red-600 font-medium">Please enter your Item Number in the navigation bar</div>;
  }

  if (loading) return <div className="text-center p-8 text-blue-700 font-medium">Loading...</div>;

  return (
    <div className="mt-6">
      <h1 className="text-3xl font-bold tracking-tight text-blue-950 mb-6">My Leave Requests</h1>

      {error && <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">{error}</div>}

      <button
        onClick={handleExportCsv}
        className="mb-4 px-4 py-2.5 sm:py-2 bg-amber-500 text-white rounded-md hover:bg-amber-600 transition text-sm font-semibold shadow-sm"
        title="Export CSV"
      >
        Export CSV
      </button>

      <div className="mb-4 flex flex-col sm:flex-row gap-2 rounded-lg border border-blue-100 bg-blue-50/60 p-3">
        <input
          type="text"
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
          placeholder="Search leave records..."
          className="w-full sm:flex-1 px-4 py-2 border border-blue-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-500"
        />
        <select
          value={searchAttribute}
          onChange={(e) => setSearchAttribute(e.target.value)}
          className="w-full sm:w-56 px-4 py-2 border border-blue-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-500 bg-white"
        >
          <option value="leaveId">Leave ID</option>
          <option value="name">Name</option>
          <option value="leaveType">Leave Type</option>
          <option value="dateFiled">Date Filed</option>
          <option value="inclusiveDate">Inclusive Date</option>
          <option value="office">Office/Department</option>
          <option value="days">Days</option>
        </select>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-blue-100 bg-blue-50/60 p-3 text-sm text-blue-900">
        <label className="mr-1 inline-flex items-center gap-1.5">
          <input
            type="radio"
            value=""
            checked={filterStatus === ''}
            onChange={(e) => setFilterStatus(e.target.value)}
          />
          {' '}All
        </label>
        <label className="mr-1 inline-flex items-center gap-1.5">
          <input
            type="radio"
            value="Pending"
            checked={filterStatus === 'Pending'}
            onChange={(e) => setFilterStatus(e.target.value)}
          />
          {' '}Pending
        </label>
        <label className="mr-1 inline-flex items-center gap-1.5">
          <input
            type="radio"
            value="Approved"
            checked={filterStatus === 'Approved'}
            onChange={(e) => setFilterStatus(e.target.value)}
          />
          {' '}Approved
        </label>
        <label className="mr-1 inline-flex items-center gap-1.5">
          <input
            type="radio"
            value="Disapproved"
            checked={filterStatus === 'Disapproved'}
            onChange={(e) => setFilterStatus(e.target.value)}
          />
          {' '}Disapproved
        </label>
        <label className="mr-1 inline-flex items-center gap-1.5">
          <input
            type="radio"
            value="For Revision"
            checked={filterStatus === 'For Revision'}
            onChange={(e) => setFilterStatus(e.target.value)}
          />
          {' '}For Revision
        </label>
      </div>

      <div className="space-y-4">
        {filteredLeaves.map((leave) => (
          <div key={leave.leaveId} className="bg-white p-4 sm:p-5 rounded-lg border border-blue-100 shadow-sm">
            <div className="flex flex-wrap justify-between items-start gap-2 mb-4">
              <div>
                <h3 className="text-lg font-bold text-blue-950">{leave.leaveType}</h3>
                <p className="text-blue-700/80 text-sm">ID: {leave.leaveId}</p>
              </div>
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-white text-xs font-semibold ${
                leave.status === 'Approved' ? 'bg-green-600' :
                leave.status === 'Disapproved' ? 'bg-red-600' :
                leave.status === 'For Revision' ? 'bg-orange-500' :
                'bg-yellow-600'
              }`}>
                {leave.status}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
              <div>
                <p className="text-blue-700/80 text-xs uppercase tracking-wide">Date Filed</p>
                <p className="font-semibold text-slate-800">{formatDate(leave.filingDate || leave.createdAt)}</p>
              </div>
              <div>
                <p className="text-blue-700/80 text-xs uppercase tracking-wide">Office/Department</p>
                <p className="font-semibold text-slate-800">{leave.office || leave.staffDepartment || 'N/A'}</p>
              </div>
              <div className="md:col-span-2 lg:col-span-2">
                <p className="text-blue-700/80 text-xs uppercase tracking-wide">Inclusive Date/s</p>
                <p className="font-semibold text-slate-800">
                  {Array.isArray(leave.dateRanges) && leave.dateRanges.length > 0
                    ? formatDateRanges(leave.dateRanges)
                    : (leave.startDate && leave.endDate)
                      ? `${formatDate(leave.startDate)} - ${formatDate(leave.endDate)}`
                      : 'N/A'}
                </p>
              </div>
              <div>
                <p className="text-blue-700/80 text-xs uppercase tracking-wide">Days</p>
                <p className="font-semibold text-slate-800">{leave.numberOfDays ?? 'N/A'}</p>
              </div>
            </div>

            {leave.status !== 'Pending' && (
              <div className="border-t border-blue-100 pt-4">
                <p className="text-blue-700/80 text-xs uppercase tracking-wide">{leave.status === 'For Revision' ? 'Requested By' : 'Approved By'}</p>
                <p className="font-semibold text-slate-800">{leave.status === 'For Revision' ? (leave.revisionRequestedBy || 'N/A') : (leave.approvedBy || 'N/A')}</p>
                {leave.lateFilingExplanation && (
                  <>
                    <p className="text-red-600 text-sm font-semibold mt-2">Explanation for Late Filing</p>
                    <p className="text-sm whitespace-pre-line">{leave.lateFilingExplanation}</p>
                  </>
                )}
                {leave.remarks && (
                  <>
                    <br />
                    <p className="text-red-600 text-sm font-semibold mt-2">{leave.status === 'For Revision' ? 'REVISION COMMENT' : 'Remarks'}</p>
                    <p className="text-sm">{leave.remarks}</p>
                  </>
                )}
                <div className="mt-4">
                  <button
                    onClick={() => openPrintSetupModal(leave)}
                    className="mr-2 mb-2 px-4 py-2.5 sm:py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 text-sm font-semibold"
                  >
                    Print
                  </button>
                </div>
                    {/* Print Setup Modal */}
                    {showPrintModal && (
                      <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4">
                        <div role="dialog" aria-modal="true" aria-labelledby="print-setup-title" className="bg-white w-full max-w-lg max-h-[90vh] overflow-y-auto rounded shadow-lg p-4 sm:p-6">
                          <h3 id="print-setup-title" className="text-lg font-bold mb-3">Print Setup (7.B Recommendation)</h3>
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
                              <label className="block text-sm font-semibold mb-2">Authorized Officer</label>
                              <div className="mb-2 text-xs text-gray-500">
                                First signature is fixed: {authorizedOfficerName}
                              </div>
                              <select
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
                                <label className="block text-sm font-semibold mb-2">Custom Authorized Officer</label>
                                <input
                                  type="text"
                                  value={printForm.customAuthorizedOfficer}
                                  onChange={(e) => updatePrintForm((prev) => ({ ...prev, customAuthorizedOfficer: e.target.value }))}
                                  className="w-full px-4 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                                  placeholder="Enter authorized officer name"
                                />
                              </div>
                            )}
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
                          <div className="mt-5 flex flex-wrap justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setShowPrintModal(false);
                                setPrintTargetLeave(null);
                              }}
                              className="px-4 py-2.5 sm:py-2 rounded bg-gray-200"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={handlePrintWithSetup}
                              className="px-4 py-2.5 sm:py-2 rounded bg-blue-600 text-white"
                            >
                              Continue to Print
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
              </div>
            )}

            {leave.status === 'Pending' && (
              <button
                onClick={() => deleteLeave(leave.leaveId)}
                className="mt-4 bg-red-500 text-white px-4 py-2.5 sm:py-2 rounded-md hover:bg-red-600 text-sm font-semibold"
              >
                Delete Request
              </button>
            )}

            {leave.status === 'For Revision' && (
              <button
                onClick={() => navigate(`/file-leave?edit=${leave.leaveId}`)}
                className="mt-4 bg-orange-500 text-white px-4 py-2.5 sm:py-2 rounded-md hover:bg-orange-600 text-sm font-semibold"
              >
                Edit & Resubmit
              </button>
            )}
          </div>
        ))}
      </div>

      {filteredLeaves.length === 0 && (
        <div className="text-center p-8 text-blue-700 bg-blue-50 border border-blue-100 rounded-lg">No leave requests found</div>
      )}
    </div>
  );
}

export default MyLeaves;

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
