require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const { Exhibit, KNOWN_EXHIBIT_DIRECTIONS, computeDefaultDirections } = require('../db/exhibits');

async function syncDirections() {
  console.log('--- SYNCING EXHIBIT DIRECTIONS ---');

  // 1. Update db/data.json and public/data.json
  const filePaths = [
    path.join(__dirname, '../db/data.json'),
    path.join(__dirname, '../public/data.json')
  ];

  filePaths.forEach(filePath => {
    if (fs.existsSync(filePath)) {
      try {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        if (Array.isArray(data.exhibits)) {
          data.exhibits.forEach(ex => {
            ex.directions = KNOWN_EXHIBIT_DIRECTIONS[ex.code.toUpperCase()] || computeDefaultDirections(ex);
          });
          fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
          console.log(`Updated directions in ${filePath}`);
        }
      } catch (err) {
        console.error(`Error updating ${filePath}:`, err.message);
      }
    }
  });

  // 2. Update MongoDB if connected
  if (process.env.MONGODB_URI) {
    try {
      console.log('Connecting to MongoDB...');
      await mongoose.connect(process.env.MONGODB_URI);
      console.log('Connected to MongoDB.');

      const exhibits = await Exhibit.find({});
      for (const ex of exhibits) {
        const dir = KNOWN_EXHIBIT_DIRECTIONS[ex.code.toUpperCase()] || computeDefaultDirections(ex);
        await Exhibit.updateOne({ _id: ex._id }, { $set: { directions: dir } });
        console.log(`Updated directions for ${ex.code} (${ex.title}) in MongoDB.`);
      }
      console.log('MongoDB exhibits synchronized successfully.');
    } catch (err) {
      console.error('MongoDB sync error:', err.message);
    }
  }

  console.log('Directions sync complete!');
  process.exit(0);
}

syncDirections();
