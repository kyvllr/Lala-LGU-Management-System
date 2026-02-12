const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { ROLES, DEPARTMENTS, ROLE_DISPLAY_NAMES } = require('./constants');
require('dotenv').config();

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error('Error: MONGODB_URI environment variable is not set');
  process.exit(1);
}

// Staff Schema
const staffSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { 
    type: String, 
    enum: Object.values(ROLES),
    default: ROLES.STAFF,
    required: true
  },
  department: {
    type: String,
    enum: DEPARTMENTS,
    sparse: true
  },
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

const Staff = mongoose.model('Staff', staffSchema);

async function seedAccounts() {
  try {
    console.log('Connecting to MongoDB Atlas...');
    await mongoose.connect(MONGODB_URI);
    console.log('✓ Connected to MongoDB Atlas');

    // Define test accounts
    const testAccounts = [
      {
        id: 'SADMIN001',
        name: 'Mayor/System Administrator',
        email: 'mayor@lgu.gov',
        password: 'Admin_0',
        role: ROLES.SUPER_ADMIN,
        position: 'Mayor',
        department: null,
      },
      {
        id: 'HADMIN001',
        name: 'HR Administrator',
        email: 'admin@lgu.gov',
        password: 'Admin_0',
        role: ROLES.ADMIN_HR,
        position: 'HR Administrator',
        department: null,
      },
      {
        id: 'JOO001',
        name: 'Job Order Officer',
        email: 'jooofficer@lgu.gov',
        password: 'Officer_0',
        role: ROLES.JOB_ORDER_OFFICER,
        position: 'Job Order Officer',
        department: null,
      },
      {
        id: 'HO001',
        name: 'Head Officer - Engineering',
        email: 'head.engineering@lgu.gov',
        password: 'Head_0',
        role: ROLES.HEAD_OFFICER,
        position: 'Head Officer',
        department: 'Engineering',
      },
      {
        id: 'HO002',
        name: 'Head Officer - LCR',
        email: 'head.lcr@lgu.gov',
        password: 'Head_0',
        role: ROLES.HEAD_OFFICER,
        position: 'Head Officer',
        department: 'LCR',
      },
      {
        id: 'STAFF001',
        name: 'Staff Member - Engineering',
        email: 'staff.engineering@lgu.gov',
        password: 'Staff_0',
        role: ROLES.STAFF,
        position: 'Staff',
        department: 'Engineering',
      },
      {
        id: 'STAFF002',
        name: 'Staff Member - HR',
        email: 'staff.hr@lgu.gov',
        password: 'Staff_0',
        role: ROLES.STAFF,
        position: 'Staff',
        department: 'HR',
      }
    ];

    // Create accounts
    for (const account of testAccounts) {
      const existing = await Staff.findOne({ email: account.email });
      if (existing) {
        console.log(`⚠️  ${account.email} already exists`);
        continue;
      }

      const hashedPassword = await bcrypt.hash(account.password, 10);
      const newAccount = new Staff({
        id: account.id,
        name: account.name,
        email: account.email,
        password: hashedPassword,
        role: account.role,
        position: account.position,
        department: account.department,
        isApproved: true,
        approvedAt: Date.now(),
        approvedBy: 'System (Seed)',
      });

      await newAccount.save();
      console.log(`✓ ${ROLE_DISPLAY_NAMES[account.role]} account created`);
      console.log(`  Email: ${account.email}`);
      console.log(`  Password: ${account.password}`);
      if (account.department) {
        console.log(`  Department: ${account.department}`);
      }
    }

    console.log('\n✓ All test accounts created successfully');
    console.log('\n⚠️  IMPORTANT: Change passwords after first login!');

    await mongoose.connection.close();
    console.log('✓ Connection closed');
  } catch (error) {
    console.error('✗ Error seeding accounts:', error.message);
    process.exit(1);
  }
}

seedAccounts();
