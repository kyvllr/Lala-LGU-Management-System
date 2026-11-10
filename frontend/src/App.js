import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, NavLink, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { FiPower, FiMenu, FiX, FiCheck, FiCalendar } from 'react-icons/fi';
import { MdDashboard, MdGroup, MdApproval, MdFlightTakeoff } from 'react-icons/md';
import { TbFileText, TbClipboardList, TbPlane, TbTicket, TbBell, TbX, TbUser, TbFile, TbCalculator, TbHistory, TbFileCheck, TbCalendarEvent, TbFolderOpen } from 'react-icons/tb';
import { authAPI, leaveAPI, personalDataSheetAPI, travelOrderAPI, overtimeAPI, staffAPI } from './api';
import { clearLeaveRecordLocalStorage } from './clearLocalStorage';
import calculateLengthOfService from './utils/calculateLengthOfService';
import Dashboard from './pages/Dashboard';
import StaffList from './pages/StaffList';
import AddStaff from './pages/AddStaff';
import FileLeave from './pages/FileLeave';
import MyLeaves from './pages/MyLeaves';
import FileTravelOrder from './pages/FileTravelOrder';
import MyTravelOrders from './pages/MyTravelOrders';
import TravelOrderHub from './pages/TravelOrderHub';
import FileOvertime from './pages/FileOvertime';
import FileRequestHub from './pages/FileRequestHub';
import OvertimeHub from './pages/OvertimeHub';
import ApprovalRequestsHub from './pages/ApprovalRequestsHub';
import ServiceRecord from './pages/ServiceRecord';
import EmployeeLeaveRecord from './pages/EmployeeLeaveRecord';
import StaffLeaveRecordDetail from './pages/StaffLeaveRecordDetail';
import Login from './pages/Login';
import Home from './pages/Home';
import Register from './pages/Register';
import SubmitPersonalDataSheet from './pages/SubmitPersonalDataSheet';
import ReviewPersonalDataSheets from './pages/ReviewPersonalDataSheets';
import PDSHub from './pages/PDSHub';
import DPCRFTarget from './pages/DPCRFTarget';
import Vault from './pages/Vault';
import LeaveHub from './pages/LeaveHub';
import SystemLogs from './pages/SystemLogs';
import JobPortal from './pages/JobPortal';
import PrivateRoute from './components/PrivateRoute';
import RequestCOE from './pages/RequestCOE';
import RequestCertificateHub from './pages/RequestCertificateHub';
import MyCOERequests from './pages/MyCOERequests';
import MyRequests from './pages/MyRequests';
import { isAdmin, isDepartmentStaffManager, normalizeRole, ROLES } from './constants';

            <Route
              path="/request-coe"
              element={
                <PrivateRoute>
                  <RequestCOE />
                </PrivateRoute>
              }
            />

function LegacyTabRedirect({ to, tab }) {
  const location = useLocation();
  const nextParams = new URLSearchParams(location.search);
  nextParams.set('tab', tab);
  const query = nextParams.toString();

  return <Navigate to={`${to}?${query}`} replace />;
}

function formatDateForInput(value) {
  if (!value) return '';
  const asString = String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(asString)) return asString;

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toISOString().slice(0, 10);
}

function calculateAge(value) {
  if (!value) return null;
  const birthDate = new Date(value);
  const today = new Date();
  if (Number.isNaN(birthDate.getTime()) || birthDate > today) return null;

  let age = today.getFullYear() - birthDate.getFullYear();
  if (
    today.getMonth() < birthDate.getMonth()
    || (today.getMonth() === birthDate.getMonth() && today.getDate() < birthDate.getDate())
  ) {
    age -= 1;
  }
  return age;
}

