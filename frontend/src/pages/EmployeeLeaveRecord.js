import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { TbEye, TbEdit, TbTrash } from 'react-icons/tb';
import { staffAPI, leaveAPI } from '../api';
import { isAdmin, normalizeRole } from '../constants';

function EmployeeLeaveRecord() {
  const [user, setUser] = useState(null);
  const [staffs, setStaffs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [recordsToShow, setRecordsToShow] = useState(10);
  const navigate = useNavigate();

  useEffect(() => {
    const storedUser = JSON.parse(localStorage.getItem('user'));
    setUser(storedUser ? { ...storedUser, role: normalizeRole(storedUser.role) } : storedUser);
    
    // If staff user, redirect directly to their leave record
    if (storedUser.role === 'staff') {
      navigate(`/employee-leave-record/${storedUser.staffId}`, { state: { staffName: storedUser.name } });
      return;
    }
    
    fetchData();
  }, [navigate]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError('');
      const storedUser = JSON.parse(localStorage.getItem('user'));

      if (isAdmin(storedUser.role)) {
        // Admin sees all approved staff
        console.log('[EmployeeLeaveRecord] Fetching all staff...');
        const staffRes = await staffAPI.getAll();
        console.log('[EmployeeLeaveRecord] Staff fetched:', staffRes.data.length, 'staff');
        const approvedStaff = staffRes.data.filter(s => s.isApproved);
        console.log('[EmployeeLeaveRecord] Approved staff:', approvedStaff.length);
        setStaffs(approvedStaff);
      }
    } catch (err) {
      console.error('[EmployeeLeaveRecord] Error loading staff data:', err);
      setError(`Failed to load staff data: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleViewLeaveRecord = (staffId, staffName) => {
    navigate(`/employee-leave-record/${staffId}`, { state: { staffName } });
  };

  const filteredStaffs = staffs.filter(staff =>
    staff.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (staff.employeeId && staff.employeeId.toString().includes(searchQuery)) ||
    (staff.position && staff.position.toLowerCase().includes(searchQuery))
  );

  const displayedStaffs = filteredStaffs.slice(0, recordsToShow);

  if (loading) return <div className="text-center p-8">Loading...</div>;

  return (
    <div className="mt-6">
      <h1 className="text-3xl font-bold mb-6">Employee's Leave Record</h1>

      {error && <div className="mb-4 p-4 bg-red-100 text-red-700 rounded">{error}</div>}

      {/* Search Bar */}
      <div className="mb-6 flex gap-4 items-center">
        <input
          type="text"
          placeholder="Search by name, employee ID, or position..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-1 px-4 py-2 border rounded focus:outline-none focus:border-blue-500"
        />
      </div>

      {/* Table */}
      <div className="bg-white shadow rounded overflow-x-auto">
        {displayedStaffs.length === 0 ? (
          <div className="p-8 text-center text-gray-600">
            {searchQuery ? 'No staff found matching your search.' : 'No staff available.'}
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-blue-100 border-b">
              <tr>
                <th className="px-6 py-3 text-left font-bold text-gray-700">Employee ID</th>
                <th className="px-6 py-3 text-left font-bold text-gray-700">Name</th>
                <th className="px-6 py-3 text-left font-bold text-gray-700">Position</th>
                <th className="px-6 py-3 text-left font-bold text-gray-700">Department</th>
                <th className="px-6 py-3 text-center font-bold text-gray-700">Action</th>
              </tr>
            </thead>
            <tbody>
              {displayedStaffs.map((staff) => (
                <tr key={staff._id} className="border-b hover:bg-gray-50 transition">
                  <td className="px-6 py-4 text-gray-800">{staff.employeeId || 'N/A'}</td>
                  <td className="px-6 py-4 text-gray-800">{staff.name}</td>
                  <td className="px-6 py-4 text-gray-800">{staff.position || 'N/A'}</td>
                  <td className="px-6 py-4 text-gray-800">{staff.department || 'N/A'}</td>
                  <td className="px-6 py-4 text-center">
                    <button
                      onClick={() => handleViewLeaveRecord(staff.id, staff.name)}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
                      title="View Leave Record"
                    >
                      <TbEye size={18} />
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Records Count */}
      {filteredStaffs.length > recordsToShow && (
        <div className="mt-6 flex items-center gap-4">
          <button
            onClick={() => setRecordsToShow(recordsToShow + 10)}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
          >
            Load More
          </button>
          <span className="text-gray-600">
            Showing {displayedStaffs.length} of {filteredStaffs.length} records
          </span>
        </div>
      )}
    </div>
  );
}

export default EmployeeLeaveRecord;
