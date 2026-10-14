const express = require('express');
const mapLayout = require('../db/map-layout');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();
const ROOM_IDS = new Set([
  'cat_marine_nature',
  'cat_touch_play',
  'cat_reading_learning',
  'cat_character_heritage',
  'cat_toys_collections',
  'cat_carnival_play'
]);
const MAX_OFFSET = 1300;

router.get('/', async (req, res) => {
  try {
    res.json({ roomOffsets: await mapLayout.getRoomOffsets() });
  } catch (err) {
    console.error('Failed to fetch map layout:', err.message);
    res.status(500).json({ error: 'Failed to fetch map layout' });
  }
});

router.put('/', requireAdmin, async (req, res) => {
  const { roomOffsets } = req.body || {};
  if (!roomOffsets || typeof roomOffsets !== 'object' || Array.isArray(roomOffsets)) {
    return res.status(400).json({ error: 'Room offsets must be an object.' });
  }

  const sanitizedOffsets = {};
  for (const [roomId, offset] of Object.entries(roomOffsets)) {
    if (!ROOM_IDS.has(roomId)) {
      return res.status(400).json({ error: `Unknown room: ${roomId}` });
    }
    if (!offset || typeof offset !== 'object' || Array.isArray(offset)) {
      return res.status(400).json({ error: `Invalid position for ${roomId}.` });
    }
    const { x, y } = offset;
    if (!Number.isFinite(x) || !Number.isFinite(y) || Math.abs(x) > MAX_OFFSET || Math.abs(y) > MAX_OFFSET) {
      return res.status(400).json({ error: `Position for ${roomId} is outside the allowed range.` });
    }
    sanitizedOffsets[roomId] = { x, y };
  }

  try {
    res.json({ roomOffsets: await mapLayout.updateRoomOffsets(sanitizedOffsets) });
  } catch (err) {
    console.error('Failed to save map layout:', err.message);
    res.status(500).json({ error: 'Failed to save map layout' });
  }
});

module.exports = router;
