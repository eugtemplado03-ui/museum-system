const express = require('express');
const events = require('../db/events');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

function validate(body) {
  const errors = [];
  if (!body.title || !body.title.trim()) errors.push('Title is required.');
  return errors;
}

router.get('/', (req, res) => {
  res.json({ events: events.all() });
});

router.get('/:id', (req, res) => {
  const event = events.findById(req.params.id);
  if (!event) return res.status(404).json({ error: 'Event not found.' });
  res.json({ event });
});

router.post('/', requireAuth, (req, res) => {
  const errors = validate(req.body || {});
  if (errors.length) return res.status(400).json({ error: errors.join(' ') });
  res.status(201).json({ event: events.create(req.body) });
});

router.put('/:id', requireAuth, (req, res) => {
  const errors = validate(req.body || {});
  if (errors.length) return res.status(400).json({ error: errors.join(' ') });
  const updated = events.update(req.params.id, req.body);
  if (!updated) return res.status(404).json({ error: 'Event not found.' });
  res.json({ event: updated });
});

router.delete('/:id', requireAuth, (req, res) => {
  const ok = events.remove(req.params.id);
  if (!ok) return res.status(404).json({ error: 'Event not found.' });
  res.json({ success: true });
});

module.exports = router;
