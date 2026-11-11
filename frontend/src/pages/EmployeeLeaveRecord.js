import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { TbEye, TbEdit, TbTrash } from 'react-icons/tb';
import { staffAPI, leaveAPI } from '../api';
import { isDepartmentStaffManager, normalizeRole } from '../constants';
import { exportToCsv } from '../exportCsv';
// CSV import utility
function importFromCsv(file, callback) {
  const reader = new FileReader();
  reader.onload = (e) => {
    const text = e.target.result;
    const [headerLine, ...lines] = text.split(/\r?\n/).filter(Boolean);
    const headers = headerLine.split(',').map(h => h.replace(/^"|"$/g, ''));
    const data = lines.map(line => {
      const values = line.match(/("[^"]*"|[^,]+)/g)?.map(v => v.replace(/^"|"$/g, '')) || [];
      const obj = {};
      headers.forEach((h, i) => { obj[h] = values[i] || ''; });
      return obj;
    });
    callback(data);
  };
  reader.readAsText(file);
}

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
    const normalizedUser = storedUser ? { ...storedUser, role: normalizeRole(storedUser.role) } : storedUser;
    setUser(normalizedUser);
    
    // Non-admin users can only view their own leave record
    if (normalizedUser && !isDepartmentStaffManager(normalizedUser.role)) {
      const ownStaffId = normalizedUser.staffId || normalizedUser.id;
      if (!ownStaffId) {
        setError('Unable to determine your Item Number.');
        setLoading(false);
        return;
      }
      navigate(`/employee-leave-record/${ownStaffId}`, { state: { staffName: normalizedUser.name } });
      return;
    }
    
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError('');
      const storedUser = JSON.parse(localStorage.getItem('user'));

      if (isDepartmentStaffManager(storedUser.role)) {
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

  const handleExportCsv = () => {
    if (!staffs.length) return;
    exportToCsv('employee_leave_records.csv', staffs);
  };

  const handleImportCsv = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    importFromCsv(file, (data) => {
      setStaffs(data);
    });
  };

  const filteredStaffs = staffs.filter(staff =>
    staff.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (staff.employeeId && staff.employeeId.toString().includes(searchQuery)) ||
    (staff.position && staff.position.toLowerCase().includes(searchQuery))
  );

  const displayedStaffs = filteredStaffs.slice(0, recordsToShow);

  if (loading) return <div className="text-center p-8 text-blue-700 font-medium">Loading...</div>;

  return (
    <div className="mt-6 space-y-5">
      <h1 className="text-4xl font-bold tracking-tight text-blue-950 mb-6">Employee's Leave Record</h1>

      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm">{error}</div>}

      {/* Search Bar */}
      <div className="mb-6 bg-blue-50/70 border border-blue-100 p-4 rounded-lg shadow-sm">
        <div className="flex flex-col gap-2">
          <label htmlFor="employee-leave-search" className="text-xs font-semibold uppercase tracking-wide text-blue-800">Search Staff</label>
          <input
            id="employee-leave-search"
            type="text"
            placeholder="Search by name, employee ID, or position..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-blue-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-500 bg-white"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-blue-100 shadow-sm rounded-lg overflow-x-auto">
        {displayedStaffs.length === 0 ? (
          <div className="p-8 text-center text-blue-700 bg-blue-50/40">
            {searchQuery ? 'No staff found matching your search.' : 'No staff available.'}
          </div>
        ) : (
          <table className="w-full text-[13px] text-slate-700">
            <thead className="bg-blue-100/80 border-b border-blue-200 text-blue-900">
              <tr>
                <th scope="col" className="px-4 py-2.5 text-left text-xs font-semibold">Employee ID</th>
                <th scope="col" className="px-4 py-2.5 text-left text-xs font-semibold">Name</th>
                <th scope="col" className="px-4 py-2.5 text-left text-xs font-semibold">Position</th>
                <th scope="col" className="px-4 py-2.5 text-left text-xs font-semibold">Department</th>
                <th scope="col" className="px-4 py-2.5 text-center text-xs font-semibold">Action</th>
              </tr>
            </thead>
            <tbody>
              {displayedStaffs.map((staff) => (
                <tr key={staff._id} className="border-b border-blue-50 hover:bg-blue-50/40 transition">
                  <td className="px-4 py-2.5 text-slate-800">{staff.employeeId || 'N/A'}</td>
                  <td className="px-4 py-2.5 text-slate-900 font-medium">{staff.name}</td>
                  <td className="px-4 py-2.5 text-slate-800">{staff.position || 'N/A'}</td>
                  <td className="px-4 py-2.5 text-slate-800">{staff.department || 'N/A'}</td>
                  <td className="px-4 py-2.5 text-center">
                    <button
                      type="button"
                      onClick={() => handleViewLeaveRecord(staff.id, staff.name)}
                      className="inline-flex items-center gap-2 px-3 py-2.5 sm:py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition"
                      title="View Leave Record"
                    >
                      <TbEye size={16} />
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
            className="px-4 py-2.5 sm:py-2 text-sm font-semibold bg-blue-600 text-white rounded-md hover:bg-blue-700 transition"
          >
            Load More
          </button>
          <span className="text-blue-700 text-sm">
            Showing {displayedStaffs.length} of {filteredStaffs.length} records
          </span>
        </div>
      )}
    </div>
  );
}

export default EmployeeLeaveRecord;
