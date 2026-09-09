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
  'Marine & Nature', 'Touch & Play', 'Toys & Collections',
  'Character & Heritage', 'Environmental', 'Reading & Learning', 'Other'
];

function normalizeImagePaths(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean).map(String);
  if (typeof value === 'string') return value.trim() ? [value.trim()] : [];
  return [];
}

async function nextCode() {
  const exhibits = await Exhibit.find({}, { code: 1 }).lean();
  let max = 0;
  exhibits.forEach(e => {
    const n = parseInt((e.code || '').split('-')[1], 10);
    if (!isNaN(n) && n > max) max = n;
  });
  return 'EX-' + String(max + 1).padStart(3, '0');
}

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
}

const KNOWN_EXHIBIT_DIRECTIONS = {
  'EX-001': "From the Main Entrance, walk straight across the central Function Hall and enter the double arched doorway directly ahead into the Marine & Nature Room (Ground Floor). Located in the center and right side, by the coral reef displays.",
  'EX-002': "From the Main Entrance, walk straight across the central Function Hall and enter the double arched doorway directly ahead into the Marine & Nature Room (Ground Floor). Located along the left wall by the freshwater river basin.",
  'EX-003': "From the Main Entrance, turn right into the East Wing corridor and enter the first door on the right into the Touch & Play Room (Ground Floor). You will find the live touch pool basin in the center.",
  'EX-004': "From the Main Entrance, turn left down the West Wing corridor into the Library Extension wing, and enter the Character & Heritage Room (Ground Floor). Located along the wall gallery of community heroes.",
  'EX-005': "From the Main Entrance, turn left down the West Wing corridor into the Library Extension wing, and enter the Character & Heritage Room (Ground Floor, beside the Staff Office). Located in the memorial gallery section.",
  'EX-006': "From the Main Entrance, take the main staircase on the left (above the Staff Office) up to Level 2 (Second Floor). Turn left through the first door into the Toys & Collections Room.",
  'EX-007': "From the Main Entrance, walk straight across the central Function Hall and enter the double arched doorway directly ahead into the Marine & Nature Room (Ground Floor). Located along the rear species wall.",
  'EX-008': "From the Main Entrance, walk straight across the central Function Hall and enter the double arched doorway directly ahead into the Marine & Nature Room (Ground Floor). Located in the eco-conservation corner beside the fishing net art installation.",
  'EX-009': "From the Main Entrance, take the staircase on the left up to Level 2 (Second Floor). Cross the upper corridor walkway overlooking the central hall to the right wing into the Carnival & Discovery Room.",
  'EX-010': "From the Main Entrance, turn left down the West Wing corridor past the restrooms, and enter the first door on the left into the Library Extension to find Franco's Reading Corner (Ground Floor).",
  'EX-011': "From the Main Entrance, walk straight across the central Function Hall and enter the double arched doorway directly ahead into the Marine & Nature Room (Ground Floor). Located in the coastal mangrove habitat section."
};

function computeDefaultDirections(item) {
  if (!item) return '';
  if (item.code && KNOWN_EXHIBIT_DIRECTIONS[item.code.toUpperCase()]) {
    return KNOWN_EXHIBIT_DIRECTIONS[item.code.toUpperCase()];
  }
  const cat = String(item.category || '').toLowerCase();
  const zone = String(item.mapZone || '').toLowerCase();
  const floor = item.floor === 2 ? 2 : 1;

  if (cat.includes('marine') || zone === 'marine_story') {
    return "From the Main Entrance, walk straight across the central Function Hall through the double arched doorway into the Marine & Nature Room (Ground Floor).";
  }
  if (cat.includes('touch') || zone === 'splash_zone') {
    return "From the Main Entrance, turn right into the East Wing corridor and enter the first door on the right into the Touch & Play Room (Ground Floor).";
  }
  if (cat.includes('reading') || zone === 'office_extension') {
    return "From the Main Entrance, turn left down the West Wing corridor and enter the first door on the left into the Library Extension (Ground Floor).";
  }
  if (cat.includes('character') || cat.includes('heritage')) {
    return "From the Main Entrance, turn left down the West Wing corridor into the Library Extension, and enter the Character & Heritage Room (Ground Floor).";
  }
  if (cat.includes('toy') || zone === 'second_floor_toys') {
    return "From the Main Entrance, take the stairs on the left up to Level 2, turn left through the first door into the Toys & Collections Room (Second Floor).";
  }
  if (cat.includes('carnival') || zone === 'second_floor_carnival') {
    return "From the Main Entrance, take the stairs on the left up to Level 2, cross the upper walkway to the right wing into the Carnival & Discovery Room (Second Floor).";
  }
  if (floor === 2) {
    return "From the Main Entrance, take the staircase on the left up to Level 2 (Second Floor).";
  }
  return "From the Main Entrance, proceed through the reception foyer into the main gallery.";
}

