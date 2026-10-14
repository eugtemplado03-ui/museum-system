const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const museumInfo = require('../db/museum-info');

test('museum info includes editable About, Contact, and Donate content', async () => {
  const mongoServer = await MongoMemoryServer.create();
  try {
    await mongoose.connect(mongoServer.getUri());
    await museumInfo.MuseumInfo.collection.insertOne({ id: 'singleton', name: 'Existing Museum' });

    const legacyInfo = await museumInfo.getInfo();
    assert.equal(legacyInfo.name, 'Existing Museum');
    assert.ok(legacyInfo.aboutVision);
    assert.ok(legacyInfo.contactEmail);
    assert.ok(legacyInfo.donationDollarAccount);

    await museumInfo.updateInfo({
      aboutVision: 'Updated vision',
      contactEmail: 'updated@example.com',
      donationDollarAccount: 'Account No.: 12345'
    });

    const updatedInfo = await museumInfo.getInfo();
    assert.equal(updatedInfo.aboutVision, 'Updated vision');
    assert.equal(updatedInfo.contactEmail, 'updated@example.com');
    assert.equal(updatedInfo.donationDollarAccount, 'Account No.: 12345');
    assert.equal(updatedInfo.aboutMission, museumInfo.DEFAULT_INFO.aboutMission);
  } finally {
    await mongoose.disconnect();
    await mongoServer.stop();
  }
});
