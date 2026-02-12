import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { personalDataSheetAPI } from '../api';

const COUNTRY_OPTIONS = [
  'United States',
  'Canada',
  'Australia',
  'United Kingdom',
  'Japan',
  'South Korea',
  'Singapore',
  'Malaysia',
  'Thailand',
  'Indonesia',
  'Vietnam',
  'India',
  'China',
  'New Zealand',
  'Germany',
  'France',
  'Spain',
  'Italy',
  'United Arab Emirates',
  'Saudi Arabia',
  'Qatar',
  'Kuwait',
  'Other',
];

const initialEducationRows = [
  {
    level: 'Elementary',
    schoolName: '',
    basicEducationDegreeCourse: '',
    periodFrom: '',
    periodTo: '',
    highestLevelUnitsEarned: '',
    yearGraduated: '',
    scholarshipAcademicHonorsReceived: '',
  },
  {
    level: 'Secondary',
    schoolName: '',
    basicEducationDegreeCourse: '',
    periodFrom: '',
    periodTo: '',
    highestLevelUnitsEarned: '',
    yearGraduated: '',
    scholarshipAcademicHonorsReceived: '',
  },
  {
    level: 'Vocational / Trade Course',
    schoolName: '',
    basicEducationDegreeCourse: '',
    periodFrom: '',
    periodTo: '',
    highestLevelUnitsEarned: '',
    yearGraduated: '',
    scholarshipAcademicHonorsReceived: '',
  },
  {
    level: 'College',
    schoolName: '',
    basicEducationDegreeCourse: '',
    periodFrom: '',
    periodTo: '',
    highestLevelUnitsEarned: '',
    yearGraduated: '',
    scholarshipAcademicHonorsReceived: '',
  },
  {
    level: 'Graduate Studies',
    schoolName: '',
    basicEducationDegreeCourse: '',
    periodFrom: '',
    periodTo: '',
    highestLevelUnitsEarned: '',
    yearGraduated: '',
    scholarshipAcademicHonorsReceived: '',
  },
];

