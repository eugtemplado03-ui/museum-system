const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeImagePaths, getPrimaryImagePath } = require('../db/store');

test('normalizeImagePaths accepts strings and arrays', () => {
  assert.deepEqual(normalizeImagePaths(''), []);
  assert.deepEqual(normalizeImagePaths('/uploads/a.jpg'), ['/uploads/a.jpg']);
  assert.deepEqual(normalizeImagePaths(['/uploads/a.jpg', '/uploads/b.jpg']), ['/uploads/a.jpg', '/uploads/b.jpg']);
});

test('getPrimaryImagePath returns the first image path', () => {
  assert.equal(getPrimaryImagePath([]), '');
  assert.equal(getPrimaryImagePath(['/uploads/a.jpg', '/uploads/b.jpg']), '/uploads/a.jpg');
});
