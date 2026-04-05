
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { TbArrowLeft, TbEdit, TbTrash } from 'react-icons/tb';
import { staffAPI, leaveRecordAPI } from '../api';
import { isAdmin, normalizeRole } from '../constants';
import { exportToCsv, importFromCsv } from '../exportCsv';

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

function StaffLeaveRecordDetail() {
  const [importing, setImporting] = useState(false);
  const [importSuccess, setImportSuccess] = useState(false);
  const particularsOptions = [
    '10-day VAWC Leave',
    'Adoption Leave',
    'Calamity',
    'CTO',
    'Earned Leave',
    'Maternity Leave',
    'Monetization',
    'Peternity Leave',
    'Rehabilitation Privilege',
    'Sick Leave',
    'SLB for Women',
    'Solo Parent Leave',
    'SPL', // Special Privilege Leave
    'Study Leave',
    'Tardy',
    'Undertime',
    'Vacation Leave',
    'Wellness'
  ];

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
  });
  const [showAddForm, setShowAddForm] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
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
    fetchData();
  }, [staffId]);

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
          
          // The URL param IS the staff ID (it's passed as staff.id from EmployeeLeaveRecord)
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

      // Process each record to calculate balance
      records.forEach(record => {
        vlEarned += parseFloat(record.vlEarned) || 0;
        vlAbsent += parseFloat(record.vlAbsentUndertimeWPay) || 0;
        slEarned += parseFloat(record.slEarned) || 0;
        slAbsent += parseFloat(record.slAbsentUndertimeWPay) || 0;
      });

      // Balance = Earned - Absent
      vlBalance = vlEarned - vlAbsent;
      slBalance = slEarned - slAbsent;

      setLeaveBalance({
        vacationLeaveBalance: Math.max(0, vlBalance),
        sickLeaveBalance: Math.max(0, slBalance),
        vacationLeaveAbsent: vlAbsent,
        sickLeaveAbsent: slAbsent,
        vacationLeaveEarned: vlEarned,
        sickLeaveEarned: slEarned,
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

    if (!user || !isAdmin(user.role)) {
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
    if (!user || !isAdmin(user.role)) {
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
      ? record.dateRanges.map(r => ({ from: r.from, to: r.to }))
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
        alert('Staff ID not found. Please reload the page.');
        return;
      }
      await leaveRecordAPI.create({
        staffId: actualStaffId,
        staffName: staff?.name || 'N/A',
        dateRanges: newRecordDateRanges,
        period: '', // legacy, not used
        particulars: newRecordData.particulars,
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

      if (
        particulars.includes('vacation leave') ||
        particulars === 'vl' ||
        particulars.includes('undertime') ||
        particulars.includes('tardy') ||
        particulars.includes('earned leave')
      ) {
        vlCumulativeBalance +=
          (parseFloat(r.vlEarned) || 0) - (parseFloat(r.vlAbsentUndertimeWPay) || 0);
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
      obj['vlBalance'] = vlExportBalance === 0 ? '' : vlExportBalance.toFixed(2);
      obj['slEarned'] = r['slEarned'] ?? '';
      obj['slAbsentUndertimeWPay'] = r['slAbsentUndertimeWPay'] ?? '';
      const slExportBalance = Math.max(0, slCumulativeBalance);
      obj['slBalance'] = slExportBalance === 0 ? '' : slExportBalance.toFixed(2);
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
          recordId: `LR-${Date.now()}-${Math.floor(Math.random()*100000)}`,
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

      {/* Back Button */}
      <button
        onClick={() => navigate('/employee-leave-record')}
        className="flex items-center gap-2 mb-6 px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition"
      >
        <TbArrowLeft size={20} />
        Back
      </button>

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
          <p className="text-2xl font-bold text-blue-600">{typeof leaveBalance.vacationLeaveBalance === 'number' && !isNaN(leaveBalance.vacationLeaveBalance) ? leaveBalance.vacationLeaveBalance.toFixed(2) : ''}</p>
        </div>
        <div className="bg-green-50 p-4 rounded border border-green-200">
          <p className="text-sm text-gray-600 mb-1">Sick Leave Balance</p>
          <p className="text-2xl font-bold text-green-600">{typeof leaveBalance.sickLeaveBalance === 'number' && !isNaN(leaveBalance.sickLeaveBalance) ? leaveBalance.sickLeaveBalance.toFixed(2) : ''}</p>
        </div>
        <div className="bg-purple-50 p-4 rounded border border-purple-200">
          <p className="text-sm text-gray-600 mb-1">Total Days Used</p>
          <p className="text-2xl font-bold text-purple-600">{typeof leaveBalance.vacationLeaveAbsent === 'number' && typeof leaveBalance.sickLeaveAbsent === 'number' && !isNaN(leaveBalance.vacationLeaveAbsent + leaveBalance.sickLeaveAbsent) ? (leaveBalance.vacationLeaveAbsent + leaveBalance.sickLeaveAbsent).toFixed(2) : ''}</p>
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
                <th className="px-6 py-3 text-left font-bold text-gray-700">Period</th>
                <th className="px-6 py-3 text-left font-bold text-gray-700">Particulars</th>
                <th className="px-6 py-3 text-center font-bold text-gray-700">VL Earned</th>
                <th className="px-6 py-3 text-center font-bold text-gray-700">VL ABSENT/UNDERTIME/ WITH PAY</th>
                <th className="px-6 py-3 text-center font-bold text-gray-700">SL Earned</th>
                <th className="px-6 py-3 text-center font-bold text-gray-700">SL ABSENT/UNDERTIME/ WITH PAY</th>
                <th className="px-6 py-3 text-center font-bold text-gray-700">CTO</th>
                {user && isAdmin(user.role) && (
                  <th className="px-6 py-3 text-center font-bold text-gray-700">Actions</th>
                )}
              </tr>
            </thead>
            <tbody>
              {leaveRecords.length === 0 && !showAddForm && (
                <tr>
                  <td colSpan={user && isAdmin(user.role) ? 8 : 7} className="px-6 py-4 text-center text-gray-600">
                    No leave records found
                  </td>
                </tr>
              )}
              {leaveRecords.map((record) => (
                <tr key={record.id} className="border-b hover:bg-gray-50 transition">
                  <td className="px-6 py-4 text-gray-800">
                    {Array.isArray(record.dateRanges) && record.dateRanges.length > 0
                      ? formatDateRanges(record.dateRanges)
                      : record.period
                        ? new Date(record.period).toLocaleDateString()
                        : 'N/A'}
                  </td>
                  <td className="px-6 py-4 text-gray-800">{record.particulars}</td>
                  {/* Late Filing Explanation for leave records, if present */}
                  {record.lateFilingExplanation && (
                    <td className="px-6 py-4 text-red-600 font-semibold whitespace-pre-line" colSpan={user && isAdmin(user.role) ? 7 : 6}>
                      Explanation for Late Filing: {record.lateFilingExplanation}
                    </td>
                  )}
                  <td className="px-6 py-4 text-center text-gray-800">{typeof record.vlEarned === 'number' && !isNaN(record.vlEarned) ? record.vlEarned.toFixed(2) : (record.vlEarned ? Number(record.vlEarned).toFixed(2) : '')}</td>
                  <td className="px-6 py-4 text-center text-gray-800">{typeof record.vlAbsentUndertimeWPay === 'number' && !isNaN(record.vlAbsentUndertimeWPay) ? record.vlAbsentUndertimeWPay.toFixed(2) : (record.vlAbsentUndertimeWPay ? Number(record.vlAbsentUndertimeWPay).toFixed(2) : '')}</td>
                  <td className="px-6 py-4 text-center text-gray-800">{typeof record.slEarned === 'number' && !isNaN(record.slEarned) ? record.slEarned.toFixed(2) : (record.slEarned ? Number(record.slEarned).toFixed(2) : '')}</td>
                  <td className="px-6 py-4 text-center text-gray-800">{typeof record.slAbsentUndertimeWPay === 'number' && !isNaN(record.slAbsentUndertimeWPay) ? record.slAbsentUndertimeWPay.toFixed(2) : (record.slAbsentUndertimeWPay ? Number(record.slAbsentUndertimeWPay).toFixed(2) : '')}</td>
                  <td className="px-6 py-4 text-center text-gray-800">{record.cto ? (isNaN(Number(record.cto)) ? '' : Number(record.cto).toFixed(2)) : ''}</td>
                  {user && isAdmin(user.role) && (
                    <td className="px-6 py-4 text-center flex gap-2 justify-center">
                      <button
                        onClick={() => handleEditLeave(record)}
                        className="p-2 text-blue-600 hover:bg-blue-100 rounded transition"
                        title="Edit"
                      >
                        <TbEdit size={18} />
                      </button>
                      <button
                        onClick={() => handleDeleteLeave(record.id)}
                        className="p-2 text-red-600 hover:bg-red-100 rounded transition"
                        title="Delete"
                      >
                        <TbTrash size={18} />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
              {showAddForm && user && isAdmin(user.role) && (
                <tr className="border-b bg-blue-50">
                  <td className="px-6 py-2">
                    {/* Multiple date range input */}
                    {newRecordDateRanges.map((range, idx) => (
                      <div key={idx} className="flex items-center gap-1 mb-1">
                        <input
                          type="date"
                          value={range.from}
                          onChange={e => {
                            const updated = [...newRecordDateRanges];
                            updated[idx].from = e.target.value;
                            setNewRecordDateRanges(updated);
                          }}
                          className="px-1 py-1 border rounded text-sm"
                          required
                        />
                        <span className="mx-1">to</span>
                        <input
                          type="date"
                          value={range.to}
                          onChange={e => {
                            const updated = [...newRecordDateRanges];
                            updated[idx].to = e.target.value;
                            setNewRecordDateRanges(updated);
                          }}
                          className="px-1 py-1 border rounded text-sm"
                          required
                        />
                        {newRecordDateRanges.length > 1 && (
                          <button
                            type="button"
                            className="ml-1 px-2 py-1 bg-red-200 text-red-700 rounded"
                            onClick={() => {
                              setNewRecordDateRanges(newRecordDateRanges.filter((_, i) => i !== idx));
                            }}
                          >
                            ×
                          </button>
                        )}
                      </div>
                    ))}
                    <button
                      type="button"
                      className="mt-1 px-2 py-1 bg-blue-200 text-blue-700 rounded"
                      onClick={() => setNewRecordDateRanges([...newRecordDateRanges, { from: '', to: '' }])}
                    >
                      + Add Range
                    </button>
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
                      {particularsOptions.map(option => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
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
                      step="0.01"
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
                      step="0.01"
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
      {user && isAdmin(user.role) && (
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
        <h2 className="text-xl font-bold mb-4">Leave Summary</h2>
        <div className="bg-white rounded shadow overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gray-200 border">
                <th rowSpan="2" className="px-4 py-2 border text-left font-bold">PERIOD</th>
                <th rowSpan="2" className="px-4 py-2 border text-left font-bold">PARTICULARS</th>
                <th colSpan="3" className="px-4 py-2 border text-center font-bold">VACATION LEAVE</th>
                <th colSpan="3" className="px-4 py-2 border text-center font-bold">SICK LEAVE</th>
              </tr>
              <tr className="bg-gray-200 border">
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
                  <td colSpan="8" className="px-4 py-2 border text-center text-gray-600">
                    No leave records to display
                  </td>
                </tr>
              ) : (
                <>
                  {leaveRecords.map((record, index) => {
                    // Calculate cumulative balance
                    // Balance = Previous Balance + Earned - Absent
                    let vlCumulativeBalance = 0;
                    let slCumulativeBalance = 0;

                    // Sum up all records up to and including current one
                    for (let i = 0; i <= index; i++) {
                      vlCumulativeBalance += leaveRecords[i].vlEarned - leaveRecords[i].vlAbsentUndertimeWPay;
                      slCumulativeBalance += leaveRecords[i].slEarned - leaveRecords[i].slAbsentUndertimeWPay;
                    }

                    return (
                      <tr key={record.id} className="border">
                        <td className="px-4 py-2 border">
                          {Array.isArray(record.dateRanges) && record.dateRanges.length > 0
                            ? formatDateRanges(record.dateRanges)
                            : record.period
                              ? new Date(record.period).toLocaleDateString()
                              : 'N/A'}
                        </td>
                        <td className="px-4 py-2 border">{record.particulars}</td>
                        <td className="px-4 py-2 border text-center font-semibold">{isNaN(Number(record.vlEarned)) || Number(record.vlEarned) === 0 ? '' : Number(record.vlEarned).toFixed(2)}</td>
                        <td className="px-4 py-2 border text-center font-semibold">{isNaN(Number(record.vlAbsentUndertimeWPay)) || Number(record.vlAbsentUndertimeWPay) === 0 ? '' : Number(record.vlAbsentUndertimeWPay).toFixed(2)}</td>
                        <td className="px-4 py-2 border text-center font-semibold">{isNaN(Number(vlCumulativeBalance)) || Number(vlCumulativeBalance) === 0 ? '' : Math.max(0, Number(vlCumulativeBalance)).toFixed(2)}</td>
                        <td className="px-4 py-2 border text-center font-semibold">{isNaN(Number(record.slEarned)) || Number(record.slEarned) === 0 ? '' : Number(record.slEarned).toFixed(2)}</td>
                        <td className="px-4 py-2 border text-center font-semibold">{isNaN(Number(record.slAbsentUndertimeWPay)) || Number(record.slAbsentUndertimeWPay) === 0 ? '' : Number(record.slAbsentUndertimeWPay).toFixed(2)}</td>
                        <td className="px-4 py-2 border text-center font-semibold">{isNaN(Number(slCumulativeBalance)) || Number(slCumulativeBalance) === 0 ? '' : Math.max(0, Number(slCumulativeBalance)).toFixed(2)}</td>
                      </tr>
                    );
                  })}
                  {/* Total Row */}
                  <tr className="border bg-gray-100 font-bold">
                    <td colSpan="2" className="px-4 py-2 border text-right">TOTAL:</td>
                    <td className="px-4 py-2 border text-center">{typeof leaveBalance.vacationLeaveEarned === 'number' && !isNaN(leaveBalance.vacationLeaveEarned) && leaveBalance.vacationLeaveEarned !== 0 ? leaveBalance.vacationLeaveEarned.toFixed(2) : ''}</td>
                    <td className="px-4 py-2 border text-center">{typeof leaveBalance.vacationLeaveAbsent === 'number' && !isNaN(leaveBalance.vacationLeaveAbsent) && leaveBalance.vacationLeaveAbsent !== 0 ? leaveBalance.vacationLeaveAbsent.toFixed(2) : ''}</td>
                    <td className="px-4 py-2 border text-center">{typeof leaveBalance.vacationLeaveBalance === 'number' && !isNaN(leaveBalance.vacationLeaveBalance) && leaveBalance.vacationLeaveBalance !== 0 ? leaveBalance.vacationLeaveBalance.toFixed(2) : ''}</td>
                    <td className="px-4 py-2 border text-center">{typeof leaveBalance.sickLeaveEarned === 'number' && !isNaN(leaveBalance.sickLeaveEarned) && leaveBalance.sickLeaveEarned !== 0 ? leaveBalance.sickLeaveEarned.toFixed(2) : ''}</td>
                    <td className="px-4 py-2 border text-center">{typeof leaveBalance.sickLeaveAbsent === 'number' && !isNaN(leaveBalance.sickLeaveAbsent) && leaveBalance.sickLeaveAbsent !== 0 ? leaveBalance.sickLeaveAbsent.toFixed(2) : ''}</td>
                    <td className="px-4 py-2 border text-center">{typeof leaveBalance.sickLeaveBalance === 'number' && !isNaN(leaveBalance.sickLeaveBalance) && leaveBalance.sickLeaveBalance !== 0 ? leaveBalance.sickLeaveBalance.toFixed(2) : ''}</td>
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
                <label className="block text-sm font-semibold mb-1">Period (Date Ranges)</label>
                {editRecordDateRanges.map((range, idx) => (
                  <div key={idx} className="flex items-center gap-1 mb-1">
                    <input
                      type="date"
                      value={range.from}
                      onChange={e => {
                        const updated = [...editRecordDateRanges];
                        updated[idx].from = e.target.value;
                        setEditRecordDateRanges(updated);
                      }}
                      className="px-1 py-1 border rounded text-sm"
                      required
                    />
                    <span className="mx-1">to</span>
                    <input
                      type="date"
                      value={range.to}
                      onChange={e => {
                        const updated = [...editRecordDateRanges];
                        updated[idx].to = e.target.value;
                        setEditRecordDateRanges(updated);
                      }}
                      className="px-1 py-1 border rounded text-sm"
                      required
                    />
                    {editRecordDateRanges.length > 1 && (
                      <button
                        type="button"
                        className="ml-1 px-2 py-1 bg-red-200 text-red-700 rounded"
                        onClick={() => {
                          setEditRecordDateRanges(editRecordDateRanges.filter((_, i) => i !== idx));
                        }}
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  className="mt-1 px-2 py-1 bg-blue-200 text-blue-700 rounded"
                  onClick={() => setEditRecordDateRanges([...editRecordDateRanges, { from: '', to: '' }])}
                >
                  + Add Range
                </button>
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
                  {particularsOptions.map(option => (
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
                  step="0.01"
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
                  step="0.01"
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