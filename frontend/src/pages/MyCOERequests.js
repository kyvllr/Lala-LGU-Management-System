import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { coeAPI, authAPI } from '../api';
import { TbTrash, TbCheck, TbX, TbAlertTriangle, TbPlus, TbSearch, TbFilter, TbFilterOff, TbPrinter } from 'react-icons/tb';
import printCOE from '../utils/printCOE';
import downloadPaymentProof from '../utils/downloadPaymentProof';

const MyCOERequests = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [coes, setCoes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    sortBy: 'date-desc',
    dateFrom: '',
    dateTo: '',
    minCopies: '',
    maxCopies: '',
  });

  useEffect(() => {
    const fetchUserAndCOEs = async () => {
      try {
        const userResponse = await authAPI.getCurrentUser();
        setUser(userResponse.data);

        const coesResponse = await coeAPI.getByStaffId(userResponse.data.id);
        setCoes(Array.isArray(coesResponse) ? coesResponse : coesResponse.data || []);
      } catch (err) {
        console.error('Error fetching data:', err);
        setError('Failed to load COE requests.');
      } finally {
        setLoading(false);
      }
    };

    fetchUserAndCOEs();
  }, []);

  const handleDelete = async (coeId) => {
    if (!window.confirm('Are you sure you want to delete this COE request?')) {
      return;
    }

    setDeleting(coeId);
    try {
      await coeAPI.delete(coeId);
      setCoes(coes.filter((coe) => coe.coeId !== coeId));
      alert('COE request deleted successfully.');
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete COE request.');
    } finally {
      setDeleting(null);
    }
  };

  const handlePrint = (coe) => {
    if (!printCOE(coe)) {
      alert('Allow pop-ups for this site to print the Certificate of Employment.');
    }
  };

  const formatDate = (date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Pending':
        return 'bg-blue-100 text-blue-700';
      case 'Approved':
        return 'bg-green-100 text-green-700';
      case 'Disapproved':
        return 'bg-red-100 text-red-700';
      case 'For Revision':
        return 'bg-yellow-100 text-yellow-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto mt-10 p-4 sm:p-6 bg-white rounded-lg shadow">
        <p className="text-gray-600">Loading your COE requests...</p>
      </div>
    );
  }

  const approvedRequests = coes.filter((coe) => coe.status === 'Approved');

  const statusTabs = [
    { label: 'All', value: 'All', count: coes.length },
    { label: 'Pending', value: 'Pending', count: coes.filter(c => c.status === 'Pending').length },
    { label: 'Approved', value: 'Approved', count: coes.filter(c => c.status === 'Approved').length },
    { label: 'For Revision', value: 'For Revision', count: coes.filter(c => c.status === 'For Revision').length },
    { label: 'Disapproved', value: 'Disapproved', count: coes.filter(c => c.status === 'Disapproved').length },
  ];

  const applyFilters = () => {
    let result = selectedStatus === 'All' ? coes : coes.filter(coe => coe.status === selectedStatus);

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(coe =>
        coe.coeId.toLowerCase().includes(query) ||
        coe.purpose.toLowerCase().includes(query) ||
        coe.fullName.toLowerCase().includes(query)
      );
    }

    if (filters.dateFrom) {
      result = result.filter(coe => new Date(coe.createdAt) >= new Date(filters.dateFrom));
    }
    if (filters.dateTo) {
      const endOfDay = new Date(filters.dateTo);
      endOfDay.setHours(23, 59, 59, 999);
      result = result.filter(coe => new Date(coe.createdAt) <= endOfDay);
    }

    if (filters.minCopies) {
      result = result.filter(coe => coe.numberOfCopies >= parseInt(filters.minCopies));
    }
    if (filters.maxCopies) {
      result = result.filter(coe => coe.numberOfCopies <= parseInt(filters.maxCopies));
    }

    if (filters.sortBy === 'date-desc') {
      result.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    } else if (filters.sortBy === 'date-asc') {
      result.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    } else if (filters.sortBy === 'purpose-asc') {
      result.sort((a, b) => a.purpose.localeCompare(b.purpose));
    } else if (filters.sortBy === 'copies-desc') {
      result.sort((a, b) => b.numberOfCopies - a.numberOfCopies);
    }

    return result;
  };

  const filteredCoes = applyFilters();

  const hasActiveFilters = searchQuery.trim() !== '' || filters.dateFrom || filters.dateTo || filters.minCopies || filters.maxCopies || filters.sortBy !== 'date-desc';

  const handleResetFilters = () => {
    setSearchQuery('');
    setFilters({
      sortBy: 'date-desc',
      dateFrom: '',
      dateTo: '',
      minCopies: '',
      maxCopies: '',
    });
  };

  return (
    <div className="max-w-4xl mx-auto mt-10 space-y-6">
      <div className="bg-white rounded-lg shadow p-4 sm:p-6">
        <div className="flex flex-wrap justify-between items-center gap-3 mb-4">
          <h1 className="text-2xl font-bold text-gray-800">My COE Requests</h1>
          <button
            type="button"
            onClick={() => navigate('/request-coe')}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2.5 sm:py-2 rounded-lg hover:bg-blue-700 transition font-semibold"
          >
            <TbPlus size={18} />
            New Request
          </button>
        </div>

        {/* Status Filter Tabs */}
        <div className="flex gap-2 mb-6 border-b border-gray-200 flex-wrap">
          {statusTabs.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setSelectedStatus(tab.value)}
              className={`px-4 py-2.5 sm:py-2 font-semibold text-sm border-b-2 transition whitespace-nowrap ${
                selectedStatus === tab.value
                  ? 'border-blue-600 text-blue-600 bg-blue-50'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              {tab.label}
              {tab.count > 0 && (
                <span className={`ml-2 px-2 py-0.5 rounded-full text-xs font-bold ${
                  selectedStatus === tab.value
                    ? 'bg-blue-200 text-blue-800'
                    : 'bg-gray-200 text-gray-700'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Search and Filter Section */}
        <div className="mb-6 space-y-4">
          <div className="flex gap-2 items-center flex-wrap">
            <div className="flex-1 min-w-0 sm:min-w-64 relative">
              <TbSearch className="absolute left-3 top-3 text-gray-400" size={18} />
              <input
                type="text"
                placeholder="Search by ID, purpose, or name..."
                aria-label="Search requests"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 sm:py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-4 py-2.5 sm:py-2 rounded-lg font-semibold transition whitespace-nowrap ${
                showFilters
                  ? 'bg-blue-100 text-blue-600 border border-blue-300'
                  : 'bg-gray-100 text-gray-700 border border-gray-300 hover:bg-gray-200'
              }`}
            >
              <TbFilter size={18} />
              Filters
            </button>
            {hasActiveFilters && (
              <button
                onClick={handleResetFilters}
                className="flex items-center gap-1 px-3 py-2 text-gray-600 hover:text-gray-800 transition text-sm"
              >
                <TbFilterOff size={16} />
                Reset
              </button>
            )}
          </div>

          {/* Advanced Filters Panel */}
          {showFilters && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Sort By</label>
                <select
                  value={filters.sortBy}
                  onChange={(e) => setFilters({...filters, sortBy: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                >
                  <option value="date-desc">Newest First</option>
                  <option value="date-asc">Oldest First</option>
                  <option value="purpose-asc">Purpose (A-Z)</option>
                  <option value="copies-desc">Most Copies</option>
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="coe-filter-date-from" className="block text-sm font-semibold text-gray-700 mb-2">From Date</label>
                  <input
                    id="coe-filter-date-from"
                    type="date"
                    value={filters.dateFrom}
                    onChange={(e) => setFilters({...filters, dateFrom: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
                <div>
                  <label htmlFor="coe-filter-date-to" className="block text-sm font-semibold text-gray-700 mb-2">To Date</label>
                  <input
                    id="coe-filter-date-to"
                    type="date"
                    value={filters.dateTo}
                    onChange={(e) => setFilters({...filters, dateTo: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="coe-filter-min-copies" className="block text-sm font-semibold text-gray-700 mb-2">Min Copies</label>
                  <input
                    id="coe-filter-min-copies"
                    type="number"
                    min="1"
                    value={filters.minCopies}
                    onChange={(e) => setFilters({...filters, minCopies: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                    placeholder="Min"
                  />
                </div>
                <div>
                  <label htmlFor="coe-filter-max-copies" className="block text-sm font-semibold text-gray-700 mb-2">Max Copies</label>
                  <input
                    id="coe-filter-max-copies"
                    type="number"
                    min="1"
                    value={filters.maxCopies}
                    onChange={(e) => setFilters({...filters, maxCopies: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                    placeholder="Max"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 mb-4">
            {error}
          </div>
        )}

        {/* Approved Notification Banner */}
        {approvedRequests.length > 0 && (
          <div className="mb-6 bg-green-50 border-l-4 border-green-500 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <TbCheck className="text-green-600 mt-1 flex-shrink-0" size={24} />
              <div>
                <h3 className="font-bold text-green-800">✓ Ready for Pickup!</h3>
                <p className="text-green-700 mt-1">
                  You have {approvedRequests.length} approved COE request(s). 
                  <strong> Please collect your Certificate of Employment at the HR Office.</strong>
                </p>
                <div className="mt-2 space-y-1">
                  {approvedRequests.map((coe) => (
                    <p key={coe.coeId} className="text-sm text-green-700">
                      • {coe.numberOfCopies} copy(ies) for: <strong>{coe.purpose}</strong>
                    </p>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {filteredCoes.length === 0 ? (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-8 text-center">
            <p className="text-blue-800 font-semibold text-lg">
              {coes.length === 0 ? 'No COE requests yet' : (
                hasActiveFilters ? 'No matching requests found' : `No ${selectedStatus === 'For Revision' ? selectedStatus : selectedStatus.toLowerCase()} requests`
              )}
            </p>
            <p className="text-blue-600 mt-2">
              {coes.length === 0 ? 'Click "New Request" to submit your first request.' : (
                hasActiveFilters ? 'Try adjusting your search or filters.' : 'Try selecting a different status filter.'
              )}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-gray-600 mb-2">
              Showing <strong>{filteredCoes.length}</strong> of <strong>{coes.length}</strong> request{coes.length !== 1 ? 's' : ''}
            </p>
            {filteredCoes.map((coe) => (
              <div key={coe.coeId} className="border border-gray-200 rounded-lg bg-gray-50 overflow-hidden">
                <div
                  className="p-4 cursor-pointer hover:bg-gray-100 transition flex justify-between items-start"
                  onClick={() => setExpandedId(expandedId === coe.coeId ? null : coe.coeId)}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className={`text-sm font-bold px-3 py-1 rounded-full ${getStatusColor(coe.status)}`}>
                        {coe.status === 'Approved' && <TbCheck className="inline mr-1" size={14} />}
                        {coe.status === 'Disapproved' && <TbX className="inline mr-1" size={14} />}
                        {coe.status === 'For Revision' && <TbAlertTriangle className="inline mr-1" size={14} />}
                        {coe.status}
                      </span>
                      <span className="text-xs text-gray-600">
                        {formatDate(coe.createdAt)}
                      </span>
                    </div>
                    <p className="text-gray-800 font-semibold">{coe.purpose}</p>
                    <p className="text-sm text-gray-600">
                      {coe.numberOfCopies} copy(ies) • {formatDate(coe.dateOfApplication)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    {coe.status === 'Approved' && (
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          handlePrint(coe);
                        }}
                        className="flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-2.5 sm:py-1.5 text-sm font-semibold text-white hover:bg-blue-700"
                      >
                        <TbPrinter size={16} />
                        Print COE
                      </button>
                    )}
                    <span className="text-2xl text-gray-400">{expandedId === coe.coeId ? '−' : '+'}</span>
                  </div>
                </div>

                {expandedId === coe.coeId && (
                  <div className="bg-white border-t border-gray-200 p-4 space-y-3">
                    {coe.paymentProof?.fileName && (
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            const response = await coeAPI.getPaymentProof(coe.coeId);
                            downloadPaymentProof(response, coe.paymentProof.fileName);
                          } catch (proofError) {
                            setError(proofError.response?.data?.message || 'Unable to download proof of payment.');
                          }
                        }}
                        className="rounded-md bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100"
                      >
                        Download proof of payment: {coe.paymentProof.fileName}
                      </button>
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-600">Full Name:</span>
                        <p className="font-medium text-gray-800">{coe.fullName}</p>
                      </div>
                      <div>
                        <span className="text-gray-600">Position:</span>
                        <p className="font-medium text-gray-800">{coe.positionTitle || 'N/A'}</p>
                      </div>
                      <div>
                        <span className="text-gray-600">Office/Department:</span>
                        <p className="font-medium text-gray-800">{coe.office || 'N/A'}</p>
                      </div>
                      <div>
                        <span className="text-gray-600">Monthly Salary:</span>
                        <p className="font-medium text-gray-800">
                          {coe.monthlySalary ? `₱ ${coe.monthlySalary.toLocaleString()}` : 'N/A'}
                        </p>
                      </div>
                      {coe.periodFrom && (
                        <div>
                          <span className="text-gray-600">Service Period:</span>
                          <p className="font-medium text-gray-800">
                            {formatDate(coe.periodFrom)} to {formatDate(coe.periodTo)}
                          </p>
                        </div>
                      )}
                      <div>
                        <span className="text-gray-600">Number of Copies:</span>
                        <p className="font-medium text-gray-800">{coe.numberOfCopies}</p>
                      </div>
                    </div>

                    {coe.remarks && (
                      <div className="bg-gray-50 p-3 rounded">
                        <p className="text-xs text-gray-600 font-semibold">Your Remarks:</p>
                        <p className="text-sm text-gray-700">{coe.remarks}</p>
                      </div>
                    )}

                    {coe.status === 'Approved' && (
                      <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                        <div className="flex items-start gap-2">
                          <TbCheck className="text-green-600 mt-0.5 flex-shrink-0" size={18} />
                          <div>
                            <p className="text-sm font-semibold text-green-800">Ready for Pickup!</p>
                            <p className="text-sm text-green-700 mt-1">
                              Your Certificate of Employment is ready. Please visit the HR Office to collect it.
                            </p>
                            <p className="text-xs text-green-600 mt-2">
                              <strong>Approved:</strong> {formatDate(coe.approvalDate)}
                            </p>
                            {coe.approvalRemarks && (
                              <p className="text-xs text-green-700 mt-1">
                                <strong>Notes:</strong> {coe.approvalRemarks}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {coe.status === 'For Revision' && (
                      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                        <div className="flex items-start gap-2">
                          <TbAlertTriangle className="text-yellow-600 mt-0.5 flex-shrink-0" size={18} />
                          <div>
                            <p className="text-sm font-semibold text-yellow-800">Please Revise</p>
                            <p className="text-sm text-yellow-700 mt-1">
                              {coe.revisionComment}
                            </p>
                            <p className="text-xs text-yellow-600 mt-2">
                              <strong>Revision Requested:</strong> {formatDate(coe.revisionRequestedAt)}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {coe.status === 'Disapproved' && (
                      <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                        <div className="flex items-start gap-2">
                          <TbX className="text-red-600 mt-0.5 flex-shrink-0" size={18} />
                          <div>
                            <p className="text-sm font-semibold text-red-800">Request Disapproved</p>
                            {coe.disapprovalRemarks && (
                              <p className="text-sm text-red-700 mt-1">
                                <strong>Reason:</strong> {coe.disapprovalRemarks}
                              </p>
                            )}
                            <p className="text-xs text-red-600 mt-2">
                              <strong>Disapproved:</strong> {formatDate(coe.disapprovalDate)}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {coe.status === 'Pending' && (
                      <div className="flex gap-2 pt-3 border-t border-gray-200">
                        <button
                          type="button"
                          onClick={() => handleDelete(coe.coeId)}
                          disabled={deleting === coe.coeId}
                          className="flex items-center gap-1 bg-red-100 text-red-700 px-3 py-2.5 sm:py-1.5 rounded hover:bg-red-200 transition text-sm disabled:opacity-50"
                        >
                          <TbTrash size={14} />
                          {deleting === coe.coeId ? 'Deleting...' : 'Delete'}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default MyCOERequests;
