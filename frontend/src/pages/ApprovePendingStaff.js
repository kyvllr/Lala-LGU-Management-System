import React, { useState, useEffect, useCallback } from 'react';
import { staffAPI } from '../api';

const PROFILE_FIELD_LABELS = {
  name: 'Name',
  email: 'Email',
  position: 'Position',
  department: 'Department',
  phone: 'Phone',
  dateOfBirth: 'Date of Birth',
  sexAtBirth: 'Sex',
  dateHired: 'Date of Employment',
  placeOfBirth: 'Place of Birth',
  tinNumber: 'TIN',
  address: 'Address',
  employmentStatus: 'Employment Status',
  lengthOfService: 'Length of Service',
  monthlyBasicSalary: 'Monthly Basic Salary',
  peraRata: 'PERA/RATA',
  grossSalary: 'Gross Salary',
  pendingAdministrativeCase: 'Pending Administrative Case',
  pendingCriminalCase: 'Pending Criminal Case',
  salaryGrade: 'Salary Grade',
  profilePhotoDataUrl: 'Profile Photo',
};

const formatProfileValue = (field, value) => {
  if (value === null || value === undefined || value === '') return '-';
  if (field === 'profilePhotoDataUrl') return 'Profile photo provided';
  if (field === 'pendingAdministrativeCase' || field === 'pendingCriminalCase') {
    return value ? 'Yes' : 'No';
  }
  if (field === 'dateOfBirth' || field === 'dateHired') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString();
  }
  return String(value);
};

