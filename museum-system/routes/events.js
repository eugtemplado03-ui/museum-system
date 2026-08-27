const express = require('express');
const events = require('../db/events');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

function validate(body) {
  const errors = [];
  if (!body.title || !body.title.trim()) errors.push('Title is required.');
  return errors;
}

router.get('/', async (req, res) => {
  try {
    res.json({ events: await events.all() });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch events' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const event = await events.findById(req.params.id);
    if (!event) return res.status(404).json({ error: 'Event not found.' });
    res.json({ event });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch event' });
  }
});

router.post('/', requireAuth, async (req, res) => {
  const errors = validate(req.body || {});
  if (errors.length) return res.status(400).json({ error: errors.join(' ') });
  try {
    res.status(201).json({ event: await events.create(req.body) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create event' });
  }
});

router.put('/:id', requireAuth, async (req, res) => {
  const errors = validate(req.body || {});
  if (errors.length) return res.status(400).json({ error: errors.join(' ') });
  try {
    const updated = await events.update(req.params.id, req.body);
    if (!updated) return res.status(404).json({ error: 'Event not found.' });
    res.json({ event: updated });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update event' });
  }
});

router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const ok = await events.remove(req.params.id);
    if (!ok) return res.status(404).json({ error: 'Event not found.' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete event' });
  }
});

module.exports = router;
