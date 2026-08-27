const express = require('express');
const gallery = require('../db/gallery');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    res.json({ gallery: await gallery.all() });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch gallery items' });
  }
});

router.post('/', requireAuth, async (req, res) => {
  const hasMedia = (req.body && (req.body.imagePath || (Array.isArray(req.body.imagePaths) && req.body.imagePaths.length > 0) || (req.body.videoUrl && String(req.body.videoUrl).trim())));
  if (!hasMedia) {
    return res.status(400).json({ error: 'An uploaded photo or video is required.' });
  }
  try {
    res.status(201).json({ item: await gallery.create(req.body) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create gallery item' });
  }
});

router.put('/:id', requireAuth, async (req, res) => {
  try {
    const updated = await gallery.update(req.params.id, req.body || {});
    if (!updated) return res.status(404).json({ error: 'Gallery item not found.' });
    res.json({ item: updated });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update gallery item' });
  }
});

router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const ok = await gallery.remove(req.params.id);
    if (!ok) return res.status(404).json({ error: 'Gallery item not found.' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete gallery item' });
  }
});

module.exports = router;
