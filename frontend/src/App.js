import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, Navigate, useNavigate } from 'react-router-dom';
import { FiLogOut, FiMenu, FiX } from 'react-icons/fi';
import { MdDashboard, MdGroup, MdPersonAdd, MdApproval, MdFlightTakeoff } from 'react-icons/md';
import { TbFileText, TbClipboardList, TbPlane, TbTicket, TbBell, TbX, TbUser, TbFile } from 'react-icons/tb';
import { leaveAPI, personalDataSheetAPI, travelOrderAPI, staffAPI } from './api';
import { clearLeaveRecordLocalStorage } from './clearLocalStorage';
import Dashboard from './pages/Dashboard';
import StaffList from './pages/StaffList';
import AddStaff from './pages/AddStaff';
import FileLeave from './pages/FileLeave';
import MyLeaves from './pages/MyLeaves';
import ApproveLeavesAdmin from './pages/ApproveLeavesAdmin';
import FileTravelOrder from './pages/FileTravelOrder';
import MyTravelOrders from './pages/MyTravelOrders';
import ApproveTravelOrdersAdmin from './pages/ApproveTravelOrdersAdmin';
import ApprovePendingStaff from './pages/ApprovePendingStaff';
import ServiceRecord from './pages/ServiceRecord';
import EmployeeLeaveRecord from './pages/EmployeeLeaveRecord';
import StaffLeaveRecordDetail from './pages/StaffLeaveRecordDetail';
import Login from './pages/Login';
import Register from './pages/Register';
import SubmitPersonalDataSheet from './pages/SubmitPersonalDataSheet';
import ReviewPersonalDataSheets from './pages/ReviewPersonalDataSheets';
import PrivateRoute from './components/PrivateRoute';
import { isAdmin, normalizeRole } from './constants';

