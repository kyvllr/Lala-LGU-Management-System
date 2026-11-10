import React from 'react';
import { useSearchParams } from 'react-router-dom';
import FileOvertime from './FileOvertime';

function OvertimeHub({ staffId, initialTab = 'request' }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = searchParams.get('tab');
  const activeTab = requestedTab === 'my' || requestedTab === 'request'
    ? requestedTab
    : initialTab;

  const setTab = (tab) => {
    const next = new URLSearchParams(searchParams);
    next.set('tab', tab);
    setSearchParams(next);
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg border border-blue-100 shadow-sm p-4">
        <h1 className="text-2xl font-bold tracking-tight text-blue-950">Overtime</h1>
        <p className="text-sm text-blue-700/80">Submit overtime and review all your overtime requests from one page.</p>

        <div className="mt-4 flex flex-wrap gap-2 border-b border-blue-100 pb-2">
          <button
            type="button"
            onClick={() => setTab('request')}
            className={`px-4 py-2 rounded-md text-sm font-semibold transition ${activeTab === 'request' ? 'bg-blue-500 text-white shadow-sm' : 'bg-blue-50 text-blue-700 hover:bg-blue-100'}`}
          >
            Request Overtime
          </button>
          <button
            type="button"
            onClick={() => setTab('my')}
            className={`px-4 py-2 rounded-md text-sm font-semibold transition ${activeTab === 'my' ? 'bg-blue-500 text-white shadow-sm' : 'bg-blue-50 text-blue-700 hover:bg-blue-100'}`}
          >
            My Overtime Requests
          </button>
        </div>
      </div>

      <FileOvertime staffId={staffId} viewMode={activeTab === 'my' ? 'history' : 'request'} />
    </div>
  );
}

export default OvertimeHub;
