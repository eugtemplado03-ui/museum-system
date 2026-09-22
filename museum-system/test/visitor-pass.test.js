const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const visitors = require('../db/visitors');

test('Visitor Pass, QR generation, and Returning Quick Check-in workflow', async () => {
  const mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());

  try {
    // 1. Initial check-in for a first-time visitor
    const created = await visitors.create({
      visitorName: 'Juan Dela Cruz',
      address: 'Barangay Old Sagay, Sagay City',
      sex: 'Male',
      age: 28,
      contactNumber: '+63 918 555 1234',
      email: 'juan@example.com',
      groupName: 'Dela Cruz Family',
      groupType: 'Family Group',
      notes: 'First time visiting with kids'
    });

    assert.ok(created.id, 'Visitor should have an id');
    assert.ok(created.visitorCode, 'Visitor should have a generated visitorCode');
    assert.match(created.visitorCode, /^MSBN-[A-Z0-9]{6}$/, 'Visitor code should follow format MSBN-XXXXXX');
    assert.equal(created.visitorName, 'Juan Dela Cruz');
    assert.equal(created.address, 'Barangay Old Sagay, Sagay City');

    const passCode = created.visitorCode;

    // 2. Lookup by pass code
    const found = await visitors.findByCode(passCode);
    assert.ok(found, 'Should find visitor by pass code');
    assert.equal(found.visitorName, 'Juan Dela Cruz');
    assert.equal(found.email, 'juan@example.com');

    // 3. Quick check-in for returning visitor using the same pass code
    const quickVisit = await visitors.quickCheckin(passCode);
    assert.ok(quickVisit, 'Quick checkin should succeed');
    assert.equal(quickVisit.visitorCode, passCode, 'Should maintain the same visitor code');
    assert.equal(quickVisit.visitorName, 'Juan Dela Cruz', 'Should inherit visitor name');
    assert.equal(quickVisit.address, 'Barangay Old Sagay, Sagay City', 'Should inherit address');
    assert.equal(quickVisit.sex, 'Male', 'Should inherit sex');
    assert.equal(quickVisit.age, 28, 'Should inherit age');
    assert.equal(quickVisit.email, 'juan@example.com', 'Should inherit email');
    assert.notEqual(quickVisit.id, created.id, 'New visit log should have its own unique entry id');
    assert.equal(quickVisit.status, 'Checked-in');

    // 4. Verify all records for this visitor exist in database
    const allVisits = await visitors.all({ search: 'Juan Dela Cruz' });
    assert.equal(allVisits.length, 2, 'Should have 2 visit records (initial + returning quick checkin)');

  } finally {
    await mongoose.disconnect();
    await mongoServer.stop();
  }
});
