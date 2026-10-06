const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');

const users = require('../db/users');
const { JWT_SECRET, requireAuth } = require('../middleware/auth');

const router = express.Router();

// Rate limiter to prevent brute-force password guessing
const loginLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 10, // 10 attempts per 5 minutes per IP
  message: { error: 'Too many login attempts. Please try again in 5 minutes.' },
  standardHeaders: true,
  legacyHeaders: false
});

const passwordResetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { message: 'If an admin account matches that email, a password reset link will be sent.' },
  standardHeaders: true,
  legacyHeaders: false
});

const resetResponse = 'If an admin account matches that email, a password reset link will be sent.';

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
      { sub: user.id, username: user.username, role: user.role, ver: user.sessionVersion || 0 },
      JWT_SECRET,
      { expiresIn: '12h' }
    );
    res.json({ token, user: { id: user.id, username: user.username, role: user.role } });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/forgot-password', passwordResetLimiter, async (req, res) => {
  res.json({ message: resetResponse });
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !process.env.BREVO_API_KEY || !process.env.BREVO_SENDER_EMAIL) return;

  try {
    const user = await users.findAdminByEmail(email);
    if (!user) return;

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
    await users.storePasswordResetToken(user.id, tokenHash, expiresAt);

    const siteUrl = process.env.SITE_URL || `${req.protocol}://${req.get('host')}`;
    const resetUrl = new URL('/reset-password.html', siteUrl);
    resetUrl.searchParams.set('token', rawToken);
    const emailResponse = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'api-key': process.env.BREVO_API_KEY },
      body: JSON.stringify({
        sender: { email: process.env.BREVO_SENDER_EMAIL, name: process.env.BREVO_SENDER_NAME || 'Museo Sang Bata sa Negros' },
        to: [{ email: user.email }],
        subject: 'Admin password reset',
        textContent: `Use this link to reset your admin password. It expires in 30 minutes: ${resetUrl.toString()}`
      })
    });
    if (!emailResponse.ok) console.error('Brevo password-reset email failed:', emailResponse.status);
  } catch (err) {
    console.error('Password reset request failed:', err.message);
  }
});

router.post('/reset-password', passwordResetLimiter, async (req, res) => {
  const { token, password, confirmPassword } = req.body || {};
  if (typeof token !== 'string' || !token || typeof password !== 'string' || password.length < 12 || password.length > 128) {
    return res.status(400).json({ error: 'The reset link is invalid or expired, or the password does not meet the requirements.' });
  }
  if (password !== confirmPassword) {
    return res.status(400).json({ error: 'Passwords do not match.' });
  }

  try {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await users.consumePasswordResetToken(tokenHash, passwordHash);
    if (!user) return res.status(400).json({ error: 'The reset link is invalid or expired, or the password does not meet the requirements.' });
    return res.json({ message: 'Password updated. Please sign in with your new password.' });
  } catch (err) {
    console.error('Password reset error:', err);
    return res.status(500).json({ error: 'Could not update the password. Please try again.' });
  }
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;
