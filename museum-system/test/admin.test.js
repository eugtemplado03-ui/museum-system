const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const express = require('express');
const authRoutes = require('../routes/auth');
const adminRoutes = require('../routes/admin');
const { User } = require('../db/users');

let mongoServer;
const app = express();
app.use(express.json());
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);

  // Seed default admin
  const bcrypt = require('bcryptjs');
  const hash = await bcrypt.hash('admin123', 10);
  await new User({ username: 'admin', email: 'admin@example.com', passwordHash: hash, role: 'admin' }).save();
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

let token;

describe('Admin Authentication', () => {
  it('should login and return a token', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'admin123' });

    expect(response.status).toBe(200);
    expect(response.body.token).toBeDefined();
    token = response.body.token;
  });

  it('should fail with incorrect password', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'wrongpassword' });

    expect(response.status).toBe(401);
  });
});

describe('Admin Routes', () => {
  it('should deny access without a token', async () => {
    const response = await request(app).get('/api/admin/me');
    expect(response.status).toBe(401);
  });

  it('should allow access with a valid token', async () => {
    const response = await request(app)
      .get('/api/admin/me')
      .set('Authorization', `Bearer ${token}`);
    
    expect(response.status).toBe(200);
    expect(response.body.user.username).toBe('admin');
  });
});

describe('Admin Password Reset', () => {
  const originalFetch = global.fetch;
  const originalEnv = {
    BREVO_API_KEY: process.env.BREVO_API_KEY,
    BREVO_SENDER_EMAIL: process.env.BREVO_SENDER_EMAIL,
    SITE_URL: process.env.SITE_URL
  };
  let resetCode;

  beforeAll(() => {
    process.env.BREVO_API_KEY = 'test-brevo-key';
    process.env.BREVO_SENDER_EMAIL = 'museum@example.com';
    process.env.SITE_URL = 'https://museum.example.com';
  });

  afterAll(() => {
    global.fetch = originalFetch;
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it('returns the same public response for known and unknown emails', async () => {
    let emailSent;
    const emailWasSent = new Promise(resolve => { emailSent = resolve; });
    global.fetch = async (_url, options) => {
      const payload = JSON.parse(options.body);
      resetCode = payload.textContent.match(/code is (\d{8})/)?.[1];
      emailSent();
      return { ok: true, status: 201 };
    };

    const known = await request(app).post('/api/auth/forgot-password').send({ email: 'admin@example.com' });
    expect(known.status).toBe(200);
    expect(known.body.message).toBe('If an admin account matches that email, a password reset code will be sent.');
    await emailWasSent;
    expect(resetCode).toMatch(/^\d{8}$/);

    const unknown = await request(app).post('/api/auth/forgot-password').send({ email: 'missing@example.com' });
    expect(unknown.status).toBe(200);
    expect(unknown.body).toEqual(known.body);
  });

  it('uses a reset code once and invalidates existing admin sessions', async () => {
    const mismatch = await request(app).post('/api/auth/reset-password').send({
      email: 'admin@example.com',
      code: resetCode,
      password: 'new-admin-password-2026',
      confirmPassword: 'different-password-2026'
    });
    expect(mismatch.status).toBe(400);

    const reset = await request(app).post('/api/auth/reset-password').send({
      email: 'admin@example.com',
      code: resetCode,
      password: 'new-admin-password-2026',
      confirmPassword: 'new-admin-password-2026'
    });
    expect(reset.status).toBe(200);

    const oldSession = await request(app).get('/api/admin/me').set('Authorization', `Bearer ${token}`);
    expect(oldSession.status).toBe(401);

    const reused = await request(app).post('/api/auth/reset-password').send({
      email: 'admin@example.com',
      code: resetCode,
      password: 'another-admin-password-2026',
      confirmPassword: 'another-admin-password-2026'
    });
    expect(reused.status).toBe(400);

    const login = await request(app).post('/api/auth/login').send({ username: 'admin', password: 'new-admin-password-2026' });
    expect(login.status).toBe(200);
  });
});
