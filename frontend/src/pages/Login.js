import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../api';

export default function Login({ setUser }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();



  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!email || !password) {
      setError('Please enter both email and password');
      setLoading(false);
      return;
    }

    try {
      const response = await api.post('/auth/login', {
        email,
        password,
      });

      // Store JWT token in localStorage
      localStorage.setItem('token', response.data.token);
      localStorage.setItem('user', JSON.stringify(response.data.user));

      // Set default header for future requests
      api.defaults.headers.common['Authorization'] = `Bearer ${response.data.token}`;

      // Update parent component state
      if (setUser) {
        setUser(response.data.user);
      }

      // Redirect to dashboard
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      className="min-h-screen flex items-center justify-center p-4"
      style={{
        backgroundImage: `linear-gradient(rgba(138, 219, 246, 0.48), rgba(255, 255, 255, 0.2)), url('/login.jpg')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed'
      }}
    >
      <div className="bg-white rounded-lg p-8 w-full max-w-md backdrop-blur-sm" style={{ opacity: 0.85 }}>
        <div className="text-center mb-8">
          <img 
            src="/logo.PNG" 
            alt="LALA LGU Logo" 
            className="w-24 h-24 mx-auto mb-4 object-contain"
          />
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Leave & Travel System</h1>
          <p className="text-gray-600">Login to your account</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={loading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={loading}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2 rounded-lg font-medium hover:bg-blue-700 transition disabled:opacity-50"
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-gray-600 text-sm">
            Don't have an account?{' '}
            <Link to="/register" className="text-blue-600 hover:text-blue-700 font-medium">
              Register here
            </Link>
          </p>
          <p className="text-gray-600 text-sm mt-2">
            Need to file requirements?{' '}
            <Link to="/submit-personal-data-sheet" className="text-blue-600 hover:text-blue-700 font-medium">
              Submit personal data sheet
            </Link>
          </p>
        </div>

        
      </div>
    </div>
  );
}
