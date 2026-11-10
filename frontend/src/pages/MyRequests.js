import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TbRefresh, TbSearch, TbClipboardList, TbFilePlus } from 'react-icons/tb';
import { requestTrackerAPI } from '../api';

const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
};

const getStatusClass = (status) => {
  switch (String(status || '').toLowerCase()) {
    case 'approved':
    case 'completed':
      return 'bg-emerald-100 text-emerald-800';
    case 'disapproved':
    case 'rejected':
      return 'bg-red-100 text-red-800';
    case 'for revision':
      return 'bg-amber-100 text-amber-800';
    default:
      return 'bg-blue-100 text-blue-800';
  }
};

const formatStage = (stage, status) => {
  const normalizedStatus = String(status || '').toLowerCase();
  if (['approved', 'disapproved', 'rejected', 'completed'].includes(normalizedStatus)) {
    return normalizedStatus === 'completed' ? 'Completed' : 'Decision recorded';
  }

  const normalized = String(stage || '').toLowerCase().replace(/[_-]/g, ' ');
  if (normalized.includes('head')) return 'Department Head review';
  if (normalized.includes('budget')) return 'Budget Office review';
  if (normalized.includes('admin')) return 'Admin/HR review';
  if (normalized.includes('complete')) return 'Completed';
  return stage ? String(stage) : 'In review';
};

function MyRequests() {
  const navigate = useNavigate();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [typeFilter, setTypeFilter] = useState('All');
  const [search, setSearch] = useState('');

  const loadRequests = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true);
    setErrorMessage('');
    try {
      const response = await requestTrackerAPI.getMy();
      setRequests(Array.isArray(response.data?.requests) ? response.data.requests : []);
    } catch (error) {
      console.error('Unable to load request tracker:', error);
      setErrorMessage(error?.response?.data?.message || 'Failed to load your requests. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRequests(true);
    const refreshInterval = window.setInterval(() => loadRequests(), 30000);
    const refreshOnFocus = () => loadRequests();
    window.addEventListener('focus', refreshOnFocus);
    return () => {
      window.clearInterval(refreshInterval);
      window.removeEventListener('focus', refreshOnFocus);
    };
  }, [loadRequests]);

  const requestTypes = useMemo(
    () => Array.from(new Set(requests.map((request) => request.type).filter(Boolean))).sort(),
    [requests]
  );

  const counts = useMemo(() => ({
    total: requests.length,
    pending: requests.filter((request) => ['pending', 'under review'].includes(String(request.status).toLowerCase())).length,
    approved: requests.filter((request) => ['approved', 'completed'].includes(String(request.status).toLowerCase())).length,
    needsAction: requests.filter((request) => ['for revision', 'disapproved', 'rejected'].includes(String(request.status).toLowerCase())).length,
  }), [requests]);

  const filteredRequests = useMemo(() => {
    const query = search.trim().toLowerCase();
    return requests.filter((request) => {
      const matchesStatus = statusFilter === 'All' || String(request.status).toLowerCase() === statusFilter.toLowerCase();
      const matchesType = typeFilter === 'All' || request.type === typeFilter;
      const matchesSearch = !query || [
        request.type,
        request.title,
        request.summary,
        request.id,
        request.status,
        request.stage,
      ].some((value) => String(value || '').toLowerCase().includes(query));
      return matchesStatus && matchesType && matchesSearch;
    });
  }, [requests, search, statusFilter, typeFilter]);

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-blue-100 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-blue-950">My Requests</h1>
            <p className="mt-1 text-sm text-slate-600">
              Track your leave, travel, overtime, certificate, profile update, and PDS submissions in one place.
            </p>
          </div>
          <button
            type="button"
            onClick={() => loadRequests(true)}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-md border border-blue-200 px-3 py-2 text-sm font-medium text-blue-700 transition hover:bg-blue-50 disabled:opacity-50"
          >
            <TbRefresh size={17} />
            Refresh
          </button>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            ['Total requests', counts.total, 'text-blue-950'],
            ['Pending review', counts.pending, 'text-blue-700'],
            ['Approved', counts.approved, 'text-emerald-700'],
            ['Needs attention', counts.needsAction, 'text-amber-700'],
          ].map(([label, count, color]) => (
            <div key={label} className="rounded-lg border border-blue-100 bg-blue-50/60 p-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
              <p className={`mt-1 text-2xl font-bold ${color}`}>{count}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-blue-100 bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_12rem_12rem]">
          <label className="relative block">
            <TbSearch size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search request, reference, or details"
              className="w-full rounded-md border border-slate-200 py-2 pl-10 pr-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
            />
          </label>
          <select
            value={typeFilter}
            onChange={(event) => setTypeFilter(event.target.value)}
            className="rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
            aria-label="Filter by request type"
          >
            <option value="All">All request types</option>
            {requestTypes.map((type) => <option key={type} value={type}>{type}</option>)}
          </select>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
            aria-label="Filter by status"
          >
            <option value="All">All statuses</option>
            <option value="Pending">Pending</option>
            <option value="Under Review">Under Review</option>
            <option value="For Revision">For Revision</option>
            <option value="Approved">Approved</option>
            <option value="Completed">Completed</option>
            <option value="Disapproved">Disapproved</option>
          </select>
        </div>
      </section>

      {errorMessage && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessage}
        </div>
      )}

      <section className="overflow-hidden rounded-xl border border-blue-100 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-blue-100 px-4 py-3">
          <h2 className="font-semibold text-blue-950">Request history</h2>
          <span className="text-sm text-slate-500">{filteredRequests.length} request(s)</span>
        </div>

        {loading ? (
          <div className="p-10 text-center text-slate-600">Loading your requests...</div>
        ) : filteredRequests.length === 0 ? (
          <div className="p-10 text-center">
            <TbClipboardList size={34} className="mx-auto text-blue-300" />
            <p className="mt-2 font-semibold text-slate-700">
              {requests.length ? 'No requests match these filters.' : 'No requests to track yet.'}
            </p>
            {!requests.length && (
              <button
                type="button"
                onClick={() => navigate('/file-requests')}
                className="mt-4 inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
              >
                <TbFilePlus size={17} />
                File a request
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-blue-50 text-xs uppercase tracking-wide text-slate-600">
                <tr>
                  <th className="px-4 py-3">Request</th>
                  <th className="px-4 py-3">Submitted</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Current step</th>
                  <th className="px-4 py-3">Latest update</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRequests.map((request) => (
                  <tr key={`${request.type}-${request.id}`} className="align-top hover:bg-blue-50/40">
                    <td className="max-w-md px-4 py-4">
                      <p className="font-semibold text-slate-800">{request.title}</p>
                      <p className="mt-0.5 text-xs font-medium text-blue-700">{request.type}</p>
                      {request.summary && <p className="mt-1 text-xs text-slate-500">{request.summary}</p>}
                      <p className="mt-1 text-xs text-slate-400">Ref: {request.id}</p>
                      {request.remarks && (
                        <p className="mt-2 rounded-md bg-amber-50 px-2.5 py-2 text-xs text-amber-900">
                          Review note: {request.remarks}
                        </p>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-slate-600">{formatDate(request.submittedAt)}</td>
                    <td className="px-4 py-4">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${getStatusClass(request.status)}`}>
                        {request.status}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-slate-600">{formatStage(request.stage, request.status)}</td>
                    <td className="whitespace-nowrap px-4 py-4 text-slate-600">{formatDate(request.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

export default MyRequests;
