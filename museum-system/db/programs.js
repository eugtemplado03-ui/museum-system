const { load, save, normalizeImagePaths } = require('./store');
const { nanoid } = require('nanoid');

function all() {
  return load().programs.slice().sort((a, b) => a.title.localeCompare(b.title));
}

function findById(id) {
  return load().programs.find(p => p.id === id);
}

function create(payload) {
  const data = load();
  const paths = normalizeImagePaths(payload.imagePaths ?? payload.imagePath);
  const program = {
    id: nanoid(10),
    title: payload.title,
    ageRange: payload.ageRange || '',
    schedule: payload.schedule || '',
    imagePaths: paths,
    imagePath: paths[0] || '',
    description: payload.description || '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  data.programs.push(program);
  save(data);
  return program;
}

function update(id, payload) {
  const data = load();
  const idx = data.programs.findIndex(p => p.id === id);
  if (idx === -1) return null;
  const existing = data.programs[idx];
  const providedPaths = payload.imagePaths !== undefined ? normalizeImagePaths(payload.imagePaths) : normalizeImagePaths(payload.imagePath ?? existing.imagePath);
  const imagePaths = payload.imagePaths !== undefined ? providedPaths : normalizeImagePaths(existing.imagePaths || existing.imagePath || '');
  const updated = {
    ...existing,
    title: payload.title ?? existing.title,
    ageRange: payload.ageRange ?? existing.ageRange,
    schedule: payload.schedule ?? existing.schedule,
    imagePaths,
    imagePath: imagePaths[0] || '',
    description: payload.description ?? existing.description,
    updatedAt: new Date().toISOString()
  };
  data.programs[idx] = updated;
  save(data);
  return updated;
}

function remove(id) {
  const data = load();
  const before = data.programs.length;
  data.programs = data.programs.filter(p => p.id !== id);
  save(data);
  return data.programs.length < before;
}

module.exports = { all, findById, create, update, remove };
