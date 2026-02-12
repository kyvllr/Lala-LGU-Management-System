import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { leaveAPI } from '../api';

function MyLeaves({ staffId }) {
  const [searchParams] = useSearchParams();
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterStatus, setFilterStatus] = useState(searchParams.get('status') || '');

  useEffect(() => {
    // Update filter status when query parameter changes
    const statusParam = searchParams.get('status');
    if (statusParam) {
      setFilterStatus(statusParam);
    }
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

  const filteredLeaves = filterStatus ? leaves.filter(l => l.status === filterStatus) : leaves;

  if (!staffId) {
    return <div className="text-center p-8 text-red-600">Please enter your Staff ID in the navigation bar</div>;
  }

  if (loading) return <div className="text-center p-8">Loading...</div>;

  return (
    <div className="mt-6">
      <h1 className="text-3xl font-bold mb-6">My Leave Requests</h1>

      {error && <div className="mb-4 p-4 bg-red-100 text-red-700 rounded">{error}</div>}

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
            value="Rejected"
            checked={filterStatus === 'Rejected'}
            onChange={(e) => setFilterStatus(e.target.value)}
          />
          {' '}Rejected
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
                leave.status === 'Rejected' ? 'bg-red-600' :
                'bg-yellow-600'
              }`}>
                {leave.status}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <p className="text-gray-600 text-sm">From</p>
                <p className="font-bold">{new Date(leave.startDate).toLocaleDateString()}</p>
              </div>
              <div>
                <p className="text-gray-600 text-sm">To</p>
                <p className="font-bold">{new Date(leave.endDate).toLocaleDateString()}</p>
              </div>
              <div>
                <p className="text-gray-600 text-sm">Days</p>
                <p className="font-bold">{leave.numberOfDays}</p>
              </div>
              <div>
                <p className="text-gray-600 text-sm">Reason</p>
                <p className="font-bold">{leave.reason}</p>
              </div>
            </div>

            {leave.status !== 'Pending' && (
              <div className="border-t pt-4">
                <p className="text-gray-600 text-sm">Approved By</p>
                <p className="font-bold">{leave.approvedBy}</p>
                {leave.remarks && (
                  <>
                    <p className="text-gray-600 text-sm mt-2">Remarks</p>
                    <p>{leave.remarks}</p>
                  </>
                )}
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
