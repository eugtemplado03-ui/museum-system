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
router.get('/', (req, res) => {
  const filter = {
    search: req.query.search,
    category: req.query.category,
    condition: req.query.condition,
    status: req.query.status
  };
  res.json({ artifactLogs: artifactLogs.all(filter) });
});

// GET /api/artifact-logs/stats - get summary metrics
router.get('/stats', (req, res) => {
  res.json({ stats: artifactLogs.stats() });
});

// GET /api/artifact-logs/:id - get single artifact log entry
router.get('/:id', (req, res) => {
  const artifact = artifactLogs.findById(req.params.id);
  if (!artifact) return res.status(404).json({ error: 'Artifact log not found.' });
  res.json({ artifact });
});

// POST /api/artifact-logs - create artifact log entry
router.post('/', (req, res) => {
  const errors = validate(req.body);
  if (errors.length) return res.status(400).json({ error: errors.join(' ') });
  const artifact = artifactLogs.create(req.body);
  res.status(201).json({ artifact });
});

// PUT /api/artifact-logs/:id - update artifact log entry
router.put('/:id', (req, res) => {
  const errors = validate(req.body);
  if (errors.length) return res.status(400).json({ error: errors.join(' ') });
  const artifact = artifactLogs.update(req.params.id, req.body);
  if (!artifact) return res.status(404).json({ error: 'Artifact log not found.' });
  res.json({ artifact });
});

// DELETE /api/artifact-logs/:id - delete artifact log entry
router.delete('/:id', (req, res) => {
  const ok = artifactLogs.remove(req.params.id);
  if (!ok) return res.status(404).json({ error: 'Artifact log not found.' });
  res.json({ ok: true });
});

module.exports = router;
