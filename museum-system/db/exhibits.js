const { load, save, normalizeImagePaths } = require('./store');
const { nanoid } = require('nanoid');

const DEFAULT_CATEGORIES = [
  'Marine & Nature', 'Touch & Play', 'Toys & Collections',
  'Character & Heritage', 'Environmental', 'Reading & Learning', 'Other'
];

function nextCode(exhibits) {
  let max = 0;
  exhibits.forEach(e => {
    const n = parseInt((e.code || '').split('-')[1], 10);
    if (!isNaN(n) && n > max) max = n;
  });
  return 'EX-' + String(max + 1).padStart(3, '0');
}

function ensureCategories(data) {
  if (!Array.isArray(data.categories) || data.categories.length === 0) {
    const existing = Array.from(new Set(
      (Array.isArray(data.exhibits) ? data.exhibits : [])
        .map(e => String(e.category || '').trim())
        .filter(Boolean)
    ));
    const combined = Array.from(new Set([...DEFAULT_CATEGORIES, ...existing]));
    data.categories = combined;
    save(data);
  }
  return data.categories;
}

function all() {
  return load().exhibits.sort((a, b) => a.code.localeCompare(b.code));
}

function findByCode(code) {
  return load().exhibits.find(e => e.code.toLowerCase() === String(code).toLowerCase());
}

function findById(id) {
  return load().exhibits.find(e => e.id === id);
}

function create(payload) {
  const data = load();
  const paths = normalizeImagePaths(payload.imagePaths ?? payload.imagePath);
  const exhibit = {
    id: nanoid(10),
    code: nextCode(data.exhibits),
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
    description_cb: payload.description_cb || '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  data.exhibits.push(exhibit);
  save(data);
  return exhibit;
}

function update(id, payload) {
  const data = load();
  const idx = data.exhibits.findIndex(e => e.id === id);
  if (idx === -1) return null;
  const existing = data.exhibits[idx];
  const providedPaths = payload.imagePaths !== undefined ? normalizeImagePaths(payload.imagePaths) : normalizeImagePaths(payload.imagePath ?? existing.imagePath);
  const imagePaths = payload.imagePaths !== undefined ? providedPaths : normalizeImagePaths(existing.imagePaths || existing.imagePath || '');
  const updated = {
    ...existing,
    title: payload.title ?? existing.title,
    category: payload.category ?? existing.category,
    origin: payload.origin ?? existing.origin,
    year: payload.year ?? existing.year,
    location: payload.location ?? existing.location,
    lat: payload.lat !== undefined && payload.lat !== '' ? parseFloat(payload.lat) : existing.lat ?? null,
    lng: payload.lng !== undefined && payload.lng !== '' ? parseFloat(payload.lng) : existing.lng ?? null,
    mapImagePath: payload.mapImagePath !== undefined ? payload.mapImagePath : existing.mapImagePath || '',
    imagePaths,
    imagePath: imagePaths[0] || '',
    description: payload.description ?? existing.description,
    description_tl: payload.description_tl ?? existing.description_tl,
    description_cb: payload.description_cb ?? existing.description_cb,
    updatedAt: new Date().toISOString()
  };
  data.exhibits[idx] = updated;
  save(data);
  return updated;
}

function remove(id) {
  const data = load();
  const before = data.exhibits.length;
  data.exhibits = data.exhibits.filter(e => e.id !== id);
  save(data);
  return data.exhibits.length < before;
}

function categories() {
  const data = load();
  ensureCategories(data);
  const exhibitCats = Array.from(new Set(
    (Array.isArray(data.exhibits) ? data.exhibits : [])
      .map(e => String(e.category || '').trim())
      .filter(Boolean)
  ));
  return Array.from(new Set([...(data.categories || []), ...exhibitCats]));
}

function addCategory(category) {
  const value = String(category || '').trim();
  if (!value) return null;
  const data = load();
  ensureCategories(data);
  if (data.categories.some(c => c.toLowerCase() === value.toLowerCase())) return null;
  data.categories.push(value);
  save(data);
  return value;
}

function updateCategory(oldCategory, newCategory) {
  const oldValue = String(oldCategory || '').trim();
  const newValue = String(newCategory || '').trim();
  if (!oldValue || !newValue) return null;
  if (oldValue === newValue) return oldValue;

  const data = load();
  ensureCategories(data);
  const oldIndex = data.categories.findIndex(c => c.toLowerCase() === oldValue.toLowerCase());
  if (oldIndex === -1) return null;

  const duplicateIndex = data.categories.findIndex(c => c.toLowerCase() === newValue.toLowerCase());
  if (duplicateIndex !== -1 && duplicateIndex !== oldIndex) {
    // Merge: remove old category entry
    data.categories.splice(oldIndex, 1);
  } else {
    data.categories[oldIndex] = newValue;
  }

  data.exhibits = data.exhibits.map(e => {
    if (e.category && e.category.toLowerCase() === oldValue.toLowerCase()) {
      return { ...e, category: newValue };
    }
    return e;
  });
  save(data);
  return newValue;
}

function deleteCategory(category) {
  const value = String(category || '').trim();
  if (!value) return false;
  const data = load();
  ensureCategories(data);
  const index = data.categories.findIndex(c => c.toLowerCase() === value.toLowerCase());
  if (index === -1) return false;

  const deletedName = data.categories[index];
  data.categories.splice(index, 1);

  let fallback = 'Other';
  if (data.categories.length > 0) {
    fallback = data.categories.includes('Other') ? 'Other' : data.categories[0];
  } else {
    data.categories.push('Other');
    fallback = 'Other';
  }

  data.exhibits = data.exhibits.map(e => {
    if (e.category && e.category.toLowerCase() === deletedName.toLowerCase()) {
      return { ...e, category: fallback };
    }
    return e;
  });
  save(data);
  return true;
}

function assignExhibitsToCategory(category, exhibitIds) {
  const catName = String(category || '').trim();
  if (!catName) return false;
  const data = load();
  ensureCategories(data);
  if (!data.categories.some(c => c.toLowerCase() === catName.toLowerCase())) {
    data.categories.push(catName);
  }
  const idSet = new Set(Array.isArray(exhibitIds) ? exhibitIds : []);
  data.exhibits = data.exhibits.map(e => {
    if (idSet.has(e.id)) {
      return { ...e, category: catName, updatedAt: new Date().toISOString() };
    }
    return e;
  });
  save(data);
  return true;
}

module.exports = { all, findByCode, findById, create, update, remove, categories, addCategory, updateCategory, deleteCategory, assignExhibitsToCategory };
