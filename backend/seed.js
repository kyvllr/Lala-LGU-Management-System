const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
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
    enum: ['staff', 'admin'],
    default: 'staff'
  },
  position: String,
  department: String,
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

async function seedAdmin() {
  try {
    console.log('Connecting to MongoDB Atlas...');
    await mongoose.connect(MONGODB_URI);
    console.log('✓ Connected to MongoDB Atlas');

    // Check if admin already exists
    const existingAdmin = await Staff.findOne({ email: 'admin@lgu.gov' });
    if (existingAdmin) {
      console.log('✓ Admin account already exists');
      console.log('  Email: admin@lgu.gov');
      console.log('  ID: ' + existingAdmin.id);
      await mongoose.connection.close();
      return;
    }

    // Create admin account
    const hashedPassword = await bcrypt.hash('Admin_0', 10);
    const adminAccount = new Staff({
      id: 'ADMIN001',
      name: 'System Administrator',
      email: 'admin@lgu.gov',
      password: hashedPassword,
      role: 'admin',
      position: 'Administrator',
      department: 'Administration',
      isApproved: true,
      approvedAt: Date.now(),
      approvedBy: 'System',
    });

    await adminAccount.save();
    console.log('✓ Admin account created successfully');
    console.log('  Email: admin@lgu.gov');
    console.log('  Password: Admin_0');
    console.log('  ID: ADMIN001');
    console.log('\n⚠️  IMPORTANT: Change the password after first login!');

    await mongoose.connection.close();
    console.log('✓ Connection closed');
  } catch (error) {
    console.error('✗ Error seeding admin account:', error.message);
    process.exit(1);
  }
}

seedAdmin();
