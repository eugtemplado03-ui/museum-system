const express = require('express');
const QRCode = require('qrcode');

const exhibits = require('../db/exhibits');
const ratings = require('../db/ratings');
const favorites = require('../db/favorites');
const analytics = require('../db/analytics');
const { requireAuth } = require('../middleware/auth');
const { upload } = require('../middleware/upload');

const router = express.Router();

const CATEGORIES = ['Marine & Nature', 'Touch & Play', 'Toys & Collections', 'Character & Heritage', 'Environmental', 'Reading & Learning', 'Other'];

function publicUrlForExhibit(req, code) {
  const base = `${req.protocol}://${req.get('host')}`;
  return `${base}/exhibit.html?code=${encodeURIComponent(code)}`;
}

function validatePayload(body) {
  const errors = [];
  if (!body.title || !body.title.trim()) errors.push('Title is required.');
  if (body.category && !CATEGORIES.includes(body.category)) errors.push('Invalid category.');
  return errors;
}

function enrich(ex) {
  const rs = ratings.summaryForExhibit(ex.id);
  return { ...ex, ratingAverage: rs.average, ratingCount: rs.count, favoriteCount: favorites.countForExhibit(ex.id) };
}

// ---- Public ----
router.get('/', (req, res) => {
  res.json({ exhibits: exhibits.all().map(enrich) });
});

router.get('/:code/ratings', (req, res) => {
  const ex = exhibits.findByCode(req.params.code);
  if (!ex) return res.status(404).json({ error: 'Exhibit not found.' });
  res.json({ summary: ratings.summaryForExhibit(ex.id), ratings: ratings.forExhibit(ex.id) });
});

router.post('/:code/ratings', (req, res) => {
  const ex = exhibits.findByCode(req.params.code);
  if (!ex) return res.status(404).json({ error: 'Exhibit not found.' });
  const { visitorId, rating, comment } = req.body || {};
  if (!visitorId || typeof visitorId !== 'string') {
    return res.status(400).json({ error: 'A visitorId is required.' });
  }
  const numRating = Number(rating);
  if (!Number.isInteger(numRating) || numRating < 1 || numRating > 5) {
    return res.status(400).json({ error: 'Rating must be a whole number from 1 to 5.' });
  }
  const safeComment = typeof comment === 'string' ? comment.trim().slice(0, 500) : '';
  const record = ratings.submit(visitorId, ex.id, numRating, safeComment);
  res.status(201).json({ rating: record, summary: ratings.summaryForExhibit(ex.id) });
});

router.post('/:code/track', (req, res) => {
  const ex = exhibits.findByCode(req.params.code);
  if (!ex) return res.status(404).json({ error: 'Exhibit not found.' });
  const source = (req.body && req.body.source === 'scan') ? 'scan' : 'view';
  analytics.record(ex.id, source);
  res.status(201).json({ success: true });
});

router.get('/:code/qr', async (req, res) => {
  const ex = exhibits.findByCode(req.params.code);
  if (!ex) return res.status(404).json({ error: 'Exhibit not found.' });
  try {
    const url = publicUrlForExhibit(req, ex.code);
    const png = await QRCode.toBuffer(url, { width: 320, margin: 1, color: { dark: '#2B271F', light: '#FFFFFF' } });
    res.set('Content-Type', 'image/png');
    res.set('Content-Disposition', `inline; filename="${ex.code}-tag.png"`);
    res.send(png);
  } catch (e) {
    res.status(500).json({ error: 'Could not generate QR code.' });
  }
});

// Server-side TTS removed — use client-side browser TTS instead.

router.get('/:code', (req, res) => {
  const ex = exhibits.findByCode(req.params.code);
  if (!ex) return res.status(404).json({ error: 'Exhibit not found.' });
  res.json({ exhibit: enrich(ex) });
});

// ---- Admin (auth required) ----
router.post('/', requireAuth, (req, res) => {
  const errors = validatePayload(req.body || {});
  if (errors.length) return res.status(400).json({ error: errors.join(' ') });
  const created = exhibits.create(req.body);
  res.status(201).json({ exhibit: created });
});

router.put('/:id', requireAuth, (req, res) => {
  const errors = validatePayload(req.body || {});
  if (errors.length) return res.status(400).json({ error: errors.join(' ') });
  const updated = exhibits.update(req.params.id, req.body);
  if (!updated) return res.status(404).json({ error: 'Exhibit not found.' });
  res.json({ exhibit: updated });
});

router.delete('/:id', requireAuth, (req, res) => {
  const ok = exhibits.remove(req.params.id);
  if (!ok) return res.status(404).json({ error: 'Exhibit not found.' });
  res.json({ success: true });
});

router.post('/upload-image', requireAuth, (req, res) => {
  upload.single('image')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });
    res.json({ path: `/uploads/${req.file.filename}` });
  });
});

module.exports = router;
