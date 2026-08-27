// Lightweight embedded JSON database.
// Chosen over better-sqlite3 / native modules so this project runs anywhere
// with zero build tools required. Swap for Postgres/MySQL later if you scale up —
// the query functions below are the only place that would need to change.

const fs = require('fs');
const path = require('path');

const DB_FILE = process.env.DATA_DIR 
  ? path.join(process.env.DATA_DIR, 'data.json') 
  : path.join(__dirname, 'data.json');

// Ensure parent directory exists for volume mounts
const dbDir = path.dirname(DB_FILE);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

function defaultData() {
  return { users: [], exhibits: [], categories: [], favorites: [], ratings: [], scanEvents: [], programs: [], events: [], gallery: [], visitors: [], artifactLogs: [] };
}

function load() {
  if (!fs.existsSync(DB_FILE)) {
    save(defaultData());
  }
  const raw = fs.readFileSync(DB_FILE, 'utf-8');
  let data;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    console.error('Corrupt db file, resetting to default.', e);
    data = defaultData();
    save(data);
    return data;
  }
  // Backfill collections added in later versions so existing installs
  // don't crash when upgrading.
  let changed = false;
  for (const key of Object.keys(defaultData())) {
    if (!Array.isArray(data[key])) { data[key] = []; changed = true; }
  }
  if (changed) save(data);
  return data;
}

function save(data) {
  // atomic-ish write: write to temp file then rename
  const tmp = DB_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, DB_FILE);
}

function normalizeImagePaths(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean).map(String);
  if (typeof value === 'string') return value.trim() ? [value.trim()] : [];
  return [];
}

function getPrimaryImagePath(item) {
  if (!item) return '';
  if (Array.isArray(item)) return item[0] || '';
  if (Array.isArray(item.optimizedImagePaths) && item.optimizedImagePaths.length) return item.optimizedImagePaths[0];
  if (Array.isArray(item.imagePaths) && item.imagePaths.length) return item.imagePaths[0];
  if (item.optimizedImagePath) return item.optimizedImagePath;
  return item.imagePath || '';
}

module.exports = { load, save, DB_FILE, normalizeImagePaths, getPrimaryImagePath };
