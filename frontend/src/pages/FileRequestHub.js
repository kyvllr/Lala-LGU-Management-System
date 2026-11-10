import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import LeaveHub from './LeaveHub';
import TravelOrderHub from './TravelOrderHub';
import OvertimeHub from './OvertimeHub';

const REQUEST_TABS = [
  { key: 'leave', label: 'Leave' },
  { key: 'travel-order', label: 'Travel Order' },
  { key: 'overtime', label: 'Overtime' },
];

function FileRequestHub({ staffId }) {
  const [activeTab, setActiveTab] = useState('leave');
  const [searchParams, setSearchParams] = useSearchParams();

  const selectRequestType = (tab) => {
    setActiveTab(tab);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('tab');
    nextParams.delete('status');
    setSearchParams(nextParams);
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-blue-100 bg-white p-4 shadow-sm">
        <h1 className="text-2xl font-bold tracking-tight text-blue-950">File a Request</h1>
        <p className="text-sm text-blue-700/80">Choose which request form you want to complete.</p>
        <nav className="mt-4 flex flex-wrap gap-2 border-b border-blue-100 pb-2" aria-label="Request form tabs">
          {REQUEST_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => selectRequestType(tab.key)}
              aria-current={activeTab === tab.key ? 'page' : undefined}
              className={`rounded-md px-4 py-2 text-sm font-semibold transition ${
                activeTab === tab.key
                  ? 'bg-blue-600 text-white shadow'
                  : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {activeTab === 'leave' && <LeaveHub staffId={staffId} initialTab="file" />}
      {activeTab === 'travel-order' && <TravelOrderHub staffId={staffId} initialTab="request" />}
      {activeTab === 'overtime' && <OvertimeHub staffId={staffId} initialTab="request" />}
    </div>
  );
}

export default FileRequestHub;
