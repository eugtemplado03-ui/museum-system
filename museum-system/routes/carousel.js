const express = require('express');
const carousel = require('../db/carousel');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// Public: Get active carousel slides & display settings
router.get('/', async (req, res) => {
  try {
    const slides = await carousel.all(false);
    const settings = await carousel.getSettings();
    res.json({ slides, settings });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch carousel slides' });
  }
});

// Admin-only endpoints
router.use(requireAuth);

// Get all slides including inactive
router.get('/admin', async (req, res) => {
  try {
    const slides = await carousel.all(true);
    const settings = await carousel.getSettings();
    res.json({ slides, settings });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch carousel slides for admin' });
  }
});

// Update global settings
router.put('/settings', async (req, res) => {
  try {
    const settings = await carousel.updateSettings(req.body);
    res.json({ settings });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update carousel settings' });
  }
});

// Reorder slides
router.post('/reorder', async (req, res) => {
  try {
    const { order } = req.body;
    if (!Array.isArray(order)) {
      return res.status(400).json({ error: 'Expected order array of slide IDs' });
    }
    await carousel.reorder(order);
    const slides = await carousel.all(true);
    res.json({ slides });
  } catch (err) {
    res.status(500).json({ error: 'Failed to reorder carousel slides' });
  }
});

// Reset to defaults
router.post('/reset', async (req, res) => {
  try {
    const slides = await carousel.resetToDefaults();
    const settings = await carousel.getSettings();
    res.json({ slides, settings, message: 'Reset to default slides successful' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to reset carousel slides' });
  }
});

// Create new slide
router.post('/', async (req, res) => {
  try {
    const { title, tag, description, imagePath, ctaText, linkUrl, code, active, order } = req.body;
    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'Slide title is required' });
    }
    const slide = await carousel.create({
      title,
      tag,
      description,
      imagePath,
      ctaText,
      linkUrl,
      code,
      active,
      order
    });
    res.status(201).json({ slide });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create carousel slide: ' + err.message });
  }
});

// Update slide
router.put('/:id', async (req, res) => {
  try {
    const slide = await carousel.update(req.params.id, req.body);
    if (!slide) {
      return res.status(404).json({ error: 'Carousel slide not found' });
    }
    res.json({ slide });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update carousel slide: ' + err.message });
  }
});

// Delete slide
router.delete('/:id', async (req, res) => {
  try {
    const success = await carousel.remove(req.params.id);
    if (!success) {
      return res.status(404).json({ error: 'Carousel slide not found' });
    }
    res.json({ success: true, message: 'Carousel slide deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete carousel slide' });
  }
});

module.exports = router;
