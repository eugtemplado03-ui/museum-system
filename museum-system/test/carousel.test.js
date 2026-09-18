const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const carousel = require('../db/carousel');

test('carousel workflow: seed, CRUD, reorder, and settings', async () => {
  const mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());

  try {
    // 1. Initial seed loads 5 default slides
    const initialSlides = await carousel.all(true);
    assert.equal(initialSlides.length, 5);
    assert.equal(initialSlides[0].title, 'Museo Sang Bata sa Negros');
    assert.equal(initialSlides[1].title, 'Under the Sea (Main Marine Gallery)');

    // 2. Default settings has 5000ms (5s) autoplay
    const settings = await carousel.getSettings();
    assert.equal(settings.autoplayInterval, 5000);
    assert.equal(settings.autoPlayEnabled, true);

    // 3. Create a new slide
    const created = await carousel.create({
      title: 'New Mangrove Sanctuary',
      tag: 'Conservation',
      description: 'Explore the vibrant mangrove canopy.',
      imagePath: '/uploads/mangrove.jpg',
      ctaText: 'Discover Mangroves',
      linkUrl: '/exhibits.html?cat=Marine',
      order: 5,
      active: true
    });
    assert.ok(created.id);
    assert.equal(created.title, 'New Mangrove Sanctuary');

    const allAfterCreate = await carousel.all(true);
    assert.equal(allAfterCreate.length, 6);

    // 4. Update slide
    const updated = await carousel.update(created.id, {
      title: 'Updated Mangrove Trail',
      tag: 'Eco-Tour',
      active: false
    });
    assert.equal(updated.title, 'Updated Mangrove Trail');
    assert.equal(updated.active, false);

    // When fetching only active, this updated slide should not be included
    const activeOnly = await carousel.all(false);
    assert.equal(activeOnly.length, 5);

    // 5. Reorder slides
    const currentIds = (await carousel.all(true)).map(s => s.id);
    const reversedIds = [...currentIds].reverse();
    const reorderOk = await carousel.reorder(reversedIds);
    assert.equal(reorderOk, true);

    const reordered = await carousel.all(true);
    assert.equal(reordered[0].id, reversedIds[0]);
    assert.equal(reordered[reordered.length - 1].id, reversedIds[reversedIds.length - 1]);

    // 6. Update autoplay settings
    const updatedSettings = await carousel.updateSettings({
      autoplayInterval: 8000,
      autoPlayEnabled: true
    });
    assert.equal(updatedSettings.autoplayInterval, 8000);

    // 7. Delete slide
    const deleted = await carousel.remove(created.id);
    assert.equal(deleted, true);
    assert.equal((await carousel.all(true)).length, 5);

    // 8. Reset to defaults restores 5 original slides
    const resetSlides = await carousel.resetToDefaults();
    assert.equal(resetSlides.length, 5);
    assert.equal(resetSlides[0].title, 'Museo Sang Bata sa Negros');
  } finally {
    await mongoose.disconnect();
    await mongoServer.stop();
  }
});
