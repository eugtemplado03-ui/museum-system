const express = require('express');
const museumInfo = require('../db/museum-info');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// Public endpoint - get museum info
router.get('/', async (req, res) => {
  try {
    res.json({ museumInfo: await museumInfo.getInfo() });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch museum info' });
  }
});

// Admin endpoints (require auth)
router.use(requireAuth);

// Update museum info
router.put('/', async (req, res) => {
  try {
    const updated = await museumInfo.updateInfo(req.body);
    res.json({ museumInfo: updated });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update museum info' });
  }
});

module.exports = router;