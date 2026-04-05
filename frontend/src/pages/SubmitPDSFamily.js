import React from 'react';

export default function FamilyStep({
  formData,
  loading,
  handleFamilyChange,
  handleChildChange,
  addChildRow,
  removeChildRow,
}) {
  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-800 mb-4">II. Family Background</h2>

      <div className="mb-6">
        <h3 className="text-lg font-medium text-gray-700 mb-3">Spouse</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Surname</label>
            <input
              type="text"
              value={formData.familyBackground.spouse.surname}
              onChange={(e) => handleFamilyChange('spouse', 'surname', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={loading}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
            <input
              type="text"
              value={formData.familyBackground.spouse.firstName}
              onChange={(e) => handleFamilyChange('spouse', 'firstName', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={loading}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Middle Name</label>
            <input
              type="text"
              value={formData.familyBackground.spouse.middleName}
              onChange={(e) => handleFamilyChange('spouse', 'middleName', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={loading}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name Extension</label>
            <input
              type="text"
              value={formData.familyBackground.spouse.nameExtension}
              onChange={(e) => handleFamilyChange('spouse', 'nameExtension', e.target.value)}
              placeholder="Jr., Sr."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={loading}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Occupation</label>
            <input
              type="text"
              value={formData.familyBackground.spouse.occupation}
              onChange={(e) => handleFamilyChange('spouse', 'occupation', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={loading}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Employer / Business Name</label>
            <input
              type="text"
              value={formData.familyBackground.spouse.employerBusinessName}
              onChange={(e) => handleFamilyChange('spouse', 'employerBusinessName', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={loading}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Telephone No.</label>
            <input
              type="text"
              value={formData.familyBackground.spouse.telephone}
              onChange={(e) => handleFamilyChange('spouse', 'telephone', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={loading}
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Business Address</label>
            <input
              type="text"
              value={formData.familyBackground.spouse.businessAddress}
              onChange={(e) => handleFamilyChange('spouse', 'businessAddress', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={loading}
            />
          </div>
        </div>
      </div>

      <div className="mb-6">
        <h3 className="text-lg font-medium text-gray-700 mb-3">Father</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Surname</label>
            <input
              type="text"
              value={formData.familyBackground.father.surname}
              onChange={(e) => handleFamilyChange('father', 'surname', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={loading}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
            <input
              type="text"
              value={formData.familyBackground.father.firstName}
              onChange={(e) => handleFamilyChange('father', 'firstName', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={loading}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Middle Name</label>
            <input
              type="text"
              value={formData.familyBackground.father.middleName}
              onChange={(e) => handleFamilyChange('father', 'middleName', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={loading}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name Extension</label>
            <input
              type="text"
              value={formData.familyBackground.father.nameExtension}
              onChange={(e) => handleFamilyChange('father', 'nameExtension', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={loading}
            />
          </div>
        </div>
      </div>

      <div className="mb-6">
        <h3 className="text-lg font-medium text-gray-700 mb-3">Mother's Maiden Name</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Surname</label>
            <input
              type="text"
              value={formData.familyBackground.mother.surname}
              onChange={(e) => handleFamilyChange('mother', 'surname', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={loading}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
            <input
              type="text"
              value={formData.familyBackground.mother.firstName}
              onChange={(e) => handleFamilyChange('mother', 'firstName', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={loading}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Middle Name</label>
            <input
              type="text"
              value={formData.familyBackground.mother.middleName}
              onChange={(e) => handleFamilyChange('mother', 'middleName', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={loading}
            />
          </div>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-medium text-gray-700">Children</h3>
          <button
            type="button"
            onClick={addChildRow}
            className="bg-blue-100 text-blue-700 px-3 py-1 rounded hover:bg-blue-200 transition"
          >
            Add Child
          </button>
        </div>
        <div className="space-y-3">
          {formData.familyBackground.children.map((child, index) => (
            <div key={index} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
              <div className="md:col-span-7">
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                <input
                  type="text"
                  value={child.name}
                  onChange={(e) => handleChildChange(index, 'name', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={loading}
                />
              </div>
              <div className="md:col-span-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth</label>
                <input
                  type="date"
                  value={child.dateOfBirth}
                  onChange={(e) => handleChildChange(index, 'dateOfBirth', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={loading}
                />
              </div>
              <div className="md:col-span-1">
                <button
                  type="button"
                  onClick={() => removeChildRow(index)}
                  className="w-full bg-red-100 text-red-700 px-2 py-2 rounded hover:bg-red-200 transition"
                  disabled={loading || formData.familyBackground.children.length === 1}
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
