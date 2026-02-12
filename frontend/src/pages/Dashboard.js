import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MdGroup, MdApproval, MdFlightTakeoff } from 'react-icons/md';
import { TbClockHour2, TbClipboardList, TbCheck, TbX } from 'react-icons/tb';
import { PieChart, Pie, Cell, Legend, Tooltip, ResponsiveContainer } from 'recharts';
import { leaveAPI, travelOrderAPI, staffAPI, leaveRecordAPI } from '../api';
import { isAdmin } from '../constants';

function Dashboard({ userRole, staffId }) {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalStaff: 0,
    pendingLeaves: 0,
    approvedLeaves: 0,
    pendingTravelOrders: 0,
    approvedTravelOrders: 0,
  });
  const [analytics, setAnalytics] = useState({
    rejectedLeaves: 0,
    rejectedTravelOrders: 0,
    leavesByType: {},
    travelByMode: {},
    approvalRate: 0,
  });
  const [leaveRecords, setLeaveRecords] = useState([]);
  const [leaveBalance, setLeaveBalance] = useState({
    vacationLeaveBalance: 0,
    sickLeaveBalance: 0,
    vacationLeaveEarned: 0,
    sickLeaveEarned: 0,
  });
  const [loading, setLoading] = useState(true);
  const [currentStaffId, setCurrentStaffId] = useState(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        // Get current user's staffId from localStorage if not provided as prop
        let tempStaffId = staffId;
        if (!tempStaffId) {
          const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
          tempStaffId = storedUser.staffId || storedUser.id;
        }
        setCurrentStaffId(tempStaffId);

        if (isAdmin(userRole)) {
          const staffRes = await staffAPI.getAll();
          const leavesRes = await leaveAPI.getAll();
          const travelRes = await travelOrderAPI.getAll();

          const pendingLeaves = leavesRes.data.filter(l => l.status === 'Pending').length;
          const approvedLeaves = leavesRes.data.filter(l => l.status === 'Approved').length;
          const rejectedLeaves = leavesRes.data.filter(l => l.status === 'Rejected').length;
          const pendingTravel = travelRes.data.filter(t => t.status === 'Pending').length;
          const approvedTravel = travelRes.data.filter(t => t.status === 'Approved').length;
          const rejectedTravel = travelRes.data.filter(t => t.status === 'Rejected').length;

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

          const totalLeaves = leavesRes.data.length;
          const totalApprovedLeaves = approvedLeaves + rejectedLeaves + pendingLeaves;
          const leaveApprovalRate = totalApprovedLeaves > 0 ? Math.round((approvedLeaves / totalApprovedLeaves) * 100) : 0;

          setAnalytics({
            rejectedLeaves,
            rejectedTravelOrders: rejectedTravel,
            leavesByType,
            travelByMode,
            approvalRate: leaveApprovalRate,
          });
        }

        // Fetch leave records from API for both admin and staff when staffId is available
        if (tempStaffId) {
          if (userRole === 'staff') {
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

            // Calculate leave balance
            let vlEarned = 0;
            let vlAbsent = 0;
            let slEarned = 0;
            let slAbsent = 0;

            records.forEach(record => {
              vlEarned += parseFloat(record.vlEarned) || 0;
              vlAbsent += parseFloat(record.vlAbsentUndertimeWPay) || 0;
              slEarned += parseFloat(record.slEarned) || 0;
              slAbsent += parseFloat(record.slAbsentUndertimeWPay) || 0;
            });

            console.log('[Dashboard] Leave balance calculated:', {
              vacationLeaveBalance: vlEarned - vlAbsent,
              sickLeaveBalance: slEarned - slAbsent,
              vacationLeaveEarned: vlEarned,
              sickLeaveEarned: slEarned,
            });

            setLeaveBalance({
              vacationLeaveBalance: vlEarned - vlAbsent,
              sickLeaveBalance: slEarned - slAbsent,
              vacationLeaveEarned: vlEarned,
              sickLeaveEarned: slEarned,
            });
          } catch (apiErr) {
            console.error('[Dashboard] Error fetching leave records from API:', apiErr);
            // No fallback - MongoDB is required
            setLeaveRecords([]);
            setLeaveBalance({
              vacationLeaveBalance: 0,
              sickLeaveBalance: 0,
              vacationLeaveEarned: 0,
              sickLeaveEarned: 0,
            });
          }
        }
      } catch (error) {
        console.error('Error fetching stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [userRole, staffId]);

  if (loading) return <div className="text-center p-8">Loading...</div>;

  const handleCardClick = (path, status = null) => {
    if (status) {
      navigate(`${path}?status=${status}`);
    } else {
      navigate(path);
    }
  };

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-800 mb-8">Dashboard</h1>

      {/* Leave Balance Summary Metrics Table - Only this section */}
      {currentStaffId && (
        <div className="mt-12">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">Leave Balance Summary</h2>
          
          <div className="bg-white rounded-lg shadow-md overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gray-200 border">
                  <th className="px-6 py-3 border text-left font-bold">Metric</th>
                  <th className="px-6 py-3 border text-center font-bold">Vacation Leave</th>
                  <th className="px-6 py-3 border text-center font-bold">Sick Leave</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border">
                  <td className="px-6 py-3 border font-bold">Total Earned</td>
                  <td className="px-6 py-3 border text-center">{leaveBalance.vacationLeaveEarned === 0 ? '-' : leaveBalance.vacationLeaveEarned.toFixed(2)}</td>
                  <td className="px-6 py-3 border text-center">{leaveBalance.sickLeaveEarned === 0 ? '-' : leaveBalance.sickLeaveEarned.toFixed(2)}</td>
                </tr>
                <tr className="border bg-blue-50">
                  <td className="px-6 py-3 border font-bold">Balance</td>
                  <td className="px-6 py-3 border text-center font-bold">{leaveBalance.vacationLeaveBalance === 0 ? '-' : leaveBalance.vacationLeaveBalance.toFixed(2)}</td>
                  <td className="px-6 py-3 border text-center font-bold">{leaveBalance.sickLeaveBalance === 0 ? '-' : leaveBalance.sickLeaveBalance.toFixed(2)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      <br></br>
      <br></br>
      
      {/* Stats Grid */}
      <h2 className="text-2xl font-bold text-gray-800 mb-6">Status Overview</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Total Staff - Admin Only */}
        {isAdmin(userRole) && (
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
          onClick={() => handleCardClick(isAdmin(userRole) ? '/approve-leaves' : '/my-leaves', isAdmin(userRole) ? null : 'Pending')}
          className="bg-white rounded-lg shadow-md p-6 hover:shadow-xl hover:scale-105 transition transform cursor-pointer border-l-4 border-yellow-500"
        >
          <div className="flex items-center justify-between">
            <div className="text-left">
              <p className="text-gray-600 text-sm font-semibold mb-2">Pending Leaves</p>
              <p className="text-4xl font-bold text-yellow-500">{stats.pendingLeaves}</p>
            </div>
            <div className="text-4xl opacity-20 text-yellow-500"><TbClockHour2 size={60} /></div>
          </div>
        </button>
        
        {/* Approved Leaves */}
        <button
          onClick={() => handleCardClick(isAdmin(userRole) ? '/approve-leaves' : '/my-leaves', isAdmin(userRole) ? null : 'Approved')}
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
        
        {/* Pending Travel Orders */}
        <button
          onClick={() => handleCardClick(isAdmin(userRole) ? '/approve-travel-orders' : '/my-travel-orders', isAdmin(userRole) ? null : 'Pending')}
          className="bg-white rounded-lg shadow-md p-6 hover:shadow-xl hover:scale-105 transition transform cursor-pointer border-l-4 border-orange-500"
        >
          <div className="flex items-center justify-between">
            <div className="text-left">
              <p className="text-gray-600 text-sm font-semibold mb-2">Pending Travel Orders</p>
              <p className="text-4xl font-bold text-orange-500">{stats.pendingTravelOrders}</p>
            </div>
            <div className="text-4xl opacity-20 text-orange-500"><TbClipboardList size={60} /></div>
          </div>
        </button>
        
        {/* Approved Travel Orders */}
        <button
          onClick={() => handleCardClick(isAdmin(userRole) ? '/approve-travel-orders' : '/my-travel-orders', isAdmin(userRole) ? null : 'Approved')}
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
      </div>

      {/* Analytics Section - Admin Only */}
      {isAdmin(userRole) && (
        <div className="mt-8">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">Analytics & Insights</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
            {/* Approval Rate */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <p className="text-gray-600 text-sm font-semibold mb-2">Leave Approval Rate</p>
              <p className="text-3xl font-bold text-purple-600">{analytics.approvalRate}%</p>
              <p className="text-xs text-gray-500 mt-2">Approved vs Total</p>
            </div>

            {/* Rejected Leaves */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <p className="text-gray-600 text-sm font-semibold mb-2">Rejected Leaves</p>
              <p className="text-3xl font-bold text-red-600">{analytics.rejectedLeaves}</p>
              <p className="text-xs text-gray-500 mt-2">Denied requests</p>
            </div>

            {/* Rejected Travel Orders */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <p className="text-gray-600 text-sm font-semibold mb-2">Rejected Travel</p>
              <p className="text-3xl font-bold text-orange-600">{analytics.rejectedTravelOrders}</p>
              <p className="text-xs text-gray-500 mt-2">Denied requests</p>
            </div>

            {/* Total Requests */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <p className="text-gray-600 text-sm font-semibold mb-2">Total Requests</p>
              <p className="text-3xl font-bold text-indigo-600">
                {stats.pendingLeaves + stats.approvedLeaves + analytics.rejectedLeaves + stats.pendingTravelOrders + stats.approvedTravelOrders + analytics.rejectedTravelOrders}
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
