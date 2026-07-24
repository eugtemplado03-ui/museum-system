const { load, save } = require('./store');
const { nanoid } = require('nanoid');

function all() {
  return load().gallery.slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

function findById(id) {
  return load().gallery.find(g => g.id === id);
}

function create(payload) {
  const data = load();
  const item = {
    id: nanoid(10),
    title: payload.title || '',
    caption: payload.caption || '',
    imagePath: payload.imagePath || '',
    createdAt: new Date().toISOString()
  };
  data.gallery.push(item);
  save(data);
  return item;
}

function update(id, payload) {
  const data = load();
  const idx = data.gallery.findIndex(g => g.id === id);
  if (idx === -1) return null;
  const existing = data.gallery[idx];
  const updated = {
    ...existing,
    title: payload.title ?? existing.title,
    caption: payload.caption ?? existing.caption,
    imagePath: payload.imagePath ?? existing.imagePath
  };
  data.gallery[idx] = updated;
  save(data);
  return updated;
}

function remove(id) {
  const data = load();
  const before = data.gallery.length;
  data.gallery = data.gallery.filter(g => g.id !== id);
  save(data);
  return data.gallery.length < before;
}

module.exports = { all, findById, create, update, remove };
