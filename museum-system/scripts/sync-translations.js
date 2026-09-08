require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const { Exhibit } = require('../db/exhibits');

async function syncTranslations() {
  console.log('--- SYNCING EXHIBIT TRANSLATIONS TO MONGODB ATLAS ---');

  const dataJsonPath = path.join(__dirname, '../db/data.json');
  if (!fs.existsSync(dataJsonPath)) {
    console.error('db/data.json not found!');
    process.exit(1);
  }

  const localData = JSON.parse(fs.readFileSync(dataJsonPath, 'utf8'));
  const localMap = {};
  localData.exhibits.forEach(ex => {
    localMap[ex.code.toUpperCase()] = ex;
  });

  if (!process.env.MONGODB_URI) {
    console.warn('No MONGODB_URI found, skipping DB sync.');
    process.exit(0);
  }

  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB successfully.');

    const exhibits = await Exhibit.find({});
    console.log(`Found ${exhibits.length} exhibits in MongoDB.`);

    for (const ex of exhibits) {
      const code = (ex.code || '').toUpperCase();
      const local = localMap[code];
      if (local) {
        const updateFields = {
          description_tl: local.description_tl || ex.description_tl || '',
          description_cb: local.description_cb || ex.description_cb || '',
          description_hil: local.description_hil || ex.description_hil || ''
        };
        await Exhibit.updateOne({ _id: ex._id }, { $set: updateFields });
        console.log(`Synced translations for ${ex.code} (${ex.title}): TL=${!!updateFields.description_tl}, CB=${!!updateFields.description_cb}`);
      }
    }

    console.log('All MongoDB exhibits synchronized with curated translations.');
  } catch (err) {
    console.error('MongoDB sync error:', err.message);
  } finally {
    await mongoose.disconnect();
  }

  process.exit(0);
}

syncTranslations();
