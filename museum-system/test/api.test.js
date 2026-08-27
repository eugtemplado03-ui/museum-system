const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const express = require('express');
const exhibitsRoutes = require('../routes/exhibits');
const visitorsRoutes = require('../routes/visitors');
const { Exhibit } = require('../db/exhibits');
const { Visitor } = require('../db/visitors');

let mongoServer;
const app = express();
app.use(express.json());
app.use('/api/exhibits', exhibitsRoutes);
app.use('/api/visitors', visitorsRoutes);

// Before all tests, connect to in-memory MongoDB
beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);
});

// After all tests, disconnect and stop the memory server
afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

// Clear DB before each test
beforeEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany();
  }
});

describe('Exhibits API', () => {
  it('should list all exhibits', async () => {
    // Seed an exhibit
    const exhibit = new Exhibit({ title: 'Test Exhibit', code: 'EX-999', category: 'Testing' });
    await exhibit.save();

    const response = await request(app).get('/api/exhibits');
    expect(response.status).toBe(200);
    expect(response.body.exhibits).toBeInstanceOf(Array);
    expect(response.body.exhibits.length).toBe(1);
    expect(response.body.exhibits[0].title).toBe('Test Exhibit');
  });

  it('should get an exhibit by code', async () => {
    const exhibit = new Exhibit({ title: 'Test Exhibit', code: 'EX-999', category: 'Testing' });
    await exhibit.save();

    const response = await request(app).get('/api/exhibits/EX-999');
    expect(response.status).toBe(200);
    expect(response.body.exhibit.title).toBe('Test Exhibit');
  });
});

describe('Visitors API', () => {
  it('should check in a new visitor', async () => {
    const response = await request(app)
      .post('/api/visitors/checkin')
      .send({ name: 'John Doe' });

    expect(response.status).toBe(201);
    expect(response.body.visitor.name).toBe('John Doe');
    expect(response.body.visitor.id).toBeDefined();

    // Verify in database
    const v = await Visitor.findOne({ id: response.body.visitor.id });
    expect(v.name).toBe('John Doe');
  });
});
