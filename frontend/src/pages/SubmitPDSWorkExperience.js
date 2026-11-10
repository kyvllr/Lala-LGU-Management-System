import React from 'react';

export default function WorkExperienceStep({ formData, loading, handleWorkChange, addWorkRow, removeWorkRow }) {
  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-800 mb-4">V. Work Experience</h2>

      <p className="text-sm text-gray-600 mb-3">(Include private employment. Start from your recent work.) Description of duties should be indicated.</p>

      <div className="space-y-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm text-gray-700">Add your work experience entries below.</p>
          <button
            type="button"
            onClick={addWorkRow}
            className="bg-blue-100 text-blue-700 px-3 py-1 rounded hover:bg-blue-200 transition"
          >
            Add Experience
          </button>
        </div>

        {formData.workExperience.map((we, index) => (
          <div key={index} className="border border-gray-200 rounded-lg p-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Inclusive Dates (From)</label>
                <input
                  type="date"
                  value={we.from}
                  onChange={(e) => handleWorkChange(index, 'from', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={loading}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Inclusive Dates (To)</label>
                <input
                  type="date"
                  value={we.to}
                  onChange={(e) => handleWorkChange(index, 'to', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={loading}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Position Title</label>
                <input
                  type="text"
                  value={we.positionTitle}
                  onChange={(e) => handleWorkChange(index, 'positionTitle', e.target.value)}
                  placeholder="Write in full / do not abbreviate"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={loading}
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Department / Agency / Office / Company</label>
                <input
                  type="text"
                  value={we.company}
                  onChange={(e) => handleWorkChange(index, 'company', e.target.value)}
                  placeholder="Write in full / do not abbreviate"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={loading}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Monthly Salary</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={we.monthlySalary || ''}
                  onChange={(e) => handleWorkChange(index, 'monthlySalary', e.target.value)}
                  placeholder="e.g., 25000.00"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={loading}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Salary / Job / Pay Grade &amp; Step Increment
                </label>
                <input
                  type="text"
                  value={we.salaryJobPayGrade || ''}
                  onChange={(e) => handleWorkChange(index, 'salaryJobPayGrade', e.target.value)}
                  placeholder="00-0 (e.g., 24-1)"
                  pattern="(?:[0-9]{2}-[0-9]|N/A)"
                  maxLength={4}
                  title={'Use the format "00-0" (for example, 24-1), or enter N/A.'}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={loading}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status of Appointment</label>
                <input
                  type="text"
                  value={we.statusOfAppointment}
                  onChange={(e) => handleWorkChange(index, 'statusOfAppointment', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={loading}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Government Service?</label>
                <select
                  value={we.govtService}
                  onChange={(e) => handleWorkChange(index, 'govtService', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={loading}
                >
                  <option value="">Select</option>
                  <option value="Y">Yes</option>
                  <option value="N">No</option>
                </select>
              </div>
              <div className="md:col-span-3">
                <label className="block text-sm font-medium text-gray-700 mb-1">Description of Duties</label>
                <textarea
                  value={we.duties}
                  onChange={(e) => handleWorkChange(index, 'duties', e.target.value)}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={loading}
                />
              </div>
            </div>
            <div className="mt-3 flex justify-end">
              <button
                type="button"
                onClick={() => removeWorkRow(index)}
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
