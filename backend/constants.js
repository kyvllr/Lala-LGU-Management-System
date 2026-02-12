// Role definitions
const ROLES = {
  SUPER_ADMIN: 'super_admin',
  ADMIN_HR: 'admin_hr',
  HEAD_REQUISITIONING_OFFICE: 'head_requisitioning_office',
  MUNICIPAL_BUDGET_OFFICER: 'municipal_budget_officer',
  MUNICIPAL_ASSESSOR: 'municipal_assessor',
  JOB_ORDER_OFFICER: 'job_order_officer',
  HEAD_OFFICER: 'head_officer',
  STAFF: 'staff'
};

// Departments
const DEPARTMENTS = [
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
const ROLE_DISPLAY_NAMES = {
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
const ROLES_WITH_DEPARTMENTS = [ROLES.HEAD_OFFICER, ROLES.STAFF];

// Role hierarchy (higher number = more permissions)
// Admin/HR has same permissions as Super Admin (both 5)
const ROLE_HIERARCHY = {
  super_admin: 5,
  admin_hr: 5,
  head_requisitioning_office: 4,
  municipal_budget_officer: 4,
  municipal_assessor: 4,
  job_order_officer: 3,
  head_officer: 2,
  staff: 1
};

module.exports = {
  ROLES,
  DEPARTMENTS,
  ROLE_DISPLAY_NAMES,
  ROLES_WITH_DEPARTMENTS,
  ROLE_HIERARCHY
};
