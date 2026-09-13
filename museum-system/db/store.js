// Lightweight embedded JSON database with Cloudinary persistence.
// On Render (ephemeral filesystem), local files are wiped on restart.
// This module backs up data.json to Cloudinary on every save and
// restores it on startup, so your data survives restarts.

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

// ─── Cloudinary helpers ──────────────────────────────────────────────────────
let cloudinary = null;
const CLOUDINARY_DB_PUBLIC_ID = 'museum_db/data_json';

function getCloudinary() {
  if (cloudinary) return cloudinary;
  if (process.env.CLOUDINARY_CLOUD_NAME) {
    cloudinary = require('cloudinary').v2;
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key:    process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET
    });
    return cloudinary;
  }
  return null;
}

// Upload data.json to Cloudinary as a raw file (non-blocking, fire-and-forget)
let _uploadQueued = false;
let _uploadTimer = null;

function uploadToCloudinary(data) {
  const cld = getCloudinary();
  if (!cld) return;

  // Debounce: wait 2 seconds after last save to batch rapid writes
  _uploadQueued = true;
  if (_uploadTimer) clearTimeout(_uploadTimer);
  _uploadTimer = setTimeout(() => {
    _uploadQueued = false;
    _uploadTimer = null;

    const jsonStr = JSON.stringify(data, null, 2);
    const stream = cld.uploader.upload_stream(
      {
        public_id: CLOUDINARY_DB_PUBLIC_ID,
        resource_type: 'raw',
        overwrite: true,
        invalidate: true
      },
      (err) => {
        if (err) console.error('[DB] Cloudinary backup failed:', err.message);
        else     console.log('[DB] Cloudinary backup saved.');
      }
    );
    stream.end(Buffer.from(jsonStr, 'utf-8'));
  }, 2000);
}

// Download data.json from Cloudinary (blocking, used only at startup)
async function downloadFromCloudinary() {
  const cld = getCloudinary();
  if (!cld) return null;

  try {
    // 10-second timeout so server doesn't hang
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Cloudinary restore timed out (10s)')), 10000)
    );

    const restorePromise = (async () => {
      // Get the resource info to find the secure URL
      const resource = await cld.api.resource(CLOUDINARY_DB_PUBLIC_ID, { resource_type: 'raw' });
      const url = resource.secure_url;

      // Fetch the raw JSON
      const controller = new AbortController();
      const fetchTimeout = setTimeout(() => controller.abort(), 8000);
      const resp = await fetch(url + '?t=' + Date.now(), { signal: controller.signal });
      clearTimeout(fetchTimeout);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const text = await resp.text();
      return JSON.parse(text);
    })();

    const data = await Promise.race([restorePromise, timeoutPromise]);
    console.log('[DB] Restored data.json from Cloudinary backup.');
    return data;
  } catch (e) {
    if (e.message && e.message.includes('not found')) {
      console.log('[DB] No Cloudinary backup found — starting fresh.');
    } else {
      console.warn('[DB] Could not restore from Cloudinary:', e.message);
    }
    return null;
  }
}


// ─── Core database functions ─────────────────────────────────────────────────

function defaultData() {
  return { users: [], exhibits: [], categories: [], favorites: [], ratings: [], scanEvents: [], programs: [], events: [], gallery: [], visitors: [], artifactLogs: [] };
}

// Synchronous load — used everywhere in the app
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

// Async restore — called once at startup before the server begins listening
async function restoreFromCloud() {
  const cloudData = await downloadFromCloudinary();
  if (cloudData) {
    // Backfill any missing collections
    for (const key of Object.keys(defaultData())) {
      if (!Array.isArray(cloudData[key])) { cloudData[key] = []; }
    }
    // Write to local disk so synchronous load() calls work
    const tmp = DB_FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(cloudData, null, 2));
    fs.renameSync(tmp, DB_FILE);
    console.log('[DB] Local data.json restored from cloud backup.');
    return true;
  }
  return false;
}

function save(data) {
  // atomic-ish write: write to temp file then rename
  const tmp = DB_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, DB_FILE);

  // Async backup to Cloudinary (debounced, non-blocking)
  uploadToCloudinary(data);
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

module.exports = { load, save, restoreFromCloud, DB_FILE, normalizeImagePaths, getPrimaryImagePath };
