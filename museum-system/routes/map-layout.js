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
  'cat_carnival_play',
  'zone_aquarium',
  'zone_function_hall',
  'zone_stairs',
  'zone_staff_office',
  'zone_library_shell',
  'zone_entrance',
  'zone_stairs_landing',
  'zone_mezzanine_void',
  'reservoirs'
]);
const MAX_OFFSET = 1300;
const MIN_SCALE = 0.1;
const MAX_SCALE = 10;

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
    const { x, y, scale, scaleX, scaleY } = offset;
    if (!Number.isFinite(x) || !Number.isFinite(y) || Math.abs(x) > MAX_OFFSET || Math.abs(y) > MAX_OFFSET) {
      return res.status(400).json({ error: `Position for ${roomId} is outside the allowed range.` });
    }
    if (Object.hasOwn(offset, 'scale') && (!Number.isFinite(scale) || scale < MIN_SCALE || scale > MAX_SCALE)) {
      return res.status(400).json({ error: `Scale for ${roomId} must be between ${MIN_SCALE} and ${MAX_SCALE}.` });
    }
    for (const [axis, axisScale] of [['horizontal', scaleX], ['vertical', scaleY]]) {
      const property = axis === 'horizontal' ? 'scaleX' : 'scaleY';
      if (Object.hasOwn(offset, property) && (!Number.isFinite(axisScale) || axisScale < MIN_SCALE || axisScale > MAX_SCALE)) {
        return res.status(400).json({ error: `${axis} scale for ${roomId} must be between ${MIN_SCALE} and ${MAX_SCALE}.` });
      }
    }
    sanitizedOffsets[roomId] = { x, y };
    if (Object.hasOwn(offset, 'scale')) sanitizedOffsets[roomId].scale = scale;
    if (Object.hasOwn(offset, 'scaleX')) sanitizedOffsets[roomId].scaleX = scaleX;
    if (Object.hasOwn(offset, 'scaleY')) sanitizedOffsets[roomId].scaleY = scaleY;
  }

  try {
    res.json({ roomOffsets: await mapLayout.updateRoomOffsets(sanitizedOffsets) });
  } catch (err) {
    console.error('Failed to save map layout:', err.message);
    res.status(500).json({ error: 'Failed to save map layout' });
  }
});

module.exports = router;
