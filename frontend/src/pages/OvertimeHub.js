import React from 'react';
import { useSearchParams } from 'react-router-dom';
import FileOvertime from './FileOvertime';

function OvertimeHub({ staffId }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') === 'my' ? 'my' : 'request';

  const setTab = (tab) => {
    const next = new URLSearchParams(searchParams);
    next.set('tab', tab);
    setSearchParams(next);
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg shadow p-4">
        <h1 className="text-2xl font-bold text-gray-800">Overtime</h1>
        <p className="text-sm text-gray-600">Submit overtime and review all your overtime requests from one page.</p>

        <div className="mt-4 flex flex-wrap gap-2 border-b border-gray-200 pb-2">
          <button
            type="button"
            onClick={() => setTab('request')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${activeTab === 'request' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
          >
            Request Overtime
          </button>
          <button
            type="button"
            onClick={() => setTab('my')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${activeTab === 'my' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
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
