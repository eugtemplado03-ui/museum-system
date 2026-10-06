const mongoose = require('mongoose');
const { nanoid } = require('nanoid');

const userSchema = new mongoose.Schema({
  id: { type: String, default: () => nanoid(10), unique: true },
  username: { type: String, required: true },
  email: { type: String, default: '' },
  passwordHash: { type: String, required: true },
  role: { type: String, default: 'admin' },
  sessionVersion: { type: Number, default: 0 },
  resetTokenHash: { type: String, default: null },
  resetTokenExpiresAt: { type: Date, default: null },
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

async function findAdminByEmail(email) {
  return await User.findOne({ email: String(email || '').trim().toLowerCase(), role: 'admin' }).lean();
}

async function setAdminEmail(username, email) {
  return await User.findOneAndUpdate(
    { username: String(username || '').trim(), role: 'admin' },
    { $set: { email: String(email || '').trim().toLowerCase() } },
    { new: true }
  ).lean();
}

async function storePasswordResetToken(id, tokenHash, expiresAt) {
  return await User.updateOne({ id, role: 'admin' }, {
    $set: { resetTokenHash: tokenHash, resetTokenExpiresAt: expiresAt }
  });
}

async function consumePasswordResetToken(id, tokenHash, passwordHash) {
  return await User.findOneAndUpdate({
    id,
    role: 'admin',
    resetTokenHash: tokenHash,
    resetTokenExpiresAt: { $gt: new Date() }
  }, {
    $set: { passwordHash, resetTokenHash: null, resetTokenExpiresAt: null },
    $inc: { sessionVersion: 1 }
  }, { new: true }).lean();
}

async function create({ username, email, passwordHash, role }) {
  const user = new User({ username, email: String(email || '').trim().toLowerCase(), passwordHash, role: role || 'admin' });
  await user.save();
  return user.toObject();
}

async function count() {
  return await User.countDocuments();
}

module.exports = {
  findByUsername,
  findById,
  findAdminByEmail,
  setAdminEmail,
  storePasswordResetToken,
  consumePasswordResetToken,
  create,
  count,
  User
};
