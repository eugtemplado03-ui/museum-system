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

router.post('/checkin', (req, res) => {
  const errors = validateCheckin(req.body);
  if (errors.length) return res.status(400).json({ error: errors.join(' ') });
  
  const now = new Date();
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
  
  const visitor = visitors.create(payload);
  res.status(201).json({ visitor });
});

// Public QR code for visitor check-in
router.get('/checkin/qr', async (req, res) => {
  try {
    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    const url = `${protocol}://${host}/checkin.html`;
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
