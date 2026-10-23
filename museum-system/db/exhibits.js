// Persistence, normalization, and category/direction helpers for museum exhibits.
const mongoose = require('mongoose');
const { nanoid } = require('nanoid');

const categorySchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true }
});
const Category = mongoose.models.Category || mongoose.model('Category', categorySchema);

const exhibitSchema = new mongoose.Schema({
  id: { type: String, default: () => nanoid(10), unique: true },
  code: { type: String, required: true, unique: true },
  title: { type: String, required: true },
  category: { type: String, default: 'Other' },
  origin: { type: String, default: '' },
  year: { type: String, default: '' },
  location: { type: String, default: '' },
  lat: { type: Number, default: null },
  lng: { type: Number, default: null },
  floor: { type: Number, default: 1 },
  pinX: { type: Number, default: null },
  pinY: { type: Number, default: null },
  mapZone: { type: String, default: '' },
  mapImagePath: { type: String, default: '' },
  imagePaths: { type: [String], default: [] },
  imagePath: { type: String, default: '' },
  videoUrl: { type: String, default: '' },
  directions: { type: String, default: '' },
  description: { type: String, default: '' },
  description_tl: { type: String, default: '' },
  description_cb: { type: String, default: '' },
  description_hil: { type: String, default: '' },
  createdAt: { type: String, default: () => new Date().toISOString() },
  updatedAt: { type: String, default: () => new Date().toISOString() }
});
const Exhibit = mongoose.models.Exhibit || mongoose.model('Exhibit', exhibitSchema);

const DEFAULT_CATEGORIES = [
  'Marine & Nature', 'Aquarium & Live Reef Systems', 'Touch & Play', 'Toys & Collections',
  'Character & Heritage', 'Environmental', 'Reading & Learning', 'Other'
];

