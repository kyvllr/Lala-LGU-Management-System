// Role definitions
export const ROLES = {
  SUPER_ADMIN: 'super_admin',
  ADMIN_HR: 'admin_hr',
  JOB_ORDER_OFFICER: 'job_order_officer',
  HEAD_OFFICER: 'head_officer',
  STAFF: 'staff'
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
  'Social Services'
];

// Role display names
export const ROLE_DISPLAY_NAMES = {
  super_admin: 'Super Admin/Mayor',
  admin_hr: 'Admin/HR',
  job_order_officer: 'Job Order Officer',
  head_officer: 'Head Officer',
  staff: 'Staff'
};

// Roles that require department selection
export const ROLES_WITH_DEPARTMENTS = [ROLES.HEAD_OFFICER, ROLES.STAFF];

// Role hierarchy (higher number = more permissions)
export const ROLE_HIERARCHY = {
  super_admin: 5,
  admin_hr: 4,
  job_order_officer: 3,
  head_officer: 2,
  staff: 1
};

// Check if a role has higher or equal permissions than another role
export const hasHigherOrEqualPermissions = (userRole, requiredRole) => {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
};

// Check if a role is an admin
export const isAdmin = (role) => {
  return [ROLES.SUPER_ADMIN, ROLES.ADMIN_HR].includes(role);
};
