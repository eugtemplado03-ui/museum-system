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

async function validatePayload(body) {
  const errors = [];
  if (!body.title || !body.title.trim()) errors.push('Title is required.');
  if (body.category && typeof body.category === 'string' && body.category.trim()) {
    const trimmedCat = body.category.trim();
    const categories = await exhibits.categories();
    if (!categories.some(c => c.toLowerCase() === trimmedCat.toLowerCase())) {
      await exhibits.addCategory(trimmedCat);
    }
  }
  return errors;
}

async function enrich(ex) {
  // If ratings/favorites modules are still sync during migration, await resolves them safely.
  // Once they are rewritten to Mongoose, they will naturally return Promises.
  const rs = await ratings.summaryForExhibit(ex.id);
  const favCount = await favorites.countForExhibit(ex.id);
  return { ...ex, ratingAverage: rs.average, ratingCount: rs.count, favoriteCount: favCount };
}

// ---- Public ----
router.get('/', async (req, res) => {
  try {
    const allExhibits = await exhibits.all();
    const enriched = await Promise.all(allExhibits.map(enrich));
    res.json({ exhibits: enriched });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch exhibits.' });
  }
});

router.get('/recommended', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 6;
    res.json({ exhibits: await ratings.topRatedExhibits(limit) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch recommendations.' });
  }
});

router.get('/categories', async (req, res) => {
  try {
    res.json({ categories: await exhibits.categories() });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch categories.' });
  }
});