export default function ApprovePendingStaff({ canReviewProfileRequests = false }) {
  const [pendingStaffs, setPendingStaffs] = useState([]);
  const [profileUpdateRequests, setProfileUpdateRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [profileRequestError, setProfileRequestError] = useState('');
  const [approving, setApproving] = useState(null);
  const [disapproving, setDisapproving] = useState(null);
  const [reviewingProfileRequest, setReviewingProfileRequest] = useState(null);
  const [selectedProfileRequestId, setSelectedProfileRequestId] = useState(null);
  const [debugInfo, setDebugInfo] = useState(null);
  const [viewingStaff, setViewingStaff] = useState(null);

  const fetchPendingStaffs = useCallback(async () => {
    try {
      setLoading(true);
      const response = await staffAPI.getPending();
      console.log('Pending staffs response:', response);
      setPendingStaffs(response.data);
      setError('');
    } catch (err) {
      console.error('Error fetching pending staffs:', err);
      setError(err.response?.data?.message || 'Failed to fetch pending staff registrations. Check your admin privileges.');
      
      // Try debug endpoint
      try {
        const debugResponse = await staffAPI.debugGetAll();
        console.log('Debug response:', debugResponse.data);
        setDebugInfo(debugResponse.data);
      } catch (debugErr) {
        console.error('Debug endpoint error:', debugErr);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchProfileUpdateRequests = useCallback(async () => {
    if (!canReviewProfileRequests) return;
    try {
      const response = await staffAPI.getProfileUpdateRequests();
      setProfileUpdateRequests(response.data);
      setProfileRequestError('');
    } catch (err) {
      console.error('Error fetching profile update requests:', err);
      setProfileRequestError(err.response?.data?.message || 'Failed to fetch profile update requests.');
    }
  }, [canReviewProfileRequests]);

  useEffect(() => {
    fetchPendingStaffs();
    fetchProfileUpdateRequests();
    const interval = setInterval(() => {
      fetchPendingStaffs();
      fetchProfileUpdateRequests();
    }, 5000);
    return () => clearInterval(interval);
  }, [fetchPendingStaffs, fetchProfileUpdateRequests]);

  useEffect(() => {
    if (
      selectedProfileRequestId
      && !profileUpdateRequests.some((request) => request.requestId === selectedProfileRequestId)
    ) {
      setSelectedProfileRequestId(profileUpdateRequests[0]?.requestId || null);
    }
  }, [profileUpdateRequests, selectedProfileRequestId]);

  const handleProfileRequestReview = async (requestId, status) => {
    if (status === 'Rejected' && !window.confirm('Are you sure you want to reject this profile update request?')) {
      return;
    }
    try {
      setReviewingProfileRequest(requestId);
      await staffAPI.reviewProfileUpdateRequest(requestId, status);
      setProfileUpdateRequests((requests) => requests.filter((request) => request.requestId !== requestId));
      setProfileRequestError('');
    } catch (err) {
      setProfileRequestError(err.response?.data?.message || `Failed to ${status.toLowerCase()} profile update request.`);
      console.error(`Error reviewing profile update request as ${status}:`, err);
    } finally {
      setReviewingProfileRequest(null);
    }
  };

  const handleApprove = async (staffId) => {
    try {
      setApproving(staffId);
      await staffAPI.approve(staffId);
      setPendingStaffs(pendingStaffs.filter(s => s.id !== staffId));
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to approve staff');
      console.error('Error approving staff:', err);
    } finally {
      setApproving(null);
    }
  };

  const handleDisapprove = async (staffId) => {
    if (!window.confirm('Are you sure you want to disapprove this registration? This action cannot be undone.')) {
      return;
    }
    try {
      setDisapproving(staffId);
      await staffAPI.disapprove(staffId);
      setPendingStaffs(pendingStaffs.filter(s => s.id !== staffId));
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to disapprove staff');
      console.error('Error disapproving staff:', err);
    } finally {
      setDisapproving(null);
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-center">
          <p className="text-gray-600">Loading pending staff registrations...</p>
        </div>
      </div>
    );
  }

  const selectedProfileRequest = profileUpdateRequests.find(
    (request) => request.requestId === selectedProfileRequestId
  );

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">Account Requests</h1>
        <p className="text-1xl text-gray-400">Review and approve or disapprove pending staff registration requests</p>
        <div className="mt-4 text-sm text-gray-500">
          <button
            onClick={() => {
              fetchPendingStaffs();
              fetchProfileUpdateRequests();
            }}
            className="text-blue-600 hover:text-blue-700 font-medium underline"
          >
            Refresh Now
          </button>
          <span className="ml-4">(Auto-refreshes every 5 seconds)</span>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
          {error}
        </div>
      )}

      {debugInfo && (
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded-lg mb-4 text-sm">
          <p className="font-semibold mb-2">Debug Info:</p>
          <p>Total Staff: {debugInfo.total} | Pending: {debugInfo.pending} | Approved: {debugInfo.approved}</p>
          {debugInfo.pending > 0 && (
            <p className="mt-2 text-red-600">
              ⚠️ There are pending registrations in the database, but the main API returned an error. This suggests a permission issue.
            </p>
          )}
        </div>
      )}

      {pendingStaffs.length === 0 ? (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 text-center">
          <p className="text-blue-700">No pending staff registrations at the moment.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gray-200">
                <th scope="col" className="border border-gray-300 px-4 py-2 text-left">Item Number</th>
                <th scope="col" className="border border-gray-300 px-4 py-2 text-left">Name</th>
                <th scope="col" className="border border-gray-300 px-4 py-2 text-left">Email</th>
                <th scope="col" className="border border-gray-300 px-4 py-2 text-left">Position</th>
                <th scope="col" className="border border-gray-300 px-4 py-2 text-left">Department</th>
                <th scope="col" className="border border-gray-300 px-4 py-2 text-left">Registered</th>
                <th scope="col" className="border border-gray-300 px-4 py-2 text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pendingStaffs.map((staff) => (
                <tr key={staff._id} className="hover:bg-gray-50">
                  <td className="border border-gray-300 px-4 py-2 font-medium">{staff.id}</td>
                  <td className="border border-gray-300 px-4 py-2">{staff.name}</td>
                  <td className="border border-gray-300 px-4 py-2">{staff.email}</td>
                  <td className="border border-gray-300 px-4 py-2">{staff.position || '-'}</td>
                  <td className="border border-gray-300 px-4 py-2">{staff.department || '-'}</td>
                  <td className="border border-gray-300 px-4 py-2 text-sm">
                    {new Date(staff.createdAt).toLocaleDateString()}
                  </td>
                  <td className="border border-gray-300 px-4 py-2 text-center space-x-2 whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => setViewingStaff(staff)}
                      className="bg-blue-600 text-white px-3 py-2.5 sm:py-1 rounded hover:bg-blue-700 transition"
                    >
                      View
                    </button>
                    <button
                      onClick={() => handleApprove(staff.id)}
                      disabled={approving === staff.id}
                      className="bg-green-500 text-white px-3 py-2.5 sm:py-1 rounded hover:bg-green-600 transition disabled:opacity-50"
                    >
                      {approving === staff.id ? 'Approving...' : 'Approve'}
                    </button>
                    <button
                      onClick={() => handleDisapprove(staff.id)}
                      disabled={disapproving === staff.id}
                      className="bg-red-500 text-white px-3 py-2.5 sm:py-1 rounded hover:bg-red-600 transition disabled:opacity-50"
                    >
                      {disapproving === staff.id ? 'Disapproving...' : 'Disapprove'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {canReviewProfileRequests && (
        <section className="mt-10">
          <div className="mb-4">
            <h2 className="text-2xl font-bold text-gray-800">Update Account Information Requests</h2>
            <p className="text-sm text-gray-500">Review profile changes submitted by staff before they are applied.</p>
          </div>

          {profileRequestError && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700">
              {profileRequestError}
            </div>
          )}

          {profileUpdateRequests.length === 0 ? (
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-6 text-center">
              <p className="text-blue-700">No pending account information update requests.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(240px,1fr)_minmax(0,2fr)]">
              <nav aria-label="Profile update requests" className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
                <h3 className="border-b border-gray-200 bg-gray-50 px-4 py-3 font-semibold text-gray-800">
                  Requests ({profileUpdateRequests.length})
                </h3>
                <ul className="max-h-[32rem] overflow-y-auto">
                  {profileUpdateRequests.map((request) => {
                    const isSelected = request.requestId === selectedProfileRequestId;
                    return (
                      <li key={request.requestId} className="border-b border-gray-100 last:border-b-0">
                        <div className={`border-l-4 px-4 py-3 transition ${
                          isSelected ? 'border-blue-600 bg-blue-50' : 'border-transparent'
                        }`}>
                          <div className="flex items-center justify-between gap-2">
                            <span className="min-w-0 truncate font-semibold text-gray-900">
                              {request.staffName || 'Staff member'}
                            </span>
                            <button
                              type="button"
                              onClick={() => setSelectedProfileRequestId(request.requestId)}
                              aria-pressed={isSelected}
                              className={`shrink-0 rounded px-3 py-2.5 sm:py-1 text-sm font-medium transition ${
                                isSelected
                                  ? 'bg-blue-100 text-blue-700'
                                  : 'bg-blue-600 text-white hover:bg-blue-700'
                              }`}
                            >
                              View
                            </button>
                          </div>
                          <span className="mt-1 block text-sm text-gray-600">
                            Item Number: {request.staffId}
                          </span>
                          <span className="mt-1 block text-xs text-gray-500">
                            {request.createdAt ? new Date(request.createdAt).toLocaleString() : '-'}
                          </span>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </nav>

              {selectedProfileRequest ? (
                  <article className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
                    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 bg-gray-50 px-4 py-3">
                      <div>
                        <h3 className="font-semibold text-gray-900">{selectedProfileRequest.staffName || 'Staff member'}</h3>
                        <p className="text-sm text-gray-600">
                          Item Number: {selectedProfileRequest.staffId} · {selectedProfileRequest.staffEmail || ''}
                        </p>
                        <p className="text-xs text-gray-500">
                          Submitted {selectedProfileRequest.createdAt ? new Date(selectedProfileRequest.createdAt).toLocaleString() : '-'}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => setSelectedProfileRequestId(null)}
                          className="rounded border border-gray-300 bg-white px-3 py-2.5 sm:py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
                        >
                          Hide
                        </button>
                        <button
                          type="button"
                          onClick={() => handleProfileRequestReview(selectedProfileRequest.requestId, 'Approved')}
                          disabled={reviewingProfileRequest === selectedProfileRequest.requestId}
                          className="rounded bg-green-600 px-3 py-2.5 sm:py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
                        >
                          {reviewingProfileRequest === selectedProfileRequest.requestId ? 'Reviewing...' : 'Approve'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleProfileRequestReview(selectedProfileRequest.requestId, 'Rejected')}
                          disabled={reviewingProfileRequest === selectedProfileRequest.requestId}
                          className="rounded bg-red-600 px-3 py-2.5 sm:py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                        >
                          Reject
                        </button>
                      </div>
                    </header>
                    <div className="overflow-x-auto p-4">
                      <table className="w-full border-collapse text-sm">
                        <thead>
                          <tr className="bg-gray-100 text-left">
                            <th scope="col" className="border border-gray-200 px-3 py-2">Field</th>
                            <th scope="col" className="border border-gray-200 px-3 py-2">Current</th>
                            <th scope="col" className="border border-gray-200 px-3 py-2">Requested</th>
                          </tr>
                        </thead>
                        <tbody>
                          {Object.entries(selectedProfileRequest.requestedFields || {}).map(([field, value]) => (
                            <tr key={field}>
                              <td className="border border-gray-200 px-3 py-2 font-medium">
                                {PROFILE_FIELD_LABELS[field] || field}
                              </td>
                              <td className="border border-gray-200 px-3 py-2">
                                {formatProfileValue(field, selectedProfileRequest.currentFields?.[field])}
                              </td>
                              <td className="border border-gray-200 px-3 py-2">
                                {formatProfileValue(field, value)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </article>
              ) : (
                <div className="rounded-lg border border-gray-200 bg-white p-8 text-center text-gray-500">
                  Select a request to review its details.
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {viewingStaff && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setViewingStaff(null)}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="staff-request-details-title"
            className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <div>
                <h2 id="staff-request-details-title" className="text-xl font-bold text-gray-800">Account Request Details</h2>
                <p className="text-sm text-gray-500">Item Number: {viewingStaff.id || '-'}</p>
              </div>
              <button
                type="button"
                onClick={() => setViewingStaff(null)}
                aria-label="Close account request details"
                className="rounded px-3 py-1 text-gray-600 hover:bg-gray-100 hover:text-gray-900"
              >
                Close
              </button>
            </header>

            <div className="overflow-y-auto p-6">
              <div className="space-y-5">
                <section className="rounded-lg border border-blue-200 bg-blue-50 p-5">
                  <h3 className="mb-3 text-lg font-semibold text-blue-900">Personal Information</h3>
                  <dl className="grid grid-cols-1 gap-x-8 sm:grid-cols-2">
                    <div className="border-b border-blue-200 py-2"><dt className="font-semibold text-blue-700">Name</dt><dd>{viewingStaff.name || '-'}</dd></div>
                    <div className="border-b border-blue-200 py-2"><dt className="font-semibold text-blue-700">Email</dt><dd>{viewingStaff.email || '-'}</dd></div>
                    <div className="border-b border-blue-200 py-2"><dt className="font-semibold text-blue-700">Phone</dt><dd>{viewingStaff.phone || '-'}</dd></div>
                    <div className="border-b border-blue-200 py-2"><dt className="font-semibold text-blue-700">Address</dt><dd>{viewingStaff.address || '-'}</dd></div>
                    <div className="border-b border-blue-200 py-2"><dt className="font-semibold text-blue-700">Date of Birth</dt><dd>{viewingStaff.dateOfBirth ? new Date(viewingStaff.dateOfBirth).toLocaleDateString() : '-'}</dd></div>
                    <div className="border-b border-blue-200 py-2"><dt className="font-semibold text-blue-700">Place of Birth</dt><dd>{viewingStaff.placeOfBirth || '-'}</dd></div>
                    <div className="py-2"><dt className="font-semibold text-blue-700">TIN #</dt><dd>{viewingStaff.tinNumber || '-'}</dd></div>
                  </dl>
                </section>

                <section className="rounded-lg border border-blue-200 bg-blue-50 p-5">
                  <h3 className="mb-3 text-lg font-semibold text-blue-900">Employment Information</h3>
                  <dl className="grid grid-cols-1 gap-x-8 sm:grid-cols-2">
                    <div className="border-b border-blue-200 py-2"><dt className="font-semibold text-blue-700">Role</dt><dd>{viewingStaff.role || '-'}</dd></div>
                    <div className="border-b border-blue-200 py-2"><dt className="font-semibold text-blue-700">Position</dt><dd>{viewingStaff.position || '-'}</dd></div>
                    <div className="border-b border-blue-200 py-2"><dt className="font-semibold text-blue-700">Department</dt><dd>{viewingStaff.department || '-'}</dd></div>
                    <div className="border-b border-blue-200 py-2"><dt className="font-semibold text-blue-700">Status of Employment</dt><dd>{viewingStaff.employmentStatus || '-'}</dd></div>
                    <div className="border-b border-blue-200 py-2"><dt className="font-semibold text-blue-700">Date of Employment</dt><dd>{viewingStaff.dateHired ? new Date(viewingStaff.dateHired).toLocaleDateString() : '-'}</dd></div>
                    <div className="border-b border-blue-200 py-2"><dt className="font-semibold text-blue-700">Length of Service</dt><dd>{viewingStaff.lengthOfService || '-'}</dd></div>
                    <div className="border-b border-blue-200 py-2"><dt className="font-semibold text-blue-700">Salary Grade</dt><dd>{viewingStaff.salaryGrade || '-'}</dd></div>
                    <div className="border-b border-blue-200 py-2"><dt className="font-semibold text-blue-700">Monthly Basic Salary</dt><dd>{viewingStaff.monthlyBasicSalary == null ? '-' : `₱${Number(viewingStaff.monthlyBasicSalary).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}</dd></div>
                    <div className="border-b border-blue-200 py-2"><dt className="font-semibold text-blue-700">PERA/RATA</dt><dd>{viewingStaff.peraRata || '-'}</dd></div>
                    <div className="border-b border-blue-200 py-2"><dt className="font-semibold text-blue-700">Gross Salary</dt><dd>{viewingStaff.grossSalary == null ? '-' : `₱${Number(viewingStaff.grossSalary).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}</dd></div>
                    <div className="border-b border-blue-200 py-2"><dt className="font-semibold text-blue-700">Pending Administrative Case</dt><dd>{viewingStaff.pendingAdministrativeCase == null ? '-' : viewingStaff.pendingAdministrativeCase ? 'Yes' : 'No'}</dd></div>
                    <div className="py-2"><dt className="font-semibold text-blue-700">Pending Criminal Case</dt><dd>{viewingStaff.pendingCriminalCase == null ? '-' : viewingStaff.pendingCriminalCase ? 'Yes' : 'No'}</dd></div>
                  </dl>
                </section>

                <section className="rounded-lg border border-gray-200 bg-gray-50 p-5">
                  <h3 className="mb-3 text-lg font-semibold text-gray-800">Request Information</h3>
                  <dl className="grid grid-cols-1 gap-x-8 sm:grid-cols-2">
                    <div className="border-b border-gray-200 py-2"><dt className="font-semibold text-gray-700">Registered</dt><dd>{viewingStaff.createdAt ? new Date(viewingStaff.createdAt).toLocaleString() : '-'}</dd></div>
                    <div className="py-2"><dt className="font-semibold text-gray-700">Status</dt><dd>{viewingStaff.isApproved ? 'Approved' : 'Pending Approval'}</dd></div>
                  </dl>
                </section>
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
