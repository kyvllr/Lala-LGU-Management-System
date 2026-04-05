import React from 'react';

export default function LearningStep({ formData, loading, handleLdChange, addLdRow, removeLdRow }) {
  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-800 mb-4">VII. Learning and Development (L&D) Interventions / Training Programs Attended</h2>

      <p className="text-sm text-gray-600 mb-3">(Title of L&D / training programs — write in full. Inclusive dates, number of hours, type, conducted/sponsored by.)</p>

      <div className="space-y-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm text-gray-700">Add learning & development entries below.</p>
          <button
            type="button"
            onClick={addLdRow}
            className="bg-blue-100 text-blue-700 px-3 py-1 rounded hover:bg-blue-200 transition"
          >
            Add Entry
          </button>
        </div>

        {formData.learningDevelopment.map((ld, index) => (
          <div key={index} className="border border-gray-200 rounded-lg p-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="md:col-span-3">
                <label className="block text-sm font-medium text-gray-700 mb-1">TITLE OF LEARNING AND DEVELOPMENT INTERVENTIONS/TRAINING PROGRAMS</label>
                <input
                  type="text"
                  value={ld.title}
                  onChange={(e) => handleLdChange(index, 'title', e.target.value)}
                  placeholder="Write in full"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={loading}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Inclusive Dates (From)</label>
                <input
                  type="date"
                  value={ld.from}
                  onChange={(e) => handleLdChange(index, 'from', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={loading}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Inclusive Dates (To)</label>
                <input
                  type="date"
                  value={ld.to}
                  onChange={(e) => handleLdChange(index, 'to', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={loading}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Number of Hours</label>
                <input
                  type="text"
                  value={ld.hours}
                  onChange={(e) => handleLdChange(index, 'hours', e.target.value)}
                  placeholder="e.g. 16"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={loading}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type of L&D</label>
                <input
                  type="text"
                  value={ld.type}
                  onChange={(e) => handleLdChange(index, 'type', e.target.value)}
                  placeholder="Managerial / Supervisory / Technical / etc"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={loading}
                />
              </div>
              <div className="md:col-span-3">
                <label className="block text-sm font-medium text-gray-700 mb-1">Conducted / Sponsored By</label>
                <input
                  type="text"
                  value={ld.conductedBy}
                  onChange={(e) => handleLdChange(index, 'conductedBy', e.target.value)}
                  placeholder="Write in full"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={loading}
                />
              </div>
            </div>
            <div className="mt-3 flex justify-end">
              <button
                type="button"
                onClick={() => removeLdRow(index)}
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
