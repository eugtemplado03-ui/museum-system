const test = require('node:test');
const assert = require('node:assert');

test('System Endpoints Health Check', async (t) => {
  const baseUrl = 'http://localhost:3000';

  const pages = [
    { path: '/', name: 'Landing Page' },
    { path: '/dashboard.html', name: 'Visitor Dashboard' },
    { path: '/exhibits.html', name: 'Exhibits Catalog' },
    { path: '/exhibit.html?id=EX-001', name: 'Single Exhibit Page' },
    { path: '/map.html', name: 'Interactive Floor Map' },
    { path: '/admin.html', name: 'Admin Portal' },
    { path: '/programs.html', name: 'Programs Page' },
    { path: '/events.html', name: 'Events Page' },
    { path: '/gallery.html', name: 'Photo Gallery' },
    { path: '/about.html', name: 'About Page' },
    { path: '/contact.html', name: 'Contact Page' },
    { path: '/donate.html', name: 'Donate Page' },
  ];

  for (const p of pages) {
    await t.test(`GET ${p.path} (${p.name})`, async () => {
      const res = await fetch(`${baseUrl}${p.path}`);
      assert.strictEqual(res.status, 200, `Expected 200 OK for ${p.path}`);
      const text = await res.text();
      assert.ok(text.length > 500, `${p.path} response has valid HTML content`);
    });
  }

  const apis = [
    { path: '/api/health', check: (d) => d.ok === true },
    { path: '/api/exhibits', check: (d) => Array.isArray(d.exhibits) && d.exhibits.length > 0 },
    { path: '/api/museum-info', check: (d) => !!d.museumInfo },
    { path: '/api/programs', check: (d) => Array.isArray(d.programs) },
    { path: '/api/events', check: (d) => Array.isArray(d.events) },
    { path: '/api/gallery', check: (d) => Array.isArray(d.items) || Array.isArray(d.gallery) },
  ];

  for (const a of apis) {
    await t.test(`API ${a.path}`, async () => {
      const res = await fetch(`${baseUrl}${a.path}`);
      assert.strictEqual(res.status, 200, `Expected 200 OK for ${a.path}`);
      const json = await res.json();
      assert.ok(a.check(json), `API validation passed for ${a.path}`);
    });
  }
});
