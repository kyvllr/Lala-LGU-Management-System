const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { ROLES, DEPARTMENTS, ROLE_DISPLAY_NAMES, ROLES_WITH_DEPARTMENTS, ROLE_HIERARCHY } = require('./constants');
require('dotenv').config();


const app = express();
const PORT = process.env.PORT || 5001;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

const LEAVE_TYPES = [
  'Vacation Leave',
  'Mandatory/Force Leave',
  'Sick Leave',
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
  // Backward-compatibility for older saved values
  'Vacation',
  'Emergency Leave',
  'Special Leave',
];

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


// Middleware
app.use(cors());
app.use(bodyParser.json());


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
  dateHired: Date,
  isApproved: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },
  approvedAt: Date,
  approvedBy: String,
  eSignPermission: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});


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

// Define Personal Data Sheet Schema
const personalDataSheetSchema = new mongoose.Schema({
  pdsId: { type: String, required: true, unique: true },
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
  learningDevelopment: [
    {
      title: String,
      from: String,
      to: String,
      hours: String,
      type: String,
      conductedBy: String,
    },
  ],
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
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});


const Staff = mongoose.model('Staff', staffSchema);
const Leave = mongoose.model('Leave', leaveSchema);
const TravelOrder = mongoose.model('TravelOrder', travelOrderSchema);
const Overtime = mongoose.model('Overtime', overtimeSchema);
const ServiceRecord = mongoose.model('ServiceRecord', serviceRecordSchema);
const LeaveRecord = mongoose.model('LeaveRecord', leaveRecordSchema);
const SystemLog = mongoose.model('SystemLog', systemLogSchema);
const PersonalDataSheet = mongoose.model('PersonalDataSheet', personalDataSheetSchema);

