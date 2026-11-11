import React, { useEffect, useMemo, useState } from 'react';
import { FiRefreshCw, FiSearch, FiFilter } from 'react-icons/fi';
import { systemLogAPI } from '../api';

const MODULE_OPTIONS = [
  { label: 'All Modules', value: 'all' },
  { label: 'Authentication', value: 'Authentication' },
  { label: 'Staff', value: 'Staff' },
  { label: 'Leave', value: 'Leave' },
  { label: 'Travel Order', value: 'Travel Order' },
  { label: 'Overtime', value: 'Overtime' },
  { label: 'PDS', value: 'PDS' },
  { label: 'System', value: 'System' },
];

const ACTION_OPTIONS = [
  { label: 'All Actions', value: 'all' },
  { label: 'Create', value: 'Create' },
  { label: 'Update', value: 'Update' },
  { label: 'Approve', value: 'Approve' },
  { label: 'Disapprove', value: 'Disapprove' },
  { label: 'Delete', value: 'Delete' },
  { label: 'Login', value: 'Login' },
  { label: 'Logout', value: 'Logout' },
];

const STATUS_OPTIONS = [
  { label: 'All Statuses', value: 'all' },
  { label: 'Info', value: 'Info' },
  { label: 'Success', value: 'Success' },
  { label: 'Warning', value: 'Warning' },
  { label: 'Error', value: 'Error' },
];

const DATE_RANGE_OPTIONS = [
  { label: 'All Time', value: 'all' },
  { label: 'Today', value: 'today' },
  { label: 'Last 7 Days', value: 'week' },
  { label: 'Last 30 Days', value: 'month' },
];

const STATUS_CLASSES = {
  Success: 'bg-green-100 text-green-700 border border-green-200',
  Warning: 'bg-yellow-100 text-yellow-700 border border-yellow-200',
  Error: 'bg-red-100 text-red-700 border border-red-200',
  Info: 'bg-blue-100 text-blue-700 border border-blue-200',
};

