import React from 'react';

export default function VoluntaryStep({ formData, loading, handleVolChange, addVolRow, removeVolRow }) {
  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-800 mb-4">VI. Voluntary Work / Civic Involvement</h2>

      <p className="text-sm text-gray-600 mb-3">(Name & address of organization — write in full. Inclusive dates, number of hours, position / nature of work.)</p>

      <div className="space-y-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm text-gray-700">Add voluntary work or civic involvement entries below.</p>
          <button
            type="button"
            onClick={addVolRow}
            className="bg-blue-100 text-blue-700 px-3 py-1 rounded hover:bg-blue-200 transition"
          >
            Add Entry
          </button>
        </div>

        {formData.voluntaryWork.map((v, index) => (
          <div key={index} className="border border-gray-200 rounded-lg p-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="md:col-span-3">
                <label className="block text-sm font-medium text-gray-700 mb-1">Name & Address of Organization</label>
                <input
                  type="text"
                  value={v.organization}
                  onChange={(e) => handleVolChange(index, 'organization', e.target.value)}
                  placeholder="Write in full"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={loading}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Inclusive Dates (From)</label>
                <input
                  type="date"
                  value={v.from}
                  onChange={(e) => handleVolChange(index, 'from', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={loading}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Inclusive Dates (To)</label>
                <input
                  type="date"
                  value={v.to}
                  onChange={(e) => handleVolChange(index, 'to', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={loading}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Number of Hours</label>
                <input
                  type="text"
                  value={v.hours}
                  onChange={(e) => handleVolChange(index, 'hours', e.target.value)}
                  placeholder="e.g. 40"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={loading}
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Position / Nature of Work</label>
                <input
                  type="text"
                  value={v.position}
                  onChange={(e) => handleVolChange(index, 'position', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={loading}
                />
              </div>
            </div>
            <div className="mt-3 flex justify-end">
              <button
                type="button"
                onClick={() => removeVolRow(index)}
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
