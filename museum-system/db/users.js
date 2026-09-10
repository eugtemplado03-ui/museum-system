const mongoose = require('mongoose');
const { nanoid } = require('nanoid');

const userSchema = new mongoose.Schema({
  id: { type: String, default: () => nanoid(10), unique: true },
  username: { type: String, required: true },
  passwordHash: { type: String, required: true },
  role: { type: String, default: 'admin' },
  createdAt: { type: String, default: () => new Date().toISOString() }
});

// Avoid OverwriteModelError if required multiple times
const User = mongoose.models.User || mongoose.model('User', userSchema);

function escapeRegex(str) {
  return String(str || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function findByUsername(username) {
  if (!username || typeof username !== 'string') return null;
  const safeUsername = escapeRegex(username.trim());
  return await User.findOne({ username: { $regex: new RegExp(`^${safeUsername}$`, 'i') } }).lean();
}

async function findById(id) {
  return await User.findOne({ id }).lean();
}

async function create({ username, passwordHash, role }) {
  const user = new User({ username, passwordHash, role: role || 'admin' });
  await user.save();
  return user.toObject();
}

async function count() {
  return await User.countDocuments();
}

module.exports = { findByUsername, findById, create, count, User };
