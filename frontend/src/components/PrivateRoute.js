import React from 'react';
import { Navigate } from 'react-router-dom';
import { isAdmin, normalizeRole } from '../constants';

export default function PrivateRoute({ children, requiredRole }) {
  const token = localStorage.getItem('token');
  const userStr = localStorage.getItem('user');
  const user = userStr ? JSON.parse(userStr) : null;

  if (!token || !user) {
    return <Navigate to="/login" replace />;
  }

  if (requiredRole) {
    const required = normalizeRole(requiredRole);
    const actual = normalizeRole(user.role);

    // App routes use legacy labels: requiredRole="admin" or "staff"
    if (requiredRole === 'admin') {
      if (!isAdmin(actual)) return <Navigate to="/unauthorized" replace />;
    } else if (requiredRole === 'staff') {
      if (actual !== 'staff') return <Navigate to="/unauthorized" replace />;
    } else if (actual !== required) {
      return <Navigate to="/unauthorized" replace />;
    }
  }

  return children;
}
