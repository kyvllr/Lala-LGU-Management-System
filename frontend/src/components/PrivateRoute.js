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
    const requiredRoles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
    const actual = normalizeRole(user.role);

    const hasAccess = requiredRoles.some((role) => {
      const normalizedRequired = normalizeRole(role);

      // App routes use legacy labels: requiredRole="admin" or "staff"
      if (role === 'admin') return isAdmin(actual);
      if (role === 'staff') return actual === 'staff';

      return actual === normalizedRequired;
    });

    if (!hasAccess) {
      return <Navigate to="/unauthorized" replace />;
    }
  }

  return children;
}
