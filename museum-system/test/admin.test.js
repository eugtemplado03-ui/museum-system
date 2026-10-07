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
  await new User({ username: 'admin', passwordHash: hash, role: 'admin' }).save();
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

describe('Admin Password Change', () => {
  it('rejects a wrong current password and mismatched confirmation', async () => {
    const wrongCurrent = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: 'wrongpassword', newPassword: 'new-secure-password-123', confirmPassword: 'new-secure-password-123' });
    expect(wrongCurrent.status).toBe(400);

    const mismatch = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: 'admin123', newPassword: 'new-secure-password-123', confirmPassword: 'different-password-123' });
    expect(mismatch.status).toBe(400);
  });

  it('changes the password after verifying the current password', async () => {
    const response = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: 'admin123', newPassword: 'new-secure-password-123', confirmPassword: 'new-secure-password-123' });
    expect(response.status).toBe(200);

    const oldPasswordLogin = await request(app).post('/api/auth/login').send({ username: 'admin', password: 'admin123' });
    expect(oldPasswordLogin.status).toBe(401);
    const newPasswordLogin = await request(app).post('/api/auth/login').send({ username: 'admin', password: 'new-secure-password-123' });
    expect(newPasswordLogin.status).toBe(200);
  });
});