function formatProfileSalary(value) {
  if (value === undefined || value === null || value === '') return '-';
  const amount = Number(value);
  return Number.isFinite(amount)
    ? `₱${amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : '-';
}

function formatPendingCase(value) {
  if (value === true) return 'Yes';
  if (value === false) return 'No';
  return '-';
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

    const initializeSession = async () => {
      const token = localStorage.getItem('token');
      const storedUser = localStorage.getItem('user');

      if (!token) {
        setUser(null);
        setLoading(false);
        return;
      }

      try {
        const meRes = await authAPI.getCurrentUser();
        const serverUser = meRes.data;

        if (serverUser) {
          const resolvedStaffId = String(serverUser.staffId || serverUser.id || '').trim();
          const normalizedUser = {
            ...serverUser,
            staffId: resolvedStaffId || undefined,
            role: normalizeRole(serverUser.role),
          };

          setUser(normalizedUser);
          localStorage.setItem('user', JSON.stringify(normalizedUser));
        } else {
          setUser(null);
          localStorage.removeItem('token');
          localStorage.removeItem('user');
        }
      } catch (error) {
        const status = error?.response?.status;
        const isUnauthorized = status === 401 || status === 403;

        // If token is invalid/expired, force a clean logout state.
        if (isUnauthorized) {
          localStorage.removeItem('user');
          localStorage.removeItem('token');
          setUser(null);
          return;
        }

        // If backend is temporarily unreachable, allow a best-effort offline session restore.
        try {
          if (storedUser && storedUser !== 'undefined') {
            const parsed = JSON.parse(storedUser);
            setUser({
              ...parsed,
              role: normalizeRole(parsed.role),
            });
          } else {
            setUser(null);
          }
        } catch (parseError) {
          console.error('Error parsing stored user:', parseError);
          localStorage.removeItem('user');
          localStorage.removeItem('token');
          setUser(null);
        }
      } finally {
        setLoading(false);
      }
    };

    initializeSession();
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
      const normalizedUserRole = normalizeRole(user?.role);
      const resolvedStaffId = String(user?.staffId || user?.id || '').trim();

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
      } else if (normalizedUserRole === ROLES.HEAD_OFFICER) {
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
      } else if (normalizedUserRole === ROLES.MUNICIPAL_BUDGET_OFFICER) {
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
      } else if (normalizedUserRole === ROLES.STAFF && resolvedStaffId && resolvedStaffId !== 'undefined' && resolvedStaffId !== 'null') {
        // Staff notifications: approved/disapproved requests
        const leavesRes = await leaveAPI.getByStaffId(resolvedStaffId);
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

        const travelRes = await travelOrderAPI.getByStaffId(resolvedStaffId);
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
    const toProfileFormData = (profile) => {
      const nameParts = (profile.name || '').trim().split(/\s+/);
      const firstName = nameParts[0] || '';
      const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : '';
      const middleName = nameParts.length > 2 ? nameParts.slice(1, -1).join(' ') : '';
      const dateHired = formatDateForInput(profile.dateHired);

      return {
        firstName,
        middleName,
        lastName,
        role: profile.role || '',
        email: profile.email || '',
        position: profile.position || '',
        department: profile.department || '',
        phone: profile.phone || '',
        dateOfBirth: formatDateForInput(profile.dateOfBirth),
        sexAtBirth: profile.sexAtBirth || '',
        dateHired,
        placeOfBirth: profile.placeOfBirth || '',
        tinNumber: profile.tinNumber || '',
        businessPartnerNumber: profile.businessPartnerNumber || '',
        philhealthNo: profile.philhealthNo || '',
        pagibigNo: profile.pagibigNo || '',
        maritalStatus: profile.maritalStatus || profile.civilStatus || '',
        address: profile.address || '',
        employmentStatus: profile.employmentStatus || '',
        lengthOfService: calculateLengthOfService(dateHired) || profile.lengthOfService || '',
        monthlyBasicSalary: profile.monthlyBasicSalary ?? '',
        peraRata: profile.peraRata ?? '',
        grossSalary: profile.grossSalary ?? '',
        pendingAdministrativeCase: profile.pendingAdministrativeCase == null ? '' : String(profile.pendingAdministrativeCase),
        pendingCriminalCase: profile.pendingCriminalCase == null ? '' : String(profile.pendingCriminalCase),
        salaryGrade: profile.salaryGrade || '',
        profilePhotoDataUrl: profile.profilePhotoDataUrl || '',
        currentPassword: '',
        newPassword: '',
        confirmNewPassword: '',
      };
    };

    setUpdateAccountData(toProfileFormData(user || {}));
    setUpdateAccountError('');
    setUpdateAccountSuccess('');
    setProfileModalTab(tab);
    setShowUpdateAccountModal(true);

    try {
      // Fetch self profile via auth endpoint to avoid role-based staff lookup restrictions
      const response = await authAPI.getCurrentUser();
      setUpdateAccountData(toProfileFormData(response.data || {}));
    } catch (err) {
      console.error('Error refreshing profile information:', err);
      setUpdateAccountError('Could not refresh profile information. Showing the saved account details.');
    }
  };

  const handleUpdateAccountChange = (e) => {
    const { name, value } = e.target;
    setUpdateAccountData(prev => ({
      ...prev,
      [name]: value,
      ...(name === 'dateHired' ? { lengthOfService: calculateLengthOfService(value) } : {}),
    }));
  };

  const handleProfilePhotoChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setUpdateAccountError('Choose a JPG, PNG, or WebP image.');
      e.target.value = '';
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setUpdateAccountError('Profile photo must be 5 MB or smaller.');
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        setUpdateAccountError('Unable to read the selected profile photo.');
        return;
      }
      setUpdateAccountError('');
      setUpdateAccountData((prev) => ({ ...prev, profilePhotoDataUrl: reader.result }));
    };
    reader.onerror = () => setUpdateAccountError('Unable to read the selected profile photo.');
    reader.readAsDataURL(file);
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
        dateOfBirth: updateAccountData.dateOfBirth || undefined,
        sexAtBirth: updateAccountData.sexAtBirth,
        dateHired: updateAccountData.dateHired || undefined,
        placeOfBirth: updateAccountData.placeOfBirth,
        tinNumber: updateAccountData.tinNumber,
        businessPartnerNumber: updateAccountData.businessPartnerNumber,
        philhealthNo: updateAccountData.philhealthNo,
        pagibigNo: updateAccountData.pagibigNo,
        maritalStatus: updateAccountData.maritalStatus,
        address: updateAccountData.address,
        employmentStatus: updateAccountData.employmentStatus,
        lengthOfService: updateAccountData.lengthOfService,
        monthlyBasicSalary: updateAccountData.monthlyBasicSalary,
        peraRata: updateAccountData.peraRata,
        grossSalary: updateAccountData.grossSalary,
        pendingAdministrativeCase: updateAccountData.pendingAdministrativeCase,
        pendingCriminalCase: updateAccountData.pendingCriminalCase,
        salaryGrade: updateAccountData.salaryGrade,
        profilePhotoDataUrl: updateAccountData.profilePhotoDataUrl,
      };

      // Use staffId for the update call (not the MongoDB id)
      const staffId = user.staffId || user.id;
      if (!isAdmin(user.role)) {
        await staffAPI.createProfileUpdateRequest(updateData);
        setUpdateAccountSuccess('Your profile update request was sent to Admin/HR for review.');
        return;
      }

      const updateResponse = await staffAPI.update(staffId, updateData);
      const savedSexAtBirth = updateResponse.data?.staff?.sexAtBirth;
      if (savedSexAtBirth !== updateAccountData.sexAtBirth) {
        throw new Error('The saved sex value could not be confirmed. Please try again.');
      }

      const refreshedUserResponse = await authAPI.getCurrentUser();
      const refreshedUser = refreshedUserResponse.data;
      
      // Update user in localStorage (don't store passwords)
      const updatedUser = { 
        ...user, 
        name: fullName,
        email: updateAccountData.email,
        position: updateAccountData.position,
        department: updateAccountData.department,
        phone: updateAccountData.phone,
        dateOfBirth: updateAccountData.dateOfBirth,
        sexAtBirth: refreshedUser.sexAtBirth || '',
        dateHired: updateAccountData.dateHired,
        placeOfBirth: updateAccountData.placeOfBirth,
        tinNumber: updateAccountData.tinNumber,
        businessPartnerNumber: updateAccountData.businessPartnerNumber,
        philhealthNo: updateAccountData.philhealthNo,
        pagibigNo: updateAccountData.pagibigNo,
        maritalStatus: updateAccountData.maritalStatus,
        address: updateAccountData.address,
        employmentStatus: updateAccountData.employmentStatus,
        lengthOfService: updateAccountData.lengthOfService,
        monthlyBasicSalary: updateAccountData.monthlyBasicSalary,
        peraRata: updateAccountData.peraRata,
        grossSalary: updateAccountData.grossSalary,
        pendingAdministrativeCase: updateAccountData.pendingAdministrativeCase === '' ? null : updateAccountData.pendingAdministrativeCase === 'true',
        pendingCriminalCase: updateAccountData.pendingCriminalCase === '' ? null : updateAccountData.pendingCriminalCase === 'true',
        salaryGrade: updateAccountData.salaryGrade,
        profilePhotoDataUrl: updateAccountData.profilePhotoDataUrl,
      };
      localStorage.setItem('user', JSON.stringify(updatedUser));
      setUser(updatedUser);
      setUpdateAccountData((prev) => ({
        ...prev,
        sexAtBirth: refreshedUser.sexAtBirth || '',
      }));
      
      setUpdateAccountSuccess('Profile updated successfully!');
    } catch (err) {
      setUpdateAccountError(err.response?.data?.message || err.message || 'Failed to update account');
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
        <Route path="/" element={<Home />} />
        <Route path="/home" element={<Home />} />
        <Route path="/login" element={<Login setUser={setUser} />} />
        <Route path="/register" element={<Register />} />
        <Route path="/submit-personal-data-sheet" element={<SubmitPersonalDataSheet />} />
        <Route path="*" element={<Navigate to="/login" />} />
      </Routes>
    );
  }

  // Show main app with sidebar navigation
  const canManageDepartmentAccounts = isAdmin(user.role) || user.role === ROLES.HEAD_OFFICER;
  const canManageDepartmentStaff = isDepartmentStaffManager(user.role);
  const canApproveDepartmentRequests = isAdmin(user.role) || user.role === ROLES.HEAD_OFFICER;
  const canApproveOvertimeRequests = isAdmin(user.role) || user.role === ROLES.MUNICIPAL_BUDGET_OFFICER;
  const canApproveAnyRequests = canApproveDepartmentRequests || canApproveOvertimeRequests;
  const canFileOwnRequests = Boolean(user.staffId || user.id);
  const canViewOwnRecords = [
    ROLES.STAFF,
    ROLES.HEAD_REQUISITIONING_OFFICE,
    ROLES.JOB_ORDER_OFFICER,
  ].includes(normalizeRole(user.role));
  const currentYear = new Date().getFullYear();
  const navLinkBaseClass = 'flex items-center gap-3 px-4 py-2 rounded-lg text-[14px] font-medium transition-colors duration-200 [&>svg]:text-blue-600 [&>svg]:transition-colors';
  const navLinkClassName = ({ isActive }) => `${navLinkBaseClass} ${!sidebarOpen ? 'justify-center' : ''} ${isActive ? 'bg-blue-500 text-white shadow-sm border-l-4 border-l-blue-200 [&>svg]:text-white' : 'text-blue-700 hover:bg-blue-600 hover:text-white hover:[&>svg]:text-white'}`;
  const navIconButtonClass = 'p-2 hover:bg-blue-50 text-blue-700 rounded-lg transition-colors duration-200';

  return (
    <div className="flex h-screen bg-slate-100">
      {/* Sidebar */}
      <div className={`${sidebarOpen ? 'w-72' : 'w-24'} bg-white border-r-2 border-blue-600 text-slate-700 flex flex-col shadow-[0_12px_28px_rgba(15,23,42,0.08)] transition-all duration-300 overflow-hidden`}>
        {/* Logo/Header */}
        <div className={`relative text-center bg-white ${sidebarOpen ? 'px-5 pt-6 pb-5' : 'px-2 pt-5 pb-4'}`}>
          <div className={`pointer-events-none absolute left-0 right-0 h-[1.5px] bg-blue-600 ${sidebarOpen ? 'top-[95px]' : 'top-[70px]'}`} />
          <div className={`relative z-10 mx-auto rounded-full border-[3px] border-blue-600 bg-white p-0 overflow-hidden shadow-sm ${sidebarOpen ? 'w-[92px] h-[92px]' : 'w-[68px] h-[68px]'}`}>
            <img 
              src="/logo.PNG" 
              alt="LALA LGU Logo" 
              className={`w-full h-full object-contain rounded-full border-[1.5px] border-blue-600 ${sidebarOpen ? 'scale-[1.09]' : 'scale-[1.03]'}`}
            />
          </div>
          {sidebarOpen && (
            <div className="mt-3 leading-tight">
              <p className="text-[14px] font-bold tracking-[0.14em] text-blue-700">LGU  LALA</p>
              <p className="text-[12px] font-bold tracking-[0.12em] text-slate-600">HR Information System</p> <br/>
            </div>
          )}
        </div>

        {/* Navigation Menu */}
        <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto">
          <NavLink 
            to="/" 
            end
            className={navLinkClassName}
            title="Dashboard"
          >
            <MdDashboard size={20} />
            {sidebarOpen && <span>Dashboard</span>}
          </NavLink>
          
          {canManageDepartmentAccounts && (
            <>
              <NavLink 
                to="/staffs" 
                className={navLinkClassName}
                title="Manage Staff"
              >
                <MdGroup size={20} />
                {sidebarOpen && <span>Manage Accounts</span>}
              </NavLink>
            </>
          )}

          {canApproveAnyRequests && (
            <NavLink 
              to="/approve-requests" 
              className={navLinkClassName}
              title="Approve Requests"
            >
              <MdApproval size={20} />
              {sidebarOpen && <span>Approve Requests</span>}
            </NavLink>
          )}

          {canManageDepartmentStaff && (
            <>
              <NavLink 
                to="/service-records" 
                className={navLinkClassName}
                title="My Service Records"
              >
                <TbFile size={20} />
                {sidebarOpen && <span>Employee's Service Records</span>}
              </NavLink>
              <NavLink 
                to="/employee-leave-record" 
                className={navLinkClassName}
                title="Employee's Leave Record"
              >
                <TbHistory size={20} />
                {sidebarOpen && <span>Employee's Leave Record</span>}
              </NavLink>
            </>
          )}
          
          {canFileOwnRequests && (
            <>

              <NavLink 
                to="/pds" 
                className={navLinkClassName}
                title="PDS"
              >
                <TbFileCheck size={20} />
                {sidebarOpen && <span>PDS</span>}
              </NavLink>
                <NavLink
                  to="/request-certificate"
                  className={navLinkClassName}
                  title="Request Certificate"
                >
                  <TbFileText size={20} />
                  {sidebarOpen && <span>Request Certificate</span>}
                </NavLink>
              <NavLink
                to="/dpcrf-target"
                className={navLinkClassName}
                title={`DPCRF-${currentYear}-TARGET`}
              >
                <FiCalendar size={20} />
                {sidebarOpen && <span>{`DPCRF-${currentYear}-TARGET`}</span>}
              </NavLink>
              <NavLink
                to="/file-requests"
                className={navLinkClassName}
                title="File Requests"
              >
                <TbFileText size={20} />
                {sidebarOpen && <span>File Requests</span>}
              </NavLink>
              <NavLink
                to="/my-requests"
                className={navLinkClassName}
                title="My Requests"
              >
                <TbClipboardList size={20} />
                {sidebarOpen && <span>My Requests</span>}
              </NavLink>
              {canViewOwnRecords && (
                <>
              <NavLink 
                to="/service-records" 
                className={navLinkClassName}
                title="Service Records"
              >
                <TbFile size={20} />
                {sidebarOpen && <span>Service Records</span>}
              </NavLink>
              <NavLink 
                to="/employee-leave-record" 
                className={navLinkClassName}
                title="Employee's Leave Record"
              >
                <TbHistory size={20} />
                {sidebarOpen && <span>Employee's Leave Record</span>}
              </NavLink>
                </>
              )}
            </>
          )}

          {isAdmin(user.role) && (
            <NavLink
              to="/job-portal"
              className={navLinkClassName}
              title="Announcements"
            >
              <TbClipboardList size={20} />
              {sidebarOpen && <span>Announcements</span>}
            </NavLink>
          )}


          <NavLink
            to="/vault"
            className={navLinkClassName}
            title="Vault"
          >
            <TbFolderOpen size={20} />
            {sidebarOpen && <span>Vault</span>}
          </NavLink>

          {isAdmin(user.role) && (
            <NavLink
              to="/system-logs"
              className={navLinkClassName}
              title="System Logs & Audit Trail"
            >
              <TbCalendarEvent size={20} />
              {sidebarOpen && <span>System Logs</span>}
            </NavLink>
          )}
        </nav>

        {/* Logout Button */}
        <button
          onClick={openLogoutConfirmModal}
          className={`flex items-center gap-3 px-6 py-4 mx-4 mb-4 border border-blue-200 bg-white text-red-500 rounded-[18px] font-semibold hover:bg-red-100 hover:border-red-800 transition-colors duration-200 [&>svg]:text-blue-600 ${!sidebarOpen ? 'justify-center w-12 h-12 mx-auto px-0 py-0 rounded-full' : ''}`}
          title="Logout"
        >
          <FiPower size={20} />
          {sidebarOpen && <span>Logout</span>}
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Header */}
        <div className="bg-white border-b border-blue-100 px-5 py-3 shadow-sm flex justify-between items-center">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className={navIconButtonClass}
            >
              <FiMenu size={24} />
            </button>
          </div>
          <div className="flex items-center gap-6">
            <button
              onClick={() => {
                setShowNotifications(false);
                setShowProfileMenu(false);
                setShowCalculatorModal(true);
              }}
              className={navIconButtonClass}
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
                className={`${navIconButtonClass} relative`}
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

            <div className="text-right text-slate-700">
              <p className="text-xs uppercase tracking-wider text-slate-500">{user.role.charAt(0).toUpperCase() + user.role.slice(1)}</p>
              <p className="font-semibold text-sm">{user.name}</p>
            </div>
            <div className="relative" ref={profileMenuRef}>
              <button
                onClick={() => {
                  setShowNotifications(false);
                  setShowProfileMenu((prev) => !prev);
                }}
                className="w-10 h-10 bg-blue-50 rounded-full flex items-center justify-center text-blue-700 hover:bg-blue-100 transition"
                title="Profile menu"
              >
                {user.profilePhotoDataUrl ? (
                  <img src={user.profilePhotoDataUrl} alt="" className="w-full h-full rounded-full object-cover" />
                ) : (
                  <TbUser size={22} />
                )}
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
                  <Dashboard
                    userRole={user.role}
                    staffId={user.staffId || user.id}
                    userName={user.name}
                    profilePhotoDataUrl={user.profilePhotoDataUrl}
                  />
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
            <Route
              path="/job-portal"
              element={
                <PrivateRoute requiredRole={[ROLES.SUPER_ADMIN, ROLES.ADMIN_HR, 'admin']}>
                  <JobPortal />
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
              path="/file-requests"
              element={
                <PrivateRoute>
                  <FileRequestHub staffId={user.staffId || user.id} />
                </PrivateRoute>
              }
            />
            <Route
              path="/my-requests"
              element={
                <PrivateRoute>
                  <MyRequests />
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
              path="/dpcrf-target"
              element={
                <PrivateRoute>
                  <DPCRFTarget />
                </PrivateRoute>
              }
            />
            <Route
              path="/vault"
              element={
                <PrivateRoute>
                  <Vault user={user} />
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
            
            <Route
              path="/request-coe"
              element={
                <PrivateRoute>
                  <RequestCertificateHub />
                </PrivateRoute>
              }
            />
            <Route
              path="/request-certificate"
              element={
                <PrivateRoute>
                  <RequestCertificateHub />
                </PrivateRoute>
              }
            />
            <Route
              path="/my-coe-requests"
              element={
                <PrivateRoute>
                  <MyCOERequests />
                </PrivateRoute>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>

          {/* Profile Modal */}
          {showUpdateAccountModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden">
                {/* Header */}
                <div className="bg-blue-400 px-8 py-5 flex items-center justify-between">
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
                        <div className="w-24 h-24 bg-blue-100 rounded-full overflow-hidden flex items-center justify-center text-blue-700 border-4 border-blue-400">
                          {updateAccountData.profilePhotoDataUrl ? (
                            <img src={updateAccountData.profilePhotoDataUrl} alt="Profile" className="w-full h-full object-cover" />
                          ) : (
                            <TbUser size={42} />
                          )}
                        </div>
                      </div>
                      <h3 className="text-3xl font-bold text-gray-900 mb-2">{[updateAccountData.firstName, updateAccountData.middleName, updateAccountData.lastName].filter(Boolean).join(' ') || 'User'}</h3>
                      <div className="inline-block bg-blue-400 text-white font-bold px-4 py-2 rounded-full text-sm mb-8">{updateAccountData.role || 'Staff'}</div>
                      
                      <div className="space-y-5 text-left">
                        <section className="rounded-lg border border-blue-200 bg-blue-50 p-5">
                          <h4 className="text-lg font-bold text-blue-900 mb-3">Personal Information</h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
                            <div className="flex justify-between gap-4 py-3 border-b border-blue-200">
                              <span className="text-blue-600 font-bold">Phone:</span>
                              <span className="text-gray-800 text-right">{updateAccountData.phone || '-'}</span>
                            </div>
                            <div className="flex justify-between gap-4 py-3 border-b border-blue-200">
                              <span className="text-blue-600 font-bold">Date of Birth:</span>
                              <span className="text-gray-800 text-right">{updateAccountData.dateOfBirth || '-'}</span>
                            </div>
                            <div className="flex justify-between gap-4 py-3 border-b border-blue-200">
                              <span className="text-blue-600 font-bold">Age:</span>
                              <span className="text-gray-800 text-right">
                                {calculateAge(updateAccountData.dateOfBirth) ?? '-'}
                                {calculateAge(updateAccountData.dateOfBirth) !== null ? ' years old' : ''}
                              </span>
                            </div>
                            <div className="flex justify-between gap-4 py-3 border-b border-blue-200">
                              <span className="text-blue-600 font-bold">Sex:</span>
                              <span className="text-gray-800 text-right">{updateAccountData.sexAtBirth || '-'}</span>
                            </div>
                            <div className="flex justify-between gap-4 py-3 border-b border-blue-200">
                              <span className="text-blue-600 font-bold">Marital Status:</span>
                              <span className="text-gray-800 text-right">{updateAccountData.maritalStatus || '-'}</span>
                            </div>
                            <div className="flex justify-between gap-4 py-3 border-b border-blue-200">
                              <span className="text-blue-600 font-bold">Place of Birth:</span>
                              <span className="text-gray-800 text-right">{updateAccountData.placeOfBirth || '-'}</span>
                            </div>
                            <div className="flex justify-between gap-4 py-3 border-b border-blue-200">
                              <span className="text-blue-600 font-bold">TIN #:</span>
                              <span className="text-gray-800 text-right">{updateAccountData.tinNumber || '-'}</span>
                            </div>
                            <div className="flex justify-between gap-4 py-3 border-b border-blue-200">
                              <span className="text-blue-600 font-bold">Business Partner Number:</span>
                              <span className="text-gray-800 text-right">{updateAccountData.businessPartnerNumber || '-'}</span>
                            </div>
                            <div className="flex justify-between gap-4 py-3 border-b border-blue-200">
                              <span className="text-blue-600 font-bold">PhilHealth Number:</span>
                              <span className="text-gray-800 text-right">{updateAccountData.philhealthNo || '-'}</span>
                            </div>
                            <div className="flex justify-between gap-4 py-3 border-b border-blue-200">
                              <span className="text-blue-600 font-bold">Pag-IBIG Number:</span>
                              <span className="text-gray-800 text-right">{updateAccountData.pagibigNo || '-'}</span>
                            </div>
                            <div className="md:col-span-2 flex justify-between gap-4 py-3">
                              <span className="text-blue-600 font-bold">Address:</span>
                              <span className="text-gray-800 text-right">{updateAccountData.address || '-'}</span>
                            </div>
                          </div>
                        </section>

                        <section className="rounded-lg border border-blue-200 bg-blue-50 p-5">
                          <h4 className="text-lg font-bold text-blue-900 mb-3">Employment Information</h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
                            <div className="flex justify-between gap-4 py-3 border-b border-blue-200">
                              <span className="text-blue-600 font-bold">Position:</span>
                              <span className="text-gray-800 text-right">{updateAccountData.position || '-'}</span>
                            </div>
                            <div className="flex justify-between gap-4 py-3 border-b border-blue-200">
                              <span className="text-blue-600 font-bold">Department:</span>
                              <span className="text-gray-800 text-right">{updateAccountData.department || '-'}</span>
                            </div>
                            <div className="flex justify-between gap-4 py-3 border-b border-blue-200">
                              <span className="text-blue-600 font-bold">DOE (Date of Employment):</span>
                              <span className="text-gray-800 text-right">{updateAccountData.dateHired || '-'}</span>
                            </div>
                            <div className="flex justify-between gap-4 py-3 border-b border-blue-200">
                              <span className="text-blue-600 font-bold">Status of Employment:</span>
                              <span className="text-gray-800 text-right">{updateAccountData.employmentStatus || '-'}</span>
                            </div>
                            <div className="flex justify-between gap-4 py-3 border-b border-blue-200">
                              <span className="text-blue-600 font-bold">Length of Service:</span>
                              <span className="text-gray-800 text-right">{updateAccountData.lengthOfService || '-'}</span>
                            </div>
                            <div className="flex justify-between gap-4 py-3 border-b border-blue-200">
                              <span className="text-blue-600 font-bold">Salary Grade:</span>
                              <span className="text-gray-800 text-right">{updateAccountData.salaryGrade || '-'}</span>
                            </div>
                            <div className="flex justify-between gap-4 py-3 border-b border-blue-200">
                              <span className="text-blue-600 font-bold">Monthly Basic Salary:</span>
                              <span className="text-gray-800 text-right">{formatProfileSalary(updateAccountData.monthlyBasicSalary)}</span>
                            </div>
                            <div className="flex justify-between gap-4 py-3 border-b border-blue-200">
                              <span className="text-blue-600 font-bold">PERA/RATA:</span>
                              <span className="text-gray-800 text-right">{updateAccountData.peraRata || '-'}</span>
                            </div>
                            <div className="flex justify-between gap-4 py-3 border-b border-blue-200">
                              <span className="text-blue-600 font-bold">Gross Salary:</span>
                              <span className="text-gray-800 text-right">{formatProfileSalary(updateAccountData.grossSalary)}</span>
                            </div>
                            <div className="flex justify-between gap-4 py-3 border-b border-blue-200">
                              <span className="text-blue-600 font-bold">Pending Administrative Case:</span>
                              <span className="text-gray-800 text-right">{formatPendingCase(updateAccountData.pendingAdministrativeCase === '' ? null : updateAccountData.pendingAdministrativeCase === 'true')}</span>
                            </div>
                            <div className="flex justify-between gap-4 py-3">
                              <span className="text-blue-600 font-bold">Pending Criminal Case:</span>
                              <span className="text-gray-800 text-right">{formatPendingCase(updateAccountData.pendingCriminalCase === '' ? null : updateAccountData.pendingCriminalCase === 'true')}</span>
                            </div>
                          </div>
                        </section>

                        <section className="rounded-lg border border-blue-200 bg-blue-50 p-5">
                          <h4 className="text-lg font-bold text-blue-900 mb-3">Account Information</h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
                            <div className="flex justify-between gap-4 py-3 border-b md:border-b-0 border-blue-200">
                              <span className="text-blue-600 font-bold">Email:</span>
                              <span className="text-gray-800 text-right">{updateAccountData.email || '-'}</span>
                            </div>
                            <div className="flex justify-between gap-4 py-3">
                              <span className="text-blue-600 font-bold">Item Number (ID):</span>
                              <span className="text-gray-800 text-right">{user?.staffId || user?.id || '-'}</span>
                            </div>
                          </div>
                        </section>
                      </div>
                    </div>
                  )}

                  {profileModalTab === 'edit' && (
                    <form onSubmit={handleEditProfile} className="grid grid-cols-2 gap-5" id="editProfileForm">
                      <div className="col-span-2 flex items-center gap-5">
                        <div className="w-20 h-20 rounded-full bg-blue-100 border border-blue-200 overflow-hidden flex items-center justify-center text-blue-700 flex-shrink-0">
                          {updateAccountData.profilePhotoDataUrl ? (
                            <img src={updateAccountData.profilePhotoDataUrl} alt="Profile preview" className="w-full h-full object-cover" />
                          ) : (
                            <TbUser size={34} />
                          )}
                        </div>
                        <div>
                          <label className="block font-semibold text-gray-700 mb-2 text-sm">Profile Photo</label>
                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            onChange={handleProfilePhotoChange}
                            className="block w-full text-sm text-gray-700"
                          />
                          <p className="mt-1 text-xs text-gray-500">JPG, PNG, or WebP; maximum 5 MB.</p>
                        </div>
                      </div>
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
                        <label className="block font-semibold text-gray-700 mb-2 text-sm">Sex</label>
                        <select
                          name="sexAtBirth"
                          value={updateAccountData.sexAtBirth}
                          onChange={handleUpdateAccountChange}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition"
                        >
                          <option value="">Select sex</option>
                          <option value="Male">Male</option>
                          <option value="Female">Female</option>
                        </select>
                      </div>

                      <div>
                        <label className="block font-semibold text-gray-700 mb-2 text-sm">Marital Status</label>
                        <select
                          name="maritalStatus"
                          value={updateAccountData.maritalStatus}
                          onChange={handleUpdateAccountChange}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition"
                        >
                          <option value="">Select marital status</option>
                          <option value="Single">Single</option>
                          <option value="Married">Married</option>
                          <option value="Widowed">Widowed</option>
                          <option value="Separated">Separated</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>

                      <div>
                        <label className="block font-semibold text-gray-700 mb-2 text-sm">DOE (Date of Employment)</label>
                        <input
                          type="date"
                          name="dateHired"
                          value={updateAccountData.dateHired}
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

                      <div>
                        <label className="block font-semibold text-gray-700 mb-2 text-sm">Business Partner Number</label>
                        <input
                          type="text"
                          name="businessPartnerNumber"
                          value={updateAccountData.businessPartnerNumber}
                          onChange={handleUpdateAccountChange}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition"
                        />
                      </div>

                      <div>
                        <label className="block font-semibold text-gray-700 mb-2 text-sm">PhilHealth Number</label>
                        <input
                          type="text"
                          name="philhealthNo"
                          value={updateAccountData.philhealthNo}
                          onChange={handleUpdateAccountChange}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition"
                        />
                      </div>

                      <div>
                        <label className="block font-semibold text-gray-700 mb-2 text-sm">Pag-IBIG Number</label>
                        <input
                          type="text"
                          name="pagibigNo"
                          value={updateAccountData.pagibigNo}
                          onChange={handleUpdateAccountChange}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition"
                        />
                      </div>

                      <div>
                        <label className="block font-semibold text-gray-700 mb-2 text-sm">Address</label>
                        <input
                          type="text"
                          name="address"
                          value={updateAccountData.address}
                          onChange={handleUpdateAccountChange}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition"
                        />
                      </div>

                      <div>
                        <label className="block font-semibold text-gray-700 mb-2 text-sm">Status of Employment</label>
                        <input
                          type="text"
                          name="employmentStatus"
                          value={updateAccountData.employmentStatus}
                          onChange={handleUpdateAccountChange}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition"
                        />
                      </div>

                      <div>
                        <label className="block font-semibold text-gray-700 mb-2 text-sm">Length of Service</label>
                        <input
                          type="text"
                          name="lengthOfService"
                          value={updateAccountData.lengthOfService}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition"
                          readOnly
                          placeholder="Calculated from Date of Employment"
                        />
                      </div>

                      <div>
                        <label className="block font-semibold text-gray-700 mb-2 text-sm">Monthly Basic Salary</label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          name="monthlyBasicSalary"
                          value={updateAccountData.monthlyBasicSalary}
                          onChange={handleUpdateAccountChange}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition"
                        />
                      </div>

                      <div>
                        <label className="block font-semibold text-gray-700 mb-2 text-sm">PERA/RATA</label>
                        <input
                          type="text"
                          name="peraRata"
                          value={updateAccountData.peraRata}
                          onChange={handleUpdateAccountChange}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition"
                        />
                      </div>

                      <div>
                        <label className="block font-semibold text-gray-700 mb-2 text-sm">Gross Salary</label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          name="grossSalary"
                          value={updateAccountData.grossSalary}
                          onChange={handleUpdateAccountChange}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition"
                        />
                      </div>

                      <div>
                        <label className="block font-semibold text-gray-700 mb-2 text-sm">Pending Administrative Case</label>
                        <select
                          name="pendingAdministrativeCase"
                          value={updateAccountData.pendingAdministrativeCase}
                          onChange={handleUpdateAccountChange}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition"
                        >
                          <option value="">Not specified</option>
                          <option value="true">Yes</option>
                          <option value="false">No</option>
                        </select>
                      </div>

                      <div>
                        <label className="block font-semibold text-gray-700 mb-2 text-sm">Pending Criminal Case</label>
                        <select
                          name="pendingCriminalCase"
                          value={updateAccountData.pendingCriminalCase}
                          onChange={handleUpdateAccountChange}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition"
                        >
                          <option value="">Not specified</option>
                          <option value="true">Yes</option>
                          <option value="false">No</option>
                        </select>
                      </div>

                      <div>
                        <label className="block font-semibold text-gray-700 mb-2 text-sm">Salary Grade</label>
                        <input
                          type="text"
                          name="salaryGrade"
                          value={updateAccountData.salaryGrade}
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
                          {updateAccountLoading ? 'Saving...' : isAdmin(user?.role) ? 'Save Profile' : 'Request Profile Update'}
                        </button>
                        {!isAdmin(user?.role) && (
                          <p className="mt-2 text-sm text-gray-600">
                            Your changes will be sent to Admin/HR for approval and will not take effect until approved.
                          </p>
                        )}
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
