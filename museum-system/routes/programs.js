const express = require('express');
const programs = require('../db/programs');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

function validate(body) {
  const errors = [];
  if (!body.title || !body.title.trim()) errors.push('Title is required.');
  return errors;
}

router.get('/', async (req, res) => {
  try {
    res.json({ programs: await programs.all() });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch programs' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const program = await programs.findById(req.params.id);
    if (!program) return res.status(404).json({ error: 'Program not found.' });
    res.json({ program });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch program' });
  }
});

router.post('/', requireAuth, async (req, res) => {
  const errors = validate(req.body || {});
  if (errors.length) return res.status(400).json({ error: errors.join(' ') });
  try {
    res.status(201).json({ program: await programs.create(req.body) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create program' });
  }
});

router.put('/:id', requireAuth, async (req, res) => {
  const errors = validate(req.body || {});
  if (errors.length) return res.status(400).json({ error: errors.join(' ') });
  try {
    const updated = await programs.update(req.params.id, req.body);
    if (!updated) return res.status(404).json({ error: 'Program not found.' });
    res.json({ program: updated });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update program' });
  }
});

router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const ok = await programs.remove(req.params.id);
    if (!ok) return res.status(404).json({ error: 'Program not found.' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete program' });
  }
});

module.exports = router;
