import React, { useEffect, useState } from 'react';
import { personalDataSheetAPI } from '../api';

export default function ReviewPersonalDataSheets() {
  const [sheets, setSheets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actioningId, setActioningId] = useState('');
  const [selectedSheet, setSelectedSheet] = useState(null);

  const fetchSheets = async () => {
    try {
      setLoading(true);
      const response = await personalDataSheetAPI.getAll();
      setSheets(response.data);
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

  const handleReview = async (pdsId, status) => {
    try {
      setActioningId(`${pdsId}-${status}`);
      await personalDataSheetAPI.review(pdsId, status);
      await fetchSheets();
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || `Failed to mark PDS as ${status}.`);
    } finally {
      setActioningId('');
    }
  };

  const formatAddress = (address) => {
    if (!address) return '-';
    if (typeof address === 'string') return address || '-';

    const parts = [
      address.houseBlockLotNo,
      address.street,
      address.subdivisionVillage,
      address.barangay,
      address.cityMunicipality,
      address.province,
      address.zipCode ? `ZIP ${address.zipCode}` : '',
    ].filter(Boolean);

    return parts.length ? parts.join(', ') : '-';
  };

  const formatCitizenship = (citizenship) => {
    if (!citizenship) return '-';
    if (typeof citizenship === 'string') return citizenship || '-';

    if (citizenship.type === 'Dual Citizenship') {
      const detail = [citizenship.dualCitizenshipMode, citizenship.dualCitizenshipCountry].filter(Boolean).join(', ');
      return detail ? `Dual Citizenship (${detail})` : 'Dual Citizenship';
    }

    return citizenship.type || '-';
  };

  if (loading) {
    return (
      <div className="p-6">
        <p className="text-gray-600">Loading Personal Data Sheet submissions...</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Personal Data Sheet Reviews</h1>
          <p className="text-1xl text-gray-400">Review submitted Personal Data Sheets from applicants</p>
        </div>
        <button
          onClick={fetchSheets}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition"
        >
          Refresh
        </button>
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
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gray-200">
                <th className="border border-gray-300 px-4 py-2 text-left">PDS ID</th>
                <th className="border border-gray-300 px-4 py-2 text-left">Full Name</th>
                <th className="border border-gray-300 px-4 py-2 text-left">Email</th>
                <th className="border border-gray-300 px-4 py-2 text-left">Mobile</th>
                <th className="border border-gray-300 px-4 py-2 text-left">Status</th>
                <th className="border border-gray-300 px-4 py-2 text-left">Submitted</th>
                <th className="border border-gray-300 px-4 py-2 text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sheets.map((sheet) => {
                const fullName = [sheet.surname, sheet.firstName, sheet.middleName, sheet.nameExtension]
                  .filter(Boolean)
                  .join(', ');
                const isPending = sheet.status === 'Pending';

                return (
                  <tr key={sheet._id} className="hover:bg-gray-50">
                    <td className="border border-gray-300 px-4 py-2 font-medium">{sheet.pdsId}</td>
                    <td className="border border-gray-300 px-4 py-2">{fullName}</td>
                    <td className="border border-gray-300 px-4 py-2">{sheet.email}</td>
                    <td className="border border-gray-300 px-4 py-2">{sheet.mobile}</td>
                    <td className="border border-gray-300 px-4 py-2">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-semibold ${
                          sheet.status === 'Approved'
                            ? 'bg-green-100 text-green-700'
                            : sheet.status === 'Rejected'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-yellow-100 text-yellow-700'
                        }`}
                      >
                        {sheet.status}
                      </span>
                    </td>
                    <td className="border border-gray-300 px-4 py-2 text-sm">
                      {new Date(sheet.createdAt).toLocaleDateString()}
                    </td>
                    <td className="border border-gray-300 px-4 py-2 text-center space-x-2">
                      <button
                        onClick={() => setSelectedSheet(sheet)}
                        className="bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600 transition"
                      >
                        View
                      </button>
                      <button
                        onClick={() => handleReview(sheet.pdsId, 'Approved')}
                        disabled={!isPending || actioningId === `${sheet.pdsId}-Approved`}
                        className="bg-green-500 text-white px-3 py-1 rounded hover:bg-green-600 transition disabled:opacity-50"
                      >
                        {actioningId === `${sheet.pdsId}-Approved` ? 'Approving...' : 'Approve'}
                      </button>
                      <button
                        onClick={() => handleReview(sheet.pdsId, 'Rejected')}
                        disabled={!isPending || actioningId === `${sheet.pdsId}-Rejected`}
                        className="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600 transition disabled:opacity-50"
                      >
                        {actioningId === `${sheet.pdsId}-Rejected` ? 'Rejecting...' : 'Reject'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {selectedSheet && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-5xl max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold text-gray-800">PDS Details - {selectedSheet.pdsId}</h2>
              <button
                onClick={() => setSelectedSheet(null)}
                className="text-gray-600 hover:text-gray-800 text-xl"
              >
                ✕
              </button>
            </div>

            <div className="space-y-6 text-sm">
              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-2">Personal Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <p><span className="font-semibold">Name:</span> {[selectedSheet.surname, selectedSheet.firstName, selectedSheet.middleName, selectedSheet.nameExtension].filter(Boolean).join(', ') || '-'}</p>
                  <p><span className="font-semibold">Email:</span> {selectedSheet.email || '-'}</p>
                  <p><span className="font-semibold">Mobile:</span> {selectedSheet.mobile || '-'}</p>
                  <p><span className="font-semibold">Telephone:</span> {selectedSheet.telephone || '-'}</p>
                  <p><span className="font-semibold">Date of Birth:</span> {selectedSheet.dateOfBirth ? new Date(selectedSheet.dateOfBirth).toLocaleDateString() : '-'}</p>
                  <p><span className="font-semibold">Place of Birth:</span> {selectedSheet.placeOfBirth || '-'}</p>
                  <p><span className="font-semibold">Sex:</span> {selectedSheet.sexAtBirth || '-'}</p>
                  <p><span className="font-semibold">Civil Status:</span> {selectedSheet.civilStatus || '-'}</p>
                  <p><span className="font-semibold">Citizenship:</span> {formatCitizenship(selectedSheet.citizenship)}</p>
                  <p><span className="font-semibold">Residential Address:</span> {formatAddress(selectedSheet.residentialAddress)}</p>
                  <p><span className="font-semibold">Permanent Address:</span> {formatAddress(selectedSheet.permanentAddress)}</p>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-2">Family Background</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-3">
                  <p><span className="font-semibold">Spouse:</span> {[selectedSheet.familyBackground?.spouse?.surname, selectedSheet.familyBackground?.spouse?.firstName, selectedSheet.familyBackground?.spouse?.middleName, selectedSheet.familyBackground?.spouse?.nameExtension].filter(Boolean).join(', ') || '-'}</p>
                  <p><span className="font-semibold">Spouse Occupation:</span> {selectedSheet.familyBackground?.spouse?.occupation || '-'}</p>
                  <p><span className="font-semibold">Spouse Employer:</span> {selectedSheet.familyBackground?.spouse?.employerBusinessName || '-'}</p>
                  <p><span className="font-semibold">Spouse Business Address:</span> {selectedSheet.familyBackground?.spouse?.businessAddress || '-'}</p>
                  <p><span className="font-semibold">Father:</span> {[selectedSheet.familyBackground?.father?.surname, selectedSheet.familyBackground?.father?.firstName, selectedSheet.familyBackground?.father?.middleName, selectedSheet.familyBackground?.father?.nameExtension].filter(Boolean).join(', ') || '-'}</p>
                  <p><span className="font-semibold">Mother:</span> {[selectedSheet.familyBackground?.mother?.surname, selectedSheet.familyBackground?.mother?.firstName, selectedSheet.familyBackground?.mother?.middleName].filter(Boolean).join(', ') || '-'}</p>
                </div>

                <div>
                  <p className="font-semibold mb-1">Children</p>
                  {selectedSheet.familyBackground?.children?.length ? (
                    <ul className="list-disc pl-5 space-y-1">
                      {selectedSheet.familyBackground.children.map((child, index) => (
                        <li key={`${child.name || 'child'}-${index}`}>
                          {child.name || '-'} {child.dateOfBirth ? `(${new Date(child.dateOfBirth).toLocaleDateString()})` : ''}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p>-</p>
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
                        {selectedSheet.educationalBackground.map((row, index) => (
                          <tr key={`${row.level || 'level'}-${index}`}>
                            <td className="border border-gray-300 px-2 py-1">{row.level || '-'}</td>
                            <td className="border border-gray-300 px-2 py-1">{row.schoolName || '-'}</td>
                            <td className="border border-gray-300 px-2 py-1">{row.basicEducationDegreeCourse || '-'}</td>
                            <td className="border border-gray-300 px-2 py-1">{[row.periodFrom, row.periodTo].filter(Boolean).join(' - ') || '-'}</td>
                            <td className="border border-gray-300 px-2 py-1">{row.highestLevelUnitsEarned || '-'}</td>
                            <td className="border border-gray-300 px-2 py-1">{row.yearGraduated || '-'}</td>
                            <td className="border border-gray-300 px-2 py-1">{row.scholarshipAcademicHonorsReceived || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p>-</p>
                )}
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setSelectedSheet(null)}
                className="bg-gray-300 text-gray-800 px-4 py-2 rounded hover:bg-gray-400 transition"
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
