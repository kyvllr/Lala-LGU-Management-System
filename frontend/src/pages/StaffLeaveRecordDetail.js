
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { TbArrowLeft, TbCalculator, TbEdit, TbTrash } from 'react-icons/tb';
import { staffAPI, leaveRecordAPI } from '../api';
import { isDepartmentStaffManager, normalizeRole } from '../constants';
import { exportToCsv, importFromCsv } from '../exportCsv';
import LEAVE_TYPE_OPTIONS from '../leaveTypes';

// ...existing code...

// Helper to format date ranges as '2/11-14/2026', '3/2,3/2026', '4/4/2026'
function formatDateRanges(dateRanges) {
  if (!Array.isArray(dateRanges) || dateRanges.length === 0) return 'N/A';
  // Collect all dates as {month, day, year}
  let allDates = [];
  dateRanges.forEach(range => {
    if (range.from && range.to) {
      let start = new Date(range.from);
      let end = new Date(range.to);
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        allDates.push({
          month: d.getMonth() + 1,
          day: d.getDate(),
          year: d.getFullYear(),
        });
      }
    }
  });
  if (allDates.length === 0) return 'N/A';
  // Group by year and month
  const groups = {};
  allDates.forEach(({ month, day, year }) => {
    const key = `${month}/${year}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(day);
  });
  // If only one group, show as 2/3-5,10,12-13/2026
  const groupKeys = Object.keys(groups);
  if (groupKeys.length === 1) {
    const [monthYear] = groupKeys;
    const [month, year] = monthYear.split('/');
    const days = groups[monthYear].sort((a, b) => a - b);
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
    return `${month}/${ranges.join(',')}/${year}`;
  }
  // If multiple groups, show as 2/3-5,10,12-13/2026; 3/2-4/2026
  const result = Object.entries(groups).map(([key, days]) => {
    const [month, year] = key.split('/');
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
    return `${month}/${ranges.join(',')}/${year}`;
  });
  return result.join('; ');
}

function formatDateValue(dateValue) {
  if (!dateValue) return 'N/A';
  const parsed = new Date(dateValue);
  return isNaN(parsed.getTime()) ? 'N/A' : parsed.toLocaleDateString();
}

// Helper to format date for HTML date input (YYYY-MM-DD format)
function formatDateForInput(dateValue) {
  if (!dateValue) return '';
  const parsed = new Date(dateValue);
  if (isNaN(parsed.getTime())) return '';
  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, '0');
  const day = String(parsed.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getRecordFromTo(record) {
  if (Array.isArray(record?.dateRanges) && record.dateRanges.length > 0) {
    const ranges = record.dateRanges
      .map(range => ({
        from: range?.from ? new Date(range.from) : null,
        to: range?.to ? new Date(range.to) : null,
      }))
      .filter(range => range.from && range.to && !isNaN(range.from.getTime()) && !isNaN(range.to.getTime()));

    if (ranges.length > 0) {
      const fromDate = new Date(Math.min(...ranges.map(range => range.from.getTime())));
      const toDate = new Date(Math.max(...ranges.map(range => range.to.getTime())));
      return {
        from: fromDate.toLocaleDateString(),
        to: toDate.toLocaleDateString(),
      };
    }
  }

  if (record?.period) {
    const periodDate = formatDateValue(record.period);
    return { from: periodDate, to: periodDate };
  }

  return { from: 'N/A', to: 'N/A' };
}

function getRecordNumberOfDays(record) {
  const savedDays = Number(record?.numberOfDays);
  if (Number.isFinite(savedDays) && savedDays > 0) return savedDays;

  const balanceUsage =
    (Number(record?.vlAbsentUndertimeWPay) || 0) +
    (Number(record?.slAbsentUndertimeWPay) || 0);
  if (balanceUsage > 0) return balanceUsage;

  if (!Array.isArray(record?.dateRanges)) return 0;
  return record.dateRanges.reduce((total, range) => {
    if (!range?.from || !range?.to) return total;
    const from = new Date(range.from);
    const to = new Date(range.to);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return total;

    const fromDay = Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate());
    const toDay = Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate());
    return toDay >= fromDay ? total + (toDay - fromDay) / 86400000 + 1 : total;
  }, 0);
}

function StaffLeaveRecordDetail() {
  const [importing, setImporting] = useState(false);
  const [importSuccess, setImportSuccess] = useState(false);
  const hasNavigatedRef = useRef(false);
  const { staffId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState(null);
  const [staff, setStaff] = useState(null);
  const [actualStaffId, setActualStaffId] = useState(null);
  const [leaveRecords, setLeaveRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [addError, setAddError] = useState('');
  const [leaveBalance, setLeaveBalance] = useState({
    vacationLeaveBalance: 0,
    sickLeaveBalance: 0,
    vacationLeaveAbsent: 0,
    sickLeaveAbsent: 0,
    vacationLeaveEarned: 0,
    sickLeaveEarned: 0,
    totalDaysUsed: 0,
  });
  const [showAddForm, setShowAddForm] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const summaryRef = React.useRef();
  const [conversionUnit, setConversionUnit] = useState('days');
  const [showConverter, setShowConverter] = useState(false);
  const [convertedCellMap, setConvertedCellMap] = useState({});

  // Print handler for leave summary
  const handlePrintSummary = () => {
    if (!summaryRef.current || !staff) {
      alert('Staff information is not loaded yet. Please wait and try again.');
      return;
    }
    // Robustly access name fields (support both camelCase and snake_case just in case)
    let lastName = staff.lastName || staff.lastname || '';
    let firstName = staff.firstName || staff.firstname || '';
    let middleName = staff.middleName || staff.middlename || '';
    // If any name part is missing, try to split from staff.name
    if ((!lastName || !firstName) && staff.name) {
      const nameParts = staff.name.trim().split(/\s+/);
      if (nameParts.length === 2) {
        [firstName, lastName] = nameParts;
      } else if (nameParts.length === 3) {
        [firstName, middleName, lastName] = nameParts;
      } else if (nameParts.length > 3) {
        firstName = nameParts[0];
        middleName = nameParts.slice(1, -1).join(' ');
        lastName = nameParts[nameParts.length - 1];
      }
    }
    const middleInitial = middleName ? middleName.charAt(0).toUpperCase() + '.' : '';
    const division = staff.division || staff.department || staff.office || '';
    const firstDayOfService = staff.firstDayOfService || staff.first_day_of_service || staff.dateHired || '';
    const logoUrl = `${window.location.origin}/logo.PNG`;
    const bagongPilipinasUrl = `${window.location.origin}/Bagong%20Pilipinas.png`;
    const printContents = summaryRef.current.innerHTML;
    // Prepare table with 26 rows (fill with blanks if needed)
    let tableHtml = summaryRef.current.innerHTML;
    try {
      // Only modify if table exists
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = tableHtml;
      const table = tempDiv.querySelector('table');
      if (table) {
        const tbody = table.querySelector('tbody');
        if (tbody) {
          // Remove TOTAL row if present (last row with 'TOTAL:' in first/second cell)
          const rows = Array.from(tbody.querySelectorAll('tr'));
          const lastRow = rows[rows.length - 1];
          if (lastRow) {
            const firstCell = lastRow.cells[0]?.textContent?.trim().toUpperCase();
            const secondCell = lastRow.cells[1]?.textContent?.trim().toUpperCase();
            if ((firstCell === 'TOTAL:' || secondCell === 'TOTAL:')) {
              tbody.removeChild(lastRow);
            }
          }
          // Add blank rows to reach 26
          const currentRows = tbody.querySelectorAll('tr').length;
          const rowsToAdd = 26 - currentRows;
          for (let i = 0; i < rowsToAdd; i++) {
            const tr = document.createElement('tr');
            for (let j = 0; j < 9; j++) {
              const td = document.createElement('td');
              td.className = 'px-4 py-2 border';
              td.innerHTML = '&nbsp;';
              tr.appendChild(td);
            }
            tbody.appendChild(tr);
          }
        }
        // The print window does not load Tailwind classes, so strip interactive controls explicitly.
        tempDiv.querySelectorAll('button').forEach((button) => button.remove());
        tableHtml = tempDiv.innerHTML;
      }
    } catch (e) { /* fallback: do nothing */ }
    const printWindow = window.open('', '', 'height=1200,width=900');
    printWindow.document.write(`
      <html>
        <head>
          <title>Employee's Leave Record</title>
          <style>
            @page { size: 8.5in 13in; margin: 0.7in; }
            body { font-family: Arial, sans-serif; margin: 0.7in; }
            .print-brand-header {
              display: grid;
              grid-template-columns: 1fr 2fr 1fr;
              align-items: center;
              gap: 12px;
              margin-bottom: 18px;
            }
            .print-brand-logo {
              width: 76px;
              height: 76px;
              object-fit: contain;
              justify-self: center;
              transform: translateY(-12px);
            }
            .print-header { text-align: center; font-size: 22px; font-weight: bold; }
            .print-meta-header {
              display: flex;
              justify-content: space-between;
              margin-bottom: 45px;
              width: 100%;
            }
            .print-meta-item {
              display: flex;
              flex-direction: column;
              align-items: center;
              min-width: 200px;
              flex: 1;
            }
            .print-meta-underline {
              border-bottom: 1.5px solid #000;
              min-width: 200px;
              font-size: 15px;
              text-align: center;
              padding-bottom: 2px;
              margin-bottom: 2px;
            }
            .print-meta-label {
              font-size: 13px;
              margin-top: 2px;
              text-align: center;
            }
            .print-table { border-collapse: collapse; width: 100%; }
            .print-table th, .print-table td { border: 1px solid #000; padding: 4px 6px; font-size: 11px; }
            .print-table th { background: #f0f0f0; font-weight: bold; }
            .print-table tfoot td { font-weight: bold; background: #f9f9f9; }
          </style>
        </head>
        <body>
          <div class="print-brand-header">
            <img class="print-brand-logo" src="${logoUrl}" alt="Municipality of Lala seal">
            <div class="print-header">EMPLOYEE'S LEAVE RECORD</div>
            <img class="print-brand-logo" src="${bagongPilipinasUrl}" alt="Bagong Pilipinas">
          </div>
          <div class="print-meta-header">
            <div class="print-meta-item">
              <div class="print-meta-underline">
                ${[lastName, firstName, middleInitial].filter(Boolean).join(' ')}
              </div>
              <div class="print-meta-label">(Surname) (Given Name) (M.I.)</div>
            </div>
            <div class="print-meta-item">
              <div class="print-meta-underline">${division}</div>
              <div class="print-meta-label">Division/Office</div>
            </div>
            <div class="print-meta-item">
              <div class="print-meta-underline">${firstDayOfService ? new Date(firstDayOfService).toLocaleDateString() : ''}</div>
              <div class="print-meta-label">First Day of Service</div>
            </div>
          </div>
          ${tableHtml}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    Promise.all(Array.from(printWindow.document.images, (image) => {
      if (image.complete) return Promise.resolve();
      return new Promise((resolve) => {
        image.addEventListener('load', resolve, { once: true });
        image.addEventListener('error', resolve, { once: true });
      });
    })).then(() => {
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
      }, 100);
    });
  };

  // Conversion helpers: values are stored in days. Convert for display.
  const convertValue = (days, unit) => {
    const n = Number(days) || 0;
    switch (unit) {
      case 'months':
        return n / 30;
      case 'weeks':
        return n / 7;
      case 'minutes':
        return n * 24 * 60;
      case 'days':
      default:
        return n;
    }
  };

  const formatAmount = (value, minimumFractionDigits = 2) => {
    const number = Number(value);
    if (!Number.isFinite(number)) return '';
    return number.toLocaleString('en-US', {
      minimumFractionDigits,
      maximumFractionDigits: 6,
      useGrouping: false,
    });
  };

  const formatConverted = (days, unit) => {
    const converted = convertValue(days, unit);
    if (isNaN(converted) || converted === 0) return '';
    return formatAmount(converted);
  };

  const formatConvertedAllowZero = (days, unit) => {
    const converted = convertValue(days, unit);
    if (isNaN(converted)) return '';
    return formatAmount(converted);
  };

  const formatBalance = (days, unit) => {
    const converted = convertValue(days, unit);
    return Number.isFinite(converted) ? converted.toFixed(4) : '';
  };

  const formatUndertimeMinutes = (days) => {
    const value = Number(days) || 0;
    if (value === 0) return '';
    return formatAmount(value * 24 * 60);
  };

  const formatRecordLeaveAmount = (value, particulars) => {
    const amount = Number(value) || 0;
    if (amount === 0) return '0.00';
    const formattedAmount = formatAmount(amount);
    return isTardyOrUndertimeParticulars(particulars)
      ? `${formattedAmount} (${formatUndertimeMinutes(amount)} min)`
      : formattedAmount;
  };

  const isTardyOrUndertimeParticulars = (particulars) => {
    const normalized = String(particulars || '').toLowerCase();
    return normalized.includes('undertime') || normalized.includes('tardy');
  };

  const toggleCellConversion = (cellKey) => {
    setConvertedCellMap((prev) => ({
      ...prev,
      [cellKey]: !prev[cellKey],
    }));
  };
  const [activeTab, setActiveTab] = useState('records');
  const [editingRecordId, setEditingRecordId] = useState(null);
  const [newRecordData, setNewRecordData] = useState({
    period: '',
    particulars: '',
    vlEarned: '0',
    vlAbsentUndertimeWPay: '0',
    slEarned: '0',
    slAbsentUndertimeWPay: '0',
    cto: '',
  });
  const [editRecordData, setEditRecordData] = useState({
    period: '',
    particulars: '',
    vlEarned: '0',
    vlAbsentUndertimeWPay: '0',
    slEarned: '0',
    slAbsentUndertimeWPay: '0',
    cto: '',
  });
  const [formData, setFormData] = useState({
    period: '',
    particulars: '',
    vlEarned: '0',
    vlAbsentUndertimeWPay: '',
    slEarned: '0',
    slAbsentUndertimeWPay: '',
    cto: '',
  });
  // Add to state: newRecordDateRanges for add form, editRecordDateRanges for edit form
  const [newRecordDateRanges, setNewRecordDateRanges] = useState([{ from: '', to: '' }]);
  const [editRecordDateRanges, setEditRecordDateRanges] = useState([{ from: '', to: '' }]);

  const staffName = location.state?.staffName || '';

  const showSuccessMessage = (message) => {
    setSuccessMessage(message);
    setTimeout(() => {
      setSuccessMessage('');
    }, 3000);
  };

  useEffect(() => {
    const storedUser = JSON.parse(localStorage.getItem('user'));
    setUser(storedUser ? { ...storedUser, role: normalizeRole(storedUser.role) } : storedUser);
    
    // Check if user is trying to access someone else's record (non-admin)
    const normalizedRole = normalizeRole(storedUser?.role);
    const ownStaffId = storedUser?.staffId || storedUser?.id;
    const ownStaffIdStr = ownStaffId ? String(ownStaffId) : '';
    const routeStaffIdStr = staffId ? String(staffId) : '';
    const targetPath = ownStaffIdStr ? `/employee-leave-record/${ownStaffIdStr}` : '';
    const isAlreadyOnTargetPath = !!targetPath && location.pathname === targetPath;
    
    if (
      !isDepartmentStaffManager(normalizedRole) &&
      ownStaffIdStr &&
      ownStaffIdStr !== routeStaffIdStr &&
      !isAlreadyOnTargetPath &&
      !hasNavigatedRef.current
    ) {
      hasNavigatedRef.current = true;
      navigate(targetPath, { replace: true, state: { staffName: storedUser?.name } });
      return;
    }
    
    fetchData();
  }, [staffId, navigate, location.pathname]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(''); // Clear any previous errors
      const storedUser = JSON.parse(localStorage.getItem('user'));
      console.log('[fetchData] Starting fetch - URL staffId param:', staffId);

      // Fetch staff data - use stored user data if available to avoid API issues
      let staffData = null;
      let actualStaffId = staffId; // Default to URL param - this is the safest choice
      
      if (storedUser.staffId === staffId) {
        // If viewing own record, use stored user data
        staffData = storedUser;
        actualStaffId = storedUser.staffId;
        console.log('[fetchData] Using stored user - actualStaffId:', actualStaffId);
      } else {
        // Admin fetching another staff's record
        try {
          console.log('[fetchData] Fetching staff data for URL param:', staffId);
          const staffRes = await staffAPI.getById(staffId);
          staffData = staffRes.data;
          console.log('[fetchData] Staff data received:', JSON.stringify(staffData));
          
          // The URL param IS the Item Number (it's passed as staff.id from EmployeeLeaveRecord)
          // So we can use it directly
          actualStaffId = staffId;
          console.log('[fetchData] Using URL param as actualStaffId:', actualStaffId);
        } catch (apiErr) {
          console.error('[fetchData] API Error fetching staff - will use URL param:', apiErr);
          // Use URL param as fallback - it should be the correct staff.id
          actualStaffId = staffId;
          staffData = { name: 'Staff Member', position: 'N/A', department: 'N/A' };
        }
      }
      
      setStaff(staffData);
      setActualStaffId(actualStaffId);
      console.log('[fetchData] Set actualStaffId state:', actualStaffId);

      // Fetch leave records from API (MongoDB only) using the correct staffId
      try {
        console.log('[fetchData] Fetching leave records for actualStaffId:', actualStaffId);
        const recordsRes = await leaveRecordAPI.getByStaffId(actualStaffId);
        console.log('[fetchData] API response object:', recordsRes);
        console.log('[fetchData] API response.data:', recordsRes.data);
        // Backend returns { data: records }
        // axios wraps it as response.data = { data: records }
        // So we need recordsRes.data.data
        let records = [];
        if (recordsRes.data && recordsRes.data.data && Array.isArray(recordsRes.data.data)) {
          // Response structure: { data: {..., data: records} }
          records = recordsRes.data.data;
          console.log('[fetchData] Extracted records from .data.data');
        } else if (recordsRes.data && Array.isArray(recordsRes.data)) {
          // Response structure: { records }
          records = recordsRes.data;
          console.log('[fetchData] Extracted records from .data');
        } else if (Array.isArray(recordsRes)) {
          // Direct array response
          records = recordsRes;
          console.log('[fetchData] Got direct array response');
        } else {
          console.warn('[fetchData] Unexpected response structure:', typeof recordsRes.data, recordsRes.data);
          records = [];
        }
        // Sort by earliest date in dateRanges or period
        records = [...records].sort((a, b) => {
          const getEarliest = (rec) => {
            if (Array.isArray(rec.dateRanges) && rec.dateRanges.length > 0) {
              return Math.min(...rec.dateRanges.map(r => new Date(r.from).getTime()));
            }
            return rec.period ? new Date(rec.period).getTime() : 0;
          };
          const aEarliest = getEarliest(a);
          const bEarliest = getEarliest(b);
          if (aEarliest !== bEarliest) return aEarliest - bEarliest;
          // fallback: createdAt
          const createdA = a?.createdAt ? new Date(a.createdAt).getTime() : 0;
          const createdB = b?.createdAt ? new Date(b.createdAt).getTime() : 0;
          return createdA - createdB;
        });
        console.log('[fetchData] Leave records count:', records.length);
        console.log('[fetchData] Records:', JSON.stringify(records, null, 2));
        if (records.length > 0) {
          console.log('[fetchData] First record:', records[0]);
          console.log('[fetchData] First record staffId:', records[0].staffId);
        }
        setLeaveRecords(records);
        // Calculate leave balance
        calculateLeaveBalance(records);
      } catch (apiErr) {
        console.error('[fetchData] Error fetching leave records:', apiErr);
        console.error('[fetchData] Error details:', apiErr.response?.data || apiErr.message);
        setError('Failed to load leave records from database. Please ensure MongoDB is running.');
        setLeaveRecords([]);
        calculateLeaveBalance([]);
      }
    } catch (err) {
      console.error('Error in fetchData:', err);
      setError('Failed to load staff leave record. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const calculateLeaveBalance = (records) => {
    try {
      // Ensure records is an array
      if (!records || !Array.isArray(records)) {
        console.warn('[calculateLeaveBalance] Records is not an array:', records);
        records = [];
      }

      // Start with initial balances: 0 days
      let vlBalance = 0;
      let slBalance = 0;
      let vlAbsent = 0;
      let slAbsent = 0;
      let vlEarned = 0;
      let slEarned = 0;
      let vlBalanceDeduction = 0;
      let totalDaysUsed = 0;

      // Only VL, SL, Undertime, Tardy, and Earned Leave affect balances
      records.forEach(record => {
        const particulars = String(record.particulars || '').toLowerCase();
        const vacationLeaveDeduction = ['mandatory/force leave', 'monetization', 'wellness'].includes(particulars)
          ? parseFloat(record.vlAbsentUndertimeWPay) || parseFloat(record.numberOfDays) || 0
          : parseFloat(record.vlAbsentUndertimeWPay) || 0;

        // Count all non-earned approved leave usages (including Wellness) in the summary card.
        if (!particulars.includes('earned leave')) {
          if (particulars.includes('undertime') || particulars.includes('tardy')) {
            totalDaysUsed +=
              (parseFloat(record.vlAbsentUndertimeWPay) || 0) +
              (parseFloat(record.slAbsentUndertimeWPay) || 0);
          } else if (Number(record.numberOfDays) > 0) {
            const explicitDays = parseFloat(record.numberOfDays);
            totalDaysUsed += explicitDays;
          } else {
            const inferredDays =
              (parseFloat(record.vlAbsentUndertimeWPay) || 0) +
              (parseFloat(record.slAbsentUndertimeWPay) || 0);
            totalDaysUsed += inferredDays;
          }
        }

        // Vacation Leave balance
        if (
          particulars.includes('vacation leave') ||
          particulars.includes('wellness') ||
          particulars === 'vl' ||
          particulars === 'mandatory/force leave' ||
          particulars === 'monetization' ||
          particulars === 'wellness' ||
          particulars.includes('earned leave')
        ) {
          vlEarned += parseFloat(record.vlEarned) || 0;
          const vlAbsentForRecord = vacationLeaveDeduction;
          vlAbsent += vlAbsentForRecord;
          vlBalanceDeduction += vlAbsentForRecord;
        } else if (particulars.includes('undertime') || particulars.includes('tardy')) {
          // Only count undertime/tardy for VL if not SL
          const vlAbsentForRecord = parseFloat(record.vlAbsentUndertimeWPay) || 0;
          vlAbsent += vlAbsentForRecord;
          vlBalanceDeduction += vlAbsentForRecord;
        }
        // Sick Leave balance
        if (
          particulars.includes('sick leave') ||
          particulars === 'sl' ||
          particulars.includes('earned leave')
        ) {
          slEarned += parseFloat(record.slEarned) || 0;
          slAbsent += parseFloat(record.slAbsentUndertimeWPay) || 0;
        } else if (particulars.includes('undertime') || particulars.includes('tardy')) {
          // Only count undertime/tardy for SL if not VL
          slAbsent += parseFloat(record.slAbsentUndertimeWPay) || 0;
        }
      });

      // Balance = Earned - Absent
      vlBalance = vlEarned - vlBalanceDeduction;
      slBalance = slEarned - slAbsent;

      setLeaveBalance({
        vacationLeaveBalance: Math.max(0, vlBalance),
        sickLeaveBalance: Math.max(0, slBalance),
        vacationLeaveAbsent: vlAbsent,
        sickLeaveAbsent: slAbsent,
        vacationLeaveEarned: vlEarned,
        sickLeaveEarned: slEarned,
        totalDaysUsed,
      });
    } catch (err) {
      console.error('[calculateLeaveBalance] Error:', err);
    }
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleAddRecord = async (e) => {
    e.preventDefault();
    setAddError('');
    console.log('[handleAddRecord] Started - staffId:', staffId);

    if (!user || !isDepartmentStaffManager(user.role)) {
      setAddError('Only admins can add leave records');
      console.error('[handleAddRecord] User is not admin');
      return;
    }

    if (!formData.particulars) {
      setAddError('Particulars are required');
      console.error('[handleAddRecord] Missing particulars');
      return;
    }

    // Validate date ranges
    if (!newRecordDateRanges.length || !newRecordDateRanges.every(r => r.from && r.to)) {
      setAddError('All date ranges must have both from and to dates.');
      return;
    }

    // Use the correct staffId from staff data
    const actualStaffId = staff?.id || staff?.staffId || staffId;
    console.log('[handleAddRecord] Using actualStaffId:', actualStaffId);

    try {
      // Add new record via API
      const response = await leaveRecordAPI.create({
        staffId: actualStaffId,
        staffName: staff?.name || 'N/A',
        dateRanges: newRecordDateRanges,
        period: '', // legacy, not used
        particulars: formData.particulars,
        numberOfDays: getRecordNumberOfDays({
          dateRanges: newRecordDateRanges,
          vlAbsentUndertimeWPay: formData.vlAbsentUndertimeWPay,
          slAbsentUndertimeWPay: formData.slAbsentUndertimeWPay,
        }),
        vlEarned: parseFloat(formData.vlEarned) || 0,
        vlAbsentUndertimeWPay: parseFloat(formData.vlAbsentUndertimeWPay) || 0,
        slEarned: parseFloat(formData.slEarned) || 0,
        slAbsentUndertimeWPay: parseFloat(formData.slAbsentUndertimeWPay) || 0,
        cto: formData.cto || '',
      });
      console.log('[handleAddRecord] Leave record created:', response.data);

      // Refresh from API to get the complete record with all fields
      console.log('[handleAddRecord] Fetching fresh data from API...');
      await fetchData();
      console.log('[handleAddRecord] API fetch completed');

      showSuccessMessage('Leave record added successfully');

      setShowAddForm(false);
      setEditingRecordId(null);
      setFormData({
        period: '',
        particulars: '',
        vlEarned: '0',
        vlAbsentUndertimeWPay: '0',
        slEarned: '0',
        slAbsentUndertimeWPay: '0',
        cto: '',
      });
      setNewRecordDateRanges([{ from: '', to: '' }]);
    } catch (err) {
      console.error('Error saving record:', err);
      const errorMsg = err.response?.data?.message || 'Failed to save leave record. Please try again.';
      setAddError(errorMsg);
    }
  };

  const handleDeleteLeave = async (recordId) => {
    if (!user || !isDepartmentStaffManager(user.role)) {
      alert('Only admins can delete leave records');
      return;
    }

    if (window.confirm('Are you sure you want to delete this leave record?')) {
      try {
        // Delete from API
        const deletingRecord = leaveRecords.find(r => r.recordId === recordId || r.id === recordId);
        if (!deletingRecord) {
          alert('Record not found');
          return;
        }

        const recordToDelete = deletingRecord.recordId || deletingRecord.id;
        console.log('Deleting record with ID:', recordToDelete);
        
        await leaveRecordAPI.delete(recordToDelete);

        // Refresh records
        await fetchData();
        showSuccessMessage('Leave record deleted successfully');
      } catch (err) {
        console.error('Error deleting record:', err);
        const errorMessage = err.response?.data?.message || 'Failed to delete leave record. Please try again.';
        alert(errorMessage);
      }
    }
  };

  const handleEditLeave = (record) => {
    // Set form data for edit modal
    setEditRecordData({
      period: '', // legacy, not used
      particulars: record.particulars,
      vlEarned: record.vlEarned.toString(),
      vlAbsentUndertimeWPay: record.vlAbsentUndertimeWPay.toString(),
      slEarned: record.slEarned.toString(),
      slAbsentUndertimeWPay: record.slAbsentUndertimeWPay.toString(),
      cto: record.cto || '',
    });
    setEditRecordDateRanges(record.dateRanges && Array.isArray(record.dateRanges) && record.dateRanges.length > 0
      ? record.dateRanges.map(r => ({ 
          from: formatDateForInput(r.from), 
          to: formatDateForInput(r.to) 
        }))
      : [{ from: '', to: '' }]);
    setEditingRecordId(record.recordId || record.id);
    setShowEditModal(true);
  };

  const handleNewRecordChange = (e) => {
    const { name, value } = e.target;
    setNewRecordData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSaveNewRecord = async () => {
    if (!newRecordDateRanges.length || !newRecordDateRanges.every(r => r.from && r.to)) {
      alert('All date ranges must have both from and to dates.');
      return;
    }
    if (!newRecordData.particulars) {
      alert('Particulars are required');
      return;
    }

    try {
      console.log('[handleSaveNewRecord] Using actualStaffId:', actualStaffId);
      console.log('[handleSaveNewRecord] Staff data:', staff);
      if (!actualStaffId) {
        alert('Item Number not found. Please reload the page.');
        return;
      }
      await leaveRecordAPI.create({
        staffId: actualStaffId,
        staffName: staff?.name || 'N/A',
        dateRanges: newRecordDateRanges,
        period: '', // legacy, not used
        particulars: newRecordData.particulars,
        numberOfDays: getRecordNumberOfDays({
          dateRanges: newRecordDateRanges,
          vlAbsentUndertimeWPay: newRecordData.vlAbsentUndertimeWPay,
          slAbsentUndertimeWPay: newRecordData.slAbsentUndertimeWPay,
        }),
        vlEarned: parseFloat(newRecordData.vlEarned) || 0,
        vlAbsentUndertimeWPay: parseFloat(newRecordData.vlAbsentUndertimeWPay) || 0,
        slEarned: parseFloat(newRecordData.slEarned) || 0,
        slAbsentUndertimeWPay: parseFloat(newRecordData.slAbsentUndertimeWPay) || 0,
        cto: newRecordData.cto || '',
      });
      console.log('[handleSaveNewRecord] Record saved, calling fetchData...');
      await fetchData();
      console.log('[handleSaveNewRecord] fetchData completed');
      setShowAddForm(false);
      setNewRecordData({
        period: '',
        particulars: '',
        vlEarned: '0',
        vlAbsentUndertimeWPay: '0',
        slEarned: '0',
        slAbsentUndertimeWPay: '0',
        cto: '',
      });
      setNewRecordDateRanges([{ from: '', to: '' }]);
      showSuccessMessage('Leave record added successfully');
    } catch (err) {
      console.error('Error saving record:', err);
      alert('Failed to save leave record');
    }
  };

  const handleEditRecordChange = (e) => {
    const { name, value } = e.target;
    setEditRecordData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSaveEditRecord = async () => {
    if (!editRecordData.particulars) {
      alert('Particulars are required');
      return;
    }
    if (!editRecordDateRanges.length || !editRecordDateRanges.every(r => r.from && r.to)) {
      alert('All date ranges must have both from and to dates.');
      return;
    }
    try {
      if (!editingRecordId) {
        alert('Record ID not found');
        return;
      }
      await leaveRecordAPI.update(editingRecordId, {
        dateRanges: editRecordDateRanges,
        period: '', // legacy, not used
        particulars: editRecordData.particulars,
        numberOfDays: getRecordNumberOfDays({
          dateRanges: editRecordDateRanges,
          vlAbsentUndertimeWPay: editRecordData.vlAbsentUndertimeWPay,
          slAbsentUndertimeWPay: editRecordData.slAbsentUndertimeWPay,
        }),
        vlEarned: parseFloat(editRecordData.vlEarned) || 0,
        vlAbsentUndertimeWPay: parseFloat(editRecordData.vlAbsentUndertimeWPay) || 0,
        slEarned: parseFloat(editRecordData.slEarned) || 0,
        slAbsentUndertimeWPay: parseFloat(editRecordData.slAbsentUndertimeWPay) || 0,
        cto: editRecordData.cto || '',
      });
      await fetchData();
      setShowEditModal(false);
      setEditingRecordId(null);
      setEditRecordData({
        period: '',
        particulars: '',
        vlEarned: '0',
        vlAbsentUndertimeWPay: '0',
        slEarned: '0',
        slAbsentUndertimeWPay: '0',
        cto: '',
      });
      showSuccessMessage('Leave record updated successfully');
    } catch (err) {
      console.error('Error updating record:', err);
      const errorMessage = err.response?.data?.message || 'Failed to update leave record';
      alert(errorMessage);
    }
  };

  const handleCancelNewRecord = () => {
    setShowAddForm(false);
    setNewRecordData({
      period: '',
      particulars: '',
      vlEarned: '0',
      vlAbsentUndertimeWPay: '0',
      slEarned: '0',
      slAbsentUndertimeWPay: '0',
      cto: '',
    });
  };

  // CSV Export handler
  const handleExportCsv = () => {
    if (!leaveRecords.length) return;
    let vlCumulativeBalance = 0;
    let slCumulativeBalance = 0;

    const filtered = leaveRecords.map(r => {
      const obj = {};
      const particulars = String(r.particulars || '').toLowerCase();
      const vacationLeaveDeduction = ['mandatory/force leave', 'monetization', 'wellness'].includes(particulars)
        ? parseFloat(r.vlAbsentUndertimeWPay) || parseFloat(r.numberOfDays) || 0
        : parseFloat(r.vlAbsentUndertimeWPay) || 0;

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
        vlCumulativeBalance +=
          (parseFloat(r.vlEarned) || 0) - vacationLeaveDeduction;
      }

      if (
        particulars.includes('sick leave') ||
        particulars === 'sl' ||
        particulars.includes('undertime') ||
        particulars.includes('tardy') ||
        particulars.includes('earned leave')
      ) {
        slCumulativeBalance +=
          (parseFloat(r.slEarned) || 0) - (parseFloat(r.slAbsentUndertimeWPay) || 0);
      }

      const { from, to } = getRecordFromTo(r);
      obj['periodFrom'] = from === 'N/A' ? '' : from;
      obj['periodTo'] = to === 'N/A' ? '' : to;
      obj['particulars'] = r['particulars'] ?? '';
      obj['vlEarned'] = r['vlEarned'] ?? '';
      obj['vlAbsentUndertimeWPay'] = r['vlAbsentUndertimeWPay'] ?? '';
      const vlExportBalance = Math.max(0, vlCumulativeBalance);
      obj['vlBalance'] = vlExportBalance === 0 ? '' : vlExportBalance.toFixed(4);
      obj['slEarned'] = r['slEarned'] ?? '';
      obj['slAbsentUndertimeWPay'] = r['slAbsentUndertimeWPay'] ?? '';
      const slExportBalance = Math.max(0, slCumulativeBalance);
      obj['slBalance'] = slExportBalance === 0 ? '' : slExportBalance.toFixed(4);
      obj['cto'] = r['cto'] ?? '';
      return obj;
    });
    exportToCsv('leave_records.csv', filtered);
  };
  // CSV Import handler
  const handleImportCsv = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    importFromCsv(file, async (data) => {
      const normalizeKeys = obj => {
        const out = {};
        Object.keys(obj).forEach(k => {
          out[k.trim().toLowerCase()] = obj[k];
        });
        return out;
      };
      const mapped = data.map(rowOrig => {
        const row = normalizeKeys(rowOrig);
        // Helper to get value from both camelCase and lowercase
        const getVal = (row, key) => row[key] ?? row[key.toLowerCase()] ?? row[key.replace(/([A-Z])/g, l => l.toLowerCase())] ?? '';

        // Accept either legacy period or split periodFrom/periodTo columns.
        const periodFromVal = getVal(row, 'periodFrom');
        const periodToVal = getVal(row, 'periodTo');
        const periodVal = getVal(row, 'period') || (periodFromVal && periodToVal ? `${periodFromVal} - ${periodToVal}` : periodFromVal || periodToVal || '');

        // Try to parse period fields into dateRanges if possible.
        let dateRanges = [];

        if (periodFromVal || periodToVal) {
          const parsedFrom = periodFromVal ? new Date(periodFromVal) : null;
          const parsedTo = periodToVal ? new Date(periodToVal) : parsedFrom;
          if (
            parsedFrom &&
            parsedTo &&
            !isNaN(parsedFrom.getTime()) &&
            !isNaN(parsedTo.getTime())
          ) {
            const fromDate = parsedFrom <= parsedTo ? parsedFrom : parsedTo;
            const toDate = parsedFrom <= parsedTo ? parsedTo : parsedFrom;
            dateRanges = [{
              from: formatDateForInput(fromDate),
              to: formatDateForInput(toDate),
            }];
          }
        }

        if (periodVal && periodVal !== 'N/A') {
          // Match formats like 2/3-5,10,12-13/2026 or 2/17,19/2026 or 2/15/26
          const match = periodVal.match(/^(\d{1,2})\/([^/]+)\/(\d{2,4})$/);
          if (match) {
            const month = parseInt(match[1], 10);
            const daysPart = match[2];
            let year = parseInt(match[3], 10);
            if (year < 100) year += 2000; // handle 2-digit years as 20xx
            if (typeof daysPart === 'string') {
              daysPart.split(',').forEach(part => {
                if (part.includes('-')) {
                  const [start, end] = part.split('-').map(Number);
                  if (!isNaN(start) && !isNaN(end)) {
                    dateRanges.push({
                      from: `${year}-${String(month).padStart(2, '0')}-${String(start).padStart(2, '0')}`,
                      to: `${year}-${String(month).padStart(2, '0')}-${String(end).padStart(2, '0')}`
                    });
                  }
                } else if (!isNaN(Number(part))) {
                  dateRanges.push({
                    from: `${year}-${String(month).padStart(2, '0')}-${String(Number(part)).padStart(2, '0')}`,
                    to: `${year}-${String(month).padStart(2, '0')}-${String(Number(part)).padStart(2, '0')}`
                  });
                }
              });
            }
          }
        }
        // Only use these columns: period, particulars, vlEarned, vlAbsentUndertimeWPay, slEarned, slAbsentUndertimeWPay
        // If any leave field is present, fill missing leave fields with 0
        const parseNum = v => v === undefined || v === null || v === '' ? 0 : Number(v);
        const leaveKeys = [
          ['vlEarned','vlearned'],
          ['vlAbsentUndertimeWPay','vlabsentundertimewpay'],
          ['slEarned','slearned'],
          ['slAbsentUndertimeWPay','slabsentundertimewpay']
        ];
        const hasLeaveValue = leaveKeys.some(([camel, lower]) => getVal(row, camel) !== '' && getVal(row, camel) !== undefined);
        return {
          // Backend requires recordId, staffId, particulars, and dateRanges or period
          // Use crypto.randomUUID for robust uniqueness
          recordId: `LR-${crypto.randomUUID()}`,
          staffId: staffId,
          staffName: staffName || '',
          dateRanges,
          period: periodVal || '',
          particulars: getVal(row, 'particulars') || '',
          vlEarned: hasLeaveValue ? parseNum(getVal(row, 'vlEarned')) : 0,
          vlAbsentUndertimeWPay: hasLeaveValue ? parseNum(getVal(row, 'vlAbsentUndertimeWPay')) : 0,
          slEarned: hasLeaveValue ? parseNum(getVal(row, 'slEarned')) : 0,
          slAbsentUndertimeWPay: hasLeaveValue ? parseNum(getVal(row, 'slAbsentUndertimeWPay')) : 0,
        };
      });
      console.log('[handleImportCsv] mapped records:', mapped);
      try {
        // Send to backend batch import endpoint
        const res = await leaveRecordAPI.importBatch(mapped);
        setLeaveRecords(prev => [...prev, ...mapped]);
        calculateLeaveBalance([...leaveRecords, ...mapped]);
        setImportSuccess(true);
      } catch (err) {
        setError('Failed to import leave records to backend.');
        console.error('[handleImportCsv] importBatch error:', err);
      } finally {
        setImporting(false);
        setTimeout(() => setImportSuccess(false), 2000);
      }
    });
  };

  if (loading) return <div className="text-center p-8">Loading...</div>;

  if (importing) return <div className="text-center p-8 text-blue-600 font-bold">Importing records...</div>;
  if (importSuccess) return <div className="text-center p-8 text-green-600 font-bold">Import successful!</div>;

  const wellnessBalancesByRecord = new Map();
  const wellnessBalanceByYear = new Map();
  leaveRecords.forEach((record, index) => {
    const firstRange = Array.isArray(record.dateRanges) ? record.dateRanges[0] : null;
    const recordDate = new Date(firstRange?.from || firstRange?.startDate || record.period || record.createdAt);
    const year = Number.isNaN(recordDate.getTime()) ? new Date().getFullYear() : recordDate.getFullYear();
    const previousBalance = wellnessBalanceByYear.has(year) ? wellnessBalanceByYear.get(year) : 5;
    const particulars = String(record.particulars || '').trim().toLowerCase();
    const balance = particulars === 'wellness'
      ? Math.max(0, previousBalance - (Number(record.numberOfDays) || 0))
      : previousBalance;

    wellnessBalanceByYear.set(year, balance);
    wellnessBalancesByRecord.set(record.recordId || record.id || index, balance);
  });

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Leave Record</h1>
        <div className="flex gap-2">
          <button
            onClick={handleExportCsv}
            className="px-4 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600 transition"
            title="Export CSV"
          >
            Export CSV
          </button>
          <label className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 transition cursor-pointer">
            Import CSV
            <input type="file" accept=".csv" onChange={handleImportCsv} style={{ display: 'none' }} />
          </label>
        </div>
      </div>

      

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Leave Record</h1>
        {staff && (
          <div className="text-gray-600">
            <p><strong>Employee:</strong> {staff.name}</p>
            <p><strong>Position:</strong> {staff.position || 'N/A'}</p>
            <p><strong>Department:</strong> {staff.department || 'N/A'}</p>
          </div>
        )}
      </div>

      {error && <div className="mb-4 p-4 bg-red-100 text-red-700 rounded">{error}</div>}
      {successMessage && <div className="mb-4 p-4 bg-green-100 text-green-700 rounded">{successMessage}</div>}

      {/* Leave Balance Summary */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-blue-50 p-4 rounded border border-blue-200">
          <p className="text-sm text-gray-600 mb-1">Vacation Leave Balance</p>
          <p className="text-2xl font-bold text-blue-600">{formatAmount(leaveBalance.vacationLeaveBalance)}</p>
        </div>
        <div className="bg-green-50 p-4 rounded border border-green-200">
          <p className="text-sm text-gray-600 mb-1">Sick Leave Balance</p>
          <p className="text-2xl font-bold text-green-600">{formatAmount(leaveBalance.sickLeaveBalance)}</p>
        </div>
        <div className="bg-purple-50 p-4 rounded border border-purple-200">
          <p className="text-sm text-gray-600 mb-1">Total Days Used</p>
          <p className="text-2xl font-bold text-purple-600">{formatAmount(leaveBalance.totalDaysUsed)}</p>
        </div>
      </div>

      <div className="mb-6 border-b border-gray-300">
        <div className="flex gap-6">
          <button
            type="button"
            onClick={() => setActiveTab('records')}
            className={`pb-2 font-semibold border-b-2 transition ${
              activeTab === 'records'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-800'
            }`}
          >
            Leave Records
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('summary')}
            className={`pb-2 font-semibold border-b-2 transition ${
              activeTab === 'summary'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-800'
            }`}
          >
            Leave Summary
          </button>
        </div>
      </div>

      {/* Leave Records Table Section */}
      {activeTab === 'records' && (
      <div className="mb-6">
        <div className="bg-white rounded shadow overflow-x-auto">
          <table className="w-full">
            <thead className="bg-blue-100 border-b">
              <tr>
                <th className="px-6 py-3 text-left font-bold text-gray-700">Period From</th>
                <th className="px-6 py-3 text-left font-bold text-gray-700">Period To</th>
                <th className="px-6 py-3 text-left font-bold text-gray-700">Particulars</th>
                <th className="px-6 py-3 text-center font-bold text-gray-700">No. of Days</th>
                <th className="px-6 py-3 text-center font-bold text-gray-700">VL Earned</th>
                <th className="px-6 py-3 text-center font-bold text-gray-700">VL ABSENT/UNDERTIME/ WITH PAY</th>
                <th className="px-6 py-3 text-center font-bold text-gray-700">SL Earned</th>
                <th className="px-6 py-3 text-center font-bold text-gray-700">SL ABSENT/UNDERTIME/ WITH PAY</th>
                <th className="px-6 py-3 text-center font-bold text-gray-700">CTO</th>
                <th className="px-6 py-3 text-center font-bold text-gray-700">Wellness Leave</th>
                {user && isDepartmentStaffManager(user.role) && (
                  <th className="px-6 py-3 text-center font-bold text-gray-700">Actions</th>
                )}
              </tr>
            </thead>
            <tbody>
              {leaveRecords.length === 0 && !showAddForm && (
                <tr>
                  <td colSpan={user && isDepartmentStaffManager(user.role) ? 11 : 10} className="px-6 py-4 text-center text-gray-600">
                    No leave records found
                  </td>
                </tr>
              )}
              {leaveRecords.map((record, index) => (
                <tr key={record.recordId || record.id} className="border-b hover:bg-gray-50 transition">
                  <td className="px-6 py-4 text-gray-800">{getRecordFromTo(record).from}</td>
                  <td className="px-6 py-4 text-gray-800">{getRecordFromTo(record).to}</td>
                  <td className="px-6 py-4 text-gray-800">{record.particulars}</td>
                  <td className="px-6 py-4 text-center text-gray-800">{formatAmount(getRecordNumberOfDays(record))}</td>
                  {/* Late Filing Explanation for leave records, if present */}
                  {record.lateFilingExplanation && (
                    <td className="px-6 py-4 text-red-600 font-semibold whitespace-pre-line" colSpan={user && isDepartmentStaffManager(user.role) ? 7 : 6}>
                      Explanation for Late Filing: {record.lateFilingExplanation}
                    </td>
                  )}
                  <td className="px-6 py-4 text-center text-gray-800">{typeof record.vlEarned === 'number' && !isNaN(record.vlEarned) ? record.vlEarned.toFixed(2) : (record.vlEarned ? Number(record.vlEarned).toFixed(2) : '')}</td>
                  <td className="px-6 py-4 text-center text-gray-800">
                    {formatRecordLeaveAmount(
                      Number(record.vlAbsentUndertimeWPay) ||
                        (['mandatory/force leave', 'monetization', 'wellness'].includes(String(record.particulars || '').toLowerCase())
                          ? Number(record.numberOfDays)
                          : 0),
                      record.particulars
                    )}
                  </td>
                  <td className="px-6 py-4 text-center text-gray-800">{typeof record.slEarned === 'number' && !isNaN(record.slEarned) ? record.slEarned.toFixed(2) : (record.slEarned ? Number(record.slEarned).toFixed(2) : '')}</td>
                  <td className="px-6 py-4 text-center text-gray-800">
                    {formatRecordLeaveAmount(record.slAbsentUndertimeWPay, record.particulars)}
                  </td>
                  <td className="px-6 py-4 text-center text-gray-800">{record.cto ? (isNaN(Number(record.cto)) ? '' : Number(record.cto).toFixed(2)) : ''}</td>
                  <td className="px-6 py-4 text-center text-gray-800">
                    {(wellnessBalancesByRecord.get(record.recordId || record.id || index) ?? 5).toFixed(2)}
                  </td>
                  {user && isDepartmentStaffManager(user.role) && (
                    <td className="px-6 py-4 text-center flex gap-2 justify-center">
                      <button
                        onClick={() => handleEditLeave(record)}
                        className="p-2 text-blue-600 hover:bg-blue-100 rounded transition"
                        title="Edit"
                      >
                        <TbEdit size={18} />
                      </button>
                      <button
                        onClick={() => handleDeleteLeave(record.recordId || record.id)}
                        className="p-2 text-red-600 hover:bg-red-100 rounded transition"
                        title="Delete"
                      >
                        <TbTrash size={18} />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
              {showAddForm && user && isDepartmentStaffManager(user.role) && (
                <tr className="border-b bg-blue-50">
                  <td className="px-6 py-2" colSpan="2">
                    {/* Multiple date range input */}
                    <div className="flex items-center gap-1 mb-1">
                      <input
                        type="date"
                        value={newRecordDateRanges[0]?.from || ''}
                        onChange={e => {
                          setNewRecordDateRanges([{ from: e.target.value, to: newRecordDateRanges[0]?.to || '' }]);
                        }}
                        className="px-1 py-1 border rounded text-sm"
                        required
                      />
                      <span className="mx-1">to</span>
                      <input
                        type="date"
                        value={newRecordDateRanges[0]?.to || ''}
                        onChange={e => {
                          setNewRecordDateRanges([{ from: newRecordDateRanges[0]?.from || '', to: e.target.value }]);
                        }}
                        className="px-1 py-1 border rounded text-sm"
                        required
                      />
                    </div>
                  </td>
                  <td className="px-6 py-2">
                    <select
                      name="particulars"
                      value={newRecordData.particulars}
                      onChange={handleNewRecordChange}
                      className="w-full px-2 py-1 border rounded text-sm"
                      required
                    >
                      <option value="">Select</option>
                      {LEAVE_TYPE_OPTIONS.map(option => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                  </td>
                  {/* No. of Days column (disabled input) */}
                  <td className="px-6 py-2">
                    <input
                      type="number"
                      value={getRecordNumberOfDays({
                        dateRanges: newRecordDateRanges,
                        vlAbsentUndertimeWPay: newRecordData.vlAbsentUndertimeWPay,
                        slAbsentUndertimeWPay: newRecordData.slAbsentUndertimeWPay,
                      }).toFixed(2)}
                      disabled
                      className="w-full px-2 py-1 border rounded text-sm text-center bg-gray-100 cursor-not-allowed"
                    />
                  </td>
                  <td className="px-6 py-2">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      name="vlEarned"
                      value={newRecordData.vlEarned}
                      onChange={handleNewRecordChange}
                      className="w-full px-2 py-1 border rounded text-sm text-center"
                    />
                  </td>
                  <td className="px-6 py-2">
                    <input
                      type="number"
                      step="any"
                      name="vlAbsentUndertimeWPay"
                      value={newRecordData.vlAbsentUndertimeWPay}
                      onChange={handleNewRecordChange}
                      className="w-full px-2 py-1 border rounded text-sm text-center"
                    />
                  </td>
                  <td className="px-6 py-2">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      name="slEarned"
                      value={newRecordData.slEarned}
                      onChange={handleNewRecordChange}
                      className="w-full px-2 py-1 border rounded text-sm text-center"
                    />
                  </td>
                  <td className="px-6 py-2">
                    <input
                      type="number"
                      step="any"
                      name="slAbsentUndertimeWPay"
                      value={newRecordData.slAbsentUndertimeWPay}
                      onChange={handleNewRecordChange}
                      className="w-full px-2 py-1 border rounded text-sm text-center"
                    />
                  </td>
                  <td className="px-6 py-2">
                    <input
                      type="number"
                      step="0.01"
                      name="cto"
                      value={newRecordData.cto}
                      onChange={handleNewRecordChange}
                      className="w-full px-2 py-1 border rounded text-sm text-center"
                    />
                  </td>
                  <td className="px-6 py-2 text-center text-sm text-gray-600">
                    {String(newRecordData.particulars || '').trim().toLowerCase() === 'wellness'
                      && Number(newRecordData.numberOfDays) > 0
                      ? Number(newRecordData.numberOfDays).toFixed(2)
                      : ''}
                  </td>
                  <td className="px-6 py-2 text-center flex gap-2 justify-center">
                    <button
                      onClick={handleSaveNewRecord}
                      className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700"
                    >
                      Save
                    </button>
                    <button
                      onClick={handleCancelNewRecord}
                      className="px-3 py-1 bg-gray-400 text-white rounded text-sm hover:bg-gray-500"
                    >
                      Cancel
                    </button>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      

              {/* Add Record Button (Admin only) - Below Summary Table */}
      {user && isDepartmentStaffManager(user.role) && (
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="mt-6 mb-6 px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition font-semibold"
        >
          {showAddForm ? 'Cancel' : 'Add Leave Record'}
        </button>
      )}
      </div>
      )}

      {/* Leave Record Summary Table (Reference from image) */}
      {activeTab === 'summary' && (
        <div className="mt-2">
          <div className="flex justify-between items-center mb-2">
            <h2 className="text-xl font-bold">Leave Summary</h2>
            <div className="flex items-center gap-3">
              <div className="relative">
                <button
                  onClick={() => setShowConverter(prev => !prev)}
                  className="px-3 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600 transition font-semibold print:hidden"
                >
                  Converter ({conversionUnit})
                </button>
                {showConverter && (
                  <div className="absolute right-0 mt-2 w-40 bg-white border rounded shadow z-50">
                    <button onClick={() => { setConversionUnit('days'); setShowConverter(false); }} className="w-full text-left px-3 py-2 hover:bg-gray-100">Days</button>
                    <button onClick={() => { setConversionUnit('months'); setShowConverter(false); }} className="w-full text-left px-3 py-2 hover:bg-gray-100">Months</button>
                    <button onClick={() => { setConversionUnit('weeks'); setShowConverter(false); }} className="w-full text-left px-3 py-2 hover:bg-gray-100">Weeks</button>
                    <button onClick={() => { setConversionUnit('minutes'); setShowConverter(false); }} className="w-full text-left px-3 py-2 hover:bg-gray-100">Minutes</button>
                  </div>
                )}
              </div>
              <button
                onClick={handlePrintSummary}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition font-semibold print:hidden"
              >
                Print
              </button>
            </div>
          </div>
          <div ref={summaryRef} className="bg-white rounded shadow overflow-x-auto">
            <table className="w-full border-collapse print-table">
              <thead>
                <tr className="bg-gray-200 border">
                  <th colSpan="2" className="px-4 py-2 border text-center font-bold">PERIOD</th>
                  <th rowSpan="2" className="px-4 py-2 border text-left font-bold">PARTICULARS</th>
                  <th colSpan="3" className="px-4 py-2 border text-center font-bold">VACATION LEAVE</th>
                  <th colSpan="3" className="px-4 py-2 border text-center font-bold">SICK LEAVE</th>
                </tr>
                <tr className="bg-gray-200 border">
                  <th className="px-4 py-2 border text-center font-bold">FROM</th>
                  <th className="px-4 py-2 border text-center font-bold">TO</th>
                  <th className="px-4 py-2 border text-center font-bold">EARNED</th>
                  <th className="px-4 py-2 border text-center font-bold">ABSENT UNDERTIME W/PAY</th>
                  <th className="px-4 py-2 border text-center font-bold">BALANCE</th>
                  <th className="px-4 py-2 border text-center font-bold">EARNED</th>
                  <th className="px-4 py-2 border text-center font-bold">ABSENT UNDERTIME W/PAY</th>
                  <th className="px-4 py-2 border text-center font-bold">BALANCE</th>
                </tr>
              </thead>
              <tbody>
                {leaveRecords.length === 0 ? (
                  <tr className="border">
                    <td colSpan="9" className="px-4 py-2 border text-center text-gray-600">
                      No leave records to display
                    </td>
                  </tr>
                ) : (
                  <>
                    {leaveRecords.map((record, index) => {
                      const recordKey = record.recordId || record.id || index;
                      const vlCellKey = `${recordKey}-vlAbsentUndertimeWPay`;
                      const slCellKey = `${recordKey}-slAbsentUndertimeWPay`;
                      const isVlCellConverted = Boolean(convertedCellMap[vlCellKey]);
                      const isSlCellConverted = Boolean(convertedCellMap[slCellKey]);

                      let vlCumulativeBalance = 0;
                      let slCumulativeBalance = 0;
                      for (let i = 0; i <= index; i++) {
                        const rec = leaveRecords[i];
                        const particulars = String(rec.particulars || '').toLowerCase();
                        if (
                          particulars.includes('vacation leave') ||
                          particulars.includes('wellness') ||
                          particulars === 'vl' ||
                          particulars === 'mandatory/force leave' ||
                          particulars === 'monetization' ||
                          particulars === 'wellness' ||
                          particulars.includes('undertime') ||
                          particulars.includes('tardy') ||
                          particulars.includes('earned leave')
                        ) {
                          const vlEarnedValue = parseFloat(rec.vlEarned) || 0;
                          const vlAbsentValue = ['mandatory/force leave', 'monetization', 'wellness'].includes(particulars)
                            ? parseFloat(rec.vlAbsentUndertimeWPay) || parseFloat(rec.numberOfDays) || 0
                            : parseFloat(rec.vlAbsentUndertimeWPay) || 0;
                          vlCumulativeBalance += vlEarnedValue - vlAbsentValue;
                        }
                        if (
                          particulars.includes('sick leave') ||
                          particulars === 'sl' ||
                          particulars.includes('undertime') ||
                          particulars.includes('tardy') ||
                          particulars.includes('earned leave')
                        ) {
                          slCumulativeBalance += (parseFloat(rec.slEarned) || 0) - (parseFloat(rec.slAbsentUndertimeWPay) || 0);
                        }
                      }

                      return (
                        <tr key={recordKey} className="border">
                          <td className="px-4 py-2 border">{getRecordFromTo(record).from}</td>
                          <td className="px-4 py-2 border">{getRecordFromTo(record).to}</td>
                          <td className="px-4 py-2 border">{record.particulars}</td>
                          <td className="px-4 py-2 border text-center font-semibold">{isNaN(Number(record.vlEarned)) || Number(record.vlEarned) === 0 ? '' : formatConverted(Number(record.vlEarned), conversionUnit)}</td>
                          <td className="px-4 py-2 border text-center font-semibold">
                            {isTardyOrUndertimeParticulars(record.particulars) ? (
                              <div className="flex items-center justify-center gap-1">
                                <span>
                                  {isNaN(Number(record.vlAbsentUndertimeWPay)) || Number(record.vlAbsentUndertimeWPay) === 0
                                    ? ''
                                    : (isVlCellConverted
                                      ? formatUndertimeMinutes(record.vlAbsentUndertimeWPay)
                                      : formatConverted(Number(record.vlAbsentUndertimeWPay), conversionUnit))}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => toggleCellConversion(vlCellKey)}
                                  className="print:hidden p-1 rounded hover:bg-gray-200 text-blue-600"
                                  title={isVlCellConverted ? 'Show default unit' : 'Convert this cell to minutes'}
                                >
                                  <TbCalculator size={12} />
                                </button>
                              </div>
                            ) : (
                              isNaN(Number(record.vlAbsentUndertimeWPay)) || Number(record.vlAbsentUndertimeWPay) === 0
                                ? ''
                                : formatConverted(Number(record.vlAbsentUndertimeWPay), conversionUnit)
                            )}
                          </td>
                          <td className="px-4 py-2 border text-center font-semibold">{formatBalance(Math.max(0, Number(vlCumulativeBalance)), conversionUnit)}</td>
                          <td className="px-4 py-2 border text-center font-semibold">{isNaN(Number(record.slEarned)) || Number(record.slEarned) === 0 ? '' : formatConverted(Number(record.slEarned), conversionUnit)}</td>
                          <td className="px-4 py-2 border text-center font-semibold">
                            {isTardyOrUndertimeParticulars(record.particulars) ? (
                              <div className="flex items-center justify-center gap-1">
                                <span>
                                  {isNaN(Number(record.slAbsentUndertimeWPay)) || Number(record.slAbsentUndertimeWPay) === 0
                                    ? ''
                                    : (isSlCellConverted
                                      ? formatUndertimeMinutes(record.slAbsentUndertimeWPay)
                                      : formatConverted(Number(record.slAbsentUndertimeWPay), conversionUnit))}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => toggleCellConversion(slCellKey)}
                                  className="print:hidden p-1 rounded hover:bg-gray-200 text-blue-600"
                                  title={isSlCellConverted ? 'Show default unit' : 'Convert this cell to minutes'}
                                >
                                  <TbCalculator size={12} />
                                </button>
                              </div>
                            ) : (
                              isNaN(Number(record.slAbsentUndertimeWPay)) || Number(record.slAbsentUndertimeWPay) === 0
                                ? ''
                                : formatConverted(Number(record.slAbsentUndertimeWPay), conversionUnit)
                            )}
                          </td>
                          <td className="px-4 py-2 border text-center font-semibold">{formatBalance(Math.max(0, Number(slCumulativeBalance)), conversionUnit)}</td>
                        </tr>
                      );
                    })}
                    {/* Total Row */}
                    <tr className="border bg-gray-100 font-bold">
                      <td colSpan="3" className="px-4 py-2 border text-right">TOTAL:</td>
                      <td className="px-4 py-2 border text-center">{typeof leaveBalance.vacationLeaveEarned === 'number' && !isNaN(leaveBalance.vacationLeaveEarned) && leaveBalance.vacationLeaveEarned !== 0 ? formatConverted(leaveBalance.vacationLeaveEarned, conversionUnit) : ''}</td>
                      <td className="px-4 py-2 border text-center">{typeof leaveBalance.vacationLeaveAbsent === 'number' && !isNaN(leaveBalance.vacationLeaveAbsent) && leaveBalance.vacationLeaveAbsent !== 0 ? formatConverted(leaveBalance.vacationLeaveAbsent, conversionUnit) : ''}</td>
                      <td className="px-4 py-2 border text-center">{typeof leaveBalance.vacationLeaveBalance === 'number' && !isNaN(leaveBalance.vacationLeaveBalance) ? formatBalance(leaveBalance.vacationLeaveBalance, conversionUnit) : ''}</td>
                      <td className="px-4 py-2 border text-center">{typeof leaveBalance.sickLeaveEarned === 'number' && !isNaN(leaveBalance.sickLeaveEarned) && leaveBalance.sickLeaveEarned !== 0 ? formatConverted(leaveBalance.sickLeaveEarned, conversionUnit) : ''}</td>
                      <td className="px-4 py-2 border text-center">{typeof leaveBalance.sickLeaveAbsent === 'number' && !isNaN(leaveBalance.sickLeaveAbsent) && leaveBalance.sickLeaveAbsent !== 0 ? formatConverted(leaveBalance.sickLeaveAbsent, conversionUnit) : ''}</td>
                      <td className="px-4 py-2 border text-center">{typeof leaveBalance.sickLeaveBalance === 'number' && !isNaN(leaveBalance.sickLeaveBalance) ? formatBalance(leaveBalance.sickLeaveBalance, conversionUnit) : ''}</td>
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Edit Leave Record Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 w-96 max-h-96 overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">Edit Leave Record</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-1">Period (from, to)</label>
                <div className="flex items-center gap-1">
                  <input
                    type="date"
                    value={editRecordDateRanges[0]?.from || ''}
                    onChange={e => {
                      setEditRecordDateRanges([{ from: e.target.value, to: editRecordDateRanges[0]?.to || '' }]);
                    }}
                    className="px-2 py-1 border rounded text-sm flex-1"
                    required
                  />
                  <span className="mx-1">to</span>
                  <input
                    type="date"
                    value={editRecordDateRanges[0]?.to || ''}
                    onChange={e => {
                      setEditRecordDateRanges([{ from: editRecordDateRanges[0]?.from || '', to: e.target.value }]);
                    }}
                    className="px-2 py-1 border rounded text-sm flex-1"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1">Particulars</label>
                <select
                  name="particulars"
                  value={editRecordData.particulars}
                  onChange={handleEditRecordChange}
                  className="w-full px-3 py-2 border rounded"
                  required
                >
                  <option value="">Select</option>
                  {LEAVE_TYPE_OPTIONS.map(option => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1">VL Earned</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  name="vlEarned"
                  value={editRecordData.vlEarned}
                  onChange={handleEditRecordChange}
                  className="w-full px-3 py-2 border rounded"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1">VL ABSENT/UNDERTIME/ WITH PAY</label>
                <input
                  type="number"
                  step="any"
                  name="vlAbsentUndertimeWPay"
                  value={editRecordData.vlAbsentUndertimeWPay}
                  onChange={handleEditRecordChange}
                  className="w-full px-3 py-2 border rounded"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1">SL Earned</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  name="slEarned"
                  value={editRecordData.slEarned}
                  onChange={handleEditRecordChange}
                  className="w-full px-3 py-2 border rounded"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1">SL Absent W/PAY</label>
                <input
                  type="number"
                  step="any"
                  name="slAbsentUndertimeWPay"
                  value={editRecordData.slAbsentUndertimeWPay}
                  onChange={handleEditRecordChange}
                  className="w-full px-3 py-2 border rounded"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1">CTO</label>
                <input
                  type="number"
                  step="0.01"
                  name="cto"
                  value={editRecordData.cto}
                  onChange={handleEditRecordChange}
                  className="w-full px-3 py-2 border rounded"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={handleSaveEditRecord}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
              >
                Update
              </button>
              <button
                onClick={() => setShowEditModal(false)}
                className="flex-1 px-4 py-2 bg-gray-400 text-white rounded hover:bg-gray-500 transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      
    </div>
  );
}

export default StaffLeaveRecordDetail;