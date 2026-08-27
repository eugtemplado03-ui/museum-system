const express = require('express');
const QRCode = require('qrcode');
const visitors = require('../db/visitors');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// Public check-in endpoint (no auth required)
function validateCheckin(body) {
  const errors = [];
  if (!body.visitorName || !body.visitorName.trim()) {
    errors.push('Visitor name is required.');
  }
  if (!body.address || !body.address.trim()) {
    errors.push('Address is required.');
  }
  if (!body.sex) {
    errors.push('Sex is required.');
  }
  if (body.age !== undefined && body.age !== '' && (isNaN(parseInt(body.age, 10)) || parseInt(body.age, 10) < 0 || parseInt(body.age, 10) > 120)) {
    errors.push('Age must be a valid number between 0 and 120.');
  }
  return errors;
}

router.post('/checkin', async (req, res) => {
  const errors = validateCheckin(req.body);
  if (errors.length) return res.status(400).json({ error: errors.join(' ') });
  
  const payload = {
    visitorName: req.body.visitorName.trim(),
    address: req.body.address.trim(),
    sex: req.body.sex,
    age: req.body.age !== undefined && req.body.age !== '' ? parseInt(req.body.age, 10) : null,
    contactNumber: (req.body.contactNumber || '').trim(),
    email: (req.body.email || '').trim(),
    groupName: (req.body.groupName || '').trim(),
    groupType: 'Walk-in / Individual',
    pax: 1,
    purpose: 'General Visit',
    status: 'Checked-in',
    notes: (req.body.notes || '').trim()
  };
  
  try {
    const visitor = await visitors.create(payload);
    res.status(201).json({ visitor });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to process check-in.' });
  }
});

// Public QR code for visitor check-in
router.get('/checkin/qr', async (req, res) => {
  try {
    const rawProto = req.headers['x-forwarded-proto'] || req.protocol;
    const protocol = (typeof rawProto === 'string' && rawProto.includes(',')) ? rawProto.split(',')[0].trim() : rawProto;
    const host = req.headers['x-forwarded-host'] || req.get('host');
    const base = process.env.SITE_URL || `${protocol}://${host}`;
    const url = `${base.replace(/\/$/, '')}/checkin.html`;
    const png = await QRCode.toBuffer(url, { width: 320, margin: 1, color: { dark: '#2B271F', light: '#FFFFFF' } });
    res.set('Content-Type', 'image/png');
    res.set('Content-Disposition', 'inline; filename="visitor-checkin-tag.png"');
    res.send(png);
  } catch (e) {
    res.status(500).json({ error: 'Could not generate QR code.' });
  }
});

// All visitor log endpoints below are Admin Only
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
router.get('/', async (req, res) => {
  const filter = {
    search: req.query.search,
    groupType: req.query.groupType,
    status: req.query.status,
    date: req.query.date
  };
  try {
    res.json({ visitors: await visitors.all(filter) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch visitors.' });
  }
});

// GET /api/visitors/stats - get summary metrics
router.get('/stats', async (req, res) => {
  try {
    res.json({ stats: await visitors.stats() });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch stats.' });
  }
});

// GET /api/visitors/:id - get single visitor entry
router.get('/:id', async (req, res) => {
  try {
    const visitor = await visitors.findById(req.params.id);
    if (!visitor) return res.status(404).json({ error: 'Visitor log not found.' });
    res.json({ visitor });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch visitor.' });
  }
});

// POST /api/visitors - create visitor entry
router.post('/', async (req, res) => {
  const errors = validate(req.body);
  if (errors.length) return res.status(400).json({ error: errors.join(' ') });
  try {
    const visitor = await visitors.create(req.body);
    res.status(201).json({ visitor });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create visitor.' });
  }
});

// PUT /api/visitors/:id - update visitor entry
router.put('/:id', async (req, res) => {
  const errors = validate(req.body);
  if (errors.length) return res.status(400).json({ error: errors.join(' ') });
  try {
    const visitor = await visitors.update(req.params.id, req.body);
    if (!visitor) return res.status(404).json({ error: 'Visitor log not found.' });
    res.json({ visitor });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update visitor.' });
  }
});

// DELETE /api/visitors/:id - delete visitor entry
router.delete('/:id', async (req, res) => {
  try {
    const ok = await visitors.remove(req.params.id);
    if (!ok) return res.status(404).json({ error: 'Visitor log not found.' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete visitor.' });
  }
});

module.exports = router;
