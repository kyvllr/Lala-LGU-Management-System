import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { leaveAPI, staffAPI } from '../api';

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

  useEffect(() => {
    if (staffId) {
      fetchStaffName();
    }
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
      setError('Staff ID not found');
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
      setError('Please enter your Staff ID in the navigation bar');
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

    // Prevent more than 5 days for force leave in a single filing
    if (formData.leaveType[0] === 'Mandatory/Force Leave' && totalDays > 5) {
      setError('You cannot file more than 5 days for Force Leave in a single application.');
      return;
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
    <div className="mt-6 max-w-4xl">
      <h1 className="text-3xl font-bold mb-6">Leave Application Form</h1>

      {error && <div className="mb-4 p-4 bg-red-100 text-red-700 rounded">{error}</div>}
      {success && <div className="mb-4 p-4 bg-green-100 text-green-700 rounded">{success}</div>}

      <form onSubmit={handleSubmit} className="bg-white p-8 rounded shadow space-y-6">
        {/* Section 1: Personal Information */}
        <div className="border-b pb-6">
          <h2 className="text-xl font-bold mb-4">Personal Information</h2>
          
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block font-bold mb-2">Last Name *</label>
              <input
                type="text"
                name="lastName"
                value={formData.lastName}
                readOnly
                className="w-full px-4 py-2 border rounded bg-gray-100"
              />
            </div>
            <div>
              <label className="block font-bold mb-2">First Name *</label>
              <input
                type="text"
                name="firstName"
                value={formData.firstName}
                readOnly
                className="w-full px-4 py-2 border rounded bg-gray-100"
              />
            </div>
            <div>
              <label className="block font-bold mb-2">Middle Name</label>
              <input
                type="text"
                name="middleName"
                value={formData.middleName}
                readOnly
                className="w-full px-4 py-2 border rounded bg-gray-100"
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
                className="w-full px-4 py-2 border rounded bg-gray-100"
              />
            </div>
            <div>
              <label className="block font-bold mb-2">Position *</label>
              <input
                type="text"
                name="position"
                value={formData.position}
                readOnly
                className="w-full px-4 py-2 border rounded bg-gray-100"
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
                className="w-full px-4 py-2 border rounded bg-gray-100"
              />
            </div>
            <div>
              <label className="block font-bold mb-2">Date of Filing *</label>
              <input
                type="date"
                name="filingDate"
                value={formData.filingDate}
                readOnly
                className="w-full px-4 py-2 border rounded bg-gray-100"
              />
            </div>
          </div>
        </div>

        {/* Section 2: Details of Application */}
        <div className="border-b pb-6">
          <h2 className="text-xl font-bold mb-4">Details of Application</h2>

          {/* A. Type of Leave to be Availed */}
          <div className="mb-6">
            <label className="block font-bold mb-3">A. Type of Leave to be Availed *</label>
            <div className="grid grid-cols-2 gap-3 bg-gray-50 p-4 rounded">
              {[
                'Vacation Leave',
                'Mandatory/Force Leave',
                'Sick Leave',
                'Maternity Leave',
                'Paternity Leave',
                'Special Privilege Leave',
                'Solo Parent Leave',
                'Study Leave',
                '10-Day VAWC Leave',
                'Rehabilitation Privilege',
                'Special Leave Benefits for Women',
                'Special Emergency (Calamity) Leave',
                'Adoption Leave',
                'Tardy',
                'Undertime',
                'Others'
              ].map(type => (
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
            <div className="bg-gray-50 p-4 rounded space-y-6">
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
                      className="ml-6 px-3 py-2 border rounded w-80"
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
                      className="ml-6 px-3 py-2 border rounded w-80"
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
                    className="px-3 py-2 border rounded w-80"
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
                      className="ml-6 px-3 py-2 border rounded w-80"
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
              className="w-full px-4 py-2 border rounded bg-gray-100 cursor-not-allowed"
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
                    className="w-full px-4 py-2 border rounded focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div className="flex gap-2 items-end">
                  <div>
                    <label className="block text-sm font-medium mb-1">End Date</label>
                    <input
                      type="date"
                      value={range.endDate}
                      onChange={e => handleDateRangeChange(idx, 'endDate', e.target.value)}
                      className="w-full px-4 py-2 border rounded focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  {formData.dateRanges.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeDateRange(idx)}
                      className="ml-2 px-2 py-1 bg-red-500 text-white rounded hover:bg-red-600"
                      title="Remove this date range"
                    >
                      –
                    </button>
                  )}
                  {idx === formData.dateRanges.length - 1 && (
                    <button
                      type="button"
                      onClick={addDateRange}
                      className="ml-2 px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
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
              className="w-full px-4 py-2 border rounded focus:outline-none focus:border-red-500"
              rows={3}
              required={showLateExplanation}
              placeholder="Please explain why you are filing less than 5 days before any leave start date."
            />
          </div>
        )}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:bg-gray-400 font-bold"
        >
          {loading ? (editingLeaveId ? 'Updating...' : 'Filing...') : (editingLeaveId ? 'Update & Resubmit Leave Request' : 'File Leave Request')}
        </button>
      </form>
    </div>
  );
}

export default FileLeave;
