// Persistence helpers for gallery entries, including legacy single-image fields.
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

// Accept an image array or legacy single image path and return a normalized array.
function normalizeImagePaths(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean).map(String);
  if (typeof value === 'string') return value.trim() ? [value.trim()] : [];
  return [];
}

// List gallery entries with the newest entry first.
async function all() {
  const items = await Gallery.find({}).lean();
  return items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

// Look up a gallery entry by its public ID.
async function findById(id) {
  return await Gallery.findOne({ id }).lean();
}

// Create a gallery entry and mirror its first image into the legacy field.
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

// Update supplied fields while keeping imagePath aligned with imagePaths.
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

// Delete a gallery entry and report whether it existed.
async function remove(id) {
  const result = await Gallery.deleteOne({ id });
  return result.deletedCount > 0;
}

module.exports = { all, findById, create, update, remove, Gallery };
