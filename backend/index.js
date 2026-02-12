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
    req.user = {
      ...decoded,
      role: normalizeRole(decoded.role),
    };
    next();
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
  leaveType: { 
    type: String, 
    enum: ['Vacation', 'Sick Leave', 'Emergency Leave', 'Special Leave', 'Study Leave'],
    required: true 
  },
  startDate: Date,
  endDate: Date,
  numberOfDays: Number,
  reason: String,
  status: { 
    type: String, 
    enum: ['Pending', 'Approved', 'Rejected'],
    default: 'Pending'
  },
  approvedBy: String,
  approvalDate: Date,
  remarks: String,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});


// Define Travel Order Schema
const travelOrderSchema = new mongoose.Schema({
  travelOrderId: { type: String, required: true, unique: true },
  staffId: { type: String, required: true },
  staffName: String,
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
    enum: ['Pending', 'Approved', 'Rejected', 'Completed'],
    default: 'Pending'
  },
  approvedBy: String,
  approvalDate: Date,
  remarks: String,
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
  period: { type: Date, required: true },
  particulars: { type: String, required: true },
  vlEarned: { type: Number, default: 0 },
  vlAbsentUndertimeWPay: { type: Number, default: 0 },
  slEarned: { type: Number, default: 0 },
  slAbsentUndertimeWPay: { type: Number, default: 0 },
  cto: { type: String },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

// Define Personal Data Sheet Schema
const personalDataSheetSchema = new mongoose.Schema({
  pdsId: { type: String, required: true, unique: true },
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
  status: {
    type: String,
    enum: ['Pending', 'Approved', 'Rejected'],
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
const ServiceRecord = mongoose.model('ServiceRecord', serviceRecordSchema);
const LeaveRecord = mongoose.model('LeaveRecord', leaveRecordSchema);
const PersonalDataSheet = mongoose.model('PersonalDataSheet', personalDataSheetSchema);


// ==================== SYSTEM CONFIGURATION ROUTES ====================

// Get available roles and departments
app.get('/system/roles-and-departments', (req, res) => {
  try {
    const rolesWithDepartments = {};
    
    Object.values(ROLES).forEach(role => {
      rolesWithDepartments[role] = {
        displayName: ROLE_DISPLAY_NAMES[role],
        requiresDepartment: ROLES_WITH_DEPARTMENTS.includes(role),
        departments: ROLES_WITH_DEPARTMENTS.includes(role) ? DEPARTMENTS : null
      };
    });

    res.json({
      roles: rolesWithDepartments,
      departments: DEPARTMENTS
    });
  } catch (error) {
    console.error('Error fetching roles and departments:', error);
    res.status(500).json({ message: 'Failed to fetch roles and departments' });
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
      return res.status(403).json({ message: 'Your account is pending admin approval. Please wait for approval to login.' });
    }

    const roleForToken = normalizeRole(staff.role);

    const token = jwt.sign(
      { id: staff._id, staffId: staff.id, name: staff.name, email: staff.email, role: roleForToken, department: staff.department },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

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


// ==================== PERSONAL DATA SHEET ROUTES ====================

// Submit PDS (public)
app.post('/personal-data-sheets', async (req, res) => {
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
  } = req.body;

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

    const pds = new PersonalDataSheet({
      pdsId,
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
      status: 'Pending',
    });

    await pds.save();
    res.status(201).json({ message: 'Personal Data Sheet submitted successfully', pds });
  } catch (error) {
    console.error('Error submitting PDS:', error);
    res.status(500).json({ message: 'Failed to submit Personal Data Sheet' });
  }
});

// Get PDS submissions (admin)
app.get('/personal-data-sheets', verifyToken, requireRole([ROLES.SUPER_ADMIN, ROLES.ADMIN_HR]), async (req, res) => {
  try {
    const { status } = req.query;
    const filter = {};

    if (status && ['Pending', 'Approved', 'Rejected'].includes(status)) {
      filter.status = status;
    }

    const sheets = await PersonalDataSheet.find(filter).sort({ createdAt: -1 });
    res.json(sheets);
  } catch (error) {
    console.error('Error fetching PDS submissions:', error);
    res.status(500).json({ message: 'Failed to fetch Personal Data Sheets' });
  }
});

// Review PDS submission (admin)
app.patch('/personal-data-sheets/:pdsId/review', verifyToken, requireRole([ROLES.SUPER_ADMIN, ROLES.ADMIN_HR]), async (req, res) => {
  const { pdsId } = req.params;
  const { status, remarks } = req.body;

  if (!['Approved', 'Rejected'].includes(status)) {
    return res.status(400).json({ message: 'Review status must be Approved or Rejected' });
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

// Create Staff (Admin/HR and Super Admin only)
app.post('/staffs', verifyToken, requireRole([ROLES.SUPER_ADMIN, ROLES.ADMIN_HR]), async (req, res) => {
  const { id, name, email, password, role, position, department, phone, dateOfBirth, placeOfBirth, tinNumber, dateHired } = req.body;

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
      department: ROLES_WITH_DEPARTMENTS.includes(role) ? department : null,
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

    // Staff can only view their own profile
    if (userRole === ROLES.STAFF && req.user.staffId === requestedId) {
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

    // Super Admin and Admin/HR can update anyone
    const canUpdate = [ROLES.SUPER_ADMIN, ROLES.ADMIN_HR].includes(userRole);
    
    // Staff can only update their own account
    if (!canUpdate && userRole === ROLES.STAFF) {
      if (userStaffId !== req.params.id) {
        console.log('  Access denied - Staff can only update their own account');
        return res.status(403).json({ message: 'You can only update your own account' });
      }
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

// Reject staff registration (Super Admin, Admin/HR, and Head Officers for their department)
app.patch('/staffs/:id/reject', verifyToken, async (req, res) => {
  try {
    const userRole = req.user.role;
    const userDepartment = req.user.department;

    // Check permission
    if (![ROLES.SUPER_ADMIN, ROLES.ADMIN_HR, ROLES.HEAD_OFFICER].includes(userRole)) {
      return res.status(403).json({ message: 'Access denied. Only admins and head officers can reject staff.' });
    }

    const staff = await Staff.findOne({ id: req.params.id });
    if (!staff) {
      return res.status(404).json({ message: 'Staff not found' });
    }

    // Head Officers can only reject staff in their department
    if (userRole === ROLES.HEAD_OFFICER && staff.department !== userDepartment) {
      return res.status(403).json({ message: 'You can only reject staff in your own department' });
    }

    if (staff.isApproved) {
      return res.status(400).json({ message: 'Cannot reject an already approved staff' });
    }

    const deleted = await Staff.findOneAndDelete({ id: req.params.id });
    res.status(200).json({ message: 'Staff registration rejected and account deleted' });
  } catch (error) {
    console.error('Error rejecting staff:', error);
    res.status(500).json({ message: 'Failed to reject staff registration' });
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


// ==================== LEAVE ROUTES ====================

// File Leave Request (Staff - own requests only)
app.post('/leaves', verifyToken, async (req, res) => {
  const { leaveId, staffId, staffName, leaveType, startDate, endDate, reason } = req.body;

  // Staff can only file leave for themselves
  if (req.user.role === 'staff' && req.user.staffId !== staffId) {
    return res.status(403).json({ message: 'You can only file leave for yourself' });
  }

  if (!leaveId || !staffId || !staffName || !leaveType) {
    return res.status(400).json({ message: 'Staff ID, Name, and Leave Type are required' });
  }

  try {
    const existing = await Leave.findOne({ leaveId });
    if (existing) {
      return res.status(409).json({ message: 'Leave request with this ID already exists' });
    }

    // Calculate number of days if both dates are provided
    let numberOfDays = null;
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      numberOfDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;

      if (numberOfDays <= 0) {
        return res.status(400).json({ message: 'End date must be after start date' });
      }
    }

    const newLeave = new Leave({
      leaveId,
      staffId,
      staffName,
      leaveType,
      startDate: startDate || null,
      endDate: endDate || null,
      numberOfDays,
      reason: reason || null,
    });

    await newLeave.save();
    res.status(201).json({ message: 'Leave request filed successfully', leave: newLeave });
  } catch (error) {
    console.error('Error filing leave:', error);
    res.status(500).json({ message: 'Failed to file leave request' });
  }
});

// Get all leave requests (Super Admin and Admin/HR only)
app.get('/leaves', verifyToken, requireRole([ROLES.SUPER_ADMIN, ROLES.ADMIN_HR]), async (req, res) => {
  try {
    const status = req.query.status;
    const filter = status ? { status } : {};
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
  const { leaveType, startDate, endDate, reason } = req.body;

  try {
    const leave = await Leave.findOne({ leaveId: req.params.leaveId });
    if (!leave) {
      return res.status(404).json({ message: 'Leave request not found' });
    }

    // Staff can only update their own requests
    if (req.user.role === 'staff' && req.user.staffId !== leave.staffId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    if (leave.status !== 'Pending') {
      return res.status(400).json({ message: 'Cannot update an already processed leave request' });
    }

    if (startDate || endDate) {
      const start = new Date(startDate || leave.startDate);
      const end = new Date(endDate || leave.endDate);
      const numberOfDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
      leave.numberOfDays = numberOfDays;
    }

    if (leaveType) leave.leaveType = leaveType;
    if (startDate) leave.startDate = startDate;
    if (endDate) leave.endDate = endDate;
    if (reason) leave.reason = reason;
    leave.updatedAt = Date.now();

    await leave.save();
    res.status(200).json({ message: 'Leave request updated successfully', leave });
  } catch (error) {
    console.error('Error updating leave:', error);
    res.status(500).json({ message: 'Failed to update leave request' });
  }
});

// Approve leave request (Super Admin and Admin/HR only)
app.patch('/leaves/:leaveId/approve', verifyToken, requireRole([ROLES.SUPER_ADMIN, ROLES.ADMIN_HR]), async (req, res) => {
  const { approvedBy, remarks } = req.body;

  if (!approvedBy) {
    return res.status(400).json({ message: 'Approver name is required' });
  }

  try {
    const leave = await Leave.findOneAndUpdate(
      { leaveId: req.params.leaveId },
      {
        $set: {
          status: 'Approved',
          approvedBy,
          approvalDate: Date.now(),
          remarks,
          updatedAt: Date.now(),
        },
      },
      { new: true }
    );

    if (!leave) {
      return res.status(404).json({ message: 'Leave request not found' });
    }

    res.status(200).json({ message: 'Leave request approved', leave });
  } catch (error) {
    console.error('Error approving leave:', error);
    res.status(500).json({ message: 'Failed to approve leave request' });
  }
});

// Reject leave request (Super Admin and Admin/HR only)
app.patch('/leaves/:leaveId/reject', verifyToken, requireRole([ROLES.SUPER_ADMIN, ROLES.ADMIN_HR]), async (req, res) => {
  const { approvedBy, remarks } = req.body;

  if (!approvedBy) {
    return res.status(400).json({ message: 'Rejector name is required' });
  }

  try {
    const leave = await Leave.findOneAndUpdate(
      { leaveId: req.params.leaveId },
      {
        $set: {
          status: 'Rejected',
          approvedBy,
          approvalDate: Date.now(),
          remarks,
          updatedAt: Date.now(),
        },
      },
      { new: true }
    );

    if (!leave) {
      return res.status(404).json({ message: 'Leave request not found' });
    }

    res.status(200).json({ message: 'Leave request rejected', leave });
  } catch (error) {
    console.error('Error rejecting leave:', error);
    res.status(500).json({ message: 'Failed to reject leave request' });
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
  const { travelOrderId, staffId, staffName, destination, purpose, dateFrom, dateTo, transportMode, estimatedBudget } = req.body;

  // Staff can only file travel orders for themselves
  if (req.user.role === 'staff' && req.user.staffId !== staffId) {
    return res.status(403).json({ message: 'You can only file travel orders for yourself' });
  }

  if (!travelOrderId || !staffId || !staffName || !destination || !purpose || !dateFrom || !dateTo || !transportMode) {
    return res.status(400).json({ message: 'All required fields must be provided' });
  }

  try {
    const existing = await TravelOrder.findOne({ travelOrderId });
    if (existing) {
      return res.status(409).json({ message: 'Travel order with this ID already exists' });
    }

    const from = new Date(dateFrom);
    const to = new Date(dateTo);
    const numberOfDays = Math.ceil((to - from) / (1000 * 60 * 60 * 24)) + 1;

    if (numberOfDays <= 0) {
      return res.status(400).json({ message: 'End date must be after start date' });
    }

    const newTravelOrder = new TravelOrder({
      travelOrderId,
      staffId,
      staffName,
      destination,
      purpose,
      dateFrom,
      dateTo,
      numberOfDays,
      transportMode,
      estimatedBudget,
    });

    await newTravelOrder.save();
    res.status(201).json({ message: 'Travel order request filed successfully', travelOrder: newTravelOrder });
  } catch (error) {
    console.error('Error filing travel order:', error);
    res.status(500).json({ message: 'Failed to file travel order request' });
  }
});

// Get all travel orders (Super Admin and Admin/HR only)
app.get('/travel-orders', verifyToken, requireRole([ROLES.SUPER_ADMIN, ROLES.ADMIN_HR]), async (req, res) => {
  try {
    const status = req.query.status;
    const filter = status ? { status } : {};
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
  const { destination, purpose, dateFrom, dateTo, transportMode, estimatedBudget } = req.body;

  try {
    const travelOrder = await TravelOrder.findOne({ travelOrderId: req.params.travelOrderId });
    if (!travelOrder) {
      return res.status(404).json({ message: 'Travel order not found' });
    }

    // Staff can only update their own orders
    if (req.user.role === 'staff' && req.user.staffId !== travelOrder.staffId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    if (travelOrder.status !== 'Pending') {
      return res.status(400).json({ message: 'Cannot update an already processed travel order' });
    }

    if (dateFrom || dateTo) {
      const from = new Date(dateFrom || travelOrder.dateFrom);
      const to = new Date(dateTo || travelOrder.dateTo);
      const numberOfDays = Math.ceil((to - from) / (1000 * 60 * 60 * 24)) + 1;
      travelOrder.numberOfDays = numberOfDays;
    }

    if (destination) travelOrder.destination = destination;
    if (purpose) travelOrder.purpose = purpose;
    if (dateFrom) travelOrder.dateFrom = dateFrom;
    if (dateTo) travelOrder.dateTo = dateTo;
    if (transportMode) travelOrder.transportMode = transportMode;
    if (estimatedBudget) travelOrder.estimatedBudget = estimatedBudget;
    travelOrder.updatedAt = Date.now();

    await travelOrder.save();
    res.status(200).json({ message: 'Travel order updated successfully', travelOrder });
  } catch (error) {
    console.error('Error updating travel order:', error);
    res.status(500).json({ message: 'Failed to update travel order' });
  }
});

// Approve travel order (Super Admin and Admin/HR only)
app.patch('/travel-orders/:travelOrderId/approve', verifyToken, requireRole([ROLES.SUPER_ADMIN, ROLES.ADMIN_HR]), async (req, res) => {
  const { approvedBy, remarks } = req.body;

  if (!approvedBy) {
    return res.status(400).json({ message: 'Approver name is required' });
  }

  try {
    const travelOrder = await TravelOrder.findOneAndUpdate(
      { travelOrderId: req.params.travelOrderId },
      {
        $set: {
          status: 'Approved',
          approvedBy,
          approvalDate: Date.now(),
          remarks,
          updatedAt: Date.now(),
        },
      },
      { new: true }
    );

    if (!travelOrder) {
      return res.status(404).json({ message: 'Travel order not found' });
    }

    res.status(200).json({ message: 'Travel order approved', travelOrder });
  } catch (error) {
    console.error('Error approving travel order:', error);
    res.status(500).json({ message: 'Failed to approve travel order' });
  }
});

// Reject travel order (Super Admin and Admin/HR only)
app.patch('/travel-orders/:travelOrderId/reject', verifyToken, requireRole([ROLES.SUPER_ADMIN, ROLES.ADMIN_HR]), async (req, res) => {
  const { approvedBy, remarks } = req.body;

  if (!approvedBy) {
    return res.status(400).json({ message: 'Rejector name is required' });
  }

  try {
    const travelOrder = await TravelOrder.findOneAndUpdate(
      { travelOrderId: req.params.travelOrderId },
      {
        $set: {
          status: 'Rejected',
          approvedBy,
          approvalDate: Date.now(),
          remarks,
          updatedAt: Date.now(),
        },
      },
      { new: true }
    );

    if (!travelOrder) {
      return res.status(404).json({ message: 'Travel order not found' });
    }

    res.status(200).json({ message: 'Travel order rejected', travelOrder });
  } catch (error) {
    console.error('Error rejecting travel order:', error);
    res.status(500).json({ message: 'Failed to reject travel order' });
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
    
    const records = await LeaveRecord.find({ staffId }).sort({ period: 1 });
    console.log(`[GET /leave-records/staff/:staffId] Found ${records.length} records for staffId: ${staffId}`);
    
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
    const { staffId, staffName, period, particulars, vlEarned, vlAbsentUndertimeWPay, slEarned, slAbsentUndertimeWPay, cto } = req.body;
    
    console.log('[POST /leave-records] Creating record with staffId:', staffId);
    console.log('[POST /leave-records] Request body:', { staffId, staffName, period, particulars });

    if (!staffId || !period || !particulars) {
      return res.status(400).json({ message: 'staffId, period, and particulars are required' });
    }

    const recordId = `LR-${Date.now()}`;
    const newRecord = new LeaveRecord({
      recordId,
      staffId,
      staffName: staffName || 'N/A',
      period: new Date(period),
      particulars,
      vlEarned: parseFloat(vlEarned) || 0,
      vlAbsentUndertimeWPay: parseFloat(vlAbsentUndertimeWPay) || 0,
      slEarned: parseFloat(slEarned) || 0,
      slAbsentUndertimeWPay: parseFloat(slAbsentUndertimeWPay) || 0,
      cto: cto || '',
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
    const { period, particulars, vlEarned, vlAbsentUndertimeWPay, slEarned, slAbsentUndertimeWPay, cto } = req.body;

    const updated = await LeaveRecord.findOneAndUpdate(
      { recordId },
      {
        period: period ? new Date(period) : undefined,
        particulars,
        vlEarned: parseFloat(vlEarned),
        vlAbsentUndertimeWPay: parseFloat(vlAbsentUndertimeWPay),
        slEarned: parseFloat(slEarned),
        slAbsentUndertimeWPay: parseFloat(slAbsentUndertimeWPay),
        cto,
        updatedAt: Date.now(),
      },
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

    if (deleted) {
      console.log('Successfully deleted record:', recordId);
      return res.status(200).json({ message: 'Leave record deleted successfully', data: deleted });
    }
    
    // If not found by recordId, try by MongoDB _id
    try {
      const deletedById = await LeaveRecord.findByIdAndDelete(recordId);
      if (deletedById) {
        console.log('Successfully deleted record by _id:', recordId);
        return res.status(200).json({ message: 'Leave record deleted successfully', data: deletedById });
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



