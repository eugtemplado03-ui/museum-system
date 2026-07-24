const { load, save } = require('./store');
const { nanoid } = require('nanoid');

function all() {
  // Newest event date first; events without a parsable date fall to the end.
  return load().events.slice().sort((a, b) => {
    const da = Date.parse(a.date), db = Date.parse(b.date);
    if (isNaN(da) && isNaN(db)) return 0;
    if (isNaN(da)) return 1;
    if (isNaN(db)) return -1;
    return db - da;
  });
}

function findById(id) {
  return load().events.find(e => e.id === id);
}

function create(payload) {
  const data = load();
  const event = {
    id: nanoid(10),
    title: payload.title,
    date: payload.date || '',
    location: payload.location || '',
    imagePath: payload.imagePath || '',
    description: payload.description || '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  data.events.push(event);
  save(data);
  return event;
}

function update(id, payload) {
  const data = load();
  const idx = data.events.findIndex(e => e.id === id);
  if (idx === -1) return null;
  const existing = data.events[idx];
  const updated = {
    ...existing,
    title: payload.title ?? existing.title,
    date: payload.date ?? existing.date,
    location: payload.location ?? existing.location,
    imagePath: payload.imagePath ?? existing.imagePath,
    description: payload.description ?? existing.description,
    updatedAt: new Date().toISOString()
  };
  data.events[idx] = updated;
  save(data);
  return updated;
}

function remove(id) {
  const data = load();
  const before = data.events.length;
  data.events = data.events.filter(e => e.id !== id);
  save(data);
  return data.events.length < before;
}

module.exports = { all, findById, create, update, remove };
