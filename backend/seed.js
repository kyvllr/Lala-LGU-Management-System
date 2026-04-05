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
        id: 'HRO001',
        name: 'Head Officer - Municipal General Services',
        email: 'head.generalservices@lgu.gov',
        password: 'HRO_0',
        role: ROLES.HEAD_REQUISITIONING_OFFICE,
        position: 'Head of Requisitioning Office',
        department: 'General Services',
      },
      {
        id: 'MBO001',
        name: 'Municipal Budget Officer',
        email: 'mbo@lgu.gov',
        password: 'MBO_0',
        role: ROLES.MUNICIPAL_BUDGET_OFFICER,
        position: 'Municipal Budget Officer',
        department: 'Budget',
      },
      {
        id: 'MA001',
        name: 'Municipal Assessor',
        email: 'assessor@lgu.gov',
        password: 'MA_0',
        role: ROLES.MUNICIPAL_ASSESSOR,
        position: 'Municipal Assessor',
        department: 'Assessor',
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
        name: 'Head Officer - Municipal Engineering',
        email: 'head.engineeringoffice@lgu.gov',
        password: 'Head_0',
        role: ROLES.HEAD_OFFICER,
        position: 'Head Officer',
        department: 'Engineering',
      },
      {
        id: 'HO002',
        name: 'Head Officer - Local Civil Registrar',
        email: 'head.lcr@lgu.gov',
        password: 'Head_0',
        role: ROLES.HEAD_OFFICER,
        position: 'Head Officer',
        department: 'LCR',
      },
      {
        id: 'STAFF001',
        name: 'Staff Member - Municipal Engineering',
        email: 'staff.engineeringoffice@lgu.gov',
        password: 'Staff_0',
        role: ROLES.STAFF,
        position: 'Staff',
        department: 'Engineering',
      },
      {
        id: 'STAFF002',
        name: 'Staff Member - Municipal Administrator',
        email: 'staff.administrator@lgu.gov',
        password: 'Staff_0',
        role: ROLES.STAFF,
        position: 'Staff',
        department: 'Administrator',
      }
    ];

    // Create or update accounts safely
    for (const account of testAccounts) {
      try {
        const hashedPassword = await bcrypt.hash(account.password, 10);
        const updatePayload = {
          name: account.name,
          email: account.email,
          password: hashedPassword,
          role: account.role,
          position: account.position,
          department: account.department,
          isApproved: true,
          approvedAt: Date.now(),
          approvedBy: 'System (Seed)',
        };

        const existingById = await Staff.findOne({ id: account.id });

        if (existingById) {
          const conflictByEmail = await Staff.findOne({
            email: account.email,
            id: { $ne: account.id },
          });

          if (conflictByEmail) {
            console.log(`⚠️  Skipped ${account.id}: email ${account.email} is already used by ${conflictByEmail.id}`);
            continue;
          }

          await Staff.updateOne({ id: account.id }, { $set: updatePayload });
          console.log(`↺ ${ROLE_DISPLAY_NAMES[account.role]} account updated`);
          console.log(`  ID: ${account.id}`);
          console.log(`  Email: ${account.email}`);
          if (account.department) {
            console.log(`  Department: ${account.department}`);
          }
          continue;
        }

        const existingByEmail = await Staff.findOne({ email: account.email });
        if (existingByEmail) {
          await Staff.updateOne(
            { email: account.email },
            {
              $set: {
                id: account.id,
                ...updatePayload,
              },
            }
          );
          console.log(`↺ ${ROLE_DISPLAY_NAMES[account.role]} account updated (migrated from ${existingByEmail.id} to ${account.id})`);
          console.log(`  ID: ${account.id}`);
          console.log(`  Email: ${account.email}`);
          if (account.department) {
            console.log(`  Department: ${account.department}`);
          }
          continue;
        }

        const newAccount = new Staff({
          id: account.id,
          ...updatePayload,
        });

        await newAccount.save();
        console.log(`✓ ${ROLE_DISPLAY_NAMES[account.role]} account created`);
        console.log(`  ID: ${account.id}`);
        console.log(`  Email: ${account.email}`);
        console.log(`  Password: ${account.password}`);
        if (account.department) {
          console.log(`  Department: ${account.department}`);
        }
      } catch (accountError) {
        console.log(`⚠️  Skipped ${account.id}: ${accountError.message}`);
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
