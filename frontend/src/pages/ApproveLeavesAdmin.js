import React, { useState, useEffect } from 'react';
import { leaveAPI } from '../api';
import { FiSearch } from 'react-icons/fi';

function ApproveLeavesAdmin() {
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedLeave, setSelectedLeave] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterAttribute, setFilterAttribute] = useState('staffName');
  const [approvalData, setApprovalData] = useState({
    approvedBy: '',
    remarks: '',
    action: 'approve',
  });

  useEffect(() => {
    fetchPendingLeaves();
  }, []);

  const fetchPendingLeaves = async () => {
    try {
      setLoading(true);
      const response = await leaveAPI.getAll('Pending');
      setLeaves(response.data);
    } catch (err) {
      setError('Failed to load leaves');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!approvalData.approvedBy) {
      setError('Approver name is required');
      return;
    }

    try {
      if (approvalData.action === 'approve') {
        await leaveAPI.approve(selectedLeave.leaveId, {
          approvedBy: approvalData.approvedBy,
          remarks: approvalData.remarks,
        });
      } else {
        await leaveAPI.reject(selectedLeave.leaveId, {
          approvedBy: approvalData.approvedBy,
          remarks: approvalData.remarks,
        });
      }

      setLeaves(leaves.filter(l => l.leaveId !== selectedLeave.leaveId));
      setSelectedLeave(null);
      setApprovalData({ approvedBy: '', remarks: '', action: 'approve' });
      setError('');
    } catch (err) {
      setError('Failed to process leave');
    }
  };

  if (loading) return <div className="text-center p-8">Loading...</div>;

  // Filter leaves based on search query and attribute
  const filteredLeaves = leaves.filter((leave) => {
    switch (filterAttribute) {
      case 'staffName':
        return leave.staffName.toLowerCase().includes(searchQuery.toLowerCase());
      case 'leaveType':
        return leave.leaveType.toLowerCase().includes(searchQuery.toLowerCase());
      case 'reason':
        return leave.reason.toLowerCase().includes(searchQuery.toLowerCase());
      case 'numberOfDays':
        return leave.numberOfDays.toString().includes(searchQuery);
      default:
        return true;
    }
  });

  return (
    <div className="mt-6">
      <h1 className="text-3xl font-bold mb-6">Approve Leave Requests</h1>

      {error && <div className="mb-4 p-4 bg-red-100 text-red-700 rounded">{error}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Requests List */}
        <div className="lg:col-span-2">
          {/* Search and Filter Bar */}
          <div className="mb-4 flex gap-2">
            <div className="relative w-96">
              <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                placeholder="Search leave requests..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <select
              value={filterAttribute}
              onChange={(e) => {
                setFilterAttribute(e.target.value);
                setSearchQuery('');
              }}
              className="w-40 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium bg-white cursor-pointer"
            >
              <option value="staffName">Staff Name</option>
              <option value="leaveType">Leave Type</option>
              <option value="reason">Reason</option>
              <option value="numberOfDays">Days</option>
            </select>
          </div>

          <div className="space-y-4">
            {filteredLeaves.map((leave) => (
              <div
                key={leave.leaveId}
                onClick={() => setSelectedLeave(leave)}
                className={`bg-white p-4 rounded shadow cursor-pointer transition ${
                  selectedLeave?.leaveId === leave.leaveId ? 'border-2 border-blue-600' : ''
                }`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-bold">{leave.staffName}</h3>
                    <p className="text-gray-600 text-sm">{leave.leaveType}</p>
                    <p className="text-gray-600 text-sm">
                      {new Date(leave.startDate).toLocaleDateString()} - {new Date(leave.endDate).toLocaleDateString()}
                    </p>
                  </div>
                  <span className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded text-sm">
                    {leave.numberOfDays} days
                  </span>
                </div>
              </div>
            ))}
          </div>

          {filteredLeaves.length === 0 && (
            <div className="text-center p-8 text-gray-600">
              {searchQuery ? 'No leave requests match your search' : 'No pending leave requests'}
            </div>
          )}
        </div>

        {/* Approval Panel */}
        {selectedLeave && (
          <div className="bg-white p-6 rounded shadow">
            <h2 className="text-xl font-bold mb-4">Leave Details</h2>

            <div className="space-y-3 mb-6">
              <div>
                <p className="text-gray-600 text-sm">Staff</p>
                <p className="font-bold">{selectedLeave.staffName}</p>
              </div>
              <div>
                <p className="text-gray-600 text-sm">Type</p>
                <p className="font-bold">{selectedLeave.leaveType}</p>
              </div>
              <div>
                <p className="text-gray-600 text-sm">Duration</p>
                <p className="font-bold">
                  {new Date(selectedLeave.startDate).toLocaleDateString()} - {new Date(selectedLeave.endDate).toLocaleDateString()}
                </p>
              </div>
              <div>
                <p className="text-gray-600 text-sm">Days</p>
                <p className="font-bold">{selectedLeave.numberOfDays}</p>
              </div>
              <div>
                <p className="text-gray-600 text-sm">Reason</p>
                <p>{selectedLeave.reason}</p>
              </div>
            </div>

            <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); handleApprove(); }}>
              <div>
                <label className="block font-bold mb-2">Your Name *</label>
                <input
                  type="text"
                  value={approvalData.approvedBy}
                  onChange={(e) => setApprovalData({...approvalData, approvedBy: e.target.value})}
                  className="w-full px-4 py-2 border rounded focus:outline-none focus:border-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block font-bold mb-2">Remarks</label>
                <textarea
                  value={approvalData.remarks}
                  onChange={(e) => setApprovalData({...approvalData, remarks: e.target.value})}
                  rows="3"
                  className="w-full px-4 py-2 border rounded focus:outline-none focus:border-blue-500"
                ></textarea>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setApprovalData({...approvalData, action: 'approve'})}
                  className={`flex-1 py-2 rounded font-bold ${
                    approvalData.action === 'approve'
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-200'
                  }`}
                >
                  Approve
                </button>
                <button
                  type="button"
                  onClick={() => setApprovalData({...approvalData, action: 'reject'})}
                  className={`flex-1 py-2 rounded font-bold ${
                    approvalData.action === 'reject'
                      ? 'bg-red-600 text-white'
                      : 'bg-gray-200'
                  }`}
                >
                  Reject
                </button>
              </div>

              <button
                type="submit"
                className={`w-full py-2 rounded text-white font-bold ${
                  approvalData.action === 'approve'
                    ? 'bg-green-600 hover:bg-green-700'
                    : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                {approvalData.action === 'approve' ? 'Approve Request' : 'Reject Request'}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}

export default ApproveLeavesAdmin;
