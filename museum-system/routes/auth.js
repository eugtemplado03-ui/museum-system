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

const passwordResetRequestLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { message: 'If an admin account matches that email, a password reset code will be sent.' },
  standardHeaders: true,
  legacyHeaders: false
});

const passwordResetCodeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many code attempts. Request a new reset code later.' },
  standardHeaders: true,
  legacyHeaders: false
});

const resetResponse = 'If an admin account matches that email, a password reset code will be sent.';

function hashResetCode(userId, code) {
  return crypto.createHmac('sha256', JWT_SECRET).update(`${userId}:${code}`).digest('hex');
}

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

router.post('/forgot-password', passwordResetRequestLimiter, async (req, res) => {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.json({ message: resetResponse });
  if (!process.env.BREVO_API_KEY || !process.env.BREVO_SENDER_EMAIL) {
    console.error('Password reset email is not configured: BREVO_API_KEY or BREVO_SENDER_EMAIL is missing.');
    return res.json({ message: resetResponse });
  }

  try {
    const user = await users.findAdminByEmail(email);
    if (!user) {
      console.warn('Password reset not sent: no admin account matches the submitted recovery email.');
    } else {
      const code = String(crypto.randomInt(0, 100000000)).padStart(8, '0');
      const codeHash = hashResetCode(user.id, code);
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
      await users.storePasswordResetToken(user.id, codeHash, expiresAt);

      const emailResponse = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'api-key': process.env.BREVO_API_KEY },
        body: JSON.stringify({
          sender: { email: process.env.BREVO_SENDER_EMAIL, name: process.env.BREVO_SENDER_NAME || 'Museo Sang Bata sa Negros' },
          to: [{ email: user.email }],
          subject: 'Admin password reset',
          textContent: `Your admin password reset confirmation code is ${code}. It expires in 10 minutes and can only be used once.`
        })
      });
      if (!emailResponse.ok) {
        let details = '';
        try {
          const body = await emailResponse.json();
          details = [body.code, body.message].filter(Boolean).join(': ');
        } catch (err) {}
        console.error('Brevo password-reset email failed:', emailResponse.status, details);
      } else {
        console.info('Brevo accepted password-reset email:', emailResponse.status);
      }
    }
  } catch (err) {
    console.error('Password reset request failed:', err.message);
  }
  return res.json({ message: resetResponse });
});

router.post('/reset-password', passwordResetCodeLimiter, async (req, res) => {
  const { email: submittedEmail, code, password, confirmPassword } = req.body || {};
  const email = typeof submittedEmail === 'string' ? submittedEmail.trim().toLowerCase() : '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || typeof code !== 'string' || !/^\d{8}$/.test(code) || typeof password !== 'string' || password.length < 12 || password.length > 128) {
    return res.status(400).json({ error: 'The email or confirmation code is invalid or expired, or the password does not meet the requirements.' });
  }
  if (password !== confirmPassword) {
    return res.status(400).json({ error: 'Passwords do not match.' });
  }

  try {
    const admin = await users.findAdminByEmail(email);
    if (!admin) return res.status(400).json({ error: 'The email or confirmation code is invalid or expired.' });
    const codeHash = hashResetCode(admin.id, code);
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await users.consumePasswordResetToken(admin.id, codeHash, passwordHash);
    if (!user) return res.status(400).json({ error: 'The email or confirmation code is invalid or expired.' });
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
