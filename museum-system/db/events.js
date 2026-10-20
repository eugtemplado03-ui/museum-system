// Persistence helpers for museum events and their associated media.
const mongoose = require('mongoose');
const { nanoid } = require('nanoid');

const eventSchema = new mongoose.Schema({
  id: { type: String, default: () => nanoid(10), unique: true },
  title: { type: String, required: true },
  date: { type: String, default: '' },
  location: { type: String, default: '' },
  imagePaths: { type: [String], default: [] },
  imagePath: { type: String, default: '' },
  videoUrl: { type: String, default: '' },
  description: { type: String, default: '' },
  createdAt: { type: String, default: () => new Date().toISOString() },
  updatedAt: { type: String, default: () => new Date().toISOString() }
});

const Event = mongoose.models.Event || mongoose.model('Event', eventSchema);

// Accept both the current image-path array and the legacy single-path value.
function normalizeImagePaths(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean).map(String);
  if (typeof value === 'string') return value.trim() ? [value.trim()] : [];
  return [];
}

// List events with dated entries first and newest dates at the top.
async function all() {
  const events = await Event.find({}).lean();
  return events.sort((a, b) => {
    const da = Date.parse(a.date), db = Date.parse(b.date);
    if (isNaN(da) && isNaN(db)) return 0;
    if (isNaN(da)) return 1;
    if (isNaN(db)) return -1;
    return db - da;
  });
}

// Look up an event by its public ID.
async function findById(id) {
  return await Event.findOne({ id }).lean();
}

// Create an event and keep the legacy primary-image field in sync with imagePaths.
async function create(payload) {
  const paths = normalizeImagePaths(payload.imagePaths ?? payload.imagePath);
  const event = new Event({
    title: payload.title,
    date: payload.date || '',
    location: payload.location || '',
    imagePaths: paths,
    imagePath: paths[0] || '',
    videoUrl: (payload.videoUrl || '').trim(),
    description: payload.description || ''
  });
  await event.save();
  return event.toObject();
}

// Update supplied event fields and synchronize both image representations.
async function update(id, payload) {
  const existing = await Event.findOne({ id });
  if (!existing) return null;

  const providedPaths = payload.imagePaths !== undefined ? normalizeImagePaths(payload.imagePaths) : normalizeImagePaths(payload.imagePath ?? existing.imagePath);
  const imagePaths = payload.imagePaths !== undefined ? providedPaths : normalizeImagePaths(existing.imagePaths || existing.imagePath || '');
  
  if (payload.title !== undefined) existing.title = payload.title;
  if (payload.date !== undefined) existing.date = payload.date;
  if (payload.location !== undefined) existing.location = payload.location;
  existing.imagePaths = imagePaths;
  existing.imagePath = imagePaths[0] || '';
  if (payload.videoUrl !== undefined) existing.videoUrl = (payload.videoUrl || '').trim();
  if (payload.description !== undefined) existing.description = payload.description;
  
  existing.updatedAt = new Date().toISOString();
  await existing.save();
  return existing.toObject();
}

// Delete an event and report whether it existed.
async function remove(id) {
  const result = await Event.deleteOne({ id });
  return result.deletedCount > 0;
}

module.exports = { all, findById, create, update, remove, Event };
