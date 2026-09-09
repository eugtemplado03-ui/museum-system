const test = require('node:test');
const assert = require('node:assert');

test('Floor plan pinpoint coordinates handling', async () => {
  // Test exhibit API response contains pinX, pinY, floor
  const res = await fetch('http://localhost:3000/api/exhibits');
  assert.strictEqual(res.status, 200, 'API returns 200');
  const data = await res.json();
  assert.ok(Array.isArray(data.exhibits), 'Exhibits is an array');
  assert.ok(data.exhibits.length >= 10, 'Has at least 10 exhibits');

  const ex1 = data.exhibits.find(e => e.code === 'EX-001');
  assert.ok(ex1, 'EX-001 exists');
  assert.strictEqual(typeof ex1.pinX, 'number', 'EX-001 has numeric pinX');
  assert.strictEqual(typeof ex1.pinY, 'number', 'EX-001 has numeric pinY');
  assert.strictEqual(typeof ex1.floor, 'number', 'EX-001 has numeric floor');

  console.log(`Verified EX-001: floor=${ex1.floor}, pinX=${ex1.pinX}%, pinY=${ex1.pinY}%`);
});
