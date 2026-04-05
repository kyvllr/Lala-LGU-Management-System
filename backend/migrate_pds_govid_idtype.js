// Script to backfill missing PersonalDataSheet govId.idType values.
// Usage: node migrate_pds_govid_idtype.js

const mongoose = require('mongoose');
require('dotenv').config();

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/filingSystem';

async function migrate() {
  await mongoose.connect(MONGO_URI);

  const collection = mongoose.connection.db.collection('personaldatasheets');

  const cursor = collection.find(
    {
      $or: [
        { 'govId.idType': { $exists: false } },
        { 'govId.idType': '' },
        { 'govId.idType': null },
      ],
    },
    {
      projection: {
        _id: 1,
        pdsId: 1,
        govId: 1,
      },
    }
  );

  let inspected = 0;
  let updated = 0;

  while (await cursor.hasNext()) {
    const doc = await cursor.next();
    inspected += 1;

    const currentGovId = doc.govId || {};
    const legacyType = typeof currentGovId.type === 'string' ? currentGovId.type.trim() : '';
    const existingIdType = typeof currentGovId.idType === 'string' ? currentGovId.idType.trim() : '';
    const hasOtherGovIdData = Boolean((currentGovId.number || '').toString().trim() || (currentGovId.datePlace || '').toString().trim());

    if (existingIdType) {
      continue;
    }

    const nextIdType = legacyType || (hasOtherGovIdData ? 'N/A' : '');
    if (!nextIdType) {
      continue;
    }

    await collection.updateOne(
      { _id: doc._id },
      {
        $set: {
          'govId.idType': nextIdType,
          updatedAt: new Date(),
        },
      }
    );

    updated += 1;
    console.log(`Updated ${doc.pdsId || doc._id}: govId.idType -> ${nextIdType}`);
  }

  console.log(`Migration complete. Inspected ${inspected} records, updated ${updated} records.`);
  await mongoose.disconnect();
}

migrate().catch((error) => {
  console.error('Migration failed:', error);
  process.exit(1);
});
