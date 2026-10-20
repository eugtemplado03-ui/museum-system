// User persistence helpers for authentication and administrator password changes.
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

// Escape regex metacharacters so literal usernames remain literal in queries.
function escapeRegex(str) {
  return String(str || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Find a username without case sensitivity or treating user input as regex syntax.
async function findByUsername(username) {
  if (!username || typeof username !== 'string') return null;
  const safeUsername = escapeRegex(username.trim());
  return await User.findOne({ username: { $regex: new RegExp(`^${safeUsername}$`, 'i') } }).lean();
}

// Find a user by its public ID.
async function findById(id) {
  return await User.findOne({ id }).lean();
}

// Update an administrator password hash and report whether it changed.
async function updatePasswordHash(id, passwordHash) {
  const result = await User.updateOne({ id, role: 'admin' }, { $set: { passwordHash } });
  return result.modifiedCount === 1;
}

// Create a user record, defaulting its role to administrator.
async function create({ username, passwordHash, role }) {
  const user = new User({ username, passwordHash, role: role || 'admin' });
  await user.save();
  return user.toObject();
}

// Count stored users, used to determine whether initial setup is required.
async function count() {
  return await User.countDocuments();
}

module.exports = {
  findByUsername,
  findById,
  updatePasswordHash,
  create,
  count,
  User
};
