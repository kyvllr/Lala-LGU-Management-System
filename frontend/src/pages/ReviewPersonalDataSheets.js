import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { personalDataSheetAPI } from '../api';

const normalizeStatus = (value) => String(value || '').trim().toLowerCase();

export default function ReviewPersonalDataSheets() {
  const navigate = useNavigate();
  const [sheets, setSheets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actioningId, setActioningId] = useState('');
  const [selectedSheet, setSelectedSheet] = useState(null);
  const [searchText, setSearchText] = useState('');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');
  const [showRevisionModal, setShowRevisionModal] = useState(false);
  const [revisionRemarks, setRevisionRemarks] = useState('');
  const [revisionTargetPdsId, setRevisionTargetPdsId] = useState('');
  const [permissionActioningId, setPermissionActioningId] = useState('');

  const fetchSheets = async () => {
    try {
      setLoading(true);
      const response = await personalDataSheetAPI.getAll();
      const allSheets = Array.isArray(response.data) ? response.data : [];
      const requestSheets = allSheets.filter((sheet) => normalizeStatus(sheet?.status) !== 'approved');
      setSheets(requestSheets);
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch Personal Data Sheet submissions.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSheets();
  }, []);

  const handleReview = async (pdsId, status, remarks = '') => {
    try {
      setActioningId(`${pdsId}-${status}`);
      await personalDataSheetAPI.review(pdsId, status, remarks);
      await fetchSheets();
      if (selectedSheet?.pdsId === pdsId) {
        setSelectedSheet((prev) => prev ? { ...prev, status, remarks: remarks || prev.remarks } : prev);
      }
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || `Failed to mark PDS as ${status}.`);
    } finally {
      setActioningId('');
    }
  };

  const handleDelete = async (pdsId) => {
    if (!window.confirm('Are you sure you want to delete this Personal Data Sheet?')) return;
    try {
      setActioningId(`${pdsId}-Delete`);
      await api.delete(`/personal-data-sheets/${pdsId}`);
      await fetchSheets();
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || `Failed to delete PDS.`);
    } finally {
      setActioningId('');
    }
  };

  const openRevisionModal = (sheet) => {
    setRevisionTargetPdsId(sheet?.pdsId || '');
    setRevisionRemarks(sheet?.remarks || '');
    setShowRevisionModal(true);
  };

  const closeRevisionModal = () => {
    setShowRevisionModal(false);
    setRevisionTargetPdsId('');
    setRevisionRemarks('');
  };

  const submitRevision = async () => {
    const trimmedRemarks = revisionRemarks.trim();
    if (!trimmedRemarks) {
      setError('Remarks are required when setting a PDS to For Revision.');
      return;
    }

    await handleReview(revisionTargetPdsId, 'For Revision', trimmedRemarks);
    closeRevisionModal();
  };

  const handleEditPds = (sheet) => {
    if (!sheet?.pdsId) return;

    navigate('/submit-personal-data-sheet', {
      state: {
        adminEdit: true,
        pdsId: sheet.pdsId,
        editPds: sheet,
        skipPrefill: true,
      },
    });
  };

  const handleSetUpdatePermission = async (sheet, allowUpdate) => {
    if (!sheet?.pdsId) return;

    try {
      setPermissionActioningId(sheet.pdsId);
      setError('');

      const response = await personalDataSheetAPI.setUpdatePermission(sheet.pdsId, allowUpdate);
      const updatedSheet = response.data?.pds;

      if (updatedSheet) {
        setSelectedSheet((prev) => (prev?.pdsId === updatedSheet.pdsId ? { ...prev, ...updatedSheet } : prev));
      }

      await fetchSheets();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update user permission.');
    } finally {
      setPermissionActioningId('');
    }
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

  const formatCitizenship = (citizenship) => {
    if (!citizenship) return 'N/A';
    if (typeof citizenship === 'string') return citizenship || 'N/A';

    if (citizenship.type === 'Dual Citizenship') {
      const detail = [citizenship.dualCitizenshipMode, citizenship.dualCitizenshipCountry].filter(Boolean).join(', ');
      return detail ? `Dual Citizenship (${detail})` : 'Dual Citizenship';
    }

    return citizenship.type || 'N/A';
  };

  if (loading) {
    return (
      <div className="p-4 sm:p-6">
        <p className="text-blue-700 font-medium">Loading Personal Data Sheet submissions...</p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-blue-950 mb-2">Personal Data Sheet Reviews</h1>
          <p className="text-sm text-blue-700/80">Review submitted Personal Data Sheets from applicants</p>
        </div>
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-blue-100 bg-blue-50/60 px-3 py-2">
          <div className="relative w-full sm:w-auto">
            <svg xmlns="http://www.w3.org/2000/svg" className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M11 18a7 7 0 100-14 7 7 0 000 14z" />
            </svg>
            <input
              type="text"
              placeholder="Search by PDS ID, name, email, mobile..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="border border-blue-200 rounded-md px-3 py-2.5 sm:py-2 w-full sm:w-80 pl-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-500 bg-white"
            />
          </div>
          <label className="text-xs font-semibold tracking-wide text-blue-800 uppercase">From</label>
          <input type="date" value={filterFrom} onChange={(e) => setFilterFrom(e.target.value)} className="border border-blue-200 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-500 bg-white" />
          <label className="text-xs font-semibold tracking-wide text-blue-800 uppercase">To</label>
          <input type="date" value={filterTo} onChange={(e) => setFilterTo(e.target.value)} className="border border-blue-200 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-500 bg-white" />
          <button
            onClick={() => { setSearchText(''); setFilterFrom(''); setFilterTo(''); }}
            className="bg-slate-600 text-white px-3 py-1.5 rounded-md hover:bg-slate-700 transition text-xs font-semibold"
          >
            Clear
          </button>
          
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
          {error}
        </div>
      )}

      {sheets.length === 0 ? (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 text-center text-blue-700">
          No Personal Data Sheet submissions yet.
        </div>
      ) : (
        (() => null)()
      )}
      {/** filtered rendering moved below to avoid inline IIFE complexity */}
      {(() => {
        const filtered = sheets.filter((s) => {
          const created = new Date(s.createdAt);

          if (filterFrom) {
            const from = new Date(filterFrom);
            from.setHours(0, 0, 0, 0);
            if (created < from) return false;
          }

          if (filterTo) {
            const to = new Date(filterTo);
            to.setHours(23, 59, 59, 999);
            if (created > to) return false;
          }

          if (searchText && searchText.trim()) {
            const q = searchText.trim().toLowerCase();
            const hay = [s.pdsId, s.surname, s.firstName, s.middleName, s.email, s.mobile]
              .filter(Boolean)
              .join(' ')
              .toLowerCase();
            if (!hay.includes(q)) return false;
          }

          return true;
        });

        if (filtered.length === 0) {
          return (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center text-yellow-700">
              No results match your search or filters.
            </div>
          );
        }

        return (
          <div className="overflow-x-auto rounded-lg border border-blue-100">
            <table className="w-full border-collapse text-[13px] text-slate-700">
              <thead>
                <tr className="bg-blue-100/80 text-blue-900">
                  <th scope="col" className="border border-blue-200 px-3 py-2 text-left text-xs font-semibold">PDS ID</th>
                  <th scope="col" className="border border-blue-200 px-3 py-2 text-left text-xs font-semibold">Full Name</th>
                  <th scope="col" className="border border-blue-200 px-3 py-2 text-left text-xs font-semibold">Email</th>
                  <th scope="col" className="border border-blue-200 px-3 py-2 text-left text-xs font-semibold">Mobile</th>
                  <th scope="col" className="border border-blue-200 px-3 py-2 text-left text-xs font-semibold">Status</th>
                  <th scope="col" className="border border-blue-200 px-3 py-2 text-left text-xs font-semibold">Submitted</th>
                  <th scope="col" className="border border-blue-200 px-3 py-2 text-center text-xs font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((sheet) => {
                  const fullName = [sheet.surname, sheet.firstName, sheet.middleName, sheet.nameExtension]
                    .filter(Boolean)
                    .join(', ');

                  return (
                    <tr key={sheet._id} className="hover:bg-blue-50/50">
                      <td className="border border-blue-100 px-3 py-1.5 font-medium">{sheet.pdsId}</td>
                      <td className="border border-blue-100 px-3 py-1.5">{fullName}</td>
                      <td className="border border-blue-100 px-3 py-1.5">{sheet.email}</td>
                      <td className="border border-blue-100 px-3 py-1.5">{sheet.mobile}</td>
                      <td className="border border-blue-100 px-3 py-1.5">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold ${
                            sheet.status === 'Approved'
                              ? 'bg-green-100 text-green-700'
                              : sheet.status === 'Disapproved'
                                ? 'bg-red-100 text-red-700'
                                : sheet.status === 'For Revision'
                                  ? 'bg-orange-100 text-orange-700'
                                  : 'bg-yellow-100 text-yellow-700'
                          }`}
                        >
                          {sheet.status || 'Pending'}
                        </span>
                      </td>
                      <td className="border border-blue-100 px-3 py-1.5 text-sm">{new Date(sheet.createdAt).toLocaleDateString()}</td>
                      <td className="border border-blue-100 px-3 py-1.5 text-center space-x-2">
                        <button onClick={() => setSelectedSheet(sheet)} className="bg-blue-500 text-white px-3 py-2 sm:py-1 rounded-md hover:bg-blue-600 transition text-xs font-semibold">View</button>
                        
                        <button onClick={() => handleDelete(sheet.pdsId)} disabled={actioningId === `${sheet.pdsId}-Delete`} className="bg-red-500 text-white px-3 py-2 sm:py-1 rounded-md hover:bg-red-600 transition disabled:opacity-50 text-xs font-semibold">{actioningId === `${sheet.pdsId}-Delete` ? 'Deleting...' : 'Delete'}</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
      })()}

      {selectedSheet && (
        <div className="fixed inset-0 bg-black/45 backdrop-blur-[1px] flex items-center justify-center z-50 p-4">
          <div role="dialog" aria-modal="true" aria-labelledby="pds-review-details-title" className="bg-white rounded-xl border border-blue-100 shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-y-auto p-4 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 id="pds-review-details-title" className="text-2xl font-bold text-blue-950 break-words min-w-0">PDS Details - {selectedSheet.pdsId}</h2>
              <button
                onClick={() => {
                  setSelectedSheet(null);
                  closeRevisionModal();
                }}
                className="text-gray-600 hover:text-gray-800 text-xl p-2 -m-2 leading-none"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="space-y-6 text-sm">
              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-2">Personal Information</h3>
                {selectedSheet.photoDataUrl && (
                  <img
                    src={selectedSheet.photoDataUrl}
                    alt={`${selectedSheet.firstName || 'PDS'} photo`}
                    className="mb-3 h-40 w-32 object-cover border border-gray-300"
                  />
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <p><span className="font-semibold">Name:</span> {[selectedSheet.surname, selectedSheet.firstName, selectedSheet.middleName, selectedSheet.nameExtension].filter(Boolean).join(', ') || 'N/A'}</p>
                  <p><span className="font-semibold">Email:</span> {selectedSheet.email || 'N/A'}</p>
                  <p><span className="font-semibold">Mobile:</span> {selectedSheet.mobile || 'N/A'}</p>
                  <p><span className="font-semibold">Telephone:</span> {selectedSheet.telephone || 'N/A'}</p>
                  <p><span className="font-semibold">Date of Birth:</span> {selectedSheet.dateOfBirth ? new Date(selectedSheet.dateOfBirth).toLocaleDateString() : 'N/A'}</p>
                  <p><span className="font-semibold">Place of Birth:</span> {selectedSheet.placeOfBirth || 'N/A'}</p>
                  <p><span className="font-semibold">Sex:</span> {selectedSheet.sexAtBirth || 'N/A'}</p>
                  <p><span className="font-semibold">Civil Status:</span> {selectedSheet.civilStatus || 'N/A'}</p>
                  <p><span className="font-semibold">Citizenship:</span> {formatCitizenship(selectedSheet.citizenship)}</p>
                  <p><span className="font-semibold">Height (m):</span> {selectedSheet.height || 'N/A'}</p>
                  <p><span className="font-semibold">Weight (kg):</span> {selectedSheet.weight || 'N/A'}</p>
                  <p><span className="font-semibold">Blood Type:</span> {selectedSheet.bloodType || 'N/A'}</p>
                  <p><span className="font-semibold">UMID ID No.:</span> {selectedSheet.gsisNo || 'N/A'}</p>
                  <p><span className="font-semibold">PAG-IBIG ID No.:</span> {selectedSheet.pagibigNo || 'N/A'}</p>
                  <p><span className="font-semibold">PhilHealth No.:</span> {selectedSheet.philhealthNo || 'N/A'}</p>
                  <p><span className="font-semibold">PhilSys Number (PSN):</span> {selectedSheet.sssNo || 'N/A'}</p>
                  <p><span className="font-semibold">TIN No.:</span> {selectedSheet.tinNo || 'N/A'}</p>
                  <p><span className="font-semibold">Agency Employee No.:</span> {selectedSheet.agencyEmployeeNo || 'N/A'}</p>
                  <p><span className="font-semibold">Residential Address:</span> {formatAddress(selectedSheet.residentialAddress)}</p>
                  <p><span className="font-semibold">Permanent Address:</span> {formatAddress(selectedSheet.permanentAddress)}</p>
                </div>
              </div>

              {selectedSheet.jobApplication?.postingId && (
                <div className="border-t border-blue-100 pt-4">
                  <h3 className="mb-2 text-lg font-semibold text-gray-800">Job Portal Application</h3>
                  <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                    <p><span className="font-semibold">Application Status:</span> {selectedSheet.jobApplication.status || 'Pending'}</p>
                    <p><span className="font-semibold">Position Title:</span> {selectedSheet.jobApplication.positionTitle || 'N/A'}</p>
                    <p><span className="font-semibold">Place of Assignment:</span> {selectedSheet.jobApplication.placeOfAssignment || 'N/A'}</p>
                    <p><span className="font-semibold">Plantilla Item Number:</span> {selectedSheet.jobApplication.plantillaItemNumber || 'N/A'}</p>
                    <p><span className="font-semibold">Salary / Job / Pay Grade:</span> {selectedSheet.jobApplication.salaryJobPayGrade || 'N/A'}</p>
                    <p><span className="font-semibold">Monthly Salary:</span> {selectedSheet.jobApplication.monthlySalary || 'N/A'}</p>
                    <p><span className="font-semibold">Eligibility:</span> {Array.isArray(selectedSheet.jobApplication.eligibility) ? selectedSheet.jobApplication.eligibility.join(', ') : (selectedSheet.jobApplication.eligibility || 'N/A')}</p>
                    <p><span className="font-semibold">Education:</span> {selectedSheet.jobApplication.education || 'N/A'}</p>
                    <p><span className="font-semibold">Training:</span> {selectedSheet.jobApplication.training || 'N/A'}</p>
                    <p><span className="font-semibold">Work Experience:</span> {selectedSheet.jobApplication.workExperience || 'N/A'}</p>
                    <p><span className="font-semibold">Competency:</span> {selectedSheet.jobApplication.competency || 'N/A'}</p>
                    <p><span className="font-semibold">Applicant Eligibility:</span> {selectedSheet.jobApplication.applicantQualifications?.eligibility || 'N/A'}</p>
                    <p><span className="font-semibold">Applicant Education:</span> {selectedSheet.jobApplication.applicantQualifications?.education || 'N/A'}</p>
                    <p><span className="font-semibold">Applicant Training:</span> {selectedSheet.jobApplication.applicantQualifications?.trainingChoice || 'N/A'}{selectedSheet.jobApplication.applicantQualifications?.trainingOther ? ` — ${selectedSheet.jobApplication.applicantQualifications.trainingOther}` : ''}</p>
                    <p><span className="font-semibold">Applicant Work Experience:</span> {selectedSheet.jobApplication.applicantQualifications?.workExperienceChoice || 'N/A'}{selectedSheet.jobApplication.applicantQualifications?.workExperienceOther ? ` — ${selectedSheet.jobApplication.applicantQualifications.workExperienceOther}` : ''}</p>
                  </div>
                </div>
              )}

              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-2">Family Background</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-3">
                  <p><span className="font-semibold">Spouse:</span> {[selectedSheet.familyBackground?.spouse?.surname, selectedSheet.familyBackground?.spouse?.firstName, selectedSheet.familyBackground?.spouse?.middleName, selectedSheet.familyBackground?.spouse?.nameExtension].filter(Boolean).join(', ') || 'N/A'}</p>
                  <p><span className="font-semibold">Spouse Occupation:</span> {selectedSheet.familyBackground?.spouse?.occupation || 'N/A'}</p>
                  <p><span className="font-semibold">Spouse Employer:</span> {selectedSheet.familyBackground?.spouse?.employerBusinessName || 'N/A'}</p>
                  <p><span className="font-semibold">Spouse Business Address:</span> {selectedSheet.familyBackground?.spouse?.businessAddress || 'N/A'}</p>
                  <p><span className="font-semibold">Father:</span> {[selectedSheet.familyBackground?.father?.surname, selectedSheet.familyBackground?.father?.firstName, selectedSheet.familyBackground?.father?.middleName, selectedSheet.familyBackground?.father?.nameExtension].filter(Boolean).join(', ') || 'N/A'}</p>
                  <p><span className="font-semibold">Mother:</span> {[selectedSheet.familyBackground?.mother?.surname, selectedSheet.familyBackground?.mother?.firstName, selectedSheet.familyBackground?.mother?.middleName].filter(Boolean).join(', ') || 'N/A'}</p>
                </div>

                <div>
                  <p className="font-semibold mb-1">Children</p>
                  {selectedSheet.familyBackground?.children?.length ? (
                    <ul className="list-disc pl-5 space-y-1">
                      {selectedSheet.familyBackground.children.map((child, index) => (
                        <li key={`${child.name || 'child'}-${index}`}>
                          {child.name || 'N/A'} {child.dateOfBirth ? `(${new Date(child.dateOfBirth).toLocaleDateString()})` : ''}
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
                {selectedSheet.educationalBackground?.length ? (
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="bg-gray-100">
                          <th scope="col" className="border border-gray-300 px-2 py-1 text-left">Level</th>
                          <th scope="col" className="border border-gray-300 px-2 py-1 text-left">School</th>
                          <th scope="col" className="border border-gray-300 px-2 py-1 text-left">Degree/Course</th>
                          <th scope="col" className="border border-gray-300 px-2 py-1 text-left">Period</th>
                          <th scope="col" className="border border-gray-300 px-2 py-1 text-left">Units Earned</th>
                          <th scope="col" className="border border-gray-300 px-2 py-1 text-left">Year Graduated</th>
                          <th scope="col" className="border border-gray-300 px-2 py-1 text-left">Honors</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedSheet.educationalBackground.map((row, index) => (
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
                {selectedSheet.workExperience?.length ? (
                  <ul className="list-disc pl-5 space-y-1">
                    {selectedSheet.workExperience.map((w, i) => (
                      <li key={`work-${i}`}>
                        {w.positionTitle || 'N/A'} at {w.company || 'N/A'} ({w.from || 'N/A'} - {w.to || 'N/A'}) {w.duties ? `- ${w.duties}` : ''}
                        <div className="text-sm text-gray-600">
                          Monthly Salary: {w.monthlySalary || 'N/A'} · Salary / Job / Pay Grade &amp; Step: {w.salaryJobPayGrade || 'N/A'}
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>N/A</p>
                )}
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-2">Voluntary Work</h3>
                {selectedSheet.voluntaryWork?.length ? (
                  <ul className="list-disc pl-5 space-y-1">
                    {selectedSheet.voluntaryWork.map((v, i) => (
                      <li key={`vol-${i}`}>{v.organization || 'N/A'} ({v.from || 'N/A'} - {v.to || 'N/A'}) - {v.hours || 'N/A'} hrs - {v.position || 'N/A'}</li>
                    ))}
                  </ul>
                ) : (
                  <p>N/A</p>
                )}
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-2">Learning and Development</h3>
                {selectedSheet.learningDevelopment?.length ? (
                  <ul className="list-disc pl-5 space-y-1">
                    {selectedSheet.learningDevelopment.map((l, i) => (
                      <li key={`ld-${i}`}>{l.title || 'N/A'} ({l.from || 'N/A'} - {l.to || 'N/A'}) - {l.hours || 'N/A'} hrs - {l.conductedBy || 'N/A'}</li>
                    ))}
                  </ul>
                ) : (
                  <p>N/A</p>
                )}
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-2">Skills, Distinctions, Memberships</h3>
                <p><span className="font-semibold">Hobbies / Special Skills:</span> {selectedSheet.specialSkills?.filter(Boolean).join(', ') || 'N/A'}</p>
                <p><span className="font-semibold">Distinctions:</span> {selectedSheet.distinctions?.filter(Boolean).join(', ') || 'N/A'}</p>
                <p><span className="font-semibold">Memberships:</span> {selectedSheet.memberships?.filter(Boolean).join(', ') || 'N/A'}</p>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-2">Other Declarations</h3>
                <p><span className="font-semibold">Related (3rd degree):</span> {selectedSheet.relatedThirdDegree || 'N/A'}</p>
                <p><span className="font-semibold">Related (4th degree):</span> {selectedSheet.relatedFourthDegree || 'N/A'}</p>
                <p><span className="font-semibold">Related details:</span> {selectedSheet.relatedDetails || 'N/A'}</p>
                <p><span className="font-semibold">Administrative offense:</span> {selectedSheet.adminOffense || 'N/A'} {selectedSheet.adminOffenseDetails ? `- ${selectedSheet.adminOffenseDetails}` : ''}</p>
                <p><span className="font-semibold">Criminal charge:</span> {selectedSheet.criminalCharge || 'N/A'} {selectedSheet.criminalChargeDetails ? `- ${selectedSheet.criminalChargeDetails}` : ''} {selectedSheet.criminalChargeDateFiled ? `(${new Date(selectedSheet.criminalChargeDateFiled).toLocaleDateString()})` : ''} {selectedSheet.criminalChargeStatus ? `- ${selectedSheet.criminalChargeStatus}` : ''}</p>
                <p><span className="font-semibold">Convicted:</span> {selectedSheet.convicted || 'N/A'} {selectedSheet.convictedDetails ? `- ${selectedSheet.convictedDetails}` : ''}</p>
                <p><span className="font-semibold">Separated:</span> {selectedSheet.separated || 'N/A'} {selectedSheet.separatedDetails ? `- ${selectedSheet.separatedDetails}` : ''}</p>
                <p><span className="font-semibold">Candidate:</span> {selectedSheet.candidate || 'N/A'} {selectedSheet.candidateDetails ? `- ${selectedSheet.candidateDetails}` : ''}</p>
                <p><span className="font-semibold">Resigned to campaign:</span> {selectedSheet.resignedToCampaign || 'N/A'} {selectedSheet.resignedDetails ? `- ${selectedSheet.resignedDetails}` : ''}</p>
                <p><span className="font-semibold">Immigrant:</span> {selectedSheet.immigrant || 'N/A'} {selectedSheet.immigrantCountry ? `- ${selectedSheet.immigrantCountry}` : ''}</p>
                <p><span className="font-semibold">Indigenous:</span> {selectedSheet.indigenous || 'N/A'} {selectedSheet.indigenousDetails ? `- ${selectedSheet.indigenousDetails}` : ''}</p>
                <p><span className="font-semibold">PWD:</span> {selectedSheet.pwd || 'N/A'} {selectedSheet.pwdId ? `- ${selectedSheet.pwdId}` : ''}</p>
                <p><span className="font-semibold">Solo Parent:</span> {selectedSheet.soloParent || 'N/A'} {selectedSheet.soloParentId ? `- ${selectedSheet.soloParentId}` : ''}</p>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-2">References</h3>
                {selectedSheet.references?.length ? (
                  <ul className="list-disc pl-5 space-y-1">
                    {selectedSheet.references.map((r, i) => (
                      <li key={`ref-${i}`}>{r.name || 'N/A'} - {r.address || 'N/A'} - {r.contact || 'N/A'}</li>
                    ))}
                  </ul>
                ) : (
                  <p>N/A</p>
                )}
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-2">Government ID</h3>
                <p>{selectedSheet.govId?.idType || 'N/A'} {selectedSheet.govId?.number ? `- ${selectedSheet.govId.number}` : ''} {selectedSheet.govId?.datePlace ? `- ${selectedSheet.govId.datePlace}` : ''}</p>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleEditPds(selectedSheet)}
                    className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 transition text-sm font-semibold"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleReview(selectedSheet.pdsId, 'Approved')}
                    disabled={selectedSheet.status === 'Approved' || actioningId === `${selectedSheet.pdsId}-Approved`}
                    className="bg-green-500 text-white px-4 py-2 rounded-md hover:bg-green-600 transition disabled:opacity-50 text-sm font-semibold"
                  >
                    {actioningId === `${selectedSheet.pdsId}-Approved` ? 'Approving...' : 'Approve'}
                  </button>
                  <button
                    onClick={() => handleReview(selectedSheet.pdsId, 'Disapproved', 'Disapproved by admin during review.')}
                    disabled={selectedSheet.status === 'Disapproved' || actioningId === `${selectedSheet.pdsId}-Disapproved`}
                    className="bg-red-500 text-white px-4 py-2 rounded-md hover:bg-red-600 transition disabled:opacity-50 text-sm font-semibold"
                  >
                    {actioningId === `${selectedSheet.pdsId}-Disapproved` ? 'Disapproving...' : 'Disapprove'}
                  </button>
                  <button
                    onClick={() => openRevisionModal(selectedSheet)}
                    disabled={selectedSheet.status === 'For Revision' || actioningId === `${selectedSheet.pdsId}-For Revision`}
                    className="bg-orange-500 text-white px-4 py-2 rounded-md hover:bg-orange-600 transition disabled:opacity-50 text-sm font-semibold"
                  >
                    {actioningId === `${selectedSheet.pdsId}-For Revision` ? 'Sending...' : 'Revision'}
                  </button>
                  {normalizeStatus(selectedSheet.status) === 'approved' && (
                    <button
                      onClick={() => handleSetUpdatePermission(selectedSheet, !Boolean(selectedSheet.updatePermissionGranted))}
                      disabled={permissionActioningId === selectedSheet.pdsId}
                      className={`text-white px-4 py-2 rounded-md transition disabled:opacity-50 text-sm font-semibold ${selectedSheet.updatePermissionGranted ? 'bg-red-600 hover:bg-red-700' : 'bg-indigo-600 hover:bg-indigo-700'}`}
                    >
                      {permissionActioningId === selectedSheet.pdsId
                        ? 'Saving...'
                        : (selectedSheet.updatePermissionGranted ? 'Revoke Update Permission' : 'Allow User to Update')}
                    </button>
                  )}
                </div>
              <button
                onClick={() => {
                  setSelectedSheet(null);
                  closeRevisionModal();
                }}
                className="bg-slate-200 text-slate-800 px-4 py-2 rounded-md hover:bg-slate-300 transition text-sm font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {showRevisionModal && (
        <div className="fixed inset-0 bg-black/45 backdrop-blur-[1px] flex items-center justify-center z-[60] p-4">
          <div role="dialog" aria-modal="true" aria-labelledby="pds-revision-remarks-title" className="bg-white rounded-xl border border-blue-100 shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto p-4 sm:p-6">
            <h3 id="pds-revision-remarks-title" className="text-xl font-bold text-blue-950 mb-3">Revision Remarks</h3>
            <p className="text-sm text-blue-700/80 mb-3">
              Add remarks for this PDS so the staff knows what to update before resubmitting.
            </p>

            <textarea
              value={revisionRemarks}
              onChange={(e) => setRevisionRemarks(e.target.value)}
              rows={6}
              className="w-full border border-blue-200 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-300"
              placeholder="Enter revision remarks..."
            />

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeRevisionModal}
                className="bg-slate-200 text-slate-800 px-4 py-2 rounded-md hover:bg-slate-300 transition text-sm font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitRevision}
                disabled={!revisionTargetPdsId || actioningId === `${revisionTargetPdsId}-For Revision`}
                className="bg-orange-500 text-white px-4 py-2 rounded-md hover:bg-orange-600 transition disabled:opacity-50 text-sm font-semibold"
              >
                {actioningId === `${revisionTargetPdsId}-For Revision` ? 'Sending...' : 'Send for Revision'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
