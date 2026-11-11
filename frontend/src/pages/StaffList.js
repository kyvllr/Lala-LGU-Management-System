import React, { useState, useEffect } from 'react';
import { Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from 'recharts';
import { staffAPI, systemAPI } from '../api';
import { ROLES, normalizeRole } from '../constants';
import calculateLengthOfService from '../utils/calculateLengthOfService';

function formatDateForInput(value) {
  if (!value) return '';
  const asString = String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(asString)) return asString;

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toISOString().slice(0, 10);
}

function getAge(dateOfBirth, today = new Date()) {
  if (!dateOfBirth) return null;
  const birthDate = new Date(dateOfBirth);
  if (Number.isNaN(birthDate.getTime()) || birthDate > today) return null;

  let age = today.getFullYear() - birthDate.getFullYear();
  const beforeBirthday = today.getMonth() < birthDate.getMonth()
    || (today.getMonth() === birthDate.getMonth() && today.getDate() < birthDate.getDate());
  if (beforeBirthday) age -= 1;
  return age;
}

function StaffList() {
  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
  const isHeadOfficerUser = normalizeRole(currentUser?.role) === ROLES.HEAD_OFFICER;
  const [staffs, setStaffs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingStaff, setEditingStaff] = useState(null);
  const [selectedStaffId, setSelectedStaffId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchAttribute, setSearchAttribute] = useState('name');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [genderFilter, setGenderFilter] = useState('');
  const [sortAttribute, setSortAttribute] = useState('name');
  const [sortDirection, setSortDirection] = useState('asc');
  const [editFormData, setEditFormData] = useState({
    firstName: '',
    middleName: '',
    lastName: '',
    email: '',
    position: '',
    department: '',
    phone: '',
    dateOfBirth: '',
    sexAtBirth: '',
    dateHired: '',
    placeOfBirth: '',
    tinNumber: '',
    businessPartnerNumber: '',
    philhealthNo: '',
    pagibigNo: '',
    maritalStatus: '',
    address: '',
    employmentStatus: '',
    lengthOfService: '',
    monthlyBasicSalary: '',
    peraRata: '',
    grossSalary: '',
    pendingAdministrativeCase: '',
    pendingCriminalCase: '',
    salaryGrade: '',
    profilePhotoDataUrl: '',
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
    dateHired: '',
    placeOfBirth: '',
    tinNumber: '',
    businessPartnerNumber: '',
    philhealthNo: '',
    pagibigNo: '',
    maritalStatus: '',
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
        setStaffs((currentStaffs) => currentStaffs.filter((staff) => staff.id !== id));
        setSelectedStaffId((currentId) => (currentId === id ? '' : currentId));
        setError('');
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to delete staff');
      }
    }
  };

  const toggleAccountStatus = async (staff) => {
    const nextIsActive = staff.isActive === false;
    const actionLabel = nextIsActive ? 'activate' : 'deactivate';

    if (currentUser?.staffId === staff.id && !nextIsActive) {
      setError('You cannot deactivate your own account');
      return;
    }

    if (!window.confirm(`Are you sure you want to ${actionLabel} ${staff.name}'s account?`)) {
      return;
    }

    try {
      await staffAPI.updateAccountStatus(staff.id, nextIsActive);
      setStaffs((prevStaffs) =>
        prevStaffs.map((existingStaff) =>
          existingStaff.id === staff.id
            ? { ...existingStaff, isActive: nextIsActive }
            : existingStaff
        )
      );
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || `Failed to ${actionLabel} account`);
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
      dateOfBirth: formatDateForInput(staff.dateOfBirth),
      sexAtBirth: staff.sexAtBirth || '',
      dateHired: formatDateForInput(staff.dateHired),
      placeOfBirth: staff.placeOfBirth || '',
      tinNumber: staff.tinNumber || '',
      businessPartnerNumber: staff.businessPartnerNumber || '',
      philhealthNo: staff.philhealthNo || '',
      pagibigNo: staff.pagibigNo || '',
      maritalStatus: staff.maritalStatus || staff.civilStatus || '',
      address: staff.address || '',
      employmentStatus: staff.employmentStatus || '',
      lengthOfService: calculateLengthOfService(formatDateForInput(staff.dateHired)) || staff.lengthOfService || '',
      monthlyBasicSalary: staff.monthlyBasicSalary ?? '',
      peraRata: staff.peraRata ?? '',
      grossSalary: staff.grossSalary ?? '',
      pendingAdministrativeCase: staff.pendingAdministrativeCase == null ? '' : String(staff.pendingAdministrativeCase),
      pendingCriminalCase: staff.pendingCriminalCase == null ? '' : String(staff.pendingCriminalCase),
      salaryGrade: staff.salaryGrade || '',
      profilePhotoDataUrl: staff.profilePhotoDataUrl || '',
      password: '',
    });
    setShowEditModal(true);
    setError('');
  };

  const handleEditChange = (e) => {
    const { name, value } = e.target;
    setEditFormData(prev => ({
      ...prev,
      [name]: value,
      ...(name === 'dateHired' ? { lengthOfService: calculateLengthOfService(value) } : {}),
    }));
  };

  const handleEditProfilePhotoChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('Profile photo must be a JPG, PNG, or WebP image.');
      event.target.value = '';
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Profile photo must be 5 MB or smaller.');
      event.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        setError('Unable to read the selected profile photo.');
        return;
      }
      setError('');
      setEditFormData((previous) => ({ ...previous, profilePhotoDataUrl: reader.result }));
    };
    reader.onerror = () => setError('Unable to read the selected profile photo.');
    reader.readAsDataURL(file);
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
    const targetRole = isHeadOfficerUser ? ROLES.STAFF : addFormData.role;
    const targetDepartment = isHeadOfficerUser ? currentUser.department : addFormData.department;

    if (!addFormData.id || !addFormData.firstName || !addFormData.lastName || !addFormData.email || !addFormData.password || !targetRole) {
      setError('ID, First Name, Last Name, Email, Password, and Role are required');
      return;
    }

    // Check if department is required for this role
    const selectedRoleData = rolesAndDepartments?.roles[targetRole];
    if (selectedRoleData?.requiresDepartment && !targetDepartment) {
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
        role: targetRole,
        position: addFormData.position,
        department: targetDepartment,
        phone: addFormData.phone,
        dateOfBirth: addFormData.dateOfBirth,
        dateHired: addFormData.dateHired,
        placeOfBirth: addFormData.placeOfBirth,
        tinNumber: addFormData.tinNumber,
        businessPartnerNumber: addFormData.businessPartnerNumber,
        philhealthNo: addFormData.philhealthNo,
        pagibigNo: addFormData.pagibigNo,
        maritalStatus: addFormData.maritalStatus,
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
        dateHired: '',
        placeOfBirth: '',
        tinNumber: '',
        businessPartnerNumber: '',
        philhealthNo: '',
        pagibigNo: '',
        maritalStatus: '',
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
        lengthOfService: calculateLengthOfService(editFormData.dateHired) || '',
      };
      // Remove the individual name fields
      delete updateData.firstName;
      delete updateData.middleName;
      delete updateData.lastName;
      // Only include password if it was entered
      if (!updateData.password) {
        delete updateData.password;
      }
      const response = await staffAPI.update(editingStaff.id, updateData);
      const updatedStaff = response.data?.staff
        ? { ...response.data.staff, sexAtBirth: response.data.staff.sexAtBirth || '' }
        : { ...editingStaff, ...updateData };
      setStaffs(staffs.map(s => 
        s.id === editingStaff.id 
          ? updatedStaff
          : s
      ));

      // Update current user in localStorage if editing own profile
      const currentUser = JSON.parse(localStorage.getItem('user'));
      if (currentUser && String(currentUser.staffId || currentUser.id) === String(editingStaff.id)) {
        const updatedUser = { ...currentUser, ...updatedStaff };
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
    if (departmentFilter && staff.department !== departmentFilter) return false;
    if (genderFilter) {
      const gender = String(staff.sexAtBirth || '').trim().toLowerCase();
      if (genderFilter === 'unspecified' ? gender !== '' : gender !== genderFilter) return false;
    }
    if (searchAttribute === 'none' || !searchQuery) return true;

    if (searchAttribute === 'dateHired') {
      const dateHired = staff.dateHired;
      if (!dateHired) return false;

      const parsed = new Date(dateHired);
      const query = searchQuery.toLowerCase();

      return (
        String(dateHired).toLowerCase().includes(query) ||
        (!Number.isNaN(parsed.getTime()) && parsed.toLocaleDateString().toLowerCase().includes(query))
      );
    }

    const searchValue = String(staff[searchAttribute] || '').toLowerCase();
    return searchValue.includes(searchQuery.toLowerCase());
  });

  const sortedStaffs = [...filteredStaffs].sort((first, second) => {
    const firstValue = first[sortAttribute];
    const secondValue = second[sortAttribute];
    let comparison;

    if (sortAttribute === 'dateHired' || sortAttribute === 'dateOfBirth') {
      const firstDate = firstValue ? new Date(firstValue).getTime() : 0;
      const secondDate = secondValue ? new Date(secondValue).getTime() : 0;
      comparison = firstDate - secondDate;
    } else {
      comparison = String(firstValue || '').localeCompare(String(secondValue || ''), undefined, {
        numeric: true,
        sensitivity: 'base',
      });
    }

    return sortDirection === 'asc' ? comparison : -comparison;
  });
  const selectedStaff = sortedStaffs.find((staff) => staff.id === selectedStaffId) || null;

  const reportStaff = filteredStaffs.filter((staff) => staff.isActive !== false);
  const today = new Date();
  const ages = reportStaff.map((staff) => getAge(staff.dateOfBirth, today)).filter((age) => age !== null);
  const averageAge = ages.length ? Math.round(ages.reduce((sum, age) => sum + age, 0) / ages.length) : null;
  const retiringStaffCount = ages.filter((age) => age >= 60).length;
  const genderCounts = reportStaff.reduce((counts, staff) => {
    const gender = String(staff.sexAtBirth || '').trim().toLowerCase();
    if (gender === 'male') counts.Male += 1;
    else if (gender === 'female') counts.Female += 1;
    return counts;
  }, { Male: 0, Female: 0 });
  const genderChartData = [
    { name: 'Male', value: genderCounts.Male },
    { name: 'Female', value: genderCounts.Female },
  ];
  const positionCounts = reportStaff.reduce((counts, staff) => {
    const position = String(staff.position || '').trim() || 'Not specified';
    counts[position] = (counts[position] || 0) + 1;
    return counts;
  }, {});
  const positionChartData = Object.entries(positionCounts)
    .map(([name, value]) => ({ name, value }))
    .sort((first, second) => second.value - first.value);
  const hireCountsByYear = reportStaff.reduce((counts, staff) => {
    if (!staff.dateHired) return counts;
    const date = new Date(staff.dateHired);
    if (Number.isNaN(date.getTime())) return counts;
    const year = String(date.getFullYear());
    counts[year] = (counts[year] || 0) + 1;
    return counts;
  }, {});
  const employmentTrendData = Object.entries(hireCountsByYear)
    .map(([year, hires]) => ({ year, hires }))
    .sort((first, second) => Number(first.year) - Number(second.year));
  const reportColors = ['#2564ebbd', '#ef4444b9', '#10b981ba', '#f59f0bae', '#8a5cf6a1', '#06b5d4a9', '#f1e900bc'];

  if (loading) return <div className="text-center p-8 text-blue-700 font-medium">Loading...</div>;
  return (
    <div className="mt-6 space-y-5">
      <div className="flex flex-wrap justify-between items-center gap-3 mb-6">
        <h1 className="text-4xl font-bold tracking-tight text-blue-950">Staff Management</h1>
        <button
          onClick={() => setShowAddModal(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 font-semibold text-sm flex items-center gap-2 shadow-sm"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Staff
        </button>
      </div>

      {error && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      
      {/* Search Bar with Filters */}
      <div className="mb-6 bg-blue-50/70 border border-blue-100 p-4 rounded-lg shadow-sm">
        <div className="flex flex-col md:flex-row gap-4 items-end">
          {/* Search attribute dropdown */}
          <div className="flex flex-col">
            <label className="text-xs font-semibold uppercase tracking-wide text-blue-800 mb-2">Search by</label>
            <select
              value={searchAttribute}
              onChange={(e) => {
                setSearchAttribute(e.target.value);
                setSearchQuery(''); // Clear search when changing attribute
              }}
              className="px-3 py-2 text-sm border border-blue-200 rounded-md focus:outline-none focus:border-blue-500 bg-white"
            >
              <option value="none">No attribute</option>
              <option value="name">Name</option>
              <option value="id">ID</option>
              <option value="email">Email</option>
              <option value="position">Position</option>
              <option value="phone">Phone</option>
              <option value="dateHired">DOE (Date of Employment)</option>
            </select>
          </div>

          {/* Department filter */}
          <div className="flex flex-col">
            <label className="text-xs font-semibold uppercase tracking-wide text-blue-800 mb-2">Department</label>
            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="px-3 py-2 text-sm border border-blue-200 rounded-md focus:outline-none focus:border-blue-500 bg-white"
            >
              <option value="">All Departments</option>
              {(rolesAndDepartments?.departments || [...new Set(staffs.map((staff) => staff.department).filter(Boolean))])
                .map((department) => (
                  <option key={department} value={department}>{department}</option>
                ))}
            </select>
          </div>

          {/* Gender filter */}
          <div className="flex flex-col">
            <label className="text-xs font-semibold uppercase tracking-wide text-blue-800 mb-2">Gender</label>
            <select
              value={genderFilter}
              onChange={(e) => setGenderFilter(e.target.value)}
              className="px-3 py-2 text-sm border border-blue-200 rounded-md focus:outline-none focus:border-blue-500 bg-white"
            >
              <option value="">All Genders</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="unspecified">Not specified</option>
            </select>
          </div>

          {/* Search Input */}
          <div className="flex-1 flex items-center border border-blue-200 rounded-md overflow-hidden focus-within:border-blue-500 bg-white">
            <input
              type="text"
              placeholder={searchAttribute === 'none' ? 'Select an attribute to search...' : `Search by ${searchAttribute}...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              disabled={searchAttribute === 'none'}
              className="flex-1 px-4 py-2 text-sm text-slate-700 focus:outline-none"
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

        </div>
        <div className="mt-4 flex flex-wrap items-end gap-4 border-t border-blue-100 pt-4">
          <div className="flex flex-col">
            <label className="text-xs font-semibold uppercase tracking-wide text-blue-800 mb-2">Sort by</label>
            <select
              value={sortAttribute}
              onChange={(e) => setSortAttribute(e.target.value)}
              className="px-3 py-2 text-sm border border-blue-200 rounded-md focus:outline-none focus:border-blue-500 bg-white"
            >
              <option value="name">Name</option>
              <option value="id">Item Number</option>
              <option value="position">Position</option>
              <option value="department">Department</option>
              <option value="email">Email</option>
              <option value="dateOfBirth">Date of Birth</option>
              <option value="dateHired">DOE</option>
            </select>
          </div>
          <div className="flex flex-col">
            <label className="text-xs font-semibold uppercase tracking-wide text-blue-800 mb-2">Order</label>
            <select
              value={sortDirection}
              onChange={(e) => setSortDirection(e.target.value)}
              className="px-3 py-2 text-sm border border-blue-200 rounded-md focus:outline-none focus:border-blue-500 bg-white"
            >
              <option value="asc">Ascending</option>
              <option value="desc">Descending</option>
            </select>
          </div>
          <button
            type="button"
            onClick={() => {
              setSearchQuery('');
              setSearchAttribute('name');
              setDepartmentFilter('');
              setGenderFilter('');
              setSortAttribute('name');
              setSortDirection('asc');
            }}
            className="px-4 py-2 text-sm bg-white border border-blue-200 text-blue-700 rounded-md hover:bg-blue-100"
          >
            Clear Filters
          </button>
        </div>
        {(searchQuery || departmentFilter || genderFilter) && (
          <div className="mt-3 text-sm text-blue-700">
            Found {filteredStaffs.length} staff member{filteredStaffs.length !== 1 ? 's' : ''}
          </div>
        )}
      </div>

      <section className="rounded-lg border border-blue-100 bg-white p-4 shadow-sm">
        <h2 className="mb-4 text-xl font-bold text-blue-950">Staff Summary Report</h2>
        <div className="mb-5 grid grid-cols-1 sm:grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            { label: 'Active Staff', value: reportStaff.length },
            { label: 'Average Age', value: averageAge === null ? 'N/A' : `${averageAge} years` },
            { label: 'Age 60 and Older', value: retiringStaffCount },
            { label: 'Positions', value: positionChartData.filter((position) => position.name !== 'Not specified').length },
          ].map((metric) => (
            <div key={metric.label} className="rounded-lg border border-blue-100 bg-blue-50/60 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">{metric.label}</p>
              <p className="mt-1 text-2xl font-bold text-blue-950">{metric.value}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <div className="rounded-lg border border-slate-100 p-3">
            <h3 className="text-sm font-semibold text-slate-800">Staff by Gender</h3>
            {genderChartData.some((entry) => entry.value > 0) ? (
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={genderChartData} dataKey="value" nameKey="name" cx="50%" cy="48%" outerRadius={75} label>
                    {genderChartData.map((entry, index) => (
                      <Cell key={entry.name} fill={reportColors[index]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="flex h-[240px] items-center justify-center text-sm text-slate-500">No gender data available.</p>
            )}
          </div>

          <div className="rounded-lg border border-slate-100 p-3">
            <h3 className="text-sm font-semibold text-slate-800">Staff by Position</h3>
            {positionChartData.length ? (
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={positionChartData} dataKey="value" nameKey="name" cx="50%" cy="48%" outerRadius={75}>
                    {positionChartData.map((entry, index) => (
                      <Cell key={entry.name} fill={reportColors[index % reportColors.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="flex h-[240px] items-center justify-center text-sm text-slate-500">No position data available.</p>
            )}
          </div>

          <div className="rounded-lg border border-slate-100 p-3">
            <h3 className="text-sm font-semibold text-slate-800">Hires by Date of Employment</h3>
            {employmentTrendData.length ? (
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={employmentTrendData} margin={{ top: 12, right: 12, bottom: 4, left: -16 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="year" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Line type="monotone" dataKey="hires" name="Hires" stroke="#2563eb" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="flex h-[240px] items-center justify-center text-sm text-slate-500">No date of employment data available.</p>
            )}
          </div>
        </div>
      </section>
      
      <section className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <div className="overflow-hidden rounded-lg border border-blue-100 bg-white shadow-sm">
          <div className="border-b border-blue-100 bg-blue-50/60 px-4 py-3">
            <h2 className="font-semibold text-blue-950">Staff Accounts</h2>
            <p className="mt-1 text-xs text-slate-600">{sortedStaffs.length} account{sortedStaffs.length === 1 ? '' : 's'}</p>
          </div>
          {filteredStaffs.length === 0 ? (
            <div className="p-8 text-center text-sm text-blue-700">
              {searchQuery || departmentFilter || genderFilter ? 'No staffs match the selected filters' : 'No approved staffs found'}
            </div>
          ) : (
            <div className="max-h-[70vh] overflow-auto">
              <table className="w-full text-[13px] text-slate-700">
                <thead className="sticky top-0 z-10 border-b border-blue-200 bg-blue-100/95 text-blue-900">
                  <tr>
                    <th scope="col" className="px-3 py-2.5 text-left text-xs font-semibold">Item Number</th>
                    <th scope="col" className="px-3 py-2.5 text-left text-xs font-semibold">Name</th>
                    <th scope="col" className="px-3 py-2.5 text-left text-xs font-semibold">Department</th>
                    <th scope="col" className="px-3 py-2.5 text-left text-xs font-semibold">Status</th>
                    <th scope="col" className="px-3 py-2.5 text-left text-xs font-semibold">View</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedStaffs.map((staff) => (
                    <tr
                      key={staff.id}
                      className={`border-b border-blue-50 ${selectedStaffId === staff.id ? 'bg-blue-50' : 'hover:bg-blue-50/40'}`}
                    >
                      <td className="px-3 py-2 font-mono font-semibold text-slate-800">{staff.id}</td>
                      <td className="max-w-[180px] truncate px-3 py-2 font-medium text-slate-900">{staff.name}</td>
                      <td className="px-3 py-2">{staff.department || '-'}</td>
                      <td className="px-3 py-2">
                        <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                          staff.isActive === false ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                        }`}>
                          {staff.isActive === false ? 'Inactive' : 'Active'}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedStaffId(staff.id);
                            setError('');
                          }}
                          aria-pressed={selectedStaffId === staff.id}
                          className={`rounded px-3 py-1 text-xs font-semibold transition ${
                            selectedStaffId === staff.id
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-blue-600 text-white hover:bg-blue-700'
                          }`}
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="min-h-64 rounded-lg border border-blue-100 bg-white shadow-sm">
          {selectedStaff ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-blue-100 bg-blue-50/60 px-5 py-4">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full border border-blue-200 bg-blue-100 text-lg font-semibold text-blue-700">
                    {selectedStaff.profilePhotoDataUrl ? (
                      <img src={selectedStaff.profilePhotoDataUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      (selectedStaff.name || '?').trim().charAt(0).toUpperCase()
                    )}
                  </div>
                  <div className="min-w-0">
                    <h2 className="truncate text-lg font-bold text-blue-950">{selectedStaff.name}</h2>
                    <p className="font-mono text-sm text-slate-600">{selectedStaff.id}</p>
                  </div>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  selectedStaff.isActive === false ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                }`}>
                  {selectedStaff.isActive === false ? 'Inactive' : 'Active'}
                </span>
              </div>

              <div className="grid grid-cols-1 gap-x-6 px-5 py-4 sm:grid-cols-2">
                {[
                  ['Role', selectedStaff.role],
                  ['Position', selectedStaff.position],
                  ['Department', selectedStaff.department],
                  ['Email', selectedStaff.email],
                  ['Phone', selectedStaff.phone],
                  ['Date of Birth', selectedStaff.dateOfBirth ? new Date(selectedStaff.dateOfBirth).toLocaleDateString() : ''],
                  ['Sex', selectedStaff.sexAtBirth],
                  ['Date of Employment', selectedStaff.dateHired ? new Date(selectedStaff.dateHired).toLocaleDateString() : ''],
                  ['Place of Birth', selectedStaff.placeOfBirth],
                  ['TIN', selectedStaff.tinNumber],
                  ['Business Partner Number', selectedStaff.businessPartnerNumber],
                  ['PhilHealth Number', selectedStaff.philhealthNo],
                  ['Pag-IBIG Number', selectedStaff.pagibigNo],
                  ['Marital Status', selectedStaff.maritalStatus || selectedStaff.civilStatus],
                  ['Address', selectedStaff.address],
                  ['Employment Status', selectedStaff.employmentStatus],
                  ['Length of Service', selectedStaff.lengthOfService],
                  ['Salary Grade', selectedStaff.salaryGrade],
                  ['Monthly Basic Salary', selectedStaff.monthlyBasicSalary == null ? '' : `₱${Number(selectedStaff.monthlyBasicSalary).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`],
                  ['PERA/RATA', selectedStaff.peraRata],
                  ['Gross Salary', selectedStaff.grossSalary == null ? '' : `₱${Number(selectedStaff.grossSalary).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`],
                  ['Pending Administrative Case', selectedStaff.pendingAdministrativeCase == null ? '' : selectedStaff.pendingAdministrativeCase ? 'Yes' : 'No'],
                  ['Pending Criminal Case', selectedStaff.pendingCriminalCase == null ? '' : selectedStaff.pendingCriminalCase ? 'Yes' : 'No'],
                ].map(([label, value]) => (
                  <div key={label} className="border-b border-slate-100 py-2.5">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
                    <p className="mt-0.5 break-words text-sm text-slate-900">{value || '-'}</p>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap gap-2 border-t border-blue-100 px-5 py-4">
                <button
                  type="button"
                  onClick={() => openEditModal(selectedStaff)}
                  className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => toggleAccountStatus(selectedStaff)}
                  disabled={currentUser?.staffId === selectedStaff.id && selectedStaff.isActive !== false}
                  className={`rounded-md px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50 ${
                    selectedStaff.isActive === false
                      ? 'bg-green-600 hover:bg-green-700'
                      : 'bg-orange-600 hover:bg-orange-700'
                  }`}
                >
                  {selectedStaff.isActive === false ? 'Activate Account' : 'Deactivate Account'}
                </button>
                <button
                  type="button"
                  onClick={() => deleteStaff(selectedStaff.id)}
                  className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
                >
                  Delete
                </button>
              </div>
            </>
          ) : (
            <div className="flex min-h-64 flex-col items-center justify-center px-6 text-center">
              <h2 className="text-lg font-semibold text-slate-800">Account Details</h2>
              <p className="mt-2 text-sm text-slate-500">Select an account from the list and choose View to see its details and actions.</p>
            </div>
          )}
        </div>
      </section>

      {/* Edit Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-slate-900/45 flex items-center justify-center z-50 p-4 backdrop-blur-[1px]">
          <div role="dialog" aria-modal="true" aria-labelledby="edit-staff-modal-title" className="bg-white p-4 sm:p-6 rounded-xl border border-blue-100 shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <h2 id="edit-staff-modal-title" className="text-2xl font-bold tracking-tight text-blue-950 mb-4">Update Staff Information</h2>

            {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm">{error}</div>}

            <form className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2 flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-blue-100 border border-blue-200 overflow-hidden flex items-center justify-center text-blue-700 flex-shrink-0">
                  {editFormData.profilePhotoDataUrl ? (
                    <img src={editFormData.profilePhotoDataUrl} alt="Profile preview" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-xl font-semibold">
                      {(editFormData.firstName?.[0] || '') + (editFormData.lastName?.[0] || '')}
                    </span>
                  )}
                </div>
                <div className="min-w-0">
                  <label className="block text-sm font-semibold text-blue-900 mb-1.5">Profile Photo</label>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleEditProfilePhotoChange}
                    className="block w-full text-sm text-gray-700"
                  />
                  <p className="mt-1 text-xs text-gray-500">JPG, PNG, or WebP; maximum 5 MB.</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-blue-900 mb-1.5">First Name *</label>
                <input
                  type="text"
                  name="firstName"
                  value={editFormData.firstName}
                  onChange={handleEditChange}
                  className="w-full px-3 py-2 text-sm border border-blue-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-blue-900 mb-1.5">Middle Name</label>
                <input
                  type="text"
                  name="middleName"
                  value={editFormData.middleName}
                  onChange={handleEditChange}
                  className="w-full px-3 py-2 text-sm border border-blue-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-blue-900 mb-1.5">Last Name *</label>
                <input
                  type="text"
                  name="lastName"
                  value={editFormData.lastName}
                  onChange={handleEditChange}
                  className="w-full px-3 py-2 text-sm border border-blue-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-blue-900 mb-1.5">Email *</label>
                <input
                  type="email"
                  name="email"
                  value={editFormData.email}
                  onChange={handleEditChange}
                  className="w-full px-3 py-2 text-sm border border-blue-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-blue-900 mb-1.5">Item Number (ID)</label>
                <input
                  type="text"
                  value={editingStaff?.id || ''}
                  readOnly
                  className="w-full px-3 py-2 text-sm border border-blue-200 rounded-md bg-slate-50 text-slate-600"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-blue-900 mb-1.5">Position</label>
                <input
                  type="text"
                  name="position"
                  value={editFormData.position}
                  onChange={handleEditChange}
                  className="w-full px-3 py-2 text-sm border border-blue-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-blue-900 mb-1.5">Department</label>
                <input
                  type="text"
                  name="department"
                  value={editFormData.department}
                  onChange={handleEditChange}
                  className="w-full px-3 py-2 text-sm border border-blue-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-blue-900 mb-1.5">Phone</label>
                <input
                  type="tel"
                  name="phone"
                  value={editFormData.phone}
                  onChange={handleEditChange}
                  className="w-full px-3 py-2 text-sm border border-blue-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-blue-900 mb-1.5">Date of Birth</label>
                <input
                  type="date"
                  name="dateOfBirth"
                  value={editFormData.dateOfBirth}
                  onChange={handleEditChange}
                  className="w-full px-3 py-2 text-sm border border-blue-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-blue-900 mb-1.5">Sex</label>
                <select
                  name="sexAtBirth"
                  value={editFormData.sexAtBirth}
                  onChange={handleEditChange}
                  className="w-full px-3 py-2 text-sm border border-blue-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-500"
                >
                  <option value="">Not specified</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-blue-900 mb-1.5">Age</label>
                <input
                  type="text"
                  value={getAge(editFormData.dateOfBirth) ?? ''}
                  readOnly
                  className="w-full px-3 py-2 text-sm border border-blue-200 rounded-md bg-slate-50 text-slate-600"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-blue-900 mb-1.5">DOE (Date of Employment)</label>
                <input
                  type="date"
                  name="dateHired"
                  value={editFormData.dateHired}
                  onChange={handleEditChange}
                  className="w-full px-3 py-2 text-sm border border-blue-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-blue-900 mb-1.5">Status of Employment</label>
                <input
                  type="text"
                  name="employmentStatus"
                  value={editFormData.employmentStatus}
                  onChange={handleEditChange}
                  className="w-full px-3 py-2 text-sm border border-blue-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-blue-900 mb-1.5">Length of Service</label>
                <input
                  type="text"
                  name="lengthOfService"
                  value={editFormData.lengthOfService}
                  readOnly
                  placeholder="Calculated from Date of Employment"
                  className="w-full px-3 py-2 text-sm border border-blue-200 rounded-md bg-slate-50 text-slate-600"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-blue-900 mb-1.5">Place of Birth</label>
                <input
                  type="text"
                  name="placeOfBirth"
                  value={editFormData.placeOfBirth}
                  onChange={handleEditChange}
                  className="w-full px-3 py-2 text-sm border border-blue-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-blue-900 mb-1.5">TIN #</label>
                <input
                  type="text"
                  name="tinNumber"
                  value={editFormData.tinNumber}
                  onChange={handleEditChange}
                  className="w-full px-3 py-2 text-sm border border-blue-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-blue-900 mb-1.5">Business Partner Number</label>
                <input
                  type="text"
                  name="businessPartnerNumber"
                  value={editFormData.businessPartnerNumber}
                  onChange={handleEditChange}
                  className="w-full px-3 py-2 text-sm border border-blue-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-blue-900 mb-1.5">PhilHealth Number</label>
                <input
                  type="text"
                  name="philhealthNo"
                  value={editFormData.philhealthNo}
                  onChange={handleEditChange}
                  className="w-full px-3 py-2 text-sm border border-blue-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-blue-900 mb-1.5">Pag-IBIG Number</label>
                <input
                  type="text"
                  name="pagibigNo"
                  value={editFormData.pagibigNo}
                  onChange={handleEditChange}
                  className="w-full px-3 py-2 text-sm border border-blue-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-blue-900 mb-1.5">Marital Status</label>
                <select
                  name="maritalStatus"
                  value={editFormData.maritalStatus}
                  onChange={handleEditChange}
                  className="w-full px-3 py-2 text-sm border border-blue-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-500"
                >
                  <option value="">Not specified</option>
                  <option value="Single">Single</option>
                  <option value="Married">Married</option>
                  <option value="Widowed">Widowed</option>
                  <option value="Separated">Separated</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-sm font-semibold text-blue-900 mb-1.5">Address</label>
                <input
                  type="text"
                  name="address"
                  value={editFormData.address}
                  onChange={handleEditChange}
                  className="w-full px-3 py-2 text-sm border border-blue-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-blue-900 mb-1.5">Monthly Basic Salary</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  name="monthlyBasicSalary"
                  value={editFormData.monthlyBasicSalary}
                  onChange={handleEditChange}
                  className="w-full px-3 py-2 text-sm border border-blue-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-blue-900 mb-1.5">PERA/RATA</label>
                <input
                  type="text"
                  name="peraRata"
                  value={editFormData.peraRata}
                  onChange={handleEditChange}
                  className="w-full px-3 py-2 text-sm border border-blue-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-blue-900 mb-1.5">Gross Salary</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  name="grossSalary"
                  value={editFormData.grossSalary}
                  onChange={handleEditChange}
                  className="w-full px-3 py-2 text-sm border border-blue-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-blue-900 mb-1.5">Pending Administrative Case</label>
                <select
                  name="pendingAdministrativeCase"
                  value={editFormData.pendingAdministrativeCase}
                  onChange={handleEditChange}
                  className="w-full px-3 py-2 text-sm border border-blue-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-500"
                >
                  <option value="">Not specified</option>
                  <option value="true">Yes</option>
                  <option value="false">No</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-blue-900 mb-1.5">Pending Criminal Case</label>
                <select
                  name="pendingCriminalCase"
                  value={editFormData.pendingCriminalCase}
                  onChange={handleEditChange}
                  className="w-full px-3 py-2 text-sm border border-blue-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-500"
                >
                  <option value="">Not specified</option>
                  <option value="true">Yes</option>
                  <option value="false">No</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-blue-900 mb-1.5">Salary Grade</label>
                <input
                  type="text"
                  name="salaryGrade"
                  value={editFormData.salaryGrade}
                  onChange={handleEditChange}
                  className="w-full px-3 py-2 text-sm border border-blue-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-blue-900 mb-1.5">Password</label>
                <input
                  type="password"
                  name="password"
                  value={editFormData.password}
                  onChange={handleEditChange}
                  placeholder="Leave empty to keep current password"
                  className="w-full px-3 py-2 text-sm border border-blue-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-500"
                />
              </div>

              <div className="sm:col-span-2 flex flex-wrap gap-2 pt-3">
                <button
                  type="button"
                  onClick={handleSaveEdit}
                  className="flex-1 bg-blue-600 text-white py-2.5 sm:py-2 rounded-md hover:bg-blue-700 text-sm font-semibold"
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
                  className="flex-1 bg-slate-100 border border-slate-200 text-slate-700 py-2 rounded-md hover:bg-slate-200 text-sm font-semibold"
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
        <div className="fixed inset-0 bg-slate-900/45 flex items-center justify-center z-50 p-4 backdrop-blur-[1px]">
          <div role="dialog" aria-modal="true" aria-labelledby="add-staff-modal-title" className="bg-white p-4 sm:p-6 rounded-xl border border-blue-100 shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <h2 id="add-staff-modal-title" className="text-2xl font-bold tracking-tight text-blue-950 mb-4">Add New Staff</h2>

            {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm">{error}</div>}

            <form className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-semibold text-blue-900 mb-1.5">Item Number *</label>
                <input
                  type="text"
                  name="id"
                  value={addFormData.id}
                  onChange={handleAddChange}
                  className="w-full px-3 py-2 text-sm border border-blue-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-blue-900 mb-1.5">First Name *</label>
                <input
                  type="text"
                  name="firstName"
                  value={addFormData.firstName}
                  onChange={handleAddChange}
                  className="w-full px-3 py-2 text-sm border border-blue-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-blue-900 mb-1.5">Middle Name</label>
                <input
                  type="text"
                  name="middleName"
                  value={addFormData.middleName}
                  onChange={handleAddChange}
                  className="w-full px-3 py-2 text-sm border border-blue-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-blue-900 mb-1.5">Last Name *</label>
                <input
                  type="text"
                  name="lastName"
                  value={addFormData.lastName}
                  onChange={handleAddChange}
                  className="w-full px-3 py-2 text-sm border border-blue-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-blue-900 mb-1.5">Email *</label>
                <input
                  type="email"
                  name="email"
                  value={addFormData.email}
                  onChange={handleAddChange}
                  className="w-full px-3 py-2 text-sm border border-blue-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-blue-900 mb-1.5">Password *</label>
                <input
                  type="password"
                  name="password"
                  value={addFormData.password}
                  onChange={handleAddChange}
                  className="w-full px-3 py-2 text-sm border border-blue-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-blue-900 mb-1.5">Role *</label>
                {rolesAndDepartments ? (
                  <select
                    name="role"
                    value={addFormData.role}
                    onChange={handleAddChange}
                    className="w-full px-3 py-2 text-sm border border-blue-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-500"
                    required
                  >
                    <option value="">Select a role</option>
                    {Object.entries(rolesAndDepartments.roles)
                      .filter(([roleKey]) => !isHeadOfficerUser || roleKey === ROLES.STAFF)
                      .map(([roleKey, roleData]) => (
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
                <label className="block text-sm font-semibold text-blue-900 mb-1.5">Position</label>
                <input
                  type="text"
                  name="position"
                  value={addFormData.position}
                  onChange={handleAddChange}
                  className="w-full px-3 py-2 text-sm border border-blue-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-500"
                />
              </div>

              {rolesAndDepartments?.roles[addFormData.role]?.requiresDepartment && (
                <div>
                  <label className="block text-sm font-semibold text-blue-900 mb-1.5">Department *</label>
                  {isHeadOfficerUser ? (
                    <input
                      type="text"
                      value={currentUser.department || ''}
                      className="w-full px-4 py-2 border rounded bg-gray-100 text-gray-700"
                      readOnly
                    />
                  ) : (
                    <select
                      name="department"
                      value={addFormData.department}
                      onChange={handleAddChange}
                      className="w-full px-3 py-2 text-sm border border-blue-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-500"
                      required
                    >
                      <option value="">Select a department</option>
                      {rolesAndDepartments.departments.map((dept) => (
                        <option key={dept} value={dept}>
                          {dept}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}

              <div>
                <label className="block text-sm font-semibold text-blue-900 mb-1.5">Phone</label>
                <input
                  type="tel"
                  name="phone"
                  value={addFormData.phone}
                  onChange={handleAddChange}
                  className="w-full px-3 py-2 text-sm border border-blue-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-blue-900 mb-1.5">Date of Birth</label>
                <input
                  type="date"
                  name="dateOfBirth"
                  value={addFormData.dateOfBirth}
                  onChange={handleAddChange}
                  className="w-full px-3 py-2 text-sm border border-blue-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-blue-900 mb-1.5">DOE (Date of Employment)</label>
                <input
                  type="date"
                  name="dateHired"
                  value={addFormData.dateHired}
                  onChange={handleAddChange}
                  className="w-full px-3 py-2 text-sm border border-blue-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-blue-900 mb-1.5">Place of Birth</label>
                <input
                  type="text"
                  name="placeOfBirth"
                  value={addFormData.placeOfBirth}
                  onChange={handleAddChange}
                  className="w-full px-3 py-2 text-sm border border-blue-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-blue-900 mb-1.5">TIN #</label>
                <input
                  type="text"
                  name="tinNumber"
                  value={addFormData.tinNumber}
                  onChange={handleAddChange}
                  className="w-full px-3 py-2 text-sm border border-blue-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-blue-900 mb-1.5">Business Partner Number</label>
                <input
                  type="text"
                  name="businessPartnerNumber"
                  value={addFormData.businessPartnerNumber}
                  onChange={handleAddChange}
                  className="w-full px-3 py-2 text-sm border border-blue-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-blue-900 mb-1.5">PhilHealth Number</label>
                <input
                  type="text"
                  name="philhealthNo"
                  value={addFormData.philhealthNo}
                  onChange={handleAddChange}
                  className="w-full px-3 py-2 text-sm border border-blue-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-blue-900 mb-1.5">Pag-IBIG Number</label>
                <input
                  type="text"
                  name="pagibigNo"
                  value={addFormData.pagibigNo}
                  onChange={handleAddChange}
                  className="w-full px-3 py-2 text-sm border border-blue-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-blue-900 mb-1.5">Marital Status</label>
                <select
                  name="maritalStatus"
                  value={addFormData.maritalStatus}
                  onChange={handleAddChange}
                  className="w-full px-3 py-2 text-sm border border-blue-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-500"
                >
                  <option value="">Not specified</option>
                  <option value="Single">Single</option>
                  <option value="Married">Married</option>
                  <option value="Widowed">Widowed</option>
                  <option value="Separated">Separated</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div className="sm:col-span-2 flex flex-wrap gap-2 pt-3">
                <button
                  type="button"
                  onClick={handleAddStaff}
                  className="flex-1 bg-blue-600 text-white py-2.5 sm:py-2 rounded-md hover:bg-blue-700 text-sm font-semibold"
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
                      dateHired: '',
                      placeOfBirth: '',
                      tinNumber: '',
                      businessPartnerNumber: '',
                      philhealthNo: '',
                      pagibigNo: '',
                      maritalStatus: '',
                    });
                    setError('');
                  }}
                  className="flex-1 bg-slate-100 border border-slate-200 text-slate-700 py-2 rounded-md hover:bg-slate-200 text-sm font-semibold"
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
