import React from 'react';

export default function EducationStep({ formData, loading, handleEducationChange }) {
  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-800 mb-4">III. Educational Background</h2>

      <div className="space-y-4">
        {formData.educationalBackground.map((row, index) => (
          <div key={row.level} className="border border-gray-200 rounded-lg p-4">
            <h3 className="font-semibold text-gray-800 mb-3">{row.level}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name of School</label>
                <input
                  type="text"
                  value={row.schoolName}
                  onChange={(e) => handleEducationChange(index, 'schoolName', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={loading}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Basic Education / Degree / Course (Write in Full)</label>
                <input
                  type="text"
                  value={row.basicEducationDegreeCourse}
                  onChange={(e) => handleEducationChange(index, 'basicEducationDegreeCourse', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={loading}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Period From</label>
                <input
                  type="text"
                  value={row.periodFrom}
                  onChange={(e) => handleEducationChange(index, 'periodFrom', e.target.value)}
                  placeholder="YYYY"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={loading}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Period To</label>
                <input
                  type="text"
                  value={row.periodTo}
                  onChange={(e) => handleEducationChange(index, 'periodTo', e.target.value)}
                  placeholder="YYYY"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={loading}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Highest Level / Units Earned</label>
                <input
                  type="text"
                  value={row.highestLevelUnitsEarned}
                  onChange={(e) => handleEducationChange(index, 'highestLevelUnitsEarned', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={loading}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Year Graduated</label>
                <input
                  type="text"
                  value={row.yearGraduated}
                  onChange={(e) => handleEducationChange(index, 'yearGraduated', e.target.value)}
                  placeholder="YYYY"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={loading}
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Scholarship / Academic Honors Received</label>
                <input
                  type="text"
                  value={row.scholarshipAcademicHonorsReceived}
                  onChange={(e) => handleEducationChange(index, 'scholarshipAcademicHonorsReceived', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={loading}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
