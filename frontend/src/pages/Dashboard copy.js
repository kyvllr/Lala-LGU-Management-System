import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MdGroup, MdApproval } from 'react-icons/md';
import { TbClockHour2, TbClipboardList, TbCheck, TbFileDescription, TbWallet, TbCalendarEvent } from 'react-icons/tb';
import { PieChart, Pie, Cell, Legend, Tooltip, ResponsiveContainer } from 'recharts';
import { leaveAPI, travelOrderAPI, staffAPI, leaveRecordAPI, personalDataSheetAPI, overtimeAPI } from '../api';
import { isAdmin, normalizeRole, ROLE_DISPLAY_NAMES, ROLES } from '../constants';

function Dashboard({ userRole, staffId }) {
  const navigate = useNavigate();
  const normalizedRole = normalizeRole(userRole);
  const isAdminUser = isAdmin(normalizedRole);
  const isHeadOfficer = normalizedRole === ROLES.HEAD_OFFICER;
  const isApprover = isAdminUser || isHeadOfficer;
  const [stats, setStats] = useState({
    totalStaff: 0,
    pendingLeaves: 0,
    approvedLeaves: 0,
    pendingTravelOrders: 0,
    approvedTravelOrders: 0,
    pendingOvertimeRequests: 0,
    approvedOvertimeRequests: 0,
  });
  const [analytics, setAnalytics] = useState({
    disapprovedLeaves: 0,
    disapprovedTravelOrders: 0,
    leavesByType: {},
    travelByMode: {},
    approvalRate: 0,
  });
  const [leaveRecords, setLeaveRecords] = useState([]);
  const [myLeaveApplications, setMyLeaveApplications] = useState([]);
  const [leaveBalance, setLeaveBalance] = useState({
    vacationLeaveBalance: 0,
    sickLeaveBalance: 0,
    ctoBalance: 0,
    vacationLeaveEarned: 0,
    sickLeaveEarned: 0,
    ctoEarned: 0,
  });
  const [loading, setLoading] = useState(true);
  const [currentStaffId, setCurrentStaffId] = useState(null);
  const [activeTab, setActiveTab] = useState('leave-balance');
  const [myPds, setMyPds] = useState({
    latestSubmission: null,
    approvedPds: null,
  });
  const [myPdsLoading, setMyPdsLoading] = useState(false);
  const [myPdsError, setMyPdsError] = useState('');
  const [personalInfo, setPersonalInfo] = useState({
    staffId: '',
    name: '',
    email: '',
    department: '',
    position: '',
    phone: '',
    role: '',
    accountStatus: '',
  });

  const normalizeText = (value) => String(value || '').trim().toLowerCase();
  const normalizedLatestPdsStatus = normalizeText(myPds.latestSubmission?.status);
  const hasKnownLatestPdsStatus = ['pending', 'for revision', 'disapproved', 'approved'].includes(normalizedLatestPdsStatus);
  const hasApprovedPds = Boolean(myPds.approvedPds);
  const hasAnyPds = Boolean(myPds.approvedPds || myPds.latestSubmission);
  const approvedUpdateAllowed = hasApprovedPds ? Boolean(myPds.approvedPds?.updatePermissionGranted) : true;
  const canOpenPdsForm = !hasApprovedPds || approvedUpdateAllowed;
  const openPdsFormState = hasApprovedPds && approvedUpdateAllowed && myPds.approvedPds?.pdsId
    ? {
        prefill: true,
        userEdit: true,
        pdsId: myPds.approvedPds.pdsId,
        editPds: myPds.approvedPds,
      }
    : (hasAnyPds ? { prefill: true } : undefined);

  const isOwnedMyPdsRecord = (record) => {
    if (!record) return false;

    const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
    const currentEmail = normalizeText(storedUser?.email);
    const ownerEmail = normalizeText(record.ownerEmail);
    const subjectEmail = normalizeText(record.email);

    return (
      (Boolean(currentEmail) && ownerEmail === currentEmail) ||
      (Boolean(currentEmail) && subjectEmail === currentEmail)
    );
  };

  const refreshMyPds = async () => {
    try {
      setMyPdsLoading(true);
      setMyPdsError('');
      const myPdsRes = await personalDataSheetAPI.getMy();
      const latestSubmission = myPdsRes.data?.latestSubmission || null;
      const approvedPds = myPdsRes.data?.approvedPds || null;

      const ownedLatestSubmission = isOwnedMyPdsRecord(latestSubmission) ? latestSubmission : null;
      const ownedApprovedPds = isOwnedMyPdsRecord(approvedPds) ? approvedPds : null;
      const normalizedLatestSubmissionStatus = normalizeText(ownedLatestSubmission?.status);

      setMyPds({
        latestSubmission: ownedLatestSubmission,
        approvedPds: ownedApprovedPds || (normalizedLatestSubmissionStatus === 'approved' ? ownedLatestSubmission : null),
      });
    } catch (pdsError) {
      console.error('[Dashboard] Error fetching my PDS:', pdsError);
      setMyPds({ latestSubmission: null, approvedPds: null });
      setMyPdsError(pdsError.response?.data?.message || 'Unable to load your Personal Data Sheet right now.');
    } finally {
      setMyPdsLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'analytics' && !isAdminUser) {
      setActiveTab('leave-balance');
    }
  }, [activeTab, isAdminUser]);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
        const staffIdCandidates = Array.from(new Set([
          staffId,
          storedUser.staffId,
          storedUser.id,
        ].filter(Boolean)));

        let tempStaffId = staffIdCandidates[0] || null;

        setCurrentStaffId(tempStaffId);

        setPersonalInfo({
          staffId: tempStaffId || '-',
          name: storedUser.name || '-',
          email: storedUser.email || '-',
          department: storedUser.department || '-',
          position: storedUser.position || '-',
          phone: storedUser.phone || '-',
          role: normalizeRole(storedUser.role || userRole),
          accountStatus: storedUser.isApproved === false ? 'Pending Approval' : 'Approved',
        });

        setMyLeaveApplications([]);

        if (staffIdCandidates.length > 0) {
          for (const candidate of staffIdCandidates) {
            try {
              const profileRes = await staffAPI.getById(candidate);
              const profile = profileRes.data || {};
              if (profile.id) {
                tempStaffId = profile.id;
                setCurrentStaffId(profile.id);
              }

              setPersonalInfo(prev => ({
                ...prev,
                staffId: profile.id || prev.staffId || '-',
                name: profile.name || prev.name || '-',
                email: profile.email || prev.email || '-',
                department: profile.department || prev.department || '-',
                position: profile.position || prev.position || '-',
                phone: profile.phone || prev.phone || '-',
                role: normalizeRole(profile.role || prev.role || userRole),
                accountStatus: profile.isApproved === false ? 'Pending Approval' : 'Approved',
              }));

              break;
            } catch (profileErr) {
              console.error(`[Dashboard] Error fetching profile details for ${candidate}:`, profileErr);
            }
          }
        }

        if (isAdminUser) {
          const [staffRes, leavesRes, travelRes, overtimeRes] = await Promise.allSettled([
            staffAPI.getAll(),
            leaveAPI.getAll(),
            travelOrderAPI.getAll(),
            overtimeAPI.getAll(),
          ]);

          const staffItems = staffRes.status === 'fulfilled' ? normalizeCollection(staffRes.value.data) : [];
          const leavesItems = leavesRes.status === 'fulfilled' ? normalizeCollection(leavesRes.value.data) : [];
          const travelItems = travelRes.status === 'fulfilled' ? normalizeCollection(travelRes.value.data) : [];
          const overtimeItems = overtimeRes.status === 'fulfilled' ? normalizeCollection(overtimeRes.value.data) : [];

          if (staffRes.status === 'rejected') console.error('[Dashboard] Staff stats fetch failed (admin):', staffRes.reason);
          if (leavesRes.status === 'rejected') console.error('[Dashboard] Leave stats fetch failed (admin):', leavesRes.reason);
          if (travelRes.status === 'rejected') console.error('[Dashboard] Travel stats fetch failed (admin):', travelRes.reason);
          if (overtimeRes.status === 'rejected') console.error('[Dashboard] Overtime stats fetch failed (admin):', overtimeRes.reason);

          const pendingLeaves = countByStatus(leavesItems, 'Pending');
          const approvedLeaves = countByStatus(leavesItems, 'Approved');
          const disapprovedLeaves = countByStatus(leavesItems, 'Disapproved');
          const pendingTravel = countByStatus(travelItems, 'Pending');
          const approvedTravel = countByStatus(travelItems, 'Approved');
          const disapprovedTravel = countByStatus(travelItems, 'Disapproved');
          const pendingOvertime = countByStatus(overtimeItems, 'Pending');
          const approvedOvertime = countByStatus(overtimeItems, 'Approved');

          setStats({
            totalStaff: staffItems.length,
            pendingLeaves,
            approvedLeaves,
            pendingTravelOrders: pendingTravel,
            approvedTravelOrders: approvedTravel,
            pendingOvertimeRequests: pendingOvertime,
            approvedOvertimeRequests: approvedOvertime,
          });

          // Calculate analytics
          const leavesByType = {};
          leavesItems.forEach(leave => {
            leavesByType[leave.leaveType] = (leavesByType[leave.leaveType] || 0) + 1;
          });

          const travelByMode = {};
          travelItems.forEach(travel => {
            travelByMode[travel.transportMode] = (travelByMode[travel.transportMode] || 0) + 1;
          });

          const totalApprovedLeaves = approvedLeaves + disapprovedLeaves + pendingLeaves;
          const leaveApprovalRate = totalApprovedLeaves > 0 ? Math.round((approvedLeaves / totalApprovedLeaves) * 100) : 0;

          setAnalytics({
            disapprovedLeaves,
            disapprovedTravelOrders: disapprovedTravel,
            leavesByType,
            travelByMode,
            approvalRate: leaveApprovalRate,
          });
        } else if (isHeadOfficer) {
          const [staffRes, leavesRes, travelRes, overtimeRes] = await Promise.allSettled([
            staffAPI.getAll(),
            leaveAPI.getAll('Pending'),
            travelOrderAPI.getAll('Pending'),
            overtimeAPI.getAll(),
          ]);

          const staffItems = staffRes.status === 'fulfilled' ? normalizeCollection(staffRes.value.data) : [];
          const leavesItems = leavesRes.status === 'fulfilled' ? normalizeCollection(leavesRes.value.data) : [];
          const travelItems = travelRes.status === 'fulfilled' ? normalizeCollection(travelRes.value.data) : [];
          const overtimeItems = overtimeRes.status === 'fulfilled' ? normalizeCollection(overtimeRes.value.data) : [];

          if (staffRes.status === 'rejected') console.error('[Dashboard] Staff stats fetch failed (head officer):', staffRes.reason);
          if (leavesRes.status === 'rejected') console.error('[Dashboard] Leave stats fetch failed (head officer):', leavesRes.reason);
          if (travelRes.status === 'rejected') console.error('[Dashboard] Travel stats fetch failed (head officer):', travelRes.reason);
          if (overtimeRes.status === 'rejected') console.error('[Dashboard] Overtime stats fetch failed (head officer):', overtimeRes.reason);

          const pendingOvertime = countByStatus(overtimeItems, 'Pending');
          const approvedOvertime = countByStatus(overtimeItems, 'Approved');

          setStats({
            totalStaff: staffItems.length,
            pendingLeaves: leavesItems.length,
            approvedLeaves: 0,
            pendingTravelOrders: travelItems.length,
            approvedTravelOrders: 0,
            pendingOvertimeRequests: pendingOvertime,
            approvedOvertimeRequests: approvedOvertime,
          });

          setAnalytics({
            disapprovedLeaves: 0,
            disapprovedTravelOrders: 0,
            leavesByType: {},
            travelByMode: {},
            approvalRate: 0,
          });
        }

        // Fetch leave records from API for both admin and staff when staffId is available
        if (tempStaffId) {
          if (!isAdminUser && !isHeadOfficer) {
            const [leavesRes, travelRes, overtimeRes] = await Promise.allSettled([
              leaveAPI.getByStaffId(tempStaffId),
              travelOrderAPI.getByStaffId(tempStaffId),
              overtimeAPI.getByStaffId(tempStaffId),
            ]);

            if (leavesRes.status === 'rejected') console.error('[Dashboard] Leave stats fetch failed (staff):', leavesRes.reason);
            if (travelRes.status === 'rejected') console.error('[Dashboard] Travel stats fetch failed (staff):', travelRes.reason);
            if (overtimeRes.status === 'rejected') console.error('[Dashboard] Overtime stats fetch failed (staff):', overtimeRes.reason);

            const staffLeaves = leavesRes.status === 'fulfilled' ? normalizeCollection(leavesRes.value.data) : [];
            const staffTravel = travelRes.status === 'fulfilled' ? normalizeCollection(travelRes.value.data) : [];
            const staffOvertime = overtimeRes.status === 'fulfilled' ? normalizeCollection(overtimeRes.value.data) : [];

            const sortedLeaves = [...staffLeaves].sort((a, b) => {
              const aDate = new Date(a.createdAt || a.updatedAt || a.dateFrom || 0).getTime();
              const bDate = new Date(b.createdAt || b.updatedAt || b.dateFrom || 0).getTime();
              return bDate - aDate;
            });

            setMyLeaveApplications(sortedLeaves.slice(0, 5));

            setStats({
              totalStaff: 0,
              pendingLeaves: countByStatus(staffLeaves, 'Pending'),
              approvedLeaves: countByStatus(staffLeaves, 'Approved'),
              pendingTravelOrders: countByStatus(staffTravel, 'Pending'),
              approvedTravelOrders: countByStatus(staffTravel, 'Approved'),
              pendingOvertimeRequests: countByStatus(staffOvertime, 'Pending'),
              approvedOvertimeRequests: countByStatus(staffOvertime, 'Approved'),
            });
          }

          // Fetch leave records from API (MongoDB only)
          try {
            console.log('[Dashboard] Fetching leave records for staffId:', tempStaffId);
            const leaveRecordsRes = await leaveRecordAPI.getByStaffId(tempStaffId);
            console.log('[Dashboard] API response:', leaveRecordsRes);
            
            // Handle the response structure - backend returns { data: records }
            let records = [];
            if (leaveRecordsRes.data && leaveRecordsRes.data.data && Array.isArray(leaveRecordsRes.data.data)) {
              records = leaveRecordsRes.data.data;
              console.log('[Dashboard] Extracted records from .data.data');
            } else if (leaveRecordsRes.data && Array.isArray(leaveRecordsRes.data)) {
              records = leaveRecordsRes.data;
              console.log('[Dashboard] Extracted records from .data');
            }
            
            console.log('[Dashboard] Records found:', records.length, records);
            setLeaveRecords(records);

            // Calculate leave balance using the same logic as StaffLeaveRecordDetail
            let vlEarned = 0;
            let vlAbsent = 0;
            let slEarned = 0;
            let slAbsent = 0;
            let ctoEarned = 0;

            records.forEach(record => {
              const particulars = String(record.particulars || '').toLowerCase();

              if (
                particulars.includes('vacation leave') ||
                particulars === 'vl' ||
                particulars.includes('earned leave')
              ) {
                vlEarned += parseFloat(record.vlEarned) || 0;
                vlAbsent += parseFloat(record.vlAbsentUndertimeWPay) || 0;
              } else if (particulars.includes('undertime') || particulars.includes('tardy')) {
                vlAbsent += parseFloat(record.vlAbsentUndertimeWPay) || 0;
              }

              if (
                particulars.includes('sick leave') ||
                particulars === 'sl' ||
                particulars.includes('earned leave')
              ) {
                slEarned += parseFloat(record.slEarned) || 0;
                slAbsent += parseFloat(record.slAbsentUndertimeWPay) || 0;
              } else if (particulars.includes('undertime') || particulars.includes('tardy')) {
                slAbsent += parseFloat(record.slAbsentUndertimeWPay) || 0;
              }

              ctoEarned += parseFloat(record.cto) || 0;
            });

            const vlBalance = vlEarned - vlAbsent;
            const slBalance = slEarned - slAbsent;

            console.log('[Dashboard] Leave balance calculated:', {
              vacationLeaveBalance: Math.max(0, vlBalance),
              sickLeaveBalance: Math.max(0, slBalance),
              ctoEarned,
              vacationLeaveEarned: vlEarned,
              sickLeaveEarned: slEarned,
            });

            setLeaveBalance({
              vacationLeaveBalance: Math.max(0, vlBalance),
              sickLeaveBalance: Math.max(0, slBalance),
              ctoBalance: ctoEarned,
              vacationLeaveEarned: vlEarned,
              sickLeaveEarned: slEarned,
              ctoEarned,
            });
          } catch (apiErr) {
            console.error('[Dashboard] Error fetching leave records from API:', apiErr);
            // No fallback - MongoDB is required
            setLeaveRecords([]);
            setLeaveBalance({
              vacationLeaveBalance: 0,
              sickLeaveBalance: 0,
              ctoEarned: 0,
              ctoBalance: 0,
              vacationLeaveEarned: 0,
              sickLeaveEarned: 0,
            });
          }
        }

        await refreshMyPds();
      } catch (error) {
        console.error('Error fetching stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [userRole, staffId, isAdminUser, isHeadOfficer, normalizedRole]);

  if (loading) return <div className="text-center p-8">Loading...</div>;

  const handleCardClick = (path, status = null) => {
    if (status) {
      navigate(`${path}?status=${status}`);
    } else {
      navigate(path);
    }
  };

  const formatDate = (value) => {
    if (!value) return 'N/A';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 'N/A' : date.toLocaleDateString();
  };

  const formatAddress = (address) => {
    if (!address) return 'N/A';
    if (typeof address === 'string') return address || 'N/A';

    const parts = [
      address.houseBlockLotNo,
      address.street,
      address.subdivisionVillage,
      address.barangay,
      address.cityMunicipality,
      address.province,
      address.zipCode ? `ZIP ${address.zipCode}` : '',
    ].filter(Boolean);

    return parts.length ? parts.join(', ') : 'N/A';
  };

  const formatName = (parts = []) => {
    const normalized = parts.filter(Boolean);
    return normalized.length ? normalized.join(', ') : 'N/A';
  };

  const normalizeCollection = (payload) => {
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.data)) return payload.data;
    if (Array.isArray(payload?.results)) return payload.results;
    return [];
  };

  const countByStatus = (items, targetStatus) => {
    const normalizedTarget = normalizeText(targetStatus);
    return normalizeCollection(items).filter((item) => normalizeText(item?.status) === normalizedTarget).length;
  };

  const formatMetricValue = (value) => {
    if (!value) return '-';
    return Number(value).toFixed(2);
  };

  const formatLeaveType = (value) => {
    if (!value) return 'Leave Request';
    return value
      .split(' ')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  };

  const formatDateShort = (value) => {
    if (!value) return 'N/A';
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? 'N/A'
      : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const profileName = personalInfo.name && personalInfo.name !== '-' ? personalInfo.name : 'FirstName LastName';
  const profileRole = personalInfo.position && personalInfo.position !== '-' ? personalInfo.position : 'Position';
  const profileDepartment = personalInfo.department && personalInfo.department !== '-' ? personalInfo.department : 'Department';

  const statusCards = [
    isApprover
      ? {
          key: 'total-staff',
          title: 'STAFF',
          value: stats.totalStaff,
          icon: <MdGroup size={28} className="text-blue-400" />,
          onClick: () => handleCardClick('/staffs'),
        }
      : null,
    {
      key: 'pending-leaves',
      title: isApprover ? 'PENDING LEAVE REQUESTS' : 'PENDING LEAVES',
      value: stats.pendingLeaves,
      icon: <TbClockHour2 size={28} className="text-blue-400" />,
      onClick: () => handleCardClick(isApprover ? '/approve-leaves' : '/my-leaves', isApprover ? null : 'Pending'),
    },
    !isHeadOfficer
      ? {
          key: 'approved-leaves',
          title: 'APPROVED LEAVES',
          value: stats.approvedLeaves,
          icon: <TbCheck size={28} className="text-blue-400" />,
          onClick: () => handleCardClick(isAdminUser ? '/approve-leaves' : '/my-leaves', isAdminUser ? null : 'Approved'),
        }
      : null,
    {
      key: 'pending-travel',
      title: isApprover ? 'PENDING TRAVEL REQUESTS' : 'PENDING TRAVEL REQUESTS',
      value: stats.pendingTravelOrders,
      icon: <TbClipboardList size={28} className="text-blue-400" />,
      onClick: () => handleCardClick(isApprover ? '/approve-travel' : '/my-travel', isApprover ? null : 'Pending'),
    },
    !isHeadOfficer
      ? {
          key: 'approved-travel',
          title: 'APPROVED TRAVEL ORDERS',
          value: stats.approvedTravelOrders,
          icon: <MdApproval size={28} className="text-blue-400" />,
          onClick: () => handleCardClick(isAdminUser ? '/approve-travel' : '/my-travel', isAdminUser ? null : 'Approved'),
        }
      : null,
    {
      key: 'pending-overtime',
      title: 'PENDING OVERTIME REQUESTS',
      value: stats.pendingOvertimeRequests,
      icon: <TbClockHour2 size={28} className="text-blue-400" />,
      onClick: () => handleCardClick(isApprover ? '/approve-requests?tab=overtime' : '/overtime?tab=my'),
    },
    {
      key: 'approved-overtime',
      title: 'APPROVED OVERTIME REQUESTS',
      value: stats.approvedOvertimeRequests,
      icon: <TbFileDescription size={28} className="text-blue-400" />,
      onClick: () => handleCardClick(isApprover ? '/approve-requests?tab=overtime' : '/overtime?tab=my'),
    },
  ].filter(Boolean);

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight text-blue-950 mb-6">Dashboard</h1>

      <div className="mb-6 border-b border-blue-100">
        <nav className="flex flex-wrap gap-2 pb-3" aria-label="Dashboard tabs">
          <button
            type="button"
            onClick={() => setActiveTab('leave-balance')}
            className={`px-4 py-2 rounded-md text-sm font-semibold transition ${
              activeTab === 'leave-balance'
                ? 'bg-blue-500 text-white shadow-sm'
                : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
            }`}
          >
            Summary
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('personal-info')}
            className={`px-4 py-2 rounded-md text-sm font-semibold transition ${
              activeTab === 'personal-info'
                ? 'bg-blue-500 text-white shadow-sm'
                : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
            }`}
          >
            Personal Information
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('my-pds');
              refreshMyPds();
            }}
            className={`px-4 py-2 rounded-md text-sm font-semibold transition ${
              activeTab === 'my-pds'
                ? 'bg-blue-500 text-white shadow-sm'
                : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
            }`}
          >
            My PDS
          </button>
          {isAdminUser && (
            <button
              type="button"
              onClick={() => setActiveTab('analytics')}
              className={`px-4 py-2 rounded-md text-sm font-semibold transition ${
                activeTab === 'analytics'
                  ? 'bg-blue-500 text-white shadow-sm'
                  : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
              }`}
            >
              Analytics & Insights
            </button>
          )}
        </nav>
      </div>

      {activeTab === 'leave-balance' && (
        <div className="space-y-5">
          <section className="rounded-2xl border border-blue-100 bg-gradient-to-r from-blue-100 via-sky-100 to-emerald-100 p-4 sm:p-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-3 sm:gap-4">
                <div className="h-14 w-14 sm:h-16 sm:w-16 rounded-full bg-blue-500/20 ring-2 ring-blue-300 flex items-center justify-center text-blue-700 font-bold text-xl">
                  {profileName && profileName !== 'FirstName LastName'
                    ? profileName
                        .split(' ')
                        .filter(Boolean)
                        .slice(0, 2)
                        .map((namePart) => namePart.charAt(0).toUpperCase())
                        .join('')
                    : 'FL'}
                </div>
                <div>
                  <h2 className="text-2xl font-extrabold text-blue-900 leading-tight">{profileName}</h2>
                  <p className="text-blue-800/80 leading-tight">{profileRole}</p>
                  <p className="text-blue-800/80 leading-tight">{profileDepartment}</p>
                  <div className="inline-flex items-center mt-2 rounded-full bg-blue-800/10 px-3 py-1 text-xs sm:text-sm font-medium text-blue-800">
                    Employee No. {personalInfo.staffId || 'N/A'}
                  </div>
                </div>
              </div>

              <div className="self-start sm:self-auto rounded-full border-4 border-slate-500/70 h-20 w-20 flex flex-col items-center justify-center bg-white/70 text-slate-700">
                <p className="text-3xl font-bold leading-none">0</p>
                <p className="text-[11px] tracking-wide uppercase">Yr Service</p>
              </div>
            </div>
          </section>

          {!currentStaffId && (
            <div className="bg-white rounded-2xl border border-blue-200 shadow-sm p-4 text-sm text-gray-600">
              Leave balance is not available because no staff profile is linked to your account.
            </div>
          )}

          <section className="grid grid-cols-1 xl:grid-cols-12 gap-5">
            <div className="xl:col-span-6 space-y-5">
              <article className="bg-white rounded-2xl border-2 border-blue-300 p-4 sm:p-5">
                <h3 className="text-xl font-extrabold text-blue-800 mb-5 flex items-center gap-2">
                  <TbWallet size={24} />
                  <span>LEAVE BALANCES</span>
                </h3>
                <div className="grid grid-cols-4 text-blue-700 font-semibold text-sm sm:text-base">
                  <div className="pr-3 border-r border-blue-300">Metric</div>
                  <div className="px-3 border-r border-blue-300 text-center">Vacation Leave</div>
                  <div className="px-3 border-r border-blue-300 text-center">Sick Leave</div>
                  <div className="pl-3 text-center">CTO</div>
                </div>

                <div className="mt-3 grid grid-cols-4 text-sm sm:text-base">
                  <div className="pr-3 py-1.5 text-blue-700 font-semibold border-r border-blue-200">Total Earned</div>
                  <div className="px-3 py-1.5 text-center text-slate-700 border-r border-blue-200">{formatMetricValue(leaveBalance.vacationLeaveEarned)}</div>
                  <div className="px-3 py-1.5 text-center text-slate-700 border-r border-blue-200">{formatMetricValue(leaveBalance.sickLeaveEarned)}</div>
                  <div className="pl-3 py-1.5 text-center text-slate-700">{formatMetricValue(leaveBalance.ctoEarned)}</div>
                </div>
                <div className="grid grid-cols-4 text-sm sm:text-base">
                  <div className="pr-3 py-1.5 text-blue-700 font-semibold border-r border-blue-200">Balance</div>
                  <div className="px-3 py-1.5 text-center font-semibold text-slate-800 border-r border-blue-200">{formatMetricValue(leaveBalance.vacationLeaveBalance)}</div>
                  <div className="px-3 py-1.5 text-center font-semibold text-slate-800 border-r border-blue-200">{formatMetricValue(leaveBalance.sickLeaveBalance)}</div>
                  <div className="pl-3 py-1.5 text-center font-semibold text-slate-800">{formatMetricValue(leaveBalance.ctoBalance)}</div>
                </div>
              </article>

              <article className="bg-white rounded-2xl border-2 border-blue-300 p-4 sm:p-5 min-h-[220px]">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-extrabold text-blue-800 flex items-center gap-2">
                    <TbCalendarEvent size={24} />
                    <span>RECENT LEAVE APPLICATIONS</span>
                  </h3>
                  <button
                    type="button"
                    onClick={() => navigate(isApprover ? '/approve-leaves' : '/my-leaves')}
                    className="text-blue-500 hover:text-blue-700 font-medium text-sm"
                  >
                    View All
                  </button>
                </div>

                {myLeaveApplications.length > 0 ? (
                  <div className="space-y-3">
                    {myLeaveApplications.map((leave) => (
                      <div
                        key={leave.id || leave._id || `${leave.leaveType}-${leave.createdAt}`}
                        className="rounded-xl border border-blue-100 bg-slate-50 px-3 py-2"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="font-semibold text-slate-800">{formatLeaveType(leave.leaveType)}</p>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-semibold">
                            {leave.status || 'Pending'}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 mt-1">
                          {formatDateShort(leave.dateFrom)} - {formatDateShort(leave.dateTo)}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="h-[140px] flex flex-col items-center justify-center text-slate-400">
                    <TbClipboardList size={38} />
                    <p className="mt-2 text-sm">No Leave Applications Yet</p>
                  </div>
                )}
              </article>
            </div>

            <div className="xl:col-span-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {statusCards.map((card) => (
                  <button
                    key={card.key}
                    type="button"
                    onClick={card.onClick}
                    className="bg-white rounded-2xl border-2 border-blue-300 px-4 py-5 text-center hover:shadow-md hover:-translate-y-0.5 transition"
                  >
                    <div className="flex justify-center mb-1">{card.icon}</div>
                    <p className="text-5xl leading-none font-bold text-blue-700">{card.value ?? 0}</p>
                    <p className="mt-1.5 text-[11px] sm:text-xs tracking-wide text-slate-700 font-semibold">{card.title}</p>
                  </button>
                ))}
              </div>
            </div>
          </section>
        </div>
      )}

      {activeTab === 'personal-info' && (
        <div className="bg-white rounded-lg border border-blue-100 shadow-sm p-6">
          <h2 className="text-2xl font-bold text-blue-950 mb-6">Personal Information</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-500 mb-1">Item Number</p>
              <p className="text-lg font-semibold text-gray-800">{personalInfo.staffId || '-'}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-500 mb-1">Full Name</p>
              <p className="text-lg font-semibold text-gray-800">{personalInfo.name || '-'}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-500 mb-1">Email</p>
              <p className="text-lg font-semibold text-gray-800">{personalInfo.email || '-'}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-500 mb-1">Phone</p>
              <p className="text-lg font-semibold text-gray-800">{personalInfo.phone || '-'}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-500 mb-1">Department</p>
              <p className="text-lg font-semibold text-gray-800">{personalInfo.department || '-'}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-500 mb-1">Position</p>
              <p className="text-lg font-semibold text-gray-800">{personalInfo.position || '-'}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-500 mb-1">Role</p>
              <p className="text-lg font-semibold text-gray-800">
                {ROLE_DISPLAY_NAMES[normalizeRole(personalInfo.role)] || personalInfo.role || '-'}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-500 mb-1">Account Status</p>
              <p className="text-lg font-semibold text-gray-800">{personalInfo.accountStatus || '-'}</p>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'my-pds' && (
        <div className="bg-white rounded-lg border border-blue-100 shadow-sm p-6 space-y-5">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h2 className="text-2xl font-bold text-blue-950">My Personal Data Sheet</h2>
            <button
              type="button"
              onClick={() => {
                if (!canOpenPdsForm) return;
                navigate(
                  '/submit-personal-data-sheet',
                  openPdsFormState ? { state: openPdsFormState } : undefined
                );
              }}
              disabled={!canOpenPdsForm}
              className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 transition text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {canOpenPdsForm
                ? (myPds.approvedPds || myPds.latestSubmission ? 'Update My PDS' : 'Submit My PDS')
                : 'Update Locked'}
            </button>
          </div>

          {myPdsLoading && <p className="text-gray-600">Loading your PDS details...</p>}

          {!myPdsLoading && myPdsError && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
              {myPdsError}
            </div>
          )}

          {!myPdsLoading && !myPdsError && !myPds.approvedPds && normalizedLatestPdsStatus === 'pending' && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-yellow-800">
              Your latest PDS submission is pending admin approval. Approved details will appear here automatically once reviewed.
            </div>
          )}

          {!myPdsLoading && !myPdsError && !myPds.approvedPds && normalizedLatestPdsStatus === 'disapproved' && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 space-y-2">
              <p>Your latest PDS was disapproved. You may resubmit your PDS using the button above.</p>
              {myPds.latestSubmission?.remarks && (
                <p><span className="font-semibold">Admin Remarks:</span> {myPds.latestSubmission.remarks}</p>
              )}
            </div>
          )}

          {!myPdsLoading && !myPdsError && !myPds.approvedPds && normalizedLatestPdsStatus === 'for revision' && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 text-orange-800 space-y-2">
              <p>Your latest PDS was returned for revision. Please update and resubmit your PDS.</p>
              {myPds.latestSubmission?.remarks && (
                <p><span className="font-semibold">Admin Remarks:</span> {myPds.latestSubmission.remarks}</p>
              )}
            </div>
          )}

          {!myPdsLoading && !myPdsError && !myPds.approvedPds && myPds.latestSubmission && !hasKnownLatestPdsStatus && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-blue-700 space-y-2">
              <p>Your latest PDS status is: <span className="font-semibold">{myPds.latestSubmission?.status || 'Unknown'}</span>.</p>
              <p>Your submission is on record. If this status persists, please contact Admin/HR to review it.</p>
            </div>
          )}

          {!myPdsLoading && !myPdsError && !myPds.approvedPds && !myPds.latestSubmission && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-blue-700">
              You have not submitted a Personal Data Sheet yet.
            </div>
          )}

          {!myPdsLoading && !myPdsError && myPds.approvedPds && (
            <>
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-green-700">
                Approved by {myPds.approvedPds.reviewedBy || 'Admin'} on {myPds.approvedPds.reviewedAt ? new Date(myPds.approvedPds.reviewedAt).toLocaleDateString() : 'N/A'}.
              </div>

              {!approvedUpdateAllowed && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-yellow-800">
                  Your approved PDS is locked for updates. Please ask Admin/HR to grant update permission from the PDS record view.
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-500 mb-1">PDS ID</p>
                  <p className="text-base font-semibold text-gray-800">{myPds.approvedPds.pdsId || '-'}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-500 mb-1">Status</p>
                  <p className="text-base font-semibold text-gray-800">{myPds.approvedPds.status || '-'}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-500 mb-1">Full Name</p>
                  <p className="text-base font-semibold text-gray-800">
                    {[myPds.approvedPds.surname, myPds.approvedPds.firstName, myPds.approvedPds.middleName, myPds.approvedPds.nameExtension].filter(Boolean).join(', ') || '-'}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-500 mb-1">Date of Birth</p>
                  <p className="text-base font-semibold text-gray-800">
                    {myPds.approvedPds.dateOfBirth ? new Date(myPds.approvedPds.dateOfBirth).toLocaleDateString() : '-'}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-500 mb-1">Email</p>
                  <p className="text-base font-semibold text-gray-800">{myPds.approvedPds.email || '-'}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-500 mb-1">Mobile</p>
                  <p className="text-base font-semibold text-gray-800">{myPds.approvedPds.mobile || '-'}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-500 mb-1">Place of Birth</p>
                  <p className="text-base font-semibold text-gray-800">{myPds.approvedPds.placeOfBirth || '-'}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-500 mb-1">Civil Status</p>
                  <p className="text-base font-semibold text-gray-800">{myPds.approvedPds.civilStatus || '-'}</p>
                </div>
              </div>

              <div className="pt-2 border-t border-gray-200 space-y-6 text-sm text-gray-800">
                <div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-2">Personal Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <p><span className="font-semibold">Name:</span> {formatName([myPds.approvedPds.surname, myPds.approvedPds.firstName, myPds.approvedPds.middleName, myPds.approvedPds.nameExtension])}</p>
                    <p><span className="font-semibold">Email:</span> {myPds.approvedPds.email || 'N/A'}</p>
                    <p><span className="font-semibold">Mobile:</span> {myPds.approvedPds.mobile || 'N/A'}</p>
                    <p><span className="font-semibold">Telephone:</span> {myPds.approvedPds.telephone || 'N/A'}</p>
                    <p><span className="font-semibold">Date of Birth:</span> {formatDate(myPds.approvedPds.dateOfBirth)}</p>
                    <p><span className="font-semibold">Place of Birth:</span> {myPds.approvedPds.placeOfBirth || 'N/A'}</p>
                    <p><span className="font-semibold">Sex:</span> {myPds.approvedPds.sexAtBirth || 'N/A'}</p>
                    <p><span className="font-semibold">Civil Status:</span> {myPds.approvedPds.civilStatus || 'N/A'}</p>
                    <p><span className="font-semibold">Citizenship:</span> {myPds.approvedPds.citizenship?.type || 'N/A'}</p>
                    <p><span className="font-semibold">Residential Address:</span> {formatAddress(myPds.approvedPds.residentialAddress)}</p>
                    <p><span className="font-semibold">Permanent Address:</span> {formatAddress(myPds.approvedPds.permanentAddress)}</p>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-2">Family Background</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-3">
                    <p><span className="font-semibold">Spouse:</span> {formatName([myPds.approvedPds.familyBackground?.spouse?.surname, myPds.approvedPds.familyBackground?.spouse?.firstName, myPds.approvedPds.familyBackground?.spouse?.middleName, myPds.approvedPds.familyBackground?.spouse?.nameExtension])}</p>
                    <p><span className="font-semibold">Spouse Occupation:</span> {myPds.approvedPds.familyBackground?.spouse?.occupation || 'N/A'}</p>
                    <p><span className="font-semibold">Spouse Employer:</span> {myPds.approvedPds.familyBackground?.spouse?.employerBusinessName || 'N/A'}</p>
                    <p><span className="font-semibold">Spouse Business Address:</span> {myPds.approvedPds.familyBackground?.spouse?.businessAddress || 'N/A'}</p>
                    <p><span className="font-semibold">Father:</span> {formatName([myPds.approvedPds.familyBackground?.father?.surname, myPds.approvedPds.familyBackground?.father?.firstName, myPds.approvedPds.familyBackground?.father?.middleName, myPds.approvedPds.familyBackground?.father?.nameExtension])}</p>
                    <p><span className="font-semibold">Mother:</span> {formatName([myPds.approvedPds.familyBackground?.mother?.surname, myPds.approvedPds.familyBackground?.mother?.firstName, myPds.approvedPds.familyBackground?.mother?.middleName])}</p>
                  </div>

                  <div>
                    <p className="font-semibold mb-1">Children</p>
                    {myPds.approvedPds.familyBackground?.children?.length ? (
                      <ul className="list-disc pl-5 space-y-1">
                        {myPds.approvedPds.familyBackground.children.map((child, index) => (
                          <li key={`${child.name || 'child'}-${index}`}>
                            {child.name || 'N/A'} {child.dateOfBirth ? `(${formatDate(child.dateOfBirth)})` : ''}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p>N/A</p>
                    )}
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-2">Educational Background</h3>
                  {myPds.approvedPds.educationalBackground?.length ? (
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse">
                        <thead>
                          <tr className="bg-gray-100">
                            <th className="border border-gray-300 px-2 py-1 text-left">Level</th>
                            <th className="border border-gray-300 px-2 py-1 text-left">School</th>
                            <th className="border border-gray-300 px-2 py-1 text-left">Degree/Course</th>
                            <th className="border border-gray-300 px-2 py-1 text-left">Period</th>
                            <th className="border border-gray-300 px-2 py-1 text-left">Units Earned</th>
                            <th className="border border-gray-300 px-2 py-1 text-left">Year Graduated</th>
                            <th className="border border-gray-300 px-2 py-1 text-left">Honors</th>
                          </tr>
                        </thead>
                        <tbody>
                          {myPds.approvedPds.educationalBackground.map((row, index) => (
                            <tr key={`${row.level || 'level'}-${index}`}>
                              <td className="border border-gray-300 px-2 py-1">{row.level || 'N/A'}</td>
                              <td className="border border-gray-300 px-2 py-1">{row.schoolName || 'N/A'}</td>
                              <td className="border border-gray-300 px-2 py-1">{row.basicEducationDegreeCourse || 'N/A'}</td>
                              <td className="border border-gray-300 px-2 py-1">{[row.periodFrom, row.periodTo].filter(Boolean).join(' - ') || 'N/A'}</td>
                              <td className="border border-gray-300 px-2 py-1">{row.highestLevelUnitsEarned || 'N/A'}</td>
                              <td className="border border-gray-300 px-2 py-1">{row.yearGraduated || 'N/A'}</td>
                              <td className="border border-gray-300 px-2 py-1">{row.scholarshipAcademicHonorsReceived || 'N/A'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p>N/A</p>
                  )}
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-2">Work Experience</h3>
                  {myPds.approvedPds.workExperience?.length ? (
                    <ul className="list-disc pl-5 space-y-1">
                      {myPds.approvedPds.workExperience.map((item, index) => (
                        <li key={`work-${index}`}>
                          {item.positionTitle || 'N/A'} at {item.company || 'N/A'} ({item.from || 'N/A'} - {item.to || 'N/A'}) {item.duties ? `- ${item.duties}` : ''}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p>N/A</p>
                  )}
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-2">Voluntary Work</h3>
                  {myPds.approvedPds.voluntaryWork?.length ? (
                    <ul className="list-disc pl-5 space-y-1">
                      {myPds.approvedPds.voluntaryWork.map((item, index) => (
                        <li key={`vol-${index}`}>
                          {item.organization || 'N/A'} ({item.from || 'N/A'} - {item.to || 'N/A'}) - {item.hours || 'N/A'} hrs - {item.position || 'N/A'}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p>N/A</p>
                  )}
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-2">Learning and Development</h3>
                  {myPds.approvedPds.learningDevelopment?.length ? (
                    <ul className="list-disc pl-5 space-y-1">
                      {myPds.approvedPds.learningDevelopment.map((item, index) => (
                        <li key={`learn-${index}`}>
                          {item.title || 'N/A'} ({item.from || 'N/A'} - {item.to || 'N/A'}) - {item.hours || 'N/A'} hrs - {item.conductedBy || 'N/A'}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p>N/A</p>
                  )}
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-2">Skills, Distinctions, Memberships</h3>
                  <p><span className="font-semibold">Hobbies / Special Skills:</span> {myPds.approvedPds.specialSkills?.filter(Boolean).join(', ') || 'N/A'}</p>
                  <p><span className="font-semibold">Distinctions:</span> {myPds.approvedPds.distinctions?.filter(Boolean).join(', ') || 'N/A'}</p>
                  <p><span className="font-semibold">Memberships:</span> {myPds.approvedPds.memberships?.filter(Boolean).join(', ') || 'N/A'}</p>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-2">Other Declarations</h3>
                  <p><span className="font-semibold">Related (3rd degree):</span> {myPds.approvedPds.relatedThirdDegree || 'N/A'}</p>
                  <p><span className="font-semibold">Related (4th degree):</span> {myPds.approvedPds.relatedFourthDegree || 'N/A'}</p>
                  <p><span className="font-semibold">Related details:</span> {myPds.approvedPds.relatedDetails || 'N/A'}</p>
                  <p><span className="font-semibold">Administrative offense:</span> {myPds.approvedPds.adminOffense || 'N/A'} {myPds.approvedPds.adminOffenseDetails ? `- ${myPds.approvedPds.adminOffenseDetails}` : ''}</p>
                  <p><span className="font-semibold">Criminal charge:</span> {myPds.approvedPds.criminalCharge || 'N/A'} {myPds.approvedPds.criminalChargeDetails ? `- ${myPds.approvedPds.criminalChargeDetails}` : ''} {myPds.approvedPds.criminalChargeDateFiled ? `(${formatDate(myPds.approvedPds.criminalChargeDateFiled)})` : ''} {myPds.approvedPds.criminalChargeStatus ? `- ${myPds.approvedPds.criminalChargeStatus}` : ''}</p>
                  <p><span className="font-semibold">Convicted:</span> {myPds.approvedPds.convicted || 'N/A'} {myPds.approvedPds.convictedDetails ? `- ${myPds.approvedPds.convictedDetails}` : ''}</p>
                  <p><span className="font-semibold">Separated:</span> {myPds.approvedPds.separated || 'N/A'} {myPds.approvedPds.separatedDetails ? `- ${myPds.approvedPds.separatedDetails}` : ''}</p>
                  <p><span className="font-semibold">Candidate:</span> {myPds.approvedPds.candidate || 'N/A'} {myPds.approvedPds.candidateDetails ? `- ${myPds.approvedPds.candidateDetails}` : ''}</p>
                  <p><span className="font-semibold">Resigned to campaign:</span> {myPds.approvedPds.resignedToCampaign || 'N/A'} {myPds.approvedPds.resignedDetails ? `- ${myPds.approvedPds.resignedDetails}` : ''}</p>
                  <p><span className="font-semibold">Immigrant:</span> {myPds.approvedPds.immigrant || 'N/A'} {myPds.approvedPds.immigrantCountry ? `- ${myPds.approvedPds.immigrantCountry}` : ''}</p>
                  <p><span className="font-semibold">Indigenous:</span> {myPds.approvedPds.indigenous || 'N/A'} {myPds.approvedPds.indigenousDetails ? `- ${myPds.approvedPds.indigenousDetails}` : ''}</p>
                  <p><span className="font-semibold">PWD:</span> {myPds.approvedPds.pwd || 'N/A'} {myPds.approvedPds.pwdId ? `- ${myPds.approvedPds.pwdId}` : ''}</p>
                  <p><span className="font-semibold">Solo Parent:</span> {myPds.approvedPds.soloParent || 'N/A'} {myPds.approvedPds.soloParentId ? `- ${myPds.approvedPds.soloParentId}` : ''}</p>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-2">References</h3>
                  {myPds.approvedPds.references?.length ? (
                    <ul className="list-disc pl-5 space-y-1">
                      {myPds.approvedPds.references.map((item, index) => (
                        <li key={`ref-${index}`}>{item.name || 'N/A'} - {item.address || 'N/A'} - {item.contact || 'N/A'}</li>
                      ))}
                    </ul>
                  ) : (
                    <p>N/A</p>
                  )}
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-2">Government ID</h3>
                  <p>{myPds.approvedPds.govId?.idType || 'N/A'} {myPds.approvedPds.govId?.number ? `- ${myPds.approvedPds.govId.number}` : ''} {myPds.approvedPds.govId?.datePlace ? `- ${myPds.approvedPds.govId.datePlace}` : ''}</p>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      <div className="h-2" />

      {/* Analytics Section - Admin Only */}
      {isAdminUser && activeTab === 'analytics' && (
        <div className="mt-8">
          <h2 className="text-2xl font-bold text-blue-950 mb-6">Analytics & Insights</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
            {/* Approval Rate */}
            <div className="bg-white rounded-lg border border-blue-100 shadow-sm p-6">
              <p className="text-gray-600 text-sm font-semibold mb-2">Leave Approval Rate</p>
              <p className="text-3xl font-bold text-purple-600">{analytics.approvalRate}%</p>
              <p className="text-xs text-gray-500 mt-2">Approved vs Total</p>
            </div>

            {/* Disapproved Leaves */}
            <div className="bg-white rounded-lg border border-blue-100 shadow-sm p-6">
              <p className="text-gray-600 text-sm font-semibold mb-2">Disapproved Leaves</p>
              <p className="text-3xl font-bold text-red-600">{analytics.disapprovedLeaves}</p>
              <p className="text-xs text-gray-500 mt-2">Denied requests</p>
            </div>

            {/* Disapproved Travel Orders */}
            <div className="bg-white rounded-lg border border-blue-100 shadow-sm p-6">
              <p className="text-gray-600 text-sm font-semibold mb-2">Disapproved Travel</p>
              <p className="text-3xl font-bold text-orange-600">{analytics.disapprovedTravelOrders}</p>
              <p className="text-xs text-gray-500 mt-2">Denied requests</p>
            </div>

            {/* Total Requests */}
            <div className="bg-white rounded-lg border border-blue-100 shadow-sm p-6">
              <p className="text-gray-600 text-sm font-semibold mb-2">Total Requests</p>
              <p className="text-3xl font-bold text-indigo-600">
                {stats.pendingLeaves + stats.approvedLeaves + analytics.disapprovedLeaves + stats.pendingTravelOrders + stats.approvedTravelOrders + analytics.disapprovedTravelOrders}
              </p>
              <p className="text-xs text-gray-500 mt-2">Leaves + Travel</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Leave Types Breakdown */}
            <div className="bg-white rounded-lg border border-blue-100 shadow-sm p-6">
              <h3 className="text-lg font-bold text-blue-950 mb-4">Leave Types Distribution</h3>
              {Object.entries(analytics.leavesByType).length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={Object.entries(analytics.leavesByType).map(([type, count]) => ({
                          name: type,
                          value: count,
                        }))}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, value }) => `${name}: ${value}`}
                        outerRadius={100}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {Object.entries(analytics.leavesByType).map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'][index % 6]} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-3 mt-6">
                    {Object.entries(analytics.leavesByType).map(([type, count]) => (
                      <div key={type} className="flex justify-between items-center">
                        <span className="text-gray-700">{type}</span>
                        <div className="flex items-center gap-2">
                          <div className="w-40 bg-gray-200 rounded-full h-2">
                            <div 
                              className="bg-blue-500 h-2 rounded-full" 
                              style={{ width: `${(count / Object.values(analytics.leavesByType).reduce((a, b) => a + b, 0)) * 100}%` }}
                            />
                          </div>
                          <span className="font-semibold text-gray-800 w-8">{count}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <p className="text-gray-500 text-sm">No leave data available</p>
              )}
            </div>

            {/* Transport Mode Breakdown */}
            <div className="bg-white rounded-lg border border-blue-100 shadow-sm p-6">
              <h3 className="text-lg font-bold text-blue-950 mb-4">Travel Mode Distribution</h3>
              {Object.entries(analytics.travelByMode).length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={Object.entries(analytics.travelByMode).map(([mode, count]) => ({
                          name: mode,
                          value: count,
                        }))}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, value }) => `${name}: ${value}`}
                        outerRadius={100}
                        fill="#10b981"
                        dataKey="value"
                      >
                        {Object.entries(analytics.travelByMode).map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={['#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#8b5cf6', '#ec4899'][index % 6]} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-3 mt-6">
                    {Object.entries(analytics.travelByMode).map(([mode, count]) => (
                      <div key={mode} className="flex justify-between items-center">
                        <span className="text-gray-700">{mode}</span>
                        <div className="flex items-center gap-2">
                          <div className="w-40 bg-gray-200 rounded-full h-2">
                            <div 
                              className="bg-green-500 h-2 rounded-full" 
                              style={{ width: `${(count / Object.values(analytics.travelByMode).reduce((a, b) => a + b, 0)) * 100}%` }}
                            />
                          </div>
                          <span className="font-semibold text-gray-800 w-8">{count}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <p className="text-gray-500 text-sm">No travel data available</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Dashboard;
