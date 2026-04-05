import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { FiLogOut, FiMenu, FiX, FiCheck, FiCalendar } from 'react-icons/fi';
import { MdDashboard, MdGroup, MdApproval, MdFlightTakeoff } from 'react-icons/md';
import { TbFileText, TbClipboardList, TbPlane, TbTicket, TbBell, TbX, TbUser, TbFile, TbCalculator, TbHistory, TbFileCheck, TbCalendarEvent } from 'react-icons/tb';
import { authAPI, leaveAPI, personalDataSheetAPI, travelOrderAPI, overtimeAPI, staffAPI } from './api';
import { clearLeaveRecordLocalStorage } from './clearLocalStorage';
import Dashboard from './pages/Dashboard';
import StaffList from './pages/StaffList';
import AddStaff from './pages/AddStaff';
import FileLeave from './pages/FileLeave';
import MyLeaves from './pages/MyLeaves';
import FileTravelOrder from './pages/FileTravelOrder';
import MyTravelOrders from './pages/MyTravelOrders';
import TravelOrderHub from './pages/TravelOrderHub';
import FileOvertime from './pages/FileOvertime';
import OvertimeHub from './pages/OvertimeHub';
import ApprovalRequestsHub from './pages/ApprovalRequestsHub';
import ServiceRecord from './pages/ServiceRecord';
import EmployeeLeaveRecord from './pages/EmployeeLeaveRecord';
import StaffLeaveRecordDetail from './pages/StaffLeaveRecordDetail';
import Login from './pages/Login';
import Register from './pages/Register';
import SubmitPersonalDataSheet from './pages/SubmitPersonalDataSheet';
import ReviewPersonalDataSheets from './pages/ReviewPersonalDataSheets';
import PDSHub from './pages/PDSHub';
import LeaveHub from './pages/LeaveHub';
import SystemLogs from './pages/SystemLogs';
import PrivateRoute from './components/PrivateRoute';
import { isAdmin, normalizeRole, ROLES } from './constants';