function AppContent() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [notificationCount, setNotificationCount] = useState(0);
  const [dismissedNotificationIds, setDismissedNotificationIds] = useState(
    JSON.parse(localStorage.getItem('dismissedNotifications') || '[]')
  );
  const [showUpdateAccountModal, setShowUpdateAccountModal] = useState(false);
  const [updateAccountData, setUpdateAccountData] = useState({
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
    currentPassword: '',
    newPassword: '',
    confirmNewPassword: '',
  });
  const [updateAccountError, setUpdateAccountError] = useState('');
  const [updateAccountSuccess, setUpdateAccountSuccess] = useState('');
  const [updateAccountLoading, setUpdateAccountLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Clear old localStorage leave record data on app startup
    clearLeaveRecordLocalStorage();
    
    // Check if user is already logged in
    try {
      const storedUser = localStorage.getItem('user');
      if (storedUser && storedUser !== 'undefined') {
        const parsed = JSON.parse(storedUser);
        setUser({
          ...parsed,
          role: normalizeRole(parsed.role),
        });
      }
    } catch (error) {
      console.error('Error parsing stored user:', error);
      localStorage.removeItem('user');
      localStorage.removeItem('token');
    }
    setLoading(false);
  }, []);

  // Fetch notifications periodically
  useEffect(() => {
    if (user) {
      fetchNotifications();
      const interval = setInterval(fetchNotifications, 30000); // Update every 30 seconds
      return () => clearInterval(interval);
    }
  }, [user, dismissedNotificationIds]);

  const fetchNotifications = async () => {
    try {
      const notifs = [];
      const now = new Date();

      if (isAdmin(user.role)) {
        // Admin notifications: pending staff, leaves, and travel orders
        const pendingStaffRes = await staffAPI.getPending();
        if (pendingStaffRes.data.length > 0) {
          const staffNames = pendingStaffRes.data.map(s => s.name).slice(0, 2).join(', ');
          const moreStaff = pendingStaffRes.data.length > 2 ? ` +${pendingStaffRes.data.length - 2} more` : '';
          notifs.push({
            id: 'pending-staff',
            type: 'Staff Registration',
            message: `${pendingStaffRes.data.length} pending from: ${staffNames}${moreStaff}`,
            count: pendingStaffRes.data.length,
            link: '/approve-pending-staff',
            color: 'bg-blue-100 border-l-4 border-blue-500',
            receivedAt: now
          });
        }

        const leavesRes = await leaveAPI.getAll('Pending');
        if (leavesRes.data.length > 0) {
          const staffNames = leavesRes.data.map(l => l.staffName).slice(0, 2).join(', ');
          const moreLeaves = leavesRes.data.length > 2 ? ` +${leavesRes.data.length - 2} more` : '';
          notifs.push({
            id: 'pending-leaves',
            type: 'Leave Request',
            message: `${leavesRes.data.length} pending from: ${staffNames}${moreLeaves}`,
            count: leavesRes.data.length,
            link: '/approve-leaves',
            color: 'bg-yellow-100 border-l-4 border-yellow-500',
            receivedAt: now
          });
        }

        const travelRes = await travelOrderAPI.getAll('Pending');
        if (travelRes.data.length > 0) {
          const staffNames = travelRes.data.map(t => t.staffName).slice(0, 2).join(', ');
          const moreTravel = travelRes.data.length > 2 ? ` +${travelRes.data.length - 2} more` : '';
          notifs.push({
            id: 'pending-travel',
            type: 'Travel Request',
            message: `${travelRes.data.length} pending from: ${staffNames}${moreTravel}`,
            count: travelRes.data.length,
            link: '/approve-travel',
            color: 'bg-red-100 border-l-4 border-red-500',
            receivedAt: now
          });
        }

        const pdsRes = await personalDataSheetAPI.getAll('Pending');
        if (pdsRes.data.length > 0) {
          const names = pdsRes.data
            .map(p => [p.firstName, p.middleName, p.surname].filter(Boolean).join(' '))
            .slice(0, 2)
            .join(', ');
          const morePds = pdsRes.data.length > 2 ? ` +${pdsRes.data.length - 2} more` : '';
          notifs.push({
            id: 'pending-pds',
            type: 'Personal Data Sheet',
            message: `${pdsRes.data.length} pending from: ${names}${morePds}`,
            count: pdsRes.data.length,
            link: '/review-personal-data-sheets',
            color: 'bg-purple-100 border-l-4 border-purple-500',
            receivedAt: now
          });
        }
      } else if (user.role === 'staff') {
        // Staff notifications: approved/rejected requests
        const leavesRes = await leaveAPI.getByStaffId(user.staffId);
        const approvedLeaves = leavesRes.data.filter(l => l.status === 'Approved').length;
        const rejectedLeaves = leavesRes.data.filter(l => l.status === 'Rejected').length;

        if (approvedLeaves > 0) {
          notifs.push({
            id: 'approved-leaves',
            type: 'Leave Approved',
            message: `${approvedLeaves} leave request(s) approved`,
            count: approvedLeaves,
            link: '/my-leaves?status=Approved',
            color: 'bg-green-100 border-l-4 border-green-500',
            receivedAt: now
          });
        }

        if (rejectedLeaves > 0) {
          notifs.push({
            id: 'rejected-leaves',
            type: 'Leave Rejected',
            message: `${rejectedLeaves} leave request(s) rejected`,
            count: rejectedLeaves,
            link: '/my-leaves?status=Rejected',
            color: 'bg-orange-100 border-l-4 border-orange-500',
            receivedAt: now
          });
        }

        const travelRes = await travelOrderAPI.getByStaffId(user.staffId);
        const approvedTravel = travelRes.data.filter(t => t.status === 'Approved').length;
        const rejectedTravel = travelRes.data.filter(t => t.status === 'Rejected').length;

        if (approvedTravel > 0) {
          notifs.push({
            id: 'approved-travel',
            type: 'Travel Approved',
            message: `${approvedTravel} travel request(s) approved`,
            count: approvedTravel,
            link: '/my-travel-orders?status=Approved',
            color: 'bg-green-100 border-l-4 border-green-500',
            receivedAt: now
          });
        }

        if (rejectedTravel > 0) {
          notifs.push({
            id: 'rejected-travel',
            type: 'Travel Rejected',
            message: `${rejectedTravel} travel request(s) rejected`,
            count: rejectedTravel,
            link: '/my-travel-orders?status=Rejected',
            color: 'bg-orange-100 border-l-4 border-orange-500',
            receivedAt: now
          });
        }
      }

      // Filter out dismissed notifications
      const filteredNotifs = notifs.filter(n => !dismissedNotificationIds.includes(n.id));
      
      setNotifications(filteredNotifs);
      setNotificationCount(filteredNotifs.reduce((sum, n) => sum + n.count, 0));
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    navigate('/login');
  };

  const removeNotification = (notificationId) => {
    const updatedNotifications = notifications.filter(n => n.id !== notificationId);
    const updatedDismissedIds = [...dismissedNotificationIds, notificationId];
    
    setNotifications(updatedNotifications);
    setDismissedNotificationIds(updatedDismissedIds);
    localStorage.setItem('dismissedNotifications', JSON.stringify(updatedDismissedIds));
    setNotificationCount(updatedNotifications.reduce((sum, n) => sum + n.count, 0));
  };

  const openUpdateAccountModal = async () => {
    try {
      // Use staffId to fetch user data (this is the staff's unique ID)
      const staffId = user.staffId || user.id;
      
      if (!staffId) {
        setUpdateAccountError('Staff ID not found. Please log out and log back in.');
        setShowUpdateAccountModal(true);
        return;
      }
      
      console.log('Fetching user data for staffId:', staffId); // Debug log
      
      // Fetch complete user data from API to ensure all fields are populated
      const response = await staffAPI.getById(staffId);
      const fullUserData = response.data;
      
      console.log('Fetched user data:', fullUserData); // Debug log
      
      // Parse name into parts
      const nameParts = (fullUserData.name || '').trim().split(/\s+/);
      const firstName = nameParts[0] || '';
      const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : '';
      const middleName = nameParts.length > 2 ? nameParts.slice(1, -1).join(' ') : '';
      
      setUpdateAccountData({
        firstName: firstName,
        middleName: middleName,
        lastName: lastName,
        email: fullUserData.email || '',
        position: fullUserData.position || '',
        department: fullUserData.department || '',
        phone: fullUserData.phone || '',
        dateOfBirth: fullUserData.dateOfBirth || '',
        placeOfBirth: fullUserData.placeOfBirth || '',
        tinNumber: fullUserData.tinNumber || '',
        currentPassword: '',
        newPassword: '',
        confirmNewPassword: '',
      });
      setUpdateAccountError('');
      setUpdateAccountSuccess('');
      setShowUpdateAccountModal(true);
    } catch (err) {
      console.error('Error fetching user data:', err);
      setUpdateAccountError(err.response?.data?.message || 'Failed to fetch account details. Please try again.');
      setShowUpdateAccountModal(true);
      
      // Still show modal with fallback data
      const nameParts = (user.name || '').trim().split(/\s+/);
      const firstName = nameParts[0] || '';
      const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : '';
      const middleName = nameParts.length > 2 ? nameParts.slice(1, -1).join(' ') : '';
      
      setUpdateAccountData({
        firstName: firstName,
        middleName: middleName,
        lastName: lastName,
        email: user.email || '',
        position: user.position || '',
        department: user.department || '',
        phone: user.phone || '',
        dateOfBirth: user.dateOfBirth || '',
        placeOfBirth: user.placeOfBirth || '',
        tinNumber: user.tinNumber || '',
        currentPassword: '',
        newPassword: '',
        confirmNewPassword: '',
      });
    }
  };

  const handleUpdateAccountChange = (e) => {
    const { name, value } = e.target;
    setUpdateAccountData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleUpdateAccount = async (e) => {
    e.preventDefault();
    setUpdateAccountError('');
    setUpdateAccountSuccess('');

    if (!updateAccountData.firstName || !updateAccountData.lastName || !updateAccountData.email) {
      setUpdateAccountError('First Name, Last Name, and Email are required');
      return;
    }

    // Validate password change if user is trying to change password
    if (updateAccountData.newPassword) {
      if (!updateAccountData.currentPassword) {
        setUpdateAccountError('Current password is required to change your password');
        return;
      }
      if (updateAccountData.newPassword.length < 6) {
        setUpdateAccountError('New password must be at least 6 characters');
        return;
      }
      if (updateAccountData.newPassword !== updateAccountData.confirmNewPassword) {
        setUpdateAccountError('New passwords do not match');
        return;
      }
    }

    try {
      setUpdateAccountLoading(true);
      
      // Combine name fields
      const fullName = `${updateAccountData.firstName} ${updateAccountData.middleName} ${updateAccountData.lastName}`.trim();
      
      // Prepare data to send (exclude confirmNewPassword and empty password fields)
      const updateData = {
        name: fullName,
        email: updateAccountData.email,
        position: updateAccountData.position,
        department: updateAccountData.department,
        phone: updateAccountData.phone,
        dateOfBirth: updateAccountData.dateOfBirth,
        placeOfBirth: updateAccountData.placeOfBirth,
        tinNumber: updateAccountData.tinNumber,
      };

      // Only include password fields if changing password
      if (updateAccountData.newPassword) {
        updateData.currentPassword = updateAccountData.currentPassword;
        updateData.password = updateAccountData.newPassword;
      }

      // Use staffId for the update call (not the MongoDB id)
      const staffId = user.staffId || user.id;
      console.log('Updating account for staffId:', staffId);
      console.log('Update data:', updateData);
      await staffAPI.update(staffId, updateData);
      
      // Update user in localStorage (don't store passwords)
      const updatedUser = { 
        ...user, 
        name: fullName,
        email: updateAccountData.email,
        position: updateAccountData.position,
        department: updateAccountData.department,
        phone: updateAccountData.phone,
        dateOfBirth: updateAccountData.dateOfBirth,
        placeOfBirth: updateAccountData.placeOfBirth,
        tinNumber: updateAccountData.tinNumber,
      };
      localStorage.setItem('user', JSON.stringify(updatedUser));
      setUser(updatedUser);
      
      setUpdateAccountSuccess('Account updated successfully!');
      setTimeout(() => {
        setShowUpdateAccountModal(false);
      }, 1500);
    } catch (err) {
      setUpdateAccountError(err.response?.data?.message || 'Failed to update account');
      console.error(err);
    } finally {
      setUpdateAccountLoading(false);
    }
  };

  const closeUpdateAccountModal = () => {
    setShowUpdateAccountModal(false);
    setUpdateAccountError('');
    setUpdateAccountSuccess('');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-lg text-gray-600">Loading...</div>
      </div>
    );
  }

  // Show login/register pages without navigation
  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<Login setUser={setUser} />} />
        <Route path="/register" element={<Register />} />
        <Route path="/submit-personal-data-sheet" element={<SubmitPersonalDataSheet />} />
        <Route path="*" element={<Navigate to="/login" />} />
      </Routes>
    );
  }

  // Show main app with sidebar navigation
  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <div className={`${sidebarOpen ? 'w-64' : 'w-20'} bg-blue-700 text-white flex flex-col shadow-lg transition-all duration-300 overflow-hidden`}>
        {/* Logo/Header */}
        <div className="p-6 border-b border-white text-center">
          <img 
            src="/logo.PNG" 
            alt="LALA LGU Logo" 
            className="w-24 h-24 mx-auto object-contain mb-2 rounded-full"
          />
        </div>

        {/* Navigation Menu */}
        <nav className="flex-1 p-4 space-y-2">
          <Link 
            to="/" 
            className={`flex items-center gap-3 px-4 py-3 rounded hover:bg-blue-600 transition ${!sidebarOpen && 'justify-center'}`}
            title="Dashboard"
          >
            <MdDashboard size={20} />
            {sidebarOpen && <span>Dashboard</span>}
          </Link>
          
          {isAdmin(user.role) && (
            <>
              <Link 
                to="/staffs" 
                className={`flex items-center gap-3 px-4 py-3 rounded hover:bg-blue-600 transition ${!sidebarOpen && 'justify-center'}`}
                title="Manage Staff"
              >
                <MdGroup size={20} />
                {sidebarOpen && <span>Manage Staff</span>}
              </Link>
              <Link 
                to="/approve-pending-staff" 
                className={`flex items-center gap-3 px-4 py-3 rounded hover:bg-blue-600 transition ${!sidebarOpen && 'justify-center'}`}
                title="Account Requests"
              >
                <MdApproval size={20} />
                {sidebarOpen && <span>Account Requests</span>}
              </Link>
              <Link 
                to="/review-personal-data-sheets" 
                className={`flex items-center gap-3 px-4 py-3 rounded hover:bg-blue-600 transition ${!sidebarOpen && 'justify-center'}`}
                title="PDS Requests"
              >
                <MdApproval size={20} />
                {sidebarOpen && <span>PDS Requests</span>}
              </Link>
              <Link 
                to="/approve-leaves" 
                className={`flex items-center gap-3 px-4 py-3 rounded hover:bg-blue-600 transition ${!sidebarOpen && 'justify-center'}`}
                title="Approve Leaves"
              >
                <MdApproval size={20} />
                {sidebarOpen && <span>Leave Request</span>}
              </Link>
              <Link 
                to="/approve-travel" 
                className={`flex items-center gap-3 px-4 py-3 rounded hover:bg-blue-600 transition ${!sidebarOpen && 'justify-center'}`}
                title="Approve Travel"
              >
                <MdApproval size={20} />
                {sidebarOpen && <span>Travel Requests</span>}
              </Link>
              <Link 
                to="/service-records" 
                className={`flex items-center gap-3 px-4 py-3 rounded hover:bg-blue-600 transition ${!sidebarOpen && 'justify-center'}`}
                title="Service Records"
              >
                <TbFile size={20} />
                {sidebarOpen && <span>Service Records</span>}
              </Link>
              <Link 
                to="/employee-leave-record" 
                className={`flex items-center gap-3 px-4 py-3 rounded hover:bg-blue-600 transition ${!sidebarOpen && 'justify-center'}`}
                title="Employee's Leave Record"
              >
                <TbClipboardList size={20} />
                {sidebarOpen && <span>Employee's Leave Record</span>}
              </Link>
            </>
          )}
          
          {/* Update Account - Available to both staff and admin */}
          <button 
            onClick={openUpdateAccountModal}
            className={`flex items-center gap-3 px-4 py-3 rounded hover:bg-blue-600 transition w-full text-left ${!sidebarOpen && 'justify-center'}`}
            title="Update Account"
          >
            <TbUser size={20} />
            {sidebarOpen && <span>Update Account</span>}
          </button>
          
          {user.role === 'staff' && (
            <>

              <Link 
                to="/file-leave" 
                className={`flex items-center gap-3 px-4 py-3 rounded hover:bg-blue-600 transition ${!sidebarOpen && 'justify-center'}`}
                title="File Leave"
              >
                <TbFileText size={20} />
                {sidebarOpen && <span>File Leave</span>}
              </Link>
              <Link 
                to="/my-leaves" 
                className={`flex items-center gap-3 px-4 py-3 rounded hover:bg-blue-600 transition ${!sidebarOpen && 'justify-center'}`}
                title="My Leaves"
              >
                <TbClipboardList size={20} />
                {sidebarOpen && <span>My Leaves</span>}
              </Link>
              <Link 
                to="/file-travel" 
                className={`flex items-center gap-3 px-4 py-3 rounded hover:bg-blue-600 transition ${!sidebarOpen && 'justify-center'}`}
                title="Request Travel"
              >
                <MdFlightTakeoff size={20} />
                {sidebarOpen && <span>Request Travel</span>}
              </Link>
              <Link 
                to="/my-travel" 
                className={`flex items-center gap-3 px-4 py-3 rounded hover:bg-blue-600 transition ${!sidebarOpen && 'justify-center'}`}
                title="My Travel Orders"
              >
                <TbTicket size={20} />
                {sidebarOpen && <span>My Travel Orders</span>}
              </Link>
              <Link 
                to="/service-records" 
                className={`flex items-center gap-3 px-4 py-3 rounded hover:bg-blue-600 transition ${!sidebarOpen && 'justify-center'}`}
                title="Service Records"
              >
                <TbFile size={20} />
                {sidebarOpen && <span>Service Records</span>}
              </Link>
              <Link 
                to="/employee-leave-record" 
                className={`flex items-center gap-3 px-4 py-3 rounded hover:bg-blue-600 transition ${!sidebarOpen && 'justify-center'}`}
                title="Employee's Leave Record"
              >
                <TbClipboardList size={20} />
                {sidebarOpen && <span>Employee's Leave Record</span>}
              </Link>
            </>
          )}
        </nav>

        {/* Logout Button */}
        <button
          onClick={handleLogout}
          className={`flex items-center gap-2 px-3 py-2 mx-4 mb-4  hover:bg-red-700 rounded font-medium transition ${!sidebarOpen ? 'justify-center w-10 mx-auto' : ''}`}
          title="Logout"
        >
          <FiLogOut size={20} />
          {sidebarOpen && <span>Logout</span>}
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Header */}
        <div className="bg-blue-600 text-white p-4 shadow-md flex justify-between items-center">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 hover:bg-blue-700 rounded transition"
            >
              <FiMenu size={24} />
            </button>
            <h2 className="text-2xl font-bold">LALA LGU FILING SYSTEM</h2>
          </div>
          <div className="flex items-center gap-6">
            {/* Notification Bell */}
            <div className="relative">
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="p-2 hover:bg-blue-700 rounded transition relative"
              >
                <TbBell size={24} />
                {notificationCount > 0 && (
                  <span className="absolute top-0 right-0 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                    {notificationCount > 9 ? '9+' : notificationCount}
                  </span>
                )}
              </button>

              {/* Notifications Dropdown */}
              {showNotifications && (
                <div className="absolute right-0 mt-2 w-80 bg-white text-gray-800 rounded shadow-lg z-50 max-h-96 overflow-y-auto">
                  <div className="p-4 border-b">
                    <h3 className="font-bold text-lg">Notifications</h3>
                  </div>
                  {notifications.length > 0 ? (
                    <div className="divide-y">
                      {notifications.map((notif) => (
                        <div
                          key={notif.id}
                          className={`${notif.color} flex items-start justify-between p-4 hover:bg-opacity-80 transition`}
                        >
                          <button
                            onClick={() => {
                              navigate(notif.link);
                              setShowNotifications(false);
                            }}
                            className="flex-1 text-left"
                          >
                            <div className="font-semibold text-sm">{notif.type}</div>
                            <div className="text-sm mt-1">{notif.message}</div>
                            <div className="text-xs text-gray-600 mt-2">
                              {notif.receivedAt.toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' })} {notif.receivedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              removeNotification(notif.id);
                            }}
                            className="ml-2 p-1 hover:bg-black hover:bg-opacity-10 rounded transition flex-shrink-0"
                            title="Dismiss notification"
                          >
                            <TbX size={18} />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-4 text-center text-gray-500">
                      No notifications
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="text-right">
              <p className="text-sm opacity-80">{user.role.charAt(0).toUpperCase() + user.role.slice(1)}</p>
              <p className="font-semibold">{user.name}</p>
            </div>
            <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-blue-600">
              <MdGroup size={24} />
            </div>
          </div>
        </div>

        {/* Page Content */}
        <div className="flex-1 overflow-auto p-6">
          <Routes>
            <Route 
              path="/" 
              element={
                <PrivateRoute>
                  <Dashboard userRole={user.role} staffId={user.staffId} />
                </PrivateRoute>
              } 
            />
            
            {/* Admin Routes */}
            <Route 
              path="/staffs" 
              element={
                <PrivateRoute requiredRole="admin">
                  <StaffList />
                </PrivateRoute>
              } 
            />
            <Route 
              path="/add-staff" 
              element={
                <PrivateRoute requiredRole="admin">
                  <AddStaff />
                </PrivateRoute>
              } 
            />
            <Route 
              path="/approve-pending-staff" 
              element={
                <PrivateRoute requiredRole="admin">
                  <ApprovePendingStaff />
                </PrivateRoute>
              } 
            />
            <Route 
              path="/approve-leaves" 
              element={
                <PrivateRoute requiredRole="admin">
                  <ApproveLeavesAdmin />
                </PrivateRoute>
              } 
            />
            <Route 
              path="/review-personal-data-sheets" 
              element={
                <PrivateRoute requiredRole="admin">
                  <ReviewPersonalDataSheets />
                </PrivateRoute>
              } 
            />
            <Route 
              path="/approve-travel" 
              element={
                <PrivateRoute requiredRole="admin">
                  <ApproveTravelOrdersAdmin />
                </PrivateRoute>
              } 
            />
            <Route 
              path="/service-records" 
              element={
                <PrivateRoute>
                  <ServiceRecord />
                </PrivateRoute>
              } 
            />
            <Route 
              path="/employee-leave-record" 
              element={
                <PrivateRoute>
                  <EmployeeLeaveRecord />
                </PrivateRoute>
              } 
            />
            <Route 
              path="/employee-leave-record/:staffId" 
              element={
                <PrivateRoute>
                  <StaffLeaveRecordDetail />
                </PrivateRoute>
              } 
            />
            
            {/* Staff Routes */}
            <Route 
              path="/file-leave" 
              element={
                <PrivateRoute requiredRole="staff">
                  <FileLeave staffId={user.staffId} />
                </PrivateRoute>
              } 
            />
            <Route 
              path="/my-leaves" 
              element={
                <PrivateRoute requiredRole="staff">
                  <MyLeaves staffId={user.staffId} />
                </PrivateRoute>
              } 
            />
            <Route 
              path="/file-travel" 
              element={
                <PrivateRoute requiredRole="staff">
                  <FileTravelOrder staffId={user.staffId} />
                </PrivateRoute>
              } 
            />
            <Route 
              path="/my-travel" 
              element={
                <PrivateRoute requiredRole="staff">
                  <MyTravelOrders staffId={user.staffId} />
                </PrivateRoute>
              } 
            />
            
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>

          {/* Update Account Modal */}
          {showUpdateAccountModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded shadow-lg max-w-md w-full max-h-[90vh] flex flex-col">
                <div className="p-8 border-b">
                  <h2 className="text-2xl font-bold">Update Account</h2>
                </div>

                <div className="overflow-y-auto flex-1 px-8 py-6">
                  {updateAccountError && <div className="mb-4 p-4 bg-red-100 text-red-700 rounded">{updateAccountError}</div>}
                  {updateAccountSuccess && <div className="mb-4 p-4 bg-green-100 text-green-700 rounded">{updateAccountSuccess}</div>}

                  <form onSubmit={handleUpdateAccount} className="grid grid-cols-2 gap-4" id="updateAccountForm">
                  {/* Name Section - spanning 2 rows */}
                  <div>
                    <label className="block font-bold mb-2">Last Name *</label>
                    <input
                      type="text"
                      name="lastName"
                      value={updateAccountData.lastName}
                      onChange={handleUpdateAccountChange}
                      className="w-full px-4 py-2 border rounded focus:outline-none focus:border-blue-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block font-bold mb-2">First Name *</label>
                    <input
                      type="text"
                      name="firstName"
                      value={updateAccountData.firstName}
                      onChange={handleUpdateAccountChange}
                      className="w-full px-4 py-2 border rounded focus:outline-none focus:border-blue-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block font-bold mb-2">Middle Name</label>
                    <input
                      type="text"
                      name="middleName"
                      value={updateAccountData.middleName}
                      onChange={handleUpdateAccountChange}
                      className="w-full px-4 py-2 border rounded focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block font-bold mb-2">Email *</label>
                    <input
                      type="email"
                      name="email"
                      value={updateAccountData.email}
                      onChange={handleUpdateAccountChange}
                      className="w-full px-4 py-2 border rounded focus:outline-none focus:border-blue-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block font-bold mb-2">Position</label>
                    <input
                      type="text"
                      name="position"
                      value={updateAccountData.position}
                      onChange={handleUpdateAccountChange}
                      className="w-full px-4 py-2 border rounded focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block font-bold mb-2">Department</label>
                    <input
                      type="text"
                      name="department"
                      value={updateAccountData.department}
                      onChange={handleUpdateAccountChange}
                      className="w-full px-4 py-2 border rounded focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block font-bold mb-2">Phone</label>
                    <input
                      type="tel"
                      name="phone"
                      value={updateAccountData.phone}
                      onChange={handleUpdateAccountChange}
                      className="w-full px-4 py-2 border rounded focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block font-bold mb-2">Date of Birth</label>
                    <input
                      type="date"
                      name="dateOfBirth"
                      value={updateAccountData.dateOfBirth}
                      onChange={handleUpdateAccountChange}
                      className="w-full px-4 py-2 border rounded focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block font-bold mb-2">Place of Birth</label>
                    <input
                      type="text"
                      name="placeOfBirth"
                      value={updateAccountData.placeOfBirth}
                      onChange={handleUpdateAccountChange}
                      className="w-full px-4 py-2 border rounded focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block font-bold mb-2">TIN #</label>
                    <input
                      type="text"
                      name="tinNumber"
                      value={updateAccountData.tinNumber}
                      onChange={handleUpdateAccountChange}
                      className="w-full px-4 py-2 border rounded focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  {/* Password Change Section - spanning 2 columns */}
                  <div className="col-span-2 border-t pt-4 mt-4">
                    <p className="font-semibold text-gray-700 mb-3">Change Password (Optional)</p>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block font-bold mb-2">Current Password</label>
                        <input
                          type="password"
                          name="currentPassword"
                          value={updateAccountData.currentPassword}
                          onChange={handleUpdateAccountChange}
                          placeholder="Required if changing password"
                          className="w-full px-4 py-2 border rounded focus:outline-none focus:border-blue-500"
                        />
                      </div>

                      <div>
                        <label className="block font-bold mb-2">New Password</label>
                        <input
                          type="password"
                          name="newPassword"
                          value={updateAccountData.newPassword}
                          onChange={handleUpdateAccountChange}
                          placeholder="Leave empty to keep current password"
                          className="w-full px-4 py-2 border rounded focus:outline-none focus:border-blue-500"
                        />
                      </div>

                      <div className="col-span-2">
                        <label className="block font-bold mb-2">Confirm New Password</label>
                        <input
                          type="password"
                          name="confirmNewPassword"
                          value={updateAccountData.confirmNewPassword}
                          onChange={handleUpdateAccountChange}
                          placeholder="Confirm new password"
                          className="w-full px-4 py-2 border rounded focus:outline-none focus:border-blue-500"
                        />
                      </div>
                    </div>
                  </div>
                  </form>
                </div>

                <div className="border-t bg-gray-50 p-8 flex gap-2">
                  <button
                    form="updateAccountForm"
                    type="submit"
                    disabled={updateAccountLoading}
                    className="flex-1 bg-green-600 text-white py-2 rounded hover:bg-green-700 font-bold disabled:bg-gray-400"
                  >
                    {updateAccountLoading ? 'Updating...' : 'Update'}
                  </button>
                  <button
                    type="button"
                    onClick={closeUpdateAccountModal}
                    disabled={updateAccountLoading}
                    className="flex-1 bg-gray-600 text-white py-2 rounded hover:bg-gray-700 font-bold disabled:bg-gray-400"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

export default App;
