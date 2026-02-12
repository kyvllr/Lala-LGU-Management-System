import React, { useState, useEffect } from 'react';
import { staffAPI, systemAPI } from '../api';

function StaffList() {
  const [staffs, setStaffs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingStaff, setEditingStaff] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchAttribute, setSearchAttribute] = useState('name');
  const [editFormData, setEditFormData] = useState({
    firstName: '',
    middleName: '',
    lastName: '',
    email: '',
    position: '',
    department: '',
    phone: '',
    dateOfBirth: '',
    placeOfBirth: '',
    tinNumber: '',
    password: '',
  });
  const [addFormData, setAddFormData] = useState({
    id: '',
    firstName: '',
    middleName: '',
    lastName: '',
    email: '',
    password: '',
    role: '',
    position: '',
    department: '',
    phone: '',
    dateOfBirth: '',
    placeOfBirth: '',
    tinNumber: '',
  });
  const [rolesAndDepartments, setRolesAndDepartments] = useState(null);

  useEffect(() => {
    fetchStaffs();
    fetchRolesAndDepartments();
  }, []);

  const fetchRolesAndDepartments = async () => {
    try {
      const response = await systemAPI.getRolesAndDepartments();
      setRolesAndDepartments(response.data);
    } catch (err) {
      console.error('Failed to fetch roles and departments:', err);
    }
  };

  const fetchStaffs = async () => {
    try {
      setLoading(true);
      const response = await staffAPI.getAll();
      setStaffs(response.data);
    } catch (err) {
      setError('Failed to load staffs');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const deleteStaff = async (id) => {
    if (window.confirm('Are you sure you want to delete this staff?')) {
      try {
        await staffAPI.delete(id);
        setStaffs(staffs.filter(s => s.id !== id));
      } catch (err) {
        setError('Failed to delete staff');
      }
    }
  };

  const openEditModal = (staff) => {
    // Split name into components
    const nameParts = (staff.name || '').trim().split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts[nameParts.length - 1] || '';
    const middleName = nameParts.slice(1, -1).join(' ') || '';

    setEditingStaff(staff);
    setEditFormData({
      firstName: firstName,
      middleName: middleName,
      lastName: lastName,
      email: staff.email,
      position: staff.position || '',
      department: staff.department || '',
      phone: staff.phone || '',
      dateOfBirth: staff.dateOfBirth || '',
      placeOfBirth: staff.placeOfBirth || '',
      tinNumber: staff.tinNumber || '',
      password: '',
    });
    setShowEditModal(true);
  };

  const handleEditChange = (e) => {
    const { name, value } = e.target;
    setEditFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleAddChange = (e) => {
    const { name, value } = e.target;
    
    // Reset department if role is changed and new role doesn't require department
    if (name === 'role') {
      const requiresDept = rolesAndDepartments?.roles[value]?.requiresDepartment || false;
      setAddFormData(prev => ({
        ...prev,
        [name]: value,
        department: requiresDept ? prev.department : ''
      }));
    } else {
      setAddFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  const handleAddStaff = async () => {
    if (!addFormData.id || !addFormData.firstName || !addFormData.lastName || !addFormData.email || !addFormData.password || !addFormData.role) {
      setError('ID, First Name, Last Name, Email, Password, and Role are required');
      return;
    }

    // Check if department is required for this role
    const selectedRoleData = rolesAndDepartments?.roles[addFormData.role];
    if (selectedRoleData?.requiresDepartment && !addFormData.department) {
      setError('Department is required for this role');
      return;
    }

    try {
      const fullName = `${addFormData.firstName} ${addFormData.middleName} ${addFormData.lastName}`.trim();
      const response = await staffAPI.create({
        id: addFormData.id,
        name: fullName,
        email: addFormData.email,
        password: addFormData.password,
        role: addFormData.role,
        position: addFormData.position,
        department: addFormData.department,
        phone: addFormData.phone,
        dateOfBirth: addFormData.dateOfBirth,
        placeOfBirth: addFormData.placeOfBirth,
        tinNumber: addFormData.tinNumber,
      });
      
      // Refresh staff list
      fetchStaffs();
      setShowAddModal(false);
      setAddFormData({
        id: '',
        firstName: '',
        middleName: '',
        lastName: '',
        email: '',
        password: '',
        role: '',
        position: '',
        department: '',
        phone: '',
        dateOfBirth: '',
        placeOfBirth: '',
        tinNumber: '',
      });
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to add staff');
    }
  };

  const handleSaveEdit = async () => {
    if (!editFormData.firstName || !editFormData.lastName || !editFormData.email) {
      setError('First Name, Last Name, and Email are required');
      return;
    }

    try {
      const fullName = `${editFormData.firstName} ${editFormData.middleName} ${editFormData.lastName}`.trim();
      const updateData = {
        ...editFormData,
        name: fullName,
      };
      // Remove the individual name fields
      delete updateData.firstName;
      delete updateData.middleName;
      delete updateData.lastName;
      // Only include password if it was entered
      if (!updateData.password) {
        delete updateData.password;
      }
      await staffAPI.update(editingStaff.id, updateData);
      const updatedStaff = { ...editingStaff, ...updateData };
      setStaffs(staffs.map(s => 
        s.id === editingStaff.id 
          ? updatedStaff
          : s
      ));

      // Update current user in localStorage if editing own profile
      const currentUser = JSON.parse(localStorage.getItem('user'));
      if (currentUser && currentUser.id === editingStaff.id) {
        const updatedUser = { ...currentUser, ...editFormData };
        localStorage.setItem('user', JSON.stringify(updatedUser));
        // Reload page to reflect changes in header
        window.location.reload();
      }

      setShowEditModal(false);
      setEditingStaff(null);
      setError('');
    } catch (err) {
      setError('Failed to update staff');
      console.error(err);
    }
  };

  // Filter staffs based on search query and selected attribute
  const filteredStaffs = staffs.filter(staff => {
    if (!staff.isApproved) return false;
    if (!searchQuery) return true;

    const searchValue = String(staff[searchAttribute] || '').toLowerCase();
    return searchValue.includes(searchQuery.toLowerCase());
  });

  if (loading) return <div className="text-center p-8">Loading...</div>;
  if (error) return <div className="text-center p-8 text-red-600">{error}</div>;

  return (
    <div className="mt-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Staff Management</h1>
        <button
          onClick={() => setShowAddModal(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 font-semibold flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Staff
        </button>
      </div>
      
      {/* Search Bar with Filters */}
      <div className="mb-6 bg-white p-4 rounded shadow">
        <div className="flex flex-col md:flex-row gap-4 items-end">
          {/* Filter Dropdown */}
          <div className="flex flex-col">
            <label className="text-sm font-semibold text-gray-700 mb-2">Search By</label>
            <select
              value={searchAttribute}
              onChange={(e) => {
                setSearchAttribute(e.target.value);
                setSearchQuery(''); // Clear search when changing attribute
              }}
              className="px-4 py-2 border border-gray-300 rounded focus:outline-none focus:border-blue-500 bg-white"
            >
              <option value="name">Name</option>
              <option value="id">ID</option>
              <option value="email">Email</option>
              <option value="department">Department</option>
              <option value="position">Position</option>
              <option value="phone">Phone</option>
            </select>
          </div>

          {/* Search Input */}
          <div className="flex-1 flex items-center border border-gray-300 rounded overflow-hidden focus-within:border-blue-500">
            <input
              type="text"
              placeholder={`Search by ${searchAttribute}...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 px-4 py-2 focus:outline-none"
            />
            <div className="px-3 text-gray-400">
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
          </div>

          {/* Clear Search Button */}
          {searchQuery && (
            <button
              onClick={() => {
                setSearchQuery('');
                setSearchAttribute('name');
              }}
              className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
            >
              Clear
            </button>
          )}
        </div>
        {searchQuery && (
          <div className="mt-3 text-sm text-gray-600">
            Found {filteredStaffs.length} staff member{filteredStaffs.length !== 1 ? 's' : ''}
          </div>
        )}
      </div>
      
      <div className="overflow-x-auto bg-white rounded shadow">
        <table className="w-full">
          <thead className="bg-gray-100 border-b">
            <tr>
              <th className="p-4 text-left">ID</th>
              <th className="p-4 text-left">Name</th>
              <th className="p-4 text-left">Position</th>
              <th className="p-4 text-left">Department</th>
              <th className="p-4 text-left">Email</th>
              <th className="p-4 text-left">Phone</th>
              <th className="p-4 text-left">Date of Birth</th>
              <th className="p-4 text-left">Place of Birth</th>
              <th className="p-4 text-left">TIN #</th>
              <th className="p-4 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredStaffs.map((staff) => (
              <tr key={staff.id} className="border-b hover:bg-gray-50">
                <td className="p-4 font-mono">{staff.id}</td>
                <td className="p-4">{staff.name}</td>
                <td className="p-4">{staff.position || '-'}</td>
                <td className="p-4">{staff.department || '-'}</td>
                <td className="p-4">{staff.email || '-'}</td>
                <td className="p-4">{staff.phone || '-'}</td>
                <td className="p-4">{staff.dateOfBirth ? new Date(staff.dateOfBirth).toLocaleDateString() : '-'}</td>
                <td className="p-4">{staff.placeOfBirth || '-'}</td>
                <td className="p-4">{staff.tinNumber || '-'}</td>
                <td className="p-4">
                  <div className="flex gap-2">
                    <button
                      onClick={() => openEditModal(staff)}
                      className="text-blue-600 hover:text-blue-800 p-2 hover:bg-blue-50 rounded transition"
                      title="Edit Staff"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => deleteStaff(staff.id)}
                      className="text-red-600 hover:text-red-800 p-2 hover:bg-red-50 rounded transition"
                      title="Delete Staff"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filteredStaffs.length === 0 && (
        <div className="text-center p-8 text-gray-600">
          {searchQuery ? 'No staffs match your search' : 'No approved staffs found'}
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-8 rounded shadow-lg max-w-2xl w-full max-h-screen overflow-y-auto">
            <h2 className="text-2xl font-bold mb-4">Update Staff Information</h2>

            {error && <div className="mb-4 p-4 bg-red-100 text-red-700 rounded">{error}</div>}

            <form className="grid grid-cols-2 gap-4">
              <div>
                <label className="block font-bold mb-2">First Name *</label>
                <input
                  type="text"
                  name="firstName"
                  value={editFormData.firstName}
                  onChange={handleEditChange}
                  className="w-full px-4 py-2 border rounded focus:outline-none focus:border-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block font-bold mb-2">Middle Name</label>
                <input
                  type="text"
                  name="middleName"
                  value={editFormData.middleName}
                  onChange={handleEditChange}
                  className="w-full px-4 py-2 border rounded focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block font-bold mb-2">Last Name *</label>
                <input
                  type="text"
                  name="lastName"
                  value={editFormData.lastName}
                  onChange={handleEditChange}
                  className="w-full px-4 py-2 border rounded focus:outline-none focus:border-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block font-bold mb-2">Email *</label>
                <input
                  type="email"
                  name="email"
                  value={editFormData.email}
                  onChange={handleEditChange}
                  className="w-full px-4 py-2 border rounded focus:outline-none focus:border-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block font-bold mb-2">Position</label>
                <input
                  type="text"
                  name="position"
                  value={editFormData.position}
                  onChange={handleEditChange}
                  className="w-full px-4 py-2 border rounded focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block font-bold mb-2">Department</label>
                <input
                  type="text"
                  name="department"
                  value={editFormData.department}
                  onChange={handleEditChange}
                  className="w-full px-4 py-2 border rounded focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block font-bold mb-2">Phone</label>
                <input
                  type="tel"
                  name="phone"
                  value={editFormData.phone}
                  onChange={handleEditChange}
                  className="w-full px-4 py-2 border rounded focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block font-bold mb-2">Date of Birth</label>
                <input
                  type="date"
                  name="dateOfBirth"
                  value={editFormData.dateOfBirth}
                  onChange={handleEditChange}
                  className="w-full px-4 py-2 border rounded focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block font-bold mb-2">Place of Birth</label>
                <input
                  type="text"
                  name="placeOfBirth"
                  value={editFormData.placeOfBirth}
                  onChange={handleEditChange}
                  className="w-full px-4 py-2 border rounded focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block font-bold mb-2">TIN #</label>
                <input
                  type="text"
                  name="tinNumber"
                  value={editFormData.tinNumber}
                  onChange={handleEditChange}
                  className="w-full px-4 py-2 border rounded focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block font-bold mb-2">Password</label>
                <input
                  type="password"
                  name="password"
                  value={editFormData.password}
                  onChange={handleEditChange}
                  placeholder="Leave empty to keep current password"
                  className="w-full px-4 py-2 border rounded focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="col-span-2 flex gap-2 pt-4">
                <button
                  type="button"
                  onClick={handleSaveEdit}
                  className="flex-1 bg-green-600 text-white py-2 rounded hover:bg-green-700 font-bold"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingStaff(null);
                    setError('');
                  }}
                  className="flex-1 bg-gray-600 text-white py-2 rounded hover:bg-gray-700 font-bold"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Staff Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-8 rounded shadow-lg max-w-2xl w-full max-h-screen overflow-y-auto">
            <h2 className="text-2xl font-bold mb-4">Add New Staff</h2>

            {error && <div className="mb-4 p-4 bg-red-100 text-red-700 rounded">{error}</div>}

            <form className="grid grid-cols-2 gap-4">
              <div>
                <label className="block font-bold mb-2">Staff ID *</label>
                <input
                  type="text"
                  name="id"
                  value={addFormData.id}
                  onChange={handleAddChange}
                  className="w-full px-4 py-2 border rounded focus:outline-none focus:border-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block font-bold mb-2">First Name *</label>
                <input
                  type="text"
                  name="firstName"
                  value={addFormData.firstName}
                  onChange={handleAddChange}
                  className="w-full px-4 py-2 border rounded focus:outline-none focus:border-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block font-bold mb-2">Middle Name</label>
                <input
                  type="text"
                  name="middleName"
                  value={addFormData.middleName}
                  onChange={handleAddChange}
                  className="w-full px-4 py-2 border rounded focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block font-bold mb-2">Last Name *</label>
                <input
                  type="text"
                  name="lastName"
                  value={addFormData.lastName}
                  onChange={handleAddChange}
                  className="w-full px-4 py-2 border rounded focus:outline-none focus:border-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block font-bold mb-2">Email *</label>
                <input
                  type="email"
                  name="email"
                  value={addFormData.email}
                  onChange={handleAddChange}
                  className="w-full px-4 py-2 border rounded focus:outline-none focus:border-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block font-bold mb-2">Password *</label>
                <input
                  type="password"
                  name="password"
                  value={addFormData.password}
                  onChange={handleAddChange}
                  className="w-full px-4 py-2 border rounded focus:outline-none focus:border-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block font-bold mb-2">Role *</label>
                {rolesAndDepartments ? (
                  <select
                    name="role"
                    value={addFormData.role}
                    onChange={handleAddChange}
                    className="w-full px-4 py-2 border rounded focus:outline-none focus:border-blue-500"
                    required
                  >
                    <option value="">Select a role</option>
                    {Object.entries(rolesAndDepartments.roles).map(([roleKey, roleData]) => (
                      <option key={roleKey} value={roleKey}>
                        {roleData.displayName}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    disabled
                    placeholder="Loading roles..."
                    className="w-full px-4 py-2 border rounded bg-gray-100 text-gray-500"
                  />
                )}
              </div>

              <div>
                <label className="block font-bold mb-2">Position</label>
                <input
                  type="text"
                  name="position"
                  value={addFormData.position}
                  onChange={handleAddChange}
                  className="w-full px-4 py-2 border rounded focus:outline-none focus:border-blue-500"
                />
              </div>

              {rolesAndDepartments?.roles[addFormData.role]?.requiresDepartment && (
                <div>
                  <label className="block font-bold mb-2">Department *</label>
                  <select
                    name="department"
                    value={addFormData.department}
                    onChange={handleAddChange}
                    className="w-full px-4 py-2 border rounded focus:outline-none focus:border-blue-500"
                    required
                  >
                    <option value="">Select a department</option>
                    {rolesAndDepartments.departments.map((dept) => (
                      <option key={dept} value={dept}>
                        {dept}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block font-bold mb-2">Phone</label>
                <input
                  type="tel"
                  name="phone"
                  value={addFormData.phone}
                  onChange={handleAddChange}
                  className="w-full px-4 py-2 border rounded focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block font-bold mb-2">Date of Birth</label>
                <input
                  type="date"
                  name="dateOfBirth"
                  value={addFormData.dateOfBirth}
                  onChange={handleAddChange}
                  className="w-full px-4 py-2 border rounded focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block font-bold mb-2">Place of Birth</label>
                <input
                  type="text"
                  name="placeOfBirth"
                  value={addFormData.placeOfBirth}
                  onChange={handleAddChange}
                  className="w-full px-4 py-2 border rounded focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block font-bold mb-2">TIN #</label>
                <input
                  type="text"
                  name="tinNumber"
                  value={addFormData.tinNumber}
                  onChange={handleAddChange}
                  className="w-full px-4 py-2 border rounded focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="col-span-2 flex gap-2 pt-4">
                <button
                  type="button"
                  onClick={handleAddStaff}
                  className="flex-1 bg-blue-600 text-white py-2 rounded hover:bg-blue-700 font-bold"
                >
                  Add Staff
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    setAddFormData({
                      id: '',
                      firstName: '',
                      middleName: '',
                      lastName: '',
                      email: '',
                      password: '',
                      position: '',
                      department: '',
                      phone: '',
                      dateOfBirth: '',
                      placeOfBirth: '',
                      tinNumber: '',
                    });
                    setError('');
                  }}
                  className="flex-1 bg-gray-600 text-white py-2 rounded hover:bg-gray-700 font-bold"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default StaffList;
