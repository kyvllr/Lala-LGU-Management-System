import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { overtimeAPI, staffAPI } from '../api';
import printOvertimeRequest from '../utils/printOvertimeRequest';

function FileOvertime({ staffId, viewMode = 'all' }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [editingOvertimeId, setEditingOvertimeId] = useState('');
  const [formData, setFormData] = useState({
    overtimeId: '',
    staffId: staffId || '',
    lastName: '',
    firstName: '',
    middleName: '',
    office: '',
    position: '',
    filingDate: new Date().toISOString().split('T')[0],
    purposeOfOvertime: '',
    inclusiveDateStart: '',
    inclusiveDateEnd: '',
    officeStaffPersonnel: false,
    departmentHeadOfficer: false,
    staffDetails: [
      { name: '', position: '' }
    ],
  });

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [staffName, setStaffName] = useState('');
  const [submittedOvertimes, setSubmittedOvertimes] = useState([]);
  const [historySearchAttribute, setHistorySearchAttribute] = useState('overtimeId');
  const [historySearchValue, setHistorySearchValue] = useState('');
  const [selectedOvertime, setSelectedOvertime] = useState(null);

  useEffect(() => {
    if (staffId) {
      fetchStaffName();
      fetchSubmittedOvertimes();
    }
  }, [staffId]);

  useEffect(() => {
    if (!staffId) {
      return;
    }

    const editId = searchParams.get('edit');
    if (editId) {
      fetchOvertimeForEdit(editId);
    } else {
      setEditingOvertimeId('');
    }
  }, [staffId, searchParams]);

  const fetchStaffName = async () => {
    try {
      const response = await staffAPI.getById(staffId);
      const nameParts = (response.data.name || '').split(' ');
      const firstName = nameParts[0] || '';
      const lastName = nameParts[nameParts.length - 1] || '';
      const middleName = nameParts.length > 2 ? nameParts.slice(1, -1).join(' ') : '';

      setStaffName(response.data.name);
      setFormData(prev => ({
        ...prev,
        staffId,
        staffName: response.data.name,
        firstName: firstName,
        lastName: lastName,
        middleName: middleName,
        office: response.data.department || '',
        position: response.data.position || '',
      }));
    } catch (err) {
      setError('Item Number not found');
    }
  };

  const fetchOvertimeForEdit = async (overtimeId) => {
    try {
      const response = await overtimeAPI.getById(overtimeId);
      const overtime = response.data;

      if (overtime.staffId !== staffId) {
        setError('You can only edit your own overtime requests');
        return;
      }

      setEditingOvertimeId(overtimeId);
      setFormData({
        overtimeId: overtime.overtimeId,
        staffId: overtime.staffId,
        lastName: overtime.lastName || '',
        firstName: overtime.firstName || '',
        middleName: overtime.middleName || '',
        office: overtime.office || '',
        position: overtime.position || '',
        filingDate: overtime.filingDate ? new Date(overtime.filingDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
        purposeOfOvertime: overtime.purposeOfOvertime || '',
        inclusiveDateStart: overtime.inclusiveDateStart ? new Date(overtime.inclusiveDateStart).toISOString().split('T')[0] : '',
        inclusiveDateEnd: overtime.inclusiveDateEnd ? new Date(overtime.inclusiveDateEnd).toISOString().split('T')[0] : '',
        officeStaffPersonnel: overtime.officeStaffPersonnel || false,
        departmentHeadOfficer: overtime.departmentHeadOfficer || false,
        staffDetails: overtime.staffDetails && overtime.staffDetails.length > 0 ? overtime.staffDetails : [{ name: '', position: '' }],
      });
    } catch (err) {
      setError('Failed to load overtime for editing');
    }
  };

  const fetchSubmittedOvertimes = async () => {
    try {
      const response = await overtimeAPI.getByStaffId(staffId);
      setSubmittedOvertimes(response.data);
    } catch (err) {
      console.error('Error fetching submitted overtimes:', err);
      setSubmittedOvertimes([]);
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleStaffDetailsChange = (index, field, value) => {
    const updated = [...formData.staffDetails];
    updated[index] = { ...updated[index], [field]: value };
    setFormData(prev => ({
      ...prev,
      staffDetails: updated,
    }));
  };

  const addStaffRow = () => {
    setFormData(prev => ({
      ...prev,
      staffDetails: [...prev.staffDetails, { name: '', position: '' }],
    }));
  };

  const removeStaffRow = (index) => {
    if (formData.staffDetails.length > 1) {
      setFormData(prev => ({
        ...prev,
        staffDetails: prev.staffDetails.filter((_, i) => i !== index),
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      // Validation
      if (!formData.purposeOfOvertime.trim()) {
        setError('Purpose of Overtime is required');
        setLoading(false);
        return;
      }

      if (!formData.inclusiveDateStart || !formData.inclusiveDateEnd) {
        setError('Both start and end dates are required');
        setLoading(false);
        return;
      }

      if (new Date(formData.inclusiveDateEnd) < new Date(formData.inclusiveDateStart)) {
        setError('End date must be after or equal to start date');
        setLoading(false);
        return;
      }

      if (!formData.officeStaffPersonnel && !formData.departmentHeadOfficer) {
        setError('Please check at least one approval type');
        setLoading(false);
        return;
      }

      if (formData.staffDetails.some(detail => !detail.name || !detail.position)) {
        setError('All staff details must have Name and Position');
        setLoading(false);
        return;
      }

      // Generate overtimeId for new records
      const overtimeId = editingOvertimeId || `OT${Date.now()}`;

      const submitData = {
        ...formData,
        overtimeId,
        filingDate: new Date(formData.filingDate).toISOString(),
        inclusiveDateStart: new Date(formData.inclusiveDateStart).toISOString(),
        inclusiveDateEnd: new Date(formData.inclusiveDateEnd).toISOString(),
      };

      if (editingOvertimeId) {
        await overtimeAPI.update(editingOvertimeId, submitData);
        setSuccess('Overtime request updated successfully');
        setEditingOvertimeId('');
      } else {
        await overtimeAPI.create(submitData);
        setSuccess('Overtime request filed successfully');
      }

      // Reset form
      setFormData(prev => ({
        ...prev,
        purposeOfOvertime: '',
        inclusiveDateStart: '',
        inclusiveDateEnd: '',
        officeStaffPersonnel: false,
        departmentHeadOfficer: false,
        staffDetails: [{ name: '', position: '' }],
        filingDate: new Date().toISOString().split('T')[0],
      }));

      // Clear URL params
      setSearchParams({});

      // Refresh submitted overtimes
      setTimeout(() => {
        fetchSubmittedOvertimes();
      }, 500);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to submit overtime request');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setEditingOvertimeId('');
    setSearchParams({});
    setFormData(prev => ({
      ...prev,
      purposeOfOvertime: '',
      inclusiveDateStart: '',
      inclusiveDateEnd: '',
      officeStaffPersonnel: false,
      departmentHeadOfficer: false,
      staffDetails: [{ name: '', position: '' }],
      filingDate: new Date().toISOString().split('T')[0],
    }));
    setError('');
    setSuccess('');
  };

  const handleDeleteOvertime = async (overtimeId) => {
    if (!window.confirm('Are you sure you want to delete this overtime request?')) return;

    try {
      setLoading(true);
      await overtimeAPI.delete(overtimeId);
      setSuccess('Overtime request deleted successfully');
      fetchSubmittedOvertimes();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete overtime request');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Approved':
        return 'bg-green-100 text-green-800';
      case 'Disapproved':
        return 'bg-red-100 text-red-800';
      case 'For Revision':
      case 'Under Review':
        return 'bg-blue-100 text-blue-800';
      case 'Pending':
      default:
        return 'bg-yellow-100 text-yellow-800';
    }
  };

  const getDisplayStatus = (overtime) => {
    if (!overtime) return '';

    // Safeguard for legacy/inconsistent records: only show final Approved/Disapproved on completed stage.
    if (['Approved', 'Disapproved'].includes(overtime.status) && !['Completed', 'completed'].includes(overtime.approvalStage)) {
      return 'Pending';
    }

    if (overtime.status === 'Disapproved') return 'Disapproved';

    return overtime.status;
  };

  const getStageLabel = (overtime) => {
    if (!overtime) return '';
    if (overtime.status === 'Approved') return 'Final Approval Complete';
    if (overtime.status === 'Disapproved') return 'Final Decision: Disapproved';
    if (['BudgetOfficer', 'budget_officer'].includes(overtime.approvalStage) && overtime.status === 'Pending') {
      return 'Forwarded to Budget Officer Review';
    }
    if (['Admin', 'admin'].includes(overtime.approvalStage) && overtime.status === 'Pending') {
      return 'Forwarded to Admin for Final Review';
    }
    if (['HeadOfficer', 'pending', 'head_requisitioning_office'].includes(overtime.approvalStage) && overtime.status === 'Pending') {
      return 'Pending Head Officer Review';
    }
    if (overtime.status === 'For Revision' || overtime.status === 'Under Review') {
      return 'Returned for Revision';
    }
    return '';
  };

  const filteredSubmittedOvertimes = submittedOvertimes.filter((overtime) => {
    const query = historySearchValue.trim().toLowerCase();
    if (!query) {
      return true;
    }

    const filingDate = overtime.filingDate ? new Date(overtime.filingDate).toLocaleDateString() : '';
    const fromDate = overtime.inclusiveDateStart ? new Date(overtime.inclusiveDateStart).toLocaleDateString() : '';
    const toDate = overtime.inclusiveDateEnd ? new Date(overtime.inclusiveDateEnd).toLocaleDateString() : '';

    switch (historySearchAttribute) {
      case 'purpose':
        return String(overtime.purposeOfOvertime || '').toLowerCase().includes(query);
      case 'filingDate':
        return filingDate.toLowerCase().includes(query);
      case 'inclusiveDate':
        return `${fromDate} - ${toDate}`.toLowerCase().includes(query);
      case 'status':
        return String(getDisplayStatus(overtime) || '').toLowerCase().includes(query);
      case 'overtimeId':
      default:
        return String(overtime.overtimeId || '').toLowerCase().includes(query);
    }
  });

  const showRequestSection = viewMode !== 'history';
  const showMyRequestsSection = viewMode !== 'request';

  const canPrintOvertime = (overtime) => {
    if (!overtime) return false;
    return getDisplayStatus(overtime) === 'Approved';
  };

  const pageTitle = showRequestSection
    ? (editingOvertimeId ? 'Edit Overtime Request' : 'File Overtime Request')
    : 'My Overtime Requests';

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold tracking-tight text-blue-950 mb-6">{pageTitle}</h1>

      {error && <div className="mb-4 p-4 bg-red-50 text-red-700 rounded-lg border border-red-200">{error}</div>}
      {success && <div className="mb-4 p-4 bg-green-50 text-green-700 rounded-lg border border-green-200">{success}</div>}

      {showRequestSection && (
      <div className="bg-white rounded-lg border border-blue-100 shadow-sm p-6 mb-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Staff Information Section */}
          <div className="border-b border-blue-100 pb-6">
            <h2 className="text-xl font-bold text-blue-950 mb-4">Staff Information</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Last Name</label>
                <input
                  type="text"
                  name="lastName"
                  value={formData.lastName}
                  disabled
                  className="w-full px-3 py-2 border border-blue-100 rounded-md bg-blue-50/70"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">First Name</label>
                <input
                  type="text"
                  name="firstName"
                  value={formData.firstName}
                  disabled
                  className="w-full px-3 py-2 border border-blue-100 rounded-md bg-blue-50/70"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Middle Name</label>
                <input
                  type="text"
                  name="middleName"
                  value={formData.middleName}
                  disabled
                  className="w-full px-3 py-2 border border-blue-100 rounded-md bg-blue-50/70"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Office/Department</label>
                <input
                  type="text"
                  name="office"
                  value={formData.office}
                  disabled
                  className="w-full px-3 py-2 border border-blue-100 rounded-md bg-blue-50/70"
                />
              </div>
            </div>
            <div className="mt-4">
              <label className="block text-sm font-semibold text-gray-700 mb-2">Position</label>
              <input
                type="text"
                name="position"
                value={formData.position}
                disabled
                className="w-full px-3 py-2 border border-blue-100 rounded-md bg-blue-50/70"
              />
            </div>
          </div>

          {/* Overtime Details Section */}
          <div className="border-b border-blue-100 pb-6">
            <h2 className="text-xl font-bold text-blue-950 mb-4">Overtime Details</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Date of Filing</label>
                <input
                  type="date"
                  name="filingDate"
                  value={formData.filingDate}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-blue-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-500 bg-white"
                  required
                />
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-semibold text-gray-700 mb-2">Purpose of Overtime</label>
              <textarea
                name="purposeOfOvertime"
                value={formData.purposeOfOvertime}
                onChange={handleInputChange}
                rows="4"
                className="w-full px-3 py-2 border border-blue-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-500 bg-white"
                placeholder="Enter the purpose of overtime"
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Inclusive Date Start</label>
                <input
                  type="date"
                  name="inclusiveDateStart"
                  value={formData.inclusiveDateStart}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-blue-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-500 bg-white"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Inclusive Date End</label>
                <input
                  type="date"
                  name="inclusiveDateEnd"
                  value={formData.inclusiveDateEnd}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-blue-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-500 bg-white"
                  required
                />
              </div>
            </div>
          </div>

          {/* Approval Types Section */}
          <div className="border-b border-blue-100 pb-6">
            <h2 className="text-xl font-bold text-blue-950 mb-4">Approval Required From</h2>
            <div className="space-y-3">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  name="officeStaffPersonnel"
                  checked={formData.officeStaffPersonnel}
                  onChange={handleInputChange}
                  className="w-5 h-5"
                />
                <span className="text-gray-700">Office Staff/Personnel</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  name="departmentHeadOfficer"
                  checked={formData.departmentHeadOfficer}
                  onChange={handleInputChange}
                  className="w-5 h-5"
                />
                <span className="text-gray-700">Department Head/Officer-In-Charge</span>
              </label>
            </div>
          </div>

          {/* Staff Details Table Section */}
          <div className="border-b border-blue-100 pb-6">
            <h2 className="text-xl font-bold text-blue-950 mb-4">Staff Involved in Overtime</h2>
            <div className="overflow-x-auto mb-4 rounded-lg border border-blue-100">
              <table className="w-full border-collapse text-[13px] text-slate-700">
                <thead>
                  <tr className="bg-blue-100/80 text-blue-900">
                    <th className="border border-blue-200 px-3 py-2 text-left text-xs font-semibold">No.</th>
                    <th className="border border-blue-200 px-3 py-2 text-left text-xs font-semibold">Name/s</th>
                    <th className="border border-blue-200 px-3 py-2 text-left text-xs font-semibold">Position/Designation</th>
                    <th className="border border-blue-200 px-3 py-2 text-center text-xs font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {formData.staffDetails.map((detail, index) => (
                    <tr key={index} className="border border-blue-100">
                      <td className="border border-blue-100 px-3 py-1.5 text-center">{index + 1}</td>
                      <td className="border border-blue-100 px-3 py-1.5">
                        <input
                          type="text"
                          value={detail.name}
                          onChange={(e) => handleStaffDetailsChange(index, 'name', e.target.value)}
                          placeholder="Full Name"
                          className="w-full px-3 py-2 border border-blue-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-500 bg-white"
                          required
                        />
                      </td>
                      <td className="border border-blue-100 px-3 py-1.5">
                        <input
                          type="text"
                          value={detail.position}
                          onChange={(e) => handleStaffDetailsChange(index, 'position', e.target.value)}
                          placeholder="Position/Designation"
                          className="w-full px-3 py-2 border border-blue-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-500 bg-white"
                          required
                        />
                      </td>
                      <td className="border border-blue-100 px-3 py-1.5 text-center">
                        <button
                          type="button"
                          onClick={() => removeStaffRow(index)}
                          disabled={formData.staffDetails.length === 1}
                          className="px-3 py-1 bg-red-500 text-white rounded-md hover:bg-red-600 disabled:bg-gray-300 transition text-xs font-semibold"
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button
              type="button"
              onClick={addStaffRow}
              className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition text-sm font-semibold"
            >
              + Add Staff Member
            </button>
          </div>

          {/* Form Actions */}
          <div className="flex gap-4 justify-end">
            <button
              type="button"
              onClick={handleCancel}
              className="px-6 py-2 border border-slate-300 rounded-md text-slate-700 hover:bg-slate-100 transition text-sm font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:bg-gray-400 transition text-sm font-semibold"
            >
              {loading ? 'Submitting...' : editingOvertimeId ? 'Update' : 'File Overtime'}
            </button>
          </div>
        </form>
      </div>
      )}

      {/* Submitted Overtimes List */}
      {showMyRequestsSection && (
      <div className="bg-white rounded-lg border border-blue-100 shadow-sm p-6">
        {showRequestSection && <h2 className="text-2xl font-bold text-blue-950 mb-4">My Overtime Requests</h2>}

        <div className="mb-4 flex flex-col sm:flex-row gap-2 rounded-lg border border-blue-100 bg-blue-50/60 p-3">
          <input
            type="text"
            value={historySearchValue}
            onChange={(e) => setHistorySearchValue(e.target.value)}
            placeholder="Search overtime requests..."
            className="w-full sm:flex-1 px-4 py-2 border border-blue-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-500"
          />
          <select
            value={historySearchAttribute}
            onChange={(e) => setHistorySearchAttribute(e.target.value)}
            className="w-full sm:w-56 px-4 py-2 border border-blue-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-500 bg-white"
          >
            <option value="overtimeId">Overtime ID</option>
            <option value="purpose">Purpose</option>
            <option value="filingDate">Filing Date</option>
            <option value="inclusiveDate">Inclusive Date</option>
            <option value="status">Status</option>
          </select>
        </div>
        
        {filteredSubmittedOvertimes.length === 0 ? (
          <p className="text-blue-700 text-center py-8 bg-blue-50 border border-blue-100 rounded-lg">No overtime requests filed yet</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-blue-100">
            <table className="w-full border-collapse text-[13px] text-slate-700">
              <thead>
                <tr className="bg-blue-100/80 text-blue-900">
                  <th className="border border-blue-200 px-3 py-2 text-left text-xs font-semibold">Filing Date</th>
                  <th className="border border-blue-200 px-3 py-2 text-left text-xs font-semibold">Purpose</th>
                  <th className="border border-blue-200 px-3 py-2 text-left text-xs font-semibold">From Date</th>
                  <th className="border border-blue-200 px-3 py-2 text-left text-xs font-semibold">To Date</th>
                  <th className="border border-blue-200 px-3 py-2 text-left text-xs font-semibold">Status</th>
                  <th className="border border-blue-200 px-3 py-2 text-center text-xs font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredSubmittedOvertimes.map((overtime) => (
                  <tr key={overtime.overtimeId} className="border border-blue-100 hover:bg-blue-50/50">
                    <td className="border border-blue-100 px-3 py-1.5">{new Date(overtime.filingDate).toLocaleDateString()}</td>
                    <td className="border border-blue-100 px-3 py-1.5">{overtime.purposeOfOvertime}</td>
                    <td className="border border-blue-100 px-3 py-1.5">{new Date(overtime.inclusiveDateStart).toLocaleDateString()}</td>
                    <td className="border border-blue-100 px-3 py-1.5">{new Date(overtime.inclusiveDateEnd).toLocaleDateString()}</td>
                    <td className="border border-blue-100 px-3 py-1.5">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(getDisplayStatus(overtime))}`}>
                        {getDisplayStatus(overtime)}
                      </span>
                      {getStageLabel(overtime) && (
                        <p className="text-xs text-gray-600 mt-1">{getStageLabel(overtime)}</p>
                      )}
                    </td>
                    <td className="border border-blue-100 px-3 py-1.5 text-center space-x-2">
                      <button
                        onClick={() => {
                          setSelectedOvertime(overtime);
                        }}
                        className="px-3 py-1 bg-green-500 text-white rounded-md hover:bg-green-600 transition inline-block text-xs font-semibold"
                        title="View details"
                      >
                        View
                      </button>
                      {canPrintOvertime(overtime) && (
                        <button
                          onClick={() => printOvertimeRequest(overtime)}
                          className="px-3 py-1 bg-slate-600 text-white rounded-md hover:bg-slate-700 transition inline-block text-xs font-semibold"
                          title="Print approved request"
                        >
                          Print
                        </button>
                      )}
                      {overtime.status !== 'Approved' && overtime.status !== 'Disapproved' && !['BudgetOfficer', 'budget_officer', 'Admin', 'admin'].includes(overtime.approvalStage) && (
                        <>
                          <button
                            onClick={() => setSearchParams({ edit: overtime.overtimeId })}
                            className="px-3 py-1 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition inline-block text-xs font-semibold"
                            title="Edit request"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteOvertime(overtime.overtimeId)}
                            className="px-3 py-1 bg-red-500 text-white rounded-md hover:bg-red-600 transition inline-block text-xs font-semibold"
                            title="Delete request"
                          >
                            Delete
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      )}

      {/* View Details Modal */}
      {selectedOvertime && (
        <div className="fixed inset-0 bg-black/45 backdrop-blur-[1px] flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl border border-blue-100 shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="bg-blue-500 text-white p-6 flex justify-between items-center sticky top-0">
              <h2 className="text-2xl font-bold">Overtime Request Details</h2>
              <button
                onClick={() => setSelectedOvertime(null)}
                className="text-xl hover:text-gray-200 transition"
              >
                ✕
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-6">
              {/* Staff Information */}
              <div className="border-b pb-4">
                <h3 className="text-lg font-bold text-gray-800 mb-4">Staff Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">Full Name</p>
                    <p className="text-lg font-semibold">{`${selectedOvertime.firstName || ''} ${selectedOvertime.lastName || ''}`.trim()}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Position</p>
                    <p className="text-lg font-semibold">{selectedOvertime.position}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Office/Department</p>
                    <p className="text-lg font-semibold">{selectedOvertime.office}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Filing Date</p>
                    <p className="text-lg font-semibold">{new Date(selectedOvertime.filingDate).toLocaleDateString()}</p>
                  </div>
                </div>
              </div>

              {/* Overtime Details */}
              <div className="border-b pb-4">
                <h3 className="text-lg font-bold text-gray-800 mb-4">Overtime Details</h3>
                <div className="space-y-3">
                  <div>
                    <p className="text-sm text-gray-600">Purpose of Overtime</p>
                    <p className="text-gray-800">{selectedOvertime.purposeOfOvertime}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-600">From Date</p>
                      <p className="text-gray-800">{new Date(selectedOvertime.inclusiveDateStart).toLocaleDateString()}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">To Date</p>
                      <p className="text-gray-800">{new Date(selectedOvertime.inclusiveDateEnd).toLocaleDateString()}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Approvals Required */}
              <div className="border-b pb-4">
                <h3 className="text-lg font-bold text-gray-800 mb-4">Position</h3>
                <div className="space-y-2">
                  {selectedOvertime.officeStaffPersonnel && (
                    <div className="flex items-center gap-2">
                      <span className="inline-block w-3 h-3 bg-green-500 rounded-full"></span>
                      <span className="text-gray-800">Office Staff/Personnel</span>
                    </div>
                  )}
                  {selectedOvertime.departmentHeadOfficer && (
                    <div className="flex items-center gap-2">
                      <span className="inline-block w-3 h-3 bg-green-500 rounded-full"></span>
                      <span className="text-gray-800">Department Head/Officer-In-Charge</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Staff Details Table */}
              {selectedOvertime.staffDetails && selectedOvertime.staffDetails.length > 0 && (
                <div className="border-b pb-4">
                  <h3 className="text-lg font-bold text-gray-800 mb-4">Staff Involved in Overtime</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="bg-gray-100">
                          <th className="border px-3 py-2 text-left text-sm font-bold">No.</th>
                          <th className="border px-3 py-2 text-left text-sm font-bold">Name</th>
                          <th className="border px-3 py-2 text-left text-sm font-bold">Position</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedOvertime.staffDetails.map((detail, index) => (
                          <tr key={index} className="border">
                            <td className="border px-3 py-2 text-center text-sm">{index + 1}</td>
                            <td className="border px-3 py-2 text-sm">{detail.name}</td>
                            <td className="border px-3 py-2 text-sm">{detail.position}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Status */}
              <div>
                <p className="text-sm text-gray-600">Current Status</p>
                <p className={`text-lg font-semibold ${getStatusColor(selectedOvertime.status)} px-3 py-1 rounded-full inline-block`}>
                  {selectedOvertime.status}
                </p>
                {getStageLabel(selectedOvertime) && (
                  <p className="text-sm text-gray-600 mt-2">{getStageLabel(selectedOvertime)}</p>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-4 justify-end pt-4 border-t">
                <button
                  onClick={() => setSelectedOvertime(null)}
                  className="px-6 py-2 border border-slate-300 rounded-md text-slate-700 hover:bg-slate-100 transition text-sm font-semibold"
                >
                  Close
                </button>
                {canPrintOvertime(selectedOvertime) && (
                  <button
                    onClick={() => printOvertimeRequest(selectedOvertime)}
                    className="px-6 py-2 bg-slate-600 text-white rounded-md hover:bg-slate-700 transition text-sm font-semibold"
                  >
                    Print
                  </button>
                )}
                {selectedOvertime.status !== 'Approved' && selectedOvertime.status !== 'Disapproved' && (
                  !['Admin', 'admin'].includes(selectedOvertime.approvalStage) && (
                  <button
                    onClick={() => {
                      setSelectedOvertime(null);
                      setSearchParams({ edit: selectedOvertime.overtimeId });
                    }}
                    className="px-6 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition text-sm font-semibold"
                  >
                    Edit
                  </button>
                  )
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default FileOvertime;
