const mongoose = require('mongoose');
const { nanoid } = require('nanoid');

const programSchema = new mongoose.Schema({
  id: { type: String, default: () => nanoid(10), unique: true },
  title: { type: String, required: true },
  ageRange: { type: String, default: '' },
  schedule: { type: String, default: '' },
  imagePaths: { type: [String], default: [] },
  imagePath: { type: String, default: '' },
  videoUrl: { type: String, default: '' },
  description: { type: String, default: '' },
  createdAt: { type: String, default: () => new Date().toISOString() },
  updatedAt: { type: String, default: () => new Date().toISOString() }
});

const Program = mongoose.models.Program || mongoose.model('Program', programSchema);

function normalizeImagePaths(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean).map(String);
  if (typeof value === 'string') return value.trim() ? [value.trim()] : [];
  return [];
}

async function all() {
  const programs = await Program.find({}).lean();
  return programs.sort((a, b) => a.title.localeCompare(b.title));
}

async function findById(id) {
  return await Program.findOne({ id }).lean();
}

async function create(payload) {
  const paths = normalizeImagePaths(payload.imagePaths ?? payload.imagePath);
  const program = new Program({
    title: payload.title,
    ageRange: payload.ageRange || '',
    schedule: payload.schedule || '',
    imagePaths: paths,
    imagePath: paths[0] || '',
    videoUrl: (payload.videoUrl || '').trim(),
    description: payload.description || ''
  });
  await program.save();
  return program.toObject();
}

async function update(id, payload) {
  const existing = await Program.findOne({ id });
  if (!existing) return null;

  const providedPaths = payload.imagePaths !== undefined ? normalizeImagePaths(payload.imagePaths) : normalizeImagePaths(payload.imagePath ?? existing.imagePath);
  const imagePaths = payload.imagePaths !== undefined ? providedPaths : normalizeImagePaths(existing.imagePaths || existing.imagePath || '');
  
  if (payload.title !== undefined) existing.title = payload.title;
  if (payload.ageRange !== undefined) existing.ageRange = payload.ageRange;
  if (payload.schedule !== undefined) existing.schedule = payload.schedule;
  existing.imagePaths = imagePaths;
  existing.imagePath = imagePaths[0] || '';
  if (payload.videoUrl !== undefined) existing.videoUrl = (payload.videoUrl || '').trim();
  if (payload.description !== undefined) existing.description = payload.description;
  
  existing.updatedAt = new Date().toISOString();
  await existing.save();
  return existing.toObject();
}

async function remove(id) {
  const result = await Program.deleteOne({ id });
  return result.deletedCount > 0;
}

module.exports = { all, findById, create, update, remove, Program };
