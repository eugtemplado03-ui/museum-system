const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { JWT_SECRET } = require('../middleware/auth');
const mapLayoutRoutes = require('../routes/map-layout');
const { MapLayout } = require('../db/map-layout');

test('map layout is public to read and admin-only to update', async () => {
  const mongoServer = await MongoMemoryServer.create();
  try {
    await mongoose.connect(mongoServer.getUri());
    const app = express();
    app.use(express.json());
    app.use('/api/map-layout', mapLayoutRoutes);
    const adminToken = jwt.sign({ id: 'admin-1', role: 'admin' }, JWT_SECRET);

    const initial = await request(app).get('/api/map-layout');
    assert.equal(initial.status, 200);
    assert.deepEqual(initial.body.roomOffsets, {});

    const unauthorized = await request(app)
      .put('/api/map-layout')
      .send({ roomOffsets: { cat_marine_nature: { x: 20, y: -15 } } });
    assert.equal(unauthorized.status, 401);

    const visitorToken = jwt.sign({ id: 'visitor-1', role: 'visitor' }, JWT_SECRET);
    const forbidden = await request(app)
      .put('/api/map-layout')
      .set('Authorization', `Bearer ${visitorToken}`)
      .send({ roomOffsets: { cat_marine_nature: { x: 20, y: -15 } } });
    assert.equal(forbidden.status, 403);

    const saved = await request(app)
      .put('/api/map-layout')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ roomOffsets: { cat_marine_nature: { x: 20, y: -15 } } });
    assert.equal(saved.status, 200);
    assert.deepEqual(saved.body.roomOffsets, { cat_marine_nature: { x: 20, y: -15 } });

    const publicRead = await request(app).get('/api/map-layout');
    assert.deepEqual(publicRead.body.roomOffsets, { cat_marine_nature: { x: 20, y: -15 } });
    assert.deepEqual((await MapLayout.findOne({ id: 'singleton' })).roomOffsets.cat_marine_nature, { x: 20, y: -15 });

    const invalid = await request(app)
      .put('/api/map-layout')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ roomOffsets: { unknown_room: { x: 10, y: 10 } } });
    assert.equal(invalid.status, 400);
  } finally {
    await mongoose.disconnect();
    await mongoServer.stop();
  }
});
