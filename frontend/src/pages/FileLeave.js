import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { leaveAPI, leaveRecordAPI, staffAPI } from '../api';
import LEAVE_TYPE_OPTIONS from '../leaveTypes';

const WELLNESS_ANNUAL_LIMIT = 5;

const getLeaveYear = (leave) => {
  const starts = (Array.isArray(leave?.dateRanges) ? leave.dateRanges : [])
    .map((range) => range?.startDate || range?.from)
    .filter(Boolean)
    .map((value) => new Date(value))
    .filter((date) => !Number.isNaN(date.getTime()))
    .sort((a, b) => a - b);
  const candidates = [starts[0], leave?.startDate, leave?.filingDate, leave?.createdAt];

  for (const candidate of candidates) {
    if (!candidate) continue;
    const date = new Date(candidate);
    if (!Number.isNaN(date.getTime())) return date.getFullYear();
  }

  return new Date().getFullYear();
};

const getLeaveDayCount = (leave) => {
  const explicitDays = Number(leave?.numberOfDays);
  if (Number.isFinite(explicitDays) && explicitDays > 0) return explicitDays;

  return (Array.isArray(leave?.dateRanges) ? leave.dateRanges : []).reduce((total, range) => {
    const start = new Date(range?.startDate || range?.from);
    const end = new Date(range?.endDate || range?.to || range?.startDate || range?.from);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return total;
    return total + Math.floor((end - start) / (1000 * 60 * 60 * 24)) + 1;
  }, 0);
};

