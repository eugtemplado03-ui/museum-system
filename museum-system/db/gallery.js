const mongoose = require('mongoose');
const { nanoid } = require('nanoid');

const gallerySchema = new mongoose.Schema({
  id: { type: String, default: () => nanoid(10), unique: true },
  title: { type: String, default: '' },
  caption: { type: String, default: '' },
  imagePaths: { type: [String], default: [] },
  imagePath: { type: String, default: '' },
  videoUrl: { type: String, default: '' },
  createdAt: { type: String, default: () => new Date().toISOString() }
});

const Gallery = mongoose.models.Gallery || mongoose.model('Gallery', gallerySchema);

function normalizeImagePaths(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean).map(String);
  if (typeof value === 'string') return value.trim() ? [value.trim()] : [];
  return [];
}

async function all() {
  const items = await Gallery.find({}).lean();
  return items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

async function findById(id) {
  return await Gallery.findOne({ id }).lean();
}

async function create(payload) {
  const paths = normalizeImagePaths(payload.imagePaths ?? payload.imagePath);
  const item = new Gallery({
    title: payload.title || '',
    caption: payload.caption || '',
    imagePaths: paths,
    imagePath: paths[0] || '',
    videoUrl: (payload.videoUrl || '').trim()
  });
  await item.save();
  return item.toObject();
}

async function update(id, payload) {
  const existing = await Gallery.findOne({ id });
  if (!existing) return null;

  const providedPaths = payload.imagePaths !== undefined ? normalizeImagePaths(payload.imagePaths) : normalizeImagePaths(payload.imagePath ?? existing.imagePath);
  const imagePaths = payload.imagePaths !== undefined ? providedPaths : normalizeImagePaths(existing.imagePaths || existing.imagePath || '');
  
  if (payload.title !== undefined) existing.title = payload.title;
  if (payload.caption !== undefined) existing.caption = payload.caption;
  existing.imagePaths = imagePaths;
  existing.imagePath = imagePaths[0] || '';
  if (payload.videoUrl !== undefined) existing.videoUrl = (payload.videoUrl || '').trim();
  
  await existing.save();
  return existing.toObject();
}

async function remove(id) {
  const result = await Gallery.deleteOne({ id });
  return result.deletedCount > 0;
}

module.exports = { all, findById, create, update, remove, Gallery };
