// Script to migrate old LeaveRecord documents to ensure dateRanges is set based on startDate/endDate/period
// Usage: node migrate_leave_record_date_ranges.js

const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/filingSystem';

const leaveRecordSchema = new mongoose.Schema({
  recordId: String,
  period: Date,
  dateRanges: [
    {
      from: Date,
      to: Date,
    },
  ],
  sourceLeaveId: String,
});

const leaveSchema = new mongoose.Schema({
  leaveId: String,
  startDate: Date,
  endDate: Date,
  dateRanges: [
    {
      startDate: Date,
      endDate: Date,
      from: Date,
      to: Date,
    },
  ],
});

const LeaveRecord = mongoose.model('LeaveRecord', leaveRecordSchema, 'leaverecords');
const Leave = mongoose.model('Leave', leaveSchema, 'leaves');

async function migrate() {
  await mongoose.connect(MONGO_URI);
  const records = await LeaveRecord.find({ $or: [ { dateRanges: { $exists: false } }, { dateRanges: { $size: 0 } } ] });
  let updated = 0;

  for (const rec of records) {
    let dateRanges = [];
    // Try to get from linked Leave document
    if (rec.sourceLeaveId) {
      const leave = await Leave.findOne({ leaveId: rec.sourceLeaveId });
      if (leave) {
        if (Array.isArray(leave.dateRanges) && leave.dateRanges.length > 0) {
          dateRanges = leave.dateRanges.map(r => ({
            from: r.from || r.startDate,
            to: r.to || r.endDate || r.from || r.startDate
          }));
        } else if (leave.startDate && leave.endDate) {
          dateRanges = [{ from: leave.startDate, to: leave.endDate }];
        } else if (leave.startDate) {
          dateRanges = [{ from: leave.startDate, to: leave.startDate }];
        }
      }
    }
    // Fallback: use period as single date
    if (dateRanges.length === 0 && rec.period) {
      dateRanges = [{ from: rec.period, to: rec.period }];
    }
    if (dateRanges.length > 0) {
      rec.dateRanges = dateRanges;
      await rec.save();
      updated++;
      console.log(`Updated recordId ${rec.recordId} with dateRanges:`, dateRanges);
    }
  }
  console.log(`Migration complete. Updated ${updated} records.`);
  await mongoose.disconnect();
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
