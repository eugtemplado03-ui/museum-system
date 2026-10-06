const crypto = require('crypto');
const jwt = require('jsonwebtoken');

let JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET === 'change-this-secret-in-production') {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('FATAL SECURITY ERROR: JWT_SECRET environment variable must be set to a secure secret in production.');
  }
  // In development/test, generate a secure random secret if not set
  if (!JWT_SECRET) {
    console.warn('⚠️ WARNING: JWT_SECRET is not defined. Generating a secure random secret for this session.');
    JWT_SECRET = crypto.randomBytes(32).toString('hex');
  }
}

async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header.' });
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (payload.role === 'admin') {
      const users = require('../db/users');
      const user = await users.findById(payload.sub);
      if (!user || (user.sessionVersion || 0) !== (payload.ver || 0)) {
        return res.status(401).json({ error: 'Session expired or invalid. Please sign in again.' });
      }
    }
    req.user = payload;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Session expired or invalid. Please sign in again.' });
  }
}

function requireAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied: Admin privileges required.' });
    }
    next();
  });
}

module.exports = { requireAuth, requireAdmin, JWT_SECRET };

