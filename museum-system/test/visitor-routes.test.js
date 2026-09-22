const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const visitorsRoutes = require('../routes/visitors');

test('Visitors API - Digital Pass and Quick Check-in Routes', async (t) => {
  const mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());

  const app = express();
  app.use(express.json());
  app.use('/api/visitors', visitorsRoutes);

  let createdVisitorCode = null;

  try {
    await t.test('POST /api/visitors/checkin creates visitor with code and QR', async () => {
      const res = await request(app)
        .post('/api/visitors/checkin')
        .send({
          visitorName: 'Maria Santos',
          address: 'Sagay City, Negros Occidental',
          sex: 'Female',
          age: 26,
          contactNumber: '+63 917 123 4567',
          email: 'maria@example.com',
          groupName: 'Sagay Tour Group'
        });

      assert.equal(res.status, 201);
      assert.equal(res.body.success, true);
      assert.ok(res.body.visitor);
      assert.equal(res.body.visitor.visitorName, 'Maria Santos');
      assert.ok(res.body.visitorCode);
      assert.match(res.body.visitorCode, /^MSBN-[A-Z0-9]{6}$/);
      assert.ok(res.body.qrCodeDataUrl);
      assert.match(res.body.qrCodeDataUrl, /^data:image\/png;base64,/);

      createdVisitorCode = res.body.visitorCode;
    });

    await t.test('GET /api/visitors/pass/:code returns pass metadata and QR', async () => {
      assert.ok(createdVisitorCode);
      const res = await request(app)
        .get(`/api/visitors/pass/${createdVisitorCode}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.pass.visitorCode, createdVisitorCode);
      assert.equal(res.body.pass.visitorName, 'Maria Santos');
      assert.ok(res.body.qrCodeDataUrl);
      assert.match(res.body.qrCodeDataUrl, /^data:image\/png;base64,/);
    });

    await t.test('GET /api/visitors/pass/:code/qr returns PNG stream', async () => {
      assert.ok(createdVisitorCode);
      const res = await request(app)
        .get(`/api/visitors/pass/${createdVisitorCode}/qr`);

      assert.equal(res.status, 200);
      assert.equal(res.headers['content-type'], 'image/png');
      assert.ok(res.body.length > 100);
    });

    await t.test('POST /api/visitors/quick-checkin performs 1-click re-entry with saved code', async () => {
      assert.ok(createdVisitorCode);
      const res = await request(app)
        .post('/api/visitors/quick-checkin')
        .send({ visitorCode: createdVisitorCode });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.visitorCode, createdVisitorCode);
      assert.equal(res.body.visitor.visitorName, 'Maria Santos');
      assert.equal(res.body.visitor.address, 'Sagay City, Negros Occidental');
      assert.equal(res.body.visitor.sex, 'Female');
      assert.equal(res.body.visitor.age, 26);
      assert.ok(res.body.qrCodeDataUrl);
    });

    await t.test('POST /api/visitors/quick-checkin handles JSON QR payload', async () => {
      assert.ok(createdVisitorCode);
      const qrPayload = JSON.stringify({
        code: createdVisitorCode,
        name: 'Maria Santos',
        system: 'MSBN'
      });

      const res = await request(app)
        .post('/api/visitors/quick-checkin')
        .send({ visitorCode: qrPayload });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.visitorCode, createdVisitorCode);
      assert.equal(res.body.visitor.visitorName, 'Maria Santos');
    });

    await t.test('POST /api/visitors/quick-checkin returns 404 for invalid code', async () => {
      const res = await request(app)
        .post('/api/visitors/quick-checkin')
        .send({ visitorCode: 'MSBN-NONEXIST' });

      assert.equal(res.status, 404);
      assert.equal(res.body.success, false);
      assert.ok(res.body.error);
    });
  } finally {
    await mongoose.disconnect();
    await mongoServer.stop();
  }
});
