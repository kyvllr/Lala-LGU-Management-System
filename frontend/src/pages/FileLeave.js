import React, { useState, useEffect } from 'react';
import { leaveAPI, staffAPI } from '../api';

function FileLeave({ staffId }) {
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
    startDate: '',
    endDate: '',
    communicationNotRequested: false,
    communicationRequested: false,
  });
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
    // Calculate number of days when dates change
    if (formData.startDate && formData.endDate) {
      const start = new Date(formData.startDate + 'T00:00:00');
      const end = new Date(formData.endDate + 'T00:00:00');
      
      if (start <= end) {
        // Calculate total days inclusive
        const timeDifference = end - start;
        const daysDifference = Math.floor(timeDifference / (1000 * 3600 * 24)) + 1;
        
        setFormData(prev => ({
          ...prev,
          workingDaysApplied: daysDifference.toString()
        }));
      }
    }
  }, [formData.startDate, formData.endDate]);

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

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    
    if (type === 'checkbox' && name === 'leaveType') {
      setFormData(prev => ({
        ...prev,
        leaveType: checked
          ? [...prev.leaveType, value]
          : prev.leaveType.filter(type => type !== value)
      }));
    } else if (type === 'checkbox' && (name === 'communicationNotRequested' || name === 'communicationRequested')) {
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

    try {
      setLoading(true);
      
      // Combine name fields to create full staff name
      const staffName = `${formData.firstName} ${formData.middleName} ${formData.lastName}`.trim();
      
      // Only submit the fields that the backend expects
      const submitData = {
        leaveId: generateLeaveId(),
        staffId: staffId,
        staffName: staffName,
        leaveType: formData.leaveType[0], // Send first selected leave type as string
        startDate: formData.startDate || null,
        endDate: formData.endDate || null,
        reason: formData.leaveDetails || null,
      };
      
      await leaveAPI.create(submitData);
      setSuccess('Leave request filed successfully!');
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
        startDate: '',
        endDate: '',
        communicationNotRequested: false,
        communicationRequested: false,
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

          {/* A. Type of Leave */}
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
                'Others'
              ].map(type => (
                <label key={type} className="flex items-center">
                  <input
                    type="checkbox"
                    name="leaveType"
                    value={type}
                    checked={formData.leaveType.includes(type)}
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

          {/* Inclusive Dates */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block font-bold mb-2">Start Date (Inclusive)</label>
              <input
                type="date"
                name="startDate"
                value={formData.startDate}
                onChange={handleChange}
                className="w-full px-4 py-2 border rounded focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block font-bold mb-2">End Date (Inclusive)</label>
              <input
                type="date"
                name="endDate"
                value={formData.endDate}
                onChange={handleChange}
                className="w-full px-4 py-2 border rounded focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* D. Communication */}
          <div>
            <label className="block font-bold mb-3">D. Communication</label>
            <label className="flex items-center mb-2">
              <input
                type="checkbox"
                name="communicationNotRequested"
                checked={formData.communicationNotRequested}
                onChange={handleChange}
                className="mr-2"
              />
              Not Requested
            </label>
            <label className="flex items-center">
              <input
                type="checkbox"
                name="communicationRequested"
                checked={formData.communicationRequested}
                onChange={handleChange}
                className="mr-2"
              />
              Requested
            </label>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:bg-gray-400 font-bold"
        >
          {loading ? 'Filing...' : 'File Leave Request'}
        </button>
      </form>
    </div>
  );
}

export default FileLeave;