function LegacyTabRedirect({ to, tab }) {
  const location = useLocation();
  const nextParams = new URLSearchParams(location.search);
  nextParams.set('tab', tab);
  const query = nextParams.toString();

  return <Navigate to={`${to}?${query}`} replace />;
}

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
  const [showLogoutConfirmModal, setShowLogoutConfirmModal] = useState(false);
  const [showCalculatorModal, setShowCalculatorModal] = useState(false);
  const [calculatorValue, setCalculatorValue] = useState('');
  const [calculatorFromUnit, setCalculatorFromUnit] = useState('days');
  const [calculatorToUnit, setCalculatorToUnit] = useState('hours');
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [profileModalTab, setProfileModalTab] = useState('info');
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
  const notificationsRef = useRef(null);
  const profileMenuRef = useRef(null);
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

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (notificationsRef.current && !notificationsRef.current.contains(event.target)) {
        setShowNotifications(false);
      }
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target)) {
        setShowProfileMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    const handleEscapeKey = (event) => {
      if (event.key !== 'Escape') {
        return;
      }

      setShowNotifications(false);
      setShowProfileMenu(false);
      setShowUpdateAccountModal(false);
      setShowLogoutConfirmModal(false);
      setShowCalculatorModal(false);
    };

    document.addEventListener('keydown', handleEscapeKey);

    return () => {
      document.removeEventListener('keydown', handleEscapeKey);
    };
  }, []);

  const convertTimeValue = (value, fromUnit, toUnit) => {
    const numericValue = Number.parseFloat(value);
    if (Number.isNaN(numericValue)) {
      return '';
    }

    const toMinutesMap = {
      days: 1440,
      hours: 60,
      minutes: 1,
    };

    const fromFactor = toMinutesMap[fromUnit];
    const toFactor = toMinutesMap[toUnit];
    if (!fromFactor || !toFactor) {
      return '';
    }

    const converted = (numericValue * fromFactor) / toFactor;
    return Number.isFinite(converted) ? converted.toFixed(4).replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1') : '';
  };

  const convertedCalculatorValue = convertTimeValue(calculatorValue, calculatorFromUnit, calculatorToUnit);

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
            link: '/approve-requests?tab=accounts',
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

        // Overtime notifications: pending admin approvals
        try {
          const overtimeRes = await overtimeAPI.getAll();
          const pendingOvertimes = (overtimeRes.data || []).filter(overtime =>
            overtime.status === 'Pending' &&
            ['Admin', 'admin'].includes(overtime.approvalStage)
          );

          if (pendingOvertimes.length > 0) {
            const staffNames = pendingOvertimes.map(o => `${o.firstName} ${o.lastName}`.trim()).slice(0, 2).join(', ');
            const moreOvertimes = pendingOvertimes.length > 2 ? ` +${pendingOvertimes.length - 2} more` : '';
            notifs.push({
              id: 'pending-overtime-admin',
              type: 'Overtime Request',
              message: `${pendingOvertimes.length} pending from: ${staffNames}${moreOvertimes}`,
              count: pendingOvertimes.length,
              link: '/approve-overtime',
              color: 'bg-orange-100 border-l-4 border-orange-500',
              receivedAt: now
            });
          }
        } catch (error) {
          console.error('Error fetching overtime notifications:', error);
        }
      } else if (user.role === ROLES.HEAD_OFFICER) {
        const pendingStaffRes = await staffAPI.getPending();
        if (pendingStaffRes.data.length > 0) {
          const staffNames = pendingStaffRes.data.map(s => s.name).slice(0, 2).join(', ');
          const moreStaff = pendingStaffRes.data.length > 2 ? ` +${pendingStaffRes.data.length - 2} more` : '';
          notifs.push({
            id: 'pending-staff-dept',
            type: 'Department Accounts',
            message: `${pendingStaffRes.data.length} pending from: ${staffNames}${moreStaff}`,
            count: pendingStaffRes.data.length,
            link: '/approve-requests?tab=accounts',
            color: 'bg-blue-100 border-l-4 border-blue-500',
            receivedAt: now
          });
        }

        const leavesRes = await leaveAPI.getAll('Pending');
        if (leavesRes.data.length > 0) {
          const staffNames = leavesRes.data.map(l => l.staffName).slice(0, 2).join(', ');
          const moreLeaves = leavesRes.data.length > 2 ? ` +${leavesRes.data.length - 2} more` : '';
          notifs.push({
            id: 'pending-leaves-dept',
            type: 'Department Leave Request',
            message: `${leavesRes.data.length} pending from: ${staffNames}${moreLeaves}`,
            count: leavesRes.data.length,
            link: '/approve-leaves-head-officer',
            color: 'bg-yellow-100 border-l-4 border-yellow-500',
            receivedAt: now
          });
        }

        const travelRes = await travelOrderAPI.getAll('Pending');
        if (travelRes.data.length > 0) {
          const staffNames = travelRes.data.map(t => t.staffName).slice(0, 2).join(', ');
          const moreTravel = travelRes.data.length > 2 ? ` +${travelRes.data.length - 2} more` : '';
          notifs.push({
            id: 'pending-travel-dept',
            type: 'Department Travel Request',
            message: `${travelRes.data.length} pending from: ${staffNames}${moreTravel}`,
            count: travelRes.data.length,
            link: '/approve-travel-head-officer',
            color: 'bg-red-100 border-l-4 border-red-500',
            receivedAt: now
          });
        }

        try {
          const overtimeRes = await overtimeAPI.getAll('Pending');
          const pendingOvertimes = (overtimeRes.data || []).filter((overtime) =>
            overtime.status === 'Pending' && ['HeadOfficer', 'pending', 'head_requisitioning_office'].includes(overtime.approvalStage)
          );

          if (pendingOvertimes.length > 0) {
            const staffNames = pendingOvertimes.map((o) => `${o.firstName} ${o.lastName}`.trim()).slice(0, 2).join(', ');
            const moreOvertimes = pendingOvertimes.length > 2 ? ` +${pendingOvertimes.length - 2} more` : '';
            notifs.push({
              id: 'pending-overtime-dept',
              type: 'Department Overtime Request',
              message: `${pendingOvertimes.length} pending from: ${staffNames}${moreOvertimes}`,
              count: pendingOvertimes.length,
              link: '/approve-overtime-head-officer',
              color: 'bg-orange-100 border-l-4 border-orange-500',
              receivedAt: now
            });
          }
        } catch (error) {
          console.error('Error fetching overtime notifications:', error);
        }
      } else if (user.role === ROLES.MUNICIPAL_BUDGET_OFFICER) {
        try {
          const overtimeRes = await overtimeAPI.getAll('Pending');
          const pendingOvertimes = (overtimeRes.data || []).filter((overtime) =>
            overtime.status === 'Pending' && ['BudgetOfficer', 'budget_officer'].includes(overtime.approvalStage)
          );

          if (pendingOvertimes.length > 0) {
            const staffNames = pendingOvertimes.map((o) => `${o.firstName} ${o.lastName}`.trim()).slice(0, 2).join(', ');
            const moreOvertimes = pendingOvertimes.length > 2 ? ` +${pendingOvertimes.length - 2} more` : '';
            notifs.push({
              id: 'pending-overtime-budget',
              type: 'Overtime Request',
              message: `${pendingOvertimes.length} pending from: ${staffNames}${moreOvertimes}`,
              count: pendingOvertimes.length,
              link: '/approve-overtime-budget-officer',
              color: 'bg-orange-100 border-l-4 border-orange-500',
              receivedAt: now
            });
          }
        } catch (error) {
          console.error('Error fetching budget overtime notifications:', error);
        }
      } else if (user.role === 'staff') {
        // Staff notifications: approved/disapproved requests
        const leavesRes = await leaveAPI.getByStaffId(user.staffId);
        const approvedLeaves = leavesRes.data.filter(l => l.status === 'Approved').length;
        const disapprovedLeaves = leavesRes.data.filter(l => l.status === 'Disapproved').length;

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

        if (disapprovedLeaves > 0) {
          notifs.push({
            id: 'disapproved-leaves',
            type: 'Leave Disapproved',
            message: `${disapprovedLeaves} leave request(s) disapproved`,
            count: disapprovedLeaves,
            link: '/my-leaves?status=Disapproved',
            color: 'bg-orange-100 border-l-4 border-orange-500',
            receivedAt: now
          });
        }

        const travelRes = await travelOrderAPI.getByStaffId(user.staffId);
        const approvedTravel = travelRes.data.filter(t => t.status === 'Approved').length;
        const disapprovedTravel = travelRes.data.filter(t => t.status === 'Disapproved').length;

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

        if (disapprovedTravel > 0) {
          notifs.push({
            id: 'disapproved-travel',
            type: 'Travel Disapproved',
            message: `${disapprovedTravel} travel request(s) disapproved`,
            count: disapprovedTravel,
            link: '/my-travel-orders?status=Disapproved',
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

  const handleLogout = async () => {
    try {
      await authAPI.logout();
    } catch (error) {
      console.error('Logout API call failed:', error);
    } finally {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      setUser(null);
      navigate('/login');
    }
  };

  const openLogoutConfirmModal = () => {
    setShowNotifications(false);
    setShowProfileMenu(false);
    setShowLogoutConfirmModal(true);
  };

  const closeLogoutConfirmModal = () => {
    setShowLogoutConfirmModal(false);
  };

  const confirmLogout = () => {
    setShowLogoutConfirmModal(false);
    handleLogout();
  };

  const removeNotification = (notificationId) => {
    const updatedNotifications = notifications.filter(n => n.id !== notificationId);
    const updatedDismissedIds = [...dismissedNotificationIds, notificationId];
    
    setNotifications(updatedNotifications);
    setDismissedNotificationIds(updatedDismissedIds);
    localStorage.setItem('dismissedNotifications', JSON.stringify(updatedDismissedIds));
    setNotificationCount(updatedNotifications.reduce((sum, n) => sum + n.count, 0));
  };

  const openUpdateAccountModal = async (tab = 'info') => {
    try {
      // Fetch self profile via auth endpoint to avoid role-based staff lookup restrictions
      const response = await authAPI.getCurrentUser();
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
      setProfileModalTab(tab);
      setShowUpdateAccountModal(true);
    } catch (err) {
      console.error('Error fetching user data:', err);
      setUpdateAccountError('');
      setProfileModalTab(tab);
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

  const handleEditProfile = async (e) => {
    e.preventDefault();
    setUpdateAccountError('');
    setUpdateAccountSuccess('');

    if (!updateAccountData.firstName || !updateAccountData.lastName || !updateAccountData.email) {
      setUpdateAccountError('First Name, Last Name, and Email are required');
      return;
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

      // Use staffId for the update call (not the MongoDB id)
      const staffId = user.staffId || user.id;
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
      
      setUpdateAccountSuccess('Profile updated successfully!');
    } catch (err) {
      setUpdateAccountError(err.response?.data?.message || 'Failed to update account');
      console.error(err);
    } finally {
      setUpdateAccountLoading(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setUpdateAccountError('');
    setUpdateAccountSuccess('');

    if (!updateAccountData.currentPassword) {
      setUpdateAccountError('Current password is required');
      return;
    }

    if (!updateAccountData.newPassword) {
      setUpdateAccountError('New password is required');
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

    try {
      setUpdateAccountLoading(true);
      const staffId = user.staffId || user.id;
      await staffAPI.update(staffId, {
        currentPassword: updateAccountData.currentPassword,
        password: updateAccountData.newPassword,
      });

      setUpdateAccountData((prev) => ({
        ...prev,
        currentPassword: '',
        newPassword: '',
        confirmNewPassword: '',
      }));
      setUpdateAccountSuccess('Password changed successfully!');
    } catch (err) {
      setUpdateAccountError(err.response?.data?.message || 'Failed to change password');
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

  const openProfileModalFromMenu = () => {
    setShowProfileMenu(false);
    openUpdateAccountModal('info');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-lg text-gray-600">Loading...</div>
      </div>
    );
  }

  // Keep auth source aligned with PrivateRoute to avoid redirect ping-pong.
  const hasStoredToken = Boolean(localStorage.getItem('token'));
  const hasStoredUser = Boolean(localStorage.getItem('user'));

  // Show login/register pages without navigation
  if (!user || !hasStoredToken || !hasStoredUser) {
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
  const canManageDepartmentAccounts = isAdmin(user.role) || user.role === ROLES.HEAD_OFFICER;
  const canApproveDepartmentRequests = isAdmin(user.role) || user.role === ROLES.HEAD_OFFICER;
  const canApproveOvertimeRequests = isAdmin(user.role) || user.role === ROLES.MUNICIPAL_BUDGET_OFFICER;
  const canApproveAnyRequests = canApproveDepartmentRequests || canApproveOvertimeRequests;
  const canFileOwnRequests = Boolean(user.staffId || user.id);
  const canViewOwnRecords = [ROLES.STAFF, ROLES.HEAD_OFFICER].includes(normalizeRole(user.role));

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
          
          {canManageDepartmentAccounts && (
            <>
              <Link 
                to="/staffs" 
                className={`flex items-center gap-3 px-4 py-3 rounded hover:bg-blue-600 transition ${!sidebarOpen && 'justify-center'}`}
                title="Manage Staff"
              >
                <MdGroup size={20} />
                {sidebarOpen && <span>Manage Accounts</span>}
              </Link>
            </>
          )}

          {canApproveAnyRequests && (
            <Link 
              to="/approve-requests" 
              className={`flex items-center gap-3 px-4 py-3 rounded hover:bg-blue-600 transition ${!sidebarOpen && 'justify-center'}`}
              title="Approve Requests"
            >
              <MdApproval size={20} />
              {sidebarOpen && <span>Approve Requests</span>}
            </Link>
          )}

          {isAdmin(user.role) && (
            <>
              <Link 
                to="/service-records" 
                className={`flex items-center gap-3 px-4 py-3 rounded hover:bg-blue-600 transition ${!sidebarOpen && 'justify-center'}`}
                title="My Service Records"
              >
                <TbFile size={20} />
                {sidebarOpen && <span>Employee's Service Records</span>}
              </Link>
              <Link 
                to="/employee-leave-record" 
                className={`flex items-center gap-3 px-4 py-3 rounded hover:bg-blue-600 transition ${!sidebarOpen && 'justify-center'}`}
                title="Employee's Leave Record"
              >
                <TbHistory size={20} />
                {sidebarOpen && <span>Employee's Leave Record</span>}
              </Link>
              <Link
                to="/system-logs"
                className={`flex items-center gap-3 px-4 py-3 rounded hover:bg-blue-600 transition ${!sidebarOpen && 'justify-center'}`}
                title="System Logs & Audit Trail"
              >
                <TbCalendarEvent size={20} />
                {sidebarOpen && <span>System Logs</span>}
              </Link>
            </>
          )}
          
          {canFileOwnRequests && (
            <>

              <Link 
                to="/pds" 
                className={`flex items-center gap-3 px-4 py-3 rounded hover:bg-blue-600 transition ${!sidebarOpen && 'justify-center'}`}
                title="PDS"
              >
                <TbFileCheck size={20} />
                {sidebarOpen && <span>PDS</span>}
              </Link>
              <Link 
                to="/leave" 
                className={`flex items-center gap-3 px-4 py-3 rounded hover:bg-blue-600 transition ${!sidebarOpen && 'justify-center'}`}
                title="Leave"
              >
                <TbFileText size={20} />
                {sidebarOpen && <span>Leave</span>}
              </Link>
              <Link 
                to="/travel-order" 
                className={`flex items-center gap-3 px-4 py-3 rounded hover:bg-blue-600 transition ${!sidebarOpen && 'justify-center'}`}
                title="Travel Order"
              >
                <MdFlightTakeoff size={20} />
                {sidebarOpen && <span>Travel Order</span>}
              </Link>
              <Link 
                to="/overtime" 
                className={`flex items-center gap-3 px-4 py-3 rounded hover:bg-blue-600 transition ${!sidebarOpen && 'justify-center'}`}
                title="Overtime"
              >
                <TbClipboardList size={20} />
                {sidebarOpen && <span>Overtime</span>}
              </Link>
              {canViewOwnRecords && (
                <>
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
                <TbHistory size={20} />
                {sidebarOpen && <span>Employee's Leave Record</span>}
              </Link>
                </>
              )}
            </>
          )}
        </nav>

        {/* Logout Button */}
        <button
          onClick={openLogoutConfirmModal}
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
            <h2 className="text-2xl font-bold">LGU LALA MANAGEMENT SYSTEM</h2>
          </div>
          <div className="flex items-center gap-6">
            <button
              onClick={() => {
                setShowNotifications(false);
                setShowProfileMenu(false);
                setShowCalculatorModal(true);
              }}
              className="p-2 hover:bg-blue-700 rounded transition"
              title="Open calculator"
            >
              <TbCalculator size={24} />
            </button>

            {/* Notification Bell */}
            <div className="relative" ref={notificationsRef}>
              <button
                onClick={() => {
                  setShowProfileMenu(false);
                  setShowNotifications((prev) => !prev);
                }}
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
            <div className="relative" ref={profileMenuRef}>
              <button
                onClick={() => {
                  setShowNotifications(false);
                  setShowProfileMenu((prev) => !prev);
                }}
                className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-blue-600 hover:bg-gray-100 transition"
                title="Profile menu"
              >
                <TbUser size={22} />
              </button>

              {showProfileMenu && (
                <div className="absolute right-0 mt-2 w-40 bg-white text-gray-800 rounded shadow-lg z-50 overflow-hidden">
                  <button
                    onClick={openProfileModalFromMenu}
                    className="w-full text-left px-4 py-2 hover:bg-gray-100 transition"
                  >
                    Profile
                  </button>
                  <button
                    onClick={openLogoutConfirmModal}
                    className="w-full text-left px-4 py-2 hover:bg-gray-100 transition"
                  >
                    Logout
                  </button>
                </div>
              )}
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
              path="/approve-requests"
              element={
                <PrivateRoute requiredRole={[ROLES.ADMIN_HR, ROLES.SUPER_ADMIN, ROLES.HEAD_OFFICER, ROLES.MUNICIPAL_BUDGET_OFFICER, 'admin']}>
                  <ApprovalRequestsHub userRole={user.role} />
                </PrivateRoute>
              }
            />
            <Route 
              path="/staffs" 
              element={
                <PrivateRoute requiredRole={['admin', ROLES.HEAD_OFFICER]}>
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
                <PrivateRoute requiredRole={['admin', ROLES.HEAD_OFFICER]}>
                  <Navigate to="/approve-requests?tab=accounts" replace />
                </PrivateRoute>
              } 
            />
            <Route 
              path="/approve-leaves" 
              element={
                <PrivateRoute requiredRole={['admin', ROLES.ADMIN_HR, ROLES.SUPER_ADMIN]}>
                  <Navigate to="/approve-requests?tab=leave" replace />
                </PrivateRoute>
              } 
            />
            <Route 
              path="/approve-leaves-head-officer" 
              element={
                <PrivateRoute requiredRole={ROLES.HEAD_OFFICER}>
                  <Navigate to="/approve-requests?tab=leave" replace />
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
                <PrivateRoute requiredRole={['admin', ROLES.ADMIN_HR, ROLES.SUPER_ADMIN]}>
                  <Navigate to="/approve-requests?tab=travel" replace />
                </PrivateRoute>
              } 
            />
            <Route 
              path="/approve-travel-head-officer" 
              element={
                <PrivateRoute requiredRole={ROLES.HEAD_OFFICER}>
                  <Navigate to="/approve-requests?tab=travel" replace />
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
            <Route
              path="/system-logs"
              element={
                <PrivateRoute requiredRole={[ROLES.SUPER_ADMIN, ROLES.ADMIN_HR, 'admin']}>
                  <SystemLogs />
                </PrivateRoute>
              }
            />
            
            {/* Filing Routes */}
            <Route
              path="/pds"
              element={
                <PrivateRoute>
                  <PDSHub />
                </PrivateRoute>
              }
            />
            <Route
              path="/submit-personal-data-sheet"
              element={
                <PrivateRoute>
                  <SubmitPersonalDataSheet />
                </PrivateRoute>
              }
            />
            <Route
              path="/leave"
              element={
                <PrivateRoute>
                  <LeaveHub staffId={user.staffId || user.id} />
                </PrivateRoute>
              }
            />
            <Route
              path="/file-leave"
              element={
                <PrivateRoute>
                  <LegacyTabRedirect to="/leave" tab="file" />
                </PrivateRoute>
              }
            />
            <Route
              path="/my-leaves"
              element={
                <PrivateRoute>
                  <LegacyTabRedirect to="/leave" tab="my" />
                </PrivateRoute>
              }
            />
            <Route
              path="/travel-order"
              element={
                <PrivateRoute>
                  <TravelOrderHub staffId={user.staffId || user.id} />
                </PrivateRoute>
              }
            />
            <Route
              path="/file-travel"
              element={
                <PrivateRoute>
                  <LegacyTabRedirect to="/travel-order" tab="request" />
                </PrivateRoute>
              }
            />
            <Route
              path="/my-travel"
              element={
                <PrivateRoute>
                  <LegacyTabRedirect to="/travel-order" tab="my" />
                </PrivateRoute>
              }
            />
            <Route
              path="/my-travel-orders"
              element={
                <PrivateRoute>
                  <LegacyTabRedirect to="/travel-order" tab="my" />
                </PrivateRoute>
              }
            />
            <Route
              path="/overtime"
              element={
                <PrivateRoute>
                  <OvertimeHub staffId={user.staffId || user.id} />
                </PrivateRoute>
              }
            />
            <Route
              path="/request-overtime"
              element={
                <PrivateRoute>
                  <LegacyTabRedirect to="/overtime" tab="request" />
                </PrivateRoute>
              }
            />
            <Route 
              path="/approve-overtime" 
              element={
                <PrivateRoute requiredRole={['admin', ROLES.ADMIN_HR, ROLES.SUPER_ADMIN]}>
                  <Navigate to="/approve-requests?tab=overtime" replace />
                </PrivateRoute>
              } 
            />
            <Route 
              path="/approve-overtime-head-officer" 
              element={
                <PrivateRoute requiredRole={ROLES.HEAD_OFFICER}>
                  <Navigate to="/approve-requests?tab=overtime" replace />
                </PrivateRoute>
              } 
            />
            <Route 
              path="/approve-overtime-budget-officer" 
              element={
                <PrivateRoute requiredRole={ROLES.MUNICIPAL_BUDGET_OFFICER}>
                  <Navigate to="/approve-requests?tab=overtime" replace />
                </PrivateRoute>
              } 
            />

            <Route
              path="/unauthorized"
              element={
                <div className="max-w-2xl mx-auto mt-12 bg-white rounded-lg shadow p-8 text-center">
                  <h1 className="text-2xl font-bold text-gray-800 mb-2">Unauthorized</h1>
                  <p className="text-gray-600">You do not have permission to access this page.</p>
                </div>
              }
            />
            
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>

          {/* Profile Modal */}
          {showUpdateAccountModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden">
                {/* Header */}
                <div className="bg-blue-500 px-8 py-5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="text-white text-2xl">👤</div>
                    <h2 className="text-white text-2xl font-bold">My Profile</h2>
                  </div>
                  <button
                    onClick={closeUpdateAccountModal}
                    className="text-blue-100 hover:text-white transition text-2xl"
                  >
                    ✕
                  </button>
                </div>

                {/* Tab Navigation */}
                <div className="bg-white border-b border-gray-200 px-8 flex gap-8">
                  <button
                    type="button"
                    onClick={() => {
                      setProfileModalTab('info');
                      setUpdateAccountError('');
                      setUpdateAccountSuccess('');
                    }}
                    className={`py-4 font-semibold transition-all border-b-2 ${profileModalTab === 'info' ? 'border-blue-500 text-blue-600' : 'border-transparent text-blue-400 hover:text-blue-500'}`}
                  >
                    Profile Information
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setProfileModalTab('edit');
                      setUpdateAccountError('');
                      setUpdateAccountSuccess('');
                    }}
                    className={`py-4 font-semibold transition-all border-b-2 ${profileModalTab === 'edit' ? 'border-blue-500 text-blue-600' : 'border-transparent text-blue-400 hover:text-blue-500'}`}
                  >
                    Edit Profile
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setProfileModalTab('password');
                      setUpdateAccountError('');
                      setUpdateAccountSuccess('');
                    }}
                    className={`py-4 font-semibold transition-all border-b-2 ${profileModalTab === 'password' ? 'border-blue-500 text-blue-600' : 'border-transparent text-blue-400 hover:text-blue-500'}`}
                  >
                    Change Password
                  </button>
                </div>

                <div className="overflow-y-auto flex-1 px-8 py-6">
                  {updateAccountError && <div className="mb-4 p-4 bg-red-100 text-red-700 rounded-lg border border-red-300">{updateAccountError}</div>}
                  {updateAccountSuccess && <div className="mb-4 p-4 bg-green-100 text-green-700 rounded-lg border border-green-300">{updateAccountSuccess}</div>}

                  {/* Profile Info Centered Section */}
                  {profileModalTab === 'info' && (
                    <div className="text-center mb-8">
                      <div className="flex justify-center mb-6">
                        <div className="w-24 h-24 bg-blue-100 rounded-full flex items-center justify-center text-5xl border-4 border-blue-400">
                          👤
                        </div>
                      </div>
                      <h3 className="text-3xl font-bold text-gray-900 mb-2">{[updateAccountData.firstName, updateAccountData.middleName, updateAccountData.lastName].filter(Boolean).join(' ') || 'User'}</h3>
                      <div className="inline-block bg-blue-400 text-white font-bold px-4 py-2 rounded-full text-sm mb-8">{updateAccountData.role || 'Staff'}</div>
                      
                      {/* Info Card */}
                      <div className="bg-blue-50 rounded-lg p-6 text-left space-y-0 border border-blue-200">
                        <div className="flex justify-between py-4 border-b border-blue-200">
                          <span className="text-blue-600 font-bold">Email:</span>
                          <span className="text-gray-800">{updateAccountData.email || '-'}</span>
                        </div>
                        <div className="flex justify-between py-4 border-b border-blue-200">
                          <span className="text-blue-600 font-bold">Phone:</span>
                          <span className="text-gray-800">{updateAccountData.phone || '-'}</span>
                        </div>
                        <div className="flex justify-between py-4 border-b border-blue-200">
                          <span className="text-blue-600 font-bold">Position:</span>
                          <span className="text-gray-800">{updateAccountData.position || '-'}</span>
                        </div>
                        <div className="flex justify-between py-4 border-b border-blue-200">
                          <span className="text-blue-600 font-bold">Department:</span>
                          <span className="text-gray-800">{updateAccountData.department || '-'}</span>
                        </div>
                        <div className="flex justify-between py-4 border-b border-blue-200">
                          <span className="text-blue-600 font-bold">Date of Birth:</span>
                          <span className="text-gray-800">{updateAccountData.dateOfBirth || '-'}</span>
                        </div>
                        <div className="flex justify-between py-4 border-b border-blue-200">
                          <span className="text-blue-600 font-bold">Place of Birth:</span>
                          <span className="text-gray-800">{updateAccountData.placeOfBirth || '-'}</span>
                        </div>
                        <div className="flex justify-between py-4">
                          <span className="text-blue-600 font-bold">TIN #:</span>
                          <span className="text-gray-800">{updateAccountData.tinNumber || '-'}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {profileModalTab === 'edit' && (
                    <form onSubmit={handleEditProfile} className="grid grid-cols-2 gap-5" id="editProfileForm">
                      <div>
                        <label className="block font-semibold text-gray-700 mb-2 text-sm">Last Name *</label>
                        <input
                          type="text"
                          name="lastName"
                          value={updateAccountData.lastName}
                          onChange={handleUpdateAccountChange}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition"
                          required
                        />
                      </div>

                      <div>
                        <label className="block font-semibold text-gray-700 mb-2 text-sm">First Name *</label>
                        <input
                          type="text"
                          name="firstName"
                          value={updateAccountData.firstName}
                          onChange={handleUpdateAccountChange}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition"
                          required
                        />
                      </div>

                      <div>
                        <label className="block font-semibold text-gray-700 mb-2 text-sm">Middle Name</label>
                        <input
                          type="text"
                          name="middleName"
                          value={updateAccountData.middleName}
                          onChange={handleUpdateAccountChange}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition"
                        />
                      </div>

                      <div>
                        <label className="block font-semibold text-gray-700 mb-2 text-sm">Email *</label>
                        <input
                          type="email"
                          name="email"
                          value={updateAccountData.email}
                          onChange={handleUpdateAccountChange}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition"
                          required
                        />
                      </div>

                      <div>
                        <label className="block font-semibold text-gray-700 mb-2 text-sm">Position</label>
                        <input
                          type="text"
                          name="position"
                          value={updateAccountData.position}
                          onChange={handleUpdateAccountChange}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition"
                        />
                      </div>

                      <div>
                        <label className="block font-semibold text-gray-700 mb-2 text-sm">Department</label>
                        <input
                          type="text"
                          name="department"
                          value={updateAccountData.department}
                          onChange={handleUpdateAccountChange}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition"
                        />
                      </div>

                      <div>
                        <label className="block font-semibold text-gray-700 mb-2 text-sm">Phone</label>
                        <input
                          type="tel"
                          name="phone"
                          value={updateAccountData.phone}
                          onChange={handleUpdateAccountChange}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition"
                        />
                      </div>

                      <div>
                        <label className="block font-semibold text-gray-700 mb-2 text-sm">Date of Birth</label>
                        <input
                          type="date"
                          name="dateOfBirth"
                          value={updateAccountData.dateOfBirth}
                          onChange={handleUpdateAccountChange}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition"
                        />
                      </div>

                      <div>
                        <label className="block font-semibold text-gray-700 mb-2 text-sm">Place of Birth</label>
                        <input
                          type="text"
                          name="placeOfBirth"
                          value={updateAccountData.placeOfBirth}
                          onChange={handleUpdateAccountChange}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition"
                        />
                      </div>

                      <div>
                        <label className="block font-semibold text-gray-700 mb-2 text-sm">TIN #</label>
                        <input
                          type="text"
                          name="tinNumber"
                          value={updateAccountData.tinNumber}
                          onChange={handleUpdateAccountChange}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition"
                        />
                      </div>

                      <div className="col-span-2">
                        <button
                          type="submit"
                          disabled={updateAccountLoading}
                          className="w-full bg-gradient-to-r from-blue-400 to-blue-500 text-white py-3 rounded-lg hover:from-blue-500 hover:to-blue-600 font-bold disabled:from-gray-400 disabled:to-gray-500 disabled:text-gray-600 transition shadow-md"
                        >
                          {updateAccountLoading ? 'Saving...' : 'Save Profile'}
                        </button>
                      </div>
                    </form>
                  )}

                  {profileModalTab === 'password' && (
                    <form onSubmit={handleChangePassword} className="space-y-5" id="changePasswordForm">
                      <div>
                        <label className="block font-semibold text-gray-700 mb-2 text-sm">Current Password</label>
                        <input
                          type="password"
                          name="currentPassword"
                          value={updateAccountData.currentPassword}
                          onChange={handleUpdateAccountChange}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition"
                        />
                      </div>

                      <div>
                        <label className="block font-semibold text-gray-700 mb-2 text-sm">New Password</label>
                        <input
                          type="password"
                          name="newPassword"
                          value={updateAccountData.newPassword}
                          onChange={handleUpdateAccountChange}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition"
                        />
                      </div>

                      <div>
                        <label className="block font-semibold text-gray-700 mb-2 text-sm">Confirm New Password</label>
                        <input
                          type="password"
                          name="confirmNewPassword"
                          value={updateAccountData.confirmNewPassword}
                          onChange={handleUpdateAccountChange}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition"
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={updateAccountLoading}
                        className="w-full bg-gradient-to-r from-blue-400 to-blue-500 text-white py-3 rounded-lg hover:from-blue-500 hover:to-blue-600 font-bold disabled:from-gray-400 disabled:to-gray-500 disabled:text-gray-600 transition shadow-md"
                      >
                        {updateAccountLoading ? 'Changing...' : 'Change Password'}
                      </button>
                    </form>
                  )}
                </div>

                <div className="border-t bg-white px-8 py-6">
                  <button
                    type="button"
                    onClick={closeUpdateAccountModal}
                    disabled={updateAccountLoading}
                    className="w-full bg-gray-300 text-gray-800 py-3 rounded-lg hover:bg-gray-400 font-semibold disabled:opacity-50 transition"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}

          {showLogoutConfirmModal && (
            <div
              className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
              onClick={closeLogoutConfirmModal}
            >
              <div
                className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6"
                onClick={(event) => event.stopPropagation()}
              >
                <h3 className="text-xl font-bold text-gray-900 mb-2">Confirm Logout</h3>
                <p className="text-gray-600 mb-6">Are you sure you want to logout?</p>
                <div className="flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={closeLogoutConfirmModal}
                    className="px-4 py-2 rounded-lg bg-gray-200 text-gray-800 hover:bg-gray-300 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={confirmLogout}
                    className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 transition"
                  >
                    Logout
                  </button>
                </div>
              </div>
            </div>
          )}

          {showCalculatorModal && (
            <div
              className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
              onClick={() => setShowCalculatorModal(false)}
            >
              <div
                className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-bold text-gray-900">Time Converter</h3>
                  <button
                    type="button"
                    onClick={() => setShowCalculatorModal(false)}
                    className="text-gray-500 hover:text-gray-700"
                    title="Close"
                  >
                    <TbX size={20} />
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Value</label>
                    <input
                      type="number"
                      step="0.01"
                      value={calculatorValue}
                      onChange={(event) => setCalculatorValue(event.target.value)}
                      placeholder="e.g. 1.25"
                      className="w-full px-3 py-2 border rounded"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">From</label>
                      <select
                        value={calculatorFromUnit}
                        onChange={(event) => setCalculatorFromUnit(event.target.value)}
                        className="w-full px-3 py-2 border rounded"
                      >
                        <option value="days">Days</option>
                        <option value="hours">Hours</option>
                        <option value="minutes">Minutes</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">To</label>
                      <select
                        value={calculatorToUnit}
                        onChange={(event) => setCalculatorToUnit(event.target.value)}
                        className="w-full px-3 py-2 border rounded"
                      >
                        <option value="days">Days</option>
                        <option value="hours">Hours</option>
                        <option value="minutes">Minutes</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setCalculatorFromUnit(calculatorToUnit);
                        setCalculatorToUnit(calculatorFromUnit);
                      }}
                      className="w-full px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition font-semibold"
                    >
                      Swap units
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setCalculatorValue('');
                        setCalculatorFromUnit('days');
                        setCalculatorToUnit('hours');
                      }}
                      className="w-full px-3 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 transition font-semibold"
                    >
                      Clear
                    </button>
                  </div>

                  <div className="bg-gray-100 rounded p-3">
                    <p className="text-sm text-gray-600">Converted Value</p>
                    <p className="text-xl font-bold text-gray-900">
                      {convertedCalculatorValue === '' ? '-' : convertedCalculatorValue}
                    </p>
                  </div>
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
