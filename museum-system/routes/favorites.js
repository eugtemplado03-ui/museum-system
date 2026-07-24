const express = require('express');
const favorites = require('../db/favorites');
const exhibits = require('../db/exhibits');

const router = express.Router();

function isValidVisitorId(id) {
  return typeof id === 'string' && id.length >= 6 && id.length <= 80;
}

router.get('/:visitorId', (req, res) => {
  if (!isValidVisitorId(req.params.visitorId)) return res.status(400).json({ error: 'Invalid visitor id.' });
  const ids = favorites.listForVisitor(req.params.visitorId);
  const items = ids.map(id => exhibits.findById(id)).filter(Boolean);
  res.json({ exhibits: items });
});

router.post('/', (req, res) => {
  const { visitorId, exhibitId } = req.body || {};
  if (!isValidVisitorId(visitorId)) return res.status(400).json({ error: 'Invalid visitor id.' });
  const ex = exhibits.findById(exhibitId);
  if (!ex) return res.status(404).json({ error: 'Exhibit not found.' });
  favorites.add(visitorId, ex.id);
  res.status(201).json({ success: true });
});

router.delete('/:visitorId/:exhibitId', (req, res) => {
  const { visitorId, exhibitId } = req.params;
  if (!isValidVisitorId(visitorId)) return res.status(400).json({ error: 'Invalid visitor id.' });
  favorites.remove(visitorId, exhibitId);
  res.json({ success: true });
});

module.exports = router;
