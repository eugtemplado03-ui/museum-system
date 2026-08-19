const test = require('node:test');
const assert = require('node:assert/strict');
const exhibits = require('../db/exhibits');

test('categories management workflow', () => {
  const initial = exhibits.categories();
  assert.ok(Array.isArray(initial));
  assert.ok(initial.length > 0);

  // 1. Add Category
  const newCat = 'Interactive Science ' + Date.now();
  const added = exhibits.addCategory(newCat);
  assert.equal(added, newCat);
  assert.ok(exhibits.categories().includes(newCat));

  // 2. Duplicate category rejected
  const dup = exhibits.addCategory(newCat);
  assert.equal(dup, null);

  // 3. Rename Category
  const renamedCat = newCat + ' (Updated)';
  const updated = exhibits.updateCategory(newCat, renamedCat);
  assert.equal(updated, renamedCat);
  assert.ok(exhibits.categories().includes(renamedCat));
  assert.ok(!exhibits.categories().includes(newCat));

  // 4. Assign Exhibits to Category
  const catForAssign = 'Space Exploration ' + Date.now();
  exhibits.addCategory(catForAssign);
  const sampleEx = exhibits.all()[0];
  if (sampleEx) {
    const originalCat = sampleEx.category;
    const ok = exhibits.assignExhibitsToCategory(catForAssign, [sampleEx.id]);
    assert.equal(ok, true);
    assert.equal(exhibits.findById(sampleEx.id).category, catForAssign);
    // Restore
    exhibits.assignExhibitsToCategory(originalCat, [sampleEx.id]);
    exhibits.deleteCategory(catForAssign);
  }

  // 5. Delete Category
  const deleted = exhibits.deleteCategory(renamedCat);
  assert.equal(deleted, true);
  assert.ok(!exhibits.categories().includes(renamedCat));
});