// Escape user-provided text before embedding it in a regular-expression query.
function escapeRegex(str) {
  return String(str || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Accept both the current image-path array and the legacy single-path value.
function normalizeImagePaths(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean).map(String);
  if (typeof value === 'string') return value.trim() ? [value.trim()] : [];
  return [];
}

// Allocate the next sequential EX-NNN code from the current catalog.
async function nextCode() {
  const exhibits = await Exhibit.find({}, { code: 1 }).lean();
  let max = 0;
  exhibits.forEach(e => {
    const n = parseInt((e.code || '').split('-')[1], 10);
    if (!isNaN(n) && n > max) max = n;
  });
  return 'EX-' + String(max + 1).padStart(3, '0');
}

// Initialize category records from defaults and any categories already in the catalog.
async function ensureCategories() {
  const count = await Category.countDocuments();
  if (count === 0) {
    const exhibits = await Exhibit.find({}, { category: 1 }).lean();
    const existing = Array.from(new Set(exhibits.map(e => String(e.category || '').trim()).filter(Boolean)));
    const combined = Array.from(new Set([...DEFAULT_CATEGORIES, ...existing]));
    for (const name of combined) {
      await Category.updateOne({ name: name }, { name: name }, { upsert: true });
    }
  }
  const aquariumCategory = 'Aquarium & Live Reef Systems';
  await Category.updateOne(
    { name: aquariumCategory },
    { $setOnInsert: { name: aquariumCategory } },
    { upsert: true }
  );
}

// Resolves the architectural room of an exhibit based on its floor plan pin coordinates and metadata.
function resolveExhibitRoom(item) {
  if (!item) return null;
  const floor = Number(item.floor) === 2 ? 2 : 1;
  const x = Number(item.pinX);
  const y = Number(item.pinY);
  const cat = String(item.category || '').toLowerCase();
  const zone = String(item.mapZone || '').toLowerCase();
  const loc = String(item.location || '').toLowerCase();
  const title = String(item.title || '').toLowerCase();

  // 0. Outdoor exhibits — these are behind/outside the building, not on the floor plan
  if (loc.includes('outdoor') || loc.includes('behind') || title.includes('mangrove walk') || title.includes('outdoor')) {
    return 'cat_outdoor';
  }

  // 1. High-confidence title/category/location checks (before pin, to avoid mismapped pins)
  if (cat.includes('reading') || loc.includes('reading corner') || loc.includes('reading nook') ||
      title.includes('reading corner') || title.includes('franco') || title.includes('reading nook')) {
    return 'cat_reading_learning';
  }

  // 2. Precise blueprint coordinates (matching public/map.html CAD floor plan)
  if (Number.isFinite(x) && Number.isFinite(y)) {
    if (floor === 2) {
      if (x <= 49) return 'cat_toys_collections';
      return 'cat_carnival_play';
    } else {
      if (x >= 76) return 'cat_touch_play'; // East Wing (Touch & Play / Splash Zone)
      if (x <= 24 && y >= 53) return 'cat_character_heritage'; // West Wing South (Character & Heritage)
      if (x <= 24 && y < 53) return 'cat_reading_learning'; // West Wing North (Reading & Learning)
      if (y <= 20) return 'cat_aquarium_live_reef'; // North Wing (Aquarium & Live Reef)
      return 'cat_marine_nature'; // Central North Wing (Marine & Nature / Under the Sea)
    }
  }

  // 3. Map zone identifier
  if (zone.includes('splash') || zone.includes('touch')) return 'cat_touch_play';
  if (zone.includes('aquarium')) return 'cat_aquarium_live_reef';
  if (zone.includes('marine')) return 'cat_marine_nature';
  if (zone.includes('reading')) return 'cat_reading_learning';
  if (zone.includes('heritage') || zone.includes('maranon')) return 'cat_character_heritage';
  if (zone.includes('toys')) return 'cat_toys_collections';
  if (zone.includes('carnival')) return 'cat_carnival_play';

  // 4. Category, location, or title
  if (cat.includes('splash') || cat.includes('touch') || loc.includes('touch') || loc.includes('splash')) return 'cat_touch_play';
  if (cat.includes('aquarium') || loc.includes('aquarium') || title.includes('aquarium') || title.includes('tetra') || title.includes('turtle') || title.includes('angelfish')) return 'cat_aquarium_live_reef';
  if (cat.includes('marine') || cat.includes('sea') || cat.includes('river') || loc.includes('marine') || loc.includes('river')) return 'cat_marine_nature';
  if (loc.includes('library') || title.includes('library')) return 'cat_reading_learning';
  if (cat.includes('character') || cat.includes('heritage') || loc.includes('heritage') || loc.includes('memorial') || loc.includes('marañon') || loc.includes('maranon') || title.includes('marañon') || title.includes('maranon') || title.includes('hero')) return 'cat_character_heritage';
  if (cat.includes('toy') || loc.includes('toy') || loc.includes('hampanganan') || title.includes('toy') || title.includes('lego') || title.includes('plushie')) return 'cat_toys_collections';
  if (cat.includes('carnival') || cat.includes('discovery') || cat.includes('environmental') || loc.includes('carnival') || loc.includes('discovery') || title.includes('carnival') || title.includes('food stall')) return 'cat_carnival_play';

  if (floor === 2) return 'cat_toys_collections';
  return 'cat_marine_nature';
}

function isDirectionsMismatched(item) {
  if (!item || !item.directions || typeof item.directions !== 'string' || !item.directions.trim()) return true;
  const dir = item.directions.toLowerCase();
  const floor = Number(item.floor) === 2 ? 2 : 1;
  const expectedRoom = resolveExhibitRoom(item);

  // Floor mismatch: Ground floor exhibit pointing to Level 2
  if (floor === 1 && (dir.includes('level 2') || dir.includes('second floor') || dir.includes('staircase on the left') || dir.includes('stairs up'))) {
    return true;
  }
  // Floor mismatch: Level 2 exhibit not mentioning Level 2 or stairs
  if (floor === 2 && !dir.includes('level 2') && !dir.includes('second floor') && !dir.includes('stair')) {
    return true;
  }

  // Room mismatches
  if (expectedRoom === 'cat_touch_play') {
    if (dir.includes('library extension') || dir.includes('character & heritage') || dir.includes('toys & collections') || dir.includes('carnival & discovery') || dir.includes('marine & nature')) {
      return true;
    }
  } else if (expectedRoom === 'cat_aquarium_live_reef') {
    if (dir.includes('east wing') || dir.includes('library extension') || dir.includes('character & heritage') || dir.includes('toys & collections') || dir.includes('carnival & discovery')) {
      return true;
    }
  } else if (expectedRoom === 'cat_marine_nature') {
    if (dir.includes('east wing') || dir.includes('library extension') || dir.includes('character & heritage') || dir.includes('toys & collections') || dir.includes('carnival & discovery')) {
      return true;
    }
  } else if (expectedRoom === 'cat_reading_learning' || expectedRoom === 'cat_character_heritage') {
    if (dir.includes('east wing') || dir.includes('marine & nature') || dir.includes('toys & collections') || dir.includes('carnival & discovery')) {
      return true;
    }
  } else if (expectedRoom === 'cat_toys_collections') {
    if (dir.includes('carnival & discovery') || dir.includes('east wing') || dir.includes('ground floor')) {
      return true;
    }
  } else if (expectedRoom === 'cat_carnival_play') {
    if (dir.includes('toys & collections') || dir.includes('ground floor')) {
      return true;
    }
  }

  return false;
}

const KNOWN_EXHIBIT_DIRECTIONS = {
  'EX-001': "From the Main Entrance, walk straight across the central Function Hall and enter the double arched doorway directly ahead into the Marine & Nature Room (Ground Floor). Located in the center and right side, by the coral reef displays.",
  'EX-002': "From the Main Entrance, walk straight across the central Function Hall and enter the double arched doorway directly ahead into the Marine & Nature Room (Ground Floor). Located along the left wall by the freshwater river basin.",
  'EX-003': "From the Main Entrance, turn right into the East Wing corridor and enter the first door on the right into the Touch & Play Room (Ground Floor). You will find the live touch pool basin in the center."
};

// Supply museum-specific walking directions based on the exhibit's true location on the blueprint map.
function computeDefaultDirections(item) {
  if (!item) return '';
  const roomId = resolveExhibitRoom(item);
  const x = Number(item.pinX);
  const loc = String(item.location || '').toLowerCase();
  const title = String(item.title || '').toLowerCase();

  switch (roomId) {
    case 'cat_outdoor':
      return "Exit through the Main Entrance and follow the path around to the back of the museum building. The outdoor exhibit is located in the garden area behind the main structure.";

    case 'cat_touch_play':
      return "From the Main Entrance, walk forward into the central Function Hall and turn right into the East Wing corridor. Enter the Touch & Play Room (Ground Floor) to find the interactive live touch pool basin.";

    case 'cat_aquarium_live_reef':
      return "From the Main Entrance, walk straight across the central Function Hall through the double arched doorway into the Marine & Nature Room. Continue straight to the north end into the Aquarium & Live Reef Systems gallery (Ground Floor) featuring tropical saltwater tanks and live habitats.";

    case 'cat_marine_nature':
      if (Number.isFinite(x) && x > 55) {
        return "From the Main Entrance, walk straight across the central Function Hall and enter through the double arched doorway directly ahead into the Marine & Nature Room (Ground Floor). Located on the right side by the Under the Sea coral reef displays.";
      }
      if (Number.isFinite(x) && x <= 55) {
        return "From the Main Entrance, walk straight across the central Function Hall and enter through the double arched doorway directly ahead into the Marine & Nature Room (Ground Floor). Located along the left wall by the freshwater river basin section.";
      }
      if (loc.includes('river') || title.includes('river')) {
        return "From the Main Entrance, walk straight across the central Function Hall and enter through the double arched doorway directly ahead into the Marine & Nature Room (Ground Floor). Located along the left wall by the freshwater river basin section.";
      }
      return "From the Main Entrance, walk straight across the central Function Hall and enter through the double arched doorway directly ahead into the Marine & Nature Room (Ground Floor).";

    case 'cat_reading_learning':
      return "From the Main Entrance, turn left down the corridor into the Library Extension wing (Ground Floor). Enter the Reading & Learning Room to find Franco's Reading Corner.";

    case 'cat_character_heritage':
      if (loc.includes('memorial') || title.includes('marañon') || title.includes('maranon')) {
        return "From the Main Entrance, turn left down the corridor into the Library Extension wing (Ground Floor). Enter the Character & Heritage Room (beside the Staff Office) to find the Governor Joseph G. Marañon memorial section.";
      }
      return "From the Main Entrance, turn left down the corridor into the Library Extension wing (Ground Floor). Enter the Character & Heritage Room (beside the Staff Office) to find the community everyday heroes showcase.";

    case 'cat_toys_collections':
      return "From the Main Entrance, take the staircase on the left (above the Staff Office) up to Level 2 (Second Floor). Turn left through the doorway into the Toys & Collections Room (Hampanganan).";

    case 'cat_carnival_play':
      return "From the Main Entrance, take the staircase on the left up to Level 2 (Second Floor). Walk across the upper walkway overlooking the central hall to the right wing into the Carnival & Discovery Room.";

    default:
      if (Number(item.floor) === 2) {
        return "From the Main Entrance, take the staircase on the left up to Level 2 (Second Floor).";
      }
      return "From the Main Entrance, walk straight across the central Function Hall into the main gallery.";
  }
}

let curatedData = null;
try {
  curatedData = require('./data.json');
} catch (e) {}

// Convert a Mongoose/plain record and fill missing or mismatched directions or curated translations.
function enrichExhibit(doc) {
  if (!doc) return doc;
  const obj = typeof doc.toObject === 'function' ? doc.toObject() : { ...doc };
  if (!obj.directions || isDirectionsMismatched(obj)) {
    obj.directions = computeDefaultDirections(obj);
  }
  if ((!obj.description_tl || !obj.description_cb) && curatedData && Array.isArray(curatedData.exhibits)) {
    const matched = curatedData.exhibits.find(e => 
      (e.code && obj.code && e.code.toUpperCase() === obj.code.toUpperCase()) || 
      (e.id && obj.id && e.id === obj.id)
    );
    if (matched) {
      if (!obj.description_tl && matched.description_tl) obj.description_tl = matched.description_tl;
      if (!obj.description_cb && matched.description_cb) obj.description_cb = matched.description_cb;
      if (!obj.description_hil && matched.description_hil) obj.description_hil = matched.description_hil;
    }
  }
  return obj;
}

// Return exhibits in code order, enriched with derived directions and translations.
async function all() {
  const exhibits = await Exhibit.find({}).lean();
  return exhibits.map(enrichExhibit).sort((a, b) => a.code.localeCompare(b.code));
}

// Find an exhibit by case-insensitive code and enrich its display fields.
async function findByCode(code) {
  const safeCode = escapeRegex(code);
  const doc = await Exhibit.findOne({ code: { $regex: new RegExp(`^${safeCode}$`, 'i') } }).lean();
  return enrichExhibit(doc);
}

// Find an exhibit by ID and enrich its display fields.
async function findById(id) {
  const doc = await Exhibit.findOne({ id }).lean();
  return enrichExhibit(doc);
}

// Create an exhibit with the next code and normalized map/media values.
async function create(payload) {
  const paths = normalizeImagePaths(payload.imagePaths ?? payload.imagePath);
  const exhibit = new Exhibit({
    code: await nextCode(),
    title: payload.title,
    category: payload.category || 'Other',
    origin: payload.origin || '',
    year: payload.year || '',
    location: payload.location || '',
    directions: payload.directions !== undefined && payload.directions !== null ? payload.directions : computeDefaultDirections(payload),
    lat: payload.lat !== undefined && payload.lat !== '' && payload.lat !== null && !isNaN(Number(payload.lat)) ? parseFloat(payload.lat) : null,
    lng: payload.lng !== undefined && payload.lng !== '' && payload.lng !== null && !isNaN(Number(payload.lng)) ? parseFloat(payload.lng) : null,
    floor: payload.floor !== undefined && payload.floor !== '' && payload.floor !== null && !isNaN(parseInt(payload.floor, 10)) ? parseInt(payload.floor, 10) : 1,
    pinX: payload.pinX !== undefined && payload.pinX !== '' && payload.pinX !== null && !isNaN(Number(payload.pinX)) ? parseFloat(payload.pinX) : null,
    pinY: payload.pinY !== undefined && payload.pinY !== '' && payload.pinY !== null && !isNaN(Number(payload.pinY)) ? parseFloat(payload.pinY) : null,
    mapZone: payload.mapZone || '',
    mapImagePath: payload.mapImagePath || '',
    imagePaths: paths,
    imagePath: paths[0] || '',
    videoUrl: payload.videoUrl ? String(payload.videoUrl).trim() : '',
    description: payload.description || '',
    description_tl: payload.description_tl || '',
    description_cb: payload.description_cb || ''
  });
  await exhibit.save();
  return enrichExhibit(exhibit);
}

// Update supplied exhibit fields while preserving media paths and derived defaults.
async function update(id, payload) {
  const existing = await Exhibit.findOne({ id });
  if (!existing) return null;

  const providedPaths = payload.imagePaths !== undefined ? normalizeImagePaths(payload.imagePaths) : normalizeImagePaths(payload.imagePath ?? existing.imagePath);
  const imagePaths = payload.imagePaths !== undefined ? providedPaths : normalizeImagePaths(existing.imagePaths || existing.imagePath || '');
  
  if (payload.title !== undefined) existing.title = payload.title;
  if (payload.category !== undefined) existing.category = payload.category;
  if (payload.origin !== undefined) existing.origin = payload.origin;
  if (payload.year !== undefined) existing.year = payload.year;
  if (payload.location !== undefined) existing.location = payload.location;
  if (payload.directions !== undefined) existing.directions = payload.directions;
  
  if (payload.lat !== undefined) {
    existing.lat = (payload.lat !== '' && payload.lat !== null && !isNaN(Number(payload.lat))) ? parseFloat(payload.lat) : null;
  }
  if (payload.lng !== undefined) {
    existing.lng = (payload.lng !== '' && payload.lng !== null && !isNaN(Number(payload.lng))) ? parseFloat(payload.lng) : null;
  }
  if (payload.floor !== undefined) {
    existing.floor = (payload.floor !== '' && payload.floor !== null && !isNaN(parseInt(payload.floor, 10))) ? parseInt(payload.floor, 10) : 1;
  }
  if (payload.pinX !== undefined) {
    existing.pinX = (payload.pinX !== '' && payload.pinX !== null && !isNaN(Number(payload.pinX))) ? parseFloat(payload.pinX) : null;
  }
  if (payload.pinY !== undefined) {
    existing.pinY = (payload.pinY !== '' && payload.pinY !== null && !isNaN(Number(payload.pinY))) ? parseFloat(payload.pinY) : null;
  }
  if (payload.mapZone !== undefined) existing.mapZone = payload.mapZone;
  if (payload.mapImagePath !== undefined) existing.mapImagePath = payload.mapImagePath;
  
  existing.imagePaths = imagePaths;
  existing.imagePath = imagePaths[0] || '';
  if (payload.videoUrl !== undefined) existing.videoUrl = String(payload.videoUrl).trim();
  if (payload.description !== undefined) existing.description = payload.description;
  if (payload.description_tl !== undefined) existing.description_tl = payload.description_tl;
  if (payload.description_cb !== undefined) existing.description_cb = payload.description_cb;
  
  existing.updatedAt = new Date().toISOString();
  await existing.save();
  return enrichExhibit(existing);
}

// Delete an exhibit and report whether it existed.
async function remove(id) {
  const result = await Exhibit.deleteOne({ id });
  return result.deletedCount > 0;
}

// Ensure category records exist, then return their names.
async function categories() {
  await ensureCategories();
  const cats = await Category.find({}).lean();
  return cats.map(c => c.name);
}

// Add a trimmed category unless a case-insensitive match already exists.
async function addCategory(category) {
  const value = String(category || '').trim();
  if (!value) return null;
  await ensureCategories();
  const safeVal = escapeRegex(value);
  const exists = await Category.findOne({ name: { $regex: new RegExp(`^${safeVal}$`, 'i') } });
  if (exists) return null;
  const newCat = new Category({ name: value });
  await newCat.save();
  return value;
}

// Rename a category, merging into an existing match and updating affected exhibits.
async function updateCategory(oldCategory, newCategory) {
  const oldValue = String(oldCategory || '').trim();
  const newValue = String(newCategory || '').trim();
  if (!oldValue || !newValue) return null;
  if (oldValue === newValue) return oldValue;

  await ensureCategories();
  const safeOld = escapeRegex(oldValue);
  const safeNew = escapeRegex(newValue);
  const oldCat = await Category.findOne({ name: { $regex: new RegExp(`^${safeOld}$`, 'i') } });
  if (!oldCat) return null;

  const duplicate = await Category.findOne({ name: { $regex: new RegExp(`^${safeNew}$`, 'i') } });
  if (duplicate && duplicate._id.toString() !== oldCat._id.toString()) {
    await Category.deleteOne({ _id: oldCat._id });
  } else {
    oldCat.name = newValue;
    await oldCat.save();
  }

  await Exhibit.updateMany(
    { category: { $regex: new RegExp(`^${safeOld}$`, 'i') } },
    { $set: { category: newValue } }
  );

  return newValue;
}

// Remove a category and move its exhibits to a remaining category or "Other".
async function deleteCategory(category) {
  const value = String(category || '').trim();
  if (!value) return false;
  await ensureCategories();
  const safeVal = escapeRegex(value);
  const oldCat = await Category.findOne({ name: { $regex: new RegExp(`^${safeVal}$`, 'i') } });
  if (!oldCat) return false;

  await Category.deleteOne({ _id: oldCat._id });

  let cats = await Category.find({}).lean();
  let fallback = 'Other';
  if (cats.length > 0) {
    fallback = cats.some(c => c.name === 'Other') ? 'Other' : cats[0].name;
  } else {
    const defaultCat = new Category({ name: 'Other' });
    await defaultCat.save();
    fallback = 'Other';
  }

  await Exhibit.updateMany(
    { category: { $regex: new RegExp(`^${safeVal}$`, 'i') } },
    { $set: { category: fallback } }
  );

  return true;
}

// Ensure the category exists and assign all supplied exhibit IDs to it.
async function assignExhibitsToCategory(category, exhibitIds) {
  const catName = String(category || '').trim();
  if (!catName) return false;
  await ensureCategories();
  const safeName = escapeRegex(catName);
  const exists = await Category.findOne({ name: { $regex: new RegExp(`^${safeName}$`, 'i') } });
  if (!exists) {
    const newCat = new Category({ name: catName });
    await newCat.save();
  }
  
  const idSet = Array.isArray(exhibitIds) ? exhibitIds : [];
  await Exhibit.updateMany(
    { id: { $in: idSet } },
    { $set: { category: catName, updatedAt: new Date().toISOString() } }
  );
  
  return true;
}

// Return the current exhibit count without loading exhibit records.
async function countDocuments() {
  return await Exhibit.countDocuments();
}

module.exports = { all, findByCode, findById, create, update, remove, categories, addCategory, updateCategory, deleteCategory, assignExhibitsToCategory, Exhibit, Category, countDocuments, computeDefaultDirections, resolveExhibitRoom, isDirectionsMismatched, KNOWN_EXHIBIT_DIRECTIONS };
