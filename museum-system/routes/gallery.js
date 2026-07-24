const express = require('express');
const gallery = require('../db/gallery');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/', (req, res) => {
  res.json({ gallery: gallery.all() });
});

router.post('/', requireAuth, (req, res) => {
  if (!req.body || !req.body.imagePath) {
    return res.status(400).json({ error: 'An uploaded image is required.' });
  }
  res.status(201).json({ item: gallery.create(req.body) });
});

router.put('/:id', requireAuth, (req, res) => {
  const updated = gallery.update(req.params.id, req.body || {});
  if (!updated) return res.status(404).json({ error: 'Gallery item not found.' });
  res.json({ item: updated });
});

router.delete('/:id', requireAuth, (req, res) => {
  const ok = gallery.remove(req.params.id);
  if (!ok) return res.status(404).json({ error: 'Gallery item not found.' });
  res.json({ success: true });
});

module.exports = router;
