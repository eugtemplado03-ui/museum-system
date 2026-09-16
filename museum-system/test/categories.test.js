const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const exhibits = require('../db/exhibits');

test('categories management workflow', async () => {
  const mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
  try {
    const initial = await exhibits.categories();
    assert.ok(Array.isArray(initial));
    assert.ok(initial.length > 0);

    // 1. Add Category
    const newCat = 'Interactive Science ' + Date.now();
    const added = await exhibits.addCategory(newCat);
    assert.equal(added, newCat);
    assert.ok((await exhibits.categories()).includes(newCat));

    // 2. Duplicate category rejected
    const dup = await exhibits.addCategory(newCat);
    assert.equal(dup, null);

    // 3. Rename Category
    const renamedCat = newCat + ' (Updated)';
    const updated = await exhibits.updateCategory(newCat, renamedCat);
    assert.equal(updated, renamedCat);
    assert.ok((await exhibits.categories()).includes(renamedCat));
    assert.ok(!(await exhibits.categories()).includes(newCat));

    // 4. Assign Exhibits to Category
    const catForAssign = 'Space Exploration ' + Date.now();
    await exhibits.addCategory(catForAssign);
    const sampleEx = await exhibits.create({ title: 'Sample Specimen', code: 'EX-998' });
    if (sampleEx) {
      const originalCat = sampleEx.category;
      const ok = await exhibits.assignExhibitsToCategory(catForAssign, [sampleEx.id]);
      assert.equal(ok, true);
      const found = await exhibits.findById(sampleEx.id);
      assert.equal(found.category, catForAssign);
      // Clean up
      await exhibits.deleteCategory(catForAssign);
      await exhibits.remove(sampleEx.id);
    }

    // 5. Delete Category
    const deleted = await exhibits.deleteCategory(renamedCat);
    assert.equal(deleted, true);
    assert.ok(!(await exhibits.categories()).includes(renamedCat));
  } finally {
    await mongoose.disconnect();
    await mongoServer.stop();
  }
});