function formatTimestamp(value) {
  if (!value) {
    return '-';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString();
}

function SystemLogs() {
  const PAGE_SIZE = 20;
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [moduleFilter, setModuleFilter] = useState('all');
  const [actionFilter, setActionFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateRange, setDateRange] = useState('all');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, limit: PAGE_SIZE, total: 0, totalPages: 0 });
  const [selectedLog, setSelectedLog] = useState(null);
  const [copyState, setCopyState] = useState('idle');
  const [jumpPageInput, setJumpPageInput] = useState('1');

  const queryParams = useMemo(
    () => ({
      search,
      module: moduleFilter,
      action: actionFilter,
      status: statusFilter,
      dateRange,
      page,
      limit: PAGE_SIZE,
    }),
    [search, moduleFilter, actionFilter, statusFilter, dateRange, page]
  );

  const fetchLogs = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await systemLogAPI.getAll(queryParams);
      setLogs(Array.isArray(response.data?.data) ? response.data.data : []);
      setPagination(
        response.data?.pagination || {
          page,
          limit: PAGE_SIZE,
          total: 0,
          totalPages: 0,
        }
      );
    } catch (fetchError) {
      console.error('Failed to load system logs:', fetchError);
      setError(fetchError.response?.data?.message || 'Unable to load system logs right now.');
      setLogs([]);
      setPagination({ page: 1, limit: PAGE_SIZE, total: 0, totalPages: 0 });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryParams]);

  useEffect(() => {
    setPage(1);
  }, [search, moduleFilter, actionFilter, statusFilter, dateRange]);

  useEffect(() => {
    setJumpPageInput(String(page));
  }, [page]);

  const clearFilters = () => {
    setSearch('');
    setModuleFilter('all');
    setActionFilter('all');
    setStatusFilter('all');
    setDateRange('all');
    setPage(1);
  };

  const canGoPrevious = page > 1;
  const canGoNext = pagination.totalPages > page;
  const hasPages = pagination.totalPages > 0;

  const selectedMetadata = selectedLog?.metadata && Object.keys(selectedLog.metadata).length > 0
    ? JSON.stringify(selectedLog.metadata, null, 2)
    : 'No metadata available.';

  const copyMetadata = async () => {
    if (!selectedLog) {
      return;
    }

    try {
      await navigator.clipboard.writeText(selectedMetadata);
      setCopyState('success');
    } catch (copyError) {
      console.error('Failed to copy metadata:', copyError);
      setCopyState('error');
    }
  };

  const goToPage = () => {
    const parsed = Number.parseInt(jumpPageInput, 10);
    if (Number.isNaN(parsed) || !hasPages) {
      return;
    }

    const boundedTarget = Math.max(1, Math.min(parsed, pagination.totalPages));
    setPage(boundedTarget);
  };

  useEffect(() => {
    const handleEscapeKey = (event) => {
      if (event.key === 'Escape') {
        setSelectedLog(null);
      }
    };

    document.addEventListener('keydown', handleEscapeKey);
    return () => {
      document.removeEventListener('keydown', handleEscapeKey);
    };
  }, []);

  return (
    <div className="min-h-full bg-slate-100 rounded-xl p-6 md:p-8 border border-blue-100/60">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between mb-8">
        <div>
          <h1 className="text-4xl font-extrabold text-blue-800 tracking-tight">System Logs &amp; Audit Trail</h1>
          <p className="inline-flex items-center mt-3 px-3 py-1 rounded-md bg-blue-600 text-white text-xs font-semibold">
            Real-time Activity Monitoring
          </p>
        </div>

        <button
          type="button"
          onClick={fetchLogs}
          className="self-start inline-flex items-center gap-2 text-blue-700 hover:text-blue-800 font-semibold text-sm"
        >
          <FiRefreshCw size={16} />
          Refresh
        </button>
      </div>

      <div className="bg-white border border-blue-100 rounded-xl p-4 md:p-5 shadow-sm mb-5">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 md:gap-4">
          <div className="md:col-span-3">
            <label htmlFor="log-search" className="block text-blue-700 font-bold mb-2">Search Logs</label>
            <div className="relative">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                id="log-search"
                type="text"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search logs, users, IP..."
                className="w-full pl-10 pr-3 py-2.5 border border-blue-200 rounded-md focus:ring-2 focus:ring-blue-200 focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="md:col-span-2">
            <label htmlFor="log-module-filter" className="block text-blue-700 font-bold mb-2">Module</label>
            <select
              id="log-module-filter"
              value={moduleFilter}
              onChange={(event) => setModuleFilter(event.target.value)}
              className="w-full px-3 py-2.5 border border-blue-200 rounded-md focus:ring-2 focus:ring-blue-200 focus:border-blue-500 focus:outline-none"
            >
              {MODULE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2">
            <label htmlFor="log-action-filter" className="block text-blue-700 font-bold mb-2">Action</label>
            <select
              id="log-action-filter"
              value={actionFilter}
              onChange={(event) => setActionFilter(event.target.value)}
              className="w-full px-3 py-2.5 border border-blue-200 rounded-md focus:ring-2 focus:ring-blue-200 focus:border-blue-500 focus:outline-none"
            >
              {ACTION_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2">
            <label htmlFor="log-status-filter" className="block text-blue-700 font-bold mb-2">Status</label>
            <select
              id="log-status-filter"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="w-full px-3 py-2.5 border border-blue-200 rounded-md focus:ring-2 focus:ring-blue-200 focus:border-blue-500 focus:outline-none"
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2">
            <label htmlFor="log-date-range-filter" className="block text-blue-700 font-bold mb-2">Date Range</label>
            <select
              id="log-date-range-filter"
              value={dateRange}
              onChange={(event) => setDateRange(event.target.value)}
              className="w-full px-3 py-2.5 border border-blue-200 rounded-md focus:ring-2 focus:ring-blue-200 focus:border-blue-500 focus:outline-none"
            >
              {DATE_RANGE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-1 md:flex md:items-end">
            <button
              type="button"
              onClick={clearFilters}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-md bg-indigo-500 text-white hover:bg-indigo-600 transition text-sm font-semibold"
            >
              <FiFilter size={16} />
              Clear
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-blue-100 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px]">
            <thead>
              <tr className="bg-blue-500 text-white">
                <th scope="col" className="text-left px-4 py-3 text-sm font-semibold">Timestamp</th>
                <th scope="col" className="text-left px-4 py-3 text-sm font-semibold">Module</th>
                <th scope="col" className="text-left px-4 py-3 text-sm font-semibold">Action</th>
                <th scope="col" className="text-left px-4 py-3 text-sm font-semibold">User</th>
                <th scope="col" className="text-left px-4 py-3 text-sm font-semibold">Description</th>
                <th scope="col" className="text-left px-4 py-3 text-sm font-semibold">IP Address</th>
                <th scope="col" className="text-left px-4 py-3 text-sm font-semibold">Status</th>
                <th scope="col" className="text-left px-4 py-3 text-sm font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-gray-500">
                    Loading system logs...
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-red-600">
                    {error}
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-gray-500">
                    No system logs found.
                  </td>
                </tr>
              ) : (
                logs.map((log, index) => (
                  <tr key={log.id || `${log.timestamp}-${index}`} className="border-t border-gray-100 hover:bg-slate-50">
                    <td className="px-4 py-2.5 text-sm text-gray-700 whitespace-nowrap">{formatTimestamp(log.timestamp)}</td>
                    <td className="px-4 py-2.5 text-sm font-medium text-gray-900">{log.module || '-'}</td>
                    <td className="px-4 py-2.5 text-sm text-gray-700">{log.action || '-'}</td>
                    <td className="px-4 py-2.5 text-sm text-gray-700">{log.user || '-'}</td>
                    <td className="px-4 py-2.5 text-sm text-gray-700 max-w-xs sm:max-w-md break-words">{log.description || '-'}</td>
                    <td className="px-4 py-2.5 text-sm text-gray-700 whitespace-nowrap">{log.ipAddress || '-'}</td>
                    <td className="px-4 py-2.5 text-sm">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${STATUS_CLASSES[log.status] || 'bg-slate-100 text-slate-700 border border-slate-200'}`}>
                        {log.status || 'Info'}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-sm">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedLog(log);
                          setCopyState('idle');
                        }}
                        className="text-blue-600 hover:text-blue-800 font-semibold"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="border-t border-blue-100 px-4 py-3 md:px-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between bg-blue-50/40">
          <p className="text-sm text-gray-600">
            Showing page {pagination.page || page} of {pagination.totalPages || 1} • {pagination.total || 0} total logs
          </p>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => canGoPrevious && setPage((prev) => prev - 1)}
              disabled={!canGoPrevious || loading}
              className="px-3 py-1.5 rounded-md border border-blue-200 text-sm font-semibold text-blue-700 hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => canGoNext && setPage((prev) => prev + 1)}
              disabled={!canGoNext || loading}
              className="px-3 py-1.5 rounded-md border border-blue-200 text-sm font-semibold text-blue-700 hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>

            <div className="flex items-center gap-2 ml-0 md:ml-2">
              <label htmlFor="jump-page" className="text-sm text-gray-600">Page</label>
              <input
                id="jump-page"
                type="number"
                min={1}
                max={pagination.totalPages || 1}
                value={jumpPageInput}
                onChange={(event) => setJumpPageInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    goToPage();
                  }
                }}
                className="w-20 px-2 py-1.5 border border-blue-200 rounded-md text-sm focus:ring-2 focus:ring-blue-200 focus:border-blue-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={goToPage}
                disabled={loading || !hasPages}
                className="px-3 py-1.5 rounded-md bg-blue-500 text-white text-sm font-semibold hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Go
              </button>
            </div>
          </div>
        </div>
      </div>

      {selectedLog && (
        <div
          className="fixed inset-0 z-50 bg-black/45 backdrop-blur-[1px] flex items-center justify-center p-4"
          onClick={() => {
            setSelectedLog(null);
            setCopyState('idle');
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="system-log-details-title"
            className="bg-white w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-xl border border-blue-100 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="px-4 sm:px-6 py-4 border-b border-blue-100 flex items-center justify-between gap-3">
              <h3 id="system-log-details-title" className="text-xl font-bold text-blue-950">Log Details</h3>
              <button
                type="button"
                onClick={() => {
                  setSelectedLog(null);
                  setCopyState('idle');
                }}
                className="p-2.5 sm:p-0 text-gray-500 hover:text-gray-700 text-xl leading-none"
                aria-label="Close log details"
              >
                ×
              </button>
            </div>

            <div className="p-4 sm:p-6 space-y-4 max-h-[75vh] overflow-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs uppercase text-gray-500 tracking-wide">Timestamp</p>
                  <p className="text-sm text-gray-800 mt-1">{formatTimestamp(selectedLog.timestamp)}</p>
                </div>
                <div>
                  <p className="text-xs uppercase text-gray-500 tracking-wide">Status</p>
                  <span className={`inline-flex mt-1 items-center px-2.5 py-1 rounded-full text-xs font-semibold ${STATUS_CLASSES[selectedLog.status] || 'bg-slate-100 text-slate-700 border border-slate-200'}`}>
                    {selectedLog.status || 'Info'}
                  </span>
                </div>
                <div>
                  <p className="text-xs uppercase text-gray-500 tracking-wide">Module</p>
                  <p className="text-sm text-gray-800 mt-1">{selectedLog.module || '-'}</p>
                </div>
                <div>
                  <p className="text-xs uppercase text-gray-500 tracking-wide">Action</p>
                  <p className="text-sm text-gray-800 mt-1">{selectedLog.action || '-'}</p>
                </div>
                <div>
                  <p className="text-xs uppercase text-gray-500 tracking-wide">User</p>
                  <p className="text-sm text-gray-800 mt-1">{selectedLog.user || '-'}</p>
                </div>
                <div>
                  <p className="text-xs uppercase text-gray-500 tracking-wide">IP Address</p>
                  <p className="text-sm text-gray-800 mt-1">{selectedLog.ipAddress || '-'}</p>
                </div>
              </div>

              <div>
                <p className="text-xs uppercase text-gray-500 tracking-wide">Description</p>
                <p className="text-sm text-gray-800 mt-1 whitespace-pre-wrap">{selectedLog.description || '-'}</p>
              </div>

              <div>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs uppercase text-gray-500 tracking-wide">Metadata</p>
                  <button
                    type="button"
                    onClick={copyMetadata}
                    className="px-3 py-2.5 sm:py-1.5 rounded-md bg-slate-700 text-white text-xs font-semibold hover:bg-slate-800"
                  >
                    Copy Metadata
                  </button>
                </div>
                {copyState === 'success' && <p className="text-xs text-green-600 mt-2">Metadata copied to clipboard.</p>}
                {copyState === 'error' && <p className="text-xs text-red-600 mt-2">Unable to copy metadata.</p>}
                <pre className="mt-2 p-3 bg-slate-50 border border-slate-200 rounded-md text-xs text-slate-700 overflow-auto">
{selectedMetadata}
                </pre>
              </div>
            </div>

            <div className="px-4 sm:px-6 py-4 border-t border-gray-200 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setSelectedLog(null);
                  setCopyState('idle');
                }}
                className="px-4 py-2.5 sm:py-2 rounded-md bg-blue-500 text-white font-semibold hover:bg-blue-600"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default SystemLogs;
