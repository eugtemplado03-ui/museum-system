const express = require('express');
const programs = require('../db/programs');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

function validate(body) {
  const errors = [];
  if (!body.title || !body.title.trim()) errors.push('Title is required.');
  return errors;
}

router.get('/', (req, res) => {
  res.json({ programs: programs.all() });
});

router.get('/:id', (req, res) => {
  const program = programs.findById(req.params.id);
  if (!program) return res.status(404).json({ error: 'Program not found.' });
  res.json({ program });
});

router.post('/', requireAuth, (req, res) => {
  const errors = validate(req.body || {});
  if (errors.length) return res.status(400).json({ error: errors.join(' ') });
  res.status(201).json({ program: programs.create(req.body) });
});

router.put('/:id', requireAuth, (req, res) => {
  const errors = validate(req.body || {});
  if (errors.length) return res.status(400).json({ error: errors.join(' ') });
  const updated = programs.update(req.params.id, req.body);
  if (!updated) return res.status(404).json({ error: 'Program not found.' });
  res.json({ program: updated });
});

router.delete('/:id', requireAuth, (req, res) => {
  const ok = programs.remove(req.params.id);
  if (!ok) return res.status(404).json({ error: 'Program not found.' });
  res.json({ success: true });
});

module.exports = router;
