import React from 'react';
import { useSearchParams } from 'react-router-dom';
import MyLeaves from './MyLeaves';
import FileLeave from './FileLeave';

function LeaveHub({ staffId }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') === 'file' ? 'file' : 'my';
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
      <div className="bg-white rounded-lg shadow p-4">
        <h1 className="text-2xl font-bold text-gray-800">Leave</h1>
        <p className="text-sm text-gray-600">Manage your leave filing and leave history in one page.</p>

        <div className="mt-4 flex flex-wrap gap-2 border-b border-gray-200 pb-2">
          <button
            type="button"
            onClick={() => setTab('my')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${activeTab === 'my' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
          >
            My Leaves
          </button>
          <button
            type="button"
            onClick={() => setTab('file')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${activeTab === 'file' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
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
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition ${status === item.key ? 'bg-blue-100 text-blue-700 border border-blue-200' : 'bg-gray-100 text-gray-700 border border-transparent hover:bg-gray-200'}`}
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
