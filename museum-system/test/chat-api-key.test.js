const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { JWT_SECRET } = require('../middleware/auth');
const adminRoutes = require('../routes/admin');
const chatApiKey = require('../db/chat-api-key');

test('Groq API key settings are admin-only, encrypted, and removable', async () => {
  const mongoServer = await MongoMemoryServer.create();
  const originalEnvironmentKey = process.env.GROQ_API_KEY;
  const environmentKey = 'gsk_environment_fallback_test_key';
  const dashboardKey = 'gsk_dashboard_managed_test_key';
  const replacementKey = 'gsk_dashboard_replacement_test_key';

  try {
    process.env.GROQ_API_KEY = environmentKey;
    await mongoose.connect(mongoServer.getUri());
    await chatApiKey.ChatApiKey.deleteMany({});

    const app = express();
    app.use(express.json());
    app.use('/api/admin', adminRoutes);
    const adminToken = jwt.sign({ id: 'admin-1', role: 'admin' }, JWT_SECRET);
    const visitorToken = jwt.sign({ id: 'visitor-1', role: 'visitor' }, JWT_SECRET);

    const unauthorized = await request(app).get('/api/admin/api-keys/groq');
    assert.equal(unauthorized.status, 401);
    const forbidden = await request(app)
      .get('/api/admin/api-keys/groq')
      .set('Authorization', `Bearer ${visitorToken}`);
    assert.equal(forbidden.status, 403);

    const initial = await request(app)
      .get('/api/admin/api-keys/groq')
      .set('Authorization', `Bearer ${adminToken}`);
    assert.equal(initial.status, 200);
    assert.deepEqual(initial.body.settings, {
      configured: true,
      source: 'environment',
      environmentConfigured: true,
      model: 'llama-3.3-70b-versatile'
    });

    const invalid = await request(app)
      .put('/api/admin/api-keys/groq')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ apiKey: `invalid\n${dashboardKey}` });
    assert.equal(invalid.status, 400);

    const saved = await request(app)
      .put('/api/admin/api-keys/groq')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ apiKey: dashboardKey });
    assert.equal(saved.status, 200);
    assert.equal(saved.body.settings.source, 'dashboard');
    assert.equal(JSON.stringify(saved.body).includes(dashboardKey), false);

    const stored = await chatApiKey.ChatApiKey.findOne({ id: 'groq-chatbot' })
      .select('+encryptedKey +iv +authTag')
      .lean();
    assert.ok(stored.encryptedKey);
    assert.notEqual(stored.encryptedKey, dashboardKey);
    assert.equal(JSON.stringify(stored).includes(dashboardKey), false);
    assert.equal((await chatApiKey.getGroqConfiguration()).apiKey, dashboardKey);

    const replaced = await request(app)
      .put('/api/admin/api-keys/groq')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ apiKey: replacementKey });
    assert.equal(replaced.status, 200);
    assert.equal((await chatApiKey.getGroqConfiguration()).apiKey, replacementKey);

    const removed = await request(app)
      .delete('/api/admin/api-keys/groq')
      .set('Authorization', `Bearer ${adminToken}`);
    assert.equal(removed.status, 200);
    assert.equal(removed.body.settings.configured, false);
    assert.equal(removed.body.settings.source, 'disabled');
    assert.equal((await chatApiKey.getGroqConfiguration()).apiKey, '');
    const disabled = await chatApiKey.ChatApiKey.findOne({ id: 'groq-chatbot' }).lean();
    assert.equal(disabled.encryptedKey, undefined);

    const environmentFallback = await request(app)
      .post('/api/admin/api-keys/groq/use-environment')
      .set('Authorization', `Bearer ${adminToken}`);
    assert.equal(environmentFallback.status, 200);
    assert.equal(environmentFallback.body.settings.source, 'environment');
    assert.equal((await chatApiKey.getGroqConfiguration()).apiKey, environmentKey);
  } finally {
    if (originalEnvironmentKey === undefined) delete process.env.GROQ_API_KEY;
    else process.env.GROQ_API_KEY = originalEnvironmentKey;
    if (mongoose.connection.readyState) await mongoose.disconnect();
    await mongoServer.stop();
  }
});
