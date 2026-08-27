require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

const users = require('../db/users');
const exhibits = require('../db/exhibits');
const programs = require('../db/programs');
const events = require('../db/events');
const gallery = require('../db/gallery');
const ratings = require('../db/ratings');
const visitors = require('../db/visitors');
const artifactLogs = require('../db/artifact-logs');
const museumInfo = require('../db/museum-info');
const analytics = require('../db/analytics');
const favorites = require('../db/favorites');

async function migrate() {
  try {
    if (!process.env.MONGODB_URI) {
      console.error('Missing MONGODB_URI. Make sure your .env is configured.');
      process.exit(1);
    }

    const dataPath = process.env.DATA_DIR 
      ? path.join(process.env.DATA_DIR, 'data.json') 
      : path.join(__dirname, '../db/data.json');
      
    if (!fs.existsSync(dataPath)) {
      console.log('No data.json found. Nothing to migrate.');
      process.exit(0);
    }
    
    const raw = fs.readFileSync(dataPath, 'utf-8');
    const data = JSON.parse(raw);
    
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB.');

    if (data.users && data.users.length > 0) {
      await users.User.insertMany(data.users);
      console.log(`Migrated ${data.users.length} users.`);
    }

    if (data.categories && data.categories.length > 0) {
      const cats = data.categories.map(c => ({ name: c }));
      await exhibits.Category.insertMany(cats);
      console.log(`Migrated ${data.categories.length} categories.`);
    }

    if (data.exhibits && data.exhibits.length > 0) {
      await exhibits.Exhibit.insertMany(data.exhibits);
      console.log(`Migrated ${data.exhibits.length} exhibits.`);
    }

    if (data.programs && data.programs.length > 0) {
      await programs.Program.insertMany(data.programs);
      console.log(`Migrated ${data.programs.length} programs.`);
    }

    if (data.events && data.events.length > 0) {
      await events.Event.insertMany(data.events);
      console.log(`Migrated ${data.events.length} events.`);
    }

    if (data.gallery && data.gallery.length > 0) {
      await gallery.Gallery.insertMany(data.gallery);
      console.log(`Migrated ${data.gallery.length} gallery items.`);
    }

    if (data.ratings && data.ratings.length > 0) {
      await ratings.Rating.insertMany(data.ratings);
      console.log(`Migrated ${data.ratings.length} ratings.`);
    }

    if (data.visitors && data.visitors.length > 0) {
      await visitors.Visitor.insertMany(data.visitors);
      console.log(`Migrated ${data.visitors.length} visitors.`);
    }

    if (data.artifactLogs && data.artifactLogs.length > 0) {
      await artifactLogs.ArtifactLog.insertMany(data.artifactLogs);
      console.log(`Migrated ${data.artifactLogs.length} artifact logs.`);
    }

    if (data.scanEvents && data.scanEvents.length > 0) {
      await analytics.ScanEvent.insertMany(data.scanEvents);
      console.log(`Migrated ${data.scanEvents.length} scan events.`);
    }

    if (data.favorites && data.favorites.length > 0) {
      await favorites.Favorite.insertMany(data.favorites);
      console.log(`Migrated ${data.favorites.length} favorites.`);
    }

    if (data.museumInfo) {
      data.museumInfo.id = 'singleton';
      await museumInfo.MuseumInfo.updateOne({ id: 'singleton' }, data.museumInfo, { upsert: true });
      console.log(`Migrated museum info.`);
    }

    console.log('Migration completed successfully.');
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    await mongoose.connection.close();
  }
}

migrate();