router.get('/:code/ratings', async (req, res) => {
  try {
    const ex = await exhibits.findByCode(req.params.code);
    if (!ex) return res.status(404).json({ error: 'Exhibit not found.' });
    res.json({ summary: await ratings.summaryForExhibit(ex.id), ratings: await ratings.forExhibit(ex.id) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch ratings.' });
  }
});

router.post('/:code/ratings', async (req, res) => {
  try {
    const ex = await exhibits.findByCode(req.params.code);
    if (!ex) return res.status(404).json({ error: 'Exhibit not found.' });
    const { visitorId, rating, comment, visitorName } = req.body || {};
    if (!visitorId || typeof visitorId !== 'string') {
      return res.status(400).json({ error: 'A visitorId is required.' });
    }
    const numRating = Number(rating);
    if (!Number.isInteger(numRating) || numRating < 1 || numRating > 5) {
      return res.status(400).json({ error: 'Rating must be a whole number from 1 to 5.' });
    }
    const safeComment = typeof comment === 'string' ? comment.trim().slice(0, 500) : '';
    const safeName = typeof visitorName === 'string' ? visitorName.trim().slice(0, 50) : 'Visitor';
    const record = await ratings.submit(visitorId, ex.id, numRating, safeComment, safeName);
    res.status(201).json({ rating: record, summary: await ratings.summaryForExhibit(ex.id) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to submit rating.' });
  }
});

router.post('/:code/track', async (req, res) => {
  try {
    const ex = await exhibits.findByCode(req.params.code);
    if (!ex) return res.status(404).json({ error: 'Exhibit not found.' });
    const source = (req.body && req.body.source === 'scan') ? 'scan' : 'view';
    await analytics.record(ex.id, source);
    res.status(201).json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to record tracking.' });
  }
});

router.get('/:code/qr', async (req, res) => {
  try {
    const ex = await exhibits.findByCode(req.params.code);
    if (!ex) return res.status(404).json({ error: 'Exhibit not found.' });
    
    const url = publicUrlForExhibit(req, ex.code);
    const png = await QRCode.toBuffer(url, { width: 320, margin: 1, color: { dark: '#2B271F', light: '#FFFFFF' } });
    res.set('Content-Type', 'image/png');
    res.set('Content-Disposition', `inline; filename="${ex.code}-tag.png"`);
    res.send(png);
  } catch (e) {
    res.status(500).json({ error: 'Could not generate QR code.' });
  }
});

router.get('/:code', async (req, res) => {
  try {
    const ex = await exhibits.findByCode(req.params.code);
    if (!ex) return res.status(404).json({ error: 'Exhibit not found.' });
    res.json({ exhibit: await enrich(ex) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch exhibit.' });
  }
});

// ---- Admin (auth required) ----
router.post('/', requireAuth, async (req, res) => {
  try {
    const errors = await validatePayload(req.body || {});
    if (errors.length) return res.status(400).json({ error: errors.join(' ') });
    const created = await exhibits.create(req.body);
    res.status(201).json({ exhibit: created });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create exhibit.' });
  }
});

router.put('/categories/:oldCategory', requireAuth, async (req, res) => {
  let oldCategory = req.params.oldCategory;
  try { oldCategory = decodeURIComponent(oldCategory); } catch (e) {}
  const newCategory = req.body && req.body.category;
  if (!newCategory || !String(newCategory).trim()) return res.status(400).json({ error: 'New category name is required.' });
  try {
    const updated = await exhibits.updateCategory(oldCategory, String(newCategory).trim());
    if (!updated) return res.status(404).json({ error: 'Category not found.' });
    res.json({ category: updated, categories: await exhibits.categories() });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update category.' });
  }
});

router.post('/categories', requireAuth, async (req, res) => {
  const category = req.body && req.body.category;
  if (!category || !String(category).trim()) return res.status(400).json({ error: 'Category name is required.' });
  try {
    const created = await exhibits.addCategory(String(category).trim());
    if (!created) return res.status(409).json({ error: 'Category already exists or invalid.' });
    res.status(201).json({ category: created, categories: await exhibits.categories() });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create category.' });
  }
});

router.delete('/categories/:category', requireAuth, async (req, res) => {
  let category = req.params.category;
  try { category = decodeURIComponent(category); } catch (e) {}
  try {
    const deleted = await exhibits.deleteCategory(category);
    if (!deleted) return res.status(404).json({ error: 'Category not found.' });
    res.json({ success: true, categories: await exhibits.categories() });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete category.' });
  }
});

router.post('/categories/:category/assign', requireAuth, async (req, res) => {
  let category = req.params.category;
  try { category = decodeURIComponent(category); } catch (e) {}
  const { exhibitIds } = req.body || {};
  if (!Array.isArray(exhibitIds)) return res.status(400).json({ error: 'exhibitIds array is required.' });
  try {
    const ok = await exhibits.assignExhibitsToCategory(category, exhibitIds);
    if (!ok) return res.status(400).json({ error: 'Could not assign exhibits.' });
    res.json({ success: true, exhibits: await exhibits.all(), categories: await exhibits.categories() });
  } catch (err) {
    res.status(500).json({ error: 'Failed to assign exhibits.' });
  }
});

router.put('/:id', requireAuth, async (req, res) => {
  try {
    const errors = await validatePayload(req.body || {});
    if (errors.length) return res.status(400).json({ error: errors.join(' ') });
    const updated = await exhibits.update(req.params.id, req.body);
    if (!updated) return res.status(404).json({ error: 'Exhibit not found.' });
    res.json({ exhibit: updated });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update exhibit.' });
  }
});

router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const ok = await exhibits.remove(req.params.id);
    if (!ok) return res.status(404).json({ error: 'Exhibit not found.' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete exhibit.' });
  }
});

router.post('/upload-image', requireAuth, (req, res) => {
  upload.single('image')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });
    // Cloudinary returns req.file.path as full https:// URL; local multer returns absolute filesystem path
    const isCloudinary = req.file.path && (req.file.path.startsWith('http://') || req.file.path.startsWith('https://'));
    const filePath = isCloudinary ? req.file.path : `/uploads/${req.file.filename}`;
    res.json({ path: filePath });
  });
});

router.post('/upload-media', requireAuth, (req, res) => {
  upload.single('file')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });
    const isVideo = req.file.mimetype ? req.file.mimetype.startsWith('video/') : false;
    const isCloudinary = req.file.path && (req.file.path.startsWith('http://') || req.file.path.startsWith('https://'));
    const filePath = isCloudinary ? req.file.path : `/uploads/${req.file.filename}`;
    res.json({ path: filePath, isVideo, mimetype: req.file.mimetype });
  });
});

module.exports = router;
