// Role definitions
export const ROLES = {
  SUPER_ADMIN: 'super_admin',
  ADMIN_HR: 'admin_hr',
  HEAD_REQUISITIONING_OFFICE: 'head_requisitioning_office',
  MUNICIPAL_BUDGET_OFFICER: 'municipal_budget_officer',
  MUNICIPAL_ASSESSOR: 'municipal_assessor',
  JOB_ORDER_OFFICER: 'job_order_officer',
  HEAD_OFFICER: 'head_officer',
  STAFF: 'staff'
};

export const normalizeRole = (rawRole) => {
  if (!rawRole) return rawRole;
  const role = String(rawRole).trim().toLowerCase();

  // Backward compatibility for older DB/UI role values
  if (role === 'admin' || role === 'hr' || role === 'human_resources') return ROLES.ADMIN_HR;
  if (role === 'superadmin' || role === 'super-admin' || role === 'mayor') return ROLES.SUPER_ADMIN;

  return role;
};

// Departments
export const DEPARTMENTS = [
  'Engineering',
  'LCR',
  'Planning',
  'Finance',
  'HR',
  'Administration',
  'Health Services',
  'Public Safety',
  'Social Services',
  'Requisitioning Office',
  'Budget Office',
  'Assessor Office'
];

// Role display names
export const ROLE_DISPLAY_NAMES = {
  super_admin: 'Super Admin/Mayor',
  admin_hr: 'Admin/HR (Human Resources)',
  head_requisitioning_office: 'Head of Requisitioning Office',
  municipal_budget_officer: 'Municipal Budget Officer',
  municipal_assessor: 'Municipal Assessor',
  job_order_officer: 'Job Order Officer',
  head_officer: 'Head Officer',
  staff: 'Staff'
};

// Roles that require department selection
export const ROLES_WITH_DEPARTMENTS = [ROLES.HEAD_OFFICER, ROLES.STAFF];

// Role hierarchy (higher number = more permissions)
// Admin/HR has same permissions as Super Admin (both 5)
export const ROLE_HIERARCHY = {
  super_admin: 5,
  admin_hr: 5,
  // legacy
  admin: 5,
  head_requisitioning_office: 4,
  municipal_budget_officer: 4,
  municipal_assessor: 4,
  job_order_officer: 3,
  head_officer: 2,
  staff: 1
};

// Check if a role has higher or equal permissions than another role
export const hasHigherOrEqualPermissions = (userRole, requiredRole) => {
  const user = normalizeRole(userRole);
  const required = normalizeRole(requiredRole);
  return (ROLE_HIERARCHY[user] || 0) >= (ROLE_HIERARCHY[required] || 0);
};

// Check if a role is an admin
export const isAdmin = (role) => {
  const normalized = normalizeRole(role);
  return [ROLES.SUPER_ADMIN, ROLES.ADMIN_HR].includes(normalized);
};
