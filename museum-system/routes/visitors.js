const express = require('express');
const visitors = require('../db/visitors');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// All visitor log endpoints are Admin Only
router.use(requireAuth);

function validate(body) {
  const errors = [];
  if (!body.visitorName || !body.visitorName.trim()) {
    errors.push('Visitor or Contact Name is required.');
  }
  if (body.pax !== undefined && (isNaN(parseInt(body.pax, 10)) || parseInt(body.pax, 10) < 1)) {
    errors.push('Pax count must be a positive integer.');
  }
  return errors;
}

// GET /api/visitors - list visitor logs with optional filters
router.get('/', (req, res) => {
  const filter = {
    search: req.query.search,
    groupType: req.query.groupType,
    status: req.query.status,
    date: req.query.date
  };
  res.json({ visitors: visitors.all(filter) });
});

// GET /api/visitors/stats - get summary metrics
router.get('/stats', (req, res) => {
  res.json({ stats: visitors.stats() });
});

// GET /api/visitors/:id - get single visitor entry
router.get('/:id', (req, res) => {
  const visitor = visitors.findById(req.params.id);
  if (!visitor) return res.status(404).json({ error: 'Visitor log not found.' });
  res.json({ visitor });
});

// POST /api/visitors - create visitor entry
router.post('/', (req, res) => {
  const errors = validate(req.body);
  if (errors.length) return res.status(400).json({ error: errors.join(' ') });
  const visitor = visitors.create(req.body);
  res.status(201).json({ visitor });
});

// PUT /api/visitors/:id - update visitor entry
router.put('/:id', (req, res) => {
  const errors = validate(req.body);
  if (errors.length) return res.status(400).json({ error: errors.join(' ') });
  const visitor = visitors.update(req.params.id, req.body);
  if (!visitor) return res.status(404).json({ error: 'Visitor log not found.' });
  res.json({ visitor });
});

// DELETE /api/visitors/:id - delete visitor entry
router.delete('/:id', (req, res) => {
  const ok = visitors.remove(req.params.id);
  if (!ok) return res.status(404).json({ error: 'Visitor log not found.' });
  res.json({ ok: true });
});

module.exports = router;
