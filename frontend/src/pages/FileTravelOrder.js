import React, { useState, useEffect } from 'react';
import { travelOrderAPI, staffAPI } from '../api';

function FileTravelOrder({ staffId }) {
  const [travelType, setTravelType] = useState('');
  const [numDesignations, setNumDesignations] = useState(1);
  const [customNumDesignations, setCustomNumDesignations] = useState('');
  const [isCustomDesignations, setIsCustomDesignations] = useState(false);
  const [formData, setFormData] = useState({
    travelOrderId: '',
    staffId: staffId || '',
    staffName: '',
    // Office Travel Fields
    dateOfFiling: '',
    designations: [''],
    permanentStation: '',
    purposeOfTravel: '',
    activitySponsoredBy: '',
    periodCoveredFrom: '',
    periodCoveredTo: '',
    officialBusiness: false,
    officialTime: false,
    venueDestination: '',
    expensesCovered: '',
    fundSourcePapCode: '',
    recommendingApproval: '',
    // Travel Abroad Fields
    datePrepared: '',
    controlNo: '',
    region: '',
    province: '',
    municipality: '',
    abroadDateOfFiling: '',
    abroadName: '',
    office: '',
    position: '',
    period: '',
    travelDestination: '',
    fundSource: '',
    attachment: '',
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [staffName, setStaffName] = useState('');

  useEffect(() => {
    if (staffId) {
      fetchStaffName();
    }
  }, [staffId]);

  const fetchStaffName = async () => {
    try {
      const response = await staffAPI.getById(staffId);
      setStaffName(response.data.name);
      setFormData(prev => ({
        ...prev,
        staffId,
        staffName: response.data.name,
      }));
    } catch (err) {
      setError('Staff ID not found');
    }
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleDesignationChange = (index, value) => {
    const newDesignations = [...formData.designations];
    newDesignations[index] = value;
    setFormData({
      ...formData,
      designations: newDesignations,
    });
  };

  const handleNumDesignationsChange = (e) => {
    const value = e.target.value;
    
    if (value === 'other') {
      setIsCustomDesignations(true);
      setNumDesignations(0);
    } else {
      const num = parseInt(value);
      setIsCustomDesignations(false);
      setNumDesignations(num);
      setCustomNumDesignations('');
      const newDesignations = [...formData.designations];
      // Add or remove designations to match the selected number
      if (num > newDesignations.length) {
        for (let i = newDesignations.length; i < num; i++) {
          newDesignations.push('');
        }
      } else {
        newDesignations.splice(num);
      }
      setFormData({
        ...formData,
        designations: newDesignations,
      });
    }
  };

  const handleCustomNumDesignationsChange = (e) => {
    const value = e.target.value;
    setCustomNumDesignations(value);
    
    if (value && !isNaN(value) && parseInt(value) > 0) {
      const num = parseInt(value);
      const newDesignations = [...formData.designations];
      // Add or remove designations to match the entered number
      if (num > newDesignations.length) {
        for (let i = newDesignations.length; i < num; i++) {
          newDesignations.push('');
        }
      } else {
        newDesignations.splice(num);
      }
      setFormData({
        ...formData,
        designations: newDesignations,
      });
    }
  };

  const generateTravelOrderId = () => {
    return 'TO' + Date.now();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!staffId) {
      setError('Please enter your Staff ID in the navigation bar');
      return;
    }

    if (!travelType) {
      setError('Please select a travel type');
      return;
    }

    // Validate based on travel type
    if (travelType === 'office') {
      if (!formData.dateOfFiling || formData.designations.some(d => !d) || !formData.permanentStation || !formData.purposeOfTravel || !formData.activitySponsoredBy || !formData.periodCoveredFrom || !formData.periodCoveredTo || !formData.venueDestination || !formData.expensesCovered || !formData.fundSourcePapCode) {
        setError('All required fields must be filled');
        return;
      }
    } else if (travelType === 'abroad') {
      if (!formData.datePrepared || !formData.controlNo || !formData.region || !formData.province || !formData.municipality || !formData.abroadDateOfFiling || !formData.abroadName || !formData.office || !formData.position || !formData.period || !formData.travelDestination || !formData.fundSource) {
        setError('All required fields must be filled');
        return;
      }
    }

    try {
      setLoading(true);
      const submitData = {
        ...formData,
        travelOrderId: generateTravelOrderId(),
        staffId,
        staffName,
        travelType,
      };
      await travelOrderAPI.create(submitData);
      setSuccess('Travel order request filed successfully!');
      setTravelType('');
      setNumDesignations(1);
      setCustomNumDesignations('');
      setIsCustomDesignations(false);
      setFormData({
        travelOrderId: '',
        staffId,
        staffName,
        dateOfFiling: '',
        designations: [''],
        permanentStation: '',
        purposeOfTravel: '',
        activitySponsoredBy: '',
        periodCoveredFrom: '',
        periodCoveredTo: '',
        officialBusiness: false,
        officialTime: false,
        venueDestination: '',
        expensesCovered: '',
        fundSourcePapCode: '',
        recommendingApproval: '',
        datePrepared: '',
        controlNo: '',
        region: '',
        province: '',
        municipality: '',
        abroadDateOfFiling: '',
        abroadName: '',
        office: '',
        position: '',
        period: '',
        travelDestination: '',
        fundSource: '',
        attachment: '',
      });
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to file travel order');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-6 max-w-6xl">
      <h1 className="text-3xl font-bold mb-6">Request Travel Order</h1>

      {error && <div className="mb-4 p-4 bg-red-100 text-red-700 rounded">{error}</div>}
      {success && <div className="mb-4 p-4 bg-green-100 text-green-700 rounded">{success}</div>}

      <form onSubmit={handleSubmit} className="bg-white p-6 rounded shadow space-y-4">
        <div className="max-w-xs">
          <label className="block font-bold mb-2">Travel Type *</label>
          <select
            value={travelType}
            onChange={(e) => setTravelType(e.target.value)}
            className="w-full px-4 py-2 border rounded focus:outline-none focus:border-blue-500"
            required
          >
            <option value="">-- Select Travel Type --</option>
            <option value="office">Travel Order / Office Order</option>
            <option value="abroad">Travel Abroad</option>
          </select>
        </div>

        {/* Office Travel Order Fields */}
        {travelType === 'office' && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-bold mb-2">Date of Filing *</label>
              <input
                type="date"
                name="dateOfFiling"
                value={formData.dateOfFiling}
                onChange={handleChange}
                className="w-full px-4 py-2 border rounded focus:outline-none focus:border-blue-500"
                required
              />
            </div>

            <div>
              <label className="block font-bold mb-2">Number of Names/Designations *</label>
              <select
                value={isCustomDesignations ? 'other' : numDesignations}
                onChange={handleNumDesignationsChange}
                className="w-full px-4 py-2 border rounded focus:outline-none focus:border-blue-500"
              >
                {[1, 2, 3, 4, 5].map(num => (
                  <option key={num} value={num}>{num}</option>
                ))}
                <option value="other">Other</option>
              </select>
            </div>

            {isCustomDesignations && (
              <div>
                <label className="block font-bold mb-2">Enter Number of Names/Designations *</label>
                <input
                  type="number"
                  value={customNumDesignations}
                  onChange={handleCustomNumDesignationsChange}
                  placeholder="Enter any number"
                  min="1"
                  className="w-full px-4 py-2 border rounded focus:outline-none focus:border-blue-500"
                />
              </div>
            )}

            {formData.designations.map((designation, index) => (
              <div key={index}>
                <label className="block font-bold mb-2">Name/Designation {index + 1} *</label>
                <input
                  type="text"
                  value={designation}
                  onChange={(e) => handleDesignationChange(index, e.target.value)}
                  placeholder="e.g., Juan Dela Cruz / Senior Officer"
                  className="w-full px-4 py-2 border rounded focus:outline-none focus:border-blue-500"
                  required
                />
              </div>
            ))}

            <div>
              <label className="block font-bold mb-2">Permanent Station *</label>
              <input
                type="text"
                name="permanentStation"
                value={formData.permanentStation}
                onChange={handleChange}
                placeholder="e.g., Metro Manila Office"
                className="w-full px-4 py-2 border rounded focus:outline-none focus:border-blue-500"
                required
              />
            </div>

            <div>
              <label className="block font-bold mb-2">Purpose of Travel *</label>
              <input
                type="text"
                name="purposeOfTravel"
                value={formData.purposeOfTravel}
                onChange={handleChange}
                placeholder="e.g., Attend Training, Conference"
                className="w-full px-4 py-2 border rounded focus:outline-none focus:border-blue-500"
                required
              />
            </div>

            <div>
              <label className="block font-bold mb-2">Activity Organized/Sponsored By *</label>
              <input
                type="text"
                name="activitySponsoredBy"
                value={formData.activitySponsoredBy}
                onChange={handleChange}
                placeholder="e.g., Department, Bureau"
                className="w-full px-4 py-2 border rounded focus:outline-none focus:border-blue-500"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4 col-span-2">
              <div>
                <label className="block font-bold mb-2">Period Covered From *</label>
                <input
                  type="date"
                  name="periodCoveredFrom"
                  value={formData.periodCoveredFrom}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border rounded focus:outline-none focus:border-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block font-bold mb-2">Period Covered To *</label>
                <input
                  type="date"
                  name="periodCoveredTo"
                  value={formData.periodCoveredTo}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border rounded focus:outline-none focus:border-blue-500"
                  required
                />
              </div>
            </div>

            <div className="col-span-2">
              <label className="block font-bold mb-2">Please Check *</label>
              <div className="flex gap-6">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    name="officialBusiness"
                    checked={formData.officialBusiness}
                    onChange={(e) => setFormData({...formData, officialBusiness: e.target.checked})}
                    className="w-4 h-4"
                  />
                  <span>Official Business</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    name="officialTime"
                    checked={formData.officialTime}
                    onChange={(e) => setFormData({...formData, officialTime: e.target.checked})}
                    className="w-4 h-4"
                  />
                  <span>Official Time</span>
                </label>
              </div>
            </div>

            <div>
              <label className="block font-bold mb-2">Venue/Destination *</label>
              <input
                type="text"
                name="venueDestination"
                value={formData.venueDestination}
                onChange={handleChange}
                placeholder="e.g., Convention Center, Hotel Name"
                className="w-full px-4 py-2 border rounded focus:outline-none focus:border-blue-500"
                required
              />
            </div>

            <div>
              <label className="block font-bold mb-2">Expenses Covered *</label>
              <input
                type="text"
                name="expensesCovered"
                value={formData.expensesCovered}
                onChange={handleChange}
                placeholder="e.g., Transportation, Accommodation"
                className="w-full px-4 py-2 border rounded focus:outline-none focus:border-blue-500"
                required
              />
            </div>

            <div>
              <label className="block font-bold mb-2">Fund Source (PAP Code) *</label>
              <input
                type="text"
                name="fundSourcePapCode"
                value={formData.fundSourcePapCode}
                onChange={handleChange}
                placeholder="e.g., PAP-2026-001"
                className="w-full px-4 py-2 border rounded focus:outline-none focus:border-blue-500"
                required
              />
            </div>
          </div>
        )}

        {/* Travel Abroad Fields */}
        {travelType === 'abroad' && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-bold mb-2">Date Prepared *</label>
              <input
                type="date"
                name="datePrepared"
                value={formData.datePrepared}
                onChange={handleChange}
                className="w-full px-4 py-2 border rounded focus:outline-none focus:border-blue-500"
                required
              />
            </div>

            <div>
              <label className="block font-bold mb-2">Control No. *</label>
              <input
                type="text"
                name="controlNo"
                value={formData.controlNo}
                onChange={handleChange}
                placeholder="e.g., CO-2026-001"
                className="w-full px-4 py-2 border rounded focus:outline-none focus:border-blue-500"
                required
              />
            </div>

            <div>
              <label className="block font-bold mb-2">Region *</label>
              <input
                type="text"
                name="region"
                value={formData.region}
                onChange={handleChange}
                placeholder="e.g., Region I, Region VI"
                className="w-full px-4 py-2 border rounded focus:outline-none focus:border-blue-500"
                required
              />
            </div>

            <div>
              <label className="block font-bold mb-2">Province *</label>
              <input
                type="text"
                name="province"
                value={formData.province}
                onChange={handleChange}
                placeholder="e.g., Metro Manila, Cavite"
                className="w-full px-4 py-2 border rounded focus:outline-none focus:border-blue-500"
                required
              />
            </div>

            <div>
              <label className="block font-bold mb-2">Municipality *</label>
              <input
                type="text"
                name="municipality"
                value={formData.municipality}
                onChange={handleChange}
                placeholder="e.g., Makati, Pasig"
                className="w-full px-4 py-2 border rounded focus:outline-none focus:border-blue-500"
                required
              />
            </div>

            <div>
              <label className="block font-bold mb-2">Date of Filing *</label>
              <input
                type="date"
                name="abroadDateOfFiling"
                value={formData.abroadDateOfFiling}
                onChange={handleChange}
                className="w-full px-4 py-2 border rounded focus:outline-none focus:border-blue-500"
                required
              />
            </div>

            <div>
              <label className="block font-bold mb-2">Name *</label>
              <input
                type="text"
                name="abroadName"
                value={formData.abroadName}
                onChange={handleChange}
                placeholder="Full name"
                className="w-full px-4 py-2 border rounded focus:outline-none focus:border-blue-500"
                required
              />
            </div>

            <div>
              <label className="block font-bold mb-2">Office *</label>
              <input
                type="text"
                name="office"
                value={formData.office}
                onChange={handleChange}
                placeholder="e.g., Bureau of Internal Revenue"
                className="w-full px-4 py-2 border rounded focus:outline-none focus:border-blue-500"
                required
              />
            </div>

            <div>
              <label className="block font-bold mb-2">Position/Designation *</label>
              <input
                type="text"
                name="position"
                value={formData.position}
                onChange={handleChange}
                placeholder="e.g., Senior Tax Officer"
                className="w-full px-4 py-2 border rounded focus:outline-none focus:border-blue-500"
                required
              />
            </div>

            <div>
              <label className="block font-bold mb-2">Period *</label>
              <input
                type="text"
                name="period"
                value={formData.period}
                onChange={handleChange}
                placeholder="e.g., February 1-15, 2026"
                className="w-full px-4 py-2 border rounded focus:outline-none focus:border-blue-500"
                required
              />
            </div>

            <div>
              <label className="block font-bold mb-2">Destination *</label>
              <input
                type="text"
                name="travelDestination"
                value={formData.travelDestination}
                onChange={handleChange}
                placeholder="Country and city of travel"
                className="w-full px-4 py-2 border rounded focus:outline-none focus:border-blue-500"
                required
              />
            </div>

            <div>
              <label className="block font-bold mb-2">Fund Source *</label>
              <input
                type="text"
                name="fundSource"
                value={formData.fundSource}
                onChange={handleChange}
                placeholder="e.g., Agency Budget, Grant"
                className="w-full px-4 py-2 border rounded focus:outline-none focus:border-blue-500"
                required
              />
            </div>

            <div>
              <label className="block font-bold mb-2">Attachment</label>
              <input
                type="text"
                name="attachment"
                value={formData.attachment}
                onChange={handleChange}
                placeholder="e.g., Document name or reference"
                className="w-full px-4 py-2 border rounded focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !staffName || !travelType}
          className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:bg-gray-400"
        >
          {loading ? 'Filing...' : 'File Travel Order'}
        </button>
      </form>
    </div>
  );
}

export default FileTravelOrder;
