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

test('Floor map pin stationary hover and clean exhibit name badge', async () => {
  const fs = require('fs');
  const path = require('path');
  const mapHtml = fs.readFileSync(path.join(__dirname, '../public/map.html'), 'utf8');

  // Verify CSS scale is eliminated from SVG pins to prevent cursor dodging feedback loops
  assert.ok(!mapHtml.includes('.individual-exhibit-pin:hover {\n  transform: scale'), 'No scale transform on individual-exhibit-pin hover');
  assert.ok(!mapHtml.includes('.category-room-pin:hover {\n  transform: scale'), 'No scale transform on category-room-pin hover');
  assert.ok(!mapHtml.includes('.exhibit-pin:hover {\n  transform: scale'), 'No scale transform on exhibit-pin hover');

  // Verify exhibit name badge is defined
  assert.ok(mapHtml.includes('.individual-exhibit-pin .exhibit-name-badge'), 'exhibit-name-badge class styled');
  assert.ok(mapHtml.includes('.individual-exhibit-pin.active-pin .exhibit-name-badge'), 'active-pin shows badge');

  // Verify click toggles active-pin and does not open drawer
  assert.ok(mapHtml.includes("g.classList.contains('active-pin')"), 'Pin click toggles active-pin');
  assert.ok(mapHtml.includes('exhibit-name-badge'), 'Individual pin includes exhibit-name-badge');

  console.log('Verified pin hover stability and exhibit name badge configuration in map.html');
});
