import React, { useState, useEffect } from 'react';
import { staffAPI } from '../api';

export default function ApprovePendingStaff() {
  const [pendingStaffs, setPendingStaffs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [approving, setApproving] = useState(null);
  const [rejecting, setRejecting] = useState(null);
  const [debugInfo, setDebugInfo] = useState(null);

  useEffect(() => {
    fetchPendingStaffs();
    // Auto-refresh every 5 seconds
    const interval = setInterval(fetchPendingStaffs, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchPendingStaffs = async () => {
    try {
      setLoading(true);
      const response = await staffAPI.getPending();
      console.log('Pending staffs response:', response);
      setPendingStaffs(response.data);
      setError('');
    } catch (err) {
      console.error('Error fetching pending staffs:', err);
      setError(err.response?.data?.message || 'Failed to fetch pending staff registrations. Check your admin privileges.');
      
      // Try debug endpoint
      try {
        const debugResponse = await staffAPI.debugGetAll();
        console.log('Debug response:', debugResponse.data);
        setDebugInfo(debugResponse.data);
      } catch (debugErr) {
        console.error('Debug endpoint error:', debugErr);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (staffId) => {
    try {
      setApproving(staffId);
      await staffAPI.approve(staffId);
      setPendingStaffs(pendingStaffs.filter(s => s.id !== staffId));
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to approve staff');
      console.error('Error approving staff:', err);
    } finally {
      setApproving(null);
    }
  };

  const handleReject = async (staffId) => {
    if (!window.confirm('Are you sure you want to reject this registration? This action cannot be undone.')) {
      return;
    }
    try {
      setRejecting(staffId);
      await staffAPI.reject(staffId);
      setPendingStaffs(pendingStaffs.filter(s => s.id !== staffId));
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to reject staff');
      console.error('Error rejecting staff:', err);
    } finally {
      setRejecting(null);
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-center">
          <p className="text-gray-600">Loading pending staff registrations...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">Account Requests</h1>
        <p className="text-1xl text-gray-400">Review and approve or reject pending staff registration requests</p>
        <div className="mt-4 text-sm text-gray-500">
          <button
            onClick={fetchPendingStaffs}
            className="text-blue-600 hover:text-blue-700 font-medium underline"
          >
            Refresh Now
          </button>
          <span className="ml-4">(Auto-refreshes every 5 seconds)</span>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
          {error}
        </div>
      )}

      {debugInfo && (
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded-lg mb-4 text-sm">
          <p className="font-semibold mb-2">Debug Info:</p>
          <p>Total Staff: {debugInfo.total} | Pending: {debugInfo.pending} | Approved: {debugInfo.approved}</p>
          {debugInfo.pending > 0 && (
            <p className="mt-2 text-red-600">
              ⚠️ There are pending registrations in the database, but the main API returned an error. This suggests a permission issue.
            </p>
          )}
        </div>
      )}

      {pendingStaffs.length === 0 ? (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 text-center">
          <p className="text-blue-700">No pending staff registrations at the moment.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gray-200">
                <th className="border border-gray-300 px-4 py-2 text-left">Staff ID</th>
                <th className="border border-gray-300 px-4 py-2 text-left">Name</th>
                <th className="border border-gray-300 px-4 py-2 text-left">Email</th>
                <th className="border border-gray-300 px-4 py-2 text-left">Position</th>
                <th className="border border-gray-300 px-4 py-2 text-left">Department</th>
                <th className="border border-gray-300 px-4 py-2 text-left">Registered</th>
                <th className="border border-gray-300 px-4 py-2 text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pendingStaffs.map((staff) => (
                <tr key={staff._id} className="hover:bg-gray-50">
                  <td className="border border-gray-300 px-4 py-2 font-medium">{staff.id}</td>
                  <td className="border border-gray-300 px-4 py-2">{staff.name}</td>
                  <td className="border border-gray-300 px-4 py-2">{staff.email}</td>
                  <td className="border border-gray-300 px-4 py-2">{staff.position || '-'}</td>
                  <td className="border border-gray-300 px-4 py-2">{staff.department || '-'}</td>
                  <td className="border border-gray-300 px-4 py-2 text-sm">
                    {new Date(staff.createdAt).toLocaleDateString()}
                  </td>
                  <td className="border border-gray-300 px-4 py-2 text-center space-x-2">
                    <button
                      onClick={() => handleApprove(staff.id)}
                      disabled={approving === staff.id}
                      className="bg-green-500 text-white px-3 py-1 rounded hover:bg-green-600 transition disabled:opacity-50"
                    >
                      {approving === staff.id ? 'Approving...' : 'Approve'}
                    </button>
                    <button
                      onClick={() => handleReject(staff.id)}
                      disabled={rejecting === staff.id}
                      className="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600 transition disabled:opacity-50"
                    >
                      {rejecting === staff.id ? 'Rejecting...' : 'Reject'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
