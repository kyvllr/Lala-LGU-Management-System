import React, { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import ApproveLeavesAdmin from './ApproveLeavesAdmin';
import ApproveLeavesHeadOfficer from './ApproveLeavesHeadOfficer';
import ApproveTravelOrdersAdmin from './ApproveTravelOrdersAdmin';
import ApproveTravelOrdersHeadOfficer from './ApproveTravelOrdersHeadOfficer';
import ApproveOvertimeAdmin from './ApproveOvertimeAdmin';
import ApproveOvertimeHeadRequisitioning from './ApproveOvertimeHeadRequisitioning';
import ApproveOvertimeBudgetOfficer from './ApproveOvertimeBudgetOfficer';
import ApprovePendingStaff from './ApprovePendingStaff';
import { isAdmin, normalizeRole, ROLES } from '../constants';

function ApprovalRequestsHub({ userRole }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const normalizedRole = normalizeRole(userRole);
  const statusParam = searchParams.get('status');
  const activeStatus = statusParam === null ? 'Pending' : statusParam;

  const statusTabs = [
    { key: '', label: 'All' },
    { key: 'Pending', label: 'Pending' },
    { key: 'Approved', label: 'Approved' },
    { key: 'Disapproved', label: 'Disapproved' },
  ];

  const tabs = useMemo(() => {
    if (isAdmin(normalizedRole)) {
      return [
        {
          key: 'accounts',
          label: 'Account Requests',
          render: () => <ApprovePendingStaff />,
        },
        {
          key: 'leave',
          label: 'Leave Requests',
          render: (status) => <ApproveLeavesAdmin forcedStatus={status} />,
        },
        {
          key: 'travel',
          label: 'Travel Requests',
          render: (status) => <ApproveTravelOrdersAdmin forcedStatus={status} />,
        },
        {
          key: 'overtime',
          label: 'Overtime Requests',
          render: (status) => <ApproveOvertimeAdmin forcedStatus={status} />,
        },
      ];
    }

    if (normalizedRole === ROLES.HEAD_OFFICER) {
      return [
        {
          key: 'accounts',
          label: 'Account Requests',
          render: () => <ApprovePendingStaff />,
        },
        {
          key: 'leave',
          label: 'Leave Requests',
          render: (status) => <ApproveLeavesHeadOfficer forcedStatus={status} />,
        },
        {
          key: 'travel',
          label: 'Travel Requests',
          render: (status) => <ApproveTravelOrdersHeadOfficer forcedStatus={status} />,
        },
        {
          key: 'overtime',
          label: 'Overtime Requests',
          render: (status) => <ApproveOvertimeHeadRequisitioning forcedStatus={status} />,
        },
      ];
    }

    if (normalizedRole === ROLES.MUNICIPAL_BUDGET_OFFICER) {
      return [
        {
          key: 'overtime',
          label: 'Overtime Requests',
          render: (status) => <ApproveOvertimeBudgetOfficer forcedStatus={status} />,
        },
      ];
    }

    return [];
  }, [normalizedRole]);

  if (tabs.length === 0) {
    return (
      <div className="max-w-2xl mx-auto mt-12 bg-white rounded-lg shadow p-8 text-center">
        <h1 className="text-2xl font-bold text-gray-800 mb-2">Unauthorized</h1>
        <p className="text-gray-600">You do not have permission to access this page.</p>
      </div>
    );
  }

  const requestedTab = searchParams.get('tab');
  const activeTab = tabs.some((tab) => tab.key === requestedTab) ? requestedTab : tabs[0].key;
  const activeContent = tabs.find((tab) => tab.key === activeTab)?.render(activeStatus);

  const setTab = (tabKey) => {
    const next = new URLSearchParams(searchParams);
    next.set('tab', tabKey);
    if (tabKey === 'accounts') {
      next.delete('status');
    } else if (!next.has('status')) {
      next.set('status', 'Pending');
    }
    setSearchParams(next);
  };

  const setStatus = (statusKey) => {
    const next = new URLSearchParams(searchParams);
    next.set('status', statusKey);
    setSearchParams(next);
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg shadow p-4">
        <h1 className="text-2xl font-bold text-gray-800">Approve Requests</h1>
        <p className="text-sm text-gray-600">Review and approve employee requests by category.</p>

        <div className="mt-4 flex flex-wrap gap-2 border-b border-gray-200 pb-2">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setTab(tab.key)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${activeTab === tab.key ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab !== 'accounts' && (
          <div className="mt-3 flex flex-wrap gap-2">
            {statusTabs.map((statusTab) => (
              <button
                key={statusTab.label}
                type="button"
                onClick={() => setStatus(statusTab.key)}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition ${activeStatus === statusTab.key ? 'bg-blue-100 text-blue-700 border border-blue-200' : 'bg-gray-100 text-gray-700 border border-transparent hover:bg-gray-200'}`}
              >
                {statusTab.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {activeContent}
    </div>
  );
}

export default ApprovalRequestsHub;
