const express = require('express');
const favorites = require('../db/favorites');
const exhibits = require('../db/exhibits');

const router = express.Router();

function isValidVisitorId(id) {
  return typeof id === 'string' && id.length >= 6 && id.length <= 80;
}

router.get('/:visitorId', async (req, res) => {
  if (!isValidVisitorId(req.params.visitorId)) return res.status(400).json({ error: 'Invalid visitor id.' });
  try {
    const ids = await favorites.listForVisitor(req.params.visitorId);
    const itemPromises = ids.map(id => exhibits.findById(id));
    const items = (await Promise.all(itemPromises)).filter(Boolean);
    res.json({ exhibits: items });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch favorites' });
  }
});

router.post('/', async (req, res) => {
  const { visitorId, exhibitId } = req.body || {};
  if (!isValidVisitorId(visitorId)) return res.status(400).json({ error: 'Invalid visitor id.' });
  try {
    const ex = await exhibits.findById(exhibitId);
    if (!ex) return res.status(404).json({ error: 'Exhibit not found.' });
    await favorites.add(visitorId, ex.id);
    res.status(201).json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to add favorite' });
  }
});

router.delete('/:visitorId/:exhibitId', async (req, res) => {
  const { visitorId, exhibitId } = req.params;
  if (!isValidVisitorId(visitorId)) return res.status(400).json({ error: 'Invalid visitor id.' });
  try {
    await favorites.remove(visitorId, exhibitId);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to remove favorite' });
  }
});

module.exports = router;
