import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { coeAPI, authAPI } from '../api';
import { TbHistory } from 'react-icons/tb';
import downloadPaymentProof from '../utils/downloadPaymentProof';

const RequestCOE = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [myCoes, setMyCoes] = useState([]);
  const [loadingMyCoes, setLoadingMyCoes] = useState(false);
  const [expandedCoeId, setExpandedCoeId] = useState(null);
  const [agreedToAccuracy, setAgreedToAccuracy] = useState(false);
  const [proofOfPayment, setProofOfPayment] = useState(null);
  const proofInputRef = useRef(null);
  const [form, setForm] = useState({
    fullName: '',
    purpose: '',
    dateOfApplication: new Date().toISOString().split('T')[0],
    positionTitle: '',
    office: '',
    address: '',
    employmentStatus: '',
    lengthOfService: '',
    monthlySalary: '',
    peraRata: '',
    grossSalary: '',
    pendingAdministrativeCase: '',
    pendingCriminalCase: '',
    periodFrom: '',
    periodTo: '',
    numberOfCopies: 1,
    remarks: '',
  });

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const response = await authAPI.getCurrentUser();
        setUser(response.data);
        setForm((prev) => ({
          ...prev,
          fullName: response.data.name || '',
          positionTitle: response.data.position || '',
          office: response.data.department || '',
          address: response.data.address || '',
          employmentStatus: response.data.employmentStatus || '',
          lengthOfService: response.data.lengthOfService || '',
          monthlySalary: response.data.monthlyBasicSalary ?? '',
          peraRata: response.data.peraRata || '',
          grossSalary: response.data.grossSalary ?? '',
          pendingAdministrativeCase: response.data.pendingAdministrativeCase == null
            ? ''
            : String(response.data.pendingAdministrativeCase),
          pendingCriminalCase: response.data.pendingCriminalCase == null
            ? ''
            : String(response.data.pendingCriminalCase),
        }));
      } catch (err) {
        console.error('Failed to fetch user:', err);
        setError('Failed to load user information');
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, []);

  const handleOpenModal = async () => {
    setShowModal(true);
    setLoadingMyCoes(true);
    try {
      const response = await coeAPI.getByStaffId(user?.id);
      setMyCoes(Array.isArray(response) ? response : response.data || []);
    } catch (err) {
      console.error('Error fetching COE requests:', err);
    } finally {
      setLoadingMyCoes(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');

    if (!form.fullName || !form.purpose || !form.dateOfApplication) {
      setError('Full name, purpose, and date of application are required.');
      return;
    }

    if (!agreedToAccuracy) {
      setError('Please confirm that the information you provided is true and correct.');
      return;
    }

    setSubmitting(true);

    try {
      const coeId = `COE${Date.now()}`;
      const payload = {
        coeId,
        staffId: user?.id,
        fullName: form.fullName,
        purpose: form.purpose,
        dateOfApplication: form.dateOfApplication,
        positionTitle: form.positionTitle,
        office: form.office,
        monthlySalary: form.monthlySalary ? Number(form.monthlySalary) : null,
        address: form.address,
        employmentStatus: form.employmentStatus,
        lengthOfService: form.lengthOfService,
        peraRata: form.peraRata,
        grossSalary: form.grossSalary ? Number(form.grossSalary) : null,
        pendingAdministrativeCase: form.pendingAdministrativeCase === ''
          ? null
          : form.pendingAdministrativeCase === 'true',
        pendingCriminalCase: form.pendingCriminalCase === ''
          ? null
          : form.pendingCriminalCase === 'true',
        periodFrom: form.periodFrom || null,
        periodTo: form.periodTo || null,
        numberOfCopies: Number(form.numberOfCopies) || 1,
        remarks: form.remarks || '',
      };

      await coeAPI.create(payload, proofOfPayment);
      setSuccessMessage('COE request submitted successfully! Admin will review and notify you when ready for pickup.');
      setProofOfPayment(null);
      if (proofInputRef.current) proofInputRef.current.value = '';
      
      // Reset form
      setForm({
        fullName: user?.name || '',
        purpose: '',
        dateOfApplication: new Date().toISOString().split('T')[0],
        positionTitle: user?.position || '',
        office: user?.department || '',
        address: user?.address || '',
        employmentStatus: user?.employmentStatus || '',
        lengthOfService: user?.lengthOfService || '',
        monthlySalary: user?.monthlyBasicSalary ?? '',
        peraRata: user?.peraRata || '',
        grossSalary: user?.grossSalary ?? '',
        pendingAdministrativeCase: user?.pendingAdministrativeCase == null
          ? ''
          : String(user.pendingAdministrativeCase),
        pendingCriminalCase: user?.pendingCriminalCase == null
          ? ''
          : String(user.pendingCriminalCase),
        periodFrom: '',
        periodTo: '',
        numberOfCopies: 1,
        remarks: '',
      });
      setAgreedToAccuracy(false);

      // Navigate to My COE Requests after 2 seconds
      setTimeout(() => {
        navigate('/my-coe-requests');
      }, 2000);
    } catch (err) {
      console.error('Error submitting COE request:', err);
      setError(err.response?.data?.message || 'Failed to submit COE request. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-xl mx-auto mt-10 p-6 bg-white rounded-lg shadow">
        <p className="text-gray-600">Loading...</p>
      </div>
    );
  }

  if (successMessage) {
    return (
      <div className="max-w-xl mx-auto mt-10 p-4 sm:p-6 bg-green-50 border border-green-200 rounded-lg shadow">
        <h2 className="text-2xl font-bold mb-4 text-green-700">✓ Request Submitted</h2>
        <p className="text-green-800 mb-4">{successMessage}</p>
        <button
          type="button"
          onClick={() => navigate('/my-coe-requests')}
          className="bg-green-600 text-white px-4 py-2 rounded font-semibold hover:bg-green-700 transition"
        >
          View My Requests
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto mt-10 p-4 sm:p-6 bg-white border border-gray-200 rounded-lg shadow">
      <div className="flex flex-wrap justify-between items-start gap-3 mb-6">
        <div className="min-w-0">
          <h2 className="text-2xl font-bold mb-2 text-blue-700">Request Certificate of Employment (COE)</h2>
          <p className="text-sm text-gray-600">Submit a request for your Certificate of Employment. Admin will review and notify you when ready for pickup at the HR Office.</p>
        </div>
        <button
          type="button"
          onClick={handleOpenModal}
          className="flex items-center gap-2 bg-gray-600 text-white px-4 py-2.5 sm:py-2 rounded-lg hover:bg-gray-700 transition font-semibold text-sm whitespace-nowrap"
        >
          <TbHistory size={18} />
          My Requests
        </button>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="coe-full-name" className="block font-medium mb-1">Full Name *</label>
            <input
              id="coe-full-name"
              type="text"
              name="fullName"
              value={form.fullName}
              onChange={handleChange}
              required
              disabled={submitting}
              className="w-full border rounded px-3 py-2 disabled:bg-gray-100"
            />
          </div>
          <div>
            <label className="block font-medium mb-1">Date of Application *</label>
            <input
              type="date"
              name="dateOfApplication"
              value={form.dateOfApplication}
              onChange={handleChange}
              required
              disabled={submitting}
              className="w-full border rounded px-3 py-2 disabled:bg-gray-100"
            />
          </div>
        </div>

        <div>
          <label className="block font-medium mb-1">Purpose *</label>
          <input
            type="text"
            name="purpose"
            value={form.purpose}
            onChange={handleChange}
            required
            disabled={submitting}
            placeholder="e.g., Loan Application, Immigration, Employment"
            className="w-full border rounded px-3 py-2 disabled:bg-gray-100"
          />
        </div>

        <div>
          <label htmlFor="coe-proof-of-payment" className="block font-medium mb-1">Proof of Payment * (PDF, JPG, or PNG; max 10 MB)</label>
          <input
            id="coe-proof-of-payment"
            ref={proofInputRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
            onChange={(event) => setProofOfPayment(event.target.files?.[0] || null)}
            required
            disabled={submitting}
            className="w-full rounded border px-3 py-2 disabled:bg-gray-100"
          />
          {proofOfPayment && <p className="mt-1 text-sm text-gray-600">Selected: {proofOfPayment.name}</p>}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block font-medium mb-1">Position Title</label>
            <input
              type="text"
              name="positionTitle"
              value={form.positionTitle}
              onChange={handleChange}
              disabled={submitting}
              className="w-full border rounded px-3 py-2 disabled:bg-gray-100"
            />
          </div>
          <div>
            <label className="block font-medium mb-1">Office/Department</label>
            <input
              type="text"
              name="office"
              value={form.office}
              onChange={handleChange}
              disabled={submitting}
              className="w-full border rounded px-3 py-2 disabled:bg-gray-100"
            />
          </div>
        </div>

        <div className="border-t border-gray-200 pt-4">
          <h3 className="mb-1 font-semibold text-gray-800">Certificate Details</h3>
          <p className="mb-3 text-sm text-gray-600">These details will be included in the printed Certificate of Employment.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block font-medium mb-1">Address</label>
              <input
                type="text"
                name="address"
                value={form.address}
                onChange={handleChange}
                disabled={submitting}
                className="w-full border rounded px-3 py-2 disabled:bg-gray-100"
              />
            </div>
            <div>
              <label className="block font-medium mb-1">Status of Employment</label>
              <input
                type="text"
                name="employmentStatus"
                value={form.employmentStatus}
                onChange={handleChange}
                disabled={submitting}
                className="w-full border rounded px-3 py-2 disabled:bg-gray-100"
              />
            </div>
            <div>
              <label className="block font-medium mb-1">Length of Service</label>
              <input
                type="text"
                name="lengthOfService"
                value={form.lengthOfService}
                onChange={handleChange}
                disabled={submitting}
                className="w-full border rounded px-3 py-2 disabled:bg-gray-100"
              />
            </div>
            <div>
              <label className="block font-medium mb-1">Monthly Basic Salary</label>
              <input
                type="number"
                name="monthlySalary"
                value={form.monthlySalary}
                onChange={handleChange}
                disabled={submitting}
                step="0.01"
                className="w-full border rounded px-3 py-2 disabled:bg-gray-100"
              />
            </div>
            <div>
              <label className="block font-medium mb-1">PERA/RATA</label>
              <input
                type="text"
                name="peraRata"
                value={form.peraRata}
                onChange={handleChange}
                disabled={submitting}
                className="w-full border rounded px-3 py-2 disabled:bg-gray-100"
              />
            </div>
            <div>
              <label className="block font-medium mb-1">Gross Salary</label>
              <input
                type="number"
                name="grossSalary"
                value={form.grossSalary}
                onChange={handleChange}
                disabled={submitting}
                step="0.01"
                className="w-full border rounded px-3 py-2 disabled:bg-gray-100"
              />
            </div>
            <div>
              <label className="block font-medium mb-1">Pending Administrative Case</label>
              <select
                name="pendingAdministrativeCase"
                value={form.pendingAdministrativeCase}
                onChange={handleChange}
                disabled={submitting}
                className="w-full border rounded px-3 py-2 bg-white disabled:bg-gray-100"
              >
                <option value="">Select Yes or No</option>
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            </div>
            <div>
              <label className="block font-medium mb-1">Pending Criminal Case</label>
              <select
                name="pendingCriminalCase"
                value={form.pendingCriminalCase}
                onChange={handleChange}
                disabled={submitting}
                className="w-full border rounded px-3 py-2 bg-white disabled:bg-gray-100"
              >
                <option value="">Select Yes or No</option>
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block font-medium mb-1">Period (From)</label>
            <input
              type="date"
              name="periodFrom"
              value={form.periodFrom}
              onChange={handleChange}
              disabled={submitting}
              className="w-full border rounded px-3 py-2 disabled:bg-gray-100"
            />
          </div>
          <div>
            <label className="block font-medium mb-1">Period (To)</label>
            <input
              type="date"
              name="periodTo"
              value={form.periodTo}
              onChange={handleChange}
              disabled={submitting}
              className="w-full border rounded px-3 py-2 disabled:bg-gray-100"
            />
          </div>
        </div>

        <div>
          <label className="block font-medium mb-1">Number of Copies</label>
          <input
            type="number"
            name="numberOfCopies"
            min="1"
            max="10"
            value={form.numberOfCopies}
            onChange={handleChange}
            disabled={submitting}
            className="w-full border rounded px-3 py-2 disabled:bg-gray-100"
          />
        </div>

        <div>
          <label className="block font-medium mb-1">Remarks/Notes</label>
          <textarea
            name="remarks"
            value={form.remarks}
            onChange={handleChange}
            disabled={submitting}
            rows={3}
            className="w-full border rounded px-3 py-2 disabled:bg-gray-100"
            placeholder="Any additional information..."
          />
        </div>

        <label className="flex items-start gap-3 rounded-md border border-blue-200 bg-blue-50 p-4 text-sm text-gray-800">
          <input
            type="checkbox"
            checked={agreedToAccuracy}
            onChange={(event) => {
              setAgreedToAccuracy(event.target.checked);
              if (event.target.checked) setError('');
            }}
            disabled={submitting}
            required
            className="mt-0.5 h-4 w-4 accent-blue-600"
          />
          <span>
            I agree that all information I provided in this COE request is true, correct, and complete.
          </span>
        </label>

        <button
          type="submit"
          disabled={submitting || !agreedToAccuracy}
          className="w-full bg-blue-600 text-white py-2.5 rounded font-semibold hover:bg-blue-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {submitting ? 'Submitting...' : 'Submit COE Request'}
        </button>
      </form>

      {/* Modal for My COE Requests */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div role="dialog" aria-modal="true" aria-labelledby="my-coe-requests-title" className="bg-white rounded-lg shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="bg-blue-600 px-4 sm:px-6 py-4 flex items-center justify-between">
              <h3 id="my-coe-requests-title" className="text-xl font-bold text-white">My COE Requests</h3>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                aria-label="Close"
                className="text-white hover:text-gray-200 text-2xl font-bold min-h-[44px] min-w-[44px]"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6">
              {loadingMyCoes ? (
                <p className="text-gray-600 text-center py-8">Loading your requests...</p>
              ) : myCoes.length === 0 ? (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 text-center">
                  <p className="text-blue-800 font-semibold">No COE requests yet</p>
                  <p className="text-blue-600 text-sm mt-1">Submit your first request using the form above.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {myCoes.map((coe) => (
                    <div key={coe.coeId} className="border border-gray-200 rounded-lg bg-gray-50 overflow-hidden">
                      <div
                        className="p-4 cursor-pointer hover:bg-gray-100 transition flex justify-between items-start"
                        onClick={() => setExpandedCoeId(expandedCoeId === coe.coeId ? null : coe.coeId)}
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                              coe.status === 'Approved' ? 'bg-green-100 text-green-700' :
                              coe.status === 'Disapproved' ? 'bg-red-100 text-red-700' :
                              coe.status === 'For Revision' ? 'bg-yellow-100 text-yellow-700' :
                              'bg-blue-100 text-blue-700'
                            }`}>
                              {coe.status}
                            </span>
                            <span className="text-xs text-gray-600">
                              {new Date(coe.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                          <p className="text-gray-800 font-semibold">{coe.purpose}</p>
                          <p className="text-sm text-gray-600">
                            {coe.numberOfCopies} copy(ies)
                          </p>
                        </div>
                        <span className="text-2xl text-gray-400">{expandedCoeId === coe.coeId ? '−' : '+'}</span>
                      </div>

                      {expandedCoeId === coe.coeId && (
                        <div className="bg-white border-t border-gray-200 p-4">
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
                              className="mb-4 rounded-md bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100"
                            >
                              Download proof of payment: {coe.paymentProof.fileName}
                            </button>
                          )}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm mb-4">
                            <div>
                              <span className="text-gray-600">Full Name:</span>
                              <p className="font-medium text-gray-800">{coe.fullName}</p>
                            </div>
                            <div>
                              <span className="text-gray-600">Position:</span>
                              <p className="font-medium text-gray-800">{coe.positionTitle || 'N/A'}</p>
                            </div>
                            <div>
                              <span className="text-gray-600">Office:</span>
                              <p className="font-medium text-gray-800">{coe.office || 'N/A'}</p>
                            </div>
                            <div>
                              <span className="text-gray-600">Copies:</span>
                              <p className="font-medium text-gray-800">{coe.numberOfCopies}</p>
                            </div>
                          </div>

                          {coe.status === 'Approved' && (
                            <div className="bg-green-50 border border-green-200 rounded p-3 text-sm text-green-800">
                              <strong>✓ Ready for Pickup!</strong>
                              <p className="mt-1">Please collect your Certificate of Employment at the HR Office.</p>
                            </div>
                          )}

                          {coe.status === 'For Revision' && (
                            <div className="bg-yellow-50 border border-yellow-200 rounded p-3 text-sm text-yellow-800">
                              <strong>⚠ Revision Requested</strong>
                              <p className="mt-1">{coe.revisionComment}</p>
                            </div>
                          )}

                          {coe.status === 'Disapproved' && (
                            <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-800">
                              <strong>✕ Request Disapproved</strong>
                              {coe.disapprovalRemarks && <p className="mt-1">{coe.disapprovalRemarks}</p>}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="bg-gray-100 px-4 sm:px-6 py-4 flex flex-wrap justify-between items-center gap-3">
              <button
                type="button"
                onClick={() => navigate('/my-coe-requests')}
                className="px-4 py-2.5 sm:py-2 text-blue-600 font-semibold hover:text-blue-800 transition"
              >
                View Full Details
              </button>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="px-4 py-2.5 sm:py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RequestCOE;
