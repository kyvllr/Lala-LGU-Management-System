import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { personalDataSheetAPI } from '../api';
import ReviewPersonalDataSheets from './ReviewPersonalDataSheets';
import PDSRecordTab from './PDSRecordTab';
import { isDepartmentStaffManager, normalizeRole } from '../constants';

export default function PDSHub() {
  const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
  const canViewPdsRequests = isDepartmentStaffManager(normalizeRole(storedUser?.role));
  const [activeTab, setActiveTab] = useState('my');
  const [myPds, setMyPds] = useState({
    latestSubmission: null,
    approvedPds: null,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const location = useLocation();
  const navigate = useNavigate();

  const normalizeText = (value) => String(value || '').trim().toLowerCase();
  const hasActiveUpdatePermission = (record) => {
    if (!record?.updatePermissionGranted) return false;
    if (!record?.updatePermissionExpiresAt) return true;

    const expiresAt = new Date(record.updatePermissionExpiresAt);
    if (Number.isNaN(expiresAt.getTime())) return false;
    return expiresAt.getTime() > Date.now();
  };
  const normalizedLatestStatus = normalizeText(myPds.latestSubmission?.status);
  const hasKnownLatestStatus = ['pending', 'for revision', 'disapproved', 'approved'].includes(normalizedLatestStatus);
  const hasApprovedPds = Boolean(myPds.approvedPds);
  const hasPdsRecord = Boolean(myPds.approvedPds || myPds.latestSubmission);
  const approvedUpdateAllowed = hasApprovedPds ? hasActiveUpdatePermission(myPds.approvedPds) : true;
  const canOpenPdsForm = !hasApprovedPds || approvedUpdateAllowed;
  const openPdsFormState = hasApprovedPds && approvedUpdateAllowed && myPds.approvedPds?.pdsId
    ? {
        prefill: true,
        userEdit: true,
        pdsId: myPds.approvedPds.pdsId,
        editPds: myPds.approvedPds,
      }
    : (hasPdsRecord ? { prefill: true } : undefined);

  const isOwnedMyPdsRecord = (record) => {
    if (!record) return false;

    const currentEmail = normalizeText(storedUser?.email);
    const ownerEmail = normalizeText(record.ownerEmail);
    const subjectEmail = normalizeText(record.email);

    return (
      (Boolean(currentEmail) && ownerEmail === currentEmail) ||
      (Boolean(currentEmail) && subjectEmail === currentEmail)
    );
  };

  const loadMyPds = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await personalDataSheetAPI.getMy();
      const latestSubmission = res.data?.latestSubmission || null;
      const approvedPds = res.data?.approvedPds || null;

      const ownedLatestSubmission = isOwnedMyPdsRecord(latestSubmission) ? latestSubmission : null;
      const ownedApprovedPds = isOwnedMyPdsRecord(approvedPds) ? approvedPds : null;
      const normalizedLatestSubmissionStatus = normalizeText(ownedLatestSubmission?.status);

      setMyPds({
        latestSubmission: ownedLatestSubmission,
        approvedPds: ownedApprovedPds || (normalizedLatestSubmissionStatus === 'approved' ? ownedLatestSubmission : null),
      });
    } catch (err) {
      const isNetworkError = err.code === 'ERR_NETWORK' || !err.response;
      setError(
        isNetworkError
          ? 'Cannot connect to the server right now. Please make sure the backend is running.'
          : (err.response?.data?.message || 'Unable to load your PDS information right now.')
      );
      setMyPds({ latestSubmission: null, approvedPds: null });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMyPds();
  }, []);

  useEffect(() => {
    if (!canViewPdsRequests) return;
    if (location.state?.openTab === 'records') {
      setActiveTab('records');
    }
  }, [canViewPdsRequests, location.state]);

  const formatDate = (value) => {
    if (!value) return 'N/A';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 'N/A' : date.toLocaleDateString();
  };

  const formatAddress = (address) => {
    if (!address) return 'N/A';
    if (typeof address === 'string') return address || 'N/A';

    const parts = [
      address.houseBlockLotNo,
      address.street,
      address.subdivisionVillage,
      address.barangay,
      address.cityMunicipality,
      address.province,
      address.zipCode ? `ZIP ${address.zipCode}` : '',
    ].filter(Boolean);

    return parts.length ? parts.join(', ') : 'N/A';
  };

  const formatName = (parts = []) => {
    const normalized = parts.filter(Boolean);
    return normalized.length ? normalized.join(', ') : 'N/A';
  };

  return (
    <div className="w-full mx-auto">
      <h1 className="text-3xl font-bold text-gray-800 mb-6">PDS</h1>

      <div className="mb-6 border-b border-gray-200">
        <nav className="flex flex-wrap gap-2 pb-3" aria-label="PDS tabs">
          <button
            type="button"
            onClick={() => {
              setActiveTab('my');
              loadMyPds();
            }}
            className={`px-4 py-2 rounded-md text-sm font-semibold transition ${
              activeTab === 'my'
                ? 'bg-blue-600 text-white shadow'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            My PDS
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('submit')}
            className={`px-4 py-2 rounded-md text-sm font-semibold transition ${
              activeTab === 'submit'
                ? 'bg-blue-600 text-white shadow'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Submit PDS
          </button>
          {canViewPdsRequests && (
            <button
              type="button"
              onClick={() => setActiveTab('records')}
              className={`px-4 py-2 rounded-md text-sm font-semibold transition ${
                activeTab === 'records'
                  ? 'bg-blue-600 text-white shadow'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              PDS Record
            </button>
          )}
          {canViewPdsRequests && (
            <button
              type="button"
              onClick={() => setActiveTab('requests')}
              className={`px-4 py-2 rounded-md text-sm font-semibold transition ${
                activeTab === 'requests'
                  ? 'bg-blue-600 text-white shadow'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              PDS Requests
            </button>
          )}
        </nav>
      </div>

      {activeTab === 'my' && (
        <div className="bg-white rounded-lg shadow-md p-6 space-y-4">
          {!loading && !error && hasPdsRecord && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => {
                  if (!canOpenPdsForm) return;
                  navigate('/submit-personal-data-sheet', openPdsFormState ? { state: openPdsFormState } : undefined);
                }}
                disabled={!canOpenPdsForm}
                className="bg-emerald-600 text-white px-4 py-2 rounded hover:bg-emerald-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {canOpenPdsForm ? 'Update PDS' : 'Update Locked'}
              </button>
            </div>
          )}

          {loading && <p className="text-gray-600">Loading your PDS details...</p>}

          {!loading && error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          {!loading && !error && !myPds.approvedPds && myPds.latestSubmission?.status === 'Pending' && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-yellow-800">
              Your latest PDS submission is pending admin approval.
            </div>
          )}

          {!loading && !error && !myPds.approvedPds && myPds.latestSubmission?.status === 'For Revision' && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 text-orange-800 space-y-2">
              <p>Your latest PDS was returned for revision.</p>
              {myPds.latestSubmission?.remarks && (
                <p><span className="font-semibold">Admin Remarks:</span> {myPds.latestSubmission.remarks}</p>
              )}
            </div>
          )}

          {!loading && !error && !myPds.approvedPds && myPds.latestSubmission?.status === 'Disapproved' && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 space-y-2">
              <p>Your latest PDS was disapproved.</p>
              {myPds.latestSubmission?.remarks && (
                <p><span className="font-semibold">Admin Remarks:</span> {myPds.latestSubmission.remarks}</p>
              )}
            </div>
          )}

          {!loading && !error && !myPds.approvedPds && myPds.latestSubmission && !hasKnownLatestStatus && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-blue-700 space-y-2">
              <p>Your latest PDS status is: <span className="font-semibold">{myPds.latestSubmission?.status || 'Unknown'}</span>.</p>
              <p>Your submission is on record. If this status persists, please contact Admin/HR to review it.</p>
            </div>
          )}

          {!loading && !error && !myPds.approvedPds && !myPds.latestSubmission && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-blue-700">
              You have not submitted a Personal Data Sheet yet.
            </div>
          )}

          {!loading && !error && myPds.approvedPds && (
            <>
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-green-700">
                Approved by {myPds.approvedPds.reviewedBy || 'Admin'} on {myPds.approvedPds.reviewedAt ? new Date(myPds.approvedPds.reviewedAt).toLocaleDateString() : 'N/A'}.
              </div>

              {!approvedUpdateAllowed && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-yellow-800">
                  Your approved PDS is locked for updates. Please ask Admin/HR to open your record and allow update permission.
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-500 mb-1">PDS ID</p>
                  <p className="text-base font-semibold text-gray-800">{myPds.approvedPds.pdsId || '-'}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-500 mb-1">Status</p>
                  <p className="text-base font-semibold text-gray-800">{myPds.approvedPds.status || '-'}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-500 mb-1">Full Name</p>
                  <p className="text-base font-semibold text-gray-800">
                    {[myPds.approvedPds.surname, myPds.approvedPds.firstName, myPds.approvedPds.middleName, myPds.approvedPds.nameExtension].filter(Boolean).join(', ') || '-'}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-500 mb-1">Date of Birth</p>
                  <p className="text-base font-semibold text-gray-800">
                    {myPds.approvedPds.dateOfBirth ? new Date(myPds.approvedPds.dateOfBirth).toLocaleDateString() : '-'}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-500 mb-1">Email</p>
                  <p className="text-base font-semibold text-gray-800">{myPds.approvedPds.email || '-'}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-500 mb-1">Mobile</p>
                  <p className="text-base font-semibold text-gray-800">{myPds.approvedPds.mobile || '-'}</p>
                </div>
              </div>

              <div className="pt-2 border-t border-gray-200 space-y-6 text-sm text-gray-800">
                <div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-2">Personal Information</h3>
                  {myPds.approvedPds.photoDataUrl && (
                    <img
                      src={myPds.approvedPds.photoDataUrl}
                      alt={`${myPds.approvedPds.firstName || 'PDS'} photo`}
                      className="mb-3 h-40 w-32 object-cover border border-gray-300"
                    />
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <p><span className="font-semibold">Name:</span> {formatName([myPds.approvedPds.surname, myPds.approvedPds.firstName, myPds.approvedPds.middleName, myPds.approvedPds.nameExtension])}</p>
                    <p><span className="font-semibold">Email:</span> {myPds.approvedPds.email || 'N/A'}</p>
                    <p><span className="font-semibold">Mobile:</span> {myPds.approvedPds.mobile || 'N/A'}</p>
                    <p><span className="font-semibold">Telephone:</span> {myPds.approvedPds.telephone || 'N/A'}</p>
                    <p><span className="font-semibold">Date of Birth:</span> {formatDate(myPds.approvedPds.dateOfBirth)}</p>
                    <p><span className="font-semibold">Place of Birth:</span> {myPds.approvedPds.placeOfBirth || 'N/A'}</p>
                    <p><span className="font-semibold">Sex:</span> {myPds.approvedPds.sexAtBirth || 'N/A'}</p>
                    <p><span className="font-semibold">Civil Status:</span> {myPds.approvedPds.civilStatus || 'N/A'}</p>
                    <p><span className="font-semibold">Citizenship:</span> {myPds.approvedPds.citizenship?.type || 'N/A'}</p>
                    <p><span className="font-semibold">Height (m):</span> {myPds.approvedPds.height || 'N/A'}</p>
                    <p><span className="font-semibold">Weight (kg):</span> {myPds.approvedPds.weight || 'N/A'}</p>
                    <p><span className="font-semibold">Blood Type:</span> {myPds.approvedPds.bloodType || 'N/A'}</p>
                    <p><span className="font-semibold">UMID ID No.:</span> {myPds.approvedPds.gsisNo || 'N/A'}</p>
                    <p><span className="font-semibold">PAG-IBIG ID No.:</span> {myPds.approvedPds.pagibigNo || 'N/A'}</p>
                    <p><span className="font-semibold">PhilHealth No.:</span> {myPds.approvedPds.philhealthNo || 'N/A'}</p>
                    <p><span className="font-semibold">PhilSys Number (PSN):</span> {myPds.approvedPds.sssNo || 'N/A'}</p>
                    <p><span className="font-semibold">TIN No.:</span> {myPds.approvedPds.tinNo || 'N/A'}</p>
                    <p><span className="font-semibold">Agency Employee No.:</span> {myPds.approvedPds.agencyEmployeeNo || 'N/A'}</p>
                    <p><span className="font-semibold">Residential Address:</span> {formatAddress(myPds.approvedPds.residentialAddress)}</p>
                    <p><span className="font-semibold">Permanent Address:</span> {formatAddress(myPds.approvedPds.permanentAddress)}</p>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-2">Family Background</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-3">
                    <p><span className="font-semibold">Spouse:</span> {formatName([myPds.approvedPds.familyBackground?.spouse?.surname, myPds.approvedPds.familyBackground?.spouse?.firstName, myPds.approvedPds.familyBackground?.spouse?.middleName, myPds.approvedPds.familyBackground?.spouse?.nameExtension])}</p>
                    <p><span className="font-semibold">Spouse Occupation:</span> {myPds.approvedPds.familyBackground?.spouse?.occupation || 'N/A'}</p>
                    <p><span className="font-semibold">Spouse Employer:</span> {myPds.approvedPds.familyBackground?.spouse?.employerBusinessName || 'N/A'}</p>
                    <p><span className="font-semibold">Spouse Business Address:</span> {myPds.approvedPds.familyBackground?.spouse?.businessAddress || 'N/A'}</p>
                    <p><span className="font-semibold">Father:</span> {formatName([myPds.approvedPds.familyBackground?.father?.surname, myPds.approvedPds.familyBackground?.father?.firstName, myPds.approvedPds.familyBackground?.father?.middleName, myPds.approvedPds.familyBackground?.father?.nameExtension])}</p>
                    <p><span className="font-semibold">Mother:</span> {formatName([myPds.approvedPds.familyBackground?.mother?.surname, myPds.approvedPds.familyBackground?.mother?.firstName, myPds.approvedPds.familyBackground?.mother?.middleName])}</p>
                  </div>

                  <div>
                    <p className="font-semibold mb-1">Children</p>
                    {myPds.approvedPds.familyBackground?.children?.length ? (
                      <ul className="list-disc pl-5 space-y-1">
                        {myPds.approvedPds.familyBackground.children.map((child, index) => (
                          <li key={`${child.name || 'child'}-${index}`}>
                            {child.name || 'N/A'} {child.dateOfBirth ? `(${formatDate(child.dateOfBirth)})` : ''}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p>N/A</p>
                    )}
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-2">Educational Background</h3>
                  {myPds.approvedPds.educationalBackground?.length ? (
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse">
                        <thead>
                          <tr className="bg-gray-100">
                            <th className="border border-gray-300 px-2 py-1 text-left">Level</th>
                            <th className="border border-gray-300 px-2 py-1 text-left">School</th>
                            <th className="border border-gray-300 px-2 py-1 text-left">Degree/Course</th>
                            <th className="border border-gray-300 px-2 py-1 text-left">Period</th>
                            <th className="border border-gray-300 px-2 py-1 text-left">Units Earned</th>
                            <th className="border border-gray-300 px-2 py-1 text-left">Year Graduated</th>
                            <th className="border border-gray-300 px-2 py-1 text-left">Honors</th>
                          </tr>
                        </thead>
                        <tbody>
                          {myPds.approvedPds.educationalBackground.map((row, index) => (
                            <tr key={`${row.level || 'level'}-${index}`}>
                              <td className="border border-gray-300 px-2 py-1">{row.level || 'N/A'}</td>
                              <td className="border border-gray-300 px-2 py-1">{row.schoolName || 'N/A'}</td>
                              <td className="border border-gray-300 px-2 py-1">{row.basicEducationDegreeCourse || 'N/A'}</td>
                              <td className="border border-gray-300 px-2 py-1">{[row.periodFrom, row.periodTo].filter(Boolean).join(' - ') || 'N/A'}</td>
                              <td className="border border-gray-300 px-2 py-1">{row.highestLevelUnitsEarned || 'N/A'}</td>
                              <td className="border border-gray-300 px-2 py-1">{row.yearGraduated || 'N/A'}</td>
                              <td className="border border-gray-300 px-2 py-1">{row.scholarshipAcademicHonorsReceived || 'N/A'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p>N/A</p>
                  )}
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-2">Work Experience</h3>
                  {myPds.approvedPds.workExperience?.length ? (
                    <ul className="list-disc pl-5 space-y-1">
                      {myPds.approvedPds.workExperience.map((item, index) => (
                        <li key={`work-${index}`}>
                          {item.positionTitle || 'N/A'} at {item.company || 'N/A'} ({item.from || 'N/A'} - {item.to || 'N/A'}) {item.duties ? `- ${item.duties}` : ''}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p>N/A</p>
                  )}
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-2">Voluntary Work</h3>
                  {myPds.approvedPds.voluntaryWork?.length ? (
                    <ul className="list-disc pl-5 space-y-1">
                      {myPds.approvedPds.voluntaryWork.map((item, index) => (
                        <li key={`vol-${index}`}>
                          {item.organization || 'N/A'} ({item.from || 'N/A'} - {item.to || 'N/A'}) - {item.hours || 'N/A'} hrs - {item.position || 'N/A'}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p>N/A</p>
                  )}
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-2">Learning and Development</h3>
                  {myPds.approvedPds.learningDevelopment?.length ? (
                    <ul className="list-disc pl-5 space-y-1">
                      {myPds.approvedPds.learningDevelopment.map((item, index) => (
                        <li key={`learn-${index}`}>
                          {item.title || 'N/A'} ({item.from || 'N/A'} - {item.to || 'N/A'}) - {item.hours || 'N/A'} hrs - {item.conductedBy || 'N/A'}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p>N/A</p>
                  )}
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-2">Skills, Distinctions, Memberships</h3>
                  <p><span className="font-semibold">Hobbies / Special Skills:</span> {myPds.approvedPds.specialSkills?.filter(Boolean).join(', ') || 'N/A'}</p>
                  <p><span className="font-semibold">Distinctions:</span> {myPds.approvedPds.distinctions?.filter(Boolean).join(', ') || 'N/A'}</p>
                  <p><span className="font-semibold">Memberships:</span> {myPds.approvedPds.memberships?.filter(Boolean).join(', ') || 'N/A'}</p>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-2">Other Declarations</h3>
                  <p><span className="font-semibold">Related (3rd degree):</span> {myPds.approvedPds.relatedThirdDegree || 'N/A'}</p>
                  <p><span className="font-semibold">Related (4th degree):</span> {myPds.approvedPds.relatedFourthDegree || 'N/A'}</p>
                  <p><span className="font-semibold">Related details:</span> {myPds.approvedPds.relatedDetails || 'N/A'}</p>
                  <p><span className="font-semibold">Administrative offense:</span> {myPds.approvedPds.adminOffense || 'N/A'} {myPds.approvedPds.adminOffenseDetails ? `- ${myPds.approvedPds.adminOffenseDetails}` : ''}</p>
                  <p><span className="font-semibold">Criminal charge:</span> {myPds.approvedPds.criminalCharge || 'N/A'} {myPds.approvedPds.criminalChargeDetails ? `- ${myPds.approvedPds.criminalChargeDetails}` : ''} {myPds.approvedPds.criminalChargeDateFiled ? `(${formatDate(myPds.approvedPds.criminalChargeDateFiled)})` : ''} {myPds.approvedPds.criminalChargeStatus ? `- ${myPds.approvedPds.criminalChargeStatus}` : ''}</p>
                  <p><span className="font-semibold">Convicted:</span> {myPds.approvedPds.convicted || 'N/A'} {myPds.approvedPds.convictedDetails ? `- ${myPds.approvedPds.convictedDetails}` : ''}</p>
                  <p><span className="font-semibold">Separated:</span> {myPds.approvedPds.separated || 'N/A'} {myPds.approvedPds.separatedDetails ? `- ${myPds.approvedPds.separatedDetails}` : ''}</p>
                  <p><span className="font-semibold">Candidate:</span> {myPds.approvedPds.candidate || 'N/A'} {myPds.approvedPds.candidateDetails ? `- ${myPds.approvedPds.candidateDetails}` : ''}</p>
                  <p><span className="font-semibold">Resigned to campaign:</span> {myPds.approvedPds.resignedToCampaign || 'N/A'} {myPds.approvedPds.resignedDetails ? `- ${myPds.approvedPds.resignedDetails}` : ''}</p>
                  <p><span className="font-semibold">Immigrant:</span> {myPds.approvedPds.immigrant || 'N/A'} {myPds.approvedPds.immigrantCountry ? `- ${myPds.approvedPds.immigrantCountry}` : ''}</p>
                  <p><span className="font-semibold">Indigenous:</span> {myPds.approvedPds.indigenous || 'N/A'} {myPds.approvedPds.indigenousDetails ? `- ${myPds.approvedPds.indigenousDetails}` : ''}</p>
                  <p><span className="font-semibold">PWD:</span> {myPds.approvedPds.pwd || 'N/A'} {myPds.approvedPds.pwdId ? `- ${myPds.approvedPds.pwdId}` : ''}</p>
                  <p><span className="font-semibold">Solo Parent:</span> {myPds.approvedPds.soloParent || 'N/A'} {myPds.approvedPds.soloParentId ? `- ${myPds.approvedPds.soloParentId}` : ''}</p>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-2">References</h3>
                  {myPds.approvedPds.references?.length ? (
                    <ul className="list-disc pl-5 space-y-1">
                      {myPds.approvedPds.references.map((item, index) => (
                        <li key={`ref-${index}`}>{item.name || 'N/A'} - {item.address || 'N/A'} - {item.contact || 'N/A'}</li>
                      ))}
                    </ul>
                  ) : (
                    <p>N/A</p>
                  )}
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-2">Government ID</h3>
                  <p>{myPds.approvedPds.govId?.idType || 'N/A'} {myPds.approvedPds.govId?.number ? `- ${myPds.approvedPds.govId.number}` : ''} {myPds.approvedPds.govId?.datePlace ? `- ${myPds.approvedPds.govId.datePlace}` : ''}</p>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {activeTab === 'submit' && (
        <div className="bg-white rounded-lg shadow-md p-6 space-y-4">
          <h2 className="text-xl font-bold text-gray-800">Submit PDS</h2>
          <p className="text-gray-600">Open the Personal Data Sheet form and submit your latest details for admin review.</p>
          {hasApprovedPds && !approvedUpdateAllowed && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-yellow-800 text-sm">
              Your approved PDS is currently locked. Admin/HR must grant update permission before you can submit changes.
            </div>
          )}
          <button
            type="button"
            onClick={() => {
              if (!canOpenPdsForm) return;
              navigate(
                '/submit-personal-data-sheet',
                openPdsFormState ? { state: openPdsFormState } : undefined
              );
            }}
            disabled={!canOpenPdsForm}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Open Submit PDS Form
          </button>
        </div>
      )}

      {canViewPdsRequests && activeTab === 'requests' && (
        <div className="bg-white rounded-lg shadow-md">
          <ReviewPersonalDataSheets />
        </div>
      )}

      {canViewPdsRequests && activeTab === 'records' && (
        <PDSRecordTab />
      )}
    </div>
  );
}
