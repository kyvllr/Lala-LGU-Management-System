import React, { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { authAPI, noLeaveWithoutPayCertificateAPI, noPendencyRequestAPI } from '../api';
import { TbPrinter } from 'react-icons/tb';
import printNoPendencyCertificate from '../utils/printNoPendencyCertificate';
import printNoLeaveWithoutPayCertificate from '../utils/printNoLeaveWithoutPayCertificate';
import RequestCOE from './RequestCOE';
import downloadPaymentProof from '../utils/downloadPaymentProof';

const CERTIFICATE_TABS = [
  { key: 'coe', label: 'Requesting COE' },
  { key: 'no-pendency', label: 'Cert of No Pendency/Non-Pendency Case' },
  { key: 'no-leave-without-pay', label: 'Certificate' },
];

function getLocalDate() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

function NoPendencyRequestForm() {
  const [user, setUser] = useState(null);
  const [form, setForm] = useState({
    fullName: '',
    position: '',
    pendingCase: '',
    dateOfApplication: getLocalDate(),
  });
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [proofOfPayment, setProofOfPayment] = useState(null);
  const proofInputRef = useRef(null);

  const loadRequests = async (staffId) => {
    const response = await noPendencyRequestAPI.getByStaffId(staffId);
    setRequests(Array.isArray(response.data) ? response.data : []);
  };

  useEffect(() => {
    const loadForm = async () => {
      try {
        const response = await authAPI.getCurrentUser();
        const currentUser = response.data;
        const staffId = currentUser.staffId || currentUser.id;
        setUser({ ...currentUser, staffId });
        setForm((current) => ({
          ...current,
          fullName: currentUser.name || '',
          position: currentUser.position || '',
        }));
        await loadRequests(staffId);
      } catch (requestError) {
        console.error('Failed to load certificate request information:', requestError);
        setError(requestError.response?.data?.message || 'Failed to load your certificate request information.');
      } finally {
        setLoading(false);
      }
    };

    loadForm();
  }, []);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const handlePrint = (request) => {
    if (!printNoPendencyCertificate(request)) {
      alert('Allow pop-ups for this site to print the certificate.');
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');
    setSubmitting(true);

    try {
      await noPendencyRequestAPI.create(form, proofOfPayment);
      setProofOfPayment(null);
      if (proofInputRef.current) proofInputRef.current.value = '';
      setForm((current) => ({ ...current, pendingCase: '', dateOfApplication: getLocalDate() }));
      setSuccess('Your Certificate of No Pending Case request has been submitted for admin review.');
      try {
        await loadRequests(user.staffId);
      } catch (refreshError) {
        console.error('Request submitted but certificate request history could not be refreshed:', refreshError);
        setError('Your request was submitted, but your request history could not be refreshed. Reload the page to see it.');
      }
    } catch (requestError) {
      console.error('Failed to submit no-pendency certificate request:', requestError);
      setError(requestError.response?.data?.message || 'Failed to submit your certificate request.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="rounded-lg border border-blue-100 bg-white p-6 text-slate-600">Loading certificate request form...</div>;
  }

  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-blue-100 bg-white p-5 shadow-sm">
        <h2 className="text-xl font-bold text-blue-950">Certificate of No Pending Case</h2>
        <p className="mt-1 text-sm text-slate-600">Submit the details below for review by the administrator.</p>

        {error && <div role="alert" className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
        {success && <div role="status" className="mt-4 rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-700">{success}</div>}

        <form onSubmit={handleSubmit} className="mt-5 grid gap-4 md:grid-cols-2">
          <label className="text-sm font-semibold text-slate-700">
            Full Name
            <input
              name="fullName"
              value={form.fullName}
              onChange={handleChange}
              required
              disabled={submitting}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 font-normal"
            />
          </label>
          <label className="text-sm font-semibold text-slate-700">
            Position
            <input
              name="position"
              value={form.position}
              onChange={handleChange}
              required
              disabled={submitting}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 font-normal"
            />
          </label>
          <label className="text-sm font-semibold text-slate-700 md:col-span-2">
            Pending Case
            <select
              name="pendingCase"
              value={form.pendingCase}
              onChange={handleChange}
              required
              disabled={submitting}
              className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 font-normal"
            >
              <option value="">Select Yes or No</option>
              <option value="Yes">Yes</option>
              <option value="No">No</option>
            </select>
          </label>
          <label className="text-sm font-semibold text-slate-700">
            Current Date
            <input
              type="date"
              name="dateOfApplication"
              value={form.dateOfApplication}
              readOnly
              className="mt-1 w-full rounded-md border border-slate-300 bg-slate-100 px-3 py-2 font-normal"
            />
          </label>
          <label htmlFor="no-pendency-proof-of-payment" className="text-sm font-semibold text-slate-700">
            Proof of Payment * (PDF, JPG, or PNG; max 10 MB)
            <input
              id="no-pendency-proof-of-payment"
              ref={proofInputRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
              onChange={(event) => setProofOfPayment(event.target.files?.[0] || null)}
              required
              disabled={submitting}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 font-normal"
            />
            {proofOfPayment && <span className="mt-1 block font-normal text-slate-500">Selected: {proofOfPayment.name}</span>}
          </label>
          <div className="flex items-end">
            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-md bg-blue-600 px-4 py-2.5 font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {submitting ? 'Submitting...' : 'Submit Request'}
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-lg border border-blue-100 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-bold text-blue-950">My Certificate Requests</h2>
        {requests.length === 0 ? (
          <p className="mt-3 text-sm text-slate-600">You have not submitted any requests yet.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-full text-left text-sm">
              <thead className="bg-blue-50 text-blue-950">
                <tr>
                  <th scope="col" className="px-3 py-2">Date</th>
                  <th scope="col" className="px-3 py-2">Position</th>
                  <th scope="col" className="px-3 py-2">Pending Case</th>
                  <th scope="col" className="px-3 py-2">Status</th>
                  <th scope="col" className="px-3 py-2">Admin Remarks</th>
                  <th scope="col" className="px-3 py-2">Proof of Payment</th>
                  <th scope="col" className="px-3 py-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((request) => (
                  <tr key={request.requestId} className="border-t border-slate-100 align-top">
                    <td className="px-3 py-2">{new Date(request.dateOfApplication).toLocaleDateString()}</td>
                    <td className="px-3 py-2">{request.position}</td>
                    <td className="max-w-xs whitespace-pre-wrap px-3 py-2">{request.pendingCase}</td>
                    <td className="px-3 py-2">{request.status}</td>
                    <td className="px-3 py-2">{request.reviewRemarks || '-'}</td>
                    <td className="px-3 py-2">
                      {request.paymentProof?.fileName ? (
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
                          className="inline-flex min-h-[44px] sm:min-h-0 items-center whitespace-nowrap rounded-md bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-100"
                        >
                          Download
                        </button>
                      ) : 'N/A'}
                    </td>
                    <td className="px-3 py-2">
                      {request.status === 'Approved' && (
                        <button
                          type="button"
                          onClick={() => handlePrint(request)}
                          className="inline-flex min-h-[44px] sm:min-h-0 items-center gap-1.5 whitespace-nowrap rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
                        >
                          <TbPrinter size={14} />
                          Print
                        </button>
                      )}
                    </td>
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

function NoLeaveWithoutPayCertificateForm() {
  const [user, setUser] = useState(null);
  const [form, setForm] = useState({
    fullName: '',
    position: '',
    periodFrom: '',
    periodTo: '',
    dateOfApplication: getLocalDate(),
  });
  const [proofOfPayment, setProofOfPayment] = useState(null);
  const proofInputRef = useRef(null);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadRequests = async (staffId) => {
    const response = await noLeaveWithoutPayCertificateAPI.getByStaffId(staffId);
    setRequests(Array.isArray(response.data) ? response.data : []);
  };

  useEffect(() => {
    const loadForm = async () => {
      try {
        const response = await authAPI.getCurrentUser();
        const currentUser = response.data;
        const staffId = currentUser.staffId || currentUser.id;
        setUser({ ...currentUser, staffId });
        setForm((current) => ({
          ...current,
          fullName: currentUser.name || '',
          position: currentUser.position || '',
        }));
        await loadRequests(staffId);
      } catch (requestError) {
        console.error('Failed to load no-leave-without-pay certificate information:', requestError);
        setError(requestError.response?.data?.message || 'Failed to load your certificate request information.');
      } finally {
        setLoading(false);
      }
    };

    loadForm();
  }, []);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (!proofOfPayment) {
      setError('Attach your proof of payment before submitting.');
      return;
    }
    if (new Date(form.periodFrom) > new Date(form.periodTo)) {
      setError('The leave-without-pay end date must be on or after the start date.');
      return;
    }

    setSubmitting(true);
    try {
      await noLeaveWithoutPayCertificateAPI.create(form, proofOfPayment);
      setProofOfPayment(null);
      if (proofInputRef.current) proofInputRef.current.value = '';
      setForm((current) => ({
        ...current,
        periodFrom: '',
        periodTo: '',
        dateOfApplication: getLocalDate(),
      }));
      setSuccess('Your Certificate request has been submitted for admin review.');
      try {
        await loadRequests(user.staffId);
      } catch (refreshError) {
        console.error('Certificate request submitted but history could not be refreshed:', refreshError);
        setError('Your request was submitted, but request history could not be refreshed. Reload the page to see it.');
      }
    } catch (requestError) {
      console.error('Failed to submit no-leave-without-pay certificate request:', requestError);
      setError(requestError.response?.data?.message || 'Failed to submit your certificate request.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="rounded-lg border border-blue-100 bg-white p-6 text-slate-600">Loading certificate request form...</div>;
  }

  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-blue-100 bg-white p-5 shadow-sm">
        <h2 className="text-xl font-bold text-blue-950">Certificate of No Leave of Absence Without Pay</h2>
        <p className="mt-1 text-sm text-slate-600">Submit the covered date range and proof of payment for admin review.</p>
        {error && <div role="alert" className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
        {success && <div role="status" className="mt-4 rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-700">{success}</div>}

        <form onSubmit={handleSubmit} className="mt-5 grid gap-4 md:grid-cols-2">
          <label className="text-sm font-semibold text-slate-700">
            Full Name
            <input
              name="fullName"
              value={form.fullName}
              onChange={handleChange}
              required
              disabled={submitting}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 font-normal"
            />
          </label>
          <label className="text-sm font-semibold text-slate-700">
            Position
            <input
              name="position"
              value={form.position}
              onChange={handleChange}
              required
              disabled={submitting}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 font-normal"
            />
          </label>
          <label className="text-sm font-semibold text-slate-700">
            Leave Without Pay From
            <input
              type="date"
              name="periodFrom"
              value={form.periodFrom}
              onChange={handleChange}
              required
              disabled={submitting}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 font-normal"
            />
          </label>
          <label className="text-sm font-semibold text-slate-700">
            Leave Without Pay To
            <input
              type="date"
              name="periodTo"
              value={form.periodTo}
              onChange={handleChange}
              required
              min={form.periodFrom || undefined}
              disabled={submitting}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 font-normal"
            />
          </label>
          <label className="text-sm font-semibold text-slate-700">
            Current Date
            <input
              type="date"
              name="dateOfApplication"
              value={form.dateOfApplication}
              readOnly
              className="mt-1 w-full rounded-md border border-slate-300 bg-slate-100 px-3 py-2 font-normal"
            />
          </label>
          <label htmlFor="no-lwp-proof-of-payment" className="text-sm font-semibold text-slate-700">
            Proof of Payment * (PDF, JPG, or PNG; max 10 MB)
            <input
              id="no-lwp-proof-of-payment"
              ref={proofInputRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
              onChange={(event) => setProofOfPayment(event.target.files?.[0] || null)}
              required
              disabled={submitting}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 font-normal"
            />
            {proofOfPayment && <span className="mt-1 block font-normal text-slate-500">Selected: {proofOfPayment.name}</span>}
          </label>
          <div className="flex items-end">
            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-md bg-blue-600 px-4 py-2.5 font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {submitting ? 'Submitting...' : 'Submit Request'}
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-lg border border-blue-100 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-bold text-blue-950">My Certificate Requests</h2>
        {requests.length === 0 ? (
          <p className="mt-3 text-sm text-slate-600">You have not submitted any requests yet.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-full text-left text-sm">
              <thead className="bg-blue-50 text-blue-950">
                <tr>
                  <th scope="col" className="px-3 py-2">Date</th>
                  <th scope="col" className="px-3 py-2">Position</th>
                  <th scope="col" className="px-3 py-2">Leave Without Pay</th>
                  <th scope="col" className="px-3 py-2">Status</th>
                  <th scope="col" className="px-3 py-2">Admin Remarks</th>
                  <th scope="col" className="px-3 py-2">Proof of Payment</th>
                  <th scope="col" className="px-3 py-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((request) => (
                  <tr key={request.requestId} className="border-t border-slate-100 align-top">
                    <td className="px-3 py-2">{new Date(request.dateOfApplication).toLocaleDateString()}</td>
                    <td className="px-3 py-2">{request.position}</td>
                    <td className="px-3 py-2">{new Date(request.periodFrom).toLocaleDateString()} - {new Date(request.periodTo).toLocaleDateString()}</td>
                    <td className="px-3 py-2">{request.status}</td>
                    <td className="px-3 py-2">{request.reviewRemarks || '-'}</td>
                    <td className="px-3 py-2">
                      {request.paymentProof?.fileName ? (
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              const response = await noLeaveWithoutPayCertificateAPI.getPaymentProof(request.requestId);
                              downloadPaymentProof(response, request.paymentProof.fileName);
                            } catch (proofError) {
                              setError(proofError.response?.data?.message || 'Unable to download proof of payment.');
                            }
                          }}
                          className="inline-flex min-h-[44px] sm:min-h-0 items-center whitespace-nowrap rounded-md bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-100"
                        >
                          Download
                        </button>
                      ) : 'N/A'}
                    </td>
                    <td className="px-3 py-2">
                      {request.status === 'Approved' && (
                        <button
                          type="button"
                          onClick={() => {
                            if (!printNoLeaveWithoutPayCertificate(request)) {
                              setError('Allow pop-ups for this site to print the certificate.');
                            }
                          }}
                          className="inline-flex min-h-[44px] sm:min-h-0 items-center gap-1.5 whitespace-nowrap rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
                        >
                          <TbPrinter size={14} />
                          Print
                        </button>
                      )}
                    </td>
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

function RequestCertificateHub() {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = searchParams.get('tab');
  const activeTab = CERTIFICATE_TABS.some((tab) => tab.key === requestedTab) ? requestedTab : 'coe';

  const selectTab = (tab) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('tab', tab);
    setSearchParams(nextParams);
  };

  return (
    <div className="space-y-4">
      <header className="rounded-lg border border-blue-100 bg-white p-4 shadow-sm">
        <h1 className="text-2xl font-bold tracking-tight text-blue-950">Request Certificate</h1>
        <p className="text-sm text-blue-700/80">Choose the certificate you want to request.</p>
        <nav className="mt-4 flex flex-wrap gap-2 border-b border-blue-100 pb-2" aria-label="Certificate request tabs">
          {CERTIFICATE_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => selectTab(tab.key)}
              aria-current={activeTab === tab.key ? 'page' : undefined}
              className={`rounded-md px-4 py-2 text-sm font-semibold transition ${
                activeTab === tab.key ? 'bg-blue-600 text-white shadow' : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </header>

      {activeTab === 'coe' && <RequestCOE />}
      {activeTab === 'no-pendency' && <NoPendencyRequestForm />}
      {activeTab === 'no-leave-without-pay' && <NoLeaveWithoutPayCertificateForm />}
    </div>
  );
}

export default RequestCertificateHub;
