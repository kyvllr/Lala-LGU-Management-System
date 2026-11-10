const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { ROLES, DEPARTMENTS, ROLE_DISPLAY_NAMES, ROLES_WITH_DEPARTMENTS, ROLE_HIERARCHY } = require('./constants');
const { randomUUID } = require('crypto');
require('dotenv').config();


const app = express();
// Vercel routes the backend under /api; strip it so the routes below match either way.
app.use((req, res, next) => {
  if (req.url === '/api' || req.url.startsWith('/api/') || req.url.startsWith('/api?')) {
    req.url = req.url.slice(4) || '/';
  }
  next();
});
const PORT = process.env.PORT || 5001;
const IS_VERCEL = Boolean(process.env.VERCEL);
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const VAULT_BASE_UPLOAD_DIR = path.join(__dirname, 'uploads', 'vault');
const VAULT_DEFAULT_FOLDER = 'General';
const PAYMENT_PROOF_UPLOAD_DIR = path.join(__dirname, 'uploads', 'payment-proofs');

// The Vercel filesystem is read-only outside /tmp, so only create upload folders locally.
if (!IS_VERCEL) {
  if (!fs.existsSync(VAULT_BASE_UPLOAD_DIR)) {
    fs.mkdirSync(VAULT_BASE_UPLOAD_DIR, { recursive: true });
  }
  if (!fs.existsSync(PAYMENT_PROOF_UPLOAD_DIR)) {
    fs.mkdirSync(PAYMENT_PROOF_UPLOAD_DIR, { recursive: true });
  }
}

const sanitizeFolderName = (name) => String(name || '')
  .trim()
  .replace(/[<>:"/\\|?*\x00-\x1F]/g, '')
  .replace(/\s+/g, ' ')
  .slice(0, 120);

const ensureVaultFolderPath = (ownerStaffId, folderName) => {
  const safeOwner = String(ownerStaffId || 'unknown').replace(/[^a-zA-Z0-9_-]/g, '_');
  const safeFolder = sanitizeFolderName(folderName) || VAULT_DEFAULT_FOLDER;
  const folderPath = path.join(VAULT_BASE_UPLOAD_DIR, safeOwner, safeFolder);
  if (!fs.existsSync(folderPath)) {
    fs.mkdirSync(folderPath, { recursive: true });
  }
  return folderPath;
};

const getVaultOwnerStaffId = (user) => String(user?.staffId || user?.id || user?.email || 'admin');

const LEAVE_TYPES = [
  'Vacation Leave',
  'Mandatory/Force Leave',
  'Sick Leave',
  'Wellness',
  'Maternity Leave',
  'Paternity Leave',
  'Special Privilege Leave',
  'Solo Parent Leave',
  'Study Leave',
  '10-Day VAWC Leave',
  'Tardy',
  'Undertime',
  'Special Leave Benefits for Women',
  'Special Emergency (Calamity) Leave',
  'Adoption Leave',
  'Rehabilitation Privilege',
  'Others',
  'CTO',
  'Earned Leave',
  'Monetization',
  // Backward-compatibility for older saved values
  'Vacation',
  'Emergency Leave',
  'Special Leave',
];

const FORCE_LEAVE_MAX_DAYS_PER_APPLICATION = 5;
const WELLNESS_ANNUAL_LIMIT = 5;

const resolveLeaveCalendarYear = (leaveDoc) => {
  const rangeStarts = (Array.isArray(leaveDoc?.dateRanges) ? leaveDoc.dateRanges : [])
    .map((range) => range?.startDate || range?.from)
    .filter(Boolean)
    .map((value) => new Date(value))
    .filter((date) => !Number.isNaN(date.getTime()))
    .sort((a, b) => a - b);
  const candidates = [rangeStarts[0], leaveDoc?.startDate, leaveDoc?.filingDate, leaveDoc?.createdAt];

  for (const candidate of candidates) {
    if (!candidate) continue;
    const parsed = new Date(candidate);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.getFullYear();
    }
  }

  return new Date().getFullYear();
};

const getApprovedLeaveDaysForYear = async ({ staffId, leaveTypes, year, excludeLeaveId }) => {
  const query = {
    staffId,
    status: 'Approved',
    leaveType: { $in: leaveTypes },
  };
  if (excludeLeaveId) {
    query.leaveId = { $ne: excludeLeaveId };
  }

  const approvedLeaves = await Leave.find(query)
    .select('startDate dateRanges filingDate createdAt numberOfDays')
    .lean();

  return approvedLeaves.reduce((sum, leave) => (
    resolveLeaveCalendarYear(leave) === year
      ? sum + (Number(leave.numberOfDays) || 0)
      : sum
  ), 0);
};

const generateNextTravelControlNo = async (dateSource = new Date()) => {
  const date = new Date(dateSource);
  const year = Number.isNaN(date.getTime()) ? new Date().getFullYear() : date.getFullYear();
  const yearPrefix = `CO-${year}-`;

  const existingControlNos = await TravelOrder.find({
    controlNo: { $regex: `^${yearPrefix}` },
  })
    .select('controlNo -_id')
    .lean();

  let maxSequence = 0;
  existingControlNos.forEach((record) => {
    const controlNo = record?.controlNo;
    if (!controlNo) return;

    const sequence = Number.parseInt(controlNo.replace(yearPrefix, ''), 10);
    if (!Number.isNaN(sequence) && sequence > maxSequence) {
      maxSequence = sequence;
    }
  });

  const nextSequence = String(maxSequence + 1).padStart(3, '0');
  return `${yearPrefix}${nextSequence}`;
};

const normalizeRole = (rawRole) => {
  if (!rawRole) return rawRole;
  const role = String(rawRole).trim().toLowerCase();

  // Backward-compatibility: older versions used simple role values.
  if (role === 'admin' || role === 'hr' || role === 'human_resources') {
    return ROLES.ADMIN_HR;
  }
  if (role === 'superadmin' || role === 'super-admin' || role === 'mayor') {
    return ROLES.SUPER_ADMIN;
  }

  return role;
};

const isSystemAdminRole = (rawRole) => {
  const role = normalizeRole(rawRole);
  return [ROLES.SUPER_ADMIN, ROLES.ADMIN_HR].includes(role);
};

const hasActivePdsUpdatePermission = (record) => {
  if (!record || record.updatePermissionGranted !== true) {
    return false;
  }

  if (!record.updatePermissionExpiresAt) {
    return true;
  }

  const expiresAt = new Date(record.updatePermissionExpiresAt);
  if (Number.isNaN(expiresAt.getTime())) {
    return false;
  }

  return expiresAt.getTime() > Date.now();
};

const resolvePermissionExpiryDate = (durationDays) => {
  if (durationDays == null) {
    return undefined;
  }

  const parsed = Number(durationDays);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return new Date(Date.now() + parsed * 24 * 60 * 60 * 1000);
};

const resolveDpcrfLockWindowMs = (unit, value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  const multiplier = {
    days: 24 * 60 * 60 * 1000,
    weeks: 7 * 24 * 60 * 60 * 1000,
    months: 30 * 24 * 60 * 60 * 1000,
  }[String(unit || '').toLowerCase()];

  if (!multiplier) {
    return null;
  }

  return parsed * multiplier;
};

const getDpcrfPermissionState = (permission, now = Date.now()) => {
  if (!permission) {
    return false;
  }

  const expiryDate = permission.expiresAt ? new Date(permission.expiresAt) : null;
  const hasValidExpiry = expiryDate && Number.isFinite(expiryDate.getTime());
  const expiryPassed = hasValidExpiry && expiryDate.getTime() <= now;

  if (permission.allowUpdate === true) {
    return !hasValidExpiry || !expiryPassed;
  }

  if (permission.allowUpdate === false && hasValidExpiry && expiryPassed) {
    return true;
  }

  return false;
};

const normalizeDpcrfPermissionRecord = (permission, yearValue) => {
  const record = permission || {};
  const now = Date.now();

  return {
    year: Number.isFinite(Number(yearValue)) ? Number(yearValue) : record.year || null,
    allowUpdate: getDpcrfPermissionState(record, now),
    lockMode: ['manual', 'days', 'weeks', 'months'].includes(String(record.lockMode || 'manual').toLowerCase())
      ? String(record.lockMode).toLowerCase()
      : 'manual',
    durationValue: Number.isFinite(Number(record.durationValue)) && Number(record.durationValue) > 0
      ? Number(record.durationValue)
      : null,
    expiresAt: record.expiresAt || null,
    updatedBy: record.updatedBy || '',
    updatedAt: record.updatedAt || null,
  };
};

const canUpdateDpcrfPart = (permission) => getDpcrfPermissionState(permission);


// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

const vaultStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const ownerStaffId = getVaultOwnerStaffId(req.user);
    const requestedFolder = sanitizeFolderName(req.body?.folder) || VAULT_DEFAULT_FOLDER;
    const folderPath = ensureVaultFolderPath(ownerStaffId, requestedFolder);
    cb(null, folderPath);
  },
  filename: (req, file, cb) => {
    const extension = path.extname(file.originalname || '');
    const baseName = path.basename(file.originalname || 'file', extension).replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${Date.now()}-${Math.random().toString(16).slice(2)}-${baseName}${extension}`);
  },
});

const uploadVaultFiles = multer({
  storage: vaultStorage,
  limits: {
    fileSize: 50 * 1024 * 1024,
    files: 25,
  },
});

const paymentProofStorage = multer.diskStorage({
  destination: PAYMENT_PROOF_UPLOAD_DIR,
  filename: (req, file, cb) => {
    cb(null, `${randomUUID()}${path.extname(file.originalname || '').toLowerCase()}`);
  },
});
const uploadPaymentProof = multer({
  storage: paymentProofStorage,
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = ['application/pdf', 'image/jpeg', 'image/png'];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      cb(new Error('Proof of payment must be a PDF, JPG, or PNG file.'));
      return;
    }
    cb(null, true);
  },
});

const removeUploadedPaymentProof = (file) => {
  if (file?.path && fs.existsSync(file.path)) {
    fs.unlinkSync(file.path);
  }
};

const getPaymentProofMetadata = (file) => ({
  fileName: path.basename(file.originalname || 'proof-of-payment'),
  storageName: path.basename(file.filename),
  mimeType: file.mimetype,
  size: file.size,
});

// JWT Verification Middleware
const verifyToken = (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1];
  
  if (!token) {
    return res.status(403).json({ message: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    Staff.findOne({ id: decoded.staffId })
      .select('id isActive')
      .lean()
      .then((staff) => {
        if (!staff) {
          return res.status(401).json({ message: 'Invalid or expired token' });
        }

        if (staff.isActive === false) {
          return res.status(403).json({ message: 'Your account is deactivated. Please contact an administrator.' });
        }

        req.user = {
          ...decoded,
          role: normalizeRole(decoded.role),
        };
        return next();
      })
      .catch((error) => {
        console.error('Error validating token user:', error);
        return res.status(500).json({ message: 'Failed to validate token' });
      });
  } catch (error) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
};

const verifyTokenIfPresent = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader?.split(' ')[1];

  if (!token) {
    req.user = null;
    return next();
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = {
      ...decoded,
      role: normalizeRole(decoded.role),
    };
    return next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
};

// Check if user can manage staff in a specific department
const canManageStaff = (userRole, userDepartment, targetStaffDepartment) => {
  // Super Admin and Admin/HR can manage all staff
  if (isSystemAdminRole(userRole)) {
    return true;
  }
  
  // Head Officer can manage staff in their own department
  if (userRole === ROLES.HEAD_OFFICER && userDepartment === targetStaffDepartment) {
    return true;
  }
  
  return false;
};

// Check if user can view staff in a specific department
const canViewStaff = (userRole, userDepartment, targetStaffDepartment) => {
  // Can manage = can view
  if (canManageStaff(userRole, userDepartment, targetStaffDepartment)) {
    return true;
  }
  
  // Staff can only view their own profile
  if (userRole === ROLES.STAFF && userDepartment === targetStaffDepartment) {
    return true;
  }
  
  return false;
};

const isDepartmentStaffManager = (user) => {
  const role = normalizeRole(user?.role);
  return isSystemAdminRole(role) || role === ROLES.HEAD_OFFICER;
};

const getDepartmentStaff = async (user) => {
  const role = normalizeRole(user?.role);
  if (isSystemAdminRole(role)) return null;
  if (role !== ROLES.HEAD_OFFICER || !String(user?.department || '').trim()) return [];

  return Staff.find({ department: String(user.department).trim() })
    .select('id email department')
    .lean();
};

const canManageStaffId = async (user, staffId) => {
  const role = normalizeRole(user?.role);
  if (isSystemAdminRole(role)) return true;
  if (role !== ROLES.HEAD_OFFICER || !String(staffId || '').trim()) return false;

  const staff = await Staff.findOne({ id: String(staffId).trim() }).select('department').lean();
  return Boolean(staff && staff.department === user.department);
};

const getPdsDepartmentFilter = (staffAccounts) => {
  const staffIds = (staffAccounts || []).map((staff) => String(staff.id || '').trim()).filter(Boolean);
  const staffEmails = (staffAccounts || [])
    .map((staff) => String(staff.email || '').trim().toLowerCase())
    .filter(Boolean);
  const filters = [];
  if (staffIds.length) {
    filters.push({ ownerStaffId: { $in: staffIds } }, { submittedByStaffId: { $in: staffIds } });
  }
  if (staffEmails.length) {
    filters.push(
      { ownerEmail: { $in: staffEmails } },
      { submittedByEmail: { $in: staffEmails } },
      { email: { $in: staffEmails } },
      {
        $and: [
          { ownerEmail: { $in: [null, ''] } },
          { email: { $in: staffEmails } },
        ],
      }
    );
  }
  return filters.length ? { $or: filters } : { _id: null };
};

const canManagePdsRecord = async (user, pds) => {
  if (isSystemAdminRole(user?.role)) return true;
  if (normalizeRole(user?.role) !== ROLES.HEAD_OFFICER || !pds) return false;

  const staffId = String(pds.ownerStaffId || pds.submittedByStaffId || '').trim();
  const email = String(pds.ownerEmail || pds.email || pds.submittedByEmail || '').trim().toLowerCase();
  const identityFilter = [
    ...(staffId ? [{ id: staffId }] : []),
    ...(email ? [{ email: { $regex: `^${email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' } }] : []),
  ];
  if (!identityFilter.length) return false;

  const staff = await Staff.findOne({ $or: identityFilter }).select('department').lean();
  return Boolean(staff && staff.department === user.department);
};

// Middleware for role-based Middleware (allows super_admin to bypass all checks)
const requireRole = (allowedRoles) => {
  // Convert single role string to array
  const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
  
  return (req, res, next) => {
    const userRole = normalizeRole(req.user?.role);
    const normalizedAllowed = roles.map(normalizeRole);
    
    // Super admin can access everything
    if (userRole === ROLES.SUPER_ADMIN) {
      next();
      return;
    }
    
    // Check if user's role is in allowed roles
    if (!normalizedAllowed.includes(userRole)) {
      console.log(`Access denied - Required: ${normalizedAllowed.join(', ')}, User role: ${userRole}`);
      return res.status(403).json({ message: 'Access denied. Insufficient permissions.' });
    }
    
    next();
  };
};


// Connect to MongoDB Atlas
if (!process.env.MONGODB_URI) {
  console.error('Error: MONGODB_URI environment variable is not set');
  process.exit(1);
}

mongoose.connect(process.env.MONGODB_URI)
.then(() => console.log('Connected to MongoDB Atlas'))
.catch((err) => console.error('MongoDB connection error:', err));


// Define Staff Schema
const staffSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  profilePhotoDataUrl: { type: String, default: '' },
  sexAtBirth: { type: String, enum: ['', 'Male', 'Female'], default: '' },
  role: { 
    type: String, 
    enum: [...Object.values(ROLES), 'admin'],
    default: ROLES.STAFF,
    required: true
  },
  department: {
    type: String,
    enum: DEPARTMENTS,
    sparse: true
  },
  position: String,
  phone: String,
  dateOfBirth: Date,
  placeOfBirth: String,
  tinNumber: String,
  businessPartnerNumber: String,
  philhealthNo: String,
  pagibigNo: String,
  maritalStatus: String,
  dateHired: Date,
  address: String,
  employmentStatus: String,
  lengthOfService: String,
  monthlyBasicSalary: Number,
  peraRata: String,
  grossSalary: Number,
  pendingAdministrativeCase: Boolean,
  pendingCriminalCase: Boolean,
  salaryGrade: String,
  isApproved: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },
  approvedAt: Date,
  approvedBy: String,
  eSignPermission: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});

const staffUpdateRequestSchema = new mongoose.Schema({
  requestId: { type: String, required: true, unique: true },
  staffId: { type: String, required: true },
  staffName: { type: String, default: '' },
  staffEmail: { type: String, default: '' },
  currentFields: { type: mongoose.Schema.Types.Mixed, required: true },
  requestedFields: { type: mongoose.Schema.Types.Mixed, required: true },
  status: { type: String, enum: ['Pending', 'Approved', 'Rejected'], default: 'Pending', index: true },
  reviewedBy: { type: String, default: '' },
  reviewedAt: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

staffUpdateRequestSchema.index(
  { staffId: 1 },
  { unique: true, partialFilterExpression: { status: 'Pending' } }
);

const normalizeStaffProfileFields = (payload) => {
  const fields = {};
  const textFields = [
    'address',
    'employmentStatus',
    'lengthOfService',
    'peraRata',
    'salaryGrade',
    'businessPartnerNumber',
    'philhealthNo',
    'pagibigNo',
    'maritalStatus',
  ];
  const salaryFields = ['monthlyBasicSalary', 'grossSalary'];
  const caseFields = ['pendingAdministrativeCase', 'pendingCriminalCase'];

  textFields.forEach((field) => {
    if (Object.prototype.hasOwnProperty.call(payload, field)) {
      fields[field] = payload[field] == null ? '' : String(payload[field]).trim();
    }
  });

  for (const field of salaryFields) {
    if (!Object.prototype.hasOwnProperty.call(payload, field)) continue;
    const value = payload[field];
    if (value === '' || value === null || value === undefined) {
      fields[field] = undefined;
      continue;
    }

    const amount = Number(value);
    if (!Number.isFinite(amount) || amount < 0) {
      return { error: `${field} must be a non-negative number` };
    }
    fields[field] = amount;
  }

  for (const field of caseFields) {
    if (!Object.prototype.hasOwnProperty.call(payload, field)) continue;
    const value = payload[field];
    if (value === '' || value === null || value === undefined) {
      fields[field] = undefined;
    } else if (value === true || value === 'true') {
      fields[field] = true;
    } else if (value === false || value === 'false') {
      fields[field] = false;
    } else {
      return { error: `${field} must be true or false` };
    }
  }

  return { fields };
};

const calculateStaffLengthOfService = (dateValue, now = new Date()) => {
  if (!dateValue) return '';
  const start = new Date(dateValue);
  if (Number.isNaN(start.getTime())) return '';

  const startDay = Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate());
  const end = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  if (startDay > end) return '';

  let totalMonths = (now.getUTCFullYear() - start.getUTCFullYear()) * 12
    + now.getUTCMonth() - start.getUTCMonth();
  const startDayOfMonth = start.getUTCDate();
  const endDayOfMonth = new Date(end).getUTCDate();
  const lastDayOfTargetMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).getUTCDate();
  if (endDayOfMonth < Math.min(startDayOfMonth, lastDayOfTargetMonth)) totalMonths -= 1;

  const elapsedYears = Math.floor(totalMonths / 12);
  const elapsedMonths = totalMonths % 12;
  const anchorMonth = start.getUTCMonth() + totalMonths;
  const anchorYear = start.getUTCFullYear() + Math.floor(anchorMonth / 12);
  const normalizedAnchorMonth = ((anchorMonth % 12) + 12) % 12;
  const anchorDay = Math.min(
    startDayOfMonth,
    new Date(Date.UTC(anchorYear, normalizedAnchorMonth + 1, 0)).getUTCDate()
  );
  const anchor = Date.UTC(anchorYear, normalizedAnchorMonth, anchorDay);
  const remainingDays = Math.floor((end - anchor) / 86400000);
  const elapsedWeeks = Math.floor(remainingDays / 7);
  const elapsedDays = remainingDays % 7;

  return [
    elapsedYears ? `${elapsedYears} ${elapsedYears === 1 ? 'year' : 'years'}` : '',
    elapsedMonths ? `${elapsedMonths} ${elapsedMonths === 1 ? 'month' : 'months'}` : '',
    elapsedWeeks ? `${elapsedWeeks} ${elapsedWeeks === 1 ? 'week' : 'weeks'}` : '',
    elapsedDays ? `${elapsedDays} ${elapsedDays === 1 ? 'day' : 'days'}` : '',
  ].filter(Boolean).join(', ') || '0 days';
};


// Define Leave Schema
const leaveSchema = new mongoose.Schema({
  leaveId: { type: String, required: true, unique: true },
  staffId: { type: String, required: true },
  staffName: String,
  staffDepartment: String,
  office: String,
  position: String,
  salary: Number,
  filingDate: Date,
  leaveType: { 
    type: String, 
    enum: LEAVE_TYPES,
    required: true 
  },
  startDate: Date,
  endDate: Date,
  numberOfDays: Number,
  dateRanges: [
    {
      startDate: Date,
      endDate: Date,
    }
  ],
  lateFilingExplanation: String,
  reason: String,
  leaveDetailsSpecific: mongoose.Schema.Types.Mixed,
  communicationNotRequested: { type: Boolean, default: false },
  communicationRequested: { type: Boolean, default: false },
  status: { 
    type: String, 
    enum: ['Pending', 'For Revision', 'Approved', 'Disapproved'],
    default: 'Pending'
  },
  revisionRequestedBy: String,
  revisionRequestedByRole: String,
  revisionRequestedAt: Date,
  revisionComment: String,
  approvalStage: {
    type: String,
    enum: ['HeadOfficer', 'Admin'],
    default: 'HeadOfficer',
  },
  headOfficerApprovedBy: String,
  headOfficerApprovalDate: Date,
  headOfficerRemarks: String,
  approvedBy: String,
  approvalDate: Date,
  remarks: String,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});


// Define Travel Order Schema
const travelOrderSchema = new mongoose.Schema({
  travelOrderId: { type: String, required: true, unique: true },
  controlNo: { type: String, sparse: true },
  staffId: { type: String, required: true },
  staffName: String,
  staffDepartment: String,
  travelType: { type: String, enum: ['office', 'abroad'], default: 'office' },

  // Office/Travel Order form fields
  dateOfFiling: Date,
  designations: [String],
  permanentStation: String,
  purposeOfTravel: String,
  activitySponsoredBy: String,
  periodCoveredFrom: Date,
  periodCoveredTo: Date,
  officialBusiness: { type: Boolean, default: false },
  officialTime: { type: Boolean, default: false },
  meeting: { type: Boolean, default: false },
  travel: { type: Boolean, default: false },
  training: { type: Boolean, default: false },
  seminar: { type: Boolean, default: false },
  venueDestination: String,
  expensesCovered: String,
  fundSourcePapCode: String,
  recommendingApproval: String,

  // Travel Abroad form fields
  datePrepared: Date,
  region: String,
  province: String,
  municipality: String,
  abroadDateOfFiling: Date,
  abroadName: String,
  office: String,
  position: String,
  period: String,
  travelDestination: String,
  fundSource: String,
  attachment: String,

  destination: { type: String, required: true },
  purpose: { type: String, required: true },
  dateFrom: { type: Date, required: true },
  dateTo: { type: Date, required: true },
  numberOfDays: Number,
  transportMode: { 
    type: String, 
    enum: ['Land', 'Air', 'Sea', 'Mixed'],
    required: true 
  },
  estimatedBudget: Number,
  status: { 
    type: String, 
    enum: ['Pending', 'For Revision', 'Approved', 'Disapproved', 'Completed'],
    default: 'Pending'
  },
  revisionRequestedBy: String,
  revisionRequestedByRole: String,
  revisionRequestedAt: Date,
  revisionComment: String,
  approvalStage: {
    type: String,
    enum: ['HeadOfficer', 'Admin'],
    default: 'HeadOfficer',
  },
  headOfficerApprovedBy: String,
  headOfficerApprovalDate: Date,
  headOfficerRemarks: String,
  approvedBy: String,
  approvalDate: Date,
  remarks: String,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

// Define Overtime Schema
const overtimeSchema = new mongoose.Schema({
  overtimeId: { type: String, required: true, unique: true },
  staffId: { type: String, required: true },
  staffDepartment: String,
  firstName: String,
  lastName: String,
  middleName: String,
  staffName: String,
  office: String,
  position: String,
  filingDate: Date,
  purposeOfOvertime: { type: String, required: true },
  inclusiveDateStart: { type: Date, required: true },
  inclusiveDateEnd: { type: Date, required: true },
  officeStaffPersonnel: { type: Boolean, default: false },
  departmentHeadOfficer: { type: Boolean, default: false },
  staffDetails: [
    {
      name: String,
      position: String,
    }
  ],
  status: {
    type: String,
    enum: ['Pending', 'For Revision', 'Approved', 'Disapproved', 'Under Review'],
    default: 'Pending'
  },
  revisionRequestedBy: String,
  revisionRequestedByRole: String,
  revisionRequestedAt: Date,
  revisionComment: String,
  // Three-stage approval tracking (plus legacy values for backward compatibility)
  approvalStage: {
    type: String,
    enum: ['HeadOfficer', 'BudgetOfficer', 'Admin', 'Completed', 'pending', 'head_requisitioning_office', 'budget_officer', 'admin', 'completed', 'disapproved'],
    default: 'HeadOfficer'
  },
  headOfficerApprovedBy: String,
  headOfficerApprovalDate: Date,
  headOfficerRemarks: String,
  headRequisitioningOfficerApproval: {
    status: { type: String, enum: ['Pending', 'Approved', 'Disapproved'], default: 'Pending' },
    approvedBy: String,
    approvalDate: Date,
    remarks: String,
  },
  budgetOfficerApproval: {
    status: { type: String, enum: ['Pending', 'Approved', 'Disapproved'], default: 'Pending' },
    approvedBy: String,
    approvalDate: Date,
    remarks: String,
  },
  adminApproval: {
    status: { type: String, enum: ['Pending', 'Approved', 'Disapproved'], default: 'Pending' },
    approvedBy: String,
    approvalDate: Date,
    remarks: String,
  },
  // Legacy fields for backward compatibility
  approvalRemarks: String,
  approvedBy: String,
  approvalDate: Date,
  disapprovedBy: String,
  disapprovalDate: Date,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

// Define COE (Certificate of Employment) Schema
const coeSchema = new mongoose.Schema({
  coeId: { type: String, required: true, unique: true },
  staffId: { type: String, required: true, index: true },
  staffName: String,
  staffDepartment: String,
  
  // Request details
  fullName: String,
  purpose: String,
  dateOfApplication: Date,
  positionTitle: String,
  office: String,
  address: String,
  employmentStatus: String,
  lengthOfService: String,
  monthlySalary: Number,
  peraRata: String,
  grossSalary: Number,
  pendingAdministrativeCase: Boolean,
  pendingCriminalCase: Boolean,
  periodFrom: Date,
  periodTo: Date,
  numberOfCopies: { type: Number, default: 1 },
  remarks: String,
  paymentProof: {
    fileName: String,
    storageName: String,
    mimeType: String,
    size: Number,
  },
  
  // Status and approval tracking
  status: { 
    type: String, 
    enum: ['Pending', 'For Revision', 'Approved', 'Disapproved'],
    default: 'Pending'
  },
  revisionRequestedBy: String,
  revisionRequestedByRole: String,
  revisionRequestedAt: Date,
  revisionComment: String,
  approvedBy: String,
  approvalDate: Date,
  approvalRemarks: String,
  disapprovedBy: String,
  disapprovalDate: Date,
  disapprovalRemarks: String,
  
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

const noPendencyRequestSchema = new mongoose.Schema({
  requestId: { type: String, required: true, unique: true },
  staffId: { type: String, required: true, index: true },
  staffName: String,
  staffDepartment: String,
  fullName: { type: String, required: true },
  position: { type: String, required: true },
  pendingCase: { type: String, enum: ['Yes', 'No'], required: true },
  dateOfApplication: { type: Date, required: true },
  paymentProof: {
    fileName: String,
    storageName: String,
    mimeType: String,
    size: Number,
  },
  status: {
    type: String,
    enum: ['Pending', 'Approved', 'Disapproved'],
    default: 'Pending',
  },
  reviewedBy: String,
  reviewDate: Date,
  reviewRemarks: String,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

const noLeaveWithoutPayCertificateSchema = new mongoose.Schema({
  requestId: { type: String, required: true, unique: true },
  staffId: { type: String, required: true, index: true },
  staffName: String,
  staffDepartment: String,
  fullName: { type: String, required: true },
  position: { type: String, required: true },
  periodFrom: { type: Date, required: true },
  periodTo: { type: Date, required: true },
  dateOfApplication: { type: Date, required: true },
  paymentProof: {
    fileName: String,
    storageName: String,
    mimeType: String,
    size: Number,
  },
  status: {
    type: String,
    enum: ['Pending', 'Approved', 'Disapproved'],
    default: 'Pending',
  },
  reviewedBy: String,
  reviewDate: Date,
  reviewRemarks: String,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

// Define Service Record Schema
const serviceRecordSchema = new mongoose.Schema({
  recordId: { type: String, required: true, unique: true },
  staffId: { type: String, required: true },
  staffName: String,
  designation: String,
  status: String,
  salary: Number,
  station: String,
  branch: String,
  serviceFrom: { type: Date, required: true },
  serviceTo: { type: Date },
  leaveWithoutPayFrom: String,
  leaveWithoutPayTo: String,
  remarks: String,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

// Define Leave Record Schema (Periodic leave balance records)
const leaveRecordSchema = new mongoose.Schema({
  recordId: { type: String, required: true, unique: true },
  staffId: { type: String, required: true, index: true },
  staffName: String,
  period: { type: Date }, // legacy, optional for backward compatibility
    // New: support multiple date ranges
    dateRanges: [
      {
        from: { type: Date, required: true },
        to: { type: Date, required: true },
      }
    ],
  particulars: { type: String, required: true },
  numberOfDays: { type: Number, default: 0 }, // Log number of days for all leave records
  vlEarned: { type: Number, default: 0 },
  vlAbsentUndertimeWPay: { type: Number, default: 0 },
  slEarned: { type: Number, default: 0 },
  slAbsentUndertimeWPay: { type: Number, default: 0 },
  cto: { type: String },
  source: {
    type: String,
    enum: ['Manual', 'LeaveApproval', 'MonthlyAccrual'],
    default: 'Manual',
  },
  sourceLeaveId: { type: String, index: true, sparse: true },
  autoGenerated: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

// Define System Log Schema
const systemLogSchema = new mongoose.Schema({
  timestamp: { type: Date, default: Date.now, index: true },
  module: { type: String, required: true, trim: true },
  action: { type: String, required: true, trim: true },
  user: { type: String, default: 'System', trim: true },
  userId: { type: String, trim: true },
  description: { type: String, required: true, trim: true },
  ipAddress: { type: String, default: 'N/A', trim: true },
  status: {
    type: String,
    enum: ['Success', 'Failed', 'Warning', 'Info'],
    default: 'Success',
  },
  metadata: mongoose.Schema.Types.Mixed,
}, {
  versionKey: false,
});

systemLogSchema.index({ timestamp: -1 });

const learningDevelopmentEntrySchema = new mongoose.Schema({
  title: String,
  from: String,
  to: String,
  hours: String,
  type: String,
  conductedBy: String,
}, { _id: false });

// Define Personal Data Sheet Schema
const personalDataSheetSchema = new mongoose.Schema({
  pdsId: { type: String, required: true, unique: true },
  ownerStaffId: { type: String, index: true, sparse: true },
  ownerEmail: { type: String, index: true, lowercase: true, trim: true },
  submittedOnBehalf: { type: Boolean, default: false },
  submittedByStaffId: { type: String, index: true, sparse: true },
  submittedByEmail: { type: String, index: true, lowercase: true, trim: true },
  submittedByName: String,
  surname: { type: String, required: true },
  firstName: { type: String, required: true },
  middleName: String,
  nameExtension: String,
  dateOfBirth: Date,
  placeOfBirth: String,
  sexAtBirth: { type: String, enum: ['Male', 'Female'] },
  civilStatus: { type: String, enum: ['Single', 'Married', 'Widowed', 'Separated', 'Other'] },
  height: String,
  weight: String,
  bloodType: String,
  gsisNo: String,
  pagibigNo: String,
  philhealthNo: String,
  sssNo: String,
  tinNo: String,
  agencyEmployeeNo: String,
  citizenship: {
    type: {
      type: String,
      enum: ['Filipino', 'Dual Citizenship'],
      default: 'Filipino',
    },
    dualCitizenshipMode: {
      type: String,
      enum: ['By Birth', 'By Naturalization'],
    },
    dualCitizenshipCountry: String,
  },
  residentialAddress: {
    houseBlockLotNo: String,
    street: String,
    subdivisionVillage: String,
    barangay: String,
    cityMunicipality: String,
    province: String,
    zipCode: String,
  },
  permanentAddress: {
    houseBlockLotNo: String,
    street: String,
    subdivisionVillage: String,
    barangay: String,
    cityMunicipality: String,
    province: String,
    zipCode: String,
  },
  telephone: String,
  mobile: { type: String, required: true },
  email: { type: String, required: true },
  photoDataUrl: { type: String, default: '' },
  jobApplication: { type: mongoose.Schema.Types.Mixed, default: undefined },
  familyBackground: {
    spouse: {
      surname: String,
      firstName: String,
      middleName: String,
      nameExtension: String,
      occupation: String,
      employerBusinessName: String,
      businessAddress: String,
      telephone: String,
    },
    father: {
      surname: String,
      firstName: String,
      middleName: String,
      nameExtension: String,
    },
    mother: {
      maidenName: String,
      surname: String,
      firstName: String,
      middleName: String,
    },
    children: [
      {
        name: String,
        dateOfBirth: Date,
      },
    ],
  },
  educationalBackground: [
    {
      level: String,
      schoolName: String,
      basicEducationDegreeCourse: String,
      periodFrom: String,
      periodTo: String,
      highestLevelUnitsEarned: String,
      yearGraduated: String,
      scholarshipAcademicHonorsReceived: String,
    },
  ],
  civilServiceEligibilities: [
    {
      eligibilityType: String,
      rating: String,
      dateOfExaminationOrConferment: String,
      placeOfExaminationOrConferment: String,
      licenseNumber: String,
      licenseValidUntil: String,
    },
  ],
  workExperience: [
    {
      from: String,
      to: String,
      positionTitle: String,
      company: String,
      monthlySalary: String,
      salaryJobPayGrade: String,
      statusOfAppointment: String,
      govtService: String,
      duties: String,
    },
  ],
  voluntaryWork: [
    {
      organization: String,
      from: String,
      to: String,
      hours: String,
      position: String,
    },
  ],
  learningDevelopment: [learningDevelopmentEntrySchema],
  specialSkills: [String],
  distinctions: [String],
  memberships: [String],
  relatedThirdDegree: String,
  relatedFourthDegree: String,
  relatedDetails: String,
  adminOffense: String,
  adminOffenseDetails: String,
  criminalCharge: String,
  criminalChargeDetails: String,
  criminalChargeDateFiled: Date,
  criminalChargeStatus: String,
  convicted: String,
  convictedDetails: String,
  separated: String,
  separatedDetails: String,
  recordCategory: { type: String, default: '' },
  separationReason: { type: String, default: '' },
  specialOrderNumberAttachment: {
    fileName: { type: String, default: '' },
    mimeType: { type: String, default: '' },
    size: { type: Number, default: 0 },
    storagePath: { type: String, default: '' },
  },
  effectivityDate: { type: Date, default: null },
  separationOrder: {
    orderNumber: { type: String, default: '' },
    year: { type: Number, default: null },
    orderDate: { type: Date, default: null },
    fullName: { type: String, default: '' },
    position: { type: String, default: '' },
    department: { type: String, default: '' },
    monthlyCompensation: { type: Number, default: null },
    separationReason: { type: String, default: '' },
    effectivityDate: { type: Date, default: null },
  },
  candidate: String,
  candidateDetails: String,
  resignedToCampaign: String,
  resignedDetails: String,
  immigrant: String,
  immigrantCountry: String,
  indigenous: String,
  indigenousDetails: String,
  pwd: String,
  pwdId: String,
  soloParent: String,
  soloParentId: String,
  references: [
    {
      name: String,
      address: String,
      contact: String,
    },
  ],
  declaration: { type: Boolean, default: false },
  govId: {
    idType: String,
    number: String,
    datePlace: String,
  },
  status: {
    type: String,
    enum: ['Pending', 'Approved', 'Disapproved', 'For Revision'],
    default: 'Pending'
  },
  remarks: String,
  reviewedBy: String,
  reviewedAt: Date,
  updatePermissionGranted: { type: Boolean, default: false },
  updatePermissionGrantedAt: Date,
  updatePermissionGrantedBy: String,
  updatePermissionExpiresAt: Date,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

const pdsAwardeeSchema = new mongoose.Schema({
  awardeeId: { type: String, required: true, unique: true },
  sourcePdsId: { type: String, required: true, index: true },
  awardType: { type: String, required: true, trim: true },
  pdsSnapshot: { type: mongoose.Schema.Types.Mixed, required: true },
  createdBy: String,
  createdAt: { type: Date, default: Date.now },
});

const specialOrderCounterSchema = new mongoose.Schema({
  year: { type: Number, required: true, unique: true },
  sequence: { type: Number, required: true, default: 0 },
});

const isValidPdsPhotoDataUrl = (value) => {
  if (typeof value !== 'string' || value.length > 7_000_000) return false;
  const match = value.match(/^data:image\/(?:jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/);
  if (!match) return false;
  return Buffer.from(match[1], 'base64').length <= 5 * 1024 * 1024;
};

const isValidProfilePhotoDataUrl = (value) => {
  if (typeof value !== 'string' || value.length > 7_000_000) return false;
  const match = value.match(/^data:image\/(?:jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/);
  if (!match) return false;
  return Buffer.from(match[1], 'base64').length <= 5 * 1024 * 1024;
};

const STAFF_PROFILE_REQUEST_FIELDS = [
  'name',
  'email',
  'position',
  'department',
  'phone',
  'dateOfBirth',
  'sexAtBirth',
  'dateHired',
  'placeOfBirth',
  'tinNumber',
  'businessPartnerNumber',
  'philhealthNo',
  'pagibigNo',
  'maritalStatus',
  'address',
  'employmentStatus',
  'lengthOfService',
  'monthlyBasicSalary',
  'peraRata',
  'grossSalary',
  'pendingAdministrativeCase',
  'pendingCriminalCase',
  'salaryGrade',
  'profilePhotoDataUrl',
];

const normalizeStaffProfileRequestFields = (payload) => {
  const fields = {};
  const allowedFields = new Set(STAFF_PROFILE_REQUEST_FIELDS);

  for (const [field, rawValue] of Object.entries(payload || {})) {
    if (!allowedFields.has(field)) continue;

    if (field === 'dateOfBirth' || field === 'dateHired') {
      if (rawValue === '' || rawValue === null) {
        fields[field] = null;
      } else {
        const date = new Date(rawValue);
        if (Number.isNaN(date.getTime())) {
          return { error: `${field} must be a valid date` };
        }
        fields[field] = date;
      }
      continue;
    }

    if (field === 'monthlyBasicSalary' || field === 'grossSalary') {
      if (rawValue === '' || rawValue === null) {
        fields[field] = null;
      } else {
        const amount = Number(rawValue);
        if (!Number.isFinite(amount) || amount < 0) {
          return { error: `${field} must be a non-negative number` };
        }
        fields[field] = amount;
      }
      continue;
    }

    if (field === 'pendingAdministrativeCase' || field === 'pendingCriminalCase') {
      if (rawValue === '' || rawValue === null) {
        fields[field] = null;
      } else if (rawValue === true || rawValue === 'true') {
        fields[field] = true;
      } else if (rawValue === false || rawValue === 'false') {
        fields[field] = false;
      } else {
        return { error: `${field} must be true or false` };
      }
      continue;
    }

    if (field === 'sexAtBirth' && !['', 'Male', 'Female'].includes(rawValue)) {
      return { error: 'Sex must be Male or Female, or left blank.' };
    }

    if (field === 'profilePhotoDataUrl') {
      if (rawValue && !isValidProfilePhotoDataUrl(rawValue)) {
        return { error: 'Profile photo must be a JPG, PNG, or WebP image up to 5 MB.' };
      }
      fields[field] = rawValue || '';
      continue;
    }

    if (field === 'department') {
      if (rawValue === '' || rawValue === null) {
        fields[field] = null;
      } else if (typeof rawValue !== 'string' || !DEPARTMENTS.includes(rawValue)) {
        return { error: 'Department must be selected from the available departments.' };
      } else {
        fields[field] = rawValue;
      }
      continue;
    }

    if (typeof rawValue !== 'string' && rawValue !== null) {
      return { error: `${field} must be text` };
    }
    fields[field] = String(rawValue ?? '').trim();
  }

  if (Object.keys(fields).length === 0) {
    return { error: 'At least one profile field is required to submit a request' };
  }
  if (Object.prototype.hasOwnProperty.call(fields, 'name') && !fields.name) {
    return { error: 'Name is required' };
  }
  if (Object.prototype.hasOwnProperty.call(fields, 'email') && !fields.email) {
    return { error: 'Email is required' };
  }
  if (Object.prototype.hasOwnProperty.call(fields, 'email') && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email)) {
    return { error: 'Email must be a valid email address' };
  }

  return { fields };
};

const dpcrfScaleRowSchema = new mongoose.Schema({
  scale: { type: Number, enum: [5, 4, 3, 2, 1], required: true },
  quality: { type: String, default: '' },
  efficiency: { type: String, default: '' },
  timeliness: { type: String, default: '' },
}, { _id: false });

const dpcrfBlockSchema = new mongoose.Schema({
  mfo: { type: String, default: '' },
  kra: { type: String, default: '' },
  objective: { type: String, default: '' },
  timeLine: { type: String, default: '' },
  weightKra: { type: String, default: '' },
  rows: { type: [dpcrfScaleRowSchema], default: [] },
  actualResults: {
    q: { type: String, default: '' },
    e: { type: String, default: '' },
    t: { type: String, default: '' },
    average: { type: String, default: '' },
  },
  meansOfVerification: {
    imageDataUrl: { type: String, default: '' },
    imageName: { type: String, default: '' },
    mimeType: { type: String, default: '' },
  },
}, { _id: false });

const dpcrfPartISectionSchema = new mongoose.Schema({
  title: { type: String, required: true },
  blocks: { type: [dpcrfBlockSchema], default: [] },
}, { _id: false });

const dpcrfSubmissionSchema = new mongoose.Schema({
  submissionId: { type: String, required: true, unique: true },
  ownerStaffId: { type: String, required: true, index: true },
  ownerEmail: { type: String, required: true, trim: true, lowercase: true, index: true },
  ownerName: { type: String, required: true },
  ownerDepartment: { type: String, default: '' },
  year: { type: Number, required: true, index: true },
  partI: {
    sections: { type: [dpcrfPartISectionSchema], default: [] },
  },
  partII: {
    ratings: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  status: {
    type: String,
    enum: ['Submitted'],
    default: 'Submitted',
  },
  partISubmitted: { type: Boolean, default: true },
  partIISubmitted: { type: Boolean, default: false },
  partISubmittedAt: { type: Date, default: Date.now },
  partIISubmittedAt: { type: Date, default: null },
  isSubmitted: { type: Boolean, default: true },
  submittedAt: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

dpcrfSubmissionSchema.index({ ownerStaffId: 1, year: 1 }, { unique: true });

const dpcrfPermissionSchema = new mongoose.Schema({
  year: { type: Number, required: true, unique: true, index: true },
  allowUpdate: { type: Boolean, default: false },
  lockMode: {
    type: String,
    enum: ['manual', 'days', 'weeks', 'months'],
    default: 'manual',
  },
  durationValue: { type: Number, default: null },
  expiresAt: { type: Date, default: null },
  updatedBy: { type: String, default: '' },
  updatedAt: { type: Date, default: Date.now },
});

const spmsCalendarRowSchema = new mongoose.Schema({
  order: { type: Number, required: true },
  activity: { type: String, default: '' },
  january: { type: String, default: '' },
  february: { type: String, default: '' },
  march: { type: String, default: '' },
  april: { type: String, default: '' },
  may: { type: String, default: '' },
  june: { type: String, default: '' },
  july: { type: String, default: '' },
  august: { type: String, default: '' },
  september: { type: String, default: '' },
  october: { type: String, default: '' },
  november: { type: String, default: '' },
  december: { type: String, default: '' },
  responsibleOfficeActors: { type: String, default: '' },
}, { _id: false });

const spmsCalendarSchema = new mongoose.Schema({
  year: { type: Number, required: true, unique: true, index: true },
  rows: { type: [spmsCalendarRowSchema], default: [] },
  preparedByName: { type: String, default: '' },
  preparedByTitle: { type: String, default: '' },
  approvedByName: { type: String, default: '' },
  approvedByTitle: { type: String, default: '' },
  updatedBy: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

const vaultFolderSchema = new mongoose.Schema({
  folderId: { type: String, required: true, unique: true },
  ownerStaffId: { type: String, required: true, index: true },
  ownerEmail: { type: String, index: true, trim: true, lowercase: true },
  name: { type: String, required: true, trim: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

vaultFolderSchema.index({ ownerStaffId: 1, name: 1 }, { unique: true });

const vaultFileSchema = new mongoose.Schema({
  fileId: { type: String, required: true, unique: true },
  ownerStaffId: { type: String, required: true, index: true },
  ownerEmail: { type: String, index: true, trim: true, lowercase: true },
  folder: { type: String, required: true, default: VAULT_DEFAULT_FOLDER },
  name: { type: String, required: true, trim: true },
  mimeType: { type: String, default: 'application/octet-stream' },
  size: { type: Number, default: 0 },
  storagePath: { type: String, required: true },
  originalName: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

vaultFileSchema.index({ ownerStaffId: 1, folder: 1, createdAt: -1 });

const monthlyAccrualExclusionSchema = new mongoose.Schema({
  staffId: { type: String, required: true, index: true },
  monthKey: { type: String, required: true },
  reason: { type: String, default: 'ManualDelete' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

monthlyAccrualExclusionSchema.index({ staffId: 1, monthKey: 1 }, { unique: true });


const Staff = mongoose.model('Staff', staffSchema);
const StaffUpdateRequest = mongoose.model('StaffUpdateRequest', staffUpdateRequestSchema);
const Leave = mongoose.model('Leave', leaveSchema);
const TravelOrder = mongoose.model('TravelOrder', travelOrderSchema);
const Overtime = mongoose.model('Overtime', overtimeSchema);
const COE = mongoose.model('COE', coeSchema);
const NoPendencyRequest = mongoose.model('NoPendencyRequest', noPendencyRequestSchema);
const NoLeaveWithoutPayCertificate = mongoose.model(
  'NoLeaveWithoutPayCertificate',
  noLeaveWithoutPayCertificateSchema
);
const ServiceRecord = mongoose.model('ServiceRecord', serviceRecordSchema);
const LeaveRecord = mongoose.model('LeaveRecord', leaveRecordSchema);
const SystemLog = mongoose.model('SystemLog', systemLogSchema);
const PersonalDataSheet = mongoose.model('PersonalDataSheet', personalDataSheetSchema);
const PdsAwardee = mongoose.model('PdsAwardee', pdsAwardeeSchema);
const SpecialOrderCounter = mongoose.model('SpecialOrderCounter', specialOrderCounterSchema);

const getNextSpecialOrderNumber = async (year) => {
  try {
    const counter = await SpecialOrderCounter.findOneAndUpdate(
      { year },
      { $inc: { sequence: 1 } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
    return String(counter.sequence).padStart(3, '0');
  } catch (error) {
    if (error.code !== 11000) throw error;
    const counter = await SpecialOrderCounter.findOneAndUpdate(
      { year },
      { $inc: { sequence: 1 } },
      { new: true }
    );
    if (!counter) throw error;
    return String(counter.sequence).padStart(3, '0');
  }
};

async function resolveProfilePhotoDataUrl(staff) {
  if (staff.profilePhotoDataUrl) return staff.profilePhotoDataUrl;
  if (!staff.email) return '';

  const email = String(staff.email).trim().toLowerCase();
  const escapedEmail = email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pdsWithPhoto = await PersonalDataSheet.findOne({
    photoDataUrl: { $exists: true, $ne: '' },
    $or: [
      { ownerEmail: new RegExp(`^${escapedEmail}$`, 'i') },
      { email: new RegExp(`^${escapedEmail}$`, 'i') },
    ],
  }).sort({ createdAt: -1 }).select('photoDataUrl').lean();
  return pdsWithPhoto?.photoDataUrl || '';
}

async function resolveStaffPdsProfile(staff) {
  const staffId = String(staff.id || '').trim();
  const email = String(staff.email || '').trim();
  const ownerFilters = [];
  if (staffId) ownerFilters.push({ ownerStaffId: staffId });
  if (email) {
    const escapedEmail = email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const emailPattern = new RegExp(`^${escapedEmail}$`, 'i');
    ownerFilters.push(
      { ownerEmail: emailPattern },
      {
        $and: [
          { ownerEmail: { $in: [null, ''] } },
          { email: emailPattern },
        ],
      }
    );
  }
  if (!ownerFilters.length) return null;

  const pdsRecords = await PersonalDataSheet.find({
    $and: [
      { $or: ownerFilters },
      { submittedOnBehalf: { $ne: true } },
    ],
  }).sort({ createdAt: -1 }).select('dateOfBirth').limit(50).lean();

  return { dateOfBirth: pdsRecords[0]?.dateOfBirth || null };
}

const jobPostingSchema = new mongoose.Schema({
  postingId: { type: String, required: true, unique: true },
  placeOfAssignment: { type: String, required: true, trim: true },
  positionTitle: { type: String, required: true, trim: true },
  plantillaItemNumber: { type: String, required: true, trim: true },
  salaryJobPayGrade: { type: String, required: true, trim: true },
  monthlySalary: { type: String, required: true, trim: true },
  eligibility: { type: [String], required: true, validate: [(entries) => entries.length > 0, 'At least one eligibility requirement is required.'] },
  education: { type: String, required: true, trim: true },
  training: { type: String, required: true, trim: true },
  workExperience: { type: String, required: true, trim: true },
  competency: { type: String, required: true, trim: true },
  status: { type: String, enum: ['Published', 'Closed'], default: 'Published', index: true },
  createdBy: String,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});
const announcementSchema = new mongoose.Schema({
  announcementId: { type: String, required: true, unique: true },
  title: { type: String, required: true, trim: true, maxlength: 160 },
  category: { type: String, required: true, trim: true, maxlength: 60 },
  content: { type: String, required: true, trim: true, maxlength: 10000 },
  linkUrl: { type: String, trim: true, maxlength: 2048, default: '' },
  linkLabel: { type: String, trim: true, maxlength: 80, default: '' },
  expiresAt: { type: Date, default: null },
  status: { type: String, enum: ['Published', 'Archived'], default: 'Published', index: true },
  createdBy: String,
  createdAt: { type: Date, default: Date.now, index: true },
  updatedAt: { type: Date, default: Date.now },
});
const JobPosting = mongoose.model('JobPosting', jobPostingSchema);
const Announcement = mongoose.model('Announcement', announcementSchema);
const DPCRFSubmission = mongoose.model('DPCRFSubmission', dpcrfSubmissionSchema);
const DPCRFPermission = mongoose.model('DPCRFPermission', dpcrfPermissionSchema);
const SpmsCalendar = mongoose.model('SpmsCalendar', spmsCalendarSchema);
const VaultFolder = mongoose.model('VaultFolder', vaultFolderSchema);
const VaultFile = mongoose.model('VaultFile', vaultFileSchema);
const MonthlyAccrualExclusion = mongoose.model('MonthlyAccrualExclusion', monthlyAccrualExclusionSchema);

const ensureDefaultCredentials = async () => {
  const isEnabled = String(process.env.ENABLE_DEFAULT_CREDENTIALS || '').toLowerCase() === 'true';
  if (!isEnabled) {
    return;
  }

  const defaultId = String(process.env.DEFAULT_CREDENTIALS_STAFF_ID || 'HADMIN001').trim();
  const defaultName = String(process.env.DEFAULT_CREDENTIALS_NAME || 'HR Administrator').trim();
  const defaultEmail = String(process.env.DEFAULT_CREDENTIALS_EMAIL || 'admin@lgu.gov').trim().toLowerCase();
  const defaultPassword = String(process.env.DEFAULT_CREDENTIALS_PASSWORD || 'Admin_0');
  const requestedRole = normalizeRole(process.env.DEFAULT_CREDENTIALS_ROLE || ROLES.ADMIN_HR);
  const defaultRole = Object.values(ROLES).includes(requestedRole) ? requestedRole : ROLES.ADMIN_HR;
  const requestedDepartment = String(process.env.DEFAULT_CREDENTIALS_DEPARTMENT || '').trim();
  const defaultDepartment = requestedDepartment || null;

  if (!defaultId || !defaultName || !defaultEmail || !defaultPassword) {
    console.warn('Default credentials are enabled but one or more required fields are empty. Skipping bootstrap account creation.');
    return;
  }

  if (ROLES_WITH_DEPARTMENTS.includes(defaultRole)) {
    if (!defaultDepartment || !DEPARTMENTS.includes(defaultDepartment)) {
      console.warn('Default credentials role requires a valid department. Set DEFAULT_CREDENTIALS_DEPARTMENT to a supported value.');
      return;
    }
  }

  try {
    const existingStaff = await Staff.findOne({
      $or: [{ id: defaultId }, { email: defaultEmail }],
    });

    if (existingStaff) {
      console.log(`Default credentials account already exists for ${defaultEmail}`);
      return;
    }

    const hashedPassword = await bcrypt.hash(defaultPassword, 10);

    await Staff.create({
      id: defaultId,
      name: defaultName,
      email: defaultEmail,
      password: hashedPassword,
      role: defaultRole,
      position: process.env.DEFAULT_CREDENTIALS_POSITION || 'HR Administrator',
      department: ROLES_WITH_DEPARTMENTS.includes(defaultRole) ? defaultDepartment : null,
      isApproved: true,
      isActive: true,
      approvedAt: Date.now(),
      approvedBy: 'System (Default Credentials)',
    });

    console.log(`Default credentials account created for ${defaultEmail}`);
  } catch (error) {
    console.error('Error creating default credentials account:', error.message);
  }
};

const MONTHLY_EARNED_LEAVE_VALUE = 1.25;
const EARNED_LEAVE_PARTICULARS = 'Earned Leave';
const AUTO_DEDUCT_VL_TYPES = new Set(['Vacation Leave', 'Vacation', 'Monetization']);
const AUTO_DEDUCT_SL_TYPES = new Set(['Sick Leave']);
const AUTO_DEDUCT_TARDY_TYPES = new Set(['Tardy']);
const AUTO_DEDUCT_UNDERTIME_TYPES = new Set(['Undertime']);

const normalizeLeaveTypeKey = (value) => String(value || '')
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9]/g, '');

const resolveAutoDeductLeaveType = (value) => {
  const typeKey = normalizeLeaveTypeKey(value);

  const vacationTypeKeys = new Set(['vacationleave', 'vacation', 'vl']);
  const wellnessTypeKeys = new Set(['wellness', 'wellnessleave']);
  const sickTypeKeys = new Set(['sickleave', 'sick', 'sl']);
  // Remove Force Leave from calculation set
  const tardyTypeKeys = new Set(['tardy']);
  const undertimeTypeKeys = new Set(['undertime']);
  if (undertimeTypeKeys.has(typeKey)) {
    return 'Undertime';
  }

  if (vacationTypeKeys.has(typeKey)) {
    return 'Vacation Leave';
  }
  if (wellnessTypeKeys.has(typeKey)) {
    return 'Wellness';
  }
  if (sickTypeKeys.has(typeKey)) {
    return 'Sick Leave';
  }
  // Do not include Force Leave in calculation set
  if (tardyTypeKeys.has(typeKey)) {
    return 'Tardy';
  }
  return null;
};

const getMonthKey = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
};

const getMonthStart = (value) => {
  const date = new Date(value);
  return new Date(date.getFullYear(), date.getMonth(), 1);
};

const getMonthEnd = (year, monthIndex) => new Date(year, monthIndex + 1, 0);

const getRequestIp = (req) => {
  const forwardedFor = req.headers['x-forwarded-for'];
  if (typeof forwardedFor === 'string' && forwardedFor.length > 0) {
    return forwardedFor.split(',')[0].trim();
  }

  return req.ip || req.socket?.remoteAddress || 'N/A';
};

const createSystemLogEntry = async ({
  module,
  action,
  user,
  userId,
  description,
  ipAddress,
  status,
  metadata,
}) => {
  try {
    await SystemLog.create({
      module,
      action,
      user,
      userId,
      description,
      ipAddress: ipAddress || 'N/A',
      status: status || 'Success',
      metadata,
      timestamp: new Date(),
    });
  } catch (error) {
    console.error('Failed to write system log entry:', error.message);
  }
};

const getLastCompletedMonthEnd = (currentDate = new Date()) => {
  const now = new Date(currentDate);
  const currentMonthEnd = getMonthEnd(now.getFullYear(), now.getMonth());
  if (now >= currentMonthEnd) {
    return currentMonthEnd;
  }

  return getMonthEnd(now.getFullYear(), now.getMonth() - 1);
};

const calculateLeaveDays = (leave) => {
  const explicitDays = Number(leave?.numberOfDays);
  if (!Number.isNaN(explicitDays) && explicitDays > 0) {
    return explicitDays;
  }

  const startDate = leave?.startDate ? new Date(leave.startDate) : null;
  const endDate = leave?.endDate ? new Date(leave.endDate) : null;
  if (!startDate || !endDate || Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return 0;
  }

  const days = Math.floor((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
  return days > 0 ? days : 0;
};

const upsertApprovedLeaveToLeaveRecord = async (leaveDoc) => {
  if (!leaveDoc || leaveDoc.status !== 'Approved' || !leaveDoc.leaveId) {
    return null;
  }

  // Always log a leave record for any approved leave type

  const normalizedLeaveType = String(leaveDoc.leaveType || '').trim();
  const canonicalLeaveType = resolveAutoDeductLeaveType(normalizedLeaveType);
  const isForceLeave = normalizeLeaveTypeKey(normalizedLeaveType) === 'mandatoryforceleave';
  const isWellnessLeave = normalizeLeaveTypeKey(normalizedLeaveType) === 'wellness';
  const appliesToVl = canonicalLeaveType === 'Vacation Leave'
    || AUTO_DEDUCT_VL_TYPES.has(normalizedLeaveType)
    || isForceLeave
    || isWellnessLeave;
  const appliesToSl = canonicalLeaveType === 'Sick Leave' || AUTO_DEDUCT_SL_TYPES.has(normalizedLeaveType);
  const appliesToTardy = canonicalLeaveType === 'Tardy' || AUTO_DEDUCT_TARDY_TYPES.has(normalizedLeaveType);
  const appliesToUndertime = canonicalLeaveType === 'Undertime' || AUTO_DEDUCT_UNDERTIME_TYPES.has(normalizedLeaveType);
  // Only log leave record for non-calculated types, but do not return null

  const existing = await LeaveRecord.findOne({ sourceLeaveId: leaveDoc.leaveId });

  const numberOfDays = calculateLeaveDays(leaveDoc);
  if (numberOfDays <= 0) {
    return null;
  }

  // Use the applied date range from the application for the period field
  let period = null;
  if (Array.isArray(leaveDoc.dateRanges) && leaveDoc.dateRanges.length > 0) {
    const d = new Date(leaveDoc.dateRanges[0].from);
    period = isNaN(d) ? null : d;
  } else if (leaveDoc.startDate) {
    const d = new Date(leaveDoc.startDate);
    period = isNaN(d) ? null : d;
  } else {
    period = null;
  }

  // Force Leave, Wellness, and Monetization are charged to Vacation Leave.
  let vlAbsentUndertimeWPay = 0;
  let slAbsentUndertimeWPay = 0;
  if (appliesToVl || appliesToTardy || appliesToUndertime) {
    vlAbsentUndertimeWPay = numberOfDays;
  } else if (appliesToSl) {
    slAbsentUndertimeWPay = numberOfDays;
  }
  // All other types: do not include in calculation, just log the record

  // Prepare dateRanges for display (from leaveDoc.dateRanges or startDate/endDate)
  let dateRanges = [];
  if (Array.isArray(leaveDoc.dateRanges) && leaveDoc.dateRanges.length > 0) {
    dateRanges = leaveDoc.dateRanges.map(r => ({
      from: r.from || r.startDate,
      to: r.to || r.endDate || r.from || r.startDate
    }));
  } else if (leaveDoc.startDate && leaveDoc.endDate) {
    dateRanges = [{ from: leaveDoc.startDate, to: leaveDoc.endDate }];
  } else if (leaveDoc.startDate) {
    dateRanges = [{ from: leaveDoc.startDate, to: leaveDoc.startDate }];
  }

  const recordPayload = {
    staffId: leaveDoc.staffId,
    staffName: leaveDoc.staffName || 'N/A',
    period,
    dateRanges,
    particulars: canonicalLeaveType || normalizedLeaveType,
    numberOfDays, // Always log number of days
    vlEarned: 0,
    vlAbsentUndertimeWPay,
    slEarned: 0,
    slAbsentUndertimeWPay,
    cto: '',
    source: 'LeaveApproval',
    sourceLeaveId: leaveDoc.leaveId,
    autoGenerated: true,
    updatedAt: Date.now(),
  };

  if (existing) {
    if (existing.autoGenerated) {
      Object.assign(existing, recordPayload);
      await existing.save();
      return existing;
    }

    console.warn(`[LeaveRecord] Skipped update: manual LeaveRecord exists for leaveId=${leaveDoc.leaveId}, type=${leaveDoc.leaveType}`);
    return null;
  }

  const autoRecord = new LeaveRecord({
    recordId: `LR-LEAVE-${leaveDoc.leaveId}`,
    ...recordPayload,
  });

  try {
    await autoRecord.save();
  } catch (error) {
    if (error?.code !== 11000) {
      throw error;
    }
  }

  return autoRecord;
};

const ensureMonthlyEarnedLeaveCredits = async ({ staffId = null, upToDate = new Date() } = {}) => {
  const lastCompletedMonthEnd = getLastCompletedMonthEnd(upToDate);
  if (!lastCompletedMonthEnd || Number.isNaN(lastCompletedMonthEnd.getTime())) {
    return 0;
  }

  const staffFilter = staffId
    ? { id: staffId }
    : { isApproved: true };

  const staffList = await Staff.find(staffFilter)
    .select('id name createdAt')
    .lean();

  let totalCreated = 0;
  const finalMonthStart = getMonthStart(lastCompletedMonthEnd);

  for (const staff of staffList) {
    if (!staff?.id) continue;

    const basisDate = staff.createdAt || new Date();
    const firstEligibleMonthStart = getMonthStart(basisDate);
    let cursor = firstEligibleMonthStart;

    if (cursor > finalMonthStart) {
      continue;
    }

    // Remove only legacy auto-accrual rows generated before account creation month.
    await LeaveRecord.deleteMany({
      staffId: staff.id,
      particulars: EARNED_LEAVE_PARTICULARS,
      source: 'MonthlyAccrual',
      autoGenerated: true,
      period: { $lt: firstEligibleMonthStart },
    });

    const existingAccruals = await LeaveRecord.find({
      staffId: staff.id,
      particulars: EARNED_LEAVE_PARTICULARS,
      source: 'MonthlyAccrual',
      period: { $gte: firstEligibleMonthStart },
    })
      .select('period -_id')
      .lean();

    const existingMonthKeys = new Set(
      existingAccruals
        .map((entry) => getMonthKey(entry.period))
        .filter(Boolean)
    );

    const excludedAccruals = await MonthlyAccrualExclusion.find({
      staffId: staff.id,
    })
      .select('monthKey -_id')
      .lean();

    const excludedMonthKeys = new Set(
      excludedAccruals
        .map((entry) => String(entry.monthKey || '').trim())
        .filter(Boolean)
    );

    const recordsToInsert = [];

    while (cursor <= finalMonthStart) {
      const monthKey = getMonthKey(cursor);
      if (monthKey && !existingMonthKeys.has(monthKey) && !excludedMonthKeys.has(monthKey)) {
        const monthEnd = getMonthEnd(cursor.getFullYear(), cursor.getMonth());
        recordsToInsert.push({
          recordId: `LR-EARNED-${staff.id}-${monthKey}`,
          staffId: staff.id,
          staffName: staff.name || 'N/A',
          period: monthEnd,
          particulars: EARNED_LEAVE_PARTICULARS,
          vlEarned: MONTHLY_EARNED_LEAVE_VALUE,
          vlAbsentUndertimeWPay: 0,
          slEarned: MONTHLY_EARNED_LEAVE_VALUE,
          slAbsentUndertimeWPay: 0,
          cto: '',
          source: 'MonthlyAccrual',
          autoGenerated: true,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      }

      cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
    }

    if (recordsToInsert.length > 0) {
      try {
        await LeaveRecord.insertMany(recordsToInsert, { ordered: false });
      } catch (insertError) {
        if (insertError?.code !== 11000) {
          throw insertError;
        }
      }

      totalCreated += recordsToInsert.length;
    }
  }

  return totalCreated;
};

const syncApprovedVacationAndSickLeaves = async () => {
  const approvedLeaves = await Leave.find({
    status: 'Approved',
  })
    .select('leaveId staffId staffName leaveType numberOfDays startDate endDate approvalDate updatedAt status')
    .lean();

  for (const leave of approvedLeaves) {
    await upsertApprovedLeaveToLeaveRecord(leave);
  }
};

const runLeaveRecordAutomations = async () => {
  await ensureMonthlyEarnedLeaveCredits();
  await syncApprovedVacationAndSickLeaves();
};

const dropLegacyTravelControlNoUniqueIndex = async () => {
  try {
    const indexes = await TravelOrder.collection.indexes();
    const legacyIndex = indexes.find((index) => index.name === 'controlNo_1' && index.unique);

    if (legacyIndex) {
      await TravelOrder.collection.dropIndex('controlNo_1');
      console.log('Dropped legacy unique index on TravelOrder.controlNo');
    }
  } catch (error) {
    console.warn('Could not verify/drop legacy controlNo index:', error.message);
  }
};

mongoose.connection.once('open', () => {
  ensureDefaultCredentials();

  dropLegacyTravelControlNoUniqueIndex();

  runLeaveRecordAutomations().catch((error) => {
    console.error('Error running leave record automations on startup:', error);
  });

  setInterval(() => {
    runLeaveRecordAutomations().catch((error) => {
      console.error('Error running scheduled leave record automations:', error);
    });
  }, 1000 * 60 * 60 * 12);
});


// ==================== SYSTEM CONFIGURATION ROUTES ====================

// Get available roles and departments
app.get('/system/roles-and-departments', (req, res) => {
  try {
    const allowedDropdownRoles = [
      ROLES.SUPER_ADMIN,
      ROLES.ADMIN_HR,
      ROLES.HEAD_REQUISITIONING_OFFICE,
      ROLES.JOB_ORDER_OFFICER,
      ROLES.HEAD_OFFICER,
      ROLES.STAFF,
    ];

    const sortedDropdownRoles = [...allowedDropdownRoles].sort((firstRole, secondRole) =>
      (ROLE_DISPLAY_NAMES[firstRole] || '').localeCompare(ROLE_DISPLAY_NAMES[secondRole] || '')
    );

    const sortedDepartments = [...DEPARTMENTS].sort((firstDepartment, secondDepartment) =>
      firstDepartment.localeCompare(secondDepartment)
    );

    const rolesWithDepartments = {};

    sortedDropdownRoles.forEach(role => {
      rolesWithDepartments[role] = {
        displayName: ROLE_DISPLAY_NAMES[role],
        requiresDepartment: ROLES_WITH_DEPARTMENTS.includes(role),
        departments: ROLES_WITH_DEPARTMENTS.includes(role) ? sortedDepartments : null
      };
    });

    res.json({
      roles: rolesWithDepartments,
      departments: sortedDepartments
    });
  } catch (error) {
    console.error('Error fetching roles and departments:', error);
    res.status(500).json({ message: 'Failed to fetch roles and departments' });
  }
});

// ==================== SYSTEM LOG ROUTES ====================

app.get('/system-logs', verifyToken, requireRole([ROLES.SUPER_ADMIN, ROLES.ADMIN_HR]), async (req, res) => {
  try {
    const {
      search = '',
      module: moduleFilter,
      action: actionFilter,
      status: statusFilter,
      dateRange = 'all',
      page = '1',
      limit = '200',
    } = req.query;

    const query = {};

    if (moduleFilter && moduleFilter !== 'all') {
      query.module = moduleFilter;
    }

    if (actionFilter && actionFilter !== 'all') {
      query.action = actionFilter;
    }

    if (statusFilter && statusFilter !== 'all') {
      query.status = statusFilter;
    }

    const searchText = String(search || '').trim();
    if (searchText) {
      const regex = new RegExp(searchText, 'i');
      query.$or = [
        { module: regex },
        { action: regex },
        { user: regex },
        { description: regex },
        { ipAddress: regex },
      ];
    }

    if (dateRange && dateRange !== 'all') {
      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const daysBackMap = {
        today: 0,
        week: 7,
        month: 30,
      };

      if (Object.prototype.hasOwnProperty.call(daysBackMap, dateRange)) {
        const rangeStart = new Date(startOfToday);
        rangeStart.setDate(startOfToday.getDate() - daysBackMap[dateRange]);
        query.timestamp = { $gte: rangeStart };
      }
    }

    const numericPage = Number.parseInt(page, 10);
    const boundedPage = Number.isNaN(numericPage) ? 1 : Math.max(1, numericPage);
    const numericLimit = Number.parseInt(limit, 10);
    const boundedLimit = Number.isNaN(numericLimit) ? 200 : Math.max(1, Math.min(numericLimit, 500));
    const skip = (boundedPage - 1) * boundedLimit;

    const total = await SystemLog.countDocuments(query);

    const logs = await SystemLog.find(query)
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(boundedLimit)
      .lean();

    res.json({
      data: logs.map((log) => ({
        id: String(log._id),
        ...log,
      })),
      pagination: {
        page: boundedPage,
        limit: boundedLimit,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / boundedLimit),
      },
    });
  } catch (error) {
    console.error('Error fetching system logs:', error);
    res.status(500).json({ message: 'Failed to fetch system logs' });
  }
});

app.post('/system-logs', verifyToken, requireRole([ROLES.SUPER_ADMIN, ROLES.ADMIN_HR]), async (req, res) => {
  try {
    const {
      module,
      action,
      user,
      userId,
      description,
      status,
      metadata,
    } = req.body;

    if (!module || !action || !description) {
      return res.status(400).json({ message: 'module, action, and description are required' });
    }

    const created = await SystemLog.create({
      module,
      action,
      user: user || req.user?.name || req.user?.email || 'System',
      userId: userId || req.user?.staffId || null,
      description,
      status: status || 'Info',
      metadata,
      ipAddress: getRequestIp(req),
      timestamp: new Date(),
    });

    res.status(201).json({
      message: 'System log created successfully',
      data: {
        id: String(created._id),
        ...created.toObject(),
      },
    });
  } catch (error) {
    console.error('Error creating system log:', error);
    res.status(500).json({ message: 'Failed to create system log' });
  }
});


// ==================== AUTHENTICATION ROUTES ====================

// Register
app.post('/auth/register', async (req, res) => {
  const { id, name, email, password, role, position, department, phone, dateOfBirth, dateHired, placeOfBirth, tinNumber } = req.body;
  const profileFields = normalizeStaffProfileFields(req.body);
  if (profileFields.error) {
    return res.status(400).json({ message: profileFields.error });
  }
  let normalizedDateHired;
  if (dateHired !== undefined && dateHired !== null && String(dateHired).trim() !== '') {
    normalizedDateHired = new Date(dateHired);
    if (Number.isNaN(normalizedDateHired.getTime())) {
      return res.status(400).json({ message: 'Invalid Date of Employment value' });
    }
  }

  if (!id || !name || !email || !password) {
    return res.status(400).json({ message: 'ID, name, email, and password are required' });
  }

  try {
    const existing = await Staff.findOne({ $or: [{ id }, { email }] });
    if (existing) {
      return res.status(409).json({ message: 'Item Number or email already exists' });
    }

    // Validate role
    const userRole = role || ROLES.STAFF;
    if (!Object.values(ROLES).includes(userRole)) {
      return res.status(400).json({ message: `Invalid role: ${userRole}` });
    }

    const restrictedRegistrationRoles = [ROLES.SUPER_ADMIN, ROLES.ADMIN_HR];
    if (restrictedRegistrationRoles.includes(userRole)) {
      return res.status(403).json({
        message: 'Registration for Super Admin/Mayor and Admin/HR roles is not allowed via public registration.'
      });
    }

    // Validate department if required by role
    if (ROLES_WITH_DEPARTMENTS.includes(userRole)) {
      if (!department || !DEPARTMENTS.includes(department)) {
        return res.status(400).json({ message: `Department is required for ${ROLE_DISPLAY_NAMES[userRole]}. Valid departments: ${DEPARTMENTS.join(', ')}` });
      }
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Auto-approve privileged roles (Super Admin, Admin/HR, and executive positions)
    const autoApprovedRoles = [
      ROLES.SUPER_ADMIN,
      ROLES.ADMIN_HR,
      ROLES.HEAD_REQUISITIONING_OFFICE,
      ROLES.MUNICIPAL_BUDGET_OFFICER,
      ROLES.MUNICIPAL_ASSESSOR
    ];
    const isAutoApproved = autoApprovedRoles.includes(userRole);
    
    const newStaff = new Staff({
      id,
      name,
      email,
      password: hashedPassword,
      role: userRole,
      position,
      department: ROLES_WITH_DEPARTMENTS.includes(userRole) ? department : null,
      phone,
      dateOfBirth,
      dateHired: normalizedDateHired,
      placeOfBirth,
      tinNumber,
      businessPartnerNumber,
      philhealthNo,
      pagibigNo,
      maritalStatus,
      ...profileFields.fields,
      lengthOfService: calculateStaffLengthOfService(normalizedDateHired),
      isApproved: isAutoApproved,
      approvedAt: isAutoApproved ? Date.now() : null,
      approvedBy: isAutoApproved ? 'System (Auto-approved)' : null
    });

    await newStaff.save();
    console.log('New staff registered:', { id, role: userRole, isApproved: isAutoApproved });
    
    if (isAutoApproved) {
      res.status(201).json({ message: `${ROLE_DISPLAY_NAMES[userRole]} account created successfully. You can login now.` });
    } else {
      res.status(201).json({ message: 'Registration submitted successfully. Please wait for admin approval.' });
    }
  } catch (error) {
    console.error('Error registering staff:', error);
    res.status(500).json({ message: 'Failed to register staff', error: error.message });
  }
});

// Login
app.post('/auth/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required' });
  }

  try {
    const staff = await Staff.findOne({ email });
    if (!staff) {
      await createSystemLogEntry({
        module: 'Authentication',
        action: 'Login',
        user: email,
        description: 'Failed login attempt (unknown account)',
        ipAddress: getRequestIp(req),
        status: 'Failed',
      });
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // Normalize legacy role values in DB (e.g., "admin" -> "admin_hr")
    const normalizedDbRole = normalizeRole(staff.role);
    if (normalizedDbRole && staff.role !== normalizedDbRole) {
      staff.role = normalizedDbRole;
      await staff.save();
    }

    const passwordMatch = await bcrypt.compare(password, staff.password);
    if (!passwordMatch) {
      await createSystemLogEntry({
        module: 'Authentication',
        action: 'Login',
        user: staff.name || email,
        userId: staff.id,
        description: 'Failed login attempt (invalid password)',
        ipAddress: getRequestIp(req),
        status: 'Failed',
      });
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // Auto-approve accounts with privileged roles
    const autoApprovedRoles = [
      ROLES.SUPER_ADMIN,
      ROLES.ADMIN_HR,
      ROLES.HEAD_REQUISITIONING_OFFICE,
      ROLES.MUNICIPAL_BUDGET_OFFICER,
      ROLES.MUNICIPAL_ASSESSOR
    ];
    
    const staffRoleNormalized = normalizeRole(staff.role);

    if (!staff.isApproved && autoApprovedRoles.includes(staffRoleNormalized)) {
      console.log('Auto-approving account:', staff.id, 'Role:', staff.role);
      staff.isApproved = true;
      staff.approvedAt = Date.now();
      staff.approvedBy = 'System (Auto-approved)';
      await staff.save();
    }

    // Check if account is approved
    if (!staff.isApproved) {
      await createSystemLogEntry({
        module: 'Authentication',
        action: 'Login',
        user: staff.name || email,
        userId: staff.id,
        description: 'Blocked login attempt (account pending approval)',
        ipAddress: getRequestIp(req),
        status: 'Warning',
      });
      return res.status(403).json({ message: 'Your account is pending admin approval. Please wait for approval to login.' });
    }

    if (staff.isActive === false) {
      await createSystemLogEntry({
        module: 'Authentication',
        action: 'Login',
        user: staff.name || email,
        userId: staff.id,
        description: 'Blocked login attempt (account deactivated)',
        ipAddress: getRequestIp(req),
        status: 'Warning',
      });
      return res.status(403).json({ message: 'Your account is deactivated. Please contact an administrator.' });
    }

    const roleForToken = normalizeRole(staff.role);

    const token = jwt.sign(
      { id: staff._id, staffId: staff.id, name: staff.name, email: staff.email, role: roleForToken, department: staff.department },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    await createSystemLogEntry({
      module: 'Authentication',
      action: 'Login',
      user: staff.name || staff.email,
      userId: staff.id,
      description: 'User logged in successfully',
      ipAddress: getRequestIp(req),
      status: 'Success',
      metadata: {
        role: roleForToken,
        department: staff.department || null,
      },
    });

    const profilePhotoDataUrl = await resolveProfilePhotoDataUrl(staff);
    res.json({
      message: 'Login successful',
      token,
      user: {
        id: staff._id,
        staffId: staff.id,
        name: staff.name,
        email: staff.email,
        department: staff.department,
        position: staff.position,
        department: staff.department,
        phone: staff.phone,
        profilePhotoDataUrl,
        sexAtBirth: staff.sexAtBirth || '',
        role: roleForToken,
      },
    });
  } catch (error) {
    console.error('Error logging in:', error);
    res.status(500).json({ message: 'Login failed' });
  }
});

// Get current user info
app.get('/auth/me', verifyToken, async (req, res) => {
  try {
    const staff = await Staff.findOne({ id: req.user.staffId }).select('-password');
    if (!staff) return res.status(404).json({ message: 'User account not found.' });

    const [profilePhotoDataUrl, pdsProfile] = await Promise.all([
      resolveProfilePhotoDataUrl(staff),
      resolveStaffPdsProfile(staff),
    ]);

    res.json({
      ...staff.toObject(),
      profilePhotoDataUrl,
      sexAtBirth: staff.sexAtBirth || '',
      dateOfBirth: staff.dateOfBirth || pdsProfile?.dateOfBirth || null,
    });
  } catch (error) {
    console.error('Error fetching current user info:', error);
    res.status(500).json({ message: 'Failed to fetch user info' });
  }
});

// Logout (audit log only; JWT is stateless and invalidated client-side)
app.post('/auth/logout', verifyToken, async (req, res) => {
  try {
    await createSystemLogEntry({
      module: 'Authentication',
      action: 'Logout',
      user: req.user.name || req.user.email || 'Unknown User',
      userId: req.user.staffId,
      description: 'User logged out successfully',
      ipAddress: getRequestIp(req),
      status: 'Success',
      metadata: {
        role: req.user.role || null,
        department: req.user.department || null,
      },
    });

    return res.status(200).json({ message: 'Logout recorded successfully' });
  } catch (error) {
    console.error('Error logging out user:', error);
    return res.status(500).json({ message: 'Failed to process logout' });
  }
});


// ==================== PERSONAL DATA SHEET ROUTES ====================

const normalizeJobEligibility = (value) => {
  const entries = Array.isArray(value) ? value : [value];
  return entries.map((entry) => String(entry || '').trim()).filter(Boolean);
};

const isJobQualificationOptional = (value) => /^(n\/?a|none|not required|not applicable)$/i.test(String(value || '').trim());
const normalizeJobQualificationText = (value) => String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
const JOB_EDUCATION_LEVELS = [
  'Elementary level',
  'Elementary graduate',
  'High School level',
  'High School graduate',
  'Senior High School level',
  'Senior High School graduate',
  'Vocational / Trade Course',
  'College level',
  "Bachelor's degree",
  "Master's degree",
  'Doctorate degree',
];

const validateJobApplicationQualifications = (posting, answers) => {
  const failures = [];
  const eligibilityRequirements = normalizeJobEligibility(posting.eligibility);
  const selectedEligibility = normalizeJobQualificationText(answers?.eligibility);

  if (!selectedEligibility) {
    failures.push('Select your eligibility.');
  } else if (eligibilityRequirements.length > 0 && !eligibilityRequirements.some((entry) => normalizeJobQualificationText(entry) === selectedEligibility)) {
    failures.push('Select an eligibility listed for this position.');
  }

  const educationRequirementRank = JOB_EDUCATION_LEVELS.findIndex(
    (level) => normalizeJobQualificationText(level) === normalizeJobQualificationText(posting.education)
  );
  const applicantEducationRank = JOB_EDUCATION_LEVELS.findIndex(
    (level) => normalizeJobQualificationText(level) === normalizeJobQualificationText(answers?.education)
  );
  if (educationRequirementRank < 0 || applicantEducationRank < educationRequirementRank) {
    failures.push(`Education must meet or exceed ${posting.education || 'the posted requirement'}.`);
  }

  const validateYesNoOther = (field, requirement, label) => {
    const choiceField = `${field}Choice`;
    const otherField = `${field}Other`;
    const choice = answers?.[choiceField];
    const optional = isJobQualificationOptional(requirement);

    if (!['Yes', 'No', 'Other'].includes(choice)) {
      failures.push(`Select whether you meet the ${label} requirement.`);
      return;
    }
    if (choice === 'Other') {
      const other = normalizeJobQualificationText(answers?.[otherField]);
      const normalizedRequirement = normalizeJobQualificationText(requirement);
      if (!other) {
        failures.push(`Enter details for your other ${label}.`);
      } else if (!optional && !other.includes(normalizedRequirement)) {
        failures.push(`The ${label} entered does not match the posted requirement.`);
      }
      return;
    }
    if (!optional && choice === 'No') {
      failures.push(`You indicated that you do not meet the ${label} requirement.`);
    }
  };

  validateYesNoOther('training', posting.training, 'training');
  validateYesNoOther('workExperience', posting.workExperience, 'work experience');
  return failures;
};

// Job Portal postings are visible to PDS applicants; only admins can manage them.
app.get('/announcements', verifyTokenIfPresent, async (req, res) => {
  try {
    const now = new Date();
    const filter = isSystemAdminRole(req.user?.role)
      ? (req.query.status ? { status: String(req.query.status) } : {})
      : { status: 'Published', $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }] };
    const announcements = await Announcement.find(filter).sort({ createdAt: -1 }).lean();
    return res.json(announcements);
  } catch (error) {
    console.error('Error fetching announcements:', error);
    return res.status(500).json({ message: 'Failed to fetch announcements.' });
  }
});

app.post('/announcements', verifyToken, requireRole([ROLES.SUPER_ADMIN, ROLES.ADMIN_HR]), async (req, res) => {
  const title = String(req.body?.title || '').trim();
  const category = String(req.body?.category || '').trim();
  const content = String(req.body?.content || '').trim();
  const linkUrl = String(req.body?.linkUrl || '').trim();
  const linkLabel = String(req.body?.linkLabel || '').trim();
  const expiryValue = String(req.body?.expiresAt || '').trim();

  if (!title || title.length > 160) {
    return res.status(400).json({ message: 'A title of 1 to 160 characters is required.' });
  }
  if (!category || category.length > 60) {
    return res.status(400).json({ message: 'A category of 1 to 60 characters is required.' });
  }
  if (!content || content.length > 10000) {
    return res.status(400).json({ message: 'Announcement content of 1 to 10,000 characters is required.' });
  }
  if (linkUrl && !/^https?:\/\/\S+$/i.test(linkUrl)) {
    return res.status(400).json({ message: 'The announcement link must be a valid HTTP or HTTPS URL.' });
  }
  if (linkUrl.length > 2048 || linkLabel.length > 80) {
    return res.status(400).json({ message: 'The announcement link or link label is too long.' });
  }

  let expiresAt = null;
  if (expiryValue) {
    expiresAt = new Date(`${expiryValue}T23:59:59.999Z`);
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(expiryValue)
      || Number.isNaN(expiresAt.getTime())
      || expiresAt.toISOString().slice(0, 10) !== expiryValue
    ) {
      return res.status(400).json({ message: 'Enter a valid announcement expiration date.' });
    }
  }

  try {
    const announcement = await Announcement.create({
      announcementId: randomUUID(),
      title,
      category,
      content,
      linkUrl,
      linkLabel,
      expiresAt,
      createdBy: req.user?.name || req.user?.email || 'Admin/HR',
    });
    return res.status(201).json({ announcement });
  } catch (error) {
    console.error('Error creating announcement:', error);
    return res.status(500).json({ message: 'Failed to create announcement.' });
  }
});

app.patch('/announcements/:announcementId/status', verifyToken, requireRole([ROLES.SUPER_ADMIN, ROLES.ADMIN_HR]), async (req, res) => {
  const status = String(req.body?.status || '');
  if (!['Published', 'Archived'].includes(status)) {
    return res.status(400).json({ message: 'Status must be Published or Archived.' });
  }

  try {
    const announcement = await Announcement.findOneAndUpdate(
      { announcementId: req.params.announcementId },
      { $set: { status, updatedAt: new Date() } },
      { new: true, runValidators: true }
    );
    if (!announcement) return res.status(404).json({ message: 'Announcement not found.' });
    return res.json({ announcement });
  } catch (error) {
    console.error('Error updating announcement status:', error);
    return res.status(500).json({ message: 'Failed to update announcement status.' });
  }
});

app.delete('/announcements/:announcementId', verifyToken, requireRole([ROLES.SUPER_ADMIN, ROLES.ADMIN_HR]), async (req, res) => {
  try {
    const deleted = await Announcement.findOneAndDelete({ announcementId: req.params.announcementId });
    if (!deleted) return res.status(404).json({ message: 'Announcement not found.' });
    return res.json({ message: 'Announcement deleted.' });
  } catch (error) {
    console.error('Error deleting announcement:', error);
    return res.status(500).json({ message: 'Failed to delete announcement.' });
  }
});

app.get('/job-postings', verifyTokenIfPresent, async (req, res) => {
  try {
    const filter = isSystemAdminRole(req.user?.role)
      ? (req.query.status ? { status: req.query.status } : {})
      : { status: 'Published' };
    const postings = await JobPosting.find(filter).sort({ createdAt: -1 }).lean();
    res.json(postings);
  } catch (error) {
    console.error('Error fetching job postings:', error);
    res.status(500).json({ message: 'Failed to fetch job postings' });
  }
});

app.post('/job-postings', verifyToken, requireRole([ROLES.SUPER_ADMIN, ROLES.ADMIN_HR]), async (req, res) => {
  try {
    const fields = [
      'placeOfAssignment',
      'positionTitle',
      'plantillaItemNumber',
      'salaryJobPayGrade',
      'monthlySalary',
      'education',
      'training',
      'workExperience',
      'competency',
    ];
    const postingData = {};
    for (const field of fields) {
      postingData[field] = String(req.body?.[field] || '').trim();
      if (!postingData[field]) {
        return res.status(400).json({ message: `${field} is required.` });
      }
    }
    postingData.eligibility = normalizeJobEligibility(req.body?.eligibility);
    if (postingData.eligibility.length === 0) {
      return res.status(400).json({ message: 'At least one eligibility requirement is required.' });
    }
    if (!JOB_EDUCATION_LEVELS.some((level) => normalizeJobQualificationText(level) === normalizeJobQualificationText(postingData.education))) {
      return res.status(400).json({ message: 'Select a valid education requirement.' });
    }

    const postingCount = await JobPosting.countDocuments();
    const postingId = `JOB-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(postingCount + 1).padStart(4, '0')}`;
    const posting = await JobPosting.create({
      ...postingData,
      postingId,
      status: 'Published',
      createdBy: req.user?.email || req.user?.staffId || 'Admin',
    });
    res.status(201).json(posting);
  } catch (error) {
    console.error('Error creating job posting:', error);
    res.status(500).json({ message: 'Failed to create job posting' });
  }
});

app.patch('/job-postings/:postingId/status', verifyToken, requireRole([ROLES.SUPER_ADMIN, ROLES.ADMIN_HR]), async (req, res) => {
  const status = String(req.body?.status || '');
  if (!['Published', 'Closed'].includes(status)) {
    return res.status(400).json({ message: 'Status must be Published or Closed.' });
  }

  try {
    const posting = await JobPosting.findOneAndUpdate(
      { postingId: req.params.postingId },
      { $set: { status, updatedAt: new Date() } },
      { new: true, runValidators: true }
    );
    if (!posting) return res.status(404).json({ message: 'Job posting not found.' });
    res.json(posting);
  } catch (error) {
    console.error('Error updating job posting:', error);
    res.status(500).json({ message: 'Failed to update job posting' });
  }
});

app.get('/job-applications', verifyToken, requireRole([ROLES.SUPER_ADMIN, ROLES.ADMIN_HR]), async (req, res) => {
  try {
    const filter = { 'jobApplication.postingId': { $exists: true, $ne: '' } };
    if (req.query.status) filter['jobApplication.status'] = req.query.status;
    const applications = await PersonalDataSheet.find(filter).sort({ createdAt: -1 }).lean();
    res.json(applications);
  } catch (error) {
    console.error('Error fetching job applications:', error);
    res.status(500).json({ message: 'Failed to fetch job applications' });
  }
});

app.patch('/job-applications/:pdsId/review', verifyToken, requireRole([ROLES.SUPER_ADMIN, ROLES.ADMIN_HR]), async (req, res) => {
  const status = String(req.body?.status || '');
  if (!['Approved', 'Disapproved'].includes(status)) {
    return res.status(400).json({ message: 'Status must be Approved or Disapproved.' });
  }

  try {
    const pds = await PersonalDataSheet.findOne({
      pdsId: req.params.pdsId,
      'jobApplication.postingId': { $exists: true, $ne: '' },
    });
    if (!pds) return res.status(404).json({ message: 'Job application not found.' });

    pds.jobApplication = {
      ...pds.jobApplication,
      status,
      remarks: String(req.body?.remarks || '').trim(),
      reviewedBy: req.user?.email || req.user?.staffId || 'Admin',
      reviewedAt: new Date(),
    };
    await pds.save();
    res.json({ message: `Job application ${status.toLowerCase()}.`, pds });
  } catch (error) {
    console.error('Error reviewing job application:', error);
    res.status(500).json({ message: 'Failed to review job application' });
  }
});

// Submit PDS (public, but links to account when authenticated)
app.post('/personal-data-sheets', verifyTokenIfPresent, async (req, res) => {
  const normalizeEmptyStrings = (value) => {
    if (typeof value === 'string') {
      const trimmed = value.trim();
      return trimmed === '' ? undefined : trimmed;
    }

    if (Array.isArray(value)) {
      return value.map((item) => normalizeEmptyStrings(item));
    }

    if (value && typeof value === 'object') {
      return Object.entries(value).reduce((acc, [key, nestedValue]) => {
        acc[key] = normalizeEmptyStrings(nestedValue);
        return acc;
      }, {});
    }

    return value;
  };

  const normalizedPayload = normalizeEmptyStrings(req.body);
  if (!isValidPdsPhotoDataUrl(normalizedPayload.photoDataUrl)) {
    return res.status(400).json({ message: 'A JPG, PNG, or WebP PDS photo up to 5 MB is required.' });
  }

  let jobApplication;
  if (normalizedPayload.jobApplication?.postingId) {
    let posting;
    try {
      posting = await JobPosting.findOne({
        postingId: String(normalizedPayload.jobApplication.postingId),
        status: 'Published',
      }).lean();
    } catch (error) {
      console.error('Error validating selected job posting:', error);
      return res.status(500).json({ message: 'Failed to validate the selected position.' });
    }
    if (!posting) {
      return res.status(400).json({ message: 'The selected position is no longer available.' });
    }
    const applicantQualifications = normalizedPayload.jobApplication.applicantQualifications || {};
    const qualificationFailures = validateJobApplicationQualifications(posting, applicantQualifications);
    if (qualificationFailures.length > 0) {
      return res.status(400).json({
        message: 'The applicant does not meet all qualifications for this position.',
        qualificationFailures,
      });
    }
    jobApplication = {
      postingId: posting.postingId,
      placeOfAssignment: posting.placeOfAssignment,
      positionTitle: posting.positionTitle,
      plantillaItemNumber: posting.plantillaItemNumber,
      salaryJobPayGrade: posting.salaryJobPayGrade,
      monthlySalary: posting.monthlySalary,
      eligibility: normalizeJobEligibility(posting.eligibility),
      education: posting.education,
      training: posting.training,
      workExperience: posting.workExperience,
      competency: posting.competency,
      applicantQualifications,
      status: 'Pending',
      submittedAt: new Date(),
    };
  }

  // Helper: try to parse values that may have been stringified (JSON or JS-like)
  const parsePossiblyStringified = (val) => {
    if (val === undefined || val === null) return val;
    if (typeof val !== 'string') return val;
    const trimmed = val.trim();
    if (!trimmed.startsWith('[') && !trimmed.startsWith('{')) return val;

    // First try strict JSON
    try {
      return JSON.parse(trimmed);
    } catch (jsonErr) {
      // Fallback: evaluate JS-like literal (unsafe in untrusted envs)
      try {
        // Wrap in parens to allow object literals
        // eslint-disable-next-line no-new-func
        return Function('"use strict";return (' + trimmed + ')')();
      } catch (evalErr) {
        // Last-chance recovery for malformed concatenated object-literal strings.
        // Example input can look like: "[\n' + ' {\n' + \" title: 'LD 1' ... } ... ]"
        // We extract each {...} block and normalize it into parseable JSON.
        const objectBlocks = trimmed.match(/\{[\s\S]*?\}/g);
        if (objectBlocks && objectBlocks.length > 0) {
          try {
            const parsedBlocks = objectBlocks.map((block) => {
              const normalized = block
                // Recover malformed concatenated fragments: ' + " ... " + '
                .replace(/["']\s*\+\s*["']/g, '')
                .replace(/["']\s*\+\s*/g, '')
                .replace(/\s*\+\s*["']/g, '')
                .replace(/([{,]\s*)([A-Za-z0-9_]+)\s*:/g, '$1"$2":')
                .replace(/'/g, '"')
                .replace(/,\s*}/g, '}')
                .replace(/,\s*]/g, ']');
              return JSON.parse(normalized);
            });
            return trimmed.startsWith('[') ? parsedBlocks : parsedBlocks[0];
          } catch (blockErr) {
            return val;
          }
        }

        return val;
      }
    }
  };

  // Coerce common array/object fields that sometimes arrive as stringified values
  const coerceField = (fieldName) => {
    if (normalizedPayload[fieldName] && typeof normalizedPayload[fieldName] === 'string') {
      const parsed = parsePossiblyStringified(normalizedPayload[fieldName]);
      normalizedPayload[fieldName] = parsed;
    }
  };

  const coerceArrayEntries = (fieldName) => {
    const fieldValue = normalizedPayload[fieldName];
    if (!Array.isArray(fieldValue)) return;

    let changed = false;
    const expanded = [];

    fieldValue.forEach((item) => {
      if (typeof item !== 'string') {
        expanded.push(item);
        return;
      }

      const parsed = parsePossiblyStringified(item);

      if (Array.isArray(parsed)) {
        expanded.push(...parsed);
        changed = true;
        return;
      }

      if (parsed && typeof parsed === 'object') {
        expanded.push(parsed);
        changed = true;
        return;
      }

      expanded.push(item);
    });

    if (changed) {
      normalizedPayload[fieldName] = expanded;
    }
  };

  ['workExperience', 'voluntaryWork', 'learningDevelopment', 'specialSkills', 'distinctions', 'memberships', 'references'].forEach(coerceField);
  ['workExperience', 'voluntaryWork', 'learningDevelopment', 'specialSkills', 'distinctions', 'memberships', 'references', 'civilServiceEligibilities', 'educationalBackground'].forEach(coerceArrayEntries);

  const {
    surname,
    firstName,
    middleName,
    nameExtension,
    dateOfBirth,
    placeOfBirth,
    sexAtBirth,
    civilStatus,
    height,
    weight,
    bloodType,
    gsisNo,
    pagibigNo,
    philhealthNo,
    sssNo,
    tinNo,
    agencyEmployeeNo,
    citizenship,
    residentialAddress,
    permanentAddress,
    telephone,
    mobile,
    email,
    photoDataUrl,
    familyBackground,
    educationalBackground,
  } = normalizedPayload;

  if (!surname || !firstName || !mobile || !email) {
    return res.status(400).json({ message: 'Surname, first name, mobile number, and email are required' });
  }

  const normalizedCitizenship = typeof citizenship === 'string'
    ? { type: citizenship }
    : (citizenship || { type: 'Filipino' });

  if (
    normalizedCitizenship.type === 'Dual Citizenship' &&
    (!normalizedCitizenship.dualCitizenshipMode || !normalizedCitizenship.dualCitizenshipCountry)
  ) {
    return res.status(400).json({ message: 'Dual citizenship requires type and country selection' });
  }

  const normalizeAddress = (address) => {
    if (!address) {
      return {
        houseBlockLotNo: '',
        street: '',
        subdivisionVillage: '',
        barangay: '',
        cityMunicipality: '',
        province: '',
        zipCode: '',
      };
    }

    if (typeof address === 'string') {
      return {
        houseBlockLotNo: '',
        street: '',
        subdivisionVillage: '',
        barangay: '',
        cityMunicipality: address,
        province: '',
        zipCode: '',
      };
    }

    return address;
  };

  const sanitizeLearningDevelopment = (value) => {
    const inputArray = Array.isArray(value)
      ? value
      : (typeof value === 'string' ? [value] : []);

    if (!inputArray.length) return [];

    const normalizeLdObject = (item) => ({
      title: item?.title ? String(item.title).trim() : '',
      from: item?.from ? String(item.from).trim() : '',
      to: item?.to ? String(item.to).trim() : '',
      hours: item?.hours ? String(item.hours).trim() : '',
      type: item?.type ? String(item.type).trim() : '',
      conductedBy: item?.conductedBy ? String(item.conductedBy).trim() : '',
    });

    const parseLdEntriesFromString = (text) => {
      if (typeof text !== 'string') return [];

      const source = text
        .replace(/\r/g, ' ')
        .replace(/\\n/g, ' ')
        .replace(/["']\s*\+\s*["']/g, ' ')
        .replace(/["']\s*\+\s*/g, ' ')
        .replace(/\s*\+\s*["']/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      const objectBlocks = source.match(/\{[\s\S]*?\}/g);
      const candidates = objectBlocks && objectBlocks.length > 0 ? objectBlocks : [source];

      const parseOne = (chunk) => {
        const pick = (key) => {
          const match = chunk.match(new RegExp(`${key}\\s*:\\s*['\"]([^'\"]*)['\"]`, 'i'));
          return match ? match[1].trim() : '';
        };

        const parsed = {
          title: pick('title'),
          from: pick('from'),
          to: pick('to'),
          hours: pick('hours'),
          type: pick('type'),
          conductedBy: pick('conductedBy'),
        };

        return Object.values(parsed).some(Boolean) ? parsed : null;
      };

      return candidates.map(parseOne).filter(Boolean);
    };

    const normalizedRows = [];

    inputArray
      .flatMap((item) => (Array.isArray(item) ? item : [item]))
      .forEach((item) => {
        if (item && typeof item === 'object' && !Array.isArray(item)) {
          normalizedRows.push(normalizeLdObject(item));
          return;
        }

        if (typeof item === 'string') {
          const parsedRows = parseLdEntriesFromString(item);
          parsedRows.forEach((parsed) => normalizedRows.push(normalizeLdObject(parsed)));
        }
      });

    // Never return raw strings to Mongoose; keep only normalized object rows.
    return normalizedRows.filter((row) => row && typeof row === 'object' && !Array.isArray(row));
  };

  try {
    const countToday = await PersonalDataSheet.countDocuments({
      createdAt: {
        $gte: new Date(new Date().setHours(0, 0, 0, 0)),
        $lt: new Date(new Date().setHours(23, 59, 59, 999)),
      },
    });

    const pdsId = `PDS-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(countToday + 1).padStart(4, '0')}`;

    // Save the full normalized payload where possible to preserve all submitted fields
    const authenticatedStaffId = req.user?.staffId ? String(req.user.staffId).trim() : undefined;
    const authenticatedEmail = req.user?.email ? String(req.user.email).trim().toLowerCase() : undefined;
    const authenticatedName = req.user?.name ? String(req.user.name).trim() : undefined;
    const payloadEmail = email ? String(email).trim().toLowerCase() : undefined;
    const isAdminCreateRecord = Boolean(normalizedPayload.adminCreateRecord) && Boolean(req.user) && isSystemAdminRole(req.user.role);
    const shouldAutoApprove = isAdminCreateRecord;

    let latestOwnedPds = null;
    if (req.user && !isAdminCreateRecord) {
      const ownerEmailForLookup = authenticatedEmail || payloadEmail;

      if (ownerEmailForLookup) {
        const escapedOwnerEmail = ownerEmailForLookup.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const ownerFilter = {
          $and: [
            {
              $or: [
                { ownerEmail: new RegExp(`^${escapedOwnerEmail}$`, 'i') },
                { email: new RegExp(`^${escapedOwnerEmail}$`, 'i') },
              ],
            },
            { submittedOnBehalf: { $ne: true } },
          ],
        };

        latestOwnedPds = await PersonalDataSheet.findOne(ownerFilter)
          .sort({ createdAt: -1 })
          .select('status updatePermissionGranted')
          .lean();

        if (
          latestOwnedPds
          && /^\s*approved\s*$/i.test(String(latestOwnedPds.status || ''))
        ) {
          if (hasActivePdsUpdatePermission(latestOwnedPds)) {
            return res.status(409).json({
              message: 'Please update your existing approved PDS record instead of submitting a new one.',
            });
          }

          return res.status(403).json({
            message: 'Your approved PDS is locked. Please ask Admin/HR to grant update permission from the PDS record view.',
          });
        }
      }
    }

    // If the user is submitting a revised PDS, remove prior "For Revision" rows tied to the same account.
    const revisionRecordMatchers = [];
    if (authenticatedStaffId) {
      revisionRecordMatchers.push({ submittedByStaffId: authenticatedStaffId });
    }
    if (authenticatedEmail) {
      revisionRecordMatchers.push({ submittedByEmail: authenticatedEmail });
    }
    if (payloadEmail) {
      revisionRecordMatchers.push({ submittedByEmail: payloadEmail });
      revisionRecordMatchers.push({ email: payloadEmail });
    }

    if (revisionRecordMatchers.length > 0) {
      await PersonalDataSheet.deleteMany({
        status: 'For Revision',
        $or: revisionRecordMatchers,
      });
    }

    let ownerEmail = authenticatedEmail || payloadEmail;
    let submittedOnBehalf = false;

    // Admin-created records from PDS Record are treated as on-behalf submissions.
    // They should not appear in the admin submitter's "My PDS" view.
    if (Boolean(normalizedPayload.adminCreateRecord) && Boolean(req.user) && isSystemAdminRole(req.user.role)) {
      if (payloadEmail && authenticatedEmail && payloadEmail !== authenticatedEmail) {
        submittedOnBehalf = true;
        ownerEmail = payloadEmail;
      }
    }

    const sanitizedLearningDevelopment = sanitizeLearningDevelopment(normalizedPayload.learningDevelopment);

    const pds = new PersonalDataSheet({
      pdsId,
      ownerEmail,
      submittedOnBehalf,
      submittedByStaffId: authenticatedStaffId,
      submittedByEmail: authenticatedEmail,
      submittedByName: authenticatedName,
      surname,
      firstName,
      middleName,
      nameExtension,
      dateOfBirth,
      placeOfBirth,
      sexAtBirth,
      civilStatus,
      height,
      weight,
      bloodType,
      gsisNo,
      pagibigNo,
      philhealthNo,
      sssNo,
      tinNo,
      agencyEmployeeNo,
      citizenship: normalizedCitizenship,
      residentialAddress: normalizeAddress(residentialAddress),
      permanentAddress: normalizeAddress(permanentAddress),
      telephone,
      mobile,
      email,
      photoDataUrl,
      familyBackground,
      educationalBackground,
      civilServiceEligibilities: normalizedPayload.civilServiceEligibilities || [],
      workExperience: normalizedPayload.workExperience || [],
      voluntaryWork: normalizedPayload.voluntaryWork || [],
      learningDevelopment: sanitizedLearningDevelopment,
      specialSkills: normalizedPayload.specialSkills || [],
      distinctions: normalizedPayload.distinctions || [],
      memberships: normalizedPayload.memberships || [],
      relatedThirdDegree: normalizedPayload.relatedThirdDegree,
      relatedFourthDegree: normalizedPayload.relatedFourthDegree,
      relatedDetails: normalizedPayload.relatedDetails,
      adminOffense: normalizedPayload.adminOffense,
      adminOffenseDetails: normalizedPayload.adminOffenseDetails,
      criminalCharge: normalizedPayload.criminalCharge,
      criminalChargeDetails: normalizedPayload.criminalChargeDetails,
      criminalChargeDateFiled: normalizedPayload.criminalChargeDateFiled,
      criminalChargeStatus: normalizedPayload.criminalChargeStatus,
      convicted: normalizedPayload.convicted,
      convictedDetails: normalizedPayload.convictedDetails,
      separated: normalizedPayload.separated,
      separatedDetails: normalizedPayload.separatedDetails,
      candidate: normalizedPayload.candidate,
      candidateDetails: normalizedPayload.candidateDetails,
      resignedToCampaign: normalizedPayload.resignedToCampaign,
      resignedDetails: normalizedPayload.resignedDetails,
      immigrant: normalizedPayload.immigrant,
      immigrantCountry: normalizedPayload.immigrantCountry,
      indigenous: normalizedPayload.indigenous,
      indigenousDetails: normalizedPayload.indigenousDetails,
      pwd: normalizedPayload.pwd,
      pwdId: normalizedPayload.pwdId,
      soloParent: normalizedPayload.soloParent,
      soloParentId: normalizedPayload.soloParentId,
      references: normalizedPayload.references || [],
      declaration: Boolean(normalizedPayload.declaration),
      govId: {
        ...(normalizedPayload.govId || {}),
        idType: normalizedPayload.govId?.idType || normalizedPayload.govId?.type || '',
      },
      status: shouldAutoApprove ? 'Approved' : 'Pending',
      reviewedBy: shouldAutoApprove ? (authenticatedName || 'System Admin') : undefined,
      reviewedAt: shouldAutoApprove ? Date.now() : undefined,
      updatePermissionGranted: false,
      updatePermissionGrantedAt: undefined,
      updatePermissionGrantedBy: undefined,
    });

    await pds.save();

    res.status(201).json({ message: 'Personal Data Sheet submitted successfully', pds });
  } catch (error) {
    console.error('Error submitting PDS:', error);
    if (error.name === 'ValidationError' || error.name === 'CastError') {
      return res.status(400).json({ message: error.message });
    }
    res.status(500).json({ message: 'Failed to submit Personal Data Sheet' });
  }
});

app.get('/personal-data-sheets/my', verifyToken, async (req, res) => {
  try {
    const tokenUserId = String(req.user?.id || '').trim();
    const tokenEmail = String(req.user?.email || '').trim().toLowerCase();

    // Resolve canonical account identity from Staff to avoid stale/missing token email claims.
    let canonicalEmail = tokenEmail;
    if (tokenUserId) {
      const staffQuery = { _id: tokenUserId };
      const currentStaff = await Staff.findOne(staffQuery).select('id email').lean();
      if (currentStaff?.email) {
        canonicalEmail = String(currentStaff.email).trim().toLowerCase();
      }
    }

    if (!canonicalEmail) {
      return res.json({ latestSubmission: null, approvedPds: null });
    }

    // Backfill legacy records that clearly belong to this user but were created before owner fields existed.
    // Tight match requires submitter email == subject email to avoid adopting on-behalf records.
    if (canonicalEmail) {
      const escapedCanonicalEmail = canonicalEmail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      await PersonalDataSheet.updateMany(
        {
          ownerEmail: { $exists: false },
          submittedByEmail: new RegExp(`^${escapedCanonicalEmail}$`, 'i'),
          email: new RegExp(`^${escapedCanonicalEmail}$`, 'i'),
          submittedOnBehalf: { $ne: true },
        },
        {
          $set: {
            ownerEmail: canonicalEmail,
            submittedOnBehalf: false,
          },
        }
      );
    }

    const escapedCanonicalEmail = canonicalEmail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const myPdsFilter = {
      $and: [
        {
          $or: [
            { ownerEmail: new RegExp(`^${escapedCanonicalEmail}$`, 'i') },
            { email: new RegExp(`^${escapedCanonicalEmail}$`, 'i') },
          ],
        },
        { submittedOnBehalf: { $ne: true } },
      ],
    };

    const approvedStatusRegex = /^\s*approved\s*$/i;

    const [latestSubmission, approvedPds] = await Promise.all([
      PersonalDataSheet.findOne(myPdsFilter).sort({ createdAt: -1 }),
      PersonalDataSheet.findOne({
        ...myPdsFilter,
        status: approvedStatusRegex,
      }).sort({ reviewedAt: -1, createdAt: -1 }),
    ]);

    res.json({ latestSubmission, approvedPds });
  } catch (error) {
    console.error('Error fetching current user PDS:', error);
    res.status(500).json({ message: 'Failed to fetch your Personal Data Sheet' });
  }
});

// Get PDS submissions (admin)
app.get('/personal-data-sheets', verifyToken, requireRole([ROLES.SUPER_ADMIN, ROLES.ADMIN_HR, ROLES.HEAD_OFFICER]), async (req, res) => {
  try {
    const { status } = req.query;
    const filterParts = [];

    if (status && ['Pending', 'Approved', 'Disapproved', 'For Revision'].includes(status)) {
      filterParts.push({ status });
    }
    const managedStaff = await getDepartmentStaff(req.user);
    if (managedStaff) filterParts.push(getPdsDepartmentFilter(managedStaff));

    const sheets = await PersonalDataSheet.find(filterParts.length ? { $and: filterParts } : {})
      .select('-specialOrderNumberAttachment.storagePath')
      .sort({ createdAt: -1 });
    res.json(sheets);
  } catch (error) {
    console.error('Error fetching PDS submissions:', error);
    res.status(500).json({ message: 'Failed to fetch Personal Data Sheets' });
  }
});

app.get('/personal-data-sheets/awardees', verifyToken, requireRole([ROLES.SUPER_ADMIN, ROLES.ADMIN_HR, ROLES.HEAD_OFFICER]), async (req, res) => {
  try {
    const managedStaff = await getDepartmentStaff(req.user);
    let awardeeFilter = {};
    if (managedStaff) {
      const managedPds = await PersonalDataSheet.find(getPdsDepartmentFilter(managedStaff)).select('pdsId').lean();
      awardeeFilter = { sourcePdsId: { $in: managedPds.map((pds) => pds.pdsId).filter(Boolean) } };
    }
    const awardees = await PdsAwardee.find(awardeeFilter).sort({ createdAt: -1 }).lean();
    res.json(awardees);
  } catch (error) {
    console.error('Error fetching PDS awardees:', error);
    res.status(500).json({ message: 'Failed to fetch PDS awardees.' });
  }
});

app.post('/personal-data-sheets/awardees', verifyToken, requireRole([ROLES.SUPER_ADMIN, ROLES.ADMIN_HR, ROLES.HEAD_OFFICER]), async (req, res) => {
  const sourcePdsId = String(req.body?.sourcePdsId || '').trim();
  const awardType = String(req.body?.awardType || '').trim();
  if (!sourcePdsId || !awardType) {
    return res.status(400).json({ message: 'PDS record and award type are required.' });
  }

  try {
    const sourceRecord = await PersonalDataSheet.findOne({
      pdsId: sourcePdsId,
      status: 'Approved',
    })
      .select('-specialOrderNumberAttachment.storagePath')
      .lean();
    if (!sourceRecord) {
      return res.status(404).json({ message: 'Approved PDS record not found.' });
    }
    if (!(await canManagePdsRecord(req.user, sourceRecord))) {
      return res.status(403).json({ message: 'You can only add staff from your department to Awardee.' });
    }

    const { _id, __v, ...pdsSnapshot } = sourceRecord;
    const awardee = await PdsAwardee.create({
      awardeeId: randomUUID(),
      sourcePdsId,
      awardType,
      pdsSnapshot,
      createdBy: req.user?.staffId || req.user?.email || 'Admin/HR',
    });

    res.status(201).json({ awardee });
  } catch (error) {
    console.error('Error creating PDS awardee copy:', error);
    res.status(500).json({ message: 'Failed to add record to Awardee.' });
  }
});

app.delete('/personal-data-sheets/awardees/:awardeeId', verifyToken, requireRole([ROLES.SUPER_ADMIN, ROLES.ADMIN_HR, ROLES.HEAD_OFFICER]), async (req, res) => {
  try {
    const target = await PdsAwardee.findOne({ awardeeId: req.params.awardeeId }).select('sourcePdsId');
    if (!target) {
      return res.status(404).json({ message: 'Awardee record not found.' });
    }
    const sourceRecord = await PersonalDataSheet.findOne({ pdsId: target.sourcePdsId })
      .select('ownerStaffId submittedByStaffId ownerEmail submittedByEmail email')
      .lean();
    if (!(await canManagePdsRecord(req.user, sourceRecord))) {
      return res.status(403).json({ message: 'You can only remove Awardee records for staff in your department.' });
    }
    const deleted = await PdsAwardee.findOneAndDelete({ awardeeId: req.params.awardeeId });
    if (!deleted) {
      return res.status(404).json({ message: 'Awardee record not found.' });
    }
    res.json({ message: 'Awardee copy removed.' });
  } catch (error) {
    console.error('Error removing PDS awardee copy:', error);
    res.status(500).json({ message: 'Failed to remove Awardee record.' });
  }
});

app.put(
  '/personal-data-sheets/:pdsId/separation-details',
  verifyToken,
  requireRole([ROLES.SUPER_ADMIN, ROLES.ADMIN_HR, ROLES.HEAD_OFFICER]),
  async (req, res) => {
    const allowedReasons = ['retirement', 'death', 'resignation', 'termination', 'drop-from-roles', 'transfer-to-other-agency'];
    const separationReason = String(req.body?.separationReason || '');
    const effectivityDateValue = String(req.body?.effectivityDate || '');
    const effectivityDate = new Date(`${effectivityDateValue}T00:00:00.000Z`);

    if (!allowedReasons.includes(separationReason)) {
      return res.status(400).json({ message: 'Select a valid separated/retiree type.' });
    }
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(effectivityDateValue)
      || Number.isNaN(effectivityDate.getTime())
      || effectivityDate.toISOString().slice(0, 10) !== effectivityDateValue
    ) {
      return res.status(400).json({ message: 'A valid effectivity date is required.' });
    }

    try {
      const pds = await PersonalDataSheet.findOne({ pdsId: req.params.pdsId });
      if (!pds) {
        return res.status(404).json({ message: 'PDS record not found.' });
      }
      if (!(await canManagePdsRecord(req.user, pds))) {
        return res.status(403).json({ message: 'You can only manage PDS records for staff in your department.' });
      }

      const ownerEmail = pds.ownerEmail || pds.email;
      const staff = (
        (ownerEmail ? await Staff.findOne({ email: String(ownerEmail).trim().toLowerCase() }).lean() : null)
        || (pds.ownerStaffId ? await Staff.findOne({ id: pds.ownerStaffId }).lean() : null)
      );
      const now = new Date();
      const year = Number(new Intl.DateTimeFormat('en', {
        timeZone: 'Asia/Manila',
        year: 'numeric',
      }).format(now));
      const previousOrder = pds.separationOrder || {};
      const preserveOrderNumber = Boolean(previousOrder.orderNumber && previousOrder.year === year);
      const orderNumber = preserveOrderNumber
        ? previousOrder.orderNumber
        : await getNextSpecialOrderNumber(year);
      const currentWork = (pds.workExperience || []).find((work) => (
        !work?.to || ['present', 'current'].includes(String(work.to).trim().toLowerCase())
      )) || pds.workExperience?.[0];
      const monthlyCompensationCandidate = staff?.monthlyBasicSalary
        ?? staff?.grossSalary
        ?? pds.jobApplication?.monthlySalary;
      const monthlyCompensation = Number.isFinite(Number(monthlyCompensationCandidate))
        && monthlyCompensationCandidate !== null
        && monthlyCompensationCandidate !== ''
        ? Number(monthlyCompensationCandidate)
        : null;
      const position = [
        currentWork?.positionTitle,
        staff?.position,
        pds.jobApplication?.positionTitle,
      ].find((value) => value && String(value).trim().toLowerCase() !== 'n/a') || 'N/A';
      const department = [
        staff?.department,
        pds.department,
        pds.officeDepartment,
        pds.jobApplication?.office,
      ].find((value) => value && String(value).trim().toLowerCase() !== 'n/a') || 'N/A';
      const fullName = [
        pds.surname,
        pds.firstName,
        pds.middleName,
        pds.nameExtension,
      ].filter(Boolean).join(', ');

      pds.recordCategory = 'separated-retirees';
      pds.separationReason = separationReason;
      pds.separationOrder = {
        orderNumber,
        year,
        orderDate: preserveOrderNumber && previousOrder.orderDate ? previousOrder.orderDate : now,
        fullName,
        position,
        department,
        monthlyCompensation,
        separationReason,
        effectivityDate,
      };
      pds.effectivityDate = effectivityDate;
      pds.updatedAt = now;
      await pds.save();

      const responsePds = pds.toObject();
      if (responsePds.specialOrderNumberAttachment) {
        delete responsePds.specialOrderNumberAttachment.storagePath;
      }
      res.json({ message: 'Separation Order generated.', pds: responsePds });
    } catch (error) {
      console.error('Error generating PDS Separation Order:', error);
      res.status(500).json({ message: 'Failed to generate the Separation Order.' });
    }
  }
);

app.get(
  '/personal-data-sheets/:pdsId/separation-order-attachment',
  verifyToken,
  requireRole([ROLES.SUPER_ADMIN, ROLES.ADMIN_HR, ROLES.HEAD_OFFICER]),
  async (req, res) => {
    try {
      const pds = await PersonalDataSheet.findOne({ pdsId: req.params.pdsId })
        .select('specialOrderNumberAttachment ownerStaffId submittedByStaffId ownerEmail submittedByEmail email')
        .lean();
      if (!pds) return res.status(404).json({ message: 'PDS record not found.' });
      if (!(await canManagePdsRecord(req.user, pds))) {
        return res.status(403).json({ message: 'You can only access PDS records for staff in your department.' });
      }
      const attachment = pds?.specialOrderNumberAttachment;
      if (!attachment?.storagePath || !fs.existsSync(attachment.storagePath)) {
        return res.status(404).json({ message: 'Special Order attachment not found.' });
      }

      res.type(attachment.mimeType);
      res.setHeader(
        'Content-Disposition',
        `inline; filename*=UTF-8''${encodeURIComponent(attachment.fileName || 'special-order')}`
      );
      const stream = fs.createReadStream(attachment.storagePath);
      stream.on('error', (error) => {
        console.error('Error reading Special Order attachment:', error);
        if (!res.headersSent) {
          res.status(500).json({ message: 'Failed to read Special Order attachment.' });
        } else {
          res.destroy(error);
        }
      });
      stream.pipe(res);
    } catch (error) {
      console.error('Error retrieving Special Order attachment:', error);
      res.status(500).json({ message: 'Failed to retrieve Special Order attachment.' });
    }
  }
);

// Update PDS submission (admin, or owner when granted update permission)
app.put('/personal-data-sheets/:pdsId', verifyToken, async (req, res) => {
  const { pdsId } = req.params;

  const normalizeEmptyStrings = (value) => {
    if (typeof value === 'string') {
      const trimmed = value.trim();
      return trimmed === '' ? undefined : trimmed;
    }

    if (Array.isArray(value)) {
      return value.map((item) => normalizeEmptyStrings(item));
    }

    if (value && typeof value === 'object') {
      return Object.entries(value).reduce((acc, [key, nestedValue]) => {
        acc[key] = normalizeEmptyStrings(nestedValue);
        return acc;
      }, {});
    }

    return value;
  };

  const parsePossiblyStringified = (val) => {
    if (val === undefined || val === null) return val;
    if (typeof val !== 'string') return val;
    const trimmed = val.trim();
    if (!trimmed.startsWith('[') && !trimmed.startsWith('{')) return val;

    try {
      return JSON.parse(trimmed);
    } catch (jsonErr) {
      try {
        // eslint-disable-next-line no-new-func
        return Function('"use strict";return (' + trimmed + ')')();
      } catch (evalErr) {
        const objectBlocks = trimmed.match(/\{[\s\S]*?\}/g);
        if (objectBlocks && objectBlocks.length > 0) {
          try {
            const parsedBlocks = objectBlocks.map((block) => {
              const normalized = block
                // Recover malformed concatenated fragments: ' + " ... " + '
                .replace(/["']\s*\+\s*["']/g, '')
                .replace(/["']\s*\+\s*/g, '')
                .replace(/\s*\+\s*["']/g, '')
                .replace(/([{,]\s*)([A-Za-z0-9_]+)\s*:/g, '$1"$2":')
                .replace(/'/g, '"')
                .replace(/,\s*}/g, '}')
                .replace(/,\s*]/g, ']');
              return JSON.parse(normalized);
            });
            return trimmed.startsWith('[') ? parsedBlocks : parsedBlocks[0];
          } catch (blockErr) {
            return val;
          }
        }

        return val;
      }
    }
  };

  const normalizeAddress = (address) => {
    if (!address) {
      return {
        houseBlockLotNo: '',
        street: '',
        subdivisionVillage: '',
        barangay: '',
        cityMunicipality: '',
        province: '',
        zipCode: '',
      };
    }

    if (typeof address === 'string') {
      return {
        houseBlockLotNo: '',
        street: '',
        subdivisionVillage: '',
        barangay: '',
        cityMunicipality: address,
        province: '',
        zipCode: '',
      };
    }

    return address;
  };

  const sanitizeLearningDevelopment = (value) => {
    const inputArray = Array.isArray(value)
      ? value
      : (typeof value === 'string' ? [value] : []);

    if (!inputArray.length) return [];

    const normalizeLdObject = (item) => ({
      title: item?.title ? String(item.title).trim() : '',
      from: item?.from ? String(item.from).trim() : '',
      to: item?.to ? String(item.to).trim() : '',
      hours: item?.hours ? String(item.hours).trim() : '',
      type: item?.type ? String(item.type).trim() : '',
      conductedBy: item?.conductedBy ? String(item.conductedBy).trim() : '',
    });

    const parseLdEntriesFromString = (text) => {
      if (typeof text !== 'string') return [];

      const source = text
        .replace(/\r/g, ' ')
        .replace(/\\n/g, ' ')
        .replace(/["']\s*\+\s*["']/g, ' ')
        .replace(/["']\s*\+\s*/g, ' ')
        .replace(/\s*\+\s*["']/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      const objectBlocks = source.match(/\{[\s\S]*?\}/g);
      const candidates = objectBlocks && objectBlocks.length > 0 ? objectBlocks : [source];

      const parseOne = (chunk) => {
        const pick = (key) => {
          const match = chunk.match(new RegExp(`${key}\\s*:\\s*['\"]([^'\"]*)['\"]`, 'i'));
          return match ? match[1].trim() : '';
        };

        const parsed = {
          title: pick('title'),
          from: pick('from'),
          to: pick('to'),
          hours: pick('hours'),
          type: pick('type'),
          conductedBy: pick('conductedBy'),
        };

        return Object.values(parsed).some(Boolean) ? parsed : null;
      };

      return candidates.map(parseOne).filter(Boolean);
    };

    const normalizedRows = [];

    inputArray
      .flatMap((item) => (Array.isArray(item) ? item : [item]))
      .forEach((item) => {
        if (item && typeof item === 'object' && !Array.isArray(item)) {
          normalizedRows.push(normalizeLdObject(item));
          return;
        }

        if (typeof item === 'string') {
          const parsedRows = parseLdEntriesFromString(item);
          parsedRows.forEach((parsed) => normalizedRows.push(normalizeLdObject(parsed)));
        }
      });

    // Never return raw strings to Mongoose; keep only normalized object rows.
    return normalizedRows.filter((row) => row && typeof row === 'object' && !Array.isArray(row));
  };

  try {
    const normalizedPayload = normalizeEmptyStrings(req.body || {});
    const hasPhotoPayload = Object.prototype.hasOwnProperty.call(req.body || {}, 'photoDataUrl');
    if (hasPhotoPayload && !isValidPdsPhotoDataUrl(normalizedPayload.photoDataUrl)) {
      return res.status(400).json({ message: 'A JPG, PNG, or WebP PDS photo up to 5 MB is required.' });
    }

    const coerceArrayEntries = (fieldName) => {
      const fieldValue = normalizedPayload[fieldName];
      if (!Array.isArray(fieldValue)) return;

      let changed = false;
      const expanded = [];

      fieldValue.forEach((item) => {
        if (typeof item !== 'string') {
          expanded.push(item);
          return;
        }

        const parsed = parsePossiblyStringified(item);

        if (Array.isArray(parsed)) {
          expanded.push(...parsed);
          changed = true;
          return;
        }

        if (parsed && typeof parsed === 'object') {
          expanded.push(parsed);
          changed = true;
          return;
        }

        expanded.push(item);
      });

      if (changed) {
        normalizedPayload[fieldName] = expanded;
      }
    };

    ['workExperience', 'voluntaryWork', 'learningDevelopment', 'specialSkills', 'distinctions', 'memberships', 'references', 'civilServiceEligibilities', 'educationalBackground'].forEach((fieldName) => {
      if (normalizedPayload[fieldName] && typeof normalizedPayload[fieldName] === 'string') {
        normalizedPayload[fieldName] = parsePossiblyStringified(normalizedPayload[fieldName]);
      }
    });

    ['workExperience', 'voluntaryWork', 'learningDevelopment', 'specialSkills', 'distinctions', 'memberships', 'references', 'civilServiceEligibilities', 'educationalBackground'].forEach(coerceArrayEntries);

    const {
      surname,
      firstName,
      middleName,
      nameExtension,
      dateOfBirth,
      placeOfBirth,
      sexAtBirth,
      civilStatus,
      height,
      weight,
      bloodType,
      gsisNo,
      pagibigNo,
      philhealthNo,
      sssNo,
      tinNo,
      agencyEmployeeNo,
      citizenship,
      residentialAddress,
      permanentAddress,
      telephone,
      mobile,
      email,
      photoDataUrl,
      familyBackground,
      educationalBackground,
    } = normalizedPayload;

    if (!surname || !firstName || !mobile || !email) {
      return res.status(400).json({ message: 'Surname, first name, mobile number, and email are required' });
    }

    const normalizedCitizenship = typeof citizenship === 'string'
      ? { type: citizenship }
      : (citizenship || { type: 'Filipino' });

    if (
      normalizedCitizenship.type === 'Dual Citizenship' &&
      (!normalizedCitizenship.dualCitizenshipMode || !normalizedCitizenship.dualCitizenshipCountry)
    ) {
      return res.status(400).json({ message: 'Dual citizenship requires type and country selection' });
    }

    const updateDoc = {
      surname,
      firstName,
      middleName,
      nameExtension,
      dateOfBirth,
      placeOfBirth,
      sexAtBirth,
      civilStatus,
      height,
      weight,
      bloodType,
      gsisNo,
      pagibigNo,
      philhealthNo,
      sssNo,
      tinNo,
      agencyEmployeeNo,
      citizenship: normalizedCitizenship,
      residentialAddress: normalizeAddress(residentialAddress),
      permanentAddress: normalizeAddress(permanentAddress),
      telephone,
      mobile,
      email,
      photoDataUrl,
      familyBackground,
      educationalBackground: educationalBackground || [],
      civilServiceEligibilities: normalizedPayload.civilServiceEligibilities || [],
      workExperience: normalizedPayload.workExperience || [],
      voluntaryWork: normalizedPayload.voluntaryWork || [],
      learningDevelopment: sanitizeLearningDevelopment(normalizedPayload.learningDevelopment),
      specialSkills: normalizedPayload.specialSkills || [],
      distinctions: normalizedPayload.distinctions || [],
      memberships: normalizedPayload.memberships || [],
      relatedThirdDegree: normalizedPayload.relatedThirdDegree,
      relatedFourthDegree: normalizedPayload.relatedFourthDegree,
      relatedDetails: normalizedPayload.relatedDetails,
      adminOffense: normalizedPayload.adminOffense,
      adminOffenseDetails: normalizedPayload.adminOffenseDetails,
      criminalCharge: normalizedPayload.criminalCharge,
      criminalChargeDetails: normalizedPayload.criminalChargeDetails,
      criminalChargeDateFiled: normalizedPayload.criminalChargeDateFiled,
      criminalChargeStatus: normalizedPayload.criminalChargeStatus,
      convicted: normalizedPayload.convicted,
      convictedDetails: normalizedPayload.convictedDetails,
      separated: normalizedPayload.separated,
      separatedDetails: normalizedPayload.separatedDetails,
      candidate: normalizedPayload.candidate,
      candidateDetails: normalizedPayload.candidateDetails,
      resignedToCampaign: normalizedPayload.resignedToCampaign,
      resignedDetails: normalizedPayload.resignedDetails,
      immigrant: normalizedPayload.immigrant,
      immigrantCountry: normalizedPayload.immigrantCountry,
      indigenous: normalizedPayload.indigenous,
      indigenousDetails: normalizedPayload.indigenousDetails,
      pwd: normalizedPayload.pwd,
      pwdId: normalizedPayload.pwdId,
      soloParent: normalizedPayload.soloParent,
      soloParentId: normalizedPayload.soloParentId,
      references: normalizedPayload.references || [],
      declaration: Boolean(normalizedPayload.declaration),
      govId: {
        ...(normalizedPayload.govId || {}),
        idType: normalizedPayload.govId?.idType || normalizedPayload.govId?.type || '',
      },
      updatedAt: Date.now(),
    };
    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'jobApplication')) {
      const selectedPostingId = normalizedPayload.jobApplication?.postingId;
      if (!selectedPostingId) {
        updateDoc.jobApplication = null;
      } else {
        const posting = await JobPosting.findOne({
          postingId: String(selectedPostingId),
          status: 'Published',
        }).lean();
        if (!posting) {
          return res.status(400).json({ message: 'The selected position is no longer available.' });
        }
        const applicantQualifications = normalizedPayload.jobApplication.applicantQualifications || {};
        const qualificationFailures = validateJobApplicationQualifications(posting, applicantQualifications);
        if (qualificationFailures.length > 0) {
          return res.status(400).json({
            message: 'The applicant does not meet all qualifications for this position.',
            qualificationFailures,
          });
        }
        updateDoc.jobApplication = {
          postingId: posting.postingId,
          placeOfAssignment: posting.placeOfAssignment,
          positionTitle: posting.positionTitle,
          plantillaItemNumber: posting.plantillaItemNumber,
          salaryJobPayGrade: posting.salaryJobPayGrade,
          monthlySalary: posting.monthlySalary,
          eligibility: normalizeJobEligibility(posting.eligibility),
          education: posting.education,
          training: posting.training,
          workExperience: posting.workExperience,
          competency: posting.competency,
          applicantQualifications,
          status: 'Pending',
          submittedAt: new Date(),
        };
      }
    }
    if (!hasPhotoPayload) {
      delete updateDoc.photoDataUrl;
    }

    const existingPds = await PersonalDataSheet.findOne({ pdsId })
      .select('ownerStaffId submittedByStaffId ownerEmail submittedOnBehalf submittedByEmail email status updatePermissionGranted updatePermissionExpiresAt')
      .lean();
    if (!existingPds) {
      return res.status(404).json({ message: 'PDS submission not found' });
    }

    const requesterRole = normalizeRole(req.user?.role);
    const isAdminRequester = isDepartmentStaffManager(req.user);
    const requesterEmail = String(req.user?.email || '').trim().toLowerCase();
    const ownerEmail = String(existingPds.ownerEmail || existingPds.email || '').trim().toLowerCase();
    const isOwner = Boolean(requesterEmail) && Boolean(ownerEmail) && requesterEmail === ownerEmail;

    if (requesterRole === ROLES.HEAD_OFFICER && !(await canManagePdsRecord(req.user, existingPds))) {
      return res.status(403).json({ message: 'You can only manage PDS records for staff in your department.' });
    }

    if (!isAdminRequester) {
      if (!isOwner) {
        return res.status(403).json({ message: 'You can only update your own PDS record.' });
      }

      const isApprovedRecord = /^\s*approved\s*$/i.test(String(existingPds.status || ''));
      if (!isApprovedRecord || !hasActivePdsUpdatePermission(existingPds)) {
        return res.status(403).json({
          message: 'Your approved PDS is locked. Please ask Admin/HR to grant update permission from the PDS record view.',
        });
      }

      // User edits of approved records are resubmitted for admin review.
      updateDoc.status = 'Pending';
      updateDoc.remarks = '';
      updateDoc.reviewedBy = undefined;
      updateDoc.reviewedAt = undefined;
      updateDoc.updatePermissionGranted = false;
      updateDoc.updatePermissionGrantedAt = undefined;
      updateDoc.updatePermissionGrantedBy = undefined;
      updateDoc.updatePermissionExpiresAt = undefined;
    }

    if (!existingPds.ownerEmail) {
      const fallbackOwnerEmail = email
        ? String(email).trim().toLowerCase()
        : (existingPds.email ? String(existingPds.email).trim().toLowerCase() : undefined);

      updateDoc.ownerEmail = fallbackOwnerEmail;
      updateDoc.submittedOnBehalf = Boolean(existingPds.submittedOnBehalf);
    }

    const updated = await PersonalDataSheet.findOneAndUpdate(
      { pdsId },
      { $set: updateDoc },
      { new: true, runValidators: true }
    );

    res.json({ message: 'PDS updated successfully', pds: updated });
  } catch (error) {
    console.error('Error updating PDS submission:', error);
    if (error.name === 'ValidationError' || error.name === 'CastError') {
      return res.status(400).json({ message: error.message });
    }
    res.status(500).json({ message: 'Failed to update Personal Data Sheet' });
  }
});

// Review PDS submission (admin)
app.patch('/personal-data-sheets/:pdsId/review', verifyToken, requireRole([ROLES.SUPER_ADMIN, ROLES.ADMIN_HR, ROLES.HEAD_OFFICER]), async (req, res) => {
  const { pdsId } = req.params;
  const { status, remarks } = req.body;

  if (!['Approved', 'Disapproved', 'For Revision'].includes(status)) {
    return res.status(400).json({ message: 'Review status must be Approved, Disapproved, or For Revision' });
  }

  try {
    const target = await PersonalDataSheet.findOne({ pdsId }).select('ownerStaffId submittedByStaffId ownerEmail submittedByEmail email').lean();
    if (!target) return res.status(404).json({ message: 'PDS submission not found' });
    if (!(await canManagePdsRecord(req.user, target))) {
      return res.status(403).json({ message: 'You can only review PDS records for staff in your department.' });
    }
    const updated = await PersonalDataSheet.findOneAndUpdate(
      { pdsId },
      {
        $set: {
          status,
          remarks: remarks || '',
          reviewedBy: req.user.name,
          reviewedAt: Date.now(),
          ...(status === 'Approved'
            ? {
                updatePermissionGranted: false,
                updatePermissionGrantedAt: undefined,
                updatePermissionGrantedBy: undefined,
                updatePermissionExpiresAt: undefined,
              }
            : {}),
          updatedAt: Date.now(),
        },
      },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ message: 'PDS submission not found' });
    }

    res.json({ message: `PDS marked as ${status}`, pds: updated });
  } catch (error) {
    console.error('Error reviewing PDS submission:', error);
    res.status(500).json({ message: 'Failed to review Personal Data Sheet' });
  }
});

// Grant/revoke PDS update permission after approval (admin)
app.patch('/personal-data-sheets/:pdsId/update-permission', verifyToken, requireRole([ROLES.SUPER_ADMIN, ROLES.ADMIN_HR, ROLES.HEAD_OFFICER]), async (req, res) => {
  const { pdsId } = req.params;
  const { allowUpdate, durationDays } = req.body || {};

  if (typeof allowUpdate !== 'boolean') {
    return res.status(400).json({ message: 'allowUpdate must be a boolean value' });
  }

  const permissionExpiryDate = allowUpdate ? resolvePermissionExpiryDate(durationDays) : undefined;
  if (allowUpdate && durationDays != null && permissionExpiryDate === null) {
    return res.status(400).json({ message: 'durationDays must be a positive number when provided' });
  }

  try {
    const target = await PersonalDataSheet.findOne({ pdsId }).select('status ownerStaffId submittedByStaffId ownerEmail submittedByEmail email');
    if (!target) {
      return res.status(404).json({ message: 'PDS submission not found' });
    }
    if (!(await canManagePdsRecord(req.user, target))) {
      return res.status(403).json({ message: 'You can only change update permissions for staff in your department.' });
    }

    if (!/^\s*approved\s*$/i.test(String(target.status || ''))) {
      return res.status(400).json({ message: 'Update permission can only be changed for Approved PDS records' });
    }

    const updated = await PersonalDataSheet.findOneAndUpdate(
      { pdsId },
      {
        $set: {
          updatePermissionGranted: allowUpdate,
          updatePermissionGrantedAt: allowUpdate ? Date.now() : undefined,
          updatePermissionGrantedBy: allowUpdate ? (req.user.name || req.user.email || 'Admin/HR') : undefined,
          updatePermissionExpiresAt: allowUpdate ? permissionExpiryDate : undefined,
          updatedAt: Date.now(),
        },
      },
      { new: true }
    );

    res.json({
      message: allowUpdate
        ? 'PDS update permission granted successfully'
        : 'PDS update permission revoked successfully',
      pds: updated,
    });
  } catch (error) {
    console.error('Error updating PDS update permission:', error);
    res.status(500).json({ message: 'Failed to update PDS update permission' });
  }
});

// Grant PDS update permission to all employee-linked approved records (admin)
app.patch('/personal-data-sheets/update-permission/all-employees', verifyToken, requireRole([ROLES.SUPER_ADMIN, ROLES.ADMIN_HR]), async (req, res) => {
  const { allowUpdate = true, durationDays } = req.body || {};

  if (typeof allowUpdate !== 'boolean') {
    return res.status(400).json({ message: 'allowUpdate must be a boolean value' });
  }

  const permissionExpiryDate = allowUpdate ? resolvePermissionExpiryDate(durationDays) : undefined;

  if (allowUpdate && durationDays != null && permissionExpiryDate === null) {
    return res.status(400).json({ message: 'durationDays must be a positive number when provided' });
  }

  try {
    const staffAccounts = await Staff.find({
      $or: [
        { isActive: { $exists: false } },
        { isActive: true },
      ],
    })
      .select('id email')
      .lean();

    const staffIds = [...new Set(
      staffAccounts
        .map((staff) => String(staff.id || '').trim())
        .filter(Boolean)
    )];

    const staffEmails = [...new Set(
      staffAccounts
        .map((staff) => String(staff.email || '').trim().toLowerCase())
        .filter(Boolean)
    )];

    if (staffIds.length === 0 && staffEmails.length === 0) {
      return res.json({
        message: 'No employee accounts were found to update',
        matchedCount: 0,
        modifiedCount: 0,
      });
    }

    const updateResult = await PersonalDataSheet.updateMany(
      {
        status: { $regex: '^\\s*approved\\s*$', $options: 'i' },
        $or: [
          { ownerStaffId: { $in: staffIds } },
          { submittedByStaffId: { $in: staffIds } },
          { ownerEmail: { $in: staffEmails } },
          { email: { $in: staffEmails } },
        ],
      },
      {
        $set: {
          updatePermissionGranted: allowUpdate,
          updatePermissionGrantedAt: allowUpdate ? Date.now() : undefined,
          updatePermissionGrantedBy: allowUpdate ? (req.user.name || req.user.email || 'Admin/HR') : undefined,
          updatePermissionExpiresAt: allowUpdate ? permissionExpiryDate : undefined,
          updatedAt: Date.now(),
        },
      }
    );

    res.json({
      message: allowUpdate
        ? 'Update permission granted to all employee PDS records'
        : 'Update permission revoked for all employee PDS records',
      matchedCount: updateResult.matchedCount || 0,
      modifiedCount: updateResult.modifiedCount || 0,
    });
  } catch (error) {
    console.error('Error granting update permission to all employee PDS records:', error);
    res.status(500).json({ message: 'Failed to update permissions for employee PDS records' });
  }
});

// Delete PDS submission (admin)
app.delete('/personal-data-sheets/:pdsId', verifyToken, requireRole([ROLES.SUPER_ADMIN, ROLES.ADMIN_HR, ROLES.HEAD_OFFICER]), async (req, res) => {
  const { pdsId } = req.params;

  try {
    const target = await PersonalDataSheet.findOne({ pdsId }).select('ownerStaffId submittedByStaffId ownerEmail submittedByEmail email');
    if (!target) return res.status(404).json({ message: 'PDS submission not found' });
    if (!(await canManagePdsRecord(req.user, target))) {
      return res.status(403).json({ message: 'You can only delete PDS records for staff in your department.' });
    }
    const deleted = await PersonalDataSheet.findOneAndDelete({ pdsId });
    if (!deleted) {
      return res.status(404).json({ message: 'PDS submission not found' });
    }

    res.json({ message: 'PDS submission deleted successfully' });
  } catch (error) {
    console.error('Error deleting PDS submission:', error);
    res.status(500).json({ message: 'Failed to delete Personal Data Sheet' });
  }
});

// ==================== DPCRF ROUTES ====================

const DPCRF_PART_I_SECTION_TITLES = [
  "I. CORE FUNCTIONS: Functions that are the essential duties that directly fulfill an organization's mandate or mission.",
  "II. STRATEGIC FUNCTIONS: functions that guide an organization's direction, ensure alignment with its mission, and respond to internal and external changes.",
  "III. SUPPORT FUNCTIONS: Functions that are internal services that enable an organization's core and strategic functions to operate effectively.",
];

const normalizeDpcrfText = (value) => {
  if (value === undefined || value === null) return '';
  return String(value).trim();
};

const computeDpcrfAverageRating = (q, e, t) => {
  const values = [q, e, t]
    .map((value) => Number.parseFloat(normalizeDpcrfText(value)))
    .filter((value) => Number.isFinite(value));

  if (values.length === 0) return '';

  const average = values.reduce((sum, value) => sum + value, 0) / values.length;
  return average.toFixed(2).replace(/\.00$/, '');
};

const sanitizeDpcrfScaleRows = (rows) => {
  const defaultScales = [5, 4, 3, 2, 1];
  const incomingRows = Array.isArray(rows) ? rows : [];

  return defaultScales.map((scale) => {
    const match = incomingRows.find((row) => Number(row?.scale) === scale) || {};
    return {
      scale,
      quality: normalizeDpcrfText(match.quality),
      efficiency: normalizeDpcrfText(match.efficiency),
      timeliness: normalizeDpcrfText(match.timeliness),
    };
  });
};

const sanitizeDpcrfBlocks = (blocks) => {
  if (!Array.isArray(blocks)) return [];

  return blocks.map((block) => {
    const q = normalizeDpcrfText(block?.actualResults?.q);
    const e = normalizeDpcrfText(block?.actualResults?.e);
    const t = normalizeDpcrfText(block?.actualResults?.t);

    return {
    mfo: normalizeDpcrfText(block?.mfo),
    kra: normalizeDpcrfText(block?.kra),
    objective: normalizeDpcrfText(block?.objective),
    timeLine: normalizeDpcrfText(block?.timeLine),
    weightKra: normalizeDpcrfText(block?.weightKra),
    rows: sanitizeDpcrfScaleRows(block?.rows),
    actualResults: {
      q,
      e,
      t,
      average: computeDpcrfAverageRating(q, e, t),
    },
    meansOfVerification: {
      imageDataUrl: typeof block?.meansOfVerification?.imageDataUrl === 'string'
        ? block.meansOfVerification.imageDataUrl
        : '',
      imageName: normalizeDpcrfText(block?.meansOfVerification?.imageName),
      mimeType: normalizeDpcrfText(block?.meansOfVerification?.mimeType),
    },
  };
  });
};

const sanitizeDpcrfPartISections = (sections) => {
  const incomingSections = Array.isArray(sections) ? sections : [];

  return DPCRF_PART_I_SECTION_TITLES.map((title, index) => {
    const inputSection = incomingSections[index] || {};
    return {
      title,
      blocks: sanitizeDpcrfBlocks(inputSection.blocks),
    };
  });
};

const sanitizeDpcrfPartIIRatings = (ratings) => {
  if (!ratings || typeof ratings !== 'object' || Array.isArray(ratings)) {
    return {};
  }

  return Object.entries(ratings).reduce((acc, [key, value]) => {
    acc[String(key)] = {
      sr: normalizeDpcrfText(value?.sr),
      ar: normalizeDpcrfText(value?.ar),
    };
    return acc;
  }, {});
};

const sanitizeSpmsCalendarRows = (rows) => {
  if (!Array.isArray(rows)) return [];

  return rows.map((row, index) => ({
    order: Number.isFinite(Number(row?.order)) ? Number(row.order) : index + 1,
    activity: normalizeDpcrfText(row?.activity),
    january: normalizeDpcrfText(row?.january),
    february: normalizeDpcrfText(row?.february),
    march: normalizeDpcrfText(row?.march),
    april: normalizeDpcrfText(row?.april),
    may: normalizeDpcrfText(row?.may),
    june: normalizeDpcrfText(row?.june),
    july: normalizeDpcrfText(row?.july),
    august: normalizeDpcrfText(row?.august),
    september: normalizeDpcrfText(row?.september),
    october: normalizeDpcrfText(row?.october),
    november: normalizeDpcrfText(row?.november),
    december: normalizeDpcrfText(row?.december),
    responsibleOfficeActors: normalizeDpcrfText(row?.responsibleOfficeActors),
  }));
};

const mapDpcrfSubmissionResponse = (submission) => {
  if (!submission) return submission;

  const partISubmitted = typeof submission.partISubmitted === 'boolean'
    ? submission.partISubmitted
    : Boolean(submission.isSubmitted);

  const partIISubmitted = typeof submission.partIISubmitted === 'boolean'
    ? submission.partIISubmitted
    : false;

  return {
    ...submission,
    partISubmitted,
    partIISubmitted,
  };
};

app.get('/dpcrf/permission', verifyToken, async (req, res) => {
  try {
    const yearValue = Number.parseInt(req.query?.year, 10);
    const currentYear = new Date().getFullYear();

    if (!Number.isFinite(yearValue) || yearValue < 2000 || yearValue > currentYear + 3) {
      return res.status(400).json({ message: 'A valid year is required.' });
    }

    const permission = await DPCRFPermission.findOne({ year: yearValue }).lean();
    const normalized = normalizeDpcrfPermissionRecord(permission, yearValue);

    return res.json({
      year: yearValue,
      allowUpdate: normalized.allowUpdate,
      lockMode: normalized.lockMode,
      durationValue: normalized.durationValue,
      expiresAt: normalized.expiresAt,
      updatedBy: normalized.updatedBy,
      updatedAt: normalized.updatedAt,
    });
  } catch (error) {
    console.error('Error fetching DPCRF update permission:', error);
    return res.status(500).json({ message: 'Failed to fetch DPCRF update permission.' });
  }
});

app.patch('/dpcrf/permission', verifyToken, requireRole([ROLES.SUPER_ADMIN, ROLES.ADMIN_HR]), async (req, res) => {
  const yearValue = Number.parseInt(req.body?.year, 10);
  const currentYear = new Date().getFullYear();
  const { allowUpdate, lockMode, durationValue } = req.body || {};

  if (!Number.isFinite(yearValue) || yearValue < 2000 || yearValue > currentYear + 3) {
    return res.status(400).json({ message: 'A valid year is required.' });
  }
  if (typeof allowUpdate !== 'boolean') {
    return res.status(400).json({ message: 'allowUpdate must be a boolean value.' });
  }

  const normalizedLockMode = ['manual', 'days', 'weeks', 'months'].includes(String(lockMode || 'manual').toLowerCase())
    ? String(lockMode).toLowerCase()
    : 'manual';

  const parsedDurationValue = Number(durationValue);
  let expiresAt = null;

  if (allowUpdate === false && normalizedLockMode !== 'manual') {
    if (!Number.isFinite(parsedDurationValue) || parsedDurationValue <= 0) {
      return res.status(400).json({ message: 'durationValue must be a positive number when a timed lock is selected.' });
    }
    const lockMs = resolveDpcrfLockWindowMs(normalizedLockMode, parsedDurationValue);
    if (lockMs === null) {
      return res.status(400).json({ message: 'A valid timed lock mode is required.' });
    }
    expiresAt = new Date(Date.now() + lockMs);
  }

  try {
    const permission = await DPCRFPermission.findOneAndUpdate(
      { year: yearValue },
      {
        $set: {
          allowUpdate,
          lockMode: normalizedLockMode,
          durationValue: allowUpdate ? null : (normalizedLockMode === 'manual' ? null : parsedDurationValue),
          expiresAt: allowUpdate ? null : expiresAt,
          updatedBy: req.user?.name || req.user?.email || 'Admin/HR',
          updatedAt: Date.now(),
        },
        $setOnInsert: { year: yearValue },
      },
      { new: true, upsert: true, runValidators: true }
    ).lean();

    const normalized = normalizeDpcrfPermissionRecord(permission, yearValue);

    return res.json({
      message: allowUpdate
        ? `DPCRF updates enabled for ${yearValue}.`
        : `DPCRF updates locked for ${yearValue}.`,
      permission: normalized,
    });
  } catch (error) {
    console.error('Error updating DPCRF update permission:', error);
    return res.status(500).json({ message: 'Failed to update DPCRF update permission.' });
  }
});

app.post('/dpcrf-submissions', verifyToken, async (req, res) => {
  try {
    const yearValue = Number.parseInt(req.body?.year, 10);
    const currentYear = new Date().getFullYear();

    if (!Number.isFinite(yearValue) || yearValue < 2000 || yearValue > currentYear + 3) {
      return res.status(400).json({ message: 'A valid year is required.' });
    }

    const ownerStaffId = String(req.user?.staffId || '').trim();
    const ownerEmail = String(req.user?.email || '').trim().toLowerCase();
    const ownerName = String(req.user?.name || '').trim();
    const ownerDepartment = String(req.user?.department || '').trim();

    if (!ownerStaffId || !ownerEmail || !ownerName) {
      return res.status(400).json({ message: 'Unable to resolve account details for DPCRF submission.' });
    }

    const [existing, permission] = await Promise.all([
      DPCRFSubmission.findOne({ ownerStaffId, year: yearValue }),
      DPCRFPermission.findOne({ year: yearValue }).select('allowUpdate lockMode durationValue expiresAt updatedAt'),
    ]);
    if (existing?.partISubmitted && !canUpdateDpcrfPart(permission)) {
      return res.status(409).json({ message: 'DPCRF updates are locked by the administrator.' });
    }

    const sanitizedSections = sanitizeDpcrfPartISections(req.body?.partI?.sections);
    const sanitizedPartIIRatings = sanitizeDpcrfPartIIRatings(req.body?.partII?.ratings);

    const hasMissingProof = sanitizedSections.some((section) =>
      (section.blocks || []).some((block) => !normalizeDpcrfText(block?.meansOfVerification?.imageDataUrl))
    );

    if (hasMissingProof) {
      return res.status(400).json({ message: 'Please attach Means of Verification (Proof) image for all DPCRF rows before submission.' });
    }

    const now = Date.now();
    const submission = existing || new DPCRFSubmission({
      submissionId: `DPCRF-${yearValue}-${ownerStaffId}`,
      ownerStaffId,
      ownerEmail,
      ownerName,
      ownerDepartment,
      year: yearValue,
      partII: { ratings: {} },
      partIISubmitted: false,
      partIISubmittedAt: null,
      createdAt: now,
    });
    submission.partI = { sections: sanitizedSections };
    submission.partII = { ratings: sanitizedPartIIRatings };
    submission.ownerEmail = ownerEmail;
    submission.ownerName = ownerName;
    submission.ownerDepartment = ownerDepartment;
    submission.status = 'Submitted';
    submission.partISubmitted = true;
    submission.partISubmittedAt = now;
    submission.isSubmitted = true;
    submission.submittedAt = now;
    submission.updatedAt = now;

    await submission.save();

    res.status(existing ? 200 : 201).json({
      message: existing ? 'DPCRF updated successfully.' : 'DPCRF submitted successfully.',
      submission: mapDpcrfSubmissionResponse(submission.toObject()),
    });
  } catch (error) {
    console.error('Error submitting DPCRF:', error);
    if (error?.code === 11000) {
      return res.status(409).json({ message: 'DPCRF updates are locked by the administrator.' });
    }
    res.status(500).json({ message: 'Failed to submit DPCRF.' });
  }
});

app.post('/dpcrf-submissions/part2', verifyToken, async (req, res) => {
  try {
    const yearValue = Number.parseInt(req.body?.year, 10);
    const currentYear = new Date().getFullYear();

    if (!Number.isFinite(yearValue) || yearValue < 2000 || yearValue > currentYear + 3) {
      return res.status(400).json({ message: 'A valid year is required.' });
    }

    const ownerStaffId = String(req.user?.staffId || '').trim();
    const ownerEmail = String(req.user?.email || '').trim().toLowerCase();
    const ownerName = String(req.user?.name || '').trim();
    const ownerDepartment = String(req.user?.department || '').trim();

    if (!ownerStaffId || !ownerEmail || !ownerName) {
      return res.status(400).json({ message: 'Unable to resolve account details for Part II submission.' });
    }

    const incomingRatings = sanitizeDpcrfPartIIRatings(req.body?.partII?.ratings || req.body?.ratings || {});

    let [submission, permission] = await Promise.all([
      DPCRFSubmission.findOne({ ownerStaffId, year: yearValue }),
      DPCRFPermission.findOne({ year: yearValue }).select('allowUpdate lockMode durationValue expiresAt updatedAt'),
    ]);
    if (submission?.partIISubmitted && !canUpdateDpcrfPart(permission)) {
      return res.status(409).json({ message: 'DPCRF updates are locked by the administrator.' });
    }

    if (!submission) {
      const srOnlyRatings = Object.entries(incomingRatings).reduce((acc, [key, value]) => {
        acc[key] = {
          sr: normalizeDpcrfText(value?.sr),
          ar: '',
        };
        return acc;
      }, {});

      submission = new DPCRFSubmission({
        submissionId: `DPCRF-${yearValue}-${ownerStaffId}`,
        ownerStaffId,
        ownerEmail,
        ownerName,
        ownerDepartment,
        year: yearValue,
        partI: { sections: sanitizeDpcrfPartISections([]) },
        partII: { ratings: srOnlyRatings },
        status: 'Submitted',
        partISubmitted: false,
        partIISubmitted: true,
        partISubmittedAt: null,
        partIISubmittedAt: Date.now(),
        isSubmitted: false,
        submittedAt: Date.now(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    } else {
      const existingRatings = sanitizeDpcrfPartIIRatings(submission.partII?.ratings || {});
      const mergedRatings = { ...existingRatings };

      Object.entries(incomingRatings).forEach(([key, value]) => {
        const existing = mergedRatings[key] || { sr: '', ar: '' };
        mergedRatings[key] = {
          sr: normalizeDpcrfText(value?.sr),
          ar: normalizeDpcrfText(existing?.ar),
        };
      });

      submission.partII = { ratings: mergedRatings };
      submission.partIISubmitted = true;
      submission.partIISubmittedAt = Date.now();
      submission.updatedAt = Date.now();
    }

    await submission.save();

    return res.status(201).json({
      message: 'Part II submitted successfully.',
      submission: mapDpcrfSubmissionResponse(submission.toObject()),
    });
  } catch (error) {
    console.error('Error submitting DPCRF Part II:', error);
    if (error?.code === 11000) {
      return res.status(409).json({ message: 'DPCRF updates are locked by the administrator.' });
    }
    return res.status(500).json({ message: 'Failed to submit DPCRF Part II.' });
  }
});

app.get('/dpcrf-submissions/my', verifyToken, async (req, res) => {
  try {
    const ownerStaffId = String(req.user?.staffId || '').trim();
    const yearValue = Number.parseInt(req.query?.year, 10) || new Date().getFullYear();

    if (!ownerStaffId) {
      return res.status(400).json({ message: 'Unable to resolve account details for DPCRF lookup.' });
    }

    const submission = await DPCRFSubmission.findOne({ ownerStaffId, year: yearValue }).lean();
    res.json({ submission: submission ? mapDpcrfSubmissionResponse(submission) : null });
  } catch (error) {
    console.error('Error fetching own DPCRF submission:', error);
    res.status(500).json({ message: 'Failed to fetch your DPCRF submission.' });
  }
});

app.get('/dpcrf-submissions', verifyToken, requireRole([ROLES.SUPER_ADMIN, ROLES.ADMIN_HR, ROLES.HEAD_OFFICER]), async (req, res) => {
  try {
    const yearValue = Number.parseInt(req.query?.year, 10) || new Date().getFullYear();
    const filter = Number.isFinite(yearValue) ? { year: yearValue } : {};
    if (normalizeRole(req.user?.role) === ROLES.HEAD_OFFICER) {
      const managedStaff = await getDepartmentStaff(req.user);
      filter.ownerStaffId = { $in: (managedStaff || []).map((staff) => staff.id).filter(Boolean) };
    }

    const submissions = await DPCRFSubmission.find(filter)
      .sort({ submittedAt: -1, createdAt: -1 })
      .lean();

    res.json({ submissions: submissions.map((submission) => mapDpcrfSubmissionResponse(submission)) });
  } catch (error) {
    console.error('Error fetching DPCRF submissions:', error);
    res.status(500).json({ message: 'Failed to fetch DPCRF submissions.' });
  }
});

app.patch('/dpcrf-submissions/:submissionId/part2-ar', verifyToken, requireRole([ROLES.SUPER_ADMIN, ROLES.ADMIN_HR, ROLES.HEAD_OFFICER]), async (req, res) => {
  try {
    const { submissionId } = req.params;

    const submission = await DPCRFSubmission.findOne({ submissionId });
    if (!submission) {
      return res.status(404).json({ message: 'DPCRF submission not found.' });
    }
    if (!(await canManageStaffId(req.user, submission.ownerStaffId))) {
      return res.status(403).json({ message: 'You can only manage DPCRF submissions for staff in your department.' });
    }
    if (!submission.partIISubmitted) {
      return res.status(400).json({ message: 'Part II Actual Rates can only be updated after staff Part II submission.' });
    }

    const existingRatings = sanitizeDpcrfPartIIRatings(submission.partII?.ratings || {});
    const incomingRatings = sanitizeDpcrfPartIIRatings(req.body?.ratings || {});

    const mergedRatings = { ...existingRatings };
    Object.entries(incomingRatings).forEach(([key, value]) => {
      const existing = mergedRatings[key] || { sr: '', ar: '' };
      mergedRatings[key] = {
        sr: existing.sr,
        ar: normalizeDpcrfText(value?.ar),
      };
    });

    submission.partII = { ratings: mergedRatings };
    submission.updatedAt = Date.now();
    await submission.save();

    return res.json({
      message: 'Part II Actual Rates updated successfully.',
      submission: mapDpcrfSubmissionResponse(submission.toObject()),
    });
  } catch (error) {
    console.error('Error updating Part II AR ratings:', error);
    return res.status(500).json({ message: 'Failed to update Part II Actual Rates.' });
  }
});

app.get('/dpcrf/spms-calendar', verifyToken, async (req, res) => {
  try {
    const yearValue = Number.parseInt(req.query?.year, 10) || new Date().getFullYear();
    const calendar = await SpmsCalendar.findOne({ year: yearValue }).lean();
    return res.json({ calendar: calendar || null });
  } catch (error) {
    console.error('Error fetching SPMS calendar:', error);
    return res.status(500).json({ message: 'Failed to fetch SPMS calendar.' });
  }
});

app.put('/dpcrf/spms-calendar', verifyToken, requireRole([ROLES.SUPER_ADMIN, ROLES.ADMIN_HR]), async (req, res) => {
  try {
    const yearValue = Number.parseInt(req.body?.year, 10);
    const currentYear = new Date().getFullYear();

    if (!Number.isFinite(yearValue) || yearValue < 2000 || yearValue > currentYear + 3) {
      return res.status(400).json({ message: 'A valid year is required.' });
    }

    const sanitizedRows = sanitizeSpmsCalendarRows(req.body?.rows || []);

    const update = {
      rows: sanitizedRows,
      preparedByName: normalizeDpcrfText(req.body?.preparedByName),
      preparedByTitle: normalizeDpcrfText(req.body?.preparedByTitle),
      approvedByName: normalizeDpcrfText(req.body?.approvedByName),
      approvedByTitle: normalizeDpcrfText(req.body?.approvedByTitle),
      updatedBy: normalizeDpcrfText(req.user?.name || req.user?.email),
      updatedAt: Date.now(),
    };

    const calendar = await SpmsCalendar.findOneAndUpdate(
      { year: yearValue },
      { $set: update, $setOnInsert: { createdAt: Date.now() } },
      { new: true, upsert: true }
    );

    return res.json({ message: 'SPMS calendar saved successfully.', calendar });
  } catch (error) {
    console.error('Error saving SPMS calendar:', error);
    return res.status(500).json({ message: 'Failed to save SPMS calendar.' });
  }
});

// Create Staff (Super Admin/Admin-HR, and Head Officers for own department staff)
app.post('/staffs', verifyToken, async (req, res) => {
  const { id, name, email, password, role, position, department, phone, dateOfBirth, placeOfBirth, tinNumber, dateHired } = req.body;
  const userRole = req.user.role;
  const profileFields = normalizeStaffProfileFields(req.body);
  if (profileFields.error) {
    return res.status(400).json({ message: profileFields.error });
  }

  let normalizedDateOfBirth;
  if (dateOfBirth !== undefined && dateOfBirth !== null && String(dateOfBirth).trim() !== '') {
    const parsedDateOfBirth = new Date(dateOfBirth);
    if (Number.isNaN(parsedDateOfBirth.getTime())) {
      return res.status(400).json({ message: 'Invalid Date of Birth value' });
    }
    normalizedDateOfBirth = parsedDateOfBirth;
  }

  let normalizedDateHired;
  if (dateHired !== undefined && dateHired !== null && String(dateHired).trim() !== '') {
    const parsedDateHired = new Date(dateHired);
    if (Number.isNaN(parsedDateHired.getTime())) {
      return res.status(400).json({ message: 'Invalid Date of Employment value' });
    }
    normalizedDateHired = parsedDateHired;
  }

  if (!id || !name || !email || !password) {
    return res.status(400).json({ message: 'ID, name, email, and password are required' });
  }

  if (!role) {
    return res.status(400).json({ message: 'Role is required' });
  }

  // Validate role
  if (!Object.values(ROLES).includes(role)) {
    return res.status(400).json({ message: `Invalid role: ${role}. Valid roles: ${Object.keys(ROLES).join(', ')}` });
  }

  const canCreate = [ROLES.SUPER_ADMIN, ROLES.ADMIN_HR, ROLES.HEAD_OFFICER].includes(userRole);
  if (!canCreate) {
    return res.status(403).json({ message: 'Access denied. You cannot create staff accounts.' });
  }

  if (userRole === ROLES.HEAD_OFFICER) {
    if (role !== ROLES.STAFF) {
      return res.status(403).json({ message: 'Head Officers can only create Staff accounts.' });
    }

    if (department !== req.user.department) {
      return res.status(403).json({ message: 'You can only create staff in your own department.' });
    }
  }

  // Validate department if required by role
  if (ROLES_WITH_DEPARTMENTS.includes(role)) {
    if (!department || !DEPARTMENTS.includes(department)) {
      return res.status(400).json({ message: `Department is required for ${ROLE_DISPLAY_NAMES[role]}. Valid departments: ${DEPARTMENTS.join(', ')}` });
    }
  }

  try {
    const existing = await Staff.findOne({ $or: [{ id }, { email }] });
    if (existing) {
      return res.status(409).json({ message: 'Item Number or email already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newStaff = new Staff({
      id,
      name,
      email,
      password: hashedPassword,
      role,
      position,
      department: ROLES_WITH_DEPARTMENTS.includes(role)
        ? (userRole === ROLES.HEAD_OFFICER ? req.user.department : department)
        : null,
      phone,
      dateOfBirth: normalizedDateOfBirth,
      placeOfBirth,
      tinNumber,
      dateHired: normalizedDateHired,
      ...profileFields.fields,
      lengthOfService: calculateStaffLengthOfService(normalizedDateHired),
      isApproved: true,
      approvedAt: Date.now(),
      approvedBy: req.user.name
    });

    await newStaff.save();

    await createSystemLogEntry({
      module: 'User Management',
      action: 'Create',
      user: req.user.name || req.user.email || 'System',
      userId: req.user.staffId,
      description: `Staff account created: ${newStaff.id} - ${newStaff.name}`,
      ipAddress: getRequestIp(req),
      status: 'Success',
      metadata: {
        targetStaffId: newStaff.id,
        targetRole: newStaff.role,
        targetDepartment: newStaff.department || null,
      },
    });

    res.status(201).json({ message: 'Staff created successfully', staff: newStaff });
  } catch (error) {
    console.error('Error creating staff:', error);
    res.status(500).json({ message: 'Failed to create staff' });
  }
});

// Get all staffs (Super Admin, Admin/HR, and Head Officers for their department)
app.get('/staffs', verifyToken, async (req, res) => {
  try {
    const userRole = normalizeRole(req.user.role);
    // Check if user has permission to view staffs
    if (![ROLES.SUPER_ADMIN, ROLES.ADMIN_HR, ROLES.HEAD_OFFICER].includes(userRole)) {
      return res.status(403).json({ message: 'Access denied. Only admins and head officers can view staff lists.' });
    }

    let filter = {};
    
    // Head Officers can only see staff in their department
    if (userRole === ROLES.HEAD_OFFICER) {
      filter = { 
        $or: [
          { department: req.user.department },
          { role: ROLES.HEAD_OFFICER, department: req.user.department }
        ]
      };
    }

    const staffs = await Staff.find(filter).select('-password');
    const staffIds = staffs.map((staff) => staff.id).filter(Boolean);
    const staffEmails = staffs.map((staff) => String(staff.email || '').trim().toLowerCase()).filter(Boolean);
    const pdsOwnerFilters = [];
    if (staffIds.length) pdsOwnerFilters.push({ ownerStaffId: { $in: staffIds } });
    if (staffEmails.length) {
      const emailExpressions = staffEmails.map((email) => {
        const escapedEmail = email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        return new RegExp(`^${escapedEmail}$`, 'i');
      });
      pdsOwnerFilters.push({ ownerEmail: { $in: emailExpressions } });
      pdsOwnerFilters.push({
        $and: [
          { ownerEmail: { $in: [null, ''] } },
          { email: { $in: emailExpressions } },
        ],
      });
    }

    const pdsByStaffId = new Map();
    const pdsByEmail = new Map();
    if (pdsOwnerFilters.length) {
      const pdsRecords = await PersonalDataSheet.find({
        $and: [
          { $or: pdsOwnerFilters },
          { submittedOnBehalf: { $ne: true } },
        ],
      })
        .sort({ createdAt: -1 })
        .select('ownerStaffId ownerEmail email dateOfBirth')
        .lean();

      const addPdsDateToIdentityMap = (map, identity, pds) => {
        const key = String(identity || '').trim().toLowerCase();
        if (!key) return;
        if (!map.has(key)) map.set(key, pds.dateOfBirth || null);
      };

      for (const pds of pdsRecords) {
        addPdsDateToIdentityMap(pdsByStaffId, pds.ownerStaffId, pds);
        addPdsDateToIdentityMap(pdsByEmail, pds.ownerEmail || pds.email, pds);
      }
    }

    res.json(staffs.map((staff) => {
      const pdsDateOfBirth = pdsByStaffId.get(String(staff.id || '').trim().toLowerCase())
        || pdsByEmail.get(String(staff.email || '').trim().toLowerCase());
      return {
        ...staff.toObject(),
        sexAtBirth: staff.sexAtBirth || '',
        dateOfBirth: staff.dateOfBirth || pdsDateOfBirth || null,
      };
    }));
  } catch (error) {
    console.error('Error fetching staffs:', error);
    res.status(500).json({ message: 'Failed to retrieve staffs' });
  }
});

// Get single staff (Self, Admin, or Head Officer of same department)
app.get('/staffs/:id', verifyToken, async (req, res) => {
  try {
    const requestedId = req.params.id;
    console.log('Get staff request - ID:', requestedId, 'User:', req.user.staffId, 'Role:', req.user.role);
    
    const staff = await Staff.findOne({ id: requestedId }).select('-password');
    if (!staff) {
      return res.status(404).json({ message: 'Staff not found' });
    }

    // Check if user can view this staff
    const userRole = normalizeRole(req.user.role);
    const userDepartment = req.user.department;
    const staffDepartment = staff.department;

    // Super Admin and Admin/HR can view anyone
    if ([ROLES.SUPER_ADMIN, ROLES.ADMIN_HR].includes(userRole)) {
      return res.json(staff);
    }

    // Any authenticated user can view their own profile
    if (String(req.user.staffId).trim() === String(requestedId).trim()) {
      return res.json(staff);
    }

    // Head Officer can view staff in their department
    if (userRole === ROLES.HEAD_OFFICER) {
      if (userDepartment === staffDepartment) {
        return res.json(staff);
      }
      console.log('Access denied - Head Officer from', userDepartment, 'requested staff from', staffDepartment);
      return res.status(403).json({ message: 'Access denied. You can only view staff in your department.' });
    }

    console.log('Access denied - User staffId:', req.user.staffId, 'Requested:', requestedId);
    return res.status(403).json({ message: 'Access denied' });
  } catch (error) {
    console.error('Error fetching staff:', error);
    res.status(500).json({ message: 'Failed to retrieve staff' });
  }
});

// Update staff (Admin can update any staff, Staff can update themselves, Head Officers can update their dept staff)
app.put('/staffs/:id', verifyToken, async (req, res) => {
  const {
    name,
    position,
    department,
    email,
    phone,
    dateOfBirth,
    dateHired,
    placeOfBirth,
    tinNumber,
    businessPartnerNumber,
    philhealthNo,
    pagibigNo,
    maritalStatus,
    address,
    employmentStatus,
    lengthOfService,
    monthlyBasicSalary,
    peraRata,
    grossSalary,
    pendingAdministrativeCase,
    pendingCriminalCase,
    salaryGrade,
    role,
    profilePhotoDataUrl,
    sexAtBirth,
    password,
    currentPassword,
  } = req.body;
  const hasProfilePhotoPayload = Object.prototype.hasOwnProperty.call(req.body, 'profilePhotoDataUrl');
  const hasSexAtBirthPayload = Object.prototype.hasOwnProperty.call(req.body, 'sexAtBirth');
  const hasDateOfBirthPayload = Object.prototype.hasOwnProperty.call(req.body, 'dateOfBirth');
  const hasDateHiredPayload = Object.prototype.hasOwnProperty.call(req.body, 'dateHired');
  const profileFieldNames = [
    'address',
    'employmentStatus',
    'lengthOfService',
    'monthlyBasicSalary',
    'peraRata',
    'grossSalary',
    'pendingAdministrativeCase',
    'pendingCriminalCase',
    'salaryGrade',
    'sexAtBirth',
    'businessPartnerNumber',
    'philhealthNo',
    'pagibigNo',
    'maritalStatus',
  ];
  const hasProfileFieldsPayload = profileFieldNames.some((field) => Object.prototype.hasOwnProperty.call(req.body, field));

  console.log('[PUT /staffs/:id] Incoming date payload:', {
    requestedId: req.params.id,
    hasDateOfBirthPayload,
    dateOfBirth,
    hasDateHiredPayload,
    dateHired,
  });

  try {
    // Find the staff member
    const staff = await Staff.findOne({ id: req.params.id });
    if (!staff) {
      return res.status(404).json({ message: 'Staff not found' });
    }

    // Check if user has permission to update this staff
    const userRole = req.user.role;
    const userDepartment = req.user.department;
    const userStaffId = req.user.staffId;
    const staffDepartment = staff.department;

    console.log('Update staff request:');
    console.log('  User staffId:', userStaffId);
    console.log('  User role:', userRole);
    console.log('  Requested ID:', req.params.id);
    console.log('  Staff department:', staffDepartment);

    const isSelfUpdate = String(userStaffId).trim() === String(req.params.id).trim();

    // Super Admin and Admin/HR can update anyone
    let canUpdate = [ROLES.SUPER_ADMIN, ROLES.ADMIN_HR].includes(userRole);

    // Any authenticated user can update their own account
    if (!canUpdate && isSelfUpdate) {
      canUpdate = true;
    }

    // Head Officer can update staff in their department
    if (!canUpdate && userRole === ROLES.HEAD_OFFICER) {
      if (userDepartment !== staffDepartment) {
        console.log('  Access denied - Head Officer from', userDepartment, 'cannot update staff from', staffDepartment);
        return res.status(403).json({ message: 'You can only update staff in your own department' });
      }
      canUpdate = true;
    }

    if (!canUpdate) {
      return res.status(403).json({ message: 'You do not have permission to update this staff account' });
    }

    const isAdminUser = isSystemAdminRole(userRole);
    const protectedProfileFields = [...STAFF_PROFILE_REQUEST_FIELDS, 'role'];
    const hasProtectedProfilePayload = protectedProfileFields.some((field) => (
      Object.prototype.hasOwnProperty.call(req.body, field)
    ));
    if (!isAdminUser && hasProtectedProfilePayload) {
      return res.status(403).json({
        message: 'Profile changes require admin approval. Submit an Update Account Information Request instead.',
      });
    }

    if (userRole === ROLES.HEAD_OFFICER) {
      if (role) {
        return res.status(403).json({ message: 'Head Officers cannot change account roles' });
      }

      if (department && department !== userDepartment) {
        return res.status(403).json({ message: 'You can only assign your own department' });
      }
    }

    if (!name && !position && !department && !email && !phone && !placeOfBirth && !tinNumber && !role && !password && !hasDateOfBirthPayload && !hasDateHiredPayload && !hasProfileFieldsPayload && !hasProfilePhotoPayload && !hasSexAtBirthPayload) {
      return res.status(400).json({ message: 'At least one field is required to update' });
    }

    if (hasSexAtBirthPayload && !['', 'Male', 'Female'].includes(sexAtBirth)) {
      return res.status(400).json({ message: 'Sex must be Male or Female, or left blank.' });
    }

    const updateData = {
      name,
      position,
      department,
      email,
      phone,
      placeOfBirth,
      tinNumber,
      businessPartnerNumber,
      philhealthNo,
      pagibigNo,
      maritalStatus,
      address,
      employmentStatus,
      lengthOfService,
      monthlyBasicSalary,
      peraRata,
      grossSalary,
      pendingAdministrativeCase,
      pendingCriminalCase,
      salaryGrade,
      role,
    };
    if (hasProfilePhotoPayload) {
      if (profilePhotoDataUrl && !isValidProfilePhotoDataUrl(profilePhotoDataUrl)) {
        return res.status(400).json({ message: 'Profile photo must be a JPG, PNG, or WebP image up to 5 MB.' });
      }
      updateData.profilePhotoDataUrl = profilePhotoDataUrl || '';
    }
    if (hasSexAtBirthPayload) updateData.sexAtBirth = sexAtBirth;

    for (const [field, value] of Object.entries({ monthlyBasicSalary, grossSalary })) {
      if (!Object.prototype.hasOwnProperty.call(req.body, field)) continue;
      if (value === '' || value === null) {
        updateData[field] = null;
        continue;
      }

      const amount = Number(value);
      if (!Number.isFinite(amount) || amount < 0) {
        return res.status(400).json({ message: `${field} must be a non-negative number` });
      }
      updateData[field] = amount;
    }

    for (const [field, value] of Object.entries({ pendingAdministrativeCase, pendingCriminalCase })) {
      if (!Object.prototype.hasOwnProperty.call(req.body, field)) continue;
      if (value === '' || value === null) {
        updateData[field] = null;
      } else if (value === true || value === 'true') {
        updateData[field] = true;
      } else if (value === false || value === 'false') {
        updateData[field] = false;
      } else {
        return res.status(400).json({ message: `${field} must be true or false` });
      }
    }

    if (hasDateOfBirthPayload && String(dateOfBirth || '').trim() !== '') {
      const parsedDateOfBirth = new Date(dateOfBirth);
      if (Number.isNaN(parsedDateOfBirth.getTime())) {
        return res.status(400).json({ message: 'Invalid Date of Birth value' });
      }
      updateData.dateOfBirth = parsedDateOfBirth;
    }

    if (hasDateHiredPayload) {
      if (String(dateHired || '').trim() === '') {
        updateData.dateHired = null;
        updateData.lengthOfService = '';
      } else {
        const parsedDateHired = new Date(dateHired);
        if (Number.isNaN(parsedDateHired.getTime())) {
          return res.status(400).json({ message: 'Invalid Date of Employment value' });
        }
        updateData.dateHired = parsedDateHired;
        updateData.lengthOfService = calculateStaffLengthOfService(parsedDateHired);
      }
    }
    
    // If password is provided, verify current password first (unless admins are updating someone else)
    if (password) {
      console.log('  Password update requested');
      const isAdmin = [ROLES.SUPER_ADMIN, ROLES.ADMIN_HR].includes(userRole);
      const isSelfUpdate = userStaffId === req.params.id;
      
      // Admins can set passwords without verification, but users updating their own account need current password
      if (!isAdmin || isSelfUpdate) {
        console.log('  Requiring current password verification');
        if (!currentPassword) {
          console.log('  Current password not provided');
          return res.status(400).json({ message: 'Current password is required to change password' });
        }

        // Verify current password
        const isPasswordValid = await bcrypt.compare(currentPassword, staff.password);
        if (!isPasswordValid) {
          console.log('  Current password incorrect');
          return res.status(401).json({ message: 'Current password is incorrect' });
        }
      }

      // Hash the new password
      updateData.password = await bcrypt.hash(password, 10);
      console.log('  Password hashed and updated');
    }

    if (hasSexAtBirthPayload) {
      staff.sexAtBirth = sexAtBirth;
      await staff.save({ validateModifiedOnly: true });
    }

    const updatedStaff = await Staff.findOneAndUpdate(
      { id: req.params.id },
      { $set: updateData },
      { new: true, omitUndefined: true }
    ).select('-password');

    if (!updatedStaff) {
      return res.status(500).json({ message: 'Staff profile update could not be confirmed.' });
    }
    if (hasSexAtBirthPayload && updatedStaff.sexAtBirth !== sexAtBirth) {
      console.error('[PUT /staffs/:id] Sex value did not persist:', {
        staffId: updatedStaff.id,
        requestedSex: sexAtBirth,
        savedSex: updatedStaff.sexAtBirth,
      });
      return res.status(500).json({ message: 'Sex update could not be confirmed. Please try again.' });
    }

    console.log('[PUT /staffs/:id] Saved date fields:', {
      id: updatedStaff?.id,
      dateOfBirth: updatedStaff?.dateOfBirth,
      dateHired: updatedStaff?.dateHired,
    });

    await createSystemLogEntry({
      module: 'User Management',
      action: 'Update',
      user: req.user.name || req.user.email || 'System',
      userId: req.user.staffId,
      description: `Staff account updated: ${updatedStaff.id} - ${updatedStaff.name}`,
      ipAddress: getRequestIp(req),
      status: 'Success',
      metadata: {
        targetStaffId: updatedStaff.id,
        updatedFields: Object.keys(updateData).filter((key) => updateData[key] !== undefined),
      },
    });

    res.status(200).json({ message: 'Staff updated successfully', staff: updatedStaff });
  } catch (error) {
    console.error('Error updating staff:', error);
    res.status(500).json({ message: 'Failed to update staff' });
  }
});

// Delete staff (Super Admin, Admin/HR, and Head Officers for their department)
app.delete('/staffs/:id', verifyToken, async (req, res) => {
  try {
    const userRole = req.user.role;
    const userDepartment = req.user.department;

    // Check permission
    if (![ROLES.SUPER_ADMIN, ROLES.ADMIN_HR, ROLES.HEAD_OFFICER].includes(userRole)) {
      return res.status(403).json({ message: 'Access denied. Only admins and head officers can delete staff.' });
    }

    // Head Officers can only delete staff in their department
    if (userRole === ROLES.HEAD_OFFICER) {
      const staff = await Staff.findOne({ id: req.params.id });
      if (!staff) {
        return res.status(404).json({ message: 'Staff not found' });
      }
      if (staff.department !== userDepartment) {
        return res.status(403).json({ message: 'You can only delete staff in your own department' });
      }
    }

    const deleted = await Staff.findOneAndDelete({ id: req.params.id });
    if (!deleted) {
      return res.status(404).json({ message: 'Staff not found' });
    }

    await createSystemLogEntry({
      module: 'User Management',
      action: 'Delete',
      user: req.user.name || req.user.email || 'System',
      userId: req.user.staffId,
      description: `Staff account deleted: ${deleted.id} - ${deleted.name}`,
      ipAddress: getRequestIp(req),
      status: 'Success',
      metadata: {
        targetStaffId: deleted.id,
      },
    });

    res.status(200).json({ message: 'Staff deleted successfully' });
  } catch (error) {
    console.error('Error deleting staff:', error);
    res.status(500).json({ message: 'Failed to delete staff' });
  }
});

// Get pending staff registrations (Super Admin, Admin/HR, and Head Officers for their department)
app.post('/staff-update-requests', verifyToken, async (req, res) => {
  if (isSystemAdminRole(req.user?.role)) {
    return res.status(403).json({ message: 'Administrators can update profile information directly.' });
  }

  const staffId = String(req.user?.staffId || req.user?.id || '').trim();
  if (!staffId) {
    return res.status(400).json({ message: 'Your staff account could not be identified.' });
  }

  const normalizedRequest = normalizeStaffProfileRequestFields(req.body);
  if (normalizedRequest.error) {
    return res.status(400).json({ message: normalizedRequest.error });
  }

  try {
    const staff = await Staff.findOne({ id: staffId }).select(
      [...STAFF_PROFILE_REQUEST_FIELDS, 'id'].join(' ')
    );
    if (!staff) {
      return res.status(404).json({ message: 'Staff account not found.' });
    }

    const existingPendingRequest = await StaffUpdateRequest.findOne({ staffId, status: 'Pending' }).select('requestId');
    if (existingPendingRequest) {
      return res.status(409).json({
        message: 'You already have a pending account information update request. Please wait for Admin/HR to review it.',
      });
    }

    const requestedFields = normalizedRequest.fields;
    const currentFields = Object.fromEntries(
      Object.keys(requestedFields).map((field) => [
        field,
        field === 'profilePhotoDataUrl'
          ? (staff.profilePhotoDataUrl ? '[Profile photo on file]' : '')
          : (staff.get(field) ?? null),
      ])
    );
    const request = await StaffUpdateRequest.create({
      requestId: randomUUID(),
      staffId,
      staffName: staff.name || req.user.name || '',
      staffEmail: staff.email || req.user.email || '',
      currentFields,
      requestedFields,
    });

    res.status(201).json({ message: 'Profile update request submitted for admin review.', request });
  } catch (error) {
    console.error('Error creating staff profile update request:', error);
    if (error.code === 11000) {
      return res.status(409).json({
        message: 'You already have a pending account information update request. Please wait for Admin/HR to review it.',
      });
    }
    res.status(500).json({ message: 'Failed to submit profile update request.' });
  }
});

app.get('/staff-update-requests', verifyToken, async (req, res) => {
  if (!isSystemAdminRole(req.user?.role)) {
    return res.status(403).json({ message: 'Only Admin/HR can review profile update requests.' });
  }

  try {
    const requests = await StaffUpdateRequest.find({ status: 'Pending' }).sort({ createdAt: -1 }).lean();
    res.json(requests);
  } catch (error) {
    console.error('Error fetching staff profile update requests:', error);
    res.status(500).json({ message: 'Failed to retrieve profile update requests.' });
  }
});

app.patch('/staff-update-requests/:requestId/review', verifyToken, async (req, res) => {
  if (!isSystemAdminRole(req.user?.role)) {
    return res.status(403).json({ message: 'Only Admin/HR can review profile update requests.' });
  }

  const { status } = req.body || {};
  if (!['Approved', 'Rejected'].includes(status)) {
    return res.status(400).json({ message: 'Review status must be Approved or Rejected.' });
  }

  try {
    const request = await StaffUpdateRequest.findOne({
      requestId: req.params.requestId,
      status: 'Pending',
    });
    if (!request) {
      return res.status(404).json({ message: 'Pending profile update request not found.' });
    }

    if (status === 'Approved') {
      const staff = await Staff.findOne({ id: request.staffId });
      if (!staff) {
        return res.status(404).json({ message: 'Staff account for this request no longer exists.' });
      }

      const normalizedRequest = normalizeStaffProfileRequestFields(request.requestedFields);
      if (normalizedRequest.error) {
        return res.status(400).json({ message: normalizedRequest.error });
      }
      const updates = normalizedRequest.fields;

      if (Object.prototype.hasOwnProperty.call(updates, 'email')) {
        const escapedEmail = updates.email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const emailInUse = await Staff.findOne({
          email: { $regex: `^${escapedEmail}$`, $options: 'i' },
          id: { $ne: request.staffId },
        }).select('id');
        if (emailInUse) {
          return res.status(409).json({ message: 'That email address is already in use by another staff account.' });
        }
      }

      if (Object.prototype.hasOwnProperty.call(updates, 'dateHired')) {
        updates.lengthOfService = updates.dateHired
          ? calculateStaffLengthOfService(updates.dateHired)
          : '';
      }
      staff.set(updates);
      staff.updatedAt = new Date();
      await staff.save();
    }

    request.status = status;
    request.reviewedBy = req.user.name || req.user.email || 'Admin/HR';
    request.reviewedAt = new Date();
    request.updatedAt = new Date();
    await request.save();

    await createSystemLogEntry({
      module: 'User Management',
      action: status === 'Approved' ? 'Approve Profile Update Request' : 'Reject Profile Update Request',
      user: req.user.name || req.user.email || 'Admin/HR',
      userId: req.user.staffId,
      description: `${status} profile update request for ${request.staffId} - ${request.staffName}`,
      ipAddress: getRequestIp(req),
      status: 'Success',
      metadata: { requestId: request.requestId, targetStaffId: request.staffId },
    });

    res.json({ message: `Profile update request ${status.toLowerCase()}.`, request });
  } catch (error) {
    console.error('Error reviewing staff profile update request:', error);
    if (error.name === 'ValidationError' || error.name === 'CastError') {
      return res.status(400).json({ message: error.message });
    }
    res.status(500).json({ message: 'Failed to review profile update request.' });
  }
});

app.get('/staffs-pending', verifyToken, async (req, res) => {
  try {
    const userRole = req.user.role;
    const userDepartment = req.user.department;

    console.log('Fetching pending staffs for user:', req.user);

    // Check permission
    if (![ROLES.SUPER_ADMIN, ROLES.ADMIN_HR, ROLES.HEAD_OFFICER].includes(userRole)) {
      return res.status(403).json({ message: 'Access denied. Only admins and head officers can view pending staffs.' });
    }

    let filter = { isApproved: false };

    // Head Officers can only see pending staff in their department
    if (userRole === ROLES.HEAD_OFFICER) {
      filter.department = userDepartment;
    }

    const pendingStaffs = await Staff.find(filter).select('-password').sort({ createdAt: -1 });
    console.log('Found pending staffs:', pendingStaffs);
    res.json(pendingStaffs);
  } catch (error) {
    console.error('Error fetching pending staffs:', error);
    res.status(500).json({ message: 'Failed to retrieve pending staff registrations', error: error.message });
  }
});

// Debug endpoint - check all staff (without role check)
app.get('/staffs-debug', verifyToken, async (req, res) => {
  try {
    console.log('DEBUG: Checking all staff in database');
    const allStaffs = await Staff.find().select('-password').sort({ createdAt: -1 });
    console.log('DEBUG: All staff:', allStaffs);
    const pendingCount = await Staff.countDocuments({ isApproved: false });
    const approvedCount = await Staff.countDocuments({ isApproved: true });
    res.json({
      total: allStaffs.length,
      pending: pendingCount,
      approved: approvedCount,
      staffs: allStaffs
    });
  } catch (error) {
    console.error('Error in debug endpoint:', error);
    res.status(500).json({ message: 'Debug error', error: error.message });
  }
});

// Approve staff registration (Super Admin, Admin/HR, and Head Officers for their department)
app.patch('/staffs/:id/approve', verifyToken, async (req, res) => {
  try {
    const userRole = req.user.role;
    const userDepartment = req.user.department;

    // Check permission
    if (![ROLES.SUPER_ADMIN, ROLES.ADMIN_HR, ROLES.HEAD_OFFICER].includes(userRole)) {
      return res.status(403).json({ message: 'Access denied. Only admins and head officers can approve staff.' });
    }

    const staff = await Staff.findOne({ id: req.params.id });
    if (!staff) {
      return res.status(404).json({ message: 'Staff not found' });
    }

    // Head Officers can only approve staff in their department
    if (userRole === ROLES.HEAD_OFFICER && staff.department !== userDepartment) {
      return res.status(403).json({ message: 'You can only approve staff in your own department' });
    }

    if (staff.isApproved) {
      return res.status(400).json({ message: 'Staff is already approved' });
    }

    const approvedStaff = await Staff.findOneAndUpdate(
      { id: req.params.id },
      {
        $set: {
          isApproved: true,
          approvedAt: Date.now(),
          approvedBy: req.user.name,
        },
      },
      { new: true }
    ).select('-password');

    res.status(200).json({ message: 'Staff registration approved', staff: approvedStaff });
  } catch (error) {
    console.error('Error approving staff:', error);
    res.status(500).json({ message: 'Failed to approve staff registration' });
  }
});

// Disapprove staff registration (Super Admin, Admin/HR, and Head Officers for their department)
app.patch('/staffs/:id/disapprove', verifyToken, async (req, res) => {
  try {
    const userRole = req.user.role;
    const userDepartment = req.user.department;

    // Check permission
    if (![ROLES.SUPER_ADMIN, ROLES.ADMIN_HR, ROLES.HEAD_OFFICER].includes(userRole)) {
      return res.status(403).json({ message: 'Access denied. Only admins and head officers can disapprove staff.' });
    }

    const staff = await Staff.findOne({ id: req.params.id });
    if (!staff) {
      return res.status(404).json({ message: 'Staff not found' });
    }

    // Head Officers can only disapprove staff in their department
    if (userRole === ROLES.HEAD_OFFICER && staff.department !== userDepartment) {
      return res.status(403).json({ message: 'You can only disapprove staff in your own department' });
    }

    if (staff.isApproved) {
      return res.status(400).json({ message: 'Cannot disapprove an already approved staff' });
    }

    const deleted = await Staff.findOneAndDelete({ id: req.params.id });
    res.status(200).json({ message: 'Staff registration disapproved and account deleted' });
  } catch (error) {
    console.error('Error disapproving staff:', error);
    res.status(500).json({ message: 'Failed to disapprove staff registration' });
  }
});

// Update staff e-signature permission (Super Admin, Admin/HR, and Head Officers for their department)
app.patch('/staffs/:id/esign-permission', verifyToken, async (req, res) => {
  try {
    const userRole = req.user.role;
    const userDepartment = req.user.department;

    // Check permission
    if (![ROLES.SUPER_ADMIN, ROLES.ADMIN_HR, ROLES.HEAD_OFFICER].includes(userRole)) {
      return res.status(403).json({ message: 'Access denied. Only admins and head officers can update e-signature permissions.' });
    }

    console.log('E-signature permission update - Item Number:', req.params.id);
    console.log('E-signature permission update - Request body:', req.body);
    const { eSignPermission } = req.body;
    const staff = await Staff.findOne({ id: req.params.id });
    
    if (!staff) {
      console.log('Staff not found with ID:', req.params.id);
      return res.status(404).json({ message: 'Staff not found' });
    }

    // Head Officers can only update e-signature permission for staff in their department
    if (userRole === ROLES.HEAD_OFFICER && staff.department !== userDepartment) {
      return res.status(403).json({ message: 'You can only update e-signature permissions for staff in your own department' });
    }

    const updatedStaff = await Staff.findOneAndUpdate(
      { id: req.params.id },
      { $set: { eSignPermission: eSignPermission } },
      { new: true }
    ).select('-password');

    console.log('E-signature permission updated for staff:', updatedStaff.id);
    res.status(200).json({ message: 'E-signature permission updated', staff: updatedStaff });
  } catch (error) {
    console.error('Error updating e-signature permission:', error);
    res.status(500).json({ message: 'Failed to update e-signature permission', error: error.message });
  }
});

// Activate/deactivate staff account (Super Admin, Admin/HR, and Head Officers for their department)
app.patch('/staffs/:id/account-status', verifyToken, async (req, res) => {
  try {
    const userRole = req.user.role;
    const userDepartment = req.user.department;

    if (![ROLES.SUPER_ADMIN, ROLES.ADMIN_HR, ROLES.HEAD_OFFICER].includes(userRole)) {
      return res.status(403).json({ message: 'Access denied. Only admins and head officers can update account status.' });
    }

    const { isActive } = req.body;
    if (typeof isActive !== 'boolean') {
      return res.status(400).json({ message: 'isActive must be provided as true or false' });
    }

    const staff = await Staff.findOne({ id: req.params.id });
    if (!staff) {
      return res.status(404).json({ message: 'Staff not found' });
    }

    if (req.user.staffId === req.params.id && isActive === false) {
      return res.status(400).json({ message: 'You cannot deactivate your own account' });
    }

    if (userRole === ROLES.HEAD_OFFICER && staff.department !== userDepartment) {
      return res.status(403).json({ message: 'You can only update account status for staff in your own department' });
    }

    const updatedStaff = await Staff.findOneAndUpdate(
      { id: req.params.id },
      { $set: { isActive } },
      { new: true }
    ).select('-password');

    await createSystemLogEntry({
      module: 'User Management',
      action: isActive ? 'Activate' : 'Deactivate',
      user: req.user.name || req.user.email || 'System',
      userId: req.user.staffId,
      description: `Staff account ${isActive ? 'activated' : 'deactivated'}: ${updatedStaff.id} - ${updatedStaff.name}`,
      ipAddress: getRequestIp(req),
      status: 'Success',
      metadata: {
        targetStaffId: updatedStaff.id,
        isActive,
      },
    });

    return res.status(200).json({
      message: `Staff account ${isActive ? 'activated' : 'deactivated'} successfully`,
      staff: updatedStaff,
    });
  } catch (error) {
    console.error('Error updating account status:', error);
    return res.status(500).json({ message: 'Failed to update account status' });
  }
});


// ==================== LEAVE ROUTES ====================

// File Leave Request (Staff - own requests only)
app.post('/leaves', verifyToken, async (req, res) => {
  const {
    leaveId,
    staffId,
    staffName,
    leaveType,
    startDate,
    endDate,
    dateRanges,
    reason,
    office,
    position,
    salary,
    filingDate,
    leaveDetailsSpecific,
    communicationNotRequested,
    communicationRequested,
  } = req.body;

  const normalizedLeaveType = Array.isArray(leaveType)
    ? leaveType.find((item) => typeof item === 'string' && item.trim())
    : leaveType;
  const normalizedStaffName = typeof staffName === 'string' ? staffName.trim() : '';
  const normalizedSalary = salary === null || salary === undefined || salary === ''
    ? null
    : Number(salary);

  const parseOptionalDate = (value) => {
    if (!value) return null;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  };

  const normalizedFilingDate = parseOptionalDate(filingDate);
  const normalizedStartDate = parseOptionalDate(startDate);
  const normalizedEndDate = parseOptionalDate(endDate);

  // Staff can only file leave for themselves
  if (req.user.role === 'staff' && req.user.staffId !== staffId) {
    return res.status(403).json({ message: 'You can only file leave for yourself' });
  }

  if (!leaveId || !staffId || !normalizedStaffName || !normalizedLeaveType) {
    return res.status(400).json({ message: 'Item Number, Name, and Leave Type are required' });
  }

  if (normalizedSalary !== null && Number.isNaN(normalizedSalary)) {
    return res.status(400).json({ message: 'Salary must be a valid number' });
  }

  if ((startDate && !normalizedStartDate) || (endDate && !normalizedEndDate) || (filingDate && !normalizedFilingDate)) {
    return res.status(400).json({ message: 'Invalid date value provided' });
  }

  try {
      const existing = await Leave.findOne({ leaveId });
      if (existing) {
        return res.status(409).json({ message: 'Leave request with this ID already exists' });
      }

      const staff = await Staff.findOne({ id: staffId }).select('department role');
      const staffDepartment = staff?.department || req.user.department || null;
      const filerRole = normalizeRole(staff?.role || req.user.role);
      const approvalStage = filerRole === ROLES.STAFF ? 'HeadOfficer' : 'Admin';

      // Calculate number of days and set start/end from dateRanges if provided, else from start/end
      let numberOfDays = null;
      let normalizedDateRanges = Array.isArray(dateRanges) ? dateRanges.filter(r => r.startDate && r.endDate) : [];
      let computedStartDate = normalizedStartDate;
      let computedEndDate = normalizedEndDate;
      if (normalizedDateRanges.length > 0) {
        // Sort all dates to get min/max
        const allDates = normalizedDateRanges.flatMap(range => {
          const start = new Date(range.startDate);
          const end = new Date(range.endDate);
          if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return [];
          const dates = [];
          for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            dates.push(new Date(d));
          }
          return dates;
        });
        if (allDates.length > 0) {
          allDates.sort((a, b) => a - b);
          computedStartDate = allDates[0];
          computedEndDate = allDates[allDates.length - 1];
        }
        numberOfDays = allDates.length;
      } else if (normalizedStartDate && normalizedEndDate) {
        const start = normalizedStartDate;
        const end = normalizedEndDate;
        numberOfDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
        if (numberOfDays <= 0) {
          return res.status(400).json({ message: 'End date must be after start date' });
        }
      }

      if (
        normalizedLeaveType === 'Mandatory/Force Leave'
        && numberOfDays > FORCE_LEAVE_MAX_DAYS_PER_APPLICATION
      ) {
        return res.status(400).json({
          message: `You cannot file more than ${FORCE_LEAVE_MAX_DAYS_PER_APPLICATION} days of Force Leave in one application.`,
        });
      }

      // Enforce the approved 5-day annual limit for Mandatory/Force Leave.
      if (normalizedLeaveType === 'Mandatory/Force Leave') {
        const requestedYear = resolveLeaveCalendarYear({
          startDate: computedStartDate,
          dateRanges: normalizedDateRanges,
          filingDate: normalizedFilingDate,
        });
        const approvedForceLeaves = await Leave.find({
          staffId,
          leaveType: 'Mandatory/Force Leave',
          status: 'Approved',
        }).select('startDate dateRanges filingDate createdAt numberOfDays');
        const usedForceLeaveDays = approvedForceLeaves.reduce((sum, approvedLeave) => (
          resolveLeaveCalendarYear(approvedLeave) === requestedYear
            ? sum + (Number(approvedLeave.numberOfDays) || 0)
            : sum
        ), 0);
        const requestedDays = numberOfDays || 0;
        if (usedForceLeaveDays + requestedDays > 5) {
          return res.status(400).json({ message: `You have already used ${usedForceLeaveDays} approved Force Leave day(s) in ${requestedYear}. Maximum allowed is 5 days per year.` });
        }
      }

      if (normalizeLeaveTypeKey(normalizedLeaveType) === 'wellness') {
        const requestedYear = resolveLeaveCalendarYear({
          startDate: computedStartDate,
          dateRanges: normalizedDateRanges,
          filingDate: normalizedFilingDate,
        });
        const usedWellnessDays = await getApprovedLeaveDaysForYear({
          staffId,
          leaveTypes: ['Wellness', 'wellness', 'Wellness Leave'],
          year: requestedYear,
        });
        if (usedWellnessDays + (numberOfDays || 0) > WELLNESS_ANNUAL_LIMIT) {
          return res.status(400).json({
            message: `You have already used ${usedWellnessDays} approved Wellness Leave day(s) in ${requestedYear}. Maximum allowed is ${WELLNESS_ANNUAL_LIMIT} days per year.`,
          });
        }
      }

      // Enforce 3-day annual limit for Special Privilege Leave (SPL)
      if (normalizedLeaveType === 'Special Privilege Leave' || normalizedLeaveType === 'SPL') {
        const requestedSPLDays = numberOfDays || 0;
        if (requestedSPLDays > 3) {
          return res.status(400).json({ message: 'You cannot file for more than 3 days of Special Privilege Leave (SPL) at once.' });
        }
        const now = new Date();
        const yearStart = new Date(now.getFullYear(), 0, 1);
        const yearEnd = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
        // Sum approved SPL days for this staff in the current year
        const approvedSPLLeaves = await Leave.find({
          staffId,
          leaveType: { $in: ['Special Privilege Leave', 'SPL'] },
          status: 'Approved',
          approvalDate: { $gte: yearStart, $lte: yearEnd },
        }).select('numberOfDays');
        const usedSPLDays = approvedSPLLeaves.reduce((sum, l) => sum + (l.numberOfDays || 0), 0);
        if (usedSPLDays >= 3) {
          return res.status(400).json({ message: 'You have already used the maximum 3 days of Special Privilege Leave (SPL) this year. Filing more is not allowed.' });
        }
        if (usedSPLDays + requestedSPLDays > 3) {
          return res.status(400).json({ message: `You have already used ${usedSPLDays} day(s) of Special Privilege Leave (SPL) this year. Maximum allowed is 3 days per year.` });
        }
      }

      // Enforce 7-day annual limit for Paternity Leave
      if (normalizedLeaveType === 'Paternity Leave' || normalizedLeaveType === 'Peternity Leave') {
        const requestedPaternityDays = numberOfDays || 0;
        const requestedYear = computedStartDate ? computedStartDate.getFullYear() : new Date().getFullYear();
        const yearStart = new Date(requestedYear, 0, 1);
        const yearEnd = new Date(requestedYear, 11, 31, 23, 59, 59, 999);

        const existingPaternityLeaves = await Leave.find({
          staffId,
          leaveType: { $in: ['Paternity Leave', 'Peternity Leave'] },
          status: { $in: ['Pending', 'Approved', 'For Revision'] },
          startDate: { $gte: yearStart, $lte: yearEnd },
        }).select('numberOfDays');

        const usedPaternityDays = existingPaternityLeaves.reduce((sum, l) => sum + (l.numberOfDays || 0), 0);
        if (usedPaternityDays + requestedPaternityDays > 7) {
          return res.status(400).json({
            message: `You have already filed ${usedPaternityDays} day(s) of Paternity Leave for ${requestedYear}. Maximum allowed is 7 days per year.`,
          });
        }
      }

      // Enforce 105-day annual limit for Maternity Leave
      if (normalizedLeaveType === 'Maternity Leave') {
        const requestedMaternityDays = numberOfDays || 0;
        const requestedYear = computedStartDate ? computedStartDate.getFullYear() : new Date().getFullYear();
        const yearStart = new Date(requestedYear, 0, 1);
        const yearEnd = new Date(requestedYear, 11, 31, 23, 59, 59, 999);

        const existingMaternityLeaves = await Leave.find({
          staffId,
          leaveType: 'Maternity Leave',
          status: { $in: ['Pending', 'Approved', 'For Revision'] },
          startDate: { $gte: yearStart, $lte: yearEnd },
        }).select('numberOfDays');

        const usedMaternityDays = existingMaternityLeaves.reduce((sum, l) => sum + (l.numberOfDays || 0), 0);
        if (usedMaternityDays + requestedMaternityDays > 105) {
          return res.status(400).json({
            message: `You have already filed ${usedMaternityDays} day(s) of Maternity Leave for ${requestedYear}. Maximum allowed is 105 days per year.`,
          });
        }
      }

      const newLeave = new Leave({
        leaveId,
        staffId,
        staffName: normalizedStaffName,
        staffDepartment,
        office,
        position,
        salary: normalizedSalary,
        filingDate: normalizedFilingDate,
        leaveType: normalizedLeaveType,
        startDate: computedStartDate,
        endDate: computedEndDate,
        dateRanges: normalizedDateRanges.length > 0 ? normalizedDateRanges : undefined,
        numberOfDays,
        lateFilingExplanation: req.body.lateFilingExplanation || '',
        reason: reason || null,
        leaveDetailsSpecific: leaveDetailsSpecific || null,
        communicationNotRequested: Boolean(communicationNotRequested),
        communicationRequested: Boolean(communicationRequested),
        approvalStage,
      });

      await newLeave.save();
      res.status(201).json({ message: 'Leave request filed successfully', leave: newLeave });
  } catch (error) {
    console.error('Error filing leave:', error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ message: error.message });
    }
    if (error.code === 11000) {
      return res.status(409).json({ message: 'Leave request with this ID already exists' });
    }
    res.status(500).json({ message: 'Failed to file leave request' });
  }
});

// Get leave requests for approvers (Head Officer for department, Admin for final review)
app.get('/leaves', verifyToken, async (req, res) => {
  try {
    const userRole = normalizeRole(req.user.role);
    const userDepartment = req.user.department;
    const canView = [ROLES.SUPER_ADMIN, ROLES.ADMIN_HR, ROLES.HEAD_OFFICER, ROLES.MUNICIPAL_BUDGET_OFFICER].includes(userRole);

    if (!canView) {
      return res.status(403).json({ message: 'Access denied. Only approvers can view leave requests.' });
    }

    const status = req.query.status;
    const filter = status ? { status } : {};

    if (userRole === ROLES.HEAD_OFFICER) {
      filter.staffDepartment = userDepartment;
      filter.status = 'Pending';
      filter.approvalStage = 'HeadOfficer';
    } else if (status === 'Pending') {
      filter.approvalStage = { $in: ['Admin', null] };
    }

    const leaves = await Leave.find(filter).sort({ createdAt: -1 });
    res.json(leaves);
  } catch (error) {
    console.error('Error fetching leaves:', error);
    res.status(500).json({ message: 'Failed to retrieve leave requests' });
  }
});

// Get leave requests by staff (Staff own only, Admin can see all)
app.get('/leaves/staff/:staffId', verifyToken, async (req, res) => {
  try {
    const userRole = normalizeRole(req.user.role);
    // Staff can only view their own leaves
    if (userRole === ROLES.STAFF && req.user.staffId !== req.params.staffId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const leaves = await Leave.find({ staffId: req.params.staffId }).sort({ createdAt: -1 });
    res.json(leaves);
  } catch (error) {
    console.error('Error fetching staff leaves:', error);
    res.status(500).json({ message: 'Failed to retrieve leave requests' });
  }
});

// Get single leave request
app.get('/leave/:leaveId', verifyToken, async (req, res) => {
  try {
    const leave = await Leave.findOne({ leaveId: req.params.leaveId });
    if (!leave) {
      return res.status(404).json({ message: 'Leave request not found' });
    }

    // Staff can only view their own leaves
    if (req.user.role === 'staff' && req.user.staffId !== leave.staffId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    res.json(leave);
  } catch (error) {
    console.error('Error fetching leave:', error);
    res.status(500).json({ message: 'Failed to retrieve leave request' });
  }
});

// Update leave request (Staff - own pending requests only)
app.put('/leaves/:leaveId', verifyToken, async (req, res) => {
  const {
    leaveType,
    startDate,
    endDate,
    dateRanges,
    reason,
    office,
    position,
    salary,
    filingDate,
    leaveDetailsSpecific,
    communicationNotRequested,
    communicationRequested,
  } = req.body;

  try {
    const leave = await Leave.findOne({ leaveId: req.params.leaveId });
    if (!leave) {
      return res.status(404).json({ message: 'Leave request not found' });
    }

    // Staff can only update their own requests
    if (req.user.role === 'staff' && req.user.staffId !== leave.staffId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const canEditStatuses = ['Pending', 'For Revision'];
    if (!canEditStatuses.includes(leave.status)) {
      return res.status(400).json({ message: 'Cannot update a processed leave request' });
    }

    if (leave.status === 'Pending' && leave.approvalStage === 'Admin') {
      return res.status(400).json({ message: 'Cannot update a leave request that is already under final review' });
    }

    // Calculate numberOfDays from dateRanges if provided, else from start/end
    let normalizedDateRanges = Array.isArray(dateRanges) ? dateRanges.filter(r => r.startDate && r.endDate) : [];
    if (normalizedDateRanges.length > 0) {
      leave.dateRanges = normalizedDateRanges;
      leave.numberOfDays = normalizedDateRanges.reduce((sum, range) => {
        const start = new Date(range.startDate);
        const end = new Date(range.endDate);
        if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return sum;
        return sum + (Math.floor((end - start) / (1000 * 60 * 60 * 24)) + 1);
      }, 0);
    } else if (startDate || endDate || leave.startDate || leave.endDate) {
      const start = new Date(startDate || leave.startDate);
      const end = new Date(endDate || leave.endDate);
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
        return res.status(400).json({ message: 'Invalid leave date values provided' });
      }
      const numberOfDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
      if (numberOfDays <= 0) {
        return res.status(400).json({ message: 'End date must be after start date' });
      }
      leave.numberOfDays = numberOfDays;
    }

    if (office !== undefined) leave.office = office;
    if (position !== undefined) leave.position = position;
    if (salary !== undefined) leave.salary = salary;
    if (filingDate !== undefined) leave.filingDate = filingDate;
    if (leaveType) leave.leaveType = leaveType;
    if (startDate) leave.startDate = startDate;
    if (endDate) leave.endDate = endDate;
    if (reason !== undefined) leave.reason = reason;
    if (leaveDetailsSpecific !== undefined) leave.leaveDetailsSpecific = leaveDetailsSpecific;
    if (communicationNotRequested !== undefined) leave.communicationNotRequested = Boolean(communicationNotRequested);
    if (communicationRequested !== undefined) leave.communicationRequested = Boolean(communicationRequested);
    if (req.body.lateFilingExplanation !== undefined) leave.lateFilingExplanation = req.body.lateFilingExplanation;

    // Enforce 7-day annual limit for Paternity Leave on updates/resubmission as well.
    const effectiveLeaveType = leaveType || leave.leaveType;
    if (effectiveLeaveType === 'Mandatory/Force Leave') {
      if (Number(leave.numberOfDays) > FORCE_LEAVE_MAX_DAYS_PER_APPLICATION) {
        return res.status(400).json({
          message: `You cannot file more than ${FORCE_LEAVE_MAX_DAYS_PER_APPLICATION} days of Force Leave in one application.`,
        });
      }

      const requestedYear = resolveLeaveCalendarYear(leave);
      const approvedForceLeaves = await Leave.find({
        leaveId: { $ne: leave.leaveId },
        staffId: leave.staffId,
        leaveType: 'Mandatory/Force Leave',
        status: 'Approved',
      }).select('startDate dateRanges filingDate createdAt numberOfDays');
      const usedForceLeaveDays = approvedForceLeaves.reduce((sum, approvedLeave) => (
        resolveLeaveCalendarYear(approvedLeave) === requestedYear
          ? sum + (Number(approvedLeave.numberOfDays) || 0)
          : sum
      ), 0);

      if (usedForceLeaveDays + (Number(leave.numberOfDays) || 0) > 5) {
        return res.status(400).json({
          message: `You have already used ${usedForceLeaveDays} approved Force Leave day(s) in ${requestedYear}. Maximum allowed is 5 days per year.`,
        });
      }
    }

    if (normalizeLeaveTypeKey(effectiveLeaveType) === 'wellness') {
      const requestedYear = resolveLeaveCalendarYear(leave);
      const usedWellnessDays = await getApprovedLeaveDaysForYear({
        staffId: leave.staffId,
        leaveTypes: ['Wellness', 'wellness', 'Wellness Leave'],
        year: requestedYear,
        excludeLeaveId: leave.leaveId,
      });

      if (usedWellnessDays + (Number(leave.numberOfDays) || 0) > WELLNESS_ANNUAL_LIMIT) {
        return res.status(400).json({
          message: `You have already used ${usedWellnessDays} approved Wellness Leave day(s) in ${requestedYear}. Maximum allowed is ${WELLNESS_ANNUAL_LIMIT} days per year.`,
        });
      }
    }

    if (effectiveLeaveType === 'Paternity Leave' || effectiveLeaveType === 'Peternity Leave') {
      const requestedPaternityDays = leave.numberOfDays || 0;
      const requestedStartDate = leave.startDate ? new Date(leave.startDate) : new Date();
      const requestedYear = Number.isNaN(requestedStartDate.getTime()) ? new Date().getFullYear() : requestedStartDate.getFullYear();
      const yearStart = new Date(requestedYear, 0, 1);
      const yearEnd = new Date(requestedYear, 11, 31, 23, 59, 59, 999);

      const existingPaternityLeaves = await Leave.find({
        leaveId: { $ne: leave.leaveId },
        staffId: leave.staffId,
        leaveType: { $in: ['Paternity Leave', 'Peternity Leave'] },
        status: { $in: ['Pending', 'Approved', 'For Revision'] },
        startDate: { $gte: yearStart, $lte: yearEnd },
      }).select('numberOfDays');

      const usedPaternityDays = existingPaternityLeaves.reduce((sum, l) => sum + (l.numberOfDays || 0), 0);
      if (usedPaternityDays + requestedPaternityDays > 7) {
        return res.status(400).json({
          message: `You have already filed ${usedPaternityDays} day(s) of Paternity Leave for ${requestedYear}. Maximum allowed is 7 days per year.`,
        });
      }
    }

    // Enforce 105-day annual limit for Maternity Leave on updates/resubmission as well.
    if (effectiveLeaveType === 'Maternity Leave') {
      const requestedMaternityDays = leave.numberOfDays || 0;
      const requestedStartDate = leave.startDate ? new Date(leave.startDate) : new Date();
      const requestedYear = Number.isNaN(requestedStartDate.getTime()) ? new Date().getFullYear() : requestedStartDate.getFullYear();
      const yearStart = new Date(requestedYear, 0, 1);
      const yearEnd = new Date(requestedYear, 11, 31, 23, 59, 59, 999);

      const existingMaternityLeaves = await Leave.find({
        leaveId: { $ne: leave.leaveId },
        staffId: leave.staffId,
        leaveType: 'Maternity Leave',
        status: { $in: ['Pending', 'Approved', 'For Revision'] },
        startDate: { $gte: yearStart, $lte: yearEnd },
      }).select('numberOfDays');

      const usedMaternityDays = existingMaternityLeaves.reduce((sum, l) => sum + (l.numberOfDays || 0), 0);
      if (usedMaternityDays + requestedMaternityDays > 105) {
        return res.status(400).json({
          message: `You have already filed ${usedMaternityDays} day(s) of Maternity Leave for ${requestedYear}. Maximum allowed is 105 days per year.`,
        });
      }
    }

    const filingStaff = await Staff.findOne({ id: leave.staffId }).select('role');
    const filerRole = normalizeRole(filingStaff?.role);
    const nextApprovalStage = filerRole === ROLES.STAFF
      ? 'HeadOfficer'
      : filerRole === ROLES.HEAD_OFFICER
        ? 'BudgetOfficer'
        : filerRole === ROLES.MUNICIPAL_BUDGET_OFFICER
          ? 'Admin'
          : 'Admin';

    // Resubmission cycle: staff returns to Head Officer, while head officers/admin return to Admin
    leave.status = 'Pending';
    leave.approvalStage = nextApprovalStage;
    leave.headOfficerApprovedBy = null;
    leave.headOfficerApprovalDate = null;
    leave.headOfficerRemarks = null;
    leave.approvedBy = null;
    leave.approvalDate = null;
    leave.remarks = null;
    leave.revisionRequestedBy = null;
    leave.revisionRequestedByRole = null;
    leave.revisionRequestedAt = null;
    leave.revisionComment = null;
    leave.updatedAt = Date.now();

    await leave.save();
    res.status(200).json({ message: 'Leave request updated successfully', leave });
  } catch (error) {
    console.error('Error updating leave:', error);
    res.status(500).json({ message: 'Failed to update leave request' });
  }
});

// Return leave request for revision (Head Officer/Admin)
app.patch('/leaves/:leaveId/revise', verifyToken, async (req, res) => {
  const { approvedBy, remarks } = req.body;

  if (!approvedBy) {
    return res.status(400).json({ message: 'Approver name is required' });
  }

  if (!remarks || !String(remarks).trim()) {
    return res.status(400).json({ message: 'Revision comment is required' });
  }

  try {
    const leave = await Leave.findOne({ leaveId: req.params.leaveId });

    if (!leave) {
      return res.status(404).json({ message: 'Leave request not found' });
    }

    if (leave.status !== 'Pending') {
      return res.status(400).json({ message: 'Only pending leave requests can be returned for revision' });
    }

    const userRole = req.user.role;

    if (userRole === ROLES.HEAD_OFFICER) {
      if (leave.staffDepartment !== req.user.department) {
        return res.status(403).json({ message: 'You can only review leave requests from your department' });
      }

      if (leave.approvalStage !== 'HeadOfficer') {
        return res.status(400).json({ message: 'Leave request is already forwarded for final review' });
      }
    } else if ([ROLES.SUPER_ADMIN, ROLES.ADMIN_HR].includes(userRole)) {
      if (leave.approvalStage && leave.approvalStage !== 'Admin') {
        return res.status(400).json({ message: 'Leave request must be approved by the Head Officer first' });
      }
    } else {
      return res.status(403).json({ message: 'Access denied. Only approvers can request revisions.' });
    }

    const filingStaff = await Staff.findOne({ id: leave.staffId }).select('role');
    const filerRole = normalizeRole(filingStaff?.role);
    const nextApprovalStage = filerRole === ROLES.STAFF ? 'HeadOfficer' : 'Admin';

    leave.status = 'For Revision';
    leave.approvalStage = nextApprovalStage;
    leave.revisionRequestedBy = approvedBy;
    leave.revisionRequestedByRole = userRole;
    leave.revisionRequestedAt = Date.now();
    leave.revisionComment = remarks;
    leave.remarks = remarks;
    leave.updatedAt = Date.now();
    await leave.save();

    res.status(200).json({ message: 'Leave request returned for revision', leave });
  } catch (error) {
    console.error('Error returning leave request for revision:', error);
    res.status(500).json({ message: 'Failed to return leave request for revision' });
  }
});

// Approve leave request (Head Officer first-stage, Admin final-stage)
app.patch('/leaves/:leaveId/approve', verifyToken, async (req, res) => {
  const { approvedBy, remarks } = req.body;

  if (!approvedBy) {
    return res.status(400).json({ message: 'Approver name is required' });
  }

  try {
    const leave = await Leave.findOne({ leaveId: req.params.leaveId });

    if (!leave) {
      return res.status(404).json({ message: 'Leave request not found' });
    }

    if (leave.status !== 'Pending') {
      return res.status(400).json({ message: 'Leave request is already processed' });
    }

    const userRole = req.user.role;

    if (userRole === ROLES.HEAD_OFFICER) {
      if (leave.staffDepartment !== req.user.department) {
        return res.status(403).json({ message: 'You can only approve leave requests from your department' });
      }

      if (leave.approvalStage !== 'HeadOfficer') {
        return res.status(400).json({ message: 'Leave request is already forwarded for final review' });
      }

      leave.approvalStage = 'Admin';
      leave.headOfficerApprovedBy = approvedBy;
      leave.headOfficerApprovalDate = Date.now();
      leave.headOfficerRemarks = remarks || '';
      leave.updatedAt = Date.now();
      await leave.save();

      await createSystemLogEntry({
        module: 'Leave Management',
        action: 'Approve',
        user: req.user.name || req.user.email || 'System',
        userId: req.user.staffId,
        description: `Leave approved at Head Officer stage: ${leave.leaveId}`,
        ipAddress: getRequestIp(req),
        status: 'Success',
        metadata: {
          leaveId: leave.leaveId,
          stage: 'HeadOfficer',
          approver: approvedBy,
        },
      });

      return res.status(200).json({ message: 'Leave request approved by Head Officer and forwarded to Admin', leave });
    }

    if (![ROLES.SUPER_ADMIN, ROLES.ADMIN_HR].includes(userRole)) {
      return res.status(403).json({ message: 'Access denied. Only approvers can approve leave requests.' });
    }

    if (leave.approvalStage && leave.approvalStage !== 'Admin') {
      return res.status(400).json({ message: 'Leave request must be approved by the Head Officer first' });
    }

    // Enforce annual limits for leave types at approval time as well.
    const normalizedLeaveTypeForApproval = String(leave.leaveType || '').trim();
    const leaveTypeAnnualLimits = {
      'Mandatory/Force Leave': 5,
      Wellness: WELLNESS_ANNUAL_LIMIT,
      'Paternity Leave': 7,
      'Peternity Leave': 7,
      'Maternity Leave': 105,
    };
    const annualLimit = leaveTypeAnnualLimits[normalizedLeaveTypeForApproval];

    if (annualLimit) {
      const targetYear = resolveLeaveCalendarYear(leave);
      const leaveTypeGroup = normalizedLeaveTypeForApproval === 'Mandatory/Force Leave'
        ? ['Mandatory/Force Leave']
        : normalizeLeaveTypeKey(normalizedLeaveTypeForApproval) === 'wellness'
          ? ['Wellness', 'wellness', 'Wellness Leave']
          : normalizedLeaveTypeForApproval === 'Maternity Leave'
            ? ['Maternity Leave']
            : ['Paternity Leave', 'Peternity Leave'];

      const approvedTypeLeaves = await Leave.find({
        leaveId: { $ne: leave.leaveId },
        staffId: leave.staffId,
        status: 'Approved',
        leaveType: { $in: leaveTypeGroup },
      }).select('startDate dateRanges filingDate createdAt numberOfDays');

      const usedDays = approvedTypeLeaves.reduce((sum, approvedLeave) => {
        const leaveYear = resolveLeaveCalendarYear(approvedLeave);
        if (leaveYear !== targetYear) return sum;
        return sum + (Number(approvedLeave.numberOfDays) || 0);
      }, 0);

      const requestedDays = Number(leave.numberOfDays) || 0;
      if (usedDays + requestedDays > annualLimit) {
        const leaveLabel = normalizedLeaveTypeForApproval === 'Mandatory/Force Leave'
          ? 'Force Leave'
          : normalizeLeaveTypeKey(normalizedLeaveTypeForApproval) === 'wellness'
            ? 'Wellness Leave'
          : normalizedLeaveTypeForApproval === 'Maternity Leave'
            ? 'Maternity Leave'
            : 'Paternity Leave';
        return res.status(400).json({
          message: `Approval blocked: staff already has ${usedDays} approved ${leaveLabel} day(s) in ${targetYear}. Maximum allowed is ${annualLimit} days per year.`,
        });
      }
    }

    leave.status = 'Approved';
    leave.approvedBy = approvedBy;
    leave.approvalDate = Date.now();
    leave.remarks = remarks || '';
    leave.updatedAt = Date.now();
    await leave.save();

    await upsertApprovedLeaveToLeaveRecord(leave);

    await createSystemLogEntry({
      module: 'Leave Management',
      action: 'Approve',
      user: req.user.name || req.user.email || 'System',
      userId: req.user.staffId,
      description: `Leave approved: ${leave.leaveId}`,
      ipAddress: getRequestIp(req),
      status: 'Success',
      metadata: {
        leaveId: leave.leaveId,
        stage: 'Admin',
        approver: approvedBy,
      },
    });

    res.status(200).json({ message: 'Leave request approved', leave });
  } catch (error) {
    console.error('Error approving leave:', error);
    res.status(500).json({ message: 'Failed to approve leave request' });
  }
});

// Disapprove leave request (Head Officer first-stage, Admin final-stage)
app.patch('/leaves/:leaveId/disapprove', verifyToken, async (req, res) => {
  const { approvedBy, remarks } = req.body;

  if (!approvedBy) {
    return res.status(400).json({ message: 'Disapprover name is required' });
  }

  try {
    const leave = await Leave.findOne({ leaveId: req.params.leaveId });

    if (!leave) {
      return res.status(404).json({ message: 'Leave request not found' });
    }

    if (leave.status !== 'Pending') {
      return res.status(400).json({ message: 'Leave request is already processed' });
    }

    const userRole = req.user.role;

    if (userRole === ROLES.HEAD_OFFICER) {
      if (leave.staffDepartment !== req.user.department) {
        return res.status(403).json({ message: 'You can only disapprove leave requests from your department' });
      }

      if (leave.approvalStage !== 'HeadOfficer') {
        return res.status(400).json({ message: 'Leave request is already forwarded for final review' });
      }
    } else if ([ROLES.SUPER_ADMIN, ROLES.ADMIN_HR].includes(userRole)) {
      if (leave.approvalStage && leave.approvalStage !== 'Admin') {
        return res.status(400).json({ message: 'Leave request must be approved by the Head Officer first' });
      }
    } else {
      return res.status(403).json({ message: 'Access denied. Only approvers can disapprove leave requests.' });
    }

    leave.status = 'Disapproved';
    leave.approvedBy = approvedBy;
    leave.approvalDate = Date.now();
    leave.remarks = remarks || '';
    leave.updatedAt = Date.now();
    await leave.save();

    await createSystemLogEntry({
      module: 'Leave Management',
      action: 'Disapprove',
      user: req.user.name || req.user.email || 'System',
      userId: req.user.staffId,
      description: `Leave disapproved: ${leave.leaveId}`,
      ipAddress: getRequestIp(req),
      status: 'Success',
      metadata: {
        leaveId: leave.leaveId,
        stage: userRole === ROLES.HEAD_OFFICER ? 'HeadOfficer' : 'Admin',
        approver: approvedBy,
      },
    });

    res.status(200).json({ message: 'Leave request disapproved', leave });
  } catch (error) {
    console.error('Error disapproving leave:', error);
    res.status(500).json({ message: 'Failed to disapprove leave request' });
  }
});

// Delete leave request (Staff - own pending only, Admin - any)
app.delete('/leaves/:leaveId', verifyToken, async (req, res) => {
  try {
    const leave = await Leave.findOne({ leaveId: req.params.leaveId });
    if (!leave) {
      return res.status(404).json({ message: 'Leave request not found' });
    }

    // Staff can only delete their own pending requests
    if (req.user.role === 'staff') {
      if (req.user.staffId !== leave.staffId) {
        return res.status(403).json({ message: 'Access denied' });
      }
      if (leave.status !== 'Pending') {
        return res.status(400).json({ message: 'Can only delete pending requests' });
      }
    }

    const deleted = await Leave.findOneAndDelete({ leaveId: req.params.leaveId });
    res.status(200).json({ message: 'Leave request deleted successfully' });
  } catch (error) {
    console.error('Error deleting leave:', error);
    res.status(500).json({ message: 'Failed to delete leave request' });
  }
});


// ==================== TRAVEL ORDER ROUTES ====================

// Create Travel Order Request (Staff - own requests only)
app.post('/travel-orders', verifyToken, async (req, res) => {
  const {
    travelOrderId,
    staffId,
    staffName,
    destination,
    purpose,
    dateFrom,
    dateTo,
    transportMode,
    estimatedBudget,
    travelType,
    purposeOfTravel,
    periodCoveredFrom,
    periodCoveredTo,
    venueDestination,
    travelDestination,
    abroadDateOfFiling,
    dateOfFiling,
    designations,
    permanentStation,
    activitySponsoredBy,
    officialBusiness,
    officialTime,
    meeting,
    travel,
    training,
    seminar,
    expensesCovered,
    fundSourcePapCode,
    recommendingApproval,
    datePrepared,
    region,
    province,
    municipality,
    abroadName,
    office,
    position,
    period,
    fundSource,
    attachment,
  } = req.body;

  const normalizedFundSource =
    (typeof fundSource === 'string' && fundSource.trim()) ||
    (typeof fundSourcePapCode === 'string' && fundSourcePapCode.trim()) ||
    null;
  const normalizedAttachment =
    (typeof attachment === 'string' && attachment.trim()) ||
    (typeof req.body.attachmentName === 'string' && req.body.attachmentName.trim()) ||
    (typeof req.body.attachments === 'string' && req.body.attachments.trim()) ||
    null;

  const normalizedDestination = destination || venueDestination || travelDestination;
  const normalizedPurpose = purpose || purposeOfTravel || (travelType === 'abroad' ? 'Travel Abroad' : null);
  const normalizedDateFrom = dateFrom || periodCoveredFrom || abroadDateOfFiling;
  const normalizedDateTo = dateTo || periodCoveredTo || abroadDateOfFiling || normalizedDateFrom;
  const normalizedTransportMode = transportMode || (travelType === 'abroad' ? 'Air' : 'Land');

  // Staff can only file travel orders for themselves
  if (req.user.role === 'staff' && req.user.staffId !== staffId) {
    return res.status(403).json({ message: 'You can only file travel orders for yourself' });
  }

  if (!travelOrderId || !staffId || !staffName || !normalizedDestination || !normalizedPurpose || !normalizedDateFrom || !normalizedDateTo || !normalizedTransportMode) {
    return res.status(400).json({ message: 'All required fields must be provided' });
  }

  try {
    const existing = await TravelOrder.findOne({ travelOrderId });
    if (existing) {
      return res.status(409).json({ message: 'Travel order with this ID already exists' });
    }

    const staff = await Staff.findOne({ id: staffId }).select('department role');
    const staffDepartment = staff?.department || req.user.department || null;
    const filerRole = normalizeRole(staff?.role || req.user.role);
    const approvalStage = filerRole === ROLES.STAFF ? 'HeadOfficer' : 'Admin';
    const generatedControlNo = travelType === 'abroad'
      ? await generateNextTravelControlNo(normalizedDateFrom || new Date())
      : null;

    const from = new Date(normalizedDateFrom);
    const to = new Date(normalizedDateTo);

    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      return res.status(400).json({ message: 'Invalid travel date values provided' });
    }

    const numberOfDays = Math.ceil((to - from) / (1000 * 60 * 60 * 24)) + 1;

    if (numberOfDays <= 0) {
      return res.status(400).json({ message: 'End date must be after start date' });
    }

    const newTravelOrder = new TravelOrder({
      travelOrderId,
      ...(generatedControlNo ? { controlNo: generatedControlNo } : {}),
      staffId,
      staffName,
      staffDepartment,
      travelType: travelType || 'office',

      dateOfFiling: dateOfFiling || null,
      designations: Array.isArray(designations) ? designations : [],
      permanentStation: permanentStation || null,
      purposeOfTravel: purposeOfTravel || null,
      activitySponsoredBy: activitySponsoredBy || null,
      periodCoveredFrom: periodCoveredFrom || null,
      periodCoveredTo: periodCoveredTo || null,
      officialBusiness: Boolean(officialBusiness),
      officialTime: Boolean(officialTime),
      meeting: Boolean(meeting),
      travel: Boolean(travel),
      training: Boolean(training),
      seminar: Boolean(seminar),
      venueDestination: venueDestination || null,
      expensesCovered: expensesCovered || null,
      fundSourcePapCode: fundSourcePapCode || normalizedFundSource || null,
      recommendingApproval: recommendingApproval || null,

      datePrepared: datePrepared || null,
      region: region || null,
      province: province || null,
      municipality: municipality || null,
      abroadDateOfFiling: abroadDateOfFiling || null,
      abroadName: abroadName || null,
      office: office || null,
      position: position || null,
      period: period || null,
      travelDestination: travelDestination || null,
      fundSource: fundSource || normalizedFundSource || null,
      attachment: normalizedAttachment,

      destination: normalizedDestination,
      purpose: normalizedPurpose,
      dateFrom: from,
      dateTo: to,
      numberOfDays,
      transportMode: normalizedTransportMode,
      estimatedBudget,
      approvalStage,
    });

    await newTravelOrder.save();
    res.status(201).json({ message: 'Travel order request filed successfully', travelOrder: newTravelOrder });
  } catch (error) {
    console.error('Error filing travel order:', error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ message: error.message });
    }
    res.status(500).json({ message: 'Failed to file travel order request' });
  }
});

// Get travel orders for approvers (Head Officer for department, Admin for final review)
app.get('/travel-orders', verifyToken, async (req, res) => {
  try {
    const userRole = normalizeRole(req.user.role);
    const userDepartment = req.user.department;
    const canView = [ROLES.SUPER_ADMIN, ROLES.ADMIN_HR, ROLES.HEAD_OFFICER, ROLES.MUNICIPAL_BUDGET_OFFICER].includes(userRole);

    if (!canView) {
      return res.status(403).json({ message: 'Access denied. Only approvers can view travel orders.' });
    }

    const status = req.query.status;
    const filter = status ? { status } : {};

    if (userRole === ROLES.HEAD_OFFICER) {
      filter.staffDepartment = userDepartment;
      filter.status = 'Pending';
      filter.approvalStage = 'HeadOfficer';
    } else if (status === 'Pending') {
      filter.approvalStage = { $in: ['Admin', null] };
    }

    const travelOrders = await TravelOrder.find(filter).sort({ createdAt: -1 });
    res.json(travelOrders);
  } catch (error) {
    console.error('Error fetching travel orders:', error);
    res.status(500).json({ message: 'Failed to retrieve travel orders' });
  }
});

// Get travel orders by staff (Staff own only, Admin can see all)
app.get('/travel-orders/staff/:staffId', verifyToken, async (req, res) => {
  try {
    const userRole = normalizeRole(req.user.role);
    // Staff can only view their own travel orders
    if (userRole === ROLES.STAFF && req.user.staffId !== req.params.staffId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const travelOrders = await TravelOrder.find({ staffId: req.params.staffId }).sort({ createdAt: -1 });
    res.json(travelOrders);
  } catch (error) {
    console.error('Error fetching staff travel orders:', error);
    res.status(500).json({ message: 'Failed to retrieve travel orders' });
  }
});

// Get single travel order
app.get('/travel-order/:travelOrderId', verifyToken, async (req, res) => {
  try {
    const travelOrder = await TravelOrder.findOne({ travelOrderId: req.params.travelOrderId });
    if (!travelOrder) {
      return res.status(404).json({ message: 'Travel order not found' });
    }

    // Staff can only view their own travel orders
    if (req.user.role === 'staff' && req.user.staffId !== travelOrder.staffId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    res.json(travelOrder);
  } catch (error) {
    console.error('Error fetching travel order:', error);
    res.status(500).json({ message: 'Failed to retrieve travel order' });
  }
});

// Update travel order (Staff - own pending orders only)
app.put('/travel-orders/:travelOrderId', verifyToken, async (req, res) => {
  const {
    destination,
    purpose,
    dateFrom,
    dateTo,
    transportMode,
    estimatedBudget,
    travelType,
    purposeOfTravel,
    periodCoveredFrom,
    periodCoveredTo,
    venueDestination,
    travelDestination,
    abroadDateOfFiling,
    dateOfFiling,
    designations,
    permanentStation,
    activitySponsoredBy,
    officialBusiness,
    officialTime,
    meeting,
    travel,
    training,
    seminar,
    expensesCovered,
    fundSourcePapCode,
    recommendingApproval,
    datePrepared,
    region,
    province,
    municipality,
    abroadName,
    office,
    position,
    period,
    fundSource,
    attachment,
  } = req.body;

  const normalizedFundSource =
    (typeof fundSource === 'string' && fundSource.trim()) ||
    (typeof fundSourcePapCode === 'string' && fundSourcePapCode.trim()) ||
    null;
  const normalizedAttachment =
    (typeof attachment === 'string' && attachment.trim()) ||
    (typeof req.body.attachmentName === 'string' && req.body.attachmentName.trim()) ||
    (typeof req.body.attachments === 'string' && req.body.attachments.trim()) ||
    null;

  try {
    const travelOrder = await TravelOrder.findOne({ travelOrderId: req.params.travelOrderId });
    if (!travelOrder) {
      return res.status(404).json({ message: 'Travel order not found' });
    }

    // Staff can only update their own orders
    if (req.user.role === 'staff' && req.user.staffId !== travelOrder.staffId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const canEditStatuses = ['Pending', 'For Revision'];
    if (!canEditStatuses.includes(travelOrder.status)) {
      return res.status(400).json({ message: 'Cannot update a processed travel order' });
    }

    if (travelOrder.status === 'Pending' && travelOrder.approvalStage === 'Admin') {
      return res.status(400).json({ message: 'Cannot update a travel order that is already under final review' });
    }

    const normalizedDestination = destination || venueDestination || travelDestination || travelOrder.destination;
    const normalizedPurpose = purpose || purposeOfTravel || (travelType === 'abroad' ? 'Travel Abroad' : null) || travelOrder.purpose;
    const normalizedDateFrom = dateFrom || periodCoveredFrom || abroadDateOfFiling || travelOrder.dateFrom;
    const normalizedDateTo = dateTo || periodCoveredTo || abroadDateOfFiling || normalizedDateFrom || travelOrder.dateTo;
    const normalizedTransportMode = transportMode || (travelType === 'abroad' ? 'Air' : 'Land') || travelOrder.transportMode;

    const from = new Date(normalizedDateFrom);
    const to = new Date(normalizedDateTo);

    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      return res.status(400).json({ message: 'Invalid travel date values provided' });
    }

    const numberOfDays = Math.ceil((to - from) / (1000 * 60 * 60 * 24)) + 1;
    if (numberOfDays <= 0) {
      return res.status(400).json({ message: 'End date must be after start date' });
    }

    travelOrder.travelType = travelType || travelOrder.travelType || 'office';

    travelOrder.dateOfFiling = dateOfFiling || travelOrder.dateOfFiling || null;
    travelOrder.designations = Array.isArray(designations) ? designations : (travelOrder.designations || []);
    travelOrder.permanentStation = permanentStation || travelOrder.permanentStation || null;
    travelOrder.purposeOfTravel = purposeOfTravel || travelOrder.purposeOfTravel || null;
    travelOrder.activitySponsoredBy = activitySponsoredBy || travelOrder.activitySponsoredBy || null;
    travelOrder.periodCoveredFrom = periodCoveredFrom || travelOrder.periodCoveredFrom || null;
    travelOrder.periodCoveredTo = periodCoveredTo || travelOrder.periodCoveredTo || null;
    travelOrder.officialBusiness = typeof officialBusiness === 'boolean' ? officialBusiness : Boolean(travelOrder.officialBusiness);
    travelOrder.officialTime = typeof officialTime === 'boolean' ? officialTime : Boolean(travelOrder.officialTime);
    travelOrder.meeting = typeof meeting === 'boolean' ? meeting : Boolean(travelOrder.meeting);
    travelOrder.travel = typeof travel === 'boolean' ? travel : Boolean(travelOrder.travel);
    travelOrder.training = typeof training === 'boolean' ? training : Boolean(travelOrder.training);
    travelOrder.seminar = typeof seminar === 'boolean' ? seminar : Boolean(travelOrder.seminar);
    travelOrder.venueDestination = venueDestination || travelOrder.venueDestination || null;
    travelOrder.expensesCovered = expensesCovered || travelOrder.expensesCovered || null;
    travelOrder.fundSourcePapCode = fundSourcePapCode || normalizedFundSource || travelOrder.fundSourcePapCode || travelOrder.fundSource || null;
    travelOrder.recommendingApproval = recommendingApproval || travelOrder.recommendingApproval || null;

    travelOrder.datePrepared = datePrepared || travelOrder.datePrepared || null;
    travelOrder.region = region || travelOrder.region || null;
    travelOrder.province = province || travelOrder.province || null;
    travelOrder.municipality = municipality || travelOrder.municipality || null;
    travelOrder.abroadDateOfFiling = abroadDateOfFiling || travelOrder.abroadDateOfFiling || null;
    travelOrder.abroadName = abroadName || travelOrder.abroadName || null;
    travelOrder.office = office || travelOrder.office || null;
    travelOrder.position = position || travelOrder.position || null;
    travelOrder.period = period || travelOrder.period || null;
    travelOrder.travelDestination = travelDestination || travelOrder.travelDestination || null;
    travelOrder.fundSource = fundSource || normalizedFundSource || travelOrder.fundSource || travelOrder.fundSourcePapCode || null;
    travelOrder.attachment = normalizedAttachment || travelOrder.attachment || null;

    travelOrder.destination = normalizedDestination;
    travelOrder.purpose = normalizedPurpose;
    travelOrder.dateFrom = from;
    travelOrder.dateTo = to;
    travelOrder.numberOfDays = numberOfDays;
    travelOrder.transportMode = normalizedTransportMode;
    if (estimatedBudget !== undefined) {
      travelOrder.estimatedBudget = estimatedBudget;
    }

    const filingStaff = await Staff.findOne({ id: travelOrder.staffId }).select('role');
    const filerRole = normalizeRole(filingStaff?.role);
    const nextApprovalStage = filerRole === ROLES.STAFF ? 'HeadOfficer' : 'Admin';

    // Resubmission cycle: staff returns to Head Officer, while head officers/admin return to Admin
    travelOrder.status = 'Pending';
    travelOrder.approvalStage = nextApprovalStage;
    travelOrder.headOfficerApprovedBy = null;
    travelOrder.headOfficerApprovalDate = null;
    travelOrder.headOfficerRemarks = null;
    travelOrder.approvedBy = null;
    travelOrder.approvalDate = null;
    travelOrder.remarks = null;
    travelOrder.revisionRequestedBy = null;
    travelOrder.revisionRequestedByRole = null;
    travelOrder.revisionRequestedAt = null;
    travelOrder.revisionComment = null;
    travelOrder.updatedAt = Date.now();

    await travelOrder.save();
    res.status(200).json({ message: 'Travel order updated successfully', travelOrder });
  } catch (error) {
    console.error('Error updating travel order:', error);
    res.status(500).json({ message: 'Failed to update travel order' });
  }
});

// Return travel order for revision (Head Officer/Admin)
app.patch('/travel-orders/:travelOrderId/revise', verifyToken, async (req, res) => {
  const { approvedBy, remarks } = req.body;

  if (!approvedBy) {
    return res.status(400).json({ message: 'Approver name is required' });
  }

  if (!remarks || !String(remarks).trim()) {
    return res.status(400).json({ message: 'Revision comment is required' });
  }

  try {
    const travelOrder = await TravelOrder.findOne({ travelOrderId: req.params.travelOrderId });

    if (!travelOrder) {
      return res.status(404).json({ message: 'Travel order not found' });
    }

    if (travelOrder.status !== 'Pending') {
      return res.status(400).json({ message: 'Only pending travel orders can be returned for revision' });
    }

    const userRole = req.user.role;

    if (userRole === ROLES.HEAD_OFFICER) {
      if (travelOrder.staffDepartment !== req.user.department) {
        return res.status(403).json({ message: 'You can only review travel orders from your department' });
      }

      if (travelOrder.approvalStage !== 'HeadOfficer') {
        return res.status(400).json({ message: 'Travel order is already forwarded for final review' });
      }
    } else if ([ROLES.SUPER_ADMIN, ROLES.ADMIN_HR].includes(userRole)) {
      if (travelOrder.approvalStage && travelOrder.approvalStage !== 'Admin') {
        return res.status(400).json({ message: 'Travel order must be approved by the Head Officer first' });
      }
    } else {
      return res.status(403).json({ message: 'Access denied. Only approvers can request revisions.' });
    }

    const filingStaff = await Staff.findOne({ id: travelOrder.staffId }).select('role');
    const filerRole = normalizeRole(filingStaff?.role);
    const nextApprovalStage = filerRole === ROLES.STAFF ? 'HeadOfficer' : 'Admin';

    travelOrder.status = 'For Revision';
    travelOrder.approvalStage = nextApprovalStage;
    travelOrder.revisionRequestedBy = approvedBy;
    travelOrder.revisionRequestedByRole = userRole;
    travelOrder.revisionRequestedAt = Date.now();
    travelOrder.revisionComment = remarks;
    travelOrder.remarks = remarks;
    travelOrder.updatedAt = Date.now();
    await travelOrder.save();

    res.status(200).json({ message: 'Travel order returned for revision', travelOrder });
  } catch (error) {
    console.error('Error returning travel order for revision:', error);
    res.status(500).json({ message: 'Failed to return travel order for revision' });
  }
});

// Approve travel order (Head Officer first-stage, Admin final-stage)
app.patch('/travel-orders/:travelOrderId/approve', verifyToken, async (req, res) => {
  const { approvedBy, remarks } = req.body;

  if (!approvedBy) {
    return res.status(400).json({ message: 'Approver name is required' });
  }

  try {
    const travelOrder = await TravelOrder.findOne({ travelOrderId: req.params.travelOrderId });

    if (!travelOrder) {
      return res.status(404).json({ message: 'Travel order not found' });
    }

    if (travelOrder.status !== 'Pending') {
      return res.status(400).json({ message: 'Travel order is already processed' });
    }

    const userRole = req.user.role;

    if (userRole === ROLES.HEAD_OFFICER) {
      if (travelOrder.staffDepartment !== req.user.department) {
        return res.status(403).json({ message: 'You can only approve travel orders from your department' });
      }

      if (travelOrder.approvalStage !== 'HeadOfficer') {
        return res.status(400).json({ message: 'Travel order is already forwarded for final review' });
      }

      travelOrder.approvalStage = 'Admin';
      travelOrder.headOfficerApprovedBy = approvedBy;
      travelOrder.headOfficerApprovalDate = Date.now();
      travelOrder.headOfficerRemarks = remarks || '';
      travelOrder.updatedAt = Date.now();
      await travelOrder.save();

      await createSystemLogEntry({
        module: 'Travel Order',
        action: 'Approve',
        user: req.user.name || req.user.email || 'System',
        userId: req.user.staffId,
        description: `Travel order approved at Head Officer stage: ${travelOrder.travelOrderId}`,
        ipAddress: getRequestIp(req),
        status: 'Success',
        metadata: {
          travelOrderId: travelOrder.travelOrderId,
          stage: 'HeadOfficer',
          approver: approvedBy,
        },
      });

      return res.status(200).json({ message: 'Travel order approved by Head Officer and forwarded to Admin', travelOrder });
    }

    if (![ROLES.SUPER_ADMIN, ROLES.ADMIN_HR].includes(userRole)) {
      return res.status(403).json({ message: 'Access denied. Only approvers can approve travel orders.' });
    }

    if (travelOrder.approvalStage && travelOrder.approvalStage !== 'Admin') {
      return res.status(400).json({ message: 'Travel order must be approved by the Head Officer first' });
    }

    travelOrder.status = 'Approved';
    travelOrder.approvedBy = approvedBy;
    travelOrder.approvalDate = Date.now();
    travelOrder.remarks = remarks || '';
    travelOrder.updatedAt = Date.now();
    await travelOrder.save();

    await createSystemLogEntry({
      module: 'Travel Order',
      action: 'Approve',
      user: req.user.name || req.user.email || 'System',
      userId: req.user.staffId,
      description: `Travel order approved: ${travelOrder.travelOrderId}`,
      ipAddress: getRequestIp(req),
      status: 'Success',
      metadata: {
        travelOrderId: travelOrder.travelOrderId,
        stage: 'Admin',
        approver: approvedBy,
      },
    });

    res.status(200).json({ message: 'Travel order approved', travelOrder });
  } catch (error) {
    console.error('Error approving travel order:', error);
    res.status(500).json({ message: 'Failed to approve travel order' });
  }
});

// Disapprove travel order (Head Officer first-stage, Admin final-stage)
app.patch('/travel-orders/:travelOrderId/disapprove', verifyToken, async (req, res) => {
  const { approvedBy, remarks } = req.body;

  if (!approvedBy) {
    return res.status(400).json({ message: 'Disapprover name is required' });
  }

  try {
    const travelOrder = await TravelOrder.findOne({ travelOrderId: req.params.travelOrderId });

    if (!travelOrder) {
      return res.status(404).json({ message: 'Travel order not found' });
    }

    if (travelOrder.status !== 'Pending') {
      return res.status(400).json({ message: 'Travel order is already processed' });
    }

    const userRole = req.user.role;

    if (userRole === ROLES.HEAD_OFFICER) {
      if (travelOrder.staffDepartment !== req.user.department) {
        return res.status(403).json({ message: 'You can only disapprove travel orders from your department' });
      }

      if (travelOrder.approvalStage !== 'HeadOfficer') {
        return res.status(400).json({ message: 'Travel order is already forwarded for final review' });
      }
    } else if ([ROLES.SUPER_ADMIN, ROLES.ADMIN_HR].includes(userRole)) {
      if (travelOrder.approvalStage && travelOrder.approvalStage !== 'Admin') {
        return res.status(400).json({ message: 'Travel order must be approved by the Head Officer first' });
      }
    } else {
      return res.status(403).json({ message: 'Access denied. Only approvers can disapprove travel orders.' });
    }

    travelOrder.status = 'Disapproved';
    travelOrder.approvedBy = approvedBy;
    travelOrder.approvalDate = Date.now();
    travelOrder.remarks = remarks || '';
    travelOrder.updatedAt = Date.now();
    await travelOrder.save();

    await createSystemLogEntry({
      module: 'Travel Order',
      action: 'Disapprove',
      user: req.user.name || req.user.email || 'System',
      userId: req.user.staffId,
      description: `Travel order disapproved: ${travelOrder.travelOrderId}`,
      ipAddress: getRequestIp(req),
      status: 'Success',
      metadata: {
        travelOrderId: travelOrder.travelOrderId,
        stage: userRole === ROLES.HEAD_OFFICER ? 'HeadOfficer' : 'Admin',
        approver: approvedBy,
      },
    });

    res.status(200).json({ message: 'Travel order disapproved', travelOrder });
  } catch (error) {
    console.error('Error disapproving travel order:', error);
    res.status(500).json({ message: 'Failed to disapprove travel order' });
  }
});

// Mark travel order as completed (Staff own approved, Admin any)
app.patch('/travel-orders/:travelOrderId/complete', verifyToken, async (req, res) => {
  try {
    const travelOrder = await TravelOrder.findOne({ travelOrderId: req.params.travelOrderId });
    if (!travelOrder) {
      return res.status(404).json({ message: 'Travel order not found' });
    }

    // Staff can only complete their own approved orders
    if (req.user.role === 'staff') {
      if (req.user.staffId !== travelOrder.staffId) {
        return res.status(403).json({ message: 'Access denied' });
      }
      if (travelOrder.status !== 'Approved') {
        return res.status(400).json({ message: 'Can only complete approved orders' });
      }
    }

    const updated = await TravelOrder.findOneAndUpdate(
      { travelOrderId: req.params.travelOrderId },
      {
        $set: {
          status: 'Completed',
          updatedAt: Date.now(),
        },
      },
      { new: true }
    );

    res.status(200).json({ message: 'Travel order marked as completed', travelOrder: updated });
  } catch (error) {
    console.error('Error completing travel order:', error);
    res.status(500).json({ message: 'Failed to complete travel order' });
  }
});

// Delete travel order (Staff - own pending only, Admin - any)
app.delete('/travel-orders/:travelOrderId', verifyToken, async (req, res) => {
  try {
    const travelOrder = await TravelOrder.findOne({ travelOrderId: req.params.travelOrderId });
    if (!travelOrder) {
      return res.status(404).json({ message: 'Travel order not found' });
    }

    // Staff can only delete their own pending orders
    if (req.user.role === 'staff') {
      if (req.user.staffId !== travelOrder.staffId) {
        return res.status(403).json({ message: 'Access denied' });
      }
      if (travelOrder.status !== 'Pending') {
        return res.status(400).json({ message: 'Can only delete pending orders' });
      }
    }

    const deleted = await TravelOrder.findOneAndDelete({ travelOrderId: req.params.travelOrderId });
    res.status(200).json({ message: 'Travel order deleted successfully' });
  } catch (error) {
    console.error('Error deleting travel order:', error);
    res.status(500).json({ message: 'Failed to delete travel order' });
  }
});

// ==================== OVERTIME ROUTES ====================

// Create overtime request
app.post('/overtimes', verifyToken, async (req, res) => {
  const {
    overtimeId,
    staffId,
    firstName,
    lastName,
    middleName,
    office,
    position,
    filingDate,
    purposeOfOvertime,
    inclusiveDateStart,
    inclusiveDateEnd,
    officeStaffPersonnel,
    departmentHeadOfficer,
    staffDetails,
  } = req.body;

  // Staff can only file overtime for themselves
  if (req.user.role === 'staff' && req.user.staffId !== staffId) {
    return res.status(403).json({ message: 'You can only file overtime requests for yourself' });
  }

  if (!overtimeId || !staffId || !purposeOfOvertime || !inclusiveDateStart || !inclusiveDateEnd) {
    return res.status(400).json({ message: 'All required fields must be provided' });
  }

  try {
    const existing = await Overtime.findOne({ overtimeId });
    if (existing) {
      return res.status(409).json({ message: 'Overtime with this ID already exists' });
    }

    const staff = await Staff.findOne({ id: staffId }).select('department role');
    const staffDepartment = staff?.department || req.user.department || null;
    const filerRole = normalizeRole(staff?.role || req.user.role);
    const nextApprovalStage = filerRole === ROLES.STAFF ? 'HeadOfficer' : 'Admin';

    const newOvertime = new Overtime({
      overtimeId,
      staffId,
      staffDepartment,
      firstName,
      lastName,
      middleName,
      staffName: `${firstName} ${lastName}`,
      office,
      position,
      filingDate: new Date(filingDate),
      purposeOfOvertime,
      inclusiveDateStart: new Date(inclusiveDateStart),
      inclusiveDateEnd: new Date(inclusiveDateEnd),
      officeStaffPersonnel: Boolean(officeStaffPersonnel),
      departmentHeadOfficer: Boolean(departmentHeadOfficer),
      staffDetails: Array.isArray(staffDetails) ? staffDetails : [],
      status: 'Pending',
      approvalStage: nextApprovalStage,
    });

    await newOvertime.save();
    res.status(201).json({ message: 'Overtime request filed successfully', overtime: newOvertime });
  } catch (error) {
    console.error('Error filing overtime request:', error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ message: error.message });
    }
    res.status(500).json({ message: 'Failed to file overtime request' });
  }
});

// Get all overtime requests (approvers only)
app.get('/overtimes', verifyToken, async (req, res) => {
  try {
    const userRole = normalizeRole(req.user.role);
    const userDepartment = req.user.department;
    const canView = [ROLES.SUPER_ADMIN, ROLES.ADMIN_HR, ROLES.HEAD_OFFICER, ROLES.MUNICIPAL_BUDGET_OFFICER].includes(userRole);

    if (!canView) {
      return res.status(403).json({ message: 'Access denied. Only approvers can view overtime requests.' });
    }

    const status = req.query.status;
    const filter = status ? { status } : {};

    if (userRole === ROLES.HEAD_OFFICER) {
      filter.staffDepartment = userDepartment;
      if (status === 'Pending') {
        filter.approvalStage = { $in: ['HeadOfficer', 'pending', 'head_requisitioning_office'] };
      }
    } else if (userRole === ROLES.MUNICIPAL_BUDGET_OFFICER) {
      filter.status = 'Pending';
      filter.approvalStage = { $in: ['BudgetOfficer', 'budget_officer'] };
    } else if (status === 'Pending') {
      filter.approvalStage = { $in: ['Admin', 'admin', null] };
    }

    const overtimes = await Overtime.find(filter).sort({ createdAt: -1 });
    res.json(overtimes);
  } catch (error) {
    console.error('Error fetching overtime requests:', error);
    res.status(500).json({ message: 'Failed to retrieve overtime requests' });
  }
});

// Get overtime requests by staff
app.get('/overtimes/staff/:staffId', verifyToken, async (req, res) => {
  try {
    const userRole = normalizeRole(req.user.role);
    // Staff can only view their own requests
    if (userRole === ROLES.STAFF && req.user.staffId !== req.params.staffId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const overtimes = await Overtime.find({ staffId: req.params.staffId }).sort({ createdAt: -1 });
    res.json(overtimes);
  } catch (error) {
    console.error('Error fetching staff overtime requests:', error);
    res.status(500).json({ message: 'Failed to retrieve overtime requests' });
  }
});

// Get single overtime request
app.get('/overtime/:overtimeId', verifyToken, async (req, res) => {
  try {
    const overtime = await Overtime.findOne({ overtimeId: req.params.overtimeId });
    if (!overtime) {
      return res.status(404).json({ message: 'Overtime request not found' });
    }

    // Staff can only view their own requests
    if (req.user.role === 'staff' && req.user.staffId !== overtime.staffId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    res.json(overtime);
  } catch (error) {
    console.error('Error fetching overtime request:', error);
    res.status(500).json({ message: 'Failed to retrieve overtime request' });
  }
});

// Update overtime request
app.put('/overtimes/:overtimeId', verifyToken, async (req, res) => {
  try {
    const overtime = await Overtime.findOne({ overtimeId: req.params.overtimeId });
    if (!overtime) {
      return res.status(404).json({ message: 'Overtime request not found' });
    }

    // Staff can only update their own pending requests
    if (req.user.role === 'staff') {
      if (req.user.staffId !== overtime.staffId) {
        return res.status(403).json({ message: 'Access denied' });
      }
    }

    const canEditStatuses = ['Pending', 'For Revision', 'Under Review'];
    if (!canEditStatuses.includes(overtime.status)) {
      return res.status(400).json({ message: 'Cannot update a processed overtime request' });
    }

    if (overtime.status === 'Pending' && ['BudgetOfficer', 'budget_officer', 'Admin', 'admin'].includes(overtime.approvalStage)) {
      return res.status(400).json({ message: 'Cannot update an overtime request that is already under reviewer approval' });
    }

    const {
      purposeOfOvertime,
      inclusiveDateStart,
      inclusiveDateEnd,
      officeStaffPersonnel,
      departmentHeadOfficer,
      staffDetails,
      filingDate,
    } = req.body;

    if (purposeOfOvertime) overtime.purposeOfOvertime = purposeOfOvertime;
    if (inclusiveDateStart) overtime.inclusiveDateStart = new Date(inclusiveDateStart);
    if (inclusiveDateEnd) overtime.inclusiveDateEnd = new Date(inclusiveDateEnd);
    if (officeStaffPersonnel !== undefined) overtime.officeStaffPersonnel = Boolean(officeStaffPersonnel);
    if (departmentHeadOfficer !== undefined) overtime.departmentHeadOfficer = Boolean(departmentHeadOfficer);
    if (Array.isArray(staffDetails)) overtime.staffDetails = staffDetails;
    if (filingDate) overtime.filingDate = new Date(filingDate);

    const filingStaff = await Staff.findOne({ id: overtime.staffId }).select('role');
    const filerRole = normalizeRole(filingStaff?.role);
    const nextApprovalStage = filerRole === ROLES.STAFF
      ? 'HeadOfficer'
      : filerRole === ROLES.HEAD_OFFICER
        ? 'BudgetOfficer'
        : filerRole === ROLES.MUNICIPAL_BUDGET_OFFICER
          ? 'Admin'
          : 'Admin';

    overtime.status = 'Pending';
    overtime.approvalStage = nextApprovalStage;
    overtime.headOfficerApprovedBy = null;
    overtime.headOfficerApprovalDate = null;
    overtime.headOfficerRemarks = null;
    overtime.approvedBy = null;
    overtime.approvalDate = null;
    overtime.approvalRemarks = null;
    overtime.disapprovedBy = null;
    overtime.disapprovalDate = null;
    overtime.revisionRequestedBy = null;
    overtime.revisionRequestedByRole = null;
    overtime.revisionRequestedAt = null;
    overtime.revisionComment = null;

    // Reset legacy multi-step tracking to avoid stale states on resubmission.
    overtime.headRequisitioningOfficerApproval = {
      status: 'Pending',
      approvedBy: null,
      approvalDate: null,
      remarks: '',
    };
    overtime.budgetOfficerApproval = {
      status: 'Pending',
      approvedBy: null,
      approvalDate: null,
      remarks: '',
    };
    overtime.adminApproval = {
      status: 'Pending',
      approvedBy: null,
      approvalDate: null,
      remarks: '',
    };
    overtime.updatedAt = new Date();

    await overtime.save();
    res.json({ message: 'Overtime request updated successfully', overtime });
  } catch (error) {
    console.error('Error updating overtime request:', error);
    res.status(500).json({ message: 'Failed to update overtime request' });
  }
});

app.patch('/overtimes/:overtimeId/approve', verifyToken, async (req, res) => {
  try {
    const userRole = normalizeRole(req.user.role);
    const overtime = await Overtime.findOne({ overtimeId: req.params.overtimeId });
    
    if (!overtime) {
      return res.status(404).json({ message: 'Overtime request not found' });
    }

    const { approvedBy, remarks } = req.body;
    const now = new Date();
    const approverName = approvedBy || req.user.name || req.user.email;

    if (!approverName) {
      return res.status(400).json({ message: 'Approver name is required' });
    }

    if (overtime.status !== 'Pending') {
      return res.status(400).json({ message: 'Overtime request is already processed' });
    }

    const currentStage = ['HeadOfficer', 'pending', 'head_requisitioning_office'].includes(overtime.approvalStage)
      ? 'HeadOfficer'
      : ['BudgetOfficer', 'budget_officer'].includes(overtime.approvalStage)
        ? 'BudgetOfficer'
        : ['Admin', 'admin', null, undefined].includes(overtime.approvalStage)
          ? 'Admin'
          : 'Completed';

    if (currentStage === 'HeadOfficer' && userRole !== ROLES.HEAD_OFFICER) {
      return res.status(403).json({ message: 'Only Head Officer can approve requests at this stage' });
    }

    if (currentStage === 'BudgetOfficer' && userRole !== ROLES.MUNICIPAL_BUDGET_OFFICER) {
      return res.status(403).json({ message: 'Only Budget Officer can approve requests at this stage' });
    }

    if (currentStage === 'Admin' && ![ROLES.SUPER_ADMIN, ROLES.ADMIN_HR].includes(userRole)) {
      return res.status(403).json({ message: 'Only Admin can approve requests at this stage' });
    }

    if (userRole === ROLES.HEAD_OFFICER) {
      if (overtime.staffDepartment !== req.user.department) {
        return res.status(403).json({ message: 'You can only approve overtime requests from your department' });
      }

      if (!['HeadOfficer', 'pending', 'head_requisitioning_office'].includes(overtime.approvalStage)) {
        return res.status(400).json({ message: 'Overtime request is already forwarded for final review' });
      }

      overtime.approvalStage = 'BudgetOfficer';
      overtime.status = 'Pending';
      overtime.headOfficerApprovedBy = approverName;
      overtime.headOfficerApprovalDate = now;
      overtime.headOfficerRemarks = remarks || '';
      overtime.approvedBy = null;
      overtime.approvalDate = null;
      overtime.approvalRemarks = null;

      overtime.headRequisitioningOfficerApproval = {
        status: 'Approved',
        approvedBy: approverName,
        approvalDate: now,
        remarks: remarks || '',
      };

      overtime.budgetOfficerApproval = {
        status: 'Pending',
        approvedBy: null,
        approvalDate: null,
        remarks: '',
      };

      overtime.adminApproval = {
        status: 'Pending',
        approvedBy: null,
        approvalDate: null,
        remarks: '',
      };

      overtime.updatedAt = new Date();
      await overtime.save();

      await createSystemLogEntry({
        module: 'Overtime Management',
        action: 'Approve',
        user: req.user.name || req.user.email || 'System',
        userId: req.user.staffId,
        description: `Overtime approved at Head Officer stage: ${overtime.overtimeId}`,
        ipAddress: getRequestIp(req),
        status: 'Success',
        metadata: {
          overtimeId: overtime.overtimeId,
          stage: 'HeadOfficer',
          approver: approverName,
        },
      });

      return res.json({ message: 'Overtime request approved by Head Officer and forwarded to Budget Officer', overtime });
    }

    if (userRole === ROLES.MUNICIPAL_BUDGET_OFFICER) {
      if (!['BudgetOfficer', 'budget_officer'].includes(overtime.approvalStage)) {
        return res.status(400).json({ message: 'Overtime request must be approved by the Head Officer first' });
      }

      overtime.status = 'Pending';
      overtime.approvalStage = 'Admin';
      overtime.budgetOfficerApproval = {
        status: 'Approved',
        approvedBy: approverName,
        approvalDate: now,
        remarks: remarks || '',
      };
      overtime.approvedBy = null;
      overtime.approvalDate = null;
      overtime.approvalRemarks = null;
      overtime.adminApproval = {
        status: 'Pending',
        approvedBy: null,
        approvalDate: null,
        remarks: '',
      };
      overtime.updatedAt = new Date();
      await overtime.save();

      await createSystemLogEntry({
        module: 'Overtime Management',
        action: 'Approve',
        user: req.user.name || req.user.email || 'System',
        userId: req.user.staffId,
        description: `Overtime approved at Budget Officer stage: ${overtime.overtimeId}`,
        ipAddress: getRequestIp(req),
        status: 'Success',
        metadata: {
          overtimeId: overtime.overtimeId,
          stage: 'BudgetOfficer',
          approver: approverName,
        },
      });

      return res.json({ message: 'Overtime request approved by Budget Officer and forwarded to Admin', overtime });
    }

    if ([ROLES.SUPER_ADMIN, ROLES.ADMIN_HR].includes(userRole)) {
      if (overtime.approvalStage && !['Admin', 'admin'].includes(overtime.approvalStage)) {
        return res.status(400).json({ message: 'Overtime request must be approved by Head Officer and Budget Officer first' });
      }

      const filingStaff = await Staff.findOne({ id: overtime.staffId }).select('role');
      const filerRole = normalizeRole(filingStaff?.role);
      const headOfficerApproved = Boolean(overtime.headOfficerApprovalDate) || overtime.headRequisitioningOfficerApproval?.status === 'Approved';
      const budgetOfficerApproved = overtime.budgetOfficerApproval?.status === 'Approved';
      if ((filerRole === ROLES.STAFF || filerRole === ROLES.HEAD_OFFICER) && (!headOfficerApproved || !budgetOfficerApproved)) {
        return res.status(400).json({ message: 'Overtime request must be approved by Head Officer and Budget Officer first' });
      }

      overtime.status = 'Approved';
      overtime.approvedBy = approverName;
      overtime.approvalDate = now;
      overtime.approvalRemarks = remarks || '';
      overtime.adminApproval = {
        status: 'Approved',
        approvedBy: approverName,
        approvalDate: now,
        remarks: remarks || '',
      };
      overtime.approvalStage = 'Completed';
      overtime.updatedAt = new Date();
      await overtime.save();

      await createSystemLogEntry({
        module: 'Overtime Management',
        action: 'Approve',
        user: req.user.name || req.user.email || 'System',
        userId: req.user.staffId,
        description: `Overtime approved: ${overtime.overtimeId}`,
        ipAddress: getRequestIp(req),
        status: 'Success',
        metadata: {
          overtimeId: overtime.overtimeId,
          stage: 'Admin',
          approver: approverName,
        },
      });

      return res.json({ message: 'Overtime request approved', overtime });
    } else {
      return res.status(403).json({ message: 'Only authorized approvers can approve overtime requests' });
    }
  } catch (error) {
    console.error('Error approving overtime request:', error);
    res.status(500).json({ message: 'Failed to approve overtime request' });
  }
});

app.patch('/overtimes/:overtimeId/disapprove', verifyToken, async (req, res) => {
  try {
    const userRole = normalizeRole(req.user.role);
    const overtime = await Overtime.findOne({ overtimeId: req.params.overtimeId });
    
    if (!overtime) {
      return res.status(404).json({ message: 'Overtime request not found' });
    }

    const { approvedBy, remarks } = req.body;

    if (!remarks || !remarks.trim()) {
      return res.status(400).json({ message: 'Remarks are required for disapproval' });
    }

    const approverName = approvedBy || req.user.name || req.user.email;
    if (!approverName) {
      return res.status(400).json({ message: 'Disapprover name is required' });
    }

    const now = new Date();

    if (overtime.status !== 'Pending') {
      return res.status(400).json({ message: 'Overtime request is already processed' });
    }

    if (userRole === ROLES.HEAD_OFFICER) {
      if (overtime.staffDepartment !== req.user.department) {
        return res.status(403).json({ message: 'You can only disapprove overtime requests from your department' });
      }

      if (!['HeadOfficer', 'pending', 'head_requisitioning_office'].includes(overtime.approvalStage)) {
        return res.status(400).json({ message: 'Overtime request is already forwarded for final review' });
      }

      overtime.headRequisitioningOfficerApproval = {
        status: 'Disapproved',
        approvedBy: approverName,
        approvalDate: now,
        remarks,
      };
    } else if (userRole === ROLES.MUNICIPAL_BUDGET_OFFICER) {
      if (overtime.approvalStage && !['BudgetOfficer', 'budget_officer'].includes(overtime.approvalStage)) {
        return res.status(400).json({ message: 'Overtime request must be approved by the Head Officer first' });
      }

      overtime.budgetOfficerApproval = {
        status: 'Disapproved',
        approvedBy: approverName,
        approvalDate: now,
        remarks,
      };
    } else if ([ROLES.SUPER_ADMIN, ROLES.ADMIN_HR].includes(userRole)) {
      if (overtime.approvalStage && !['Admin', 'admin'].includes(overtime.approvalStage)) {
        return res.status(400).json({ message: 'Overtime request must be approved by Head Officer and Budget Officer first' });
      }

      overtime.adminApproval = {
        status: 'Disapproved',
        approvedBy: approverName,
        approvalDate: now,
        remarks,
      };
    } else {
      return res.status(403).json({ message: 'Only authorized approvers can disapprove overtime requests' });
    }

    overtime.status = 'Disapproved';
    overtime.approvedBy = approverName;
    overtime.approvalDate = now;
    overtime.approvalRemarks = remarks;
    overtime.approvalStage = 'Completed';
    overtime.disapprovedBy = approverName;
    overtime.disapprovalDate = now;

    overtime.updatedAt = new Date();
    await overtime.save();

    await createSystemLogEntry({
      module: 'Overtime Management',
      action: 'Disapprove',
      user: req.user.name || req.user.email || 'System',
      userId: req.user.staffId,
      description: `Overtime disapproved: ${overtime.overtimeId}`,
      ipAddress: getRequestIp(req),
      status: 'Success',
      metadata: {
        overtimeId: overtime.overtimeId,
        stage: userRole === ROLES.HEAD_OFFICER ? 'HeadOfficer' : userRole === ROLES.MUNICIPAL_BUDGET_OFFICER ? 'BudgetOfficer' : 'Admin',
        approver: approverName,
      },
    });
    
    res.json({ message: 'Overtime request disapproved successfully', overtime });
  } catch (error) {
    console.error('Error disapproving overtime request:', error);
    res.status(500).json({ message: 'Failed to disapprove overtime request' });
  }
});

app.patch('/overtimes/:overtimeId/revise', verifyToken, async (req, res) => {
  try {
    const userRole = normalizeRole(req.user.role);
    const overtime = await Overtime.findOne({ overtimeId: req.params.overtimeId });
    
    if (!overtime) {
      return res.status(404).json({ message: 'Overtime request not found' });
    }

    const { approvedBy, remarks } = req.body;

    if (!approvedBy) {
      return res.status(400).json({ message: 'Approver name is required' });
    }

    if (!remarks || !String(remarks).trim()) {
      return res.status(400).json({ message: 'Revision comment is required' });
    }

    if (overtime.status !== 'Pending') {
      return res.status(400).json({ message: 'Only pending overtime requests can be returned for revision' });
    }

    if (userRole === ROLES.HEAD_OFFICER) {
      if (overtime.staffDepartment !== req.user.department) {
        return res.status(403).json({ message: 'You can only review overtime requests from your department' });
      }

      if (!['HeadOfficer', 'pending', 'head_requisitioning_office'].includes(overtime.approvalStage)) {
        return res.status(400).json({ message: 'Overtime request is already forwarded for final review' });
      }
    } else if (userRole === ROLES.MUNICIPAL_BUDGET_OFFICER) {
      if (overtime.approvalStage && !['BudgetOfficer', 'budget_officer'].includes(overtime.approvalStage)) {
        return res.status(400).json({ message: 'Overtime request must be approved by the Head Officer first' });
      }
    } else if ([ROLES.SUPER_ADMIN, ROLES.ADMIN_HR].includes(userRole)) {
      if (overtime.approvalStage && !['Admin', 'admin'].includes(overtime.approvalStage)) {
        return res.status(400).json({ message: 'Overtime request must be approved by Head Officer and Budget Officer first' });
      }
    } else {
      return res.status(403).json({ message: 'Only authorized approvers can request revisions' });
    }

    const filingStaff = await Staff.findOne({ id: overtime.staffId }).select('role');
    const filerRole = normalizeRole(filingStaff?.role);
    const nextApprovalStage = filerRole === ROLES.STAFF
      ? 'HeadOfficer'
      : filerRole === ROLES.HEAD_OFFICER
        ? 'BudgetOfficer'
        : filerRole === ROLES.MUNICIPAL_BUDGET_OFFICER
          ? 'Admin'
          : 'Admin';

    const now = new Date();

    overtime.status = 'For Revision';
    overtime.approvalStage = nextApprovalStage;
    overtime.revisionRequestedBy = approvedBy;
    overtime.revisionRequestedByRole = userRole;
    overtime.revisionRequestedAt = now;
    overtime.revisionComment = remarks;
    overtime.approvalRemarks = remarks;
    overtime.updatedAt = now;
    await overtime.save();

    res.json({ message: 'Overtime request sent for revision successfully', overtime });
  } catch (error) {
    console.error('Error revising overtime request:', error);
    res.status(500).json({ message: 'Failed to send for revision' });
  }
});

// Delete overtime request
app.delete('/overtimes/:overtimeId', verifyToken, async (req, res) => {
  try {
    const overtime = await Overtime.findOne({ overtimeId: req.params.overtimeId });
    if (!overtime) {
      return res.status(404).json({ message: 'Overtime request not found' });
    }

    // Staff can only delete their own pending requests
    if (req.user.role === 'staff') {
      if (req.user.staffId !== overtime.staffId) {
        return res.status(403).json({ message: 'Access denied' });
      }
      if (overtime.status !== 'Pending') {
        return res.status(400).json({ message: 'Can only delete pending requests' });
      }
    }

    const deleted = await Overtime.findOneAndDelete({ overtimeId: req.params.overtimeId });
    res.status(200).json({ message: 'Overtime request deleted successfully' });
  } catch (error) {
    console.error('Error deleting overtime request:', error);
    res.status(500).json({ message: 'Failed to delete overtime request' });
  }
});

// ==================== COE (CERTIFICATE OF EMPLOYMENT) ROUTES ====================

const addCOEStaffDetails = async (coes) => {
  const staffIds = [...new Set(coes.map((coe) => coe.staffId).filter(Boolean))];
  if (!staffIds.length) return coes.map((coe) => ({ ...coe, staffDetails: {} }));

  const staffRecords = await Staff.find({ id: { $in: staffIds } })
    .select('id address department position employmentStatus lengthOfService monthlyBasicSalary peraRata grossSalary pendingAdministrativeCase pendingCriminalCase')
    .lean();
  const staffById = new Map(staffRecords.map((staff) => [staff.id, staff]));

  return coes.map((coe) => ({
    ...coe,
    staffDetails: staffById.get(coe.staffId) || {},
  }));
};

// Create COE request
app.post('/coes', verifyToken, uploadPaymentProof.single('proofOfPayment'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'Proof of payment is required. Upload a PDF, JPG, or PNG file up to 10 MB.' });
  }

  const {
    coeId,
    staffId,
    fullName,
    purpose,
    dateOfApplication,
    positionTitle,
    office,
    address,
    employmentStatus,
    lengthOfService,
    monthlySalary,
    peraRata,
    grossSalary,
    pendingAdministrativeCase,
    pendingCriminalCase,
    periodFrom,
    periodTo,
    numberOfCopies,
    remarks,
  } = req.body;

  // Staff can only file COE request for themselves
  if (req.user.role === 'staff' && req.user.staffId !== staffId) {
    removeUploadedPaymentProof(req.file);
    return res.status(403).json({ message: 'You can only file COE requests for yourself' });
  }

  if (!coeId || !staffId || !fullName || !purpose || !dateOfApplication) {
    removeUploadedPaymentProof(req.file);
    return res.status(400).json({ message: 'All required fields must be provided' });
  }

  try {
    const existing = await COE.findOne({ coeId });
    if (existing) {
      removeUploadedPaymentProof(req.file);
      return res.status(409).json({ message: 'COE with this ID already exists' });
    }

    const staff = await Staff.findOne({ id: staffId }).select('department name');
    const staffDepartment = staff?.department || req.user.department || null;
    const staffName = staff?.name || fullName || '';

    const newCOE = new COE({
      coeId,
      staffId,
      staffName,
      staffDepartment,
      fullName,
      purpose,
      dateOfApplication: new Date(dateOfApplication),
      positionTitle,
      office,
      monthlySalary: monthlySalary ? Number(monthlySalary) : null,
      address: address || '',
      employmentStatus: employmentStatus || '',
      lengthOfService: lengthOfService || '',
      peraRata: peraRata || '',
      grossSalary: grossSalary == null || grossSalary === '' ? null : Number(grossSalary),
      pendingAdministrativeCase: pendingAdministrativeCase === true || pendingAdministrativeCase === 'true'
        ? true
        : (pendingAdministrativeCase === false || pendingAdministrativeCase === 'false' ? false : null),
      pendingCriminalCase: pendingCriminalCase === true || pendingCriminalCase === 'true'
        ? true
        : (pendingCriminalCase === false || pendingCriminalCase === 'false' ? false : null),
      periodFrom: periodFrom ? new Date(periodFrom) : null,
      periodTo: periodTo ? new Date(periodTo) : null,
      numberOfCopies: numberOfCopies || 1,
      remarks: remarks || '',
      paymentProof: getPaymentProofMetadata(req.file),
      status: 'Pending',
    });

    await newCOE.save();

    await createSystemLogEntry({
      module: 'COE Request',
      action: 'Create',
      user: req.user.name || req.user.email || 'System',
      userId: req.user.staffId,
      description: `COE request created: ${coeId} by ${staffName}`,
      ipAddress: getRequestIp(req),
      status: 'Success',
      metadata: { coeId, staffId, staffName },
    });

    res.status(201).json({ message: 'COE request created successfully', coe: newCOE });
  } catch (error) {
    removeUploadedPaymentProof(req.file);
    console.error('Error creating COE request:', error);
    res.status(500).json({ message: 'Failed to create COE request' });
  }
});

// Get all COE requests (Admin only)
app.get('/coes', verifyToken, requireRole([ROLES.SUPER_ADMIN, ROLES.ADMIN_HR, ROLES.HEAD_OFFICER]), async (req, res) => {
  const { status } = req.query;
  try {
    const managedStaff = await getDepartmentStaff(req.user);
    const query = {
      ...(status && status !== '' ? { status } : {}),
      ...(managedStaff ? { staffId: { $in: managedStaff.map((staff) => staff.id).filter(Boolean) } } : {}),
    };
    const coes = await COE.find(query)
      .sort({ createdAt: -1 })
      .lean();
    res.status(200).json(await addCOEStaffDetails(coes));
  } catch (error) {
    console.error('Error fetching COE requests:', error);
    res.status(500).json({ message: 'Failed to fetch COE requests' });
  }
});

// Get COE requests for a specific staff member
app.get('/coes/staff/:staffId', verifyToken, async (req, res) => {
  const { staffId } = req.params;

  // Staff can only view their own requests
  if (normalizeRole(req.user.role) === ROLES.STAFF && req.user.staffId !== staffId) {
    return res.status(403).json({ message: 'You can only view your own COE requests' });
  }
  if (isDepartmentStaffManager(req.user) && !(await canManageStaffId(req.user, staffId))) {
    return res.status(403).json({ message: 'You can only view COE requests for staff in your department.' });
  }

  try {
    const coes = await COE.find({ staffId })
      .sort({ createdAt: -1 })
      .lean();
    res.status(200).json(await addCOEStaffDetails(coes));
  } catch (error) {
    console.error('Error fetching COE requests:', error);
    res.status(500).json({ message: 'Failed to fetch COE requests' });
  }
});

// Approve COE request (Admin only)
app.patch('/coes/:coeId/approve', verifyToken, requireRole([ROLES.SUPER_ADMIN, ROLES.ADMIN_HR, ROLES.HEAD_OFFICER]), async (req, res) => {
  const { approvalRemarks } = req.body;

  try {
    const coe = await COE.findOne({ coeId: req.params.coeId });

    if (!coe) {
      return res.status(404).json({ message: 'COE request not found' });
    }
    if (!(await canManageStaffId(req.user, coe.staffId))) {
      return res.status(403).json({ message: 'You can only review COE requests for staff in your department.' });
    }

    if (coe.status !== 'Pending') {
      return res.status(400).json({ message: 'COE request is already processed' });
    }

    coe.status = 'Approved';
    coe.approvedBy = req.user.name || req.user.email || 'Admin';
    coe.approvalDate = Date.now();
    coe.approvalRemarks = approvalRemarks || '';
    coe.updatedAt = Date.now();
    await coe.save();

    await createSystemLogEntry({
      module: 'COE Request',
      action: 'Approve',
      user: req.user.name || req.user.email || 'System',
      userId: req.user.staffId,
      description: `COE request approved: ${coe.coeId}. Employee should fetch at HR Office.`,
      ipAddress: getRequestIp(req),
      status: 'Success',
      metadata: {
        coeId: coe.coeId,
        staffId: coe.staffId,
        approver: req.user.name || req.user.email,
      },
    });

    res.status(200).json({ 
      message: 'COE request approved. Employee notified to fetch Certificate of Employment at HR Office.',
      coe 
    });
  } catch (error) {
    console.error('Error approving COE request:', error);
    res.status(500).json({ message: 'Failed to approve COE request' });
  }
});

// Disapprove COE request (Admin only)
app.patch('/coes/:coeId/disapprove', verifyToken, requireRole([ROLES.SUPER_ADMIN, ROLES.ADMIN_HR, ROLES.HEAD_OFFICER]), async (req, res) => {
  const { disapprovalRemarks } = req.body;

  try {
    const coe = await COE.findOne({ coeId: req.params.coeId });

    if (!coe) {
      return res.status(404).json({ message: 'COE request not found' });
    }
    if (!(await canManageStaffId(req.user, coe.staffId))) {
      return res.status(403).json({ message: 'You can only review COE requests for staff in your department.' });
    }

    if (coe.status !== 'Pending') {
      return res.status(400).json({ message: 'COE request is already processed' });
    }

    coe.status = 'Disapproved';
    coe.disapprovedBy = req.user.name || req.user.email || 'Admin';
    coe.disapprovalDate = Date.now();
    coe.disapprovalRemarks = disapprovalRemarks || '';
    coe.updatedAt = Date.now();
    await coe.save();

    await createSystemLogEntry({
      module: 'COE Request',
      action: 'Disapprove',
      user: req.user.name || req.user.email || 'System',
      userId: req.user.staffId,
      description: `COE request disapproved: ${coe.coeId}`,
      ipAddress: getRequestIp(req),
      status: 'Success',
      metadata: {
        coeId: coe.coeId,
        staffId: coe.staffId,
        disapprover: req.user.name || req.user.email,
      },
    });

    res.status(200).json({ message: 'COE request disapproved', coe });
  } catch (error) {
    console.error('Error disapproving COE request:', error);
    res.status(500).json({ message: 'Failed to disapprove COE request' });
  }
});

// Request revision for COE (Admin only)
app.patch('/coes/:coeId/revise', verifyToken, requireRole([ROLES.SUPER_ADMIN, ROLES.ADMIN_HR, ROLES.HEAD_OFFICER]), async (req, res) => {
  const { revisionComment } = req.body;

  if (!revisionComment) {
    return res.status(400).json({ message: 'Revision comment is required' });
  }

  try {
    const coe = await COE.findOne({ coeId: req.params.coeId });

    if (!coe) {
      return res.status(404).json({ message: 'COE request not found' });
    }
    if (!(await canManageStaffId(req.user, coe.staffId))) {
      return res.status(403).json({ message: 'You can only review COE requests for staff in your department.' });
    }

    if (coe.status !== 'Pending') {
      return res.status(400).json({ message: 'Only pending COE requests can be sent for revision' });
    }

    coe.status = 'For Revision';
    coe.revisionRequestedBy = req.user.name || req.user.email || 'Admin';
    coe.revisionRequestedByRole = req.user.role;
    coe.revisionRequestedAt = Date.now();
    coe.revisionComment = revisionComment;
    coe.updatedAt = Date.now();
    await coe.save();

    await createSystemLogEntry({
      module: 'COE Request',
      action: 'Revise',
      user: req.user.name || req.user.email || 'System',
      userId: req.user.staffId,
      description: `COE request sent for revision: ${coe.coeId}`,
      ipAddress: getRequestIp(req),
      status: 'Success',
      metadata: {
        coeId: coe.coeId,
        staffId: coe.staffId,
        revisionComment,
      },
    });

    res.status(200).json({ message: 'COE request sent for revision', coe });
  } catch (error) {
    console.error('Error requesting revision for COE:', error);
    res.status(500).json({ message: 'Failed to request revision for COE' });
  }
});

// Delete COE request
app.delete('/coes/:coeId', verifyToken, async (req, res) => {
  try {
    const coe = await COE.findOne({ coeId: req.params.coeId });

    if (!coe) {
      return res.status(404).json({ message: 'COE request not found' });
    }

    const userRole = normalizeRole(req.user.role);
    const isDepartmentManager = isDepartmentStaffManager(req.user);
    if (isDepartmentManager && !(await canManageStaffId(req.user, coe.staffId))) {
      return res.status(403).json({ message: 'You can only manage COE requests for staff in your department.' });
    }

    // Staff can only delete their own pending requests
    if (userRole === ROLES.STAFF) {
      if (req.user.staffId !== coe.staffId) {
        return res.status(403).json({ message: 'Access denied' });
      }
      if (coe.status !== 'Pending') {
        return res.status(400).json({ message: 'Can only delete pending requests' });
      }
    }

    // Admin can delete any request (preferably only Pending or For Revision)
    if (!isDepartmentManager) {
      if (req.user.staffId !== coe.staffId || coe.status !== 'Pending') {
        return res.status(403).json({ message: 'Access denied' });
      }
    }

    await COE.findOneAndDelete({ coeId: req.params.coeId });
    if (coe.paymentProof?.storageName) {
      const proofPath = path.join(PAYMENT_PROOF_UPLOAD_DIR, path.basename(coe.paymentProof.storageName));
      if (fs.existsSync(proofPath)) fs.unlinkSync(proofPath);
    }

    await createSystemLogEntry({
      module: 'COE Request',
      action: 'Delete',
      user: req.user.name || req.user.email || 'System',
      userId: req.user.staffId,
      description: `COE request deleted: ${coe.coeId}`,
      ipAddress: getRequestIp(req),
      status: 'Success',
      metadata: { coeId: coe.coeId, staffId: coe.staffId },
    });

    res.status(200).json({ message: 'COE request deleted successfully' });
  } catch (error) {
    console.error('Error deleting COE request:', error);
    res.status(500).json({ message: 'Failed to delete COE request' });
  }
});

// ==================== CERTIFICATE OF NO PENDING CASE REQUEST ROUTES ====================

app.post('/no-pendency-requests', verifyToken, uploadPaymentProof.single('proofOfPayment'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'Proof of payment is required. Upload a PDF, JPG, or PNG file up to 10 MB.' });
  }

  const staffId = req.user.staffId;
  const { fullName, position, pendingCase, dateOfApplication } = req.body;

  if (
    !staffId ||
    typeof fullName !== 'string' ||
    !fullName.trim() ||
    typeof position !== 'string' ||
    !position.trim() ||
    !['Yes', 'No'].includes(pendingCase) ||
    !dateOfApplication
  ) {
    removeUploadedPaymentProof(req.file);
    return res.status(400).json({ message: 'Full name, position, a Yes or No pending-case answer, and application date are required.' });
  }

  const applicationDate = new Date(dateOfApplication);
  if (Number.isNaN(applicationDate.getTime())) {
    removeUploadedPaymentProof(req.file);
    return res.status(400).json({ message: 'A valid application date is required.' });
  }

  try {
    const staff = await Staff.findOne({ id: staffId }).select('name department').lean();
    if (!staff) {
      removeUploadedPaymentProof(req.file);
      return res.status(404).json({ message: 'Staff account not found.' });
    }

    const request = await NoPendencyRequest.create({
      requestId: new mongoose.Types.ObjectId().toString(),
      staffId,
      staffName: staff.name || fullName.trim(),
      staffDepartment: staff.department || '',
      fullName: fullName.trim(),
      position: position.trim(),
      pendingCase,
      dateOfApplication: applicationDate,
      paymentProof: getPaymentProofMetadata(req.file),
    });

    await createSystemLogEntry({
      module: 'Certificate of No Pending Case',
      action: 'Create',
      user: req.user.name || req.user.email || 'System',
      userId: staffId,
      description: `Certificate of No Pending Case request submitted by ${request.staffName}`,
      ipAddress: getRequestIp(req),
      status: 'Success',
      metadata: { requestId: request.requestId, staffId },
    });

    res.status(201).json({ message: 'Certificate request submitted successfully.', request });
  } catch (error) {
    removeUploadedPaymentProof(req.file);
    console.error('Error creating no-pendency certificate request:', error);
    res.status(500).json({ message: 'Failed to submit certificate request.' });
  }
});

app.get('/no-pendency-requests', verifyToken, requireRole([ROLES.SUPER_ADMIN, ROLES.ADMIN_HR, ROLES.HEAD_OFFICER]), async (req, res) => {
  const { status } = req.query;
  try {
    const managedStaff = await getDepartmentStaff(req.user);
    const query = {
      ...(status && status !== '' ? { status } : {}),
      ...(managedStaff ? { staffId: { $in: managedStaff.map((staff) => staff.id).filter(Boolean) } } : {}),
    };
    const requests = await NoPendencyRequest.find(query).sort({ createdAt: -1 }).lean();
    res.status(200).json(requests);
  } catch (error) {
    console.error('Error fetching no-pendency certificate requests:', error);
    res.status(500).json({ message: 'Failed to fetch certificate requests.' });
  }
});

app.get('/no-pendency-requests/staff/:staffId', verifyToken, async (req, res) => {
  const { staffId } = req.params;
  if (req.user.staffId !== staffId && !isDepartmentStaffManager(req.user)) {
    return res.status(403).json({ message: 'You can only view your own certificate requests.' });
  }
  if (isDepartmentStaffManager(req.user) && !(await canManageStaffId(req.user, staffId))) {
    return res.status(403).json({ message: 'You can only view certificate requests for staff in your department.' });
  }

  try {
    const requests = await NoPendencyRequest.find({ staffId }).sort({ createdAt: -1 }).lean();
    res.status(200).json(requests);
  } catch (error) {
    console.error('Error fetching staff no-pendency certificate requests:', error);
    res.status(500).json({ message: 'Failed to fetch certificate requests.' });
  }
});

app.patch('/no-pendency-requests/:requestId/:decision', verifyToken, requireRole([ROLES.SUPER_ADMIN, ROLES.ADMIN_HR, ROLES.HEAD_OFFICER]), async (req, res) => {
  const { decision } = req.params;
  const { remarks = '' } = req.body;
  if (!['approve', 'disapprove'].includes(decision)) {
    return res.status(404).json({ message: 'Certificate request action not found.' });
  }

  try {
    const request = await NoPendencyRequest.findOne({ requestId: req.params.requestId });
    if (!request) {
      return res.status(404).json({ message: 'Certificate request not found.' });
    }
    if (!(await canManageStaffId(req.user, request.staffId))) {
      return res.status(403).json({ message: 'You can only review certificate requests for staff in your department.' });
    }
    if (request.status !== 'Pending') {
      return res.status(400).json({ message: 'Only pending certificate requests can be reviewed.' });
    }

    request.status = decision === 'approve' ? 'Approved' : 'Disapproved';
    request.reviewedBy = req.user.name || req.user.email || 'Admin';
    request.reviewDate = new Date();
    request.reviewRemarks = String(remarks).trim();
    request.updatedAt = new Date();
    await request.save();

    await createSystemLogEntry({
      module: 'Certificate of No Pending Case',
      action: decision === 'approve' ? 'Approve' : 'Disapprove',
      user: req.user.name || req.user.email || 'System',
      userId: req.user.staffId,
      description: `Certificate request ${request.status.toLowerCase()}: ${request.requestId}`,
      ipAddress: getRequestIp(req),
      status: 'Success',
      metadata: { requestId: request.requestId, staffId: request.staffId },
    });

    res.status(200).json({ message: `Certificate request ${request.status.toLowerCase()}.`, request });
  } catch (error) {
    console.error('Error reviewing no-pendency certificate request:', error);
    res.status(500).json({ message: 'Failed to review certificate request.' });
  }
});

app.post(
  '/no-leave-without-pay-certificates',
  verifyToken,
  uploadPaymentProof.single('proofOfPayment'),
  async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ message: 'Proof of payment is required. Upload a PDF, JPG, or PNG file up to 10 MB.' });
    }

    const staffId = req.user.staffId;
    const { fullName, position, periodFrom, periodTo, dateOfApplication } = req.body;
    const fromDate = new Date(periodFrom);
    const toDate = new Date(periodTo);
    const applicationDate = new Date(dateOfApplication);

    if (
      !staffId
      || typeof fullName !== 'string'
      || !fullName.trim()
      || typeof position !== 'string'
      || !position.trim()
      || !periodFrom
      || !periodTo
      || Number.isNaN(fromDate.getTime())
      || Number.isNaN(toDate.getTime())
      || fromDate > toDate
      || Number.isNaN(applicationDate.getTime())
    ) {
      removeUploadedPaymentProof(req.file);
      return res.status(400).json({ message: 'Full name, position, a valid leave-without-pay date range, and application date are required.' });
    }

    try {
      const staff = await Staff.findOne({ id: staffId }).select('name department').lean();
      if (!staff) {
        removeUploadedPaymentProof(req.file);
        return res.status(404).json({ message: 'Staff account not found.' });
      }

      const request = await NoLeaveWithoutPayCertificate.create({
        requestId: new mongoose.Types.ObjectId().toString(),
        staffId,
        staffName: staff.name || fullName.trim(),
        staffDepartment: staff.department || '',
        fullName: fullName.trim(),
        position: position.trim(),
        periodFrom: fromDate,
        periodTo: toDate,
        dateOfApplication: applicationDate,
        paymentProof: getPaymentProofMetadata(req.file),
      });

      await createSystemLogEntry({
        module: 'Certificate of No Leave Without Pay',
        action: 'Create',
        user: req.user.name || req.user.email || 'System',
        userId: staffId,
        description: `Certificate of No Leave Without Pay request submitted by ${request.staffName}`,
        ipAddress: getRequestIp(req),
        status: 'Success',
        metadata: { requestId: request.requestId, staffId },
      });

      return res.status(201).json({ message: 'Certificate request submitted successfully.', request });
    } catch (error) {
      removeUploadedPaymentProof(req.file);
      console.error('Error creating no-leave-without-pay certificate request:', error);
      return res.status(500).json({ message: 'Failed to submit certificate request.' });
    }
  }
);

app.get(
  '/no-leave-without-pay-certificates',
  verifyToken,
  requireRole([ROLES.SUPER_ADMIN, ROLES.ADMIN_HR, ROLES.HEAD_OFFICER]),
  async (req, res) => {
    try {
      const managedStaff = await getDepartmentStaff(req.user);
      const query = {
        ...(req.query.status ? { status: req.query.status } : {}),
        ...(managedStaff ? { staffId: { $in: managedStaff.map((staff) => staff.id).filter(Boolean) } } : {}),
      };
      const requests = await NoLeaveWithoutPayCertificate.find(query).sort({ createdAt: -1 }).lean();
      return res.json(requests);
    } catch (error) {
      console.error('Error fetching no-leave-without-pay certificate requests:', error);
      return res.status(500).json({ message: 'Failed to fetch certificate requests.' });
    }
  }
);

app.get('/no-leave-without-pay-certificates/staff/:staffId', verifyToken, async (req, res) => {
  const isManager = isDepartmentStaffManager(req.user);
  if (!isManager && String(req.user?.staffId) !== String(req.params.staffId)) {
    return res.status(403).json({ message: 'You can only view your own certificate requests.' });
  }
  if (isManager && !(await canManageStaffId(req.user, req.params.staffId))) {
    return res.status(403).json({ message: 'You can only view certificate requests for staff in your department.' });
  }

  try {
    const requests = await NoLeaveWithoutPayCertificate.find({ staffId: req.params.staffId })
      .sort({ createdAt: -1 })
      .lean();
    return res.json(requests);
  } catch (error) {
    console.error('Error fetching staff no-leave-without-pay certificate requests:', error);
    return res.status(500).json({ message: 'Failed to fetch certificate requests.' });
  }
});

app.patch(
  '/no-leave-without-pay-certificates/:requestId/:decision',
  verifyToken,
  requireRole([ROLES.SUPER_ADMIN, ROLES.ADMIN_HR, ROLES.HEAD_OFFICER]),
  async (req, res) => {
    const { decision } = req.params;
    if (!['approve', 'disapprove'].includes(decision)) {
      return res.status(404).json({ message: 'Certificate request action not found.' });
    }

    try {
      const request = await NoLeaveWithoutPayCertificate.findOne({ requestId: req.params.requestId });
      if (!request) {
        return res.status(404).json({ message: 'Certificate request not found.' });
      }
      if (!(await canManageStaffId(req.user, request.staffId))) {
        return res.status(403).json({ message: 'You can only review certificate requests for staff in your department.' });
      }
      if (request.status !== 'Pending') {
        return res.status(400).json({ message: 'Only pending certificate requests can be reviewed.' });
      }

      request.status = decision === 'approve' ? 'Approved' : 'Disapproved';
      request.reviewedBy = req.user.name || req.user.email || 'Admin';
      request.reviewDate = new Date();
      request.reviewRemarks = String(req.body.remarks || '').trim();
      request.updatedAt = new Date();
      await request.save();

      await createSystemLogEntry({
        module: 'Certificate of No Leave Without Pay',
        action: decision === 'approve' ? 'Approve' : 'Disapprove',
        user: req.user.name || req.user.email || 'System',
        userId: req.user.staffId,
        description: `Certificate request ${request.status.toLowerCase()}: ${request.requestId}`,
        ipAddress: getRequestIp(req),
        status: 'Success',
        metadata: { requestId: request.requestId, staffId: request.staffId },
      });

      return res.json({ message: `Certificate request ${request.status.toLowerCase()}.`, request });
    } catch (error) {
      console.error('Error reviewing no-leave-without-pay certificate request:', error);
      return res.status(500).json({ message: 'Failed to review certificate request.' });
    }
  }
);

app.get('/payment-proofs/:requestType/:requestId', verifyToken, async (req, res) => {
  const isManager = isDepartmentStaffManager(req.user);

  try {
    let request;
    if (req.params.requestType === 'coe') {
      request = await COE.findOne({ coeId: req.params.requestId }).select('staffId paymentProof').lean();
    } else if (req.params.requestType === 'no-pendency') {
      request = await NoPendencyRequest.findOne({ requestId: req.params.requestId }).select('staffId paymentProof').lean();
    } else if (req.params.requestType === 'no-leave-without-pay') {
      request = await NoLeaveWithoutPayCertificate.findOne({ requestId: req.params.requestId })
        .select('staffId paymentProof')
        .lean();
    } else {
      return res.status(404).json({ message: 'Payment proof not found.' });
    }

    if (!request) {
      return res.status(404).json({ message: 'Certificate request not found.' });
    }
    if (!isManager && String(request.staffId) !== String(req.user?.staffId)) {
      return res.status(403).json({ message: 'You are not allowed to view this payment proof.' });
    }
    if (isManager && !(await canManageStaffId(req.user, request.staffId))) {
      return res.status(403).json({ message: 'You are not allowed to view this payment proof.' });
    }

    const proof = request.paymentProof;
    if (!proof?.storageName) {
      return res.status(404).json({ message: 'Payment proof not found.' });
    }

    const filePath = path.join(PAYMENT_PROOF_UPLOAD_DIR, path.basename(proof.storageName));
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: 'The payment proof file is unavailable.' });
    }

    res.type(proof.mimeType || 'application/octet-stream');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(proof.fileName || 'proof-of-payment')}`);
    return fs.createReadStream(filePath).pipe(res);
  } catch (error) {
    console.error('Error retrieving certificate payment proof:', error);
    return res.status(500).json({ message: 'Failed to retrieve payment proof.' });
  }
});

// ==================== SERVICE RECORD ROUTES ====================

// Create service record (Super Admin and Admin/HR only)
app.post('/service-records', verifyToken, requireRole([ROLES.SUPER_ADMIN, ROLES.ADMIN_HR, ROLES.HEAD_OFFICER]), async (req, res) => {
  const { staffId, staffName, designation, status, salary, station, branch, serviceFrom, serviceTo, leaveWithoutPayFrom, leaveWithoutPayTo, remarks } = req.body;

  if (!staffId || !serviceFrom) {
    return res.status(400).json({ message: 'staffId and serviceFrom are required' });
  }

  try {
    if (!(await canManageStaffId(req.user, staffId))) {
      return res.status(403).json({ message: 'You can only manage service records for staff in your department.' });
    }
    const recordId = `SR${Date.now()}`;
    const newRecord = new ServiceRecord({
      recordId,
      staffId,
      staffName,
      designation,
      status,
      salary,
      station,
      branch,
      serviceFrom,
      serviceTo,
      leaveWithoutPayFrom,
      leaveWithoutPayTo,
      remarks,
    });

    await newRecord.save();
    res.status(201).json({ message: 'Service record created successfully', record: newRecord });
  } catch (error) {
    console.error('Error creating service record:', error.message);
    res.status(500).json({ message: 'Failed to create service record: ' + error.message });
  }
});

// Get all service records (Super Admin and Admin/HR only)
app.get('/service-records', verifyToken, requireRole([ROLES.SUPER_ADMIN, ROLES.ADMIN_HR, ROLES.HEAD_OFFICER]), async (req, res) => {
  try {
    const managedStaff = await getDepartmentStaff(req.user);
    const filter = managedStaff ? { staffId: { $in: managedStaff.map((staff) => staff.id).filter(Boolean) } } : {};
    const records = await ServiceRecord.find(filter);
    res.json(records);
  } catch (error) {
    console.error('Error fetching service records:', error);
    res.status(500).json({ message: 'Failed to retrieve service records' });
  }
});

// Get service records by Item Number (Staff can only see their own, Admin can see all)
app.get('/service-records/staff/:staffId', verifyToken, async (req, res) => {
  try {
    // Staff can only view their own records
    if (normalizeRole(req.user.role) === ROLES.STAFF && req.user.staffId !== req.params.staffId) {
      return res.status(403).json({ message: 'Access denied' });
    }
    if (isDepartmentStaffManager(req.user) && !(await canManageStaffId(req.user, req.params.staffId))) {
      return res.status(403).json({ message: 'You can only view service records for staff in your department.' });
    }

    const records = await ServiceRecord.find({ staffId: req.params.staffId });
    res.json(records);
  } catch (error) {
    console.error('Error fetching staff service records:', error);
    res.status(500).json({ message: 'Failed to retrieve service records' });
  }
});

// Get single service record by ID
app.get('/service-record/:recordId', verifyToken, async (req, res) => {
  try {
    const record = await ServiceRecord.findOne({ recordId: req.params.recordId });
    if (!record) {
      return res.status(404).json({ message: 'Service record not found' });
    }

    // Staff can only view their own record
    if (normalizeRole(req.user.role) === ROLES.STAFF && req.user.staffId !== record.staffId) {
      return res.status(403).json({ message: 'Access denied' });
    }
    if (isDepartmentStaffManager(req.user) && !(await canManageStaffId(req.user, record.staffId))) {
      return res.status(403).json({ message: 'You can only view service records for staff in your department.' });
    }

    res.json(record);
  } catch (error) {
    console.error('Error fetching service record:', error);
    res.status(500).json({ message: 'Failed to retrieve service record' });
  }
});

// Update service record (Super Admin and Admin/HR only)
app.put('/service-records/:recordId', verifyToken, requireRole([ROLES.SUPER_ADMIN, ROLES.ADMIN_HR, ROLES.HEAD_OFFICER]), async (req, res) => {
  try {
    const { designation, status, salary, station, branch, serviceTo, leaveWithoutPayFrom, leaveWithoutPayTo, remarks } = req.body;
    const existing = await ServiceRecord.findOne({ recordId: req.params.recordId }).select('staffId').lean();
    if (!existing) return res.status(404).json({ message: 'Service record not found' });
    if (!(await canManageStaffId(req.user, existing.staffId))) {
      return res.status(403).json({ message: 'You can only manage service records for staff in your department.' });
    }

    const updated = await ServiceRecord.findOneAndUpdate(
      { recordId: req.params.recordId },
      { 
        designation, 
        status, 
        salary, 
        station, 
        branch, 
        serviceTo, 
        leaveWithoutPayFrom, 
        leaveWithoutPayTo, 
        remarks,
        updatedAt: Date.now()
      },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ message: 'Service record not found' });
    }

    res.status(200).json({ message: 'Service record updated successfully', record: updated });
  } catch (error) {
    console.error('Error updating service record:', error);
    res.status(500).json({ message: 'Failed to update service record' });
  }
});

// Delete service record (Super Admin and Admin/HR only)
app.delete('/service-records/:recordId', verifyToken, requireRole([ROLES.SUPER_ADMIN, ROLES.ADMIN_HR, ROLES.HEAD_OFFICER]), async (req, res) => {
  try {
    const existing = await ServiceRecord.findOne({ recordId: req.params.recordId }).select('staffId').lean();
    if (!existing) {
      return res.status(404).json({ message: 'Service record not found' });
    }
    if (!(await canManageStaffId(req.user, existing.staffId))) {
      return res.status(403).json({ message: 'You can only manage service records for staff in your department.' });
    }
    await ServiceRecord.deleteOne({ recordId: req.params.recordId });

    res.status(200).json({ message: 'Service record deleted successfully' });
  } catch (error) {
    console.error('Error deleting service record:', error);
    res.status(500).json({ message: 'Failed to delete service record' });
  }
});

// ==================== LEAVE RECORDS ROUTES ====================

// Get all leave records for a staff member
app.get('/leave-records/staff/:staffId', verifyToken, async (req, res) => {
  try {
    const { staffId } = req.params;
    const role = normalizeRole(req.user?.role);
    if (role === ROLES.STAFF && String(req.user?.staffId) !== String(staffId)) {
      return res.status(403).json({ message: 'You can only view your own leave records.' });
    }
    if (isDepartmentStaffManager(req.user) && !(await canManageStaffId(req.user, staffId))) {
      return res.status(403).json({ message: 'You can only view leave records for staff in your department.' });
    }
    console.log(`[GET /leave-records/staff/:staffId] Fetching records for staffId: ${staffId}`);

    await ensureMonthlyEarnedLeaveCredits({ staffId });
    
    const records = await LeaveRecord.find({ staffId }).sort({ period: 1, createdAt: 1, _id: 1 });
    console.log(`[GET /leave-records/staff/:staffId] Found ${records.length} records for staffId: ${staffId}`);
    console.error(`[GET /leave-records/staff/:staffId] Records returned:`, JSON.stringify(records, null, 2));
    
    if (records.length === 0) {
      console.log(`[GET /leave-records/staff/:staffId] No records found. Available staffIds in DB:`);
      const allRecords = await LeaveRecord.find().select('staffId').distinct('staffId');
      console.log(`Available staffIds:`, allRecords);
    }

    res.status(200).json({ data: records });
  } catch (error) {
    console.error('Error fetching leave records:', error);
    res.status(500).json({ message: 'Failed to retrieve leave records' });
  }
});

// Get all leave records (Super Admin and Admin/HR only)
app.get('/leave-records', verifyToken, requireRole([ROLES.SUPER_ADMIN, ROLES.ADMIN_HR, ROLES.HEAD_OFFICER]), async (req, res) => {
  try {
    const managedStaff = await getDepartmentStaff(req.user);
    if (managedStaff) {
      await Promise.all(managedStaff.map((staff) => ensureMonthlyEarnedLeaveCredits({ staffId: staff.id })));
    } else {
      await ensureMonthlyEarnedLeaveCredits();
    }

    const filter = managedStaff ? { staffId: { $in: managedStaff.map((staff) => staff.id).filter(Boolean) } } : {};
    const records = await LeaveRecord.find(filter).sort({ staffId: 1, period: -1 });
    res.status(200).json({ data: records });
  } catch (error) {
    console.error('Error fetching leave records:', error);
    res.status(500).json({ message: 'Failed to retrieve leave records' });
  }
});

// Create leave record (Super Admin and Admin/HR only)
app.post('/leave-records', verifyToken, requireRole([ROLES.SUPER_ADMIN, ROLES.ADMIN_HR, ROLES.HEAD_OFFICER]), async (req, res) => {
  try {
    const { staffId, staffName, period, particulars, numberOfDays, vlEarned, vlAbsentUndertimeWPay, slEarned, slAbsentUndertimeWPay, cto, dateRanges } = req.body;
    console.log('[POST /leave-records] Creating record with staffId:', staffId);
    console.log('[POST /leave-records] Request body:', { staffId, staffName, period, particulars, dateRanges });

    // Require either period (legacy) or dateRanges (new)
    if (!staffId || !particulars || (!period && (!dateRanges || !Array.isArray(dateRanges) || dateRanges.length === 0))) {
      return res.status(400).json({ message: 'staffId, particulars, and period or dateRanges are required' });
    }
    if (!(await canManageStaffId(req.user, staffId))) {
      return res.status(403).json({ message: 'You can only manage leave records for staff in your department.' });
    }

    const recordId = `LR-${Date.now()}`;
    const newRecord = new LeaveRecord({
      recordId,
      staffId,
      staffName: staffName || 'N/A',
      period: period ? new Date(period) : undefined,
      dateRanges: dateRanges && Array.isArray(dateRanges) && dateRanges.length > 0 ? dateRanges : undefined,
      particulars,
      numberOfDays: Number(numberOfDays) || 0,
      vlEarned: parseFloat(vlEarned) || 0,
      vlAbsentUndertimeWPay: parseFloat(vlAbsentUndertimeWPay) || 0,
      slEarned: parseFloat(slEarned) || 0,
      slAbsentUndertimeWPay: parseFloat(slAbsentUndertimeWPay) || 0,
      cto: cto || '',
      source: 'Manual',
      autoGenerated: false,
    });

    await newRecord.save();
    console.log('[POST /leave-records] Record saved successfully with ID:', recordId, 'staffId:', staffId);
    res.status(201).json({ message: 'Leave record created successfully', data: newRecord });
  } catch (error) {
    console.error('Error creating leave record:', error);
    res.status(500).json({ message: 'Failed to create leave record' });
  }
});


// Update leave record (Super Admin and Admin/HR only)
app.put('/leave-records/:recordId', verifyToken, requireRole([ROLES.SUPER_ADMIN, ROLES.ADMIN_HR, ROLES.HEAD_OFFICER]), async (req, res) => {
  try {
    const { recordId } = req.params;
    const { period, particulars, numberOfDays, vlEarned, vlAbsentUndertimeWPay, slEarned, slAbsentUndertimeWPay, cto, dateRanges } = req.body;

    // Build update object
    const updateObj = {
      particulars,
      vlEarned: parseFloat(vlEarned),
      vlAbsentUndertimeWPay: parseFloat(vlAbsentUndertimeWPay),
      slEarned: parseFloat(slEarned),
      slAbsentUndertimeWPay: parseFloat(slAbsentUndertimeWPay),
      cto,
      updatedAt: Date.now(),
    };
    if (numberOfDays !== undefined) updateObj.numberOfDays = Number(numberOfDays) || 0;
    if (period) updateObj.period = new Date(period);
    if (dateRanges && Array.isArray(dateRanges)) updateObj.dateRanges = dateRanges;

    const existing = await LeaveRecord.findOne({ recordId }).select('staffId').lean();
    if (!existing) return res.status(404).json({ message: 'Leave record not found' });
    if (!(await canManageStaffId(req.user, existing.staffId))) {
      return res.status(403).json({ message: 'You can only manage leave records for staff in your department.' });
    }

    const updated = await LeaveRecord.findOneAndUpdate(
      { recordId },
      updateObj,
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ message: 'Leave record not found' });
    }

    res.status(200).json({ message: 'Leave record updated successfully', data: updated });
  } catch (error) {
    console.error('Error updating leave record:', error);
    res.status(500).json({ message: 'Failed to update leave record' });
  }
});

// ==================== LEAVE RECORD BATCH IMPORT ENDPOINT ====================
// Batch import leave records (append, do not replace)
app.post('/leave-records/import', verifyToken, requireRole([ROLES.SUPER_ADMIN, ROLES.ADMIN_HR, ROLES.HEAD_OFFICER]), async (req, res) => {
  try {
    const records = Array.isArray(req.body) ? req.body : [];
    console.error('Batch import: Incoming records:', JSON.stringify(records, null, 2));
    if (!records.length) {
      return res.status(400).json({ message: 'No records provided for import.' });
    }

    // Validate and filter records
    let validRecords = [];
    let missingFields = [];
    for (const rec of records) {
      if (!rec.staffId || !rec.particulars || (!rec.period && (!rec.dateRanges || !Array.isArray(rec.dateRanges) || rec.dateRanges.length === 0))) {
        missingFields.push(rec.recordId || rec);
        continue;
      }
      validRecords.push(rec);
    }

    if (!validRecords.length) {
      return res.status(400).json({ message: 'No valid records to import.', missingFields });
    }
    for (const record of validRecords) {
      if (!(await canManageStaffId(req.user, record.staffId))) {
        return res.status(403).json({ message: 'Imported leave records must belong to staff in your department.' });
      }
    }

    // Only insert records that do not already exist (by recordId)
    const existingIds = new Set(
      (await LeaveRecord.find({ recordId: { $in: validRecords.map(r => r.recordId) } }).select('recordId -_id').lean())
        .map(r => r.recordId)
    );
    let toInsert = validRecords.filter(r => !existingIds.has(r.recordId));
    const skippedRecords = validRecords.filter(r => existingIds.has(r.recordId));
    if (skippedRecords.length > 0) {
      console.error('Skipped records due to duplicate recordId:', JSON.stringify(skippedRecords, null, 2));
    }

    // Convert dateRanges string values to Date objects for MongoDB
    toInsert = toInsert.map(r => {
      if (Array.isArray(r.dateRanges) && r.dateRanges.length > 0) {
        // Defensive: filter out invalid date ranges and log them
        const validRanges = r.dateRanges.filter(dr => {
          const fromDate = dr.from ? new Date(dr.from) : undefined;
          const toDate = dr.to ? new Date(dr.to) : undefined;
          const valid = fromDate instanceof Date && !isNaN(fromDate) && toDate instanceof Date && !isNaN(toDate);
          if (!valid) {
            console.error('Invalid dateRange found and skipped:', dr, 'in record:', r.recordId);
          }
          return valid;
        }).map(dr => ({
          from: dr.from ? new Date(dr.from) : undefined,
          to: dr.to ? new Date(dr.to) : undefined
        }));
        r.dateRanges = validRanges;
      }
      // Only convert period if present and not null/undefined/empty
      if (r.period !== undefined && r.period !== null && r.period !== '') {
        r.period = new Date(r.period);
      } else {
        // Remove period if not present, so it doesn't overwrite schema default
        delete r.period;
      }
      return r;
    });

    console.error('Batch import: Records to insert:', JSON.stringify(toInsert, null, 2));
    if (!toInsert.length) {
      return res.status(200).json({ message: 'All records already exist. Nothing to import.' });
    }

    try {
      console.error('Attempting insertMany with records:', JSON.stringify(toInsert, null, 2));
      const insertResult = await LeaveRecord.insertMany(toInsert, { ordered: false });
      console.error('insertMany result:', insertResult);
      res.status(201).json({
        message: `Imported ${toInsert.length} leave records.`,
        importedCount: toInsert.length,
        skippedCount: skippedRecords.length,
        skippedRecords: skippedRecords
      });
    } catch (insertErr) {
      console.error('FULL insertMany error object:', insertErr);
      if (insertErr && insertErr.writeErrors) {
        insertErr.writeErrors.forEach((err, idx) => {
          console.error(`Insert error for record:`, JSON.stringify(toInsert[idx], null, 2));
          console.error('Error details:', err.errmsg || err.message || err);
        });
      }
      res.status(500).json({
        message: 'Some records failed to import',
        error: insertErr.message,
        details: insertErr.writeErrors,
        fullError: insertErr,
        skippedCount: skippedRecords.length,
        skippedRecords: skippedRecords
      });
    }
  } catch (error) {
    console.error('Error importing leave records:', error);
    res.status(500).json({ message: 'Failed to import leave records', error: error.message });
  }
});

// Delete leave record (Super Admin and Admin/HR only)
app.delete('/leave-records/:recordId', verifyToken, requireRole([ROLES.SUPER_ADMIN, ROLES.ADMIN_HR, ROLES.HEAD_OFFICER]), async (req, res) => {
  try {
    const { recordId } = req.params;
    console.log('Attempting to delete leave record with ID:', recordId);

    const targetRecord = await LeaveRecord.findOne({
      $or: [{ recordId }, { _id: mongoose.Types.ObjectId.isValid(recordId) ? recordId : null }],
    }).lean();

    if (!targetRecord) {
      console.log('Record not found:', recordId);
      return res.status(404).json({ message: 'Leave record not found' });
    }
    if (!(await canManageStaffId(req.user, targetRecord.staffId))) {
      return res.status(403).json({ message: 'You can only manage leave records for staff in your department.' });
    }

    const isAutoMonthlyAccrual = targetRecord.source === 'MonthlyAccrual' && targetRecord.autoGenerated;

    // First try to find and delete using recordId field
    const deleted = await LeaveRecord.findOneAndDelete(
      { recordId },
      { new: true }
    );

    let leaveDeleted = null;
    if (deleted) {
      if (isAutoMonthlyAccrual) {
        const monthKey = getMonthKey(deleted.period);
        if (monthKey) {
          await MonthlyAccrualExclusion.findOneAndUpdate(
            { staffId: deleted.staffId, monthKey },
            {
              $set: {
                reason: 'ManualDelete',
                updatedAt: Date.now(),
              },
              $setOnInsert: {
                createdAt: Date.now(),
              },
            },
            { upsert: true, new: true }
          );
        }
      }

      // Also delete the corresponding leave request from Leave collection
      if (deleted.sourceLeaveId) {
        leaveDeleted = await mongoose.model('Leave').findOneAndDelete({ leaveId: deleted.sourceLeaveId });
        if (leaveDeleted) {
          console.log('Also deleted leave request with leaveId:', deleted.sourceLeaveId);
        }
      }
      console.log('Successfully deleted record:', recordId);
      return res.status(200).json({ message: 'Leave record deleted successfully', data: deleted, leaveDeleted });
    }

    // If not found by recordId, try by MongoDB _id
    try {
      const deletedById = await LeaveRecord.findByIdAndDelete(recordId);
      if (deletedById) {
        if (deletedById.source === 'MonthlyAccrual' && deletedById.autoGenerated) {
          const monthKey = getMonthKey(deletedById.period);
          if (monthKey) {
            await MonthlyAccrualExclusion.findOneAndUpdate(
              { staffId: deletedById.staffId, monthKey },
              {
                $set: {
                  reason: 'ManualDelete',
                  updatedAt: Date.now(),
                },
                $setOnInsert: {
                  createdAt: Date.now(),
                },
              },
              { upsert: true, new: true }
            );
          }
        }

        // Also delete the corresponding leave request from Leave collection
        if (deletedById.sourceLeaveId) {
          leaveDeleted = await mongoose.model('Leave').findOneAndDelete({ leaveId: deletedById.sourceLeaveId });
          if (leaveDeleted) {
            console.log('Also deleted leave request with leaveId:', deletedById.sourceLeaveId);
          }
        }
        console.log('Successfully deleted record by _id:', recordId);
        return res.status(200).json({ message: 'Leave record deleted successfully', data: deletedById, leaveDeleted });
      }
    } catch (idErr) {
      // _id deletion failed, continue to not found error
    }

    // If this happens, the record changed between read and delete.
    console.log('Record became unavailable during delete:', recordId);
    return res.status(404).json({ message: 'Leave record not found' });
  } catch (error) {
    console.error('Error deleting leave record:', error);
    res.status(500).json({ message: 'Failed to delete leave record', error: error.message });
  }
});

// ==================== VAULT ROUTES ====================

app.get('/my-requests', verifyToken, async (req, res) => {
  const staffId = String(req.user?.staffId || '').trim();
  if (!staffId) {
    return res.status(400).json({ message: 'A staff account is required to view request history.' });
  }

  try {
    const [leaves, travelOrders, overtimes, coes, noPendencyRequests, noLeaveWithoutPayRequests, profileUpdates, personalDataSheets] = await Promise.all([
      Leave.find({ staffId }).select('leaveId leaveType startDate endDate numberOfDays status approvalStage revisionComment remarks createdAt updatedAt').lean(),
      TravelOrder.find({ staffId }).select('travelOrderId destination purpose dateFrom dateTo status approvalStage revisionComment remarks createdAt updatedAt').lean(),
      Overtime.find({ staffId }).select('overtimeId purposeOfOvertime inclusiveDateStart inclusiveDateEnd status approvalStage revisionComment approvalRemarks createdAt updatedAt').lean(),
      COE.find({ staffId }).select('coeId purpose dateOfApplication status revisionComment approvalRemarks disapprovalRemarks createdAt updatedAt').lean(),
      NoPendencyRequest.find({ staffId }).select('requestId dateOfApplication status reviewRemarks createdAt updatedAt').lean(),
      NoLeaveWithoutPayCertificate.find({ staffId }).select('requestId periodFrom periodTo dateOfApplication status reviewRemarks createdAt updatedAt').lean(),
      StaffUpdateRequest.find({ staffId }).select('requestId status reviewedBy reviewedAt createdAt updatedAt').lean(),
      PersonalDataSheet.find({
        $or: [{ ownerStaffId: staffId }, { submittedByStaffId: staffId }],
      }).select('pdsId firstName surname status remarks reviewedAt createdAt updatedAt').lean(),
    ]);

    const toRequest = (type, id, title, submittedAt, status, stage, summary, updatedAt, remarks) => ({
      id,
      type,
      title,
      submittedAt,
      status: status || 'Pending',
      stage: stage || '',
      summary: summary || '',
      updatedAt: updatedAt || submittedAt,
      remarks: remarks || '',
    });

    const requests = [
      ...leaves.map((item) => toRequest(
        'Leave',
        item.leaveId,
        item.leaveType || 'Leave Request',
        item.createdAt,
        item.status,
        item.approvalStage,
        [item.startDate, item.endDate].filter(Boolean).map((date) => new Date(date).toISOString().slice(0, 10)).join(' to '),
        item.updatedAt,
        item.revisionComment || item.remarks
      )),
      ...travelOrders.map((item) => toRequest(
        'Travel Order',
        item.travelOrderId,
        item.destination || 'Travel Order',
        item.createdAt,
        item.status,
        item.approvalStage,
        [item.purpose, item.dateFrom && item.dateTo
          ? `${new Date(item.dateFrom).toISOString().slice(0, 10)} to ${new Date(item.dateTo).toISOString().slice(0, 10)}`
          : ''].filter(Boolean).join(' · '),
        item.updatedAt,
        item.revisionComment || item.remarks
      )),
      ...overtimes.map((item) => toRequest(
        'Overtime',
        item.overtimeId,
        'Overtime Request',
        item.createdAt,
        item.status,
        item.approvalStage,
        [item.purposeOfOvertime, item.inclusiveDateStart && item.inclusiveDateEnd
          ? `${new Date(item.inclusiveDateStart).toISOString().slice(0, 10)} to ${new Date(item.inclusiveDateEnd).toISOString().slice(0, 10)}`
          : ''].filter(Boolean).join(' · '),
        item.updatedAt,
        item.revisionComment || item.approvalRemarks
      )),
      ...coes.map((item) => toRequest(
        'Certificate of Employment',
        item.coeId,
        item.purpose || 'Certificate of Employment',
        item.createdAt || item.dateOfApplication,
        item.status,
        'Admin',
        item.dateOfApplication ? `Applied ${new Date(item.dateOfApplication).toISOString().slice(0, 10)}` : '',
        item.updatedAt,
        item.revisionComment || item.approvalRemarks || item.disapprovalRemarks
      )),
      ...noPendencyRequests.map((item) => toRequest(
        'Certificate of No Pending Case',
        item.requestId,
        'Certificate of No Pending Case',
        item.createdAt || item.dateOfApplication,
        item.status,
        'Admin',
        item.dateOfApplication ? `Applied ${new Date(item.dateOfApplication).toISOString().slice(0, 10)}` : '',
        item.updatedAt,
        item.reviewRemarks
      )),
      ...noLeaveWithoutPayRequests.map((item) => toRequest(
        'Certificate of No Leave Without Pay',
        item.requestId,
        'Certificate of No Leave Without Pay',
        item.createdAt || item.dateOfApplication,
        item.status,
        'Admin',
        item.periodFrom && item.periodTo
          ? `${new Date(item.periodFrom).toISOString().slice(0, 10)} to ${new Date(item.periodTo).toISOString().slice(0, 10)}`
          : '',
        item.updatedAt,
        item.reviewRemarks
      )),
      ...profileUpdates.map((item) => toRequest(
        'Profile Update',
        item.requestId,
        'Profile Update Request',
        item.createdAt,
        item.status === 'Rejected' ? 'Disapproved' : item.status,
        item.status === 'Pending' ? 'Admin' : '',
        item.reviewedBy ? `Reviewed by ${item.reviewedBy}` : '',
        item.reviewedAt || item.updatedAt,
        ''
      )),
      ...personalDataSheets.map((item) => toRequest(
        'Personal Data Sheet',
        item.pdsId,
        [item.firstName, item.surname].filter(Boolean).join(' ') || 'Personal Data Sheet',
        item.createdAt,
        item.status,
        item.status === 'Pending' ? 'Admin' : '',
        'PDS submission',
        item.reviewedAt || item.updatedAt,
        item.remarks
      )),
    ].sort((a, b) => new Date(b.submittedAt || 0) - new Date(a.submittedAt || 0));

    return res.json({ requests });
  } catch (error) {
    console.error('Error fetching personal request tracker:', error);
    return res.status(500).json({ message: 'Failed to load your request tracker.' });
  }
});

app.get('/vault/folders', verifyToken, async (req, res) => {
  try {
    const folders = await VaultFolder.find({})
      .select('name -_id')
      .sort({ name: 1 })
      .lean();

    const names = Array.from(new Set([VAULT_DEFAULT_FOLDER, ...folders.map((folder) => folder.name).filter(Boolean)]));
    return res.json({ folders: names });
  } catch (error) {
    console.error('Error fetching vault folders:', error);
    return res.status(500).json({ message: 'Failed to fetch vault folders' });
  }
});

app.post('/vault/folders', verifyToken, requireRole([ROLES.SUPER_ADMIN, ROLES.ADMIN_HR]), async (req, res) => {
  try {
    const ownerStaffId = getVaultOwnerStaffId(req.user);
    const ownerEmail = String(req.user?.email || '').toLowerCase();
    const folderName = sanitizeFolderName(req.body?.name);

    if (!folderName) {
      return res.status(400).json({ message: 'Folder name is required' });
    }

    if (folderName === VAULT_DEFAULT_FOLDER) {
      return res.status(400).json({ message: 'This folder already exists' });
    }

    await VaultFolder.findOneAndUpdate(
      { ownerStaffId, name: folderName },
      {
        $setOnInsert: {
          folderId: `VF-${Date.now()}-${Math.random().toString(16).slice(2)}`,
          ownerStaffId,
          ownerEmail,
          name: folderName,
          createdAt: new Date(),
        },
        $set: { updatedAt: new Date() },
      },
      { upsert: true, new: true }
    );

    ensureVaultFolderPath(ownerStaffId, folderName);
    return res.status(201).json({ message: 'Folder created', folder: folderName });
  } catch (error) {
    console.error('Error creating vault folder:', error);
    return res.status(500).json({ message: 'Failed to create folder' });
  }
});

app.delete('/vault/folders/:folderName', verifyToken, requireRole([ROLES.SUPER_ADMIN, ROLES.ADMIN_HR]), async (req, res) => {
  try {
    const folderName = sanitizeFolderName(decodeURIComponent(req.params.folderName || ''));

    if (!folderName || folderName === VAULT_DEFAULT_FOLDER) {
      return res.status(400).json({ message: 'This folder cannot be deleted' });
    }

    await VaultFile.updateMany(
      { folder: folderName },
      { $set: { folder: VAULT_DEFAULT_FOLDER, updatedAt: new Date() } }
    );

    await VaultFolder.deleteMany({ name: folderName });
    return res.json({ message: 'Folder deleted. Files moved to General.' });
  } catch (error) {
    console.error('Error deleting vault folder:', error);
    return res.status(500).json({ message: 'Failed to delete folder' });
  }
});

app.get('/vault/files', verifyToken, async (req, res) => {
  try {
    const files = await VaultFile.find({})
      .select('fileId name mimeType size folder createdAt')
      .sort({ createdAt: -1 })
      .lean();

    const normalized = files.map((file) => ({
      id: file.fileId,
      name: file.name,
      mimeType: file.mimeType,
      size: file.size,
      folder: file.folder || VAULT_DEFAULT_FOLDER,
      uploadedAt: file.createdAt,
    }));

    return res.json({ files: normalized });
  } catch (error) {
    console.error('Error fetching vault files:', error);
    return res.status(500).json({ message: 'Failed to fetch vault files' });
  }
});

app.post('/vault/files', verifyToken, requireRole([ROLES.SUPER_ADMIN, ROLES.ADMIN_HR]), uploadVaultFiles.array('files', 25), async (req, res) => {
  try {
    const ownerStaffId = getVaultOwnerStaffId(req.user);
    const ownerEmail = String(req.user?.email || '').toLowerCase();
    const folderName = sanitizeFolderName(req.body?.folder) || VAULT_DEFAULT_FOLDER;
    const uploadedFiles = Array.isArray(req.files) ? req.files : [];

    if (uploadedFiles.length === 0) {
      return res.status(400).json({ message: 'No files uploaded' });
    }

    if (folderName !== VAULT_DEFAULT_FOLDER) {
      await VaultFolder.findOneAndUpdate(
        { ownerStaffId, name: folderName },
        {
          $setOnInsert: {
            folderId: `VF-${Date.now()}-${Math.random().toString(16).slice(2)}`,
            ownerStaffId,
            ownerEmail,
            name: folderName,
            createdAt: new Date(),
          },
          $set: { updatedAt: new Date() },
        },
        { upsert: true }
      );
    }

    const now = new Date();
    const docs = uploadedFiles.map((file) => ({
      fileId: `VFILE-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      ownerStaffId,
      ownerEmail,
      folder: folderName,
      name: file.originalname,
      originalName: file.originalname,
      mimeType: file.mimetype || 'application/octet-stream',
      size: file.size || 0,
      storagePath: file.path,
      createdAt: now,
      updatedAt: now,
    }));

    const created = await VaultFile.insertMany(docs);
    const responseFiles = created.map((file) => ({
      id: file.fileId,
      name: file.name,
      mimeType: file.mimeType,
      size: file.size,
      folder: file.folder,
      uploadedAt: file.createdAt,
    }));

    return res.status(201).json({ files: responseFiles });
  } catch (error) {
    console.error('Error uploading vault files:', error);
    return res.status(500).json({ message: 'Failed to upload file(s)' });
  }
});

app.patch('/vault/files/:fileId/move', verifyToken, requireRole([ROLES.SUPER_ADMIN, ROLES.ADMIN_HR]), async (req, res) => {
  try {
    const ownerStaffId = getVaultOwnerStaffId(req.user);
    const ownerEmail = String(req.user?.email || '').toLowerCase();
    const fileId = req.params.fileId;
    const folderName = sanitizeFolderName(req.body?.folder) || VAULT_DEFAULT_FOLDER;

    if (folderName !== VAULT_DEFAULT_FOLDER) {
      await VaultFolder.findOneAndUpdate(
        { ownerStaffId, name: folderName },
        {
          $setOnInsert: {
            folderId: `VF-${Date.now()}-${Math.random().toString(16).slice(2)}`,
            ownerStaffId,
            ownerEmail,
            name: folderName,
            createdAt: new Date(),
          },
          $set: { updatedAt: new Date() },
        },
        { upsert: true }
      );
    }

    const file = await VaultFile.findOneAndUpdate(
      { fileId },
      { $set: { folder: folderName, updatedAt: new Date() } },
      { new: true }
    ).lean();

    if (!file) {
      return res.status(404).json({ message: 'File not found' });
    }

    return res.json({ message: 'File moved', file: { id: file.fileId, folder: file.folder } });
  } catch (error) {
    console.error('Error moving vault file:', error);
    return res.status(500).json({ message: 'Failed to move file' });
  }
});

app.delete('/vault/files/:fileId', verifyToken, requireRole([ROLES.SUPER_ADMIN, ROLES.ADMIN_HR]), async (req, res) => {
  try {
    const fileId = req.params.fileId;

    const file = await VaultFile.findOneAndDelete({ fileId }).lean();
    if (!file) {
      return res.status(404).json({ message: 'File not found' });
    }

    if (file.storagePath && fs.existsSync(file.storagePath)) {
      try {
        fs.unlinkSync(file.storagePath);
      } catch (deleteErr) {
        console.warn('Unable to delete vault file from disk:', deleteErr.message);
      }
    }

    return res.json({ message: 'File deleted' });
  } catch (error) {
    console.error('Error deleting vault file:', error);
    return res.status(500).json({ message: 'Failed to delete file' });
  }
});

app.get('/vault/files/:fileId/content', verifyToken, async (req, res) => {
  try {
    const fileId = req.params.fileId;
    const mode = String(req.query.mode || 'view').toLowerCase();

    const file = await VaultFile.findOne({ fileId }).lean();
    if (!file) {
      return res.status(404).json({ message: 'File not found' });
    }

    if (!file.storagePath || !fs.existsSync(file.storagePath)) {
      return res.status(404).json({ message: 'Stored file is missing on server' });
    }

    const dispositionType = mode === 'download' ? 'attachment' : 'inline';
    res.setHeader('Content-Type', file.mimeType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `${dispositionType}; filename="${encodeURIComponent(file.name || 'file')}"`);
    res.setHeader('Content-Length', String(file.size || 0));

    const stream = fs.createReadStream(file.storagePath);
    stream.on('error', (error) => {
      console.error('Error streaming vault file:', error);
      if (!res.headersSent) {
        res.status(500).json({ message: 'Failed to stream file' });
      }
    });

    return stream.pipe(res);
  } catch (error) {
    console.error('Error retrieving vault file content:', error);
    return res.status(500).json({ message: 'Failed to retrieve file content' });
  }
});

// Return JSON for oversized payloads (e.g., image-heavy DPCRF submissions)
app.use((error, req, res, next) => {
  if (error && (error.type === 'entity.too.large' || error.status === 413)) {
    return res.status(413).json({
      message: 'Submitted files are too large. Please upload smaller proof images and try again.',
    });
  }
  if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ message: 'Proof of payment exceeds the 10 MB limit.' });
  }
  if (error?.message === 'Proof of payment must be a PDF, JPG, or PNG file.') {
    return res.status(400).json({ message: error.message });
  }

  return next(error);
});

// Local runs listen on PORT; Vercel imports this module and handles requests itself.
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

module.exports = app;

