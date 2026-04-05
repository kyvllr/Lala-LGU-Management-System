import React from 'react';

export default function CivilServiceStep({ formData, loading, handleCSEChange, addCSERow, removeCSERow }) {
  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-800 mb-4">IV. Civil Service Eligibility</h2>

      <div className="space-y-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm text-gray-700">List your Civil Service eligibilities, if any.</p>
          <button
            type="button"
            onClick={addCSERow}
            className="bg-blue-100 text-blue-700 px-3 py-1 rounded hover:bg-blue-200 transition"
          >
            Add Row
          </button>
        </div>

        {formData.civilServiceEligibilities.map((cse, index) => (
          <div key={index} className="border border-gray-200 rounded-lg p-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">CES/CSEE/CAREER SERVICE/RA 1080 (BOARD/BAR)/UNDER SPECIAL LAWS/CATEGORY II/ IV ELIGIBILITY and ELIGIBILITIES FOR UNIFORMED PERSONNEL</label>
                <input
                  type="text"
                  value={cse.eligibilityType}
                  onChange={(e) => handleCSEChange(index, 'eligibilityType', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={loading}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Rating (If Applicable)</label>
                <input
                  type="text"
                  value={cse.rating}
                  onChange={(e) => handleCSEChange(index, 'rating', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={loading}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date of Examination / Conferment</label>
                <input
                  type="date"
                  value={cse.dateOfExaminationOrConferment}
                  onChange={(e) => handleCSEChange(index, 'dateOfExaminationOrConferment', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={loading}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Place of Examination / Conferment</label>
                <input
                  type="text"
                  value={cse.placeOfExaminationOrConferment}
                  onChange={(e) => handleCSEChange(index, 'placeOfExaminationOrConferment', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={loading}
                />
              </div>
             
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">License Number</label>
                <input
                  type="text"
                  value={cse.licenseNumber}
                  onChange={(e) => handleCSEChange(index, 'licenseNumber', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={loading}
                />
              </div>    
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Valid Until</label>
                <input
                  type="date"
                  value={cse.licenseValidUntil}
                  onChange={(e) => handleCSEChange(index, 'licenseValidUntil', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={loading}
                />
              </div>
            </div>
            <div className="mt-3 flex justify-end">
              <button
                type="button"
                onClick={() => removeCSERow(index)}
                className="bg-red-100 text-red-700 px-3 py-1 rounded hover:bg-red-200 transition"
                disabled={loading}
              >
                Remove
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