let curatedData = null;
try {
  curatedData = require('./data.json');
} catch (e) {}

function enrichExhibit(doc) {
  if (!doc) return doc;
  const obj = typeof doc.toObject === 'function' ? doc.toObject() : { ...doc };
  if (!obj.directions) {
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

async function all() {
  const exhibits = await Exhibit.find({}).lean();
  return exhibits.map(enrichExhibit).sort((a, b) => a.code.localeCompare(b.code));
}

async function findByCode(code) {
  const doc = await Exhibit.findOne({ code: { $regex: new RegExp(`^${code}$`, 'i') } }).lean();
  return enrichExhibit(doc);
}

async function findById(id) {
  const doc = await Exhibit.findOne({ id }).lean();
  return enrichExhibit(doc);
}

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

async function remove(id) {
  const result = await Exhibit.deleteOne({ id });
  return result.deletedCount > 0;
}

async function categories() {
  await ensureCategories();
  const cats = await Category.find({}).lean();
  return cats.map(c => c.name);
}

async function addCategory(category) {
  const value = String(category || '').trim();
  if (!value) return null;
  await ensureCategories();
  const exists = await Category.findOne({ name: { $regex: new RegExp(`^${value}$`, 'i') } });
  if (exists) return null;
  const newCat = new Category({ name: value });
  await newCat.save();
  return value;
}

async function updateCategory(oldCategory, newCategory) {
  const oldValue = String(oldCategory || '').trim();
  const newValue = String(newCategory || '').trim();
  if (!oldValue || !newValue) return null;
  if (oldValue === newValue) return oldValue;

  await ensureCategories();
  const oldCat = await Category.findOne({ name: { $regex: new RegExp(`^${oldValue}$`, 'i') } });
  if (!oldCat) return null;

  const duplicate = await Category.findOne({ name: { $regex: new RegExp(`^${newValue}$`, 'i') } });
  if (duplicate && duplicate._id.toString() !== oldCat._id.toString()) {
    await Category.deleteOne({ _id: oldCat._id });
  } else {
    oldCat.name = newValue;
    await oldCat.save();
  }

  await Exhibit.updateMany(
    { category: { $regex: new RegExp(`^${oldValue}$`, 'i') } },
    { $set: { category: newValue } }
  );

  return newValue;
}

async function deleteCategory(category) {
  const value = String(category || '').trim();
  if (!value) return false;
  await ensureCategories();
  const oldCat = await Category.findOne({ name: { $regex: new RegExp(`^${value}$`, 'i') } });
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
    { category: { $regex: new RegExp(`^${value}$`, 'i') } },
    { $set: { category: fallback } }
  );

  return true;
}

async function assignExhibitsToCategory(category, exhibitIds) {
  const catName = String(category || '').trim();
  if (!catName) return false;
  await ensureCategories();
  const exists = await Category.findOne({ name: { $regex: new RegExp(`^${catName}$`, 'i') } });
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

async function countDocuments() {
  return await Exhibit.countDocuments();
}

module.exports = { all, findByCode, findById, create, update, remove, categories, addCategory, updateCategory, deleteCategory, assignExhibitsToCategory, Exhibit, Category, countDocuments, computeDefaultDirections, KNOWN_EXHIBIT_DIRECTIONS };
