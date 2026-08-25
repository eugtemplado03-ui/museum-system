const express = require('express');
const QRCode = require('qrcode');

const exhibits = require('../db/exhibits');
const ratings = require('../db/ratings');
const favorites = require('../db/favorites');
const analytics = require('../db/analytics');
const { requireAuth } = require('../middleware/auth');
const { upload } = require('../middleware/upload');

const router = express.Router();

function publicUrlForExhibit(req, code) {
  const rawProto = req.headers['x-forwarded-proto'] || req.protocol;
  const protocol = (typeof rawProto === 'string' && rawProto.includes(',')) ? rawProto.split(',')[0].trim() : rawProto;
  const host = req.headers['x-forwarded-host'] || req.get('host');
  const base = process.env.SITE_URL || `${protocol}://${host}`;
  return `${base.replace(/\/$/, '')}/exhibit.html?code=${encodeURIComponent(code)}`;
}

function validatePayload(body) {
  const errors = [];
  if (!body.title || !body.title.trim()) errors.push('Title is required.');
  if (body.category && typeof body.category === 'string' && body.category.trim()) {
    const trimmedCat = body.category.trim();
    const categories = exhibits.categories();
    if (!categories.some(c => c.toLowerCase() === trimmedCat.toLowerCase())) {
      exhibits.addCategory(trimmedCat);
    }
  }
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

router.get('/categories', (req, res) => {
  res.json({ categories: exhibits.categories() });
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

router.put('/categories/:oldCategory', requireAuth, (req, res) => {
  let oldCategory = req.params.oldCategory;
  try { oldCategory = decodeURIComponent(oldCategory); } catch (e) {}
  const newCategory = req.body && req.body.category;
  if (!newCategory || !String(newCategory).trim()) return res.status(400).json({ error: 'New category name is required.' });
  const updated = exhibits.updateCategory(oldCategory, String(newCategory).trim());
  if (!updated) return res.status(404).json({ error: 'Category not found.' });
  res.json({ category: updated, categories: exhibits.categories() });
});

router.post('/categories', requireAuth, (req, res) => {
  const category = req.body && req.body.category;
  if (!category || !String(category).trim()) return res.status(400).json({ error: 'Category name is required.' });
  const created = exhibits.addCategory(String(category).trim());
  if (!created) return res.status(409).json({ error: 'Category already exists or invalid.' });
  res.status(201).json({ category: created, categories: exhibits.categories() });
});

router.delete('/categories/:category', requireAuth, (req, res) => {
  let category = req.params.category;
  try { category = decodeURIComponent(category); } catch (e) {}
  const deleted = exhibits.deleteCategory(category);
  if (!deleted) return res.status(404).json({ error: 'Category not found.' });
  res.json({ success: true, categories: exhibits.categories() });
});

router.post('/categories/:category/assign', requireAuth, (req, res) => {
  let category = req.params.category;
  try { category = decodeURIComponent(category); } catch (e) {}
  const { exhibitIds } = req.body || {};
  if (!Array.isArray(exhibitIds)) return res.status(400).json({ error: 'exhibitIds array is required.' });
  const ok = exhibits.assignExhibitsToCategory(category, exhibitIds);
  if (!ok) return res.status(400).json({ error: 'Could not assign exhibits.' });
  res.json({ success: true, exhibits: exhibits.all(), categories: exhibits.categories() });
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

router.post('/upload-media', requireAuth, (req, res) => {
  upload.single('file')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });
    const isVideo = req.file.mimetype.startsWith('video/');
    res.json({ path: `/uploads/${req.file.filename}`, isVideo, mimetype: req.file.mimetype });
  });
});

module.exports = router;
