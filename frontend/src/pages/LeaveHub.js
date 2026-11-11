import React from 'react';
import { useSearchParams } from 'react-router-dom';
import MyLeaves from './MyLeaves';
import FileLeave from './FileLeave';

function LeaveHub({ staffId, initialTab = 'my' }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = searchParams.get('tab');
  const activeTab = requestedTab === 'file' || requestedTab === 'my'
    ? requestedTab
    : initialTab;
  const status = searchParams.get('status') || '';

  const statusTabs = [
    { key: '', label: 'All' },
    { key: 'Pending', label: 'Pending' },
    { key: 'Approved', label: 'Approved' },
    { key: 'Disapproved', label: 'Disapproved' },
  ];

  const setTab = (tab) => {
    const next = new URLSearchParams(searchParams);
    next.set('tab', tab);
    if (tab !== 'my') {
      next.delete('status');
    }
    setSearchParams(next);
  };

  const setStatus = (nextStatus) => {
    const next = new URLSearchParams(searchParams);
    next.set('tab', 'my');
    if (!nextStatus) {
      next.delete('status');
    } else {
      next.set('status', nextStatus);
    }
    setSearchParams(next);
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg border border-blue-100 shadow-sm p-4">
        <h1 className="text-2xl font-bold tracking-tight text-blue-950">Leave</h1>
        <p className="text-sm text-blue-700/80">Manage your leave filing and leave history in one page.</p>

        <div className="mt-4 flex flex-wrap gap-2 border-b border-blue-100 pb-2">
          <button
            type="button"
            onClick={() => setTab('my')}
            className={`min-h-[44px] sm:min-h-0 px-4 py-2 rounded-md text-sm font-semibold transition ${activeTab === 'my' ? 'bg-blue-500 text-white shadow-sm' : 'bg-blue-50 text-blue-700 hover:bg-blue-100'}`}
          >
            My Leaves
          </button>
          <button
            type="button"
            onClick={() => setTab('file')}
            className={`min-h-[44px] sm:min-h-0 px-4 py-2 rounded-md text-sm font-semibold transition ${activeTab === 'file' ? 'bg-blue-500 text-white shadow-sm' : 'bg-blue-50 text-blue-700 hover:bg-blue-100'}`}
          >
            File Leave
          </button>
        </div>

        {activeTab === 'my' && (
          <div className="mt-3 flex flex-wrap gap-2">
            {statusTabs.map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={() => setStatus(item.key)}
                className={`min-h-[44px] sm:min-h-0 px-3 py-1.5 rounded-md text-xs font-semibold transition ${status === item.key ? 'bg-blue-500 text-white border border-blue-500' : 'bg-blue-50 text-blue-700 border border-blue-100 hover:bg-blue-100'}`}
              >
                {item.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {activeTab === 'my' ? <MyLeaves staffId={staffId} /> : <FileLeave staffId={staffId} />}
    </div>
  );
}

export default LeaveHub;
