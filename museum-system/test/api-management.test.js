const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { JWT_SECRET } = require('../middleware/auth');
const adminRoutes = require('../routes/admin');
const chatRoutes = require('../routes/chat');
const apiManagement = require('../db/api-management');
const chatApiKey = require('../db/chat-api-key');
const apiUsage = require('../db/api-usage');
const { configureCloudinary } = require('../db/cloudinary-config');

test('API Management protects, encrypts, and updates built-in and custom providers', async () => {
  const mongoServer = await MongoMemoryServer.create();
  const previousEnvironment = {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    apiKey: process.env.CLOUDINARY_API_KEY,
    apiSecret: process.env.CLOUDINARY_API_SECRET
  };
  const environment = {
    cloudName: 'environment-cloud',
    apiKey: 'environment-cloudinary-key',
    apiSecret: 'environment-cloudinary-secret'
  };
  const dashboard = {
    cloudName: 'dashboard-cloud',
    apiKey: 'dashboard-cloudinary-key',
    apiSecret: 'dashboard-cloudinary-secret'
  };
  const groqKey = process.env.GROQ_API_KEY;

  try {
    process.env.CLOUDINARY_CLOUD_NAME = environment.cloudName;
    process.env.CLOUDINARY_API_KEY = environment.apiKey;
    process.env.CLOUDINARY_API_SECRET = environment.apiSecret;
    process.env.GROQ_API_KEY = '';
    await mongoose.connect(mongoServer.getUri());
    await Promise.all([
      apiManagement.ApiCredential.deleteMany({}),
      chatApiKey.ChatApiKey.deleteMany({})
    ]);

    const app = express();
    app.use(express.json());
    app.use('/api/admin', adminRoutes);
    app.use('/api/chat', chatRoutes);
    // These assertions validate the admin gate and provider settings flow before the mocked Groq calls are exercised.
    const adminToken = jwt.sign({ id: 'api-admin', role: 'admin' }, JWT_SECRET);
    const visitorToken = jwt.sign({ id: 'api-visitor', role: 'visitor' }, JWT_SECRET);

    assert.equal((await request(app).get('/api/admin/api-management')).status, 401);
    assert.equal((await request(app)
      .get('/api/admin/api-management')
      .set('Authorization', `Bearer ${visitorToken}`)).status, 403);

    const initial = await request(app)
      .get('/api/admin/api-management')
      .set('Authorization', `Bearer ${adminToken}`);
    assert.equal(initial.status, 200);
    assert.equal(initial.body.settings.cloudinary.source, 'environment');
    assert.equal(initial.body.settings.cloudinary.configured, true);
    assert.deepEqual(initial.body.settings.customProviders, []);

    const disabledGroqWithoutRecord = await request(app)
      .delete('/api/admin/api-management/groq')
      .set('Authorization', `Bearer ${adminToken}`);
    assert.equal(disabledGroqWithoutRecord.status, 200);
    assert.equal(disabledGroqWithoutRecord.body.settings.groq.source, 'disabled');
    await request(app)
      .post('/api/admin/api-management/groq/use-environment')
      .set('Authorization', `Bearer ${adminToken}`);

    const savedGroq = await request(app)
      .put('/api/admin/api-management/groq')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ apiKey: 'managed-groq-test-secret' });
    assert.equal(savedGroq.status, 200);
    assert.equal(savedGroq.body.settings.groq.source, 'dashboard');
    assert.equal(JSON.stringify(savedGroq.body).includes('managed-groq-test-secret'), false);
    assert.equal((await chatApiKey.getGroqConfiguration()).apiKey, 'managed-groq-test-secret');

    // Route behavior is validated with a mocked Groq response so malformed, rate-limited, and failed upstream calls are all exercised in one test.
    const originalFetch = global.fetch;
    let fetchMode = 'success';
    global.fetch = async (url, options) => {
      assert.match(String(url), /api\.groq\.com\/openai\/v1\/chat\/completions$/);
      assert.equal(options.headers.Authorization, 'Bearer managed-groq-test-secret');
      if (fetchMode === 'malformed') return new Response('not valid JSON', { status: 200 });
      if (fetchMode === 'rate-limit') return new Response('rate limited', { status: 429 });
      if (fetchMode === 'network-error') throw new Error('Network unavailable');
      return new Response(JSON.stringify({
        choices: [{ message: { content: 'Mocked museum answer.' } }],
        usage: { prompt_tokens: 23, completion_tokens: 5, total_tokens: 28 }
      }), {
        status: 200,
        headers: {
          'content-type': 'application/json',
          'x-ratelimit-limit-requests': '1000',
          'x-ratelimit-remaining-requests': '998',
          'x-ratelimit-reset-requests': '12h',
          'x-ratelimit-limit-tokens': '6000',
          'x-ratelimit-remaining-tokens': '5900',
          'x-ratelimit-reset-tokens': '5s'
        }
      });
    };
    try {
      const chatResponse = await request(app)
        .post('/api/chat')
        .send({ message: 'What can I see at the museum?' });
      assert.equal(chatResponse.status, 200);
      assert.equal(chatResponse.body.reply, 'Mocked museum answer.');

      fetchMode = 'malformed';
      const malformedResponse = await request(app)
        .post('/api/chat')
        .send({ message: 'Tell me about the museum.' });
      assert.equal(malformedResponse.status, 200);
      assert.ok(malformedResponse.body.reply);

      fetchMode = 'rate-limit';
      const rateLimitedResponse = await request(app)
        .post('/api/chat')
        .send({ message: 'What can I visit?' });
      assert.equal(rateLimitedResponse.status, 200);
      assert.ok(rateLimitedResponse.body.reply);

      fetchMode = 'network-error';
      const networkErrorResponse = await request(app)
        .post('/api/chat')
        .send({ message: 'What are the exhibits?' });
      assert.equal(networkErrorResponse.status, 200);
      assert.ok(networkErrorResponse.body.reply);
    } finally {
      global.fetch = originalFetch;
    }

    assert.equal((await request(app)
      .get('/api/admin/api-management/usage')
      .set('Authorization', `Bearer ${visitorToken}`)).status, 403);
    assert.equal((await request(app)
      .get('/api/admin/api-management/usage?days=365')
      .set('Authorization', `Bearer ${adminToken}`)).status, 400);

    const chatUsage = await request(app)
      .get('/api/admin/api-management/usage?days=30')
      .set('Authorization', `Bearer ${adminToken}`);
    assert.equal(chatUsage.body.usage.totals.requests, 4);
    assert.equal(chatUsage.body.usage.totals.succeeded, 2);
    assert.equal(chatUsage.body.usage.totals.failed, 2);

    await apiUsage.recordGroqUsage({
      service: 'chat',
      model: 'test-model',
      response: {
        ok: true,
        status: 200,
        headers: new Headers({
          'x-ratelimit-limit-requests': '1000',
          'x-ratelimit-remaining-requests': '999',
          'x-ratelimit-reset-requests': '12h',
          'x-ratelimit-limit-tokens': '6000',
          'x-ratelimit-remaining-tokens': '5990',
          'x-ratelimit-reset-tokens': '5s'
        })
      },
      usage: { prompt_tokens: 11, completion_tokens: 7, total_tokens: 18 }
    });
    await apiUsage.recordGroqUsage({
      service: 'chat',
      model: 'test-model',
      response: {
        ok: false,
        status: 429,
        headers: new Headers({
          'retry-after': '2',
          'x-ratelimit-limit-requests': '1000',
          'x-ratelimit-remaining-requests': '0',
          'x-ratelimit-reset-requests': '1m',
          'x-ratelimit-limit-tokens': '6000',
          'x-ratelimit-remaining-tokens': '0',
          'x-ratelimit-reset-tokens': '10s'
        })
      }
    });
    const usageResponse = await request(app)
      .get('/api/admin/api-management/usage?days=30')
      .set('Authorization', `Bearer ${adminToken}`);
    assert.equal(usageResponse.status, 200);
    assert.equal(usageResponse.body.usage.totals.requests, 6);
    assert.equal(usageResponse.body.usage.totals.succeeded, 3);
    assert.equal(usageResponse.body.usage.totals.failed, 3);
    assert.equal(usageResponse.body.usage.totals.inputTokens, 34);
    assert.equal(usageResponse.body.usage.totals.outputTokens, 12);
    assert.equal(usageResponse.body.usage.totals.totalTokens, 46);
    assert.equal(usageResponse.body.usage.rateLimits.remainingRequests, 0);
    assert.equal(usageResponse.body.usage.rateLimits.remainingTokens, 0);
    assert.equal(usageResponse.body.usage.rateLimits.retryAfter, '2');
    assert.equal(usageResponse.body.usage.rateLimits.isLimited, true);
    assert.equal(usageResponse.body.usage.rateLimits.status, 'rate_limited');

    await apiUsage.RateLimit.updateOne(
      { _id: 'groq|test-model' },
      { $set: { observedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) } }
    );
    const expiredLimitResponse = await request(app)
      .get('/api/admin/api-management/usage?days=30')
      .set('Authorization', `Bearer ${adminToken}`);
    assert.equal(expiredLimitResponse.status, 200);
    assert.equal(expiredLimitResponse.body.usage.rateLimits.isLimited, false);
    assert.equal(expiredLimitResponse.body.usage.rateLimits.status, 'window_ended');
    assert.equal(expiredLimitResponse.body.usage.rateLimits.resetAt, null);

    const invalidCloudinary = await request(app)
      .put('/api/admin/api-management/cloudinary')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ cloudName: dashboard.cloudName, apiKey: dashboard.apiKey });
    assert.equal(invalidCloudinary.status, 400);

    const savedCloudinary = await request(app)
      .put('/api/admin/api-management/cloudinary')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(dashboard);
    assert.equal(savedCloudinary.status, 200);
    assert.equal(savedCloudinary.body.settings.cloudinary.source, 'dashboard');
    assert.equal(JSON.stringify(savedCloudinary.body).includes(dashboard.apiSecret), false);
    assert.deepEqual((await apiManagement.getCloudinaryConfiguration()).credentials, dashboard);

    const cloudinaryStored = await apiManagement.ApiCredential.findOne({ id: 'cloudinary' })
      .select('+encryptedKey +iv +authTag')
      .lean();
    assert.ok(cloudinaryStored.encryptedKey);
    assert.equal(JSON.stringify(cloudinaryStored).includes(dashboard.apiSecret), false);

    const createdCustom = await request(app)
      .post('/api/admin/api-management/custom')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Maps API', apiKey: 'maps-secret-value' });
    assert.equal(createdCustom.status, 201);
    const customProvider = createdCustom.body.settings.customProviders[0];
    assert.equal(customProvider.name, 'Maps API');
    assert.equal(JSON.stringify(createdCustom.body).includes('maps-secret-value'), false);

    const customStored = await apiManagement.ApiCredential.findOne({ id: customProvider.id })
      .select('+encryptedKey +iv +authTag')
      .lean();
    assert.ok(customStored.encryptedKey);
    assert.equal(JSON.stringify(customStored).includes('maps-secret-value'), false);

    const updatedCustom = await request(app)
      .put(`/api/admin/api-management/custom/${customProvider.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Updated Maps API', apiKey: 'updated-maps-secret' });
    assert.equal(updatedCustom.status, 200);
    assert.equal(updatedCustom.body.settings.customProviders[0].name, 'Updated Maps API');
    assert.equal(JSON.stringify(updatedCustom.body).includes('updated-maps-secret'), false);

    const removedCustom = await request(app)
      .delete(`/api/admin/api-management/custom/${customProvider.id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    assert.equal(removedCustom.status, 200);
    assert.deepEqual(removedCustom.body.settings.customProviders, []);

    const disabledCloudinary = await request(app)
      .delete('/api/admin/api-management/cloudinary')
      .set('Authorization', `Bearer ${adminToken}`);
    assert.equal(disabledCloudinary.status, 200);
    assert.equal(disabledCloudinary.body.settings.cloudinary.configured, false);
    assert.equal(disabledCloudinary.body.settings.cloudinary.source, 'disabled');
    assert.equal((await apiManagement.getCloudinaryConfiguration()).credentials, null);

    const restoredCloudinary = await request(app)
      .post('/api/admin/api-management/cloudinary/use-environment')
      .set('Authorization', `Bearer ${adminToken}`);
    assert.equal(restoredCloudinary.status, 200);
    assert.equal(restoredCloudinary.body.settings.cloudinary.source, 'environment');
    assert.deepEqual((await apiManagement.getCloudinaryConfiguration()).credentials, environment);

    const disabledCloudinaryWithoutRecord = await request(app)
      .delete('/api/admin/api-management/cloudinary')
      .set('Authorization', `Bearer ${adminToken}`);
    assert.equal(disabledCloudinaryWithoutRecord.status, 200);
    assert.equal(disabledCloudinaryWithoutRecord.body.settings.cloudinary.source, 'disabled');
    await request(app)
      .post('/api/admin/api-management/cloudinary/use-environment')
      .set('Authorization', `Bearer ${adminToken}`);
  } finally {
    configureCloudinary(null);
    if (previousEnvironment.cloudName === undefined) delete process.env.CLOUDINARY_CLOUD_NAME;
    else process.env.CLOUDINARY_CLOUD_NAME = previousEnvironment.cloudName;
    if (previousEnvironment.apiKey === undefined) delete process.env.CLOUDINARY_API_KEY;
    else process.env.CLOUDINARY_API_KEY = previousEnvironment.apiKey;
    if (previousEnvironment.apiSecret === undefined) delete process.env.CLOUDINARY_API_SECRET;
    else process.env.CLOUDINARY_API_SECRET = previousEnvironment.apiSecret;
    if (groqKey === undefined) delete process.env.GROQ_API_KEY;
    else process.env.GROQ_API_KEY = groqKey;
    if (mongoose.connection.readyState) await mongoose.disconnect();
    await mongoServer.stop();
  }
});
