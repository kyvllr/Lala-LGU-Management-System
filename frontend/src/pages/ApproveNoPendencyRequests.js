import React, { useEffect, useState } from 'react';
import { noPendencyRequestAPI } from '../api';
import { TbPrinter } from 'react-icons/tb';
import { FiSearch } from 'react-icons/fi';
import printNoPendencyCertificate from '../utils/printNoPendencyCertificate';
import downloadPaymentProof from '../utils/downloadPaymentProof';

function ApproveNoPendencyRequests({ forcedStatus = 'Pending' }) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [processingId, setProcessingId] = useState(null);
  const [remarks, setRemarks] = useState({});
  const [searchQuery, setSearchQuery] = useState('');

  const fetchRequests = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await noPendencyRequestAPI.getAll(forcedStatus);
      setRequests(Array.isArray(response.data) ? response.data : []);
    } catch (requestError) {
      console.error('Failed to load no-pendency certificate requests:', requestError);
      setError(requestError.response?.data?.message || 'Failed to load certificate requests.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, [forcedStatus]);

  const reviewRequest = async (request, decision) => {
    setProcessingId(request.requestId);
    setError('');
    try {
      await noPendencyRequestAPI[decision](request.requestId, { remarks: remarks[request.requestId] || '' });
      setRemarks((current) => ({ ...current, [request.requestId]: '' }));
      await fetchRequests();
    } catch (requestError) {
      console.error(`Failed to ${decision} no-pendency certificate request:`, requestError);
      setError(requestError.response?.data?.message || 'Failed to review certificate request.');
    } finally {
      setProcessingId(null);
    }
  };

  const handlePrint = (request) => {
    if (!printNoPendencyCertificate(request)) {
      alert('Allow pop-ups for this site to print the certificate.');
    }
  };

  const normalizedSearch = searchQuery.trim().toLowerCase();
  const filteredRequests = requests.filter((request) => {
    const applicationDate = request.dateOfApplication
      ? new Date(request.dateOfApplication).toLocaleDateString()
      : '';
    return [
      request.staffName,
      request.fullName,
      request.staffId,
      request.staffDepartment,
      request.position,
      request.pendingCase,
      request.status,
      request.reviewRemarks,
      applicationDate,
    ]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(normalizedSearch));
  });

  if (loading) return <div className="py-8 text-center text-slate-600">Loading certificate requests...</div>;

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-800">Certificate of No Pending Case Requests ({filteredRequests.length})</h2>
        <button type="button" onClick={fetchRequests} className="rounded-md bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200">
          Refresh
        </button>
      </div>
      {error && <div role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      <label className="relative block">
        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
        <input
          type="search"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="Search by name, item number, department, position, or pending case..."
          aria-label="Filter no-pending-case requests"
          className="w-full rounded-md border border-slate-300 bg-white py-2 pl-10 pr-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
        />
      </label>

      {filteredRequests.length === 0 ? (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-6 text-center text-blue-800">
          {requests.length === 0 ? 'No certificate requests in this status.' : 'No certificate requests match your search.'}
        </div>
      ) : filteredRequests.map((request) => (
        <article key={request.requestId} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h3 className="font-semibold text-slate-900">{request.staffName || request.fullName}</h3>
              <p className="text-sm text-slate-600">{request.staffId} · {request.staffDepartment || 'No department listed'}</p>
            </div>
            <div className="flex items-center gap-2">
              {request.status === 'Approved' && (
                <button
                  type="button"
                  onClick={() => handlePrint(request)}
                  className="flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-700"
                >
                  <TbPrinter size={16} />
                  Print Certificate
                </button>
              )}
              <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">{request.status}</span>
            </div>
          </div>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <div><dt className="font-semibold text-slate-500">Full Name</dt><dd>{request.fullName}</dd></div>
            <div><dt className="font-semibold text-slate-500">Position</dt><dd>{request.position}</dd></div>
            <div><dt className="font-semibold text-slate-500">Pending Case</dt><dd className="whitespace-pre-wrap">{request.pendingCase}</dd></div>
            <div><dt className="font-semibold text-slate-500">Date</dt><dd>{new Date(request.dateOfApplication).toLocaleDateString()}</dd></div>
          </dl>
          {request.paymentProof?.fileName && (
            <button
              type="button"
              onClick={async () => {
                try {
                  const response = await noPendencyRequestAPI.getPaymentProof(request.requestId);
                  downloadPaymentProof(response, request.paymentProof.fileName);
                } catch (proofError) {
                  setError(proofError.response?.data?.message || 'Unable to download proof of payment.');
                }
              }}
              className="mt-3 rounded-md bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100"
            >
              Download proof of payment: {request.paymentProof.fileName}
            </button>
          )}
          {request.status === 'Pending' ? (
            <div className="mt-4 space-y-3 border-t border-slate-100 pt-4">
              <label className="block text-sm font-semibold text-slate-700">
                Review Remarks
                <textarea
                  rows={2}
                  value={remarks[request.requestId] || ''}
                  onChange={(event) => setRemarks((current) => ({ ...current, [request.requestId]: event.target.value }))}
                  disabled={processingId === request.requestId}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 font-normal"
                />
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => reviewRequest(request, 'approve')}
                  disabled={processingId === request.requestId}
                  className="rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
                >
                  {processingId === request.requestId ? 'Processing...' : 'Approve'}
                </button>
                <button
                  type="button"
                  onClick={() => reviewRequest(request, 'disapprove')}
                  disabled={processingId === request.requestId}
                  className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                >
                  Disapprove
                </button>
              </div>
            </div>
          ) : request.reviewRemarks ? (
            <p className="mt-3 border-t border-slate-100 pt-3 text-sm text-slate-600"><strong>Review remarks:</strong> {request.reviewRemarks}</p>
          ) : null}
        </article>
      ))}
    </section>
  );
}

export default ApproveNoPendencyRequests;
