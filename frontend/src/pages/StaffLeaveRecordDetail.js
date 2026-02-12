import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { TbArrowLeft, TbEdit, TbTrash } from 'react-icons/tb';
import { staffAPI, leaveRecordAPI } from '../api';

function StaffLeaveRecordDetail() {
  const { staffId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState(null);
  const [staff, setStaff] = useState(null);
  const [actualStaffId, setActualStaffId] = useState(null);
  const [leaveRecords, setLeaveRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
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

  const staffName = location.state?.staffName || '';

  useEffect(() => {
    const storedUser = JSON.parse(localStorage.getItem('user'));
    setUser(storedUser);
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

    if (user.role !== 'admin') {
      setAddError('Only admins can add leave records');
      console.error('[handleAddRecord] User is not admin');
      return;
    }

    if (!formData.period || !formData.particulars) {
      setAddError('Period and Particulars are required');
      console.error('[handleAddRecord] Missing required fields');
      return;
    }

    // Use the correct staffId from staff data
    const actualStaffId = staff?.id || staff?.staffId || staffId;
    console.log('[handleAddRecord] Using actualStaffId:', actualStaffId);

    try {
      if (editingRecordId) {
        // Update existing record via API
        const updatingRecord = leaveRecords.find(r => r.recordId === editingRecordId || r.id === editingRecordId);
        if (!updatingRecord) {
          setAddError('Record not found');
          return;
        }

        const recordId = updatingRecord.recordId || `LR-${editingRecordId}`;
        console.log('[handleAddRecord] Updating record:', recordId);
        await leaveRecordAPI.update(recordId, {
          period: formData.period,
          particulars: formData.particulars,
          vlEarned: parseFloat(formData.vlEarned) || 0,
          vlAbsentUndertimeWPay: parseFloat(formData.vlAbsentUndertimeWPay) || 0,
          slEarned: parseFloat(formData.slEarned) || 0,
          slAbsentUndertimeWPay: parseFloat(formData.slAbsentUndertimeWPay) || 0,
          cto: formData.cto || '',
        });

        // Refresh records and wait for completion
        console.log('Refreshing leave records after update...');
        await fetchData();
        alert('Leave record updated successfully');
      } else {
        // Add new record via API
        console.log('[handleAddRecord] Creating new record for staffId:', actualStaffId);
        console.log('[handleAddRecord] Form data:', formData);
        const response = await leaveRecordAPI.create({
          staffId: actualStaffId,
          staffName: staff?.name || 'N/A',
          period: formData.period,
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

        alert('Leave record added successfully');
      }

      setShowAddForm(false);
      setEditingRecordId(null);
      setFormData({
        period: '',
        particulars: '',
        vlEarned: '0',
        vlAbsentUndertimeWPay: '',
        slEarned: '0',
        slAbsentUndertimeWPay: '',
        cto: '',
      });
    } catch (err) {
      console.error('Error saving record:', err);
      const errorMsg = err.response?.data?.message || 'Failed to save leave record. Please try again.';
      setAddError(errorMsg);
    }
  };

  const handleDeleteLeave = async (recordId) => {
    if (user.role !== 'admin') {
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
        alert('Leave record deleted successfully');
      } catch (err) {
        console.error('Error deleting record:', err);
        const errorMessage = err.response?.data?.message || 'Failed to delete leave record. Please try again.';
        alert(errorMessage);
      }
    }
  };

  const handleEditLeave = (record) => {
    // Format the date string for input (YYYY-MM-DD)
    const periodDate = record.period ? new Date(record.period).toISOString().split('T')[0] : '';
    
    // Set form data for edit modal
    setEditRecordData({
      period: periodDate,
      particulars: record.particulars,
      vlEarned: record.vlEarned.toString(),
      vlAbsentUndertimeWPay: record.vlAbsentUndertimeWPay.toString(),
      slEarned: record.slEarned.toString(),
      slAbsentUndertimeWPay: record.slAbsentUndertimeWPay.toString(),
      cto: record.cto || '',
    });
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
    if (!newRecordData.period || !newRecordData.particulars) {
      alert('Period and Particulars are required');
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
        period: newRecordData.period,
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
      alert('Leave record added successfully');
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
    if (!editRecordData.period || !editRecordData.particulars) {
      alert('Period and Particulars are required');
      return;
    }

    try {
      if (!editingRecordId) {
        alert('Record ID not found');
        return;
      }

      await leaveRecordAPI.update(editingRecordId, {
        period: editRecordData.period,
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
      alert('Leave record updated successfully');
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

  if (loading) return <div className="text-center p-8">Loading...</div>;

  return (
    <div className="mt-6">
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

      {/* Leave Balance Summary */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-blue-50 p-4 rounded border border-blue-200">
          <p className="text-sm text-gray-600 mb-1">Vacation Leave Balance</p>
          <p className="text-2xl font-bold text-blue-600">{leaveBalance.vacationLeaveBalance.toFixed(2)}</p>
        </div>
        <div className="bg-green-50 p-4 rounded border border-green-200">
          <p className="text-sm text-gray-600 mb-1">Sick Leave Balance</p>
          <p className="text-2xl font-bold text-green-600">{leaveBalance.sickLeaveBalance.toFixed(2)}</p>
        </div>
        <div className="bg-purple-50 p-4 rounded border border-purple-200">
          <p className="text-sm text-gray-600 mb-1">Total Days Used</p>
          <p className="text-2xl font-bold text-purple-600">{(leaveBalance.vacationLeaveAbsent + leaveBalance.sickLeaveAbsent).toFixed(2)}</p>
        </div>
      </div>

      {/* Leave Records Table Section */}
      <div className="mb-6">
        <div className="bg-white rounded shadow overflow-x-auto">
          <table className="w-full">
            <thead className="bg-blue-100 border-b">
              <tr>
                <th className="px-6 py-3 text-left font-bold text-gray-700">Period</th>
                <th className="px-6 py-3 text-left font-bold text-gray-700">Particulars</th>
                <th className="px-6 py-3 text-center font-bold text-gray-700">VL Earned</th>
                <th className="px-6 py-3 text-center font-bold text-gray-700">VL ABSENT W/PAY</th>
                <th className="px-6 py-3 text-center font-bold text-gray-700">SL Earned</th>
                <th className="px-6 py-3 text-center font-bold text-gray-700">SL ABSENT W/PAY</th>
                <th className="px-6 py-3 text-center font-bold text-gray-700">CTO</th>
                {user && user.role === 'admin' && (
                  <th className="px-6 py-3 text-center font-bold text-gray-700">Actions</th>
                )}
              </tr>
            </thead>
            <tbody>
              {leaveRecords.length === 0 && !showAddForm && (
                <tr>
                  <td colSpan={user && user.role === 'admin' ? 8 : 7} className="px-6 py-4 text-center text-gray-600">
                    No leave records found
                  </td>
                </tr>
              )}
              {leaveRecords.map((record) => (
                <tr key={record.id} className="border-b hover:bg-gray-50 transition">
                  <td className="px-6 py-4 text-gray-800">{new Date(record.period).toLocaleDateString()}</td>
                  <td className="px-6 py-4 text-gray-800">{record.particulars}</td>
                  <td className="px-6 py-4 text-center text-gray-800">{record.vlEarned.toFixed(2)}</td>
                  <td className="px-6 py-4 text-center text-gray-800">{record.vlAbsentUndertimeWPay.toFixed(2)}</td>
                  <td className="px-6 py-4 text-center text-gray-800">{record.slEarned.toFixed(2)}</td>
                  <td className="px-6 py-4 text-center text-gray-800">{record.slAbsentUndertimeWPay.toFixed(2)}</td>
                  <td className="px-6 py-4 text-center text-gray-800">{record.cto ? parseFloat(record.cto).toFixed(2) : ''}</td>
                  {user && user.role === 'admin' && (
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
              {showAddForm && user && user.role === 'admin' && (
                <tr className="border-b bg-blue-50">
                  <td className="px-6 py-2">
                    <input
                      type="date"
                      name="period"
                      value={newRecordData.period}
                      onChange={handleNewRecordChange}
                      className="w-full px-2 py-1 border rounded text-sm"
                      required
                    />
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
                      <option value="EL">EL</option>
                      <option value="SL">SL</option>
                      <option value="FL">FL</option>
                      <option value="SPL">SPL</option>
                    </select>
                  </td>
                  <td className="px-6 py-2">
                    <select
                      name="vlEarned"
                      value={newRecordData.vlEarned}
                      onChange={handleNewRecordChange}
                      className="w-full px-2 py-1 border rounded text-sm text-center"
                    >
                      <option value="0">0</option>
                      <option value="1.25">1.25</option>
                    </select>
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
                    <select
                      name="slEarned"
                      value={newRecordData.slEarned}
                      onChange={handleNewRecordChange}
                      className="w-full px-2 py-1 border rounded text-sm text-center"
                    >
                      <option value="0">0</option>
                      <option value="1.25">1.25</option>
                    </select>
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
      {user && user.role === 'admin' && (
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="mt-6 mb-6 px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition font-semibold"
        >
          {showAddForm ? 'Cancel' : 'Add Leave Record'}
        </button>
      )}
      </div>

      {/* Leave Record Summary Table (Reference from image) */}
      <div className="mt-8">
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
                        <td className="px-4 py-2 border">{new Date(record.period).toLocaleDateString()}</td>
                        <td className="px-4 py-2 border">{record.particulars}</td>
                        <td className="px-4 py-2 border text-center font-semibold">{record.vlEarned === 0 ? '' : record.vlEarned.toFixed(2)}</td>
                        <td className="px-4 py-2 border text-center font-semibold">{record.vlAbsentUndertimeWPay === 0 ? '' : record.vlAbsentUndertimeWPay.toFixed(2)}</td>
                        <td className="px-4 py-2 border text-center font-semibold">{vlCumulativeBalance === 0 ? '' : Math.max(0, vlCumulativeBalance).toFixed(2)}</td>
                        <td className="px-4 py-2 border text-center font-semibold">{record.slEarned === 0 ? '' : record.slEarned.toFixed(2)}</td>
                        <td className="px-4 py-2 border text-center font-semibold">{record.slAbsentUndertimeWPay === 0 ? '' : record.slAbsentUndertimeWPay.toFixed(2)}</td>
                        <td className="px-4 py-2 border text-center font-semibold">{slCumulativeBalance === 0 ? '' : Math.max(0, slCumulativeBalance).toFixed(2)}</td>
                      </tr>
                    );
                  })}
                  {/* Total Row */}
                  <tr className="border bg-gray-100 font-bold">
                    <td colSpan="2" className="px-4 py-2 border text-right">TOTAL:</td>
                    <td className="px-4 py-2 border text-center">{leaveBalance.vacationLeaveEarned === 0 ? '' : leaveBalance.vacationLeaveEarned.toFixed(2)}</td>
                    <td className="px-4 py-2 border text-center">{leaveBalance.vacationLeaveAbsent === 0 ? '' : leaveBalance.vacationLeaveAbsent.toFixed(2)}</td>
                    <td className="px-4 py-2 border text-center">{leaveBalance.vacationLeaveBalance === 0 ? '' : leaveBalance.vacationLeaveBalance.toFixed(2)}</td>
                    <td className="px-4 py-2 border text-center">{leaveBalance.sickLeaveEarned === 0 ? '' : leaveBalance.sickLeaveEarned.toFixed(2)}</td>
                    <td className="px-4 py-2 border text-center">{leaveBalance.sickLeaveAbsent === 0 ? '' : leaveBalance.sickLeaveAbsent.toFixed(2)}</td>
                    <td className="px-4 py-2 border text-center">{leaveBalance.sickLeaveBalance === 0 ? '' : leaveBalance.sickLeaveBalance.toFixed(2)}</td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Leave Record Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 w-96 max-h-96 overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">Edit Leave Record</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-1">Period</label>
                <input
                  type="date"
                  name="period"
                  value={editRecordData.period}
                  onChange={handleEditRecordChange}
                  className="w-full px-3 py-2 border rounded"
                  required
                />
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
                  <option value="EL">EL</option>
                  <option value="SL">SL</option>
                  <option value="FL">FL</option>
                  <option value="SPL">SPL</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1">VL Earned</label>
                <select
                  name="vlEarned"
                  value={editRecordData.vlEarned}
                  onChange={handleEditRecordChange}
                  className="w-full px-3 py-2 border rounded"
                >
                  <option value="0">0</option>
                  <option value="1.25">1.25</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1">VL Absent W/PAY</label>
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
                <select
                  name="slEarned"
                  value={editRecordData.slEarned}
                  onChange={handleEditRecordChange}
                  className="w-full px-3 py-2 border rounded"
                >
                  <option value="0">0</option>
                  <option value="1.25">1.25</option>
                </select>
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