const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');

const users = require('../db/users');
const { JWT_SECRET, requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Rate limiter to prevent brute-force password guessing
const loginLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 10, // 10 attempts per 5 minutes per IP
  message: { error: 'Too many login attempts. Please try again in 5 minutes.' },
  standardHeaders: true,
  legacyHeaders: false
});

const passwordChangeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'Too many password change attempts. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false
});

router.post('/login', loginLimiter, async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }

  try {
    const user = await users.findByUsername(username);
    if (!user) {
      return res.status(401).json({ error: 'Incorrect username or password.' });
    }

    const passwordMatch = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Incorrect username or password.' });
    }

    const token = jwt.sign(
      { sub: user.id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: '12h' }
    );
    res.json({ token, user: { id: user.id, username: user.username, role: user.role } });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/change-password', passwordChangeLimiter, requireAdmin, async (req, res) => {
  const { currentPassword, newPassword, confirmPassword } = req.body || {};
  if (typeof currentPassword !== 'string' || !currentPassword || currentPassword.length > 128) {
    return res.status(400).json({ error: 'Enter your current password.' });
  }
  if (typeof newPassword !== 'string' || newPassword.length < 12 || newPassword.length > 128) {
    return res.status(400).json({ error: 'The new password must be between 12 and 128 characters.' });
  }
  if (newPassword !== confirmPassword) {
    return res.status(400).json({ error: 'New passwords do not match.' });
  }

  try {
    const user = await users.findById(req.user.sub);
    if (!user || user.role !== 'admin') {
      return res.status(401).json({ error: 'Please sign in again and retry.' });
    }
    if (!await bcrypt.compare(currentPassword, user.passwordHash)) {
      return res.status(400).json({ error: 'Current password is incorrect.' });
    }
    if (await bcrypt.compare(newPassword, user.passwordHash)) {
      return res.status(400).json({ error: 'Choose a new password different from your current one.' });
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    const updated = await users.updatePasswordHash(user.id, passwordHash);
    if (!updated) return res.status(401).json({ error: 'Please sign in again and retry.' });
    return res.json({ message: 'Password changed successfully.' });
  } catch (err) {
    console.error('Password change error:', err);
    return res.status(500).json({ error: 'Could not change the password. Please try again.' });
  }
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;
