import React, { useState } from 'react';
import { staffAPI } from '../api';

function AddStaff() {
  const [formData, setFormData] = useState({
    id: '',
    firstName: '',
    middleName: '',
    lastName: '',
    email: '',
    password: '',
    position: '',
    department: '',
    phone: '',
    dateOfBirth: '',
    placeOfBirth: '',
    tinNumber: '',
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!formData.id || !formData.firstName || !formData.lastName || !formData.email || !formData.password) {
      setError('ID, First Name, Last Name, Email, and Password are required');
      return;
    }

    try {
      setLoading(true);
      const fullName = `${formData.firstName} ${formData.middleName} ${formData.lastName}`.trim();
      await staffAPI.create({
        ...formData,
        name: fullName,
      });
      setSuccess('Staff added successfully!');
      setFormData({
        id: '',
        firstName: '',
        middleName: '',
        lastName: '',
        email: '',
        password: '',
        position: '',
        department: '',
        phone: '',
        dateOfBirth: '',
        placeOfBirth: '',
        tinNumber: '',
      });
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to add staff');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-6 max-w-md">
      <h1 className="text-3xl font-bold mb-6">Add New Staff</h1>

      {error && <div className="mb-4 p-4 bg-red-100 text-red-700 rounded">{error}</div>}
      {success && <div className="mb-4 p-4 bg-green-100 text-green-700 rounded">{success}</div>}

      <form onSubmit={handleSubmit} className="bg-white p-6 rounded shadow space-y-4">
        <div>
          <label className="block font-bold mb-2">Staff ID *</label>
          <input
            type="text"
            name="id"
            value={formData.id}
            onChange={handleChange}
            className="w-full px-4 py-2 border rounded focus:outline-none focus:border-blue-500"
            required
          />
        </div>

        <div>
          <label className="block font-bold mb-2">First Name *</label>
          <input
            type="text"
            name="firstName"
            value={formData.firstName}
            onChange={handleChange}
            className="w-full px-4 py-2 border rounded focus:outline-none focus:border-blue-500"
            required
          />
        </div>

        <div>
          <label className="block font-bold mb-2">Middle Name</label>
          <input
            type="text"
            name="middleName"
            value={formData.middleName}
            onChange={handleChange}
            className="w-full px-4 py-2 border rounded focus:outline-none focus:border-blue-500"
          />
        </div>

        <div>
          <label className="block font-bold mb-2">Last Name *</label>
          <input
            type="text"
            name="lastName"
            value={formData.lastName}
            onChange={handleChange}
            className="w-full px-4 py-2 border rounded focus:outline-none focus:border-blue-500"
            required
          />
        </div>

        <div>
          <label className="block font-bold mb-2">Email *</label>
          <input
            type="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            className="w-full px-4 py-2 border rounded focus:outline-none focus:border-blue-500"
            required
          />
        </div>

        <div>
          <label className="block font-bold mb-2">Password *</label>
          <input
            type="password"
            name="password"
            value={formData.password}
            onChange={handleChange}
            className="w-full px-4 py-2 border rounded focus:outline-none focus:border-blue-500"
            required
          />
        </div>

        <div>
          <label className="block font-bold mb-2">Position</label>
          <input
            type="text"
            name="position"
            value={formData.position}
            onChange={handleChange}
            className="w-full px-4 py-2 border rounded focus:outline-none focus:border-blue-500"
          />
        </div>

        <div>
          <label className="block font-bold mb-2">Department</label>
          <input
            type="text"
            name="department"
            value={formData.department}
            onChange={handleChange}
            className="w-full px-4 py-2 border rounded focus:outline-none focus:border-blue-500"
          />
        </div>

        <div>
          <label className="block font-bold mb-2">Phone</label>
          <input
            type="tel"
            name="phone"
            value={formData.phone}
            onChange={handleChange}
            className="w-full px-4 py-2 border rounded focus:outline-none focus:border-blue-500"
          />
        </div>

        <div>
          <label className="block font-bold mb-2">Date of Birth</label>
          <input
            type="date"
            name="dateOfBirth"
            value={formData.dateOfBirth}
            onChange={handleChange}
            className="w-full px-4 py-2 border rounded focus:outline-none focus:border-blue-500"
          />
        </div>

        <div>
          <label className="block font-bold mb-2">Place of Birth</label>
          <input
            type="text"
            name="placeOfBirth"
            value={formData.placeOfBirth}
            onChange={handleChange}
            className="w-full px-4 py-2 border rounded focus:outline-none focus:border-blue-500"
          />
        </div>

        <div>
          <label className="block font-bold mb-2">TIN #</label>
          <input
            type="text"
            name="tinNumber"
            value={formData.tinNumber}
            onChange={handleChange}
            className="w-full px-4 py-2 border rounded focus:outline-none focus:border-blue-500"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:bg-gray-400"
        >
          {loading ? 'Adding...' : 'Add Staff'}
        </button>
      </form>
    </div>
  );
}

export default AddStaff;
