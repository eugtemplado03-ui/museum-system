require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const { Exhibit } = require('../db/exhibits');

async function sync() {
  try {
    if (!process.env.MONGODB_URI) {
      console.log('No MONGODB_URI set.');
      process.exit(0);
    }
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB.');

    const dataPath = path.join(__dirname, '../db/data.json');
    const data = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));

    for (const item of data.exhibits) {
      const res = await Exhibit.updateOne(
        { code: item.code },
        {
          $set: {
            floor: item.floor || 1,
            pinX: item.pinX,
            pinY: item.pinY,
            mapZone: item.mapZone,
            location: item.location
          }
        }
      );
      console.log(`Updated ${item.code} (${item.title}): matched ${res.matchedCount}, modified ${res.modifiedCount}`);
    }

    console.log('All exhibit map fields synchronized to MongoDB successfully!');
    process.exit(0);
  } catch (err) {
    console.error('Sync failed:', err);
    process.exit(1);
  }
}

sync();
