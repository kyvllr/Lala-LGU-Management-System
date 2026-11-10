import React from 'react';

export default function PersonalStep({
  formData,
  loading,
  handleChange,
  handleAddressChange,
  handleCitizenshipTypeChange,
  handleDualCitizenshipModeChange,
  SORTED_COUNTRY_OPTIONS,
  isPermanentSameAsResidential,
  setIsPermanentSameAsResidential,
  setFormData,
  handlePhotoChange,
}) {
  return (
    <>
      <div className="sm:col-span-2 rounded-lg border border-blue-200 bg-blue-50 p-4">
        <label className="block text-sm font-semibold text-gray-800 mb-2">
          Passport-Sized Photo <span className="text-red-600">*</span>
        </label>
        <p className="text-xs text-gray-600 mb-3">
          Upload a recent, unfiltered JPG, PNG, or WebP photo (up to 5 MB). It will appear on your PDS and printed copy.
        </p>
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          {formData.photoDataUrl ? (
            <img
              src={formData.photoDataUrl}
              alt="PDS photo preview"
              className="h-36 w-28 object-cover border border-gray-300 bg-white"
            />
          ) : (
            <div className="h-36 w-28 flex items-center justify-center border border-dashed border-gray-400 bg-white text-xs text-gray-500 text-center p-2">
              Photo preview
            </div>
          )}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handlePhotoChange}
            disabled={loading}
            aria-label="Upload passport-sized PDS photo"
            className="block w-full text-sm text-gray-700 file:mr-3 file:rounded-md file:border-0 file:bg-blue-600 file:px-4 file:py-2 file:font-semibold file:text-white hover:file:bg-blue-700"
          />
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mt-2">
        <label className="block text-sm font-medium text-gray-700 mb-1">Surname *</label>
        <input
          type="text"
          name="surname"
          value={formData.surname}
          onChange={handleChange}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          disabled={loading}
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">First Name *</label>
        <input
          type="text"
          name="firstName"
          value={formData.firstName}
          onChange={handleChange}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          disabled={loading}
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Middle Name</label>
        <input
          type="text"
          name="middleName"
          value={formData.middleName}
          onChange={handleChange}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          disabled={loading}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Name Extension</label>
        <input
          type="text"
          name="nameExtension"
          value={formData.nameExtension}
          onChange={handleChange}
          placeholder="Jr., Sr."
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          disabled={loading}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth</label>
        <input
          type="date"
          name="dateOfBirth"
          value={formData.dateOfBirth}
          onChange={handleChange}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          disabled={loading}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Place of Birth</label>
        <input
          type="text"
          name="placeOfBirth"
          value={formData.placeOfBirth}
          onChange={handleChange}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          disabled={loading}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Sex at Birth</label>
        <select
          name="sexAtBirth"
          value={formData.sexAtBirth}
          onChange={handleChange}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          disabled={loading}
        >
          <option value="">Select</option>
          <option value="Male">Male</option>
          <option value="Female">Female</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Civil Status</label>
        <select
          name="civilStatus"
          value={formData.civilStatus}
          onChange={handleChange}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          disabled={loading}
        >
          <option value="">Select</option>
          <option value="Single">Single</option>
          <option value="Married">Married</option>
          <option value="Widowed">Widowed</option>
          <option value="Separated">Separated</option>
          <option value="Other">Other</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">HEIGHT (m)</label>
        <input
          type="text"
          name="height"
          value={formData.height}
          onChange={handleChange}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          disabled={loading}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">WEIGHT (kg)</label>
        <input
          type="text"
          name="weight"
          value={formData.weight}
          onChange={handleChange}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          disabled={loading}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">BLOOD TYPE</label>
        <input
          type="text"
          name="bloodType"
          value={formData.bloodType}
          onChange={handleChange}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          disabled={loading}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">UMID ID NO.</label>
        <input
          type="text"
          name="gsisNo"
          value={formData.gsisNo}
          onChange={handleChange}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          disabled={loading}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">PAG-IBIG ID NO.</label>
        <input
          type="text"
          name="pagibigNo"
          value={formData.pagibigNo}
          onChange={handleChange}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          disabled={loading}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">PHILHEALTH NO.</label>
        <input
          type="text"
          name="philhealthNo"
          value={formData.philhealthNo}
          onChange={handleChange}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          disabled={loading}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">PhilSys Number (PSN)</label>
        <input
          type="text"
          name="sssNo"
          value={formData.sssNo}
          onChange={handleChange}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          disabled={loading}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">TIN NO.</label>
        <input
          type="text"
          name="tinNo"
          value={formData.tinNo}
          onChange={handleChange}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          disabled={loading}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">AGENCY EMPLOYEE NO.</label>
        <input
          type="text"
          name="agencyEmployeeNo"
          value={formData.agencyEmployeeNo}
          onChange={handleChange}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          disabled={loading}
        />
      </div>

      <div className="md:col-span-2">
        <label className="block text-sm font-medium text-gray-700 mb-2">Citizenship</label>
        <div className="flex flex-col md:flex-row gap-4 mb-2">
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={formData.citizenship.type === 'Filipino'}
              onChange={() => handleCitizenshipTypeChange('Filipino')}
              disabled={loading}
            />
            Filipino
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={formData.citizenship.type === 'Dual Citizenship'}
              onChange={() => handleCitizenshipTypeChange('Dual Citizenship')}
              disabled={loading}
            />
            Dual Citizenship
          </label>
        </div>

        {formData.citizenship.type === 'Dual Citizenship' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">Dual Citizenship Type</p>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={formData.citizenship.dualCitizenshipMode === 'By Birth'}
                    onChange={() => handleDualCitizenshipModeChange('By Birth')}
                    disabled={loading}
                  />
                  By Birth
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={formData.citizenship.dualCitizenshipMode === 'By Naturalization'}
                    onChange={() => handleDualCitizenshipModeChange('By Naturalization')}
                    disabled={loading}
                  />
                  By Naturalization
                </label>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Country</label>
              <select
                value={formData.citizenship.dualCitizenshipCountry}
                onChange={(e) => setFormData((prev) => ({
                  ...prev,
                  citizenship: {
                    ...prev.citizenship,
                    dualCitizenshipCountry: e.target.value,
                  },
                }))}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={loading}
              >
                <option value="">Select Country</option>
                {SORTED_COUNTRY_OPTIONS.map((country) => (
                  <option key={country} value={country}>{country}</option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      <div className="md:col-span-2 border border-gray-200 rounded-lg p-4">
        <h3 className="text-base font-semibold text-gray-800 mb-3">Residential Address</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">House/Block/Lot No.</label>
            <input
              type="text"
              value={formData.residentialAddress.houseBlockLotNo}
              onChange={(e) => handleAddressChange('residentialAddress', 'houseBlockLotNo', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={loading}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Street</label>
            <input
              type="text"
              value={formData.residentialAddress.street}
              onChange={(e) => handleAddressChange('residentialAddress', 'street', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={loading}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Subdivision/Village</label>
            <input
              type="text"
              value={formData.residentialAddress.subdivisionVillage}
              onChange={(e) => handleAddressChange('residentialAddress', 'subdivisionVillage', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={loading}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Barangay</label>
            <input
              type="text"
              value={formData.residentialAddress.barangay}
              onChange={(e) => handleAddressChange('residentialAddress', 'barangay', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={loading}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">City/Municipality</label>
            <input
              type="text"
              value={formData.residentialAddress.cityMunicipality}
              onChange={(e) => handleAddressChange('residentialAddress', 'cityMunicipality', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={loading}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Province</label>
            <input
              type="text"
              value={formData.residentialAddress.province}
              onChange={(e) => handleAddressChange('residentialAddress', 'province', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={loading}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">ZIP Code</label>
            <input
              type="text"
              value={formData.residentialAddress.zipCode}
              onChange={(e) => handleAddressChange('residentialAddress', 'zipCode', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={loading}
            />
          </div>
        </div>
      </div>

      <div className="md:col-span-2 border border-gray-200 rounded-lg p-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
          <h3 className="text-base font-semibold text-gray-800">Permanent Address</h3>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={isPermanentSameAsResidential}
              onChange={(e) => {
                const checked = e.target.checked;
                setIsPermanentSameAsResidential(checked);
                if (checked) {
                  setFormData((prev) => ({ ...prev, permanentAddress: { ...prev.residentialAddress } }));
                }
              }}
              disabled={loading}
            />
            Same as residential address
          </label>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">House/Block/Lot No.</label>
            <input
              type="text"
              value={formData.permanentAddress.houseBlockLotNo}
              onChange={(e) => handleAddressChange('permanentAddress', 'houseBlockLotNo', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={loading || isPermanentSameAsResidential}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Street</label>
            <input
              type="text"
              value={formData.permanentAddress.street}
              onChange={(e) => handleAddressChange('permanentAddress', 'street', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={loading || isPermanentSameAsResidential}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Subdivision/Village</label>
            <input
              type="text"
              value={formData.permanentAddress.subdivisionVillage}
              onChange={(e) => handleAddressChange('permanentAddress', 'subdivisionVillage', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={loading || isPermanentSameAsResidential}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Barangay</label>
            <input
              type="text"
              value={formData.permanentAddress.barangay}
              onChange={(e) => handleAddressChange('permanentAddress', 'barangay', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={loading || isPermanentSameAsResidential}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">City/Municipality</label>
            <input
              type="text"
              value={formData.permanentAddress.cityMunicipality}
              onChange={(e) => handleAddressChange('permanentAddress', 'cityMunicipality', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={loading || isPermanentSameAsResidential}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Province</label>
            <input
              type="text"
              value={formData.permanentAddress.province}
              onChange={(e) => handleAddressChange('permanentAddress', 'province', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={loading || isPermanentSameAsResidential}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">ZIP Code</label>
            <input
              type="text"
              value={formData.permanentAddress.zipCode}
              onChange={(e) => handleAddressChange('permanentAddress', 'zipCode', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={loading || isPermanentSameAsResidential}
            />
          </div>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Telephone No.</label>
        <input
          type="text"
          name="telephone"
          value={formData.telephone}
          onChange={handleChange}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          disabled={loading}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Mobile No. *</label>
        <input
          type="text"
          name="mobile"
          value={formData.mobile}
          onChange={handleChange}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          disabled={loading}
          required
        />
      </div>

      <div className="md:col-span-2">
        <label className="block text-sm font-medium text-gray-700 mb-1">Email Address *</label>
        <input
          type="email"
          name="email"
          value={formData.email}
          onChange={handleChange}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          disabled={loading}
          required
        />
      </div>
    </>
  );
}
