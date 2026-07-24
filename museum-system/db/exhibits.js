const { load, save } = require('./store');
const { nanoid } = require('nanoid');

function nextCode(exhibits) {
  let max = 0;
  exhibits.forEach(e => {
    const n = parseInt((e.code || '').split('-')[1], 10);
    if (!isNaN(n) && n > max) max = n;
  });
  return 'EX-' + String(max + 1).padStart(3, '0');
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
  const exhibit = {
    id: nanoid(10),
    code: nextCode(data.exhibits),
    title: payload.title,
    category: payload.category || 'Other',
    origin: payload.origin || '',
    year: payload.year || '',
    location: payload.location || '',
    imagePath: payload.imagePath || '',
    description: payload.description || '',
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
  const updated = {
    ...existing,
    title: payload.title ?? existing.title,
    category: payload.category ?? existing.category,
    origin: payload.origin ?? existing.origin,
    year: payload.year ?? existing.year,
    location: payload.location ?? existing.location,
    imagePath: payload.imagePath ?? existing.imagePath,
    description: payload.description ?? existing.description,
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

module.exports = { all, findByCode, findById, create, update, remove };