function FileLeave({ staffId }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [editingLeaveId, setEditingLeaveId] = useState('');
  const [formData, setFormData] = useState({
    leaveId: '',
    staffId: staffId || '',
    lastName: '',
    firstName: '',
    middleName: '',
    office: '',
    position: '',
    salary: '',
    filingDate: new Date().toISOString().split('T')[0],
    leaveType: [],
    leaveDetails: '',
    leaveDetailsSpecific: {},
    workingDaysApplied: '',
    dateRanges: [
      { startDate: '', endDate: '' }
    ],
    commutationNotRequested: false,
    commutationRequested: false,
    lateFilingExplanation: '',
  });

  const [showLateExplanation, setShowLateExplanation] = useState(false);
  // Check if leave is filed at least 5 days before ANY start date in dateRanges
  useEffect(() => {
    if (formData.dateRanges && formData.filingDate) {
      const filing = new Date(formData.filingDate + 'T00:00:00');
      const anyLate = formData.dateRanges.some(range => {
        if (range.startDate) {
          const start = new Date(range.startDate + 'T00:00:00');
          const diffDays = Math.ceil((start - filing) / (1000 * 3600 * 24));
          return diffDays < 5;
        }
        return false;
      });
      setShowLateExplanation(anyLate);
    } else {
      setShowLateExplanation(false);
    }
  }, [formData.dateRanges, formData.filingDate]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [staffInfo, setStaffInfo] = useState({});
  const [leaveBalances, setLeaveBalances] = useState({ vacation: 0, sick: 0, cto: 0 });
  const [wellnessApprovedByYear, setWellnessApprovedByYear] = useState({});
  const [wellnessBalancesLoading, setWellnessBalancesLoading] = useState(false);
  const [wellnessBalancesError, setWellnessBalancesError] = useState('');
  const [leaveBalancesLoading, setLeaveBalancesLoading] = useState(false);
  const [leaveBalancesError, setLeaveBalancesError] = useState('');

  useEffect(() => {
    if (staffId) {
      fetchStaffName();
    }
  }, [staffId]);

  useEffect(() => {
    if (!staffId) {
      setLeaveBalances({ vacation: 0, sick: 0, cto: 0 });
      setLeaveBalancesError('');
      setWellnessApprovedByYear({});
      setWellnessBalancesLoading(false);
      setWellnessBalancesError('');
      return;
    }

    let active = true;
    const fetchLeaveBalances = async () => {
      setLeaveBalancesLoading(true);
      setLeaveBalancesError('');
      try {
        const response = await leaveRecordAPI.getByStaffId(staffId);
        const records = Array.isArray(response.data?.data)
          ? response.data.data
          : Array.isArray(response.data)
            ? response.data
            : null;

        if (!records) {
          throw new Error('Unexpected leave-record response.');
        }

        let vacationEarned = 0;
        let vacationUsed = 0;
        let sickEarned = 0;
        let sickUsed = 0;
        let cto = 0;

        records.forEach((record) => {
          const particulars = String(record.particulars || '').toLowerCase();
          const vacationLeaveDeduction = ['mandatory/force leave', 'monetization', 'wellness'].includes(particulars)
            ? Number.parseFloat(record.vlAbsentUndertimeWPay) || Number.parseFloat(record.numberOfDays) || 0
            : Number.parseFloat(record.vlAbsentUndertimeWPay) || 0;
          const earnedLeave = particulars.includes('earned leave');
          const vacationRecord = particulars.includes('vacation leave')
            || particulars === 'vl'
            || particulars === 'mandatory/force leave'
            || particulars === 'monetization'
            || particulars === 'wellness'
            || earnedLeave;
          const sickRecord = particulars.includes('sick leave') || particulars === 'sl' || earnedLeave;
          const tardyOrUndertime = particulars.includes('undertime') || particulars.includes('tardy');

          if (vacationRecord) {
            vacationEarned += Number.parseFloat(record.vlEarned) || 0;
            vacationUsed += vacationLeaveDeduction;
          } else if (tardyOrUndertime) {
            vacationUsed += Number.parseFloat(record.vlAbsentUndertimeWPay) || 0;
          }

          if (sickRecord) {
            sickEarned += Number.parseFloat(record.slEarned) || 0;
            sickUsed += Number.parseFloat(record.slAbsentUndertimeWPay) || 0;
          } else if (tardyOrUndertime) {
            sickUsed += Number.parseFloat(record.slAbsentUndertimeWPay) || 0;
          }

          cto += Number.parseFloat(record.cto) || 0;
        });

        if (active) {
          setLeaveBalances({
            vacation: Math.max(0, vacationEarned - vacationUsed),
            sick: Math.max(0, sickEarned - sickUsed),
            cto: Math.max(0, cto),
          });
        }
      } catch (err) {
        console.error('Failed to fetch leave balances:', err);
        if (active) {
          setLeaveBalancesError(err.response?.data?.message || 'Unable to load leave balances.');
        }
      } finally {
        if (active) setLeaveBalancesLoading(false);
      }
    };

    fetchLeaveBalances();
    return () => {
      active = false;
    };
  }, [staffId]);

  useEffect(() => {
    if (!staffId) return undefined;

    let active = true;
    const fetchWellnessUsage = async () => {
      setWellnessBalancesLoading(true);
      setWellnessBalancesError('');
      try {
        const response = await leaveAPI.getByStaffId(staffId);
        const leaves = Array.isArray(response.data) ? response.data : response.data?.data;
        if (!Array.isArray(leaves)) {
          throw new Error('Unexpected leave request response.');
        }

        const approvedByYear = leaves.reduce((totals, leave) => {
          const leaveType = String(leave?.leaveType || '').toLowerCase().replace(/[^a-z0-9]/g, '');
          if (leaveType !== 'wellness' || leave.status !== 'Approved') return totals;
          const year = getLeaveYear(leave);
          totals[year] = (totals[year] || 0) + getLeaveDayCount(leave);
          return totals;
        }, {});

        if (active) setWellnessApprovedByYear(approvedByYear);
      } catch (err) {
        console.error('Failed to fetch approved Wellness Leave usage:', err);
        if (active) {
          setWellnessBalancesError(err.response?.data?.message || 'Unable to load Wellness Leave balance.');
        }
      } finally {
        if (active) setWellnessBalancesLoading(false);
      }
    };

    fetchWellnessUsage();
    return () => {
      active = false;
    };
  }, [staffId]);

  useEffect(() => {
    if (!staffId) {
      return;
    }

    const editId = searchParams.get('edit');
    if (editId) {
      fetchLeaveForEdit(editId);
    } else {
      setEditingLeaveId('');
    }
  }, [staffId, searchParams]);

  useEffect(() => {
    // Calculate total working days for all date ranges
    let totalDays = 0;
    (formData.dateRanges || []).forEach(range => {
      if (range.startDate && range.endDate) {
        const start = new Date(range.startDate + 'T00:00:00');
        const end = new Date(range.endDate + 'T00:00:00');
        if (start <= end) {
          const timeDifference = end - start;
          const daysDifference = Math.floor(timeDifference / (1000 * 3600 * 24)) + 1;
          totalDays += daysDifference;
        }
      }
    });
    setFormData(prev => ({
      ...prev,
      workingDaysApplied: totalDays ? totalDays.toString() : ''
    }));
  }, [formData.dateRanges]);

  const fetchStaffName = async () => {
    try {
      const response = await staffAPI.getById(staffId);
      const staff = response.data;
      setStaffInfo(staff);
      
      // Parse name into parts
      const nameParts = (staff.name || '').trim().split(/\s+/);
      const firstName = nameParts[0] || '';
      const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : '';
      const middleName = nameParts.length > 2 ? nameParts.slice(1, -1).join(' ') : '';
      
      setFormData(prev => ({
        ...prev,
        staffId,
        lastName: lastName,
        firstName: firstName,
        middleName: middleName,
        office: staff.office || staff.department || '',
        position: staff.position || '',
        salary: staff.salary || '',
      }));
    } catch (err) {
      setError('Item Number not found');
    }
  };

  const fetchLeaveForEdit = async (leaveId) => {
    try {
      const response = await leaveAPI.getById(leaveId);
      const leave = response.data;

      if (leave.staffId !== staffId) {
        setError('You can only edit your own leave request');
        return;
      }

      setEditingLeaveId(leave.leaveId);
      setFormData(prev => ({
        ...prev,
        leaveId: leave.leaveId || '',
        staffId,
        office: leave.office || prev.office,
        position: leave.position || prev.position,
        salary: leave.salary ?? prev.salary,
        filingDate: leave.filingDate ? new Date(leave.filingDate).toISOString().split('T')[0] : prev.filingDate,
        leaveType: leave.leaveType ? [leave.leaveType] : [],
        leaveDetails: leave.reason || '',
        leaveDetailsSpecific: leave.leaveDetailsSpecific || {},
        workingDaysApplied: leave.numberOfDays ? String(leave.numberOfDays) : prev.workingDaysApplied,
        startDate: leave.startDate ? new Date(leave.startDate).toISOString().split('T')[0] : '',
        endDate: leave.endDate ? new Date(leave.endDate).toISOString().split('T')[0] : '',
        commutationNotRequested: Boolean(leave.commutationNotRequested),
        commutationRequested: Boolean(leave.commutationRequested),
      }));
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load leave request for editing');
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    if (type === 'radio' && name === 'leaveType') {
      setFormData(prev => ({
        ...prev,
        leaveType: [value],
      }));
    } else if (type === 'checkbox' && (name === 'commutationNotRequested' || name === 'commutationRequested')) {
      setFormData(prev => ({
        ...prev,
        [name]: checked,
      }));
    } else {
      setFormData({
        ...formData,
        [name]: value,
      });
    }
  };

  // Handle change for date ranges
  const handleDateRangeChange = (idx, field, value) => {
    setFormData(prev => {
      const newRanges = prev.dateRanges.map((range, i) =>
        i === idx ? { ...range, [field]: value } : range
      );
      return { ...prev, dateRanges: newRanges };
    });
  };

  // Add new date range
  const addDateRange = () => {
    setFormData(prev => ({
      ...prev,
      dateRanges: [...prev.dateRanges, { startDate: '', endDate: '' }]
    }));
  };

  // Remove a date range
  const removeDateRange = (idx) => {
    setFormData(prev => ({
      ...prev,
      dateRanges: prev.dateRanges.filter((_, i) => i !== idx)
    }));
  };

  const requestedLeaveDays = Number(formData.workingDaysApplied) || 0;
  const selectedLeaveType = formData.leaveType[0] || '';
  const selectedLeaveYear = getLeaveYear({
    startDate: formData.startDate,
    dateRanges: formData.dateRanges,
  });
  const wellnessUsed = wellnessApprovedByYear[selectedLeaveYear] || 0;
  const wellnessBalance = Math.max(0, WELLNESS_ANNUAL_LIMIT - wellnessUsed);
  const isWellnessSelected = selectedLeaveType.toLowerCase() === 'wellness';
  const deduction = (() => {
    const type = selectedLeaveType.toLowerCase();
    if (type === 'wellness') {
      return { label: `Wellness Leave (${selectedLeaveYear})`, balance: wellnessBalance };
    }
    if (
      type === 'vacation leave'
      || type === 'mandatory/force leave'
      || type === 'monetization'
      || type === 'tardy'
      || type === 'undertime'
    ) {
      return { label: 'Vacation Leave', balance: leaveBalances.vacation };
    }
    if (type === 'sick leave') {
      return { label: 'Sick Leave', balance: leaveBalances.sick };
    }
    return null;
  })();
  const projectedBalance = deduction ? deduction.balance - requestedLeaveDays : null;
  const projectedShortfall = deduction ? Math.max(0, requestedLeaveDays - deduction.balance) : 0;
  const formatBalance = (value) => Number(value || 0).toFixed(2);

  const handleLeaveDetailsChange = (key, value) => {
    setFormData(prev => ({
      ...prev,
      leaveDetailsSpecific: {
        ...prev.leaveDetailsSpecific,
        [key]: value,
      }
    }));
  };

  const generateLeaveId = () => {
    return 'LV' + Date.now();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!staffId) {
      setError('Please enter your Item Number in the navigation bar');
      return;
    }

    if (formData.leaveType.length === 0) {
      setError('Please select at least one leave type');
      return;
    }

    // Calculate total days for this filing
    let totalDays = 0;
    formData.dateRanges.forEach(range => {
      if (range.startDate && range.endDate) {
        const start = new Date(range.startDate + 'T00:00:00');
        const end = new Date(range.endDate + 'T00:00:00');
        if (start <= end) {
          const timeDifference = end - start;
          const daysDifference = Math.floor(timeDifference / (1000 * 3600 * 24)) + 1;
          totalDays += daysDifference;
        }
      }
    });
    if (totalDays === 0 && formData.startDate && formData.endDate) {
      const start = new Date(`${formData.startDate}T00:00:00`);
      const end = new Date(`${formData.endDate}T00:00:00`);
      if (start <= end) {
        totalDays = Math.floor((end - start) / (1000 * 3600 * 24)) + 1;
      }
    }

    // Prevent more than 5 days for Force Leave in one application.
    if (formData.leaveType[0] === 'Mandatory/Force Leave' && totalDays > 5) {
      setError('You cannot file more than 5 days of Force Leave in one application.');
      return;
    }

    if (
      formData.leaveType[0] === 'Wellness'
      && wellnessBalancesLoading
    ) {
      setError('Please wait while your Wellness Leave balance is loading.');
      return;
    }

    if (
      formData.leaveType[0] === 'Wellness'
      && !wellnessBalancesError
      && wellnessUsed + totalDays > WELLNESS_ANNUAL_LIMIT
    ) {
      setError(
        `You have ${wellnessBalance} Wellness Leave day(s) remaining in ${selectedLeaveYear}. `
        + `The annual limit is ${WELLNESS_ANNUAL_LIMIT} approved days.`
      );
      return;
    }

    // Prevent filing more than 7 days of paternity leave within a year.
    if (formData.leaveType[0] === 'Paternity Leave') {
      const validStartDates = (formData.dateRanges || [])
        .map((range) => range?.startDate)
        .filter(Boolean)
        .map((value) => new Date(`${value}T00:00:00`))
        .filter((d) => !isNaN(d.getTime()))
        .sort((a, b) => a - b);

      const requestedYear = validStartDates.length > 0
        ? validStartDates[0].getFullYear()
        : new Date().getFullYear();

      const leavesResponse = await leaveAPI.getByStaffId(staffId);
      const existingLeaves = Array.isArray(leavesResponse?.data) ? leavesResponse.data : [];
      const usedPaternityDays = existingLeaves
        .filter((leave) => {
          if (!leave) return false;
          if (editingLeaveId && leave.leaveId === editingLeaveId) return false;

          const normalizedType = String(leave.leaveType || '').trim();
          const isPaternity = normalizedType === 'Paternity Leave' || normalizedType === 'Peternity Leave';
          if (!isPaternity) return false;

          const status = String(leave.status || '').trim();
          const countedStatus = ['Pending', 'Approved', 'For Revision'].includes(status);
          if (!countedStatus) return false;

          const leaveStart = leave.startDate ? new Date(leave.startDate) : null;
          if (!leaveStart || isNaN(leaveStart.getTime())) return false;

          return leaveStart.getFullYear() === requestedYear;
        })
        .reduce((sum, leave) => sum + (Number(leave.numberOfDays) || 0), 0);

      if (usedPaternityDays + totalDays > 7) {
        setError(`You have already filed ${usedPaternityDays} day(s) of Paternity Leave for ${requestedYear}. Maximum allowed is 7 days per year.`);
        return;
      }
    }

    // Prevent filing more than 105 days of maternity leave within a year.
    if (formData.leaveType[0] === 'Maternity Leave') {
      const validStartDates = (formData.dateRanges || [])
        .map((range) => range?.startDate)
        .filter(Boolean)
        .map((value) => new Date(`${value}T00:00:00`))
        .filter((d) => !isNaN(d.getTime()))
        .sort((a, b) => a - b);

      const requestedYear = validStartDates.length > 0
        ? validStartDates[0].getFullYear()
        : new Date().getFullYear();

      const leavesResponse = await leaveAPI.getByStaffId(staffId);
      const existingLeaves = Array.isArray(leavesResponse?.data) ? leavesResponse.data : [];
      const usedMaternityDays = existingLeaves
        .filter((leave) => {
          if (!leave) return false;
          if (editingLeaveId && leave.leaveId === editingLeaveId) return false;

          const normalizedType = String(leave.leaveType || '').trim();
          if (normalizedType !== 'Maternity Leave') return false;

          const status = String(leave.status || '').trim();
          const countedStatus = ['Pending', 'Approved', 'For Revision'].includes(status);
          if (!countedStatus) return false;

          const leaveStart = leave.startDate ? new Date(leave.startDate) : null;
          if (!leaveStart || isNaN(leaveStart.getTime())) return false;

          return leaveStart.getFullYear() === requestedYear;
        })
        .reduce((sum, leave) => sum + (Number(leave.numberOfDays) || 0), 0);

      if (usedMaternityDays + totalDays > 105) {
        setError(`You have already filed ${usedMaternityDays} day(s) of Maternity Leave for ${requestedYear}. Maximum allowed is 105 days per year.`);
        return;
      }
    }

    // Check 5-day prior rule for all date ranges
    if (formData.dateRanges && formData.filingDate) {
      const filing = new Date(formData.filingDate + 'T00:00:00');
      const anyLate = formData.dateRanges.some(range => {
        if (range.startDate) {
          const start = new Date(range.startDate + 'T00:00:00');
          const diffDays = Math.ceil((start - filing) / (1000 * 3600 * 24));
          return diffDays < 5;
        }
        return false;
      });
      if (anyLate && !formData.lateFilingExplanation.trim()) {
        setError('If filing less than 5 days before any leave date, please provide an explanation.');
        return;
      }
    }

    try {
      setLoading(true);
      
      // Combine name fields to create full staff name
      const staffName = `${formData.firstName} ${formData.middleName} ${formData.lastName}`.trim();
      
      // Only submit the fields that the backend expects
      const submitData = {
        leaveId: editingLeaveId || generateLeaveId(),
        staffId: staffId,
        staffName: staffName,
        office: formData.office || null,
        position: formData.position || null,
        salary: formData.salary ? Number(formData.salary) : null,
        filingDate: formData.filingDate || null,
        leaveType: formData.leaveType[0], // Send first selected leave type as string
        dateRanges: formData.dateRanges,
        reason: formData.leaveDetails || null,
        leaveDetailsSpecific: formData.leaveDetailsSpecific || {},
        lateFilingExplanation: formData.lateFilingExplanation || undefined,
        commutationNotRequested: formData.commutationNotRequested,
        commutationRequested: formData.commutationRequested,
      };
      
      if (editingLeaveId) {
        await leaveAPI.update(editingLeaveId, submitData);
        setSuccess('Leave request updated and resubmitted successfully!');
      } else {
        await leaveAPI.create(submitData);
        setSuccess('Leave request filed successfully!');
      }

      setEditingLeaveId('');
      setSearchParams({});
      setFormData({
        leaveId: '',
        staffId,
        lastName: formData.lastName,
        firstName: formData.firstName,
        middleName: formData.middleName,
        office: formData.office,
        position: formData.position,
        salary: formData.salary,
        filingDate: new Date().toISOString().split('T')[0],
        leaveType: [],
        leaveDetails: '',
        leaveDetailsSpecific: {},
        workingDaysApplied: '',
        dateRanges: [{ startDate: '', endDate: '' }],
        commutationNotRequested: false,
        commutationRequested: false,
        lateFilingExplanation: '',
      });
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to file leave');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-6">
      <h1 className="text-3xl font-bold tracking-tight text-blue-950 mb-6">Leave Application Form</h1>

      {error && <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">{error}</div>}
      {success && <div className="mb-4 p-4 bg-green-50 border border-green-200 text-green-700 rounded-lg">{success}</div>}

      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-12">
      <form onSubmit={handleSubmit} className="bg-white p-8 rounded-lg border border-blue-100 shadow-sm space-y-6 xl:col-span-8">
        {/* Section 1: Personal Information */}
        <div className="border-b border-blue-100 pb-6">
          <h2 className="text-xl font-bold text-blue-950 mb-4">Personal Information</h2>
          
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block font-bold mb-2">Last Name *</label>
              <input
                type="text"
                name="lastName"
                value={formData.lastName}
                readOnly
                className="w-full px-4 py-2 border border-blue-100 rounded-md bg-blue-50/60"
              />
            </div>
            <div>
              <label className="block font-bold mb-2">First Name *</label>
              <input
                type="text"
                name="firstName"
                value={formData.firstName}
                readOnly
                className="w-full px-4 py-2 border border-blue-100 rounded-md bg-blue-50/60"
              />
            </div>
            <div>
              <label className="block font-bold mb-2">Middle Name</label>
              <input
                type="text"
                name="middleName"
                value={formData.middleName}
                readOnly
                className="w-full px-4 py-2 border border-blue-100 rounded-md bg-blue-50/60"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block font-bold mb-2">Office/Department *</label>
              <input
                type="text"
                name="office"
                value={formData.office}
                readOnly
                className="w-full px-4 py-2 border border-blue-100 rounded-md bg-blue-50/60"
              />
            </div>
            <div>
              <label className="block font-bold mb-2">Position *</label>
              <input
                type="text"
                name="position"
                value={formData.position}
                readOnly
                className="w-full px-4 py-2 border border-blue-100 rounded-md bg-blue-50/60"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-bold mb-2">Salary (PHP) *</label>
              <input
                type="number"
                name="salary"
                value={formData.salary}
                readOnly
                className="w-full px-4 py-2 border border-blue-100 rounded-md bg-blue-50/60"
              />
            </div>
            <div>
              <label className="block font-bold mb-2">Date of Filing *</label>
              <input
                type="date"
                name="filingDate"
                value={formData.filingDate}
                readOnly
                className="w-full px-4 py-2 border border-blue-100 rounded-md bg-blue-50/60"
              />
            </div>
          </div>
        </div>

        {/* Section 2: Details of Application */}
        <div className="border-b border-blue-100 pb-6">
          <h2 className="text-xl font-bold text-blue-950 mb-4">Details of Application</h2>

          {/* A. Type of Leave to be Availed */}
          <div className="mb-6">
            <label className="block font-bold mb-3">A. Type of Leave to be Availed *</label>
            <div className="grid grid-cols-2 gap-3 bg-blue-50/70 border border-blue-100 p-4 rounded-lg">
              {LEAVE_TYPE_OPTIONS.map(type => (
                <label key={type} className="flex items-center">
                  <input
                    type="radio"
                    name="leaveType"
                    value={type}
                    checked={formData.leaveType[0] === type}
                    onChange={handleChange}
                    className="mr-2"
                  />
                  <span className="text-sm">{type}</span>
                </label>
              ))}
            </div>
          </div>

          {/* B. Details of Leave */}
          <div className="mb-6">
            <label className="block font-bold mb-3">B. Details of Leave</label>
            <div className="bg-blue-50/70 border border-blue-100 p-4 rounded-lg space-y-6">
              {/* Vacation/Special Privilege Leave */}
              <div>
                <label className="block font-semibold mb-3">In case of vacation/special privilege leave (check box):</label>
                <div className="space-y-2 ml-4">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.leaveDetailsSpecific.vacationWithinPH || false}
                      onChange={(e) => handleLeaveDetailsChange('vacationWithinPH', e.target.checked)}
                      className="mr-2"
                    />
                    Within the Philippines
                  </label>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.leaveDetailsSpecific.vacationAbroad || false}
                      onChange={(e) => handleLeaveDetailsChange('vacationAbroad', e.target.checked)}
                      className="mr-2"
                    />
                    Abroad
                  </label>
                </div>
              </div>

              {/* Sick Leave */}
              <div>
                <label className="block font-semibold mb-3">In case of sick leave (check box):</label>
                <div className="space-y-3 ml-4">
                  <div>
                    <label className="flex items-center mb-2">
                      <input
                        type="checkbox"
                        checked={formData.leaveDetailsSpecific.sickInHospital || false}
                        onChange={(e) => handleLeaveDetailsChange('sickInHospital', e.target.checked)}
                        className="mr-2"
                      />
                      In hospital (specify illness)
                    </label>
                    <input
                      type="text"
                      placeholder="specify illness"
                      value={formData.leaveDetailsSpecific.sickInHospitalIllness || ''}
                      onChange={(e) => handleLeaveDetailsChange('sickInHospitalIllness', e.target.value)}
                      className="ml-6 px-3 py-2 border border-blue-200 rounded-md w-80 bg-white"
                      disabled={!formData.leaveDetailsSpecific.sickInHospital}
                    />
                  </div>
                  <div>
                    <label className="flex items-center mb-2">
                      <input
                        type="checkbox"
                        checked={formData.leaveDetailsSpecific.sickOutPatient || false}
                        onChange={(e) => handleLeaveDetailsChange('sickOutPatient', e.target.checked)}
                        className="mr-2"
                      />
                      Out patient (specify illness)
                    </label>
                    <input
                      type="text"
                      placeholder="specify illness"
                      value={formData.leaveDetailsSpecific.sickOutPatientIllness || ''}
                      onChange={(e) => handleLeaveDetailsChange('sickOutPatientIllness', e.target.value)}
                      className="ml-6 px-3 py-2 border border-blue-200 rounded-md w-80 bg-white"
                      disabled={!formData.leaveDetailsSpecific.sickOutPatient}
                    />
                  </div>
                </div>
              </div>

              {/* Special Leave Benefits for Women */}
              <div>
                <label className="block font-semibold mb-2">In case of special leave benefits for women:</label>
                <div className="ml-4">
                  <label className="block mb-2">Specify illness:</label>
                  <input
                    type="text"
                    placeholder="specify illness"
                    value={formData.leaveDetailsSpecific.womenIllness || ''}
                    onChange={(e) => handleLeaveDetailsChange('womenIllness', e.target.value)}
                    className="px-3 py-2 border border-blue-200 rounded-md w-80 bg-white"
                  />
                </div>
              </div>

              {/* Study Leave */}
              <div>
                <label className="block font-semibold mb-3">In case of study leave (check box):</label>
                <div className="space-y-3 ml-4">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.leaveDetailsSpecific.studyMastersDegree || false}
                      onChange={(e) => handleLeaveDetailsChange('studyMastersDegree', e.target.checked)}
                      className="mr-2"
                    />
                    Complementation of master's degree
                  </label>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.leaveDetailsSpecific.studyBoardExam || false}
                      onChange={(e) => handleLeaveDetailsChange('studyBoardExam', e.target.checked)}
                      className="mr-2"
                    />
                    Bar/board examination review
                  </label>
                  <div>
                    <label className="flex items-center mb-2">
                      <input
                        type="checkbox"
                        checked={formData.leaveDetailsSpecific.studyOther || false}
                        onChange={(e) => handleLeaveDetailsChange('studyOther', e.target.checked)}
                        className="mr-2"
                      />
                      Other
                    </label>
                    <input
                      type="text"
                      placeholder="specify other"
                      value={formData.leaveDetailsSpecific.studyOtherDetails || ''}
                      onChange={(e) => handleLeaveDetailsChange('studyOtherDetails', e.target.value)}
                      className="ml-6 px-3 py-2 border border-blue-200 rounded-md w-80 bg-white"
                      disabled={!formData.leaveDetailsSpecific.studyOther}
                    />
                  </div>
                </div>
              </div>

              {/* Purpose */}
              <div>
                <label className="block font-semibold mb-3">Purpose (check box):</label>
                <div className="space-y-2 ml-4">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.leaveDetailsSpecific.purposeMonetization || false}
                      onChange={(e) => handleLeaveDetailsChange('purposeMonetization', e.target.checked)}
                      className="mr-2"
                    />
                    Monetization of leave credits
                  </label>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.leaveDetailsSpecific.purposeTerminal || false}
                      onChange={(e) => handleLeaveDetailsChange('purposeTerminal', e.target.checked)}
                      className="mr-2"
                    />
                    Terminal leave
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* C. Number of Working Days Applied For */}
          <div className="mb-6">
            <label className="block font-bold mb-2">C. Number of Working Days Applied For *</label>
            <input
              type="number"
              name="workingDaysApplied"
              value={formData.workingDaysApplied}
              readOnly
              className="w-full px-4 py-2 border border-blue-100 rounded-md bg-blue-50/60 cursor-not-allowed"
            />
            <p className="text-sm text-gray-600 mt-2">Automatically calculated based on start and end dates (inclusive)</p>
          </div>

          {/* Inclusive Dates (Multiple) */}
          <div className="mb-6">
            <label className="block font-bold mb-2">Inclusive Dates *</label>
            {formData.dateRanges.map((range, idx) => (
              <div key={idx} className="grid grid-cols-2 gap-4 mb-2 items-end">
                <div>
                  <label className="block text-sm font-medium mb-1">Start Date</label>
                  <input
                    type="date"
                    value={range.startDate}
                    onChange={e => handleDateRangeChange(idx, 'startDate', e.target.value)}
                    className="w-full px-4 py-2 border border-blue-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-500 bg-white"
                  />
                </div>
                <div className="flex gap-2 items-end">
                  <div>
                    <label className="block text-sm font-medium mb-1">End Date</label>
                    <input
                      type="date"
                      value={range.endDate}
                      onChange={e => handleDateRangeChange(idx, 'endDate', e.target.value)}
                      className="w-full px-4 py-2 border border-blue-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-500 bg-white"
                    />
                  </div>
                  {formData.dateRanges.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeDateRange(idx)}
                      className="ml-2 px-2 py-1 bg-red-500 text-white rounded-md hover:bg-red-600"
                      title="Remove this date range"
                    >
                      –
                    </button>
                  )}
                  {idx === formData.dateRanges.length - 1 && (
                    <button
                      type="button"
                      onClick={addDateRange}
                      className="ml-2 px-2 py-1 bg-blue-500 text-white rounded-md hover:bg-blue-600"
                      title="Add another date range"
                    >
                      +
                    </button>
                  )}
                </div>
              </div>
            ))}
            <p className="text-sm text-gray-600 mt-2">Add more date ranges for non-consecutive leave days.</p>
          </div>

          {/* D. Commutation */}
          <div>
            <label className="block font-bold mb-3">D. Commutation</label>
            <label className="flex items-center mb-2">
              <input
                type="checkbox"
                name="commutationNotRequested"
                checked={formData.commutationNotRequested}
                onChange={handleChange}
                className="mr-2"
              />
              Not Requested
            </label>
            <label className="flex items-center">
              <input
                type="checkbox"
                name="commutationRequested"
                checked={formData.commutationRequested}
                onChange={handleChange}
                className="mr-2"
              />
              Requested
            </label>
          </div>
        </div>

        {/* Late Filing Explanation logic will need to be updated to check all date ranges, not just the first */}
        {showLateExplanation && (
          <div className="mb-6">
            <label className="block font-bold mb-2 text-red-600">Explanation for Late Filing *</label>
            <textarea
              name="lateFilingExplanation"
              value={formData.lateFilingExplanation}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-red-200 rounded-md focus:outline-none focus:ring-2 focus:ring-red-200 focus:border-red-500"
              rows={3}
              required={showLateExplanation}
              placeholder="Please explain why you are filing less than 5 days before any leave start date."
            />
          </div>
        )}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-500 text-white py-2 rounded-md hover:bg-blue-600 disabled:bg-gray-400 font-semibold"
        >
          {loading ? (editingLeaveId ? 'Updating...' : 'Filing...') : (editingLeaveId ? 'Update & Resubmit Leave Request' : 'File Leave Request')}
        </button>
      </form>

        <aside className="space-y-4 xl:col-span-4 xl:sticky xl:top-4">
          <section className="rounded-lg border border-blue-100 bg-white p-5 shadow-sm">
            <h2 className="text-xl font-bold text-blue-950">Leave Balances</h2>
            <p className="mt-1 text-sm text-slate-600">Current available credits from your leave record.</p>
            {leaveBalancesLoading ? (
              <p className="mt-4 text-sm text-slate-600">Loading leave balances...</p>
            ) : leaveBalancesError ? (
              <p role="alert" className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{leaveBalancesError}</p>
            ) : (
              <div className="mt-4 space-y-3">
                {[
                  ['Vacation Leave', leaveBalances.vacation],
                  ['Sick Leave', leaveBalances.sick],
                  ['CTO', leaveBalances.cto],
                  [`Wellness (${selectedLeaveYear})`, wellnessBalancesLoading
                    ? null
                    : wellnessBalancesError
                      ? 'Unavailable'
                      : wellnessBalance],
                ].map(([label, balance]) => (
                  <div key={label} className="flex items-center justify-between rounded-md bg-blue-50 px-3 py-2">
                    <span className="text-sm font-semibold text-blue-900">{label}</span>
                    <span className="font-bold text-slate-900">
                      {balance === null ? 'Loading...' : typeof balance === 'number' ? `${formatBalance(balance)} days` : balance}
                    </span>
                  </div>
                ))}
              </div>
            )}
            {wellnessBalancesError && (
              <p role="alert" className="mt-3 text-xs text-red-700">{wellnessBalancesError}</p>
            )}
          </section>

          <section className="rounded-lg border border-blue-100 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-bold text-blue-950">Projected Balance</h2>
            <p className="mt-1 text-sm text-slate-600">Estimate if this request is approved.</p>
            {!selectedLeaveType ? (
              <p className="mt-4 text-sm text-slate-600">Select a leave type and enter inclusive dates to see the estimate.</p>
            ) : requestedLeaveDays <= 0 ? (
              <p className="mt-4 text-sm text-slate-600">Enter valid inclusive dates to calculate the requested days.</p>
            ) : isWellnessSelected && wellnessBalancesLoading ? (
              <p className="mt-4 text-sm text-slate-600">Loading your Wellness Leave balance...</p>
            ) : isWellnessSelected && wellnessBalancesError ? (
              <p className="mt-4 text-sm text-red-700">The projected Wellness Leave balance is unavailable because it could not be loaded.</p>
            ) : deduction && leaveBalancesLoading ? (
              <p className="mt-4 text-sm text-slate-600">Loading your current balance to calculate the estimate...</p>
            ) : deduction && leaveBalancesError ? (
              <p className="mt-4 text-sm text-red-700">The projected balance is unavailable because your current leave balance could not be loaded.</p>
            ) : deduction ? (
              <div className="mt-4 space-y-2">
                <div className="flex justify-between gap-3 text-sm">
                  <span className="text-slate-600">{deduction.label} before request</span>
                  <span className="font-semibold">{formatBalance(deduction.balance)} days</span>
                </div>
                <div className="flex justify-between gap-3 text-sm">
                  <span className="text-slate-600">Requested</span>
                  <span className="font-semibold">−{formatBalance(requestedLeaveDays)} days</span>
                </div>
                <div className="flex justify-between gap-3 border-t border-blue-100 pt-2">
                  <span className="font-semibold text-blue-950">Estimated remaining</span>
                  <span className={`font-bold ${projectedBalance < 0 ? 'text-red-700' : 'text-green-700'}`}>
                    {formatBalance(projectedBalance)} days
                  </span>
                </div>
                {projectedShortfall > 0 && (
                  <p className="rounded-md border border-red-200 bg-red-50 p-2 text-sm text-red-700">
                    This request is {formatBalance(projectedShortfall)} day(s) more than your current {deduction.label.toLowerCase()} balance.
                  </p>
                )}
              </div>
            ) : (
              <p className="mt-4 rounded-md bg-slate-50 p-3 text-sm text-slate-600">
                {selectedLeaveType} is not deducted from the Vacation Leave or Sick Leave balances shown here. Any special limits or eligibility rules still apply.
              </p>
            )}
            {selectedLeaveType && requestedLeaveDays > 0 && (
              <p className="mt-3 text-xs text-slate-500">
                Estimate is based on {formatBalance(requestedLeaveDays)} calendar day(s); final approval and leave-record posting may change the result.
              </p>
            )}
          </section>
        </aside>
        </div>
    </div>
  );
}

export default FileLeave;
