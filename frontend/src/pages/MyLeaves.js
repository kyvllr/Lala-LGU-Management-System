import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { leaveAPI, leaveRecordAPI } from '../api';
import { exportToCsv } from '../exportCsv';
import { openPrintWindow } from '../components/PrintableLeaveForm';

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

function MyLeaves({ staffId }) {
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
    return <div className="text-center p-8 text-red-600">Please enter your Staff ID in the navigation bar</div>;
  }

  if (loading) return <div className="text-center p-8">Loading...</div>;

  return (
    <div className="mt-6">
      <h1 className="text-3xl font-bold mb-6">My Leave Requests</h1>

      {error && <div className="mb-4 p-4 bg-red-100 text-red-700 rounded">{error}</div>}

      <button
        onClick={handleExportCsv}
        className="mb-4 px-4 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600 transition"
        title="Export CSV"
      >
        Export CSV
      </button>

      <div className="mb-4 flex flex-col sm:flex-row gap-2">
        <input
          type="text"
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
          placeholder="Search leave records..."
          className="w-full sm:flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <select
          value={searchAttribute}
          onChange={(e) => setSearchAttribute(e.target.value)}
          className="w-full sm:w-56 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
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
        <label>
          <input
            type="radio"
            value="Disapproved"
            checked={filterStatus === 'Disapproved'}
            onChange={(e) => setFilterStatus(e.target.value)}
          />
          {' '}Disapproved
        </label>
        <label className="ml-4">
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
          <div key={leave.leaveId} className="bg-white p-6 rounded shadow">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-xl font-bold">{leave.leaveType}</h3>
                <p className="text-gray-600">ID: {leave.leaveId}</p>
              </div>
              <span className={`px-4 py-2 rounded text-white font-bold ${
                leave.status === 'Approved' ? 'bg-green-600' :
                leave.status === 'Disapproved' ? 'bg-red-600' :
                leave.status === 'For Revision' ? 'bg-purple-600' :
                'bg-yellow-600'
              }`}>
                {leave.status}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
              <div>
                <p className="text-gray-600 text-sm">Date Filed</p>
                <p className="font-bold">{formatDate(leave.filingDate || leave.createdAt)}</p>
              </div>
              <div>
                <p className="text-gray-600 text-sm">Office/Department</p>
                <p className="font-bold">{leave.office || leave.staffDepartment || 'N/A'}</p>
              </div>
              <div className="md:col-span-2 lg:col-span-2">
                <p className="text-gray-600 text-sm">Inclusive Date/s</p>
                <p className="font-bold">
                  {Array.isArray(leave.dateRanges) && leave.dateRanges.length > 0
                    ? formatDateRanges(leave.dateRanges)
                    : (leave.startDate && leave.endDate)
                      ? `${formatDate(leave.startDate)} - ${formatDate(leave.endDate)}`
                      : 'N/A'}
                </p>
              </div>
              <div>
                <p className="text-gray-600 text-sm">Days</p>
                <p className="font-bold">{leave.numberOfDays ?? 'N/A'}</p>
              </div>
            </div>

            {leave.status !== 'Pending' && (
              <div className="border-t pt-4">
                <p className="text-gray-600 text-sm">{leave.status === 'For Revision' ? 'Requested By' : 'Approved By'}</p>
                <p className="font-bold">{leave.status === 'For Revision' ? (leave.revisionRequestedBy || 'N/A') : (leave.approvedBy || 'N/A')}</p>
                {leave.lateFilingExplanation && (
                  <>
                    <p className="text-red-600 text-md font-bold mt-2">Explanation for Late Filing</p>
                    <p className="text-sm whitespace-pre-line">{leave.lateFilingExplanation}</p>
                  </>
                )}
                {leave.remarks && (
                  <>
                    <br />
                    <p className="text-red-600 text-lg font-bold mt-2">{leave.status === 'For Revision' ? 'REVISION COMMENT' : 'Remarks'}</p>
                    <p className="text-sm">{leave.remarks}</p>
                  </>
                )}
                <div className="mt-4">
                  <button
                    onClick={async () => {
                      const enrichedLeave = await enrichLeaveWithBalance(leave, staffId);
                      openPrintWindow(enrichedLeave);
                    }}
                    className="mr-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    Print
                  </button>
                </div>
              </div>
            )}

            {leave.status === 'Pending' && (
              <button
                onClick={() => deleteLeave(leave.leaveId)}
                className="mt-4 bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
              >
                Delete Request
              </button>
            )}

            {leave.status === 'For Revision' && (
              <button
                onClick={() => navigate(`/file-leave?edit=${leave.leaveId}`)}
                className="mt-4 bg-amber-600 text-white px-4 py-2 rounded hover:bg-amber-700"
              >
                Edit & Resubmit
              </button>
            )}
          </div>
        ))}
      </div>

      {filteredLeaves.length === 0 && (
        <div className="text-center p-8 text-gray-600">No leave requests found</div>
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
