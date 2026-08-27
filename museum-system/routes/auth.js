const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimitMap = new Map();

const users = require('../db/users');
const { JWT_SECRET, requireAuth } = require('../middleware/auth');

const router = express.Router();

// Very small in-memory rate limiter to slow down password guessing.
function isRateLimited(key) {
  const entry = rateLimitMap.get(key) || { count: 0, resetAt: Date.now() + 5 * 60 * 1000 };
  if (Date.now() > entry.resetAt) {
    entry.count = 0;
    entry.resetAt = Date.now() + 5 * 60 * 1000;
  }
  entry.count += 1;
  rateLimitMap.set(key, entry);
  return entry.count > 10;
}

router.post('/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }
  const key = req.ip + ':' + username.toLowerCase();
  if (isRateLimited(key)) {
    return res.status(429).json({ error: 'Too many attempts. Try again in a few minutes.' });
  }

  try {
    const user = await users.findByUsername(username);
    if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
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

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;