const MONTHLY_EARNED_LEAVE_VALUE = 1.25;
const EARNED_LEAVE_PARTICULARS = 'Earned Leave';
const AUTO_DEDUCT_VL_TYPES = new Set(['Vacation Leave', 'Vacation']);
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
  const appliesToVl = canonicalLeaveType === 'Vacation Leave' || AUTO_DEDUCT_VL_TYPES.has(normalizedLeaveType);
  const appliesToSl = canonicalLeaveType === 'Sick Leave' || AUTO_DEDUCT_SL_TYPES.has(normalizedLeaveType);
  const appliesToTardy = canonicalLeaveType === 'Tardy' || AUTO_DEDUCT_TARDY_TYPES.has(normalizedLeaveType);
  const appliesToUndertime = canonicalLeaveType === 'Undertime' || AUTO_DEDUCT_UNDERTIME_TYPES.has(normalizedLeaveType);
  // Force Leave is not included in calculations, only logged

  // Only log leave record for non-calculated types, but do not return null

  const existing = await LeaveRecord.findOne({ sourceLeaveId: leaveDoc.leaveId }).select('_id').lean();
  if (existing) {
    console.warn(`[LeaveRecord] Skipped creation: LeaveRecord already exists for leaveId=${leaveDoc.leaveId}, type=${leaveDoc.leaveType}`);
    return null;
  }

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

  // Only VL, SL, Tardy, Undertime, and Force Leave are calculated in ABSENT/UNDERTIME/WITH PAY
  // Others are just logged (vlAbsentUndertimeWPay and slAbsentUndertimeWPay remain 0)
  let vlAbsentUndertimeWPay = 0;
  let slAbsentUndertimeWPay = 0;
  // Only VL, SL, Tardy, and Undertime are included in calculations
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

  const autoRecord = new LeaveRecord({
    recordId: `LR-LEAVE-${leaveDoc.leaveId}`,
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
    .select('id name dateHired createdAt')
    .lean();

  let totalCreated = 0;
  const finalMonthStart = getMonthStart(lastCompletedMonthEnd);

  for (const staff of staffList) {
    if (!staff?.id) continue;

    const basisDate = staff.dateHired || staff.createdAt || new Date();
    let cursor = getMonthStart(basisDate);

    if (cursor > finalMonthStart) {
      continue;
    }

    const existingAccruals = await LeaveRecord.find({
      staffId: staff.id,
      particulars: EARNED_LEAVE_PARTICULARS,
    })
      .select('period -_id')
      .lean();

    const existingMonthKeys = new Set(
      existingAccruals
        .map((entry) => getMonthKey(entry.period))
        .filter(Boolean)
    );

    const recordsToInsert = [];

    while (cursor <= finalMonthStart) {
      const monthKey = getMonthKey(cursor);
      if (monthKey && !existingMonthKeys.has(monthKey)) {
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
  const { id, name, email, password, role, position, department, phone, dateOfBirth, placeOfBirth, tinNumber } = req.body;

  if (!id || !name || !email || !password) {
    return res.status(400).json({ message: 'ID, name, email, and password are required' });
  }

  try {
    const existing = await Staff.findOne({ $or: [{ id }, { email }] });
    if (existing) {
      return res.status(409).json({ message: 'Staff ID or email already exists' });
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
      placeOfBirth,
      tinNumber,
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
    res.json(staff);
  } catch (error) {
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

  ['workExperience', 'voluntaryWork', 'learningDevelopment', 'specialSkills', 'distinctions', 'memberships', 'references'].forEach(coerceField);

  const {
    surname,
    firstName,
    middleName,
    nameExtension,
    dateOfBirth,
    placeOfBirth,
    sexAtBirth,
    civilStatus,
    citizenship,
    residentialAddress,
    permanentAddress,
    telephone,
    mobile,
    email,
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
    const shouldAutoApprove = Boolean(normalizedPayload.adminCreateRecord) && Boolean(req.user) && isSystemAdminRole(req.user.role);

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

    const pds = new PersonalDataSheet({
      pdsId,
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
      citizenship: normalizedCitizenship,
      residentialAddress: normalizeAddress(residentialAddress),
      permanentAddress: normalizeAddress(permanentAddress),
      telephone,
      mobile,
      email,
      familyBackground,
      educationalBackground,
      civilServiceEligibilities: normalizedPayload.civilServiceEligibilities || [],
      workExperience: normalizedPayload.workExperience || [],
      voluntaryWork: normalizedPayload.voluntaryWork || [],
      learningDevelopment: normalizedPayload.learningDevelopment || [],
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
    const tokenStaffId = String(req.user?.staffId || '').trim();
    const tokenEmail = String(req.user?.email || '').trim().toLowerCase();

    const accountMatchers = [];
    if (tokenStaffId) {
      accountMatchers.push({ submittedByStaffId: tokenStaffId });
    }
    if (tokenEmail) {
      accountMatchers.push({ submittedByEmail: tokenEmail });
      accountMatchers.push({ email: new RegExp(`^${tokenEmail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') });
    }

    if (!accountMatchers.length) {
      return res.json({ latestSubmission: null, approvedPds: null });
    }

    const ownershipFilter = { $or: accountMatchers };

    const [latestSubmission, approvedPds] = await Promise.all([
      PersonalDataSheet.findOne(ownershipFilter).sort({ createdAt: -1 }),
      PersonalDataSheet.findOne({
        ...ownershipFilter,
        status: 'Approved',
      }).sort({ reviewedAt: -1, createdAt: -1 }),
    ]);

    res.json({ latestSubmission, approvedPds });
  } catch (error) {
    console.error('Error fetching current user PDS:', error);
    res.status(500).json({ message: 'Failed to fetch your Personal Data Sheet' });
  }
});

// Get PDS submissions (admin)
app.get('/personal-data-sheets', verifyToken, requireRole([ROLES.SUPER_ADMIN, ROLES.ADMIN_HR]), async (req, res) => {
  try {
    const { status } = req.query;
    const filter = {};

    if (status && ['Pending', 'Approved', 'Disapproved', 'For Revision'].includes(status)) {
      filter.status = status;
    }

    const sheets = await PersonalDataSheet.find(filter).sort({ createdAt: -1 });
    res.json(sheets);
  } catch (error) {
    console.error('Error fetching PDS submissions:', error);
    res.status(500).json({ message: 'Failed to fetch Personal Data Sheets' });
  }
});

// Update PDS submission (admin)
app.put('/personal-data-sheets/:pdsId', verifyToken, requireRole([ROLES.SUPER_ADMIN, ROLES.ADMIN_HR]), async (req, res) => {
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

  try {
    const normalizedPayload = normalizeEmptyStrings(req.body || {});

    ['workExperience', 'voluntaryWork', 'learningDevelopment', 'specialSkills', 'distinctions', 'memberships', 'references', 'civilServiceEligibilities', 'educationalBackground'].forEach((fieldName) => {
      if (normalizedPayload[fieldName] && typeof normalizedPayload[fieldName] === 'string') {
        normalizedPayload[fieldName] = parsePossiblyStringified(normalizedPayload[fieldName]);
      }
    });

    const {
      surname,
      firstName,
      middleName,
      nameExtension,
      dateOfBirth,
      placeOfBirth,
      sexAtBirth,
      civilStatus,
      citizenship,
      residentialAddress,
      permanentAddress,
      telephone,
      mobile,
      email,
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
      citizenship: normalizedCitizenship,
      residentialAddress: normalizeAddress(residentialAddress),
      permanentAddress: normalizeAddress(permanentAddress),
      telephone,
      mobile,
      email,
      familyBackground,
      educationalBackground: educationalBackground || [],
      civilServiceEligibilities: normalizedPayload.civilServiceEligibilities || [],
      workExperience: normalizedPayload.workExperience || [],
      voluntaryWork: normalizedPayload.voluntaryWork || [],
      learningDevelopment: normalizedPayload.learningDevelopment || [],
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

    const updated = await PersonalDataSheet.findOneAndUpdate(
      { pdsId },
      { $set: updateDoc },
      { new: true, runValidators: true }
    );

    if (!updated) {
      return res.status(404).json({ message: 'PDS submission not found' });
    }

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
app.patch('/personal-data-sheets/:pdsId/review', verifyToken, requireRole([ROLES.SUPER_ADMIN, ROLES.ADMIN_HR]), async (req, res) => {
  const { pdsId } = req.params;
  const { status, remarks } = req.body;

  if (!['Approved', 'Disapproved', 'For Revision'].includes(status)) {
    return res.status(400).json({ message: 'Review status must be Approved, Disapproved, or For Revision' });
  }

  try {
    const updated = await PersonalDataSheet.findOneAndUpdate(
      { pdsId },
      {
        $set: {
          status,
          remarks: remarks || '',
          reviewedBy: req.user.name,
          reviewedAt: Date.now(),
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

// Delete PDS submission (admin)
app.delete('/personal-data-sheets/:pdsId', verifyToken, requireRole([ROLES.SUPER_ADMIN, ROLES.ADMIN_HR]), async (req, res) => {
  const { pdsId } = req.params;

  try {
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

// Create Staff (Super Admin/Admin-HR, and Head Officers for own department staff)
app.post('/staffs', verifyToken, async (req, res) => {
  const { id, name, email, password, role, position, department, phone, dateOfBirth, placeOfBirth, tinNumber, dateHired } = req.body;
  const userRole = req.user.role;

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
      return res.status(409).json({ message: 'Staff ID or email already exists' });
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
      dateOfBirth,
      placeOfBirth,
      tinNumber,
      dateHired,
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
    // Check if user has permission to view staffs
    if (![ROLES.SUPER_ADMIN, ROLES.ADMIN_HR, ROLES.HEAD_OFFICER].includes(req.user.role)) {
      return res.status(403).json({ message: 'Access denied. Only admins and head officers can view staff lists.' });
    }

    let filter = {};
    
    // Head Officers can only see staff in their department
    if (req.user.role === ROLES.HEAD_OFFICER) {
      filter = { 
        $or: [
          { department: req.user.department },
          { role: ROLES.HEAD_OFFICER, department: req.user.department }
        ]
      };
    }

    const staffs = await Staff.find(filter).select('-password');
    res.json(staffs);
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
    const userRole = req.user.role;
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
  const { name, position, department, email, phone, dateOfBirth, placeOfBirth, tinNumber, role, password, currentPassword } = req.body;

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

    if (userRole === ROLES.HEAD_OFFICER) {
      if (role) {
        return res.status(403).json({ message: 'Head Officers cannot change account roles' });
      }

      if (department && department !== userDepartment) {
        return res.status(403).json({ message: 'You can only assign your own department' });
      }
    }

    if (!name && !position && !department && !email && !phone && !dateOfBirth && !placeOfBirth && !tinNumber && !role && !password) {
      return res.status(400).json({ message: 'At least one field is required to update' });
    }

    const updateData = { name, position, department, email, phone, dateOfBirth, placeOfBirth, tinNumber, role };
    
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

    const updatedStaff = await Staff.findOneAndUpdate(
      { id: req.params.id },
      { $set: updateData },
      { new: true, omitUndefined: true }
    ).select('-password');

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

    console.log('E-signature permission update - Staff ID:', req.params.id);
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
    return res.status(400).json({ message: 'Staff ID, Name, and Leave Type are required' });
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


      // Enforce 5-day annual limit for Mandatory/Force Leave
      if (normalizedLeaveType === 'Mandatory/Force Leave') {
        const now = new Date();
        const yearStart = new Date(now.getFullYear(), 0, 1);
        const yearEnd = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
        // Sum approved force leave days for this staff in the current year
        const approvedForceLeaves = await Leave.find({
          staffId,
          leaveType: 'Mandatory/Force Leave',
          status: 'Approved',
          approvalDate: { $gte: yearStart, $lte: yearEnd },
        }).select('numberOfDays');
        const usedForceLeaveDays = approvedForceLeaves.reduce((sum, l) => sum + (l.numberOfDays || 0), 0);
        const requestedDays = numberOfDays || 0;
        if (usedForceLeaveDays + requestedDays > 5) {
          return res.status(400).json({ message: `You have already used ${usedForceLeaveDays} day(s) of Force Leave this year. Maximum allowed is 5 days per year.` });
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
    const userRole = req.user.role;
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
    // Staff can only view their own leaves
    if (req.user.role === 'staff' && req.user.staffId !== req.params.staffId) {
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
    const userRole = req.user.role;
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
    // Staff can only view their own travel orders
    if (req.user.role === 'staff' && req.user.staffId !== req.params.staffId) {
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
    // Staff can only view their own requests
    if (req.user.role === 'staff' && req.user.staffId !== req.params.staffId) {
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

// ==================== SERVICE RECORD ROUTES ====================

// Create service record (Super Admin and Admin/HR only)
app.post('/service-records', verifyToken, requireRole([ROLES.SUPER_ADMIN, ROLES.ADMIN_HR]), async (req, res) => {
  const { staffId, staffName, designation, status, salary, station, branch, serviceFrom, serviceTo, leaveWithoutPayFrom, leaveWithoutPayTo, remarks } = req.body;

  if (!staffId || !serviceFrom) {
    return res.status(400).json({ message: 'staffId and serviceFrom are required' });
  }

  try {
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
app.get('/service-records', verifyToken, requireRole([ROLES.SUPER_ADMIN, ROLES.ADMIN_HR]), async (req, res) => {
  try {
    const records = await ServiceRecord.find();
    res.json(records);
  } catch (error) {
    console.error('Error fetching service records:', error);
    res.status(500).json({ message: 'Failed to retrieve service records' });
  }
});

// Get service records by staff ID (Staff can only see their own, Admin can see all)
app.get('/service-records/staff/:staffId', verifyToken, async (req, res) => {
  try {
    // Staff can only view their own records
    if (req.user.role === 'staff' && req.user.staffId !== req.params.staffId) {
      return res.status(403).json({ message: 'Access denied' });
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
    if (req.user.role === 'staff' && req.user.staffId !== record.staffId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    res.json(record);
  } catch (error) {
    console.error('Error fetching service record:', error);
    res.status(500).json({ message: 'Failed to retrieve service record' });
  }
});

// Update service record (Super Admin and Admin/HR only)
app.put('/service-records/:recordId', verifyToken, requireRole([ROLES.SUPER_ADMIN, ROLES.ADMIN_HR]), async (req, res) => {
  try {
    const { designation, status, salary, station, branch, serviceTo, leaveWithoutPayFrom, leaveWithoutPayTo, remarks } = req.body;

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
app.delete('/service-records/:recordId', verifyToken, requireRole([ROLES.SUPER_ADMIN, ROLES.ADMIN_HR]), async (req, res) => {
  try {
    const deleted = await ServiceRecord.findOneAndDelete({ recordId: req.params.recordId });
    if (!deleted) {
      return res.status(404).json({ message: 'Service record not found' });
    }

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
app.get('/leave-records', verifyToken, requireRole([ROLES.SUPER_ADMIN, ROLES.ADMIN_HR]), async (req, res) => {
  try {
    await ensureMonthlyEarnedLeaveCredits();

    const records = await LeaveRecord.find().sort({ staffId: 1, period: -1 });
    res.status(200).json({ data: records });
  } catch (error) {
    console.error('Error fetching leave records:', error);
    res.status(500).json({ message: 'Failed to retrieve leave records' });
  }
});

// Create leave record (Super Admin and Admin/HR only)
app.post('/leave-records', verifyToken, requireRole([ROLES.SUPER_ADMIN, ROLES.ADMIN_HR]), async (req, res) => {
  try {
    const { staffId, staffName, period, particulars, vlEarned, vlAbsentUndertimeWPay, slEarned, slAbsentUndertimeWPay, cto, dateRanges } = req.body;
    console.log('[POST /leave-records] Creating record with staffId:', staffId);
    console.log('[POST /leave-records] Request body:', { staffId, staffName, period, particulars, dateRanges });

    // Require either period (legacy) or dateRanges (new)
    if (!staffId || !particulars || (!period && (!dateRanges || !Array.isArray(dateRanges) || dateRanges.length === 0))) {
      return res.status(400).json({ message: 'staffId, particulars, and period or dateRanges are required' });
    }

    const recordId = `LR-${Date.now()}`;
    const newRecord = new LeaveRecord({
      recordId,
      staffId,
      staffName: staffName || 'N/A',
      period: period ? new Date(period) : undefined,
      dateRanges: dateRanges && Array.isArray(dateRanges) && dateRanges.length > 0 ? dateRanges : undefined,
      particulars,
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
app.put('/leave-records/:recordId', verifyToken, requireRole([ROLES.SUPER_ADMIN, ROLES.ADMIN_HR]), async (req, res) => {
  try {
    const { recordId } = req.params;
    const { period, particulars, vlEarned, vlAbsentUndertimeWPay, slEarned, slAbsentUndertimeWPay, cto, dateRanges } = req.body;

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
    if (period) updateObj.period = new Date(period);
    if (dateRanges && Array.isArray(dateRanges)) updateObj.dateRanges = dateRanges;

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
app.post('/leave-records/import', verifyToken, requireRole([ROLES.SUPER_ADMIN, ROLES.ADMIN_HR]), async (req, res) => {
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
app.delete('/leave-records/:recordId', verifyToken, requireRole([ROLES.SUPER_ADMIN, ROLES.ADMIN_HR]), async (req, res) => {
  try {
    const { recordId } = req.params;
    console.log('Attempting to delete leave record with ID:', recordId);

    // First try to find and delete using recordId field
    const deleted = await LeaveRecord.findOneAndDelete(
      { recordId },
      { new: true }
    );

    let leaveDeleted = null;
    if (deleted) {
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

    // Record not found
    console.log('Record not found:', recordId);
    return res.status(404).json({ message: 'Leave record not found' });
  } catch (error) {
    console.error('Error deleting leave record:', error);
    res.status(500).json({ message: 'Failed to delete leave record', error: error.message });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});



