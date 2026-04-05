import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MdGroup, MdApproval } from 'react-icons/md';
import { TbClockHour2, TbClipboardList, TbCheck, TbFileDescription } from 'react-icons/tb';
import { PieChart, Pie, Cell, Legend, Tooltip, ResponsiveContainer } from 'recharts';
import { leaveAPI, travelOrderAPI, staffAPI, leaveRecordAPI, personalDataSheetAPI } from '../api';
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
  });
  const [analytics, setAnalytics] = useState({
    disapprovedLeaves: 0,
    disapprovedTravelOrders: 0,
    leavesByType: {},
    travelByMode: {},
    approvalRate: 0,
  });
  const [leaveRecords, setLeaveRecords] = useState([]);
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

  const refreshMyPds = async () => {
    try {
      setMyPdsLoading(true);
      setMyPdsError('');
      const myPdsRes = await personalDataSheetAPI.getMy();
      setMyPds({
        latestSubmission: myPdsRes.data?.latestSubmission || null,
        approvedPds: myPdsRes.data?.approvedPds || null,
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
        let tempStaffId = staffId || storedUser.staffId || storedUser.id;

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

        if (tempStaffId) {
          try {
            const profileRes = await staffAPI.getById(tempStaffId);
            const profile = profileRes.data || {};

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
          } catch (profileErr) {
            console.error('[Dashboard] Error fetching profile details:', profileErr);
          }
        }

        if (isAdminUser) {
          const staffRes = await staffAPI.getAll();
          const leavesRes = await leaveAPI.getAll();
          const travelRes = await travelOrderAPI.getAll();

          const pendingLeaves = leavesRes.data.filter(l => l.status === 'Pending').length;
          const approvedLeaves = leavesRes.data.filter(l => l.status === 'Approved').length;
          const disapprovedLeaves = leavesRes.data.filter(l => l.status === 'Disapproved').length;
          const pendingTravel = travelRes.data.filter(t => t.status === 'Pending').length;
          const approvedTravel = travelRes.data.filter(t => t.status === 'Approved').length;
          const disapprovedTravel = travelRes.data.filter(t => t.status === 'Disapproved').length;

          setStats({
            totalStaff: staffRes.data.length,
            pendingLeaves,
            approvedLeaves,
            pendingTravelOrders: pendingTravel,
            approvedTravelOrders: approvedTravel,
          });

          // Calculate analytics
          const leavesByType = {};
          leavesRes.data.forEach(leave => {
            leavesByType[leave.leaveType] = (leavesByType[leave.leaveType] || 0) + 1;
          });

          const travelByMode = {};
          travelRes.data.forEach(travel => {
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
          const staffRes = await staffAPI.getAll();
          const leavesRes = await leaveAPI.getAll('Pending');
          const travelRes = await travelOrderAPI.getAll('Pending');

          setStats({
            totalStaff: staffRes.data.length,
            pendingLeaves: leavesRes.data.length,
            approvedLeaves: 0,
            pendingTravelOrders: travelRes.data.length,
            approvedTravelOrders: 0,
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
          if (normalizedRole === ROLES.STAFF) {
            const leavesRes = await leaveAPI.getByStaffId(tempStaffId);
            const travelRes = await travelOrderAPI.getByStaffId(tempStaffId);

            setStats({
              totalStaff: 0,
              pendingLeaves: leavesRes.data.filter(l => l.status === 'Pending').length,
              approvedLeaves: leavesRes.data.filter(l => l.status === 'Approved').length,
              pendingTravelOrders: travelRes.data.filter(t => t.status === 'Pending').length,
              approvedTravelOrders: travelRes.data.filter(t => t.status === 'Approved').length,
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

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-800 mb-8">Dashboard</h1>

      <div className="mb-8 border-b border-gray-200">
        <nav className="flex flex-wrap gap-2 pb-3" aria-label="Dashboard tabs">
          <button
            type="button"
            onClick={() => setActiveTab('leave-balance')}
            className={`px-4 py-2 rounded-md text-sm font-semibold transition ${
              activeTab === 'leave-balance'
                ? 'bg-blue-600 text-white shadow'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Leave Balance Summary
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('personal-info')}
            className={`px-4 py-2 rounded-md text-sm font-semibold transition ${
              activeTab === 'personal-info'
                ? 'bg-blue-600 text-white shadow'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
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
                ? 'bg-blue-600 text-white shadow'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
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
                  ? 'bg-blue-600 text-white shadow'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Analytics & Insights
            </button>
          )}
        </nav>
      </div>

      {/* Leave Balance Summary Metrics Table - Only this section */}
      {activeTab === 'leave-balance' && currentStaffId && (
        <div className="mt-12">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">Leave Balance Summary</h2>
          
          <div className="bg-white rounded-lg shadow-md overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gray-200 border">
                  <th className="px-6 py-3 border text-left font-bold">Metric</th>
                  <th className="px-6 py-3 border text-center font-bold">Vacation Leave</th>
                  <th className="px-6 py-3 border text-center font-bold">Sick Leave</th>
                  <th className="px-6 py-3 border text-center font-bold">CTO</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border">
                  <td className="px-6 py-3 border font-bold">Total Earned</td>
                  <td className="px-6 py-3 border text-center">{leaveBalance.vacationLeaveEarned === 0 ? '-' : leaveBalance.vacationLeaveEarned.toFixed(2)}</td>
                  <td className="px-6 py-3 border text-center">{leaveBalance.sickLeaveEarned === 0 ? '-' : leaveBalance.sickLeaveEarned.toFixed(2)}</td>
                  <td className="px-6 py-3 border text-center">{leaveBalance.ctoEarned === 0 ? '-' : leaveBalance.ctoEarned.toFixed(2)}</td>
                </tr>
                <tr className="border bg-blue-50">
                  <td className="px-6 py-3 border font-bold">Balance</td>
                  <td className="px-6 py-3 border text-center font-bold">{leaveBalance.vacationLeaveBalance === 0 ? '-' : leaveBalance.vacationLeaveBalance.toFixed(2)}</td>
                  <td className="px-6 py-3 border text-center font-bold">{leaveBalance.sickLeaveBalance === 0 ? '-' : leaveBalance.sickLeaveBalance.toFixed(2)}</td>
                  <td className="px-6 py-3 border text-center font-bold">{leaveBalance.ctoBalance === 0 ? '-' : leaveBalance.ctoBalance.toFixed(2)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'leave-balance' && !currentStaffId && (
        <div className="bg-white rounded-lg shadow-md p-6 text-gray-600">
          Leave balance is not available because no staff profile is linked to your account.
        </div>
      )}

      {activeTab === 'personal-info' && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">Personal Information</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-500 mb-1">Staff ID</p>
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
        <div className="bg-white rounded-lg shadow-md p-6 space-y-5">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h2 className="text-2xl font-bold text-gray-800">My Personal Data Sheet</h2>
            <button
              type="button"
              onClick={() => navigate('/submit-personal-data-sheet', { state: { prefill: true } })}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition"
            >
              {myPds.approvedPds || myPds.latestSubmission ? 'Update My PDS' : 'Submit My PDS'}
            </button>
          </div>

          {myPdsLoading && <p className="text-gray-600">Loading your PDS details...</p>}

          {!myPdsLoading && myPdsError && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
              {myPdsError}
            </div>
          )}

          {!myPdsLoading && !myPdsError && !myPds.approvedPds && myPds.latestSubmission?.status === 'Pending' && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-yellow-800">
              Your latest PDS submission is pending admin approval. Approved details will appear here automatically once reviewed.
            </div>
          )}

          {!myPdsLoading && !myPdsError && !myPds.approvedPds && myPds.latestSubmission?.status === 'Disapproved' && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 space-y-2">
              <p>Your latest PDS was disapproved. You may resubmit your PDS using the button above.</p>
              {myPds.latestSubmission?.remarks && (
                <p><span className="font-semibold">Admin Remarks:</span> {myPds.latestSubmission.remarks}</p>
              )}
            </div>
          )}

          {!myPdsLoading && !myPdsError && !myPds.approvedPds && myPds.latestSubmission?.status === 'For Revision' && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 text-orange-800 space-y-2">
              <p>Your latest PDS was returned for revision. Please update and resubmit your PDS.</p>
              {myPds.latestSubmission?.remarks && (
                <p><span className="font-semibold">Admin Remarks:</span> {myPds.latestSubmission.remarks}</p>
              )}
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

      <br></br>
      <br></br>
      <br></br>
      
      {/* Stats Grid */}
      {activeTab === 'leave-balance' && (
        <>
      <h2 className="text-2xl font-bold text-gray-800 mb-6">Status Overview</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Total Staff - Approvers */}
        {isApprover && (
          <button
            onClick={() => handleCardClick('/staffs')}
            className="bg-white rounded-lg shadow-md p-6 hover:shadow-xl hover:scale-105 transition transform cursor-pointer border-l-4 border-blue-600"
          >
            <div className="flex items-center justify-between">
              <div className="text-left">
                <p className="text-gray-600 text-sm font-semibold mb-2">Total Staff</p>
                <p className="text-4xl font-bold text-blue-600">{stats.totalStaff}</p>
              </div>
              <div className="text-4xl opacity-20 text-blue-600"><MdGroup size={60} /></div>
            </div>
          </button>
        )}
        
        {/* Pending Leaves */}
        <button
          onClick={() => handleCardClick(isApprover ? '/approve-leaves' : '/my-leaves', isApprover ? null : 'Pending')}
          className="bg-white rounded-lg shadow-md p-6 hover:shadow-xl hover:scale-105 transition transform cursor-pointer border-l-4 border-yellow-500"
        >
          <div className="flex items-center justify-between">
            <div className="text-left">
              <p className="text-gray-600 text-sm font-semibold mb-2">{isApprover ? 'Pending Leave Requests' : 'Pending Leaves'}</p>
              <p className="text-4xl font-bold text-yellow-500">{stats.pendingLeaves}</p>
            </div>
            <div className="text-4xl opacity-20 text-yellow-500"><TbClockHour2 size={60} /></div>
          </div>
        </button>

        {/* My PDS */}
        <button
          onClick={() => handleCardClick('/submit-personal-data-sheet')}
          className="bg-white rounded-lg shadow-md p-6 hover:shadow-xl hover:scale-105 transition transform cursor-pointer border-l-4 border-sky-600"
        >
          <div className="flex items-center justify-between">
            <div className="text-left">
              <p className="text-gray-600 text-sm font-semibold mb-2">My PDS</p>
              <p className="text-lg font-bold text-sky-600">Open Form</p>
            </div>
            <div className="text-4xl opacity-20 text-sky-600"><TbFileDescription size={60} /></div>
          </div>
        </button>
        
        {/* Approved Leaves (Staff/Admin only) */}
        {!isHeadOfficer && (
          <button
            onClick={() => handleCardClick(isAdminUser ? '/approve-leaves' : '/my-leaves', isAdminUser ? null : 'Approved')}
            className="bg-white rounded-lg shadow-md p-6 hover:shadow-xl hover:scale-105 transition transform cursor-pointer border-l-4 border-green-600"
          >
            <div className="flex items-center justify-between">
              <div className="text-left">
                <p className="text-gray-600 text-sm font-semibold mb-2">Approved Leaves</p>
                <p className="text-4xl font-bold text-green-600">{stats.approvedLeaves}</p>
              </div>
              <div className="text-4xl opacity-20 text-green-600"><TbCheck size={60} /></div>
            </div>
          </button>
        )}
        
        {/* Pending Travel Orders */}
        <button
          onClick={() => handleCardClick(isApprover ? '/approve-travel' : '/my-travel', isApprover ? null : 'Pending')}
          className="bg-white rounded-lg shadow-md p-6 hover:shadow-xl hover:scale-105 transition transform cursor-pointer border-l-4 border-orange-500"
        >
          <div className="flex items-center justify-between">
            <div className="text-left">
              <p className="text-gray-600 text-sm font-semibold mb-2">{isApprover ? 'Pending Travel Requests' : 'Pending Travel Orders'}</p>
              <p className="text-4xl font-bold text-orange-500">{stats.pendingTravelOrders}</p>
            </div>
            <div className="text-4xl opacity-20 text-orange-500"><TbClipboardList size={60} /></div>
          </div>
        </button>
        
        {/* Approved Travel Orders (Staff/Admin only) */}
        {!isHeadOfficer && (
          <button
            onClick={() => handleCardClick(isAdminUser ? '/approve-travel' : '/my-travel', isAdminUser ? null : 'Approved')}
            className="bg-white rounded-lg shadow-md p-6 hover:shadow-xl hover:scale-105 transition transform cursor-pointer border-l-4 border-indigo-600"
          >
            <div className="flex items-center justify-between">
              <div className="text-left">
                <p className="text-gray-600 text-sm font-semibold mb-2">Approved Travel Orders</p>
                <p className="text-4xl font-bold text-indigo-600">{stats.approvedTravelOrders}</p>
              </div>
              <div className="text-4xl opacity-20 text-indigo-600"><MdApproval size={60} /></div>
            </div>
          </button>
        )}
      </div>
      </>
      )}

      {/* Analytics Section - Admin Only */}
      {isAdminUser && activeTab === 'analytics' && (
        <div className="mt-8">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">Analytics & Insights</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
            {/* Approval Rate */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <p className="text-gray-600 text-sm font-semibold mb-2">Leave Approval Rate</p>
              <p className="text-3xl font-bold text-purple-600">{analytics.approvalRate}%</p>
              <p className="text-xs text-gray-500 mt-2">Approved vs Total</p>
            </div>

            {/* Disapproved Leaves */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <p className="text-gray-600 text-sm font-semibold mb-2">Disapproved Leaves</p>
              <p className="text-3xl font-bold text-red-600">{analytics.disapprovedLeaves}</p>
              <p className="text-xs text-gray-500 mt-2">Denied requests</p>
            </div>

            {/* Disapproved Travel Orders */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <p className="text-gray-600 text-sm font-semibold mb-2">Disapproved Travel</p>
              <p className="text-3xl font-bold text-orange-600">{analytics.disapprovedTravelOrders}</p>
              <p className="text-xs text-gray-500 mt-2">Denied requests</p>
            </div>

            {/* Total Requests */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <p className="text-gray-600 text-sm font-semibold mb-2">Total Requests</p>
              <p className="text-3xl font-bold text-indigo-600">
                {stats.pendingLeaves + stats.approvedLeaves + analytics.disapprovedLeaves + stats.pendingTravelOrders + stats.approvedTravelOrders + analytics.disapprovedTravelOrders}
              </p>
              <p className="text-xs text-gray-500 mt-2">Leaves + Travel</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Leave Types Breakdown */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-bold text-gray-800 mb-4">Leave Types Distribution</h3>
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
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-bold text-gray-800 mb-4">Travel Mode Distribution</h3>
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
