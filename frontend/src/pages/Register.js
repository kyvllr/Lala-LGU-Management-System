import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../api';

export default function Register() {
  const [formData, setFormData] = useState({
    staffId: '',
    firstName: '',
    middleName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
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
  const [submitted, setSubmitted] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    // Validation
    if (!formData.staffId || !formData.firstName || !formData.lastName || !formData.email || !formData.password) {
      setError('Please fill in all required fields');
      setLoading(false);
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters');
      setLoading(false);
      return;
    }

    try {
      const fullName = `${formData.firstName} ${formData.middleName} ${formData.lastName}`.trim();
      const response = await api.post('/auth/register', {
        id: formData.staffId,
        name: fullName,
        email: formData.email,
        password: formData.password,
        position: formData.position,
        department: formData.department,
        phone: formData.phone,
      });

      setSuccess('Registration submitted successfully! Please wait for admin approval to login.');
      setSubmitted(true);
      // Don't auto-redirect anymore - let user see the message
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Show success page after submission
  if (submitted) {
    const glowingStyle = `
      @keyframes glow {
        0% {
          box-shadow: 
            0 0 10px rgba(59, 130, 246, 0.8),
            0 0 20px rgba(59, 130, 246, 0.6),
            0 0 30px rgba(59, 130, 246, 0.4),
            0 0 40px rgba(59, 130, 246, 0.2),
            0 20px 40px rgba(0, 0, 0, 0.2);
        }
        50% {
          box-shadow: 
            0 0 20px rgba(59, 130, 246, 1),
            0 0 30px rgba(59, 130, 246, 0.8),
            0 0 50px rgba(59, 130, 246, 0.6),
            0 0 70px rgba(59, 130, 246, 0.4),
            0 20px 40px rgba(0, 0, 0, 0.3);
        }
        100% {
          box-shadow: 
            0 0 10px rgba(59, 130, 246, 0.8),
            0 0 20px rgba(59, 130, 246, 0.6),
            0 0 30px rgba(59, 130, 246, 0.4),
            0 0 40px rgba(59, 130, 246, 0.2),
            0 20px 40px rgba(0, 0, 0, 0.2);
        }
      }
      .glowing-form {
        animation: glow 3s ease-in-out infinite;
        border: 2px solid rgba(59, 130, 246, 0.5);
      }
    `;

    return (
      <div 
        className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
        style={{
          backgroundImage: 'linear-gradient(rgba(59, 131, 246, 0.36), rgba(37, 100, 235, 0.73)), url(/login.jpg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundAttachment: 'fixed',
        }}
      >
        {/* Blue gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600/40 via-blue-500/40 to-blue-700/40" />
        
        <style>{glowingStyle}</style>
        
        <div className="bg-white rounded-lg shadow-lg p-8 w-full max-w-md text-center relative glowing-form">
          <div className="mb-6">
            <div className="inline-block bg-green-100 text-green-600 rounded-full p-4 mb-4">
              <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-gray-800 mb-2">Account Created!</h1>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 text-left">
            <p className="text-blue-900 font-semibold mb-2">⏳ Pending Admin Approval</p>
            <p className="text-blue-800 text-sm mb-3">
              Your account has been successfully created and submitted for admin approval.
            </p>
            <p className="text-blue-800 text-sm mb-3">
              <strong>What happens next:</strong>
            </p>
            <ul className="text-blue-800 text-sm list-disc list-inside space-y-1">
              <li>An administrator will review your registration</li>
              <li>Once approved, you'll be able to login with your credentials</li>
              <li>You'll receive a notification when your account is approved</li>
            </ul>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
            <p className="text-yellow-800 text-sm">
              <strong>Note:</strong> You cannot login until your account is approved by an administrator.
            </p>
          </div>

          <div className="space-y-3">
            <button
              onClick={() => navigate('/login')}
              className="w-full bg-blue-600 text-white py-2 rounded-lg font-medium hover:bg-blue-700 transition"
            >
              Go to Login
            </button>
            <button
              onClick={() => navigate('/register')}
              className="w-full bg-gray-300 text-gray-800 py-2 rounded-lg font-medium hover:bg-gray-400 transition"
            >
              Register Another Account
            </button>
          </div>

          <p className="text-gray-600 text-xs mt-6">
            Staff ID: <span className="font-semibold">{formData.staffId}</span>
          </p>
        </div>
      </div>
    );
  }

  const glowingStyle = `
    @keyframes glow {
      0% {
        box-shadow: 
          0 0 10px rgba(59, 130, 246, 0.8),
          0 0 20px rgba(59, 130, 246, 0.6),
          0 0 30px rgba(59, 130, 246, 0.4),
          0 0 40px rgba(59, 130, 246, 0.2),
          0 20px 40px rgba(0, 0, 0, 0.2);
      }
      50% {
        box-shadow: 
          0 0 20px rgba(59, 130, 246, 1),
          0 0 30px rgba(59, 130, 246, 0.8),
          0 0 50px rgba(59, 130, 246, 0.6),
          0 0 70px rgba(59, 130, 246, 0.4),
          0 20px 40px rgba(0, 0, 0, 0.3);
      }
      100% {
        box-shadow: 
          0 0 10px rgba(59, 130, 246, 0.8),
          0 0 20px rgba(59, 130, 246, 0.6),
          0 0 30px rgba(59, 130, 246, 0.4),
          0 0 40px rgba(59, 130, 246, 0.2),
          0 20px 40px rgba(0, 0, 0, 0.2);
      }
    }
    .glowing-form {
      animation: glow 3s ease-in-out infinite;
      border: 2px solid rgba(59, 130, 246, 0.5);
    }
  `;

  return (
    <div 
      className="min-h-screen flex items-center justify-center p-4 py-8 relative overflow-hidden"
      style={{
        backgroundImage: 'linear-gradient(rgba(59, 131, 246, 0.36), rgba(37, 100, 235, 0.73)), url(/login.jpg)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed',
      }}
    >
      {/* Blue gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-600/40 via-blue-500/40 to-blue-700/40" />
      
      <style>{glowingStyle}</style>
      
      <div className="bg-white rounded-lg shadow-lg p-8 w-full max-w-md relative glowing-form">
        <div className="text-center mb-8">
          <img 
            src="/logo.PNG" 
            alt="LALA LGU Logo" 
            className="w-20 h-20 mx-auto mb-4 object-contain"
          />
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Create Account</h1>
          <p className="text-1xl text-gray-400">Register as a new staff member</p>
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

        <form onSubmit={handleRegister} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Staff ID *
            </label>
            <input
              type="text"
              name="staffId"
              value={formData.staffId}
              onChange={handleChange}
              placeholder="e.g., S001"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={loading}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              First Name *
            </label>
            <input
              type="text"
              name="firstName"
              value={formData.firstName}
              onChange={handleChange}
              placeholder="John"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={loading}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Middle Name
            </label>
            <input
              type="text"
              name="middleName"
              value={formData.middleName}
              onChange={handleChange}
              placeholder="(Optional)"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={loading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Last Name *
            </label>
            <input
              type="text"
              name="lastName"
              value={formData.lastName}
              onChange={handleChange}
              placeholder="Doe"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={loading}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email Address *
            </label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="you@example.com"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={loading}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Position
            </label>
            <input
              type="text"
              name="position"
              value={formData.position}
              onChange={handleChange}
              placeholder="e.g., Administrative Officer"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={loading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Department
            </label>
            <input
              type="text"
              name="department"
              value={formData.department}
              onChange={handleChange}
              placeholder="e.g., Finance"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={loading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Phone Number
            </label>
            <input
              type="tel"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              placeholder="e.g., 09123456789"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={loading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Date of Birth
            </label>
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
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Place of Birth
            </label>
            <input
              type="text"
              name="placeOfBirth"
              value={formData.placeOfBirth}
              onChange={handleChange}
              placeholder="e.g., Manila, Philippines"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={loading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              TIN #
            </label>
            <input
              type="text"
              name="tinNumber"
              value={formData.tinNumber}
              onChange={handleChange}
              placeholder="e.g., 123-456-789"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={loading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Password *
            </label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="••••••••"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={loading}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Confirm Password *
            </label>
            <input
              type="password"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              placeholder="••••••••"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={loading}
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2 rounded-lg font-medium hover:bg-blue-700 transition disabled:opacity-50"
          >
            {loading ? 'Registering...' : 'Register'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-gray-600 text-sm">
            Already have an account?{' '}
            <Link to="/login" className="text-blue-600 hover:text-blue-700 font-medium">
              Login here
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
