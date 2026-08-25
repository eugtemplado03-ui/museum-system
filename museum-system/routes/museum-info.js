const express = require('express');
const museumInfo = require('../db/museum-info');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// Public endpoint - get museum info
router.get('/', (req, res) => {
  res.json({ museumInfo: museumInfo.getInfo() });
});

// Admin endpoints (require auth)
router.use(requireAuth);

// Update museum info
router.put('/', (req, res) => {
  const updated = museumInfo.updateInfo(req.body);
  res.json({ museumInfo: updated });
});

module.exports = router;