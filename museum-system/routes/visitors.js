const express = require('express');
const QRCode = require('qrcode');
const rateLimit = require('express-rate-limit');
const visitors = require('../db/visitors');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const checkinLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 20, // 20 check-ins per 5 minutes per IP
  message: { error: 'Too many check-in requests. Please wait a moment before trying again.' },
  standardHeaders: true,
  legacyHeaders: false
});

// Public check-in endpoint with strict input validation
function validateCheckin(body) {
  const errors = [];
  if (!body.visitorName || !body.visitorName.trim()) {
    errors.push('Visitor name is required.');
  } else if (body.visitorName.trim().length > 150) {
    errors.push('Visitor name cannot exceed 150 characters.');
  }

  if (!body.address || !body.address.trim()) {
    errors.push('Address is required.');
  } else if (body.address.trim().length > 250) {
    errors.push('Address cannot exceed 250 characters.');
  }

  if (!body.sex || typeof body.sex !== 'string') {
    errors.push('Sex is required.');
  }

  if (body.age !== undefined && body.age !== '' && (isNaN(parseInt(body.age, 10)) || parseInt(body.age, 10) < 0 || parseInt(body.age, 10) > 120)) {
    errors.push('Age must be a valid number between 0 and 120.');
  }

  if (body.email && body.email.trim()) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(body.email.trim()) || body.email.trim().length > 150) {
      errors.push('Please enter a valid email address.');
    }
  }

  if (body.contactNumber && body.contactNumber.trim()) {
    const phoneRegex = /^[\d\s+\-()]{7,25}$/;
    if (!phoneRegex.test(body.contactNumber.trim())) {
      errors.push('Please enter a valid contact number (7 to 25 digits and valid symbols).');
    }
  }

  if (body.notes && body.notes.trim().length > 500) {
    errors.push('Notes cannot exceed 500 characters.');
  }

  return errors;
}

router.post('/checkin', checkinLimiter, async (req, res) => {
  const errors = validateCheckin(req.body);
  if (errors.length) return res.status(400).json({ error: errors.join(' ') });
  
  const payload = {
    visitorName: req.body.visitorName.trim(),
    address: req.body.address.trim(),
    sex: req.body.sex,
    age: req.body.age !== undefined && req.body.age !== null && req.body.age !== '' && !isNaN(parseInt(req.body.age, 10)) ? parseInt(req.body.age, 10) : null,
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
    const visitorCode = visitor.visitorCode || visitor.id;
    let qrCodeDataUrl = '';
    try {
      const qrPayload = JSON.stringify({ pass: visitorCode, name: visitor.visitorName, id: visitor.id });
      qrCodeDataUrl = await QRCode.toDataURL(qrPayload, {
        width: 320,
        margin: 1,
        color: { dark: '#02131C', light: '#FFFFFF' }
      });
    } catch (qrErr) {
      console.warn('Could not generate pass QR data URL:', qrErr);
    }

    res.status(201).json({
      success: true,
      visitor,
      visitorCode,
      qrCodeDataUrl
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to process check-in.' });
  }
});

// Quick check-in for returning visitors using their Visitor Pass Code or Scanned QR
router.post('/quick-checkin', checkinLimiter, async (req, res) => {
  const code = (req.body && (req.body.visitorCode || req.body.code || req.body.pass)) || '';
  if (!code || typeof code !== 'string' || !code.trim()) {
    return res.status(400).json({ success: false, error: 'Visitor pass code or QR code data is required.' });
  }

  let targetCode = code.trim();
  // Handle QR payload encoded as JSON: e.g. {"pass":"MSBN-XXXXXX"}
  if (targetCode.startsWith('{') && targetCode.endsWith('}')) {
    try {
      const parsed = JSON.parse(targetCode);
      if (parsed.pass) targetCode = parsed.pass;
      else if (parsed.code) targetCode = parsed.code;
      else if (parsed.id) targetCode = parsed.id;
    } catch (e) {}
  }

  try {
    const visitor = await visitors.quickCheckin(targetCode);
    if (!visitor) {
      return res.status(404).json({ success: false, error: 'Visitor pass code not found. Please check the code or check in as a new visitor.' });
    }

    const visitorCode = visitor.visitorCode || visitor.id;
    let qrCodeDataUrl = '';
    try {
      const qrPayload = JSON.stringify({ pass: visitorCode, name: visitor.visitorName, id: visitor.id });
      qrCodeDataUrl = await QRCode.toDataURL(qrPayload, {
        width: 320,
        margin: 1,
        color: { dark: '#02131C', light: '#FFFFFF' }
      });
    } catch (qrErr) {}

    res.json({
      success: true,
      visitor,
      visitorCode,
      qrCodeDataUrl,
      message: `Welcome back, ${visitor.visitorName}! Your visit for today has been logged.`
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to process quick check-in.' });
  }
});

// Get Visitor Pass Card data by pass code
router.get('/pass/:code', async (req, res) => {
  try {
    const visitor = await visitors.findByCode(req.params.code);
    if (!visitor) return res.status(404).json({ error: 'Visitor pass not found.' });

    const visitorCode = visitor.visitorCode || visitor.id;
    let qrCodeDataUrl = '';
    try {
      const qrPayload = JSON.stringify({ pass: visitorCode, name: visitor.visitorName, id: visitor.id });
      qrCodeDataUrl = await QRCode.toDataURL(qrPayload, {
        width: 320,
        margin: 1,
        color: { dark: '#02131C', light: '#FFFFFF' }
      });
    } catch (e) {}

    res.json({
      success: true,
      pass: {
        visitor,
        visitorCode,
        visitorName: visitor.visitorName,
        address: visitor.address,
        visitDate: visitor.visitDate,
        visitTime: visitor.visitTime,
        groupName: visitor.groupName
      },
      visitor,
      visitorCode,
      qrCodeDataUrl
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch visitor pass.' });
  }
});

// Download/Stream Visitor Pass QR Code Image
router.get('/pass/:code/qr', async (req, res) => {
  try {
    const visitor = await visitors.findByCode(req.params.code);
    if (!visitor) return res.status(404).json({ error: 'Visitor pass not found.' });

    const visitorCode = visitor.visitorCode || visitor.id;
    const qrPayload = JSON.stringify({ pass: visitorCode, name: visitor.visitorName, id: visitor.id });
    const png = await QRCode.toBuffer(qrPayload, {
      width: 380,
      margin: 1,
      color: { dark: '#02131C', light: '#FFFFFF' }
    });

    res.set('Content-Type', 'image/png');
    res.set('Content-Disposition', `inline; filename="visitor-pass-${visitorCode}.png"`);
    res.send(png);
  } catch (err) {
    res.status(500).json({ error: 'Could not generate pass QR code.' });
  }
});

// Public QR code for visitor check-in tag
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

// PUT /api/visitors/:id - update visitor status/notes only (details cannot be altered)
router.put('/:id', async (req, res) => {
  try {
    const existing = await visitors.findById(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Visitor log not found.' });

    const updatePayload = {};
    if (req.body.status) updatePayload.status = req.body.status;
    if (req.body.notes !== undefined) updatePayload.notes = req.body.notes;
    if (req.body.tourGuide !== undefined) updatePayload.tourGuide = req.body.tourGuide;

    const visitor = await visitors.update(req.params.id, updatePayload);
    res.json({ visitor });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update visitor status.' });
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
