require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const { Exhibit, Category } = require('../db/exhibits');

async function main() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected.');

  // Updates mapping:
  const updates = [
    { code: 'EX-001', category: 'Marine & Nature', mapZone: 'marine_story' },
    { code: 'EX-002', category: 'Marine & Nature', mapZone: 'marine_story' },
    { code: 'EX-007', category: 'Marine & Nature', mapZone: 'marine_story' },
    { code: 'EX-008', category: 'Marine & Nature', mapZone: 'marine_story' },
    { code: 'EX-011', category: 'Marine & Nature', mapZone: 'marine_story' },
    { code: 'EX-003', category: 'Touch & Play', mapZone: 'splash_zone' },
    { code: 'EX-004', category: 'Character & Heritage', mapZone: 'office_extension' },
    { code: 'EX-005', category: 'Character & Heritage', mapZone: 'office_extension' },
    { code: 'EX-010', category: 'Reading & Learning', mapZone: 'office_extension' },
    { code: 'EX-006', category: 'Toys & Collections', mapZone: 'second_floor_toys' },
    { code: 'EX-009', category: 'Touch & Play', mapZone: 'second_floor_carnival' }
  ];

  for (const u of updates) {
    await Exhibit.updateOne({ code: u.code }, { $set: { category: u.category, mapZone: u.mapZone } });
    console.log(`Updated ${u.code} in MongoDB to category: ${u.category}, mapZone: ${u.mapZone}`);
  }

  // Also update db/data.json and public/data.json
  const dbDataPath = path.join(__dirname, '../db/data.json');
  const pubDataPath = path.join(__dirname, '../public/data.json');

  [dbDataPath, pubDataPath].forEach(filePath => {
    if (fs.existsSync(filePath)) {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      if (Array.isArray(data.exhibits)) {
        data.exhibits.forEach(ex => {
          const match = updates.find(u => u.code === ex.code);
          if (match) {
            ex.category = match.category;
            ex.mapZone = match.mapZone;
          }
        });
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
        console.log(`Updated ${filePath}`);
      }
    }
  });

  console.log('Category and Room updates complete!');
  process.exit(0);
}

main().catch(err => {
  console.error('Error updating categories/rooms:', err);
  process.exit(1);
});
