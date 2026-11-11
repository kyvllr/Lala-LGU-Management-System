import React, { useState, useEffect } from 'react';
import { coeAPI } from '../api';
import { TbCheck, TbX, TbAlertTriangle, TbRefresh, TbPrinter } from 'react-icons/tb';
import { FiSearch } from 'react-icons/fi';
import printCOE from '../utils/printCOE';
import downloadPaymentProof from '../utils/downloadPaymentProof';

const ApproveCOEsAdmin = ({ forcedStatus = 'Pending' }) => {
  const [coes, setCoes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [processingId, setProcessingId] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [approvalRemarks, setApprovalRemarks] = useState({});
  const [disapprovalRemarks, setDisapprovalRemarks] = useState({});
  const [revisionComment, setRevisionComment] = useState({});

  const fetchCOEs = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await coeAPI.getAll(forcedStatus);
      setCoes(Array.isArray(response) ? response : response.data || []);
    } catch (err) {
      console.error('Error fetching COE requests:', err);
      setError('Failed to fetch COE requests.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCOEs();
  }, [forcedStatus]);

  const handleApprove = async (coeId) => {
    if (!approvalRemarks[coeId]) {
      alert('Please provide approval remarks.');
      return;
    }

    setProcessingId(coeId);
    try {
      await coeAPI.approve(coeId, { approvalRemarks: approvalRemarks[coeId] });
      alert('COE request approved. Employee will be notified to pickup at HR Office.');
      fetchCOEs();
      setApprovalRemarks({ ...approvalRemarks, [coeId]: '' });
      setExpandedId(null);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to approve COE request.');
    } finally {
      setProcessingId(null);
    }
  };

  const handleDisapprove = async (coeId) => {
    if (!disapprovalRemarks[coeId]) {
      alert('Please provide disapproval remarks.');
      return;
    }

    setProcessingId(coeId);
    try {
      await coeAPI.disapprove(coeId, { disapprovalRemarks: disapprovalRemarks[coeId] });
      alert('COE request disapproved.');
      fetchCOEs();
      setDisapprovalRemarks({ ...disapprovalRemarks, [coeId]: '' });
      setExpandedId(null);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to disapprove COE request.');
    } finally {
      setProcessingId(null);
    }
  };

  const handleRevise = async (coeId) => {
    if (!revisionComment[coeId]) {
      alert('Please provide revision comment.');
      return;
    }

    setProcessingId(coeId);
    try {
      await coeAPI.revise(coeId, { revisionComment: revisionComment[coeId] });
      alert('COE request sent for revision. Employee will be notified.');
      fetchCOEs();
      setRevisionComment({ ...revisionComment, [coeId]: '' });
      setExpandedId(null);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to request revision.');
    } finally {
      setProcessingId(null);
    }
  };

  const handlePrint = (coe) => {
    if (!printCOE(coe)) {
      alert('Allow pop-ups for this site to print the Certificate of Employment.');
    }
  };

  if (loading) {
    return <div className="text-center py-8 text-gray-600">Loading COE requests...</div>;
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
        {error}
        <button
          type="button"
          onClick={fetchCOEs}
          className="ml-4 text-red-600 underline hover:text-red-800"
        >
          Retry
        </button>
      </div>
    );
  }

  const formatDate = (date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const normalizedSearch = searchQuery.trim().toLowerCase();
  const filteredCOEs = coes.filter((coe) => (
    [
      coe.staffName,
      coe.fullName,
      coe.staffId,
      coe.positionTitle,
      coe.office,
      coe.purpose,
      coe.status,
      coe.dateOfApplication && formatDate(coe.dateOfApplication),
    ]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(normalizedSearch))
  ));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap justify-between items-center gap-3">
        <h2 className="min-w-0 break-words text-xl font-bold text-gray-800">COE Requests ({filteredCOEs.length})</h2>
        <button
          type="button"
          onClick={fetchCOEs}
          className="flex items-center gap-2 px-3 py-2.5 sm:py-1.5 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition text-sm"
        >
          <TbRefresh size={16} />
          Refresh
        </button>
      </div>

      <label className="relative block">
        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
        <input
          type="search"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="Search by name, item number, position, office, or purpose..."
          aria-label="Filter COE requests"
          className="w-full rounded-md border border-gray-300 bg-white py-2 pl-10 pr-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
        />
      </label>

      {filteredCOEs.length === 0 ? (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 text-center">
          <p className="text-blue-800 font-semibold">
            {coes.length === 0 ? 'No COE requests in this status' : 'No COE requests match your search'}
          </p>
        </div>
      ) : filteredCOEs.map((coe) => (
        <div key={coe.coeId} className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
          <div
            className="cursor-pointer flex flex-wrap justify-between items-start gap-3"
            onClick={() => setExpandedId(expandedId === coe.coeId ? null : coe.coeId)}
          >
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-3">
                <span className="font-semibold text-gray-800 break-words">{coe.staffName}</span>
                <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded-full">
                  {coe.status}
                </span>
              </div>
              <p className="text-sm text-gray-600 mt-1 break-words">
                <strong>Purpose:</strong> {coe.purpose}
              </p>
              <p className="text-sm text-gray-600 break-words">
                <strong>Applied:</strong> {formatDate(coe.dateOfApplication)}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {coe.status === 'Approved' && (
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    handlePrint(coe);
                  }}
                  className="flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 sm:py-1.5"
                >
                  <TbPrinter size={16} />
                  Print COE
                </button>
              )}
              <span className="text-2xl text-gray-300">{expandedId === coe.coeId ? '−' : '+'}</span>
            </div>
          </div>

          {expandedId === coe.coeId && (
            <div className="mt-4 pt-4 border-t border-gray-200 space-y-3">
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
                  className="rounded-md bg-blue-50 px-3 py-2.5 text-left text-sm font-semibold text-blue-700 hover:bg-blue-100 sm:py-2 max-w-full break-all"
                >
                  Download proof of payment: {coe.paymentProof.fileName}
                </button>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div className="min-w-0 break-words">
                  <span className="text-gray-600">Full Name:</span>
                  <p className="font-medium">{coe.fullName}</p>
                </div>
                <div className="min-w-0 break-words">
                  <span className="text-gray-600">Item Number:</span>
                  <p className="font-medium">{coe.staffId}</p>
                </div>
                <div className="min-w-0 break-words">
                  <span className="text-gray-600">Position:</span>
                  <p className="font-medium">{coe.positionTitle || 'N/A'}</p>
                </div>
                <div className="min-w-0 break-words">
                  <span className="text-gray-600">Office:</span>
                  <p className="font-medium">{coe.office || 'N/A'}</p>
                </div>
                <div className="min-w-0 break-words">
                  <span className="text-gray-600">Monthly Salary:</span>
                  <p className="font-medium">₱ {coe.monthlySalary ? coe.monthlySalary.toLocaleString() : 'N/A'}</p>
                </div>
                <div className="min-w-0 break-words">
                  <span className="text-gray-600">Number of Copies:</span>
                  <p className="font-medium">{coe.numberOfCopies}</p>
                </div>
                {coe.periodFrom && (
                  <div className="min-w-0 break-words">
                    <span className="text-gray-600">Service Period:</span>
                    <p className="font-medium">{formatDate(coe.periodFrom)} to {formatDate(coe.periodTo)}</p>
                  </div>
                )}
              </div>

              {coe.remarks && (
                <div className="bg-gray-50 p-3 rounded break-words">
                  <p className="text-xs text-gray-600 font-semibold">Remarks:</p>
                  <p className="text-sm text-gray-700">{coe.remarks}</p>
                </div>
              )}

              {coe.status === 'Pending' && (
                <div className="mt-4 space-y-3 pt-4 border-t border-gray-200">
                  <div>
                    <label htmlFor={`coe-approval-remarks-${coe.coeId}`} className="block text-sm font-medium text-gray-700 mb-1">Approval Remarks:</label>
                    <textarea
                      id={`coe-approval-remarks-${coe.coeId}`}
                      value={approvalRemarks[coe.coeId] || ''}
                      onChange={(e) => setApprovalRemarks({ ...approvalRemarks, [coe.coeId]: e.target.value })}
                      placeholder="Enter remarks for approval..."
                      disabled={processingId === coe.coeId}
                      rows={2}
                      className="w-full border border-gray-300 rounded px-3 py-2 text-sm disabled:bg-gray-100"
                    />
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row">
                    <button
                      type="button"
                      onClick={() => handleApprove(coe.coeId)}
                      disabled={processingId === coe.coeId}
                      className="flex-1 flex items-center justify-center gap-2 bg-green-600 text-white py-2.5 sm:py-2 rounded hover:bg-green-700 transition disabled:bg-gray-400 text-sm font-semibold"
                    >
                      <TbCheck size={16} />
                      {processingId === coe.coeId ? 'Processing...' : 'Approve'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDisapprove(coe.coeId)}
                      disabled={processingId === coe.coeId}
                      className="flex-1 flex items-center justify-center gap-2 bg-red-600 text-white py-2.5 sm:py-2 rounded hover:bg-red-700 transition disabled:bg-gray-400 text-sm font-semibold"
                    >
                      <TbX size={16} />
                      Disapprove
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRevise(coe.coeId)}
                      disabled={processingId === coe.coeId}
                      className="flex-1 flex items-center justify-center gap-2 bg-yellow-600 text-white py-2.5 sm:py-2 rounded hover:bg-yellow-700 transition disabled:bg-gray-400 text-sm font-semibold"
                    >
                      <TbAlertTriangle size={16} />
                      Revise
                    </button>
                  </div>

                  <div>
                    <label htmlFor={`coe-disapproval-remarks-${coe.coeId}`} className="block text-sm font-medium text-gray-700 mb-1">Disapproval Remarks (if needed):</label>
                    <textarea
                      id={`coe-disapproval-remarks-${coe.coeId}`}
                      value={disapprovalRemarks[coe.coeId] || ''}
                      onChange={(e) => setDisapprovalRemarks({ ...disapprovalRemarks, [coe.coeId]: e.target.value })}
                      placeholder="Reason for disapproval..."
                      disabled={processingId === coe.coeId}
                      rows={2}
                      className="w-full border border-gray-300 rounded px-3 py-2 text-sm disabled:bg-gray-100"
                    />
                  </div>

                  <div>
                    <label htmlFor={`coe-revision-comment-${coe.coeId}`} className="block text-sm font-medium text-gray-700 mb-1">Revision Comment (if needed):</label>
                    <textarea
                      id={`coe-revision-comment-${coe.coeId}`}
                      value={revisionComment[coe.coeId] || ''}
                      onChange={(e) => setRevisionComment({ ...revisionComment, [coe.coeId]: e.target.value })}
                      placeholder="What needs to be revised..."
                      disabled={processingId === coe.coeId}
                      rows={2}
                      className="w-full border border-gray-300 rounded px-3 py-2 text-sm disabled:bg-gray-100"
                    />
                  </div>
                </div>
              )}

              {coe.status === 'Approved' && (
                <div className="bg-green-50 border border-green-200 rounded p-3 break-words">
                <p className="text-sm text-green-800" style={{display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
                    <strong>✓ Approved by:</strong> {coe.approvedBy}
                  </p>
                  <p className="text-sm text-green-800">
                    <strong>Date:</strong> {formatDate(coe.approvalDate)}
                  </p>
                  {coe.approvalRemarks && (
                    <p className="text-sm text-green-800 mt-1">
                      <strong>Remarks:</strong> {coe.approvalRemarks}
                    </p>
                  )}
                  <p className="text-xs text-green-700 mt-2 font-semibold">
                    ✓ Employee notified to pickup at HR Office
                  </p>
                </div>
              )}

              {coe.status === 'For Revision' && (
                <div className="bg-yellow-50 border border-yellow-200 rounded p-3">
                  <p className="text-sm text-yellow-800">
                    <strong>Revision requested by:</strong> {coe.revisionRequestedBy}
                  </p>
                  <p className="text-sm text-yellow-800 mt-1">
                    <strong>Comment:</strong> {coe.revisionComment}
                  </p>
                </div>
              )}

              {coe.status === 'Disapproved' && (
                <div className="bg-red-50 border border-red-200 rounded p-3">
                  <p className="text-sm text-red-800">
                    <strong>Disapproved by:</strong> {coe.disapprovedBy}
                  </p>
                  {coe.disapprovalRemarks && (
                    <p className="text-sm text-red-800 mt-1">
                      <strong>Reason:</strong> {coe.disapprovalRemarks}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default ApproveCOEsAdmin;
