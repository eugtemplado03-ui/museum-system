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
  mapImagePath: { type: String, default: '' },
  imagePaths: { type: [String], default: [] },
  imagePath: { type: String, default: '' },
  description: { type: String, default: '' },
  description_tl: { type: String, default: '' },
  description_cb: { type: String, default: '' },
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

async function all() {
  const exhibits = await Exhibit.find({}).lean();
  return exhibits.sort((a, b) => a.code.localeCompare(b.code));
}

async function findByCode(code) {
  return await Exhibit.findOne({ code: { $regex: new RegExp(`^${code}$`, 'i') } }).lean();
}

async function findById(id) {
  return await Exhibit.findOne({ id }).lean();
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
    lat: payload.lat !== undefined && payload.lat !== '' ? parseFloat(payload.lat) : null,
    lng: payload.lng !== undefined && payload.lng !== '' ? parseFloat(payload.lng) : null,
    mapImagePath: payload.mapImagePath || '',
    imagePaths: paths,
    imagePath: paths[0] || '',
    description: payload.description || '',
    description_tl: payload.description_tl || '',
    description_cb: payload.description_cb || ''
  });
  await exhibit.save();
  return exhibit.toObject();
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
  if (payload.lat !== undefined && payload.lat !== '') existing.lat = parseFloat(payload.lat);
  if (payload.lng !== undefined && payload.lng !== '') existing.lng = parseFloat(payload.lng);
  if (payload.mapImagePath !== undefined) existing.mapImagePath = payload.mapImagePath;
  
  existing.imagePaths = imagePaths;
  existing.imagePath = imagePaths[0] || '';
  if (payload.description !== undefined) existing.description = payload.description;
  if (payload.description_tl !== undefined) existing.description_tl = payload.description_tl;
  if (payload.description_cb !== undefined) existing.description_cb = payload.description_cb;
  
  existing.updatedAt = new Date().toISOString();
  await existing.save();
  return existing.toObject();
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

module.exports = { all, findByCode, findById, create, update, remove, categories, addCategory, updateCategory, deleteCategory, assignExhibitsToCategory, Exhibit, Category, countDocuments };
