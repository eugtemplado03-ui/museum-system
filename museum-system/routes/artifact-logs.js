const express = require('express');
const artifactLogs = require('../db/artifact-logs');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// All artifact log endpoints are Admin Only
router.use(requireAuth);

function validate(body) {
  const errors = [];
  if (!body.name || !body.name.trim()) {
    errors.push('Artifact Name is required.');
  }
  return errors;
}

// GET /api/artifact-logs - list artifact logs with optional filters
router.get('/', async (req, res) => {
  const filter = {
    search: req.query.search,
    category: req.query.category,
    condition: req.query.condition,
    status: req.query.status
  };
  try {
    res.json({ artifactLogs: await artifactLogs.all(filter) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch artifact logs' });
  }
});

// GET /api/artifact-logs/stats - get summary metrics
router.get('/stats', async (req, res) => {
  try {
    res.json({ stats: await artifactLogs.stats() });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch artifact log stats' });
  }
});

// GET /api/artifact-logs/:id - get single artifact log entry
router.get('/:id', async (req, res) => {
  try {
    const artifact = await artifactLogs.findById(req.params.id);
    if (!artifact) return res.status(404).json({ error: 'Artifact log not found.' });
    res.json({ artifact });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch artifact log' });
  }
});

// POST /api/artifact-logs - create artifact log entry
router.post('/', async (req, res) => {
  const errors = validate(req.body);
  if (errors.length) return res.status(400).json({ error: errors.join(' ') });
  try {
    const artifact = await artifactLogs.create(req.body);
    res.status(201).json({ artifact });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create artifact log' });
  }
});

// PUT /api/artifact-logs/:id - update artifact log entry
router.put('/:id', async (req, res) => {
  const errors = validate(req.body);
  if (errors.length) return res.status(400).json({ error: errors.join(' ') });
  try {
    const artifact = await artifactLogs.update(req.params.id, req.body);
    if (!artifact) return res.status(404).json({ error: 'Artifact log not found.' });
    res.json({ artifact });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update artifact log' });
  }
});

// DELETE /api/artifact-logs/:id - delete artifact log entry
router.delete('/:id', async (req, res) => {
  try {
    const ok = await artifactLogs.remove(req.params.id);
    if (!ok) return res.status(404).json({ error: 'Artifact log not found.' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete artifact log' });
  }
});

module.exports = router;