export default function SubmitPersonalDataSheet() {
  const [formData, setFormData] = useState({
    surname: '',
    firstName: '',
    middleName: '',
    nameExtension: '',
    dateOfBirth: '',
    placeOfBirth: '',
    sexAtBirth: '',
    civilStatus: '',
    citizenship: {
      type: 'Filipino',
      dualCitizenshipMode: '',
      dualCitizenshipCountry: '',
    },
    residentialAddress: {
      houseBlockLotNo: '',
      street: '',
      subdivisionVillage: '',
      barangay: '',
      cityMunicipality: '',
      province: '',
      zipCode: '',
    },
    permanentAddress: {
      houseBlockLotNo: '',
      street: '',
      subdivisionVillage: '',
      barangay: '',
      cityMunicipality: '',
      province: '',
      zipCode: '',
    },
    telephone: '',
    mobile: '',
    email: '',
    familyBackground: {
      spouse: {
        surname: '',
        firstName: '',
        middleName: '',
        nameExtension: '',
        occupation: '',
        employerBusinessName: '',
        businessAddress: '',
        telephone: '',
      },
      father: {
        surname: '',
        firstName: '',
        middleName: '',
        nameExtension: '',
      },
      mother: {
        surname: '',
        firstName: '',
        middleName: '',
      },
      children: [
        { name: '', dateOfBirth: '' },
      ],
    },
    educationalBackground: initialEducationRows,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isPermanentSameAsResidential, setIsPermanentSameAsResidential] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const navigate = useNavigate();

  const validatePersonalInformationPage = () => {
    if (!formData.surname || !formData.firstName || !formData.mobile || !formData.email) {
      setError('Please fill in all required fields: Surname, First Name, Mobile No., and Email.');
      return false;
    }

    if (
      formData.citizenship.type === 'Dual Citizenship' &&
      (!formData.citizenship.dualCitizenshipMode || !formData.citizenship.dualCitizenshipCountry)
    ) {
      setError('For dual citizenship, please select whether by birth or by naturalization and choose a country.');
      return false;
    }

    return true;
  };

  const handleNextPage = () => {
    setError('');

    if (currentPage === 1 && !validatePersonalInformationPage()) {
      return;
    }

    setCurrentPage((prev) => Math.min(prev + 1, 3));
  };

  const handlePreviousPage = () => {
    setError('');
    setCurrentPage((prev) => Math.max(prev - 1, 1));
  };

  const handleStepClick = (targetPage) => {
    setError('');

    if (targetPage === currentPage) return;
    if (targetPage < 1 || targetPage > 3) return;

    if (currentPage === 1 && targetPage > 1 && !validatePersonalInformationPage()) {
      return;
    }

    setCurrentPage(targetPage);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleAddressChange = (addressType, field, value) => {
    setFormData((prev) => ({
      ...prev,
      [addressType]: {
        ...prev[addressType],
        [field]: value,
      },
      ...(addressType === 'residentialAddress' && isPermanentSameAsResidential
        ? {
            permanentAddress: {
              ...prev.residentialAddress,
              [field]: value,
            },
          }
        : {}),
    }));
  };

  const handleCitizenshipTypeChange = (type) => {
    setFormData((prev) => ({
      ...prev,
      citizenship: {
        type,
        dualCitizenshipMode: type === 'Dual Citizenship' ? prev.citizenship.dualCitizenshipMode : '',
        dualCitizenshipCountry: type === 'Dual Citizenship' ? prev.citizenship.dualCitizenshipCountry : '',
      },
    }));
  };

  const handleDualCitizenshipModeChange = (mode) => {
    setFormData((prev) => ({
      ...prev,
      citizenship: {
        ...prev.citizenship,
        dualCitizenshipMode: mode,
      },
    }));
  };

  const handleFamilyChange = (group, field, value) => {
    setFormData((prev) => ({
      ...prev,
      familyBackground: {
        ...prev.familyBackground,
        [group]: {
          ...prev.familyBackground[group],
          [field]: value,
        },
      },
    }));
  };

  const handleChildChange = (index, field, value) => {
    setFormData((prev) => {
      const updatedChildren = [...prev.familyBackground.children];
      updatedChildren[index] = {
        ...updatedChildren[index],
        [field]: value,
      };

      return {
        ...prev,
        familyBackground: {
          ...prev.familyBackground,
          children: updatedChildren,
        },
      };
    });
  };

  const addChildRow = () => {
    setFormData((prev) => ({
      ...prev,
      familyBackground: {
        ...prev.familyBackground,
        children: [...prev.familyBackground.children, { name: '', dateOfBirth: '' }],
      },
    }));
  };

  const removeChildRow = (index) => {
    setFormData((prev) => {
      if (prev.familyBackground.children.length <= 1) {
        return prev;
      }

      return {
        ...prev,
        familyBackground: {
          ...prev.familyBackground,
          children: prev.familyBackground.children.filter((_, childIndex) => childIndex !== index),
        },
      };
    });
  };

  const handleEducationChange = (index, field, value) => {
    setFormData((prev) => {
      const updatedEducation = [...prev.educationalBackground];
      updatedEducation[index] = {
        ...updatedEducation[index],
        [field]: value,
      };

      return {
        ...prev,
        educationalBackground: updatedEducation,
      };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!validatePersonalInformationPage()) {
      return;
    }

    try {
      setLoading(true);
      await personalDataSheetAPI.submit(formData);
      setSuccess('Personal Data Sheet submitted successfully. It is now forwarded to admin for review.');
      setTimeout(() => {
        navigate('/login');
      }, 1800);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to submit Personal Data Sheet.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 py-8"
      style={{
        backgroundImage: `linear-gradient(rgba(138, 219, 246, 0.48), rgba(255, 255, 255, 0.2)), url('/login.jpg')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed',
      }}
    >
      <div className="bg-white rounded-lg shadow-lg p-8 w-full max-w-6xl" style={{ opacity: 0.95 }}>
        <div className="text-center mb-6">
          <img
            src="/csc.PNG"
            alt="LALA LGU Logo"
            className="w-40 h-40 mx-auto mb-3 object-contain"
          />
          <h1 className="text-3xl font-bold text-gray-800 mb-1">Personal Data Sheet</h1>
          <p className="text-gray-500">Fill up the form and submit it for admin review</p>
        </div>

        <div className="mb-6 bg-red-50 border border-yellow-500 rounded-lg p-4">
          <h2 className="text-sm text-gray-800 font-semibold mb-2">WARNING:</h2>
          <p className="text-sm text-gray-800">* Any misinterpretation made in the Personal Data Sheet shall cause the filing of administrative/criminal case/s against the person concerned.</p>
         <br></br>
          <h2 className="text-sm text-gray-800 font-semibold mb-2">INSTRUCTIONS:</h2>
          <p className="text-sm text-gray-800">* Indicate N/A if not applicable.</p>
          <p className="text-sm text-gray-800">* DO NOT ABBREVIATE.</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
            {error}
          </div>
        )}

        {success && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-4">
            {success}
          </div>
        )}

        <div className="mb-6">
          <p className="text-sm text-gray-600 font-medium">Page {currentPage} of 3</p>
          <div className="grid grid-cols-3 gap-2 mt-3 mb-3">
            <button
              type="button"
              onClick={() => handleStepClick(1)}
              className={`px-3 py-2 rounded text-sm font-medium transition ${
                currentPage === 1 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              1. Personal
            </button>
            <button
              type="button"
              onClick={() => handleStepClick(2)}
              className={`px-3 py-2 rounded text-sm font-medium transition ${
                currentPage === 2 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              2. Family
            </button>
            <button
              type="button"
              onClick={() => handleStepClick(3)}
              className={`px-3 py-2 rounded text-sm font-medium transition ${
                currentPage === 3 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              3. Educational
            </button>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all"
              style={{ width: `${(currentPage / 3) * 100}%` }}
            />
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          {currentPage === 1 && (
          <div>
            <h2 className="text-xl font-semibold text-gray-800 mb-4">I. Personal Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
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
                    {COUNTRY_OPTIONS.map((country) => (
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
                      setFormData((prev) => ({
                        ...prev,
                        permanentAddress: { ...prev.residentialAddress },
                      }));
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

            </div>
          </div>
          )}

          {currentPage === 2 && (
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
          )}

          {currentPage === 3 && (
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
          )}

          <div className="flex flex-col sm:flex-row gap-3 mt-2">
            {currentPage > 1 && (
              <button
                type="button"
                onClick={handlePreviousPage}
                disabled={loading}
                className="flex-1 bg-gray-500 text-white py-2 rounded-lg font-medium hover:bg-gray-600 transition disabled:opacity-50"
              >
                Previous Page
              </button>
            )}

            {currentPage < 3 && (
              <button
                type="button"
                onClick={handleNextPage}
                disabled={loading}
                className="flex-1 bg-blue-600 text-white py-2 rounded-lg font-medium hover:bg-blue-700 transition disabled:opacity-50"
              >
                Next Page
              </button>
            )}

            {currentPage === 3 && (
              <button
                type="submit"
                disabled={loading}
                className="flex-1 bg-blue-600 text-white py-2 rounded-lg font-medium hover:bg-blue-700 transition disabled:opacity-50"
              >
                {loading ? 'Submitting...' : 'Submit Personal Data Sheet'}
              </button>
            )}
            <Link
              to="/login"
              className="flex-1 text-center bg-gray-300 text-gray-800 py-2 rounded-lg font-medium hover:bg-gray-400 transition"
            >
              Back to Login
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
