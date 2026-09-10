const test = require('node:test');
const assert = require('node:assert');
const users = require('../db/users');

test('System Security & Hardening Test Suite', async (t) => {
  const baseUrl = 'http://localhost:3000';

  await t.test('1. HTTP Security Headers (Helmet)', async () => {
    const res = await fetch(`${baseUrl}/`);
    assert.strictEqual(res.status, 200);

    const nosniff = res.headers.get('x-content-type-options');
    assert.strictEqual(nosniff, 'nosniff', 'X-Content-Type-Options: nosniff must be present');

    const csp = res.headers.get('content-security-policy');
    assert.ok(csp, 'Content-Security-Policy header must be present');
    assert.ok(csp.includes("default-src 'self'"), 'CSP default-src must be self');
  });

  await t.test('2. ReDoS / Regex Injection Immunity & Rate Limiter in Login', async () => {
    // Malicious regex strings should not cause catastrophic backtracking or crash the server
    const redosPayloads = [
      '^.*$',
      '(a+)+$',
      'admin.*',
      'admin\\\\\\',
      '[a-z]+'
    ];

    for (const payload of redosPayloads) {
      const startTime = Date.now();
      const res = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: payload, password: 'test-password' })
      });
      const duration = Date.now() - startTime;
      assert.ok(duration < 2000, `Login attempt for "${payload}" took ${duration}ms, must be fast`);
      // Should return 401 (invalid credentials) or 429 (rate limited)
      assert.ok(res.status === 401 || res.status === 429, `Expected 401 or 429 for payload "${payload}"`);
    }
  });

  await t.test('3. Authentication Security & JWT Protection', async () => {
    // A. Missing credentials
    const emptyRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    assert.strictEqual(emptyRes.status, 400, 'Empty login payload returns 400');

    // B. Invalid credentials
    const badRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'wrong-password-xyz-999' })
    });
    assert.strictEqual(badRes.status, 401, 'Bad password returns 401');

    // C. Protected endpoint with no token
    const noAuthRes = await fetch(`${baseUrl}/api/admin/analytics`);
    assert.strictEqual(noAuthRes.status, 401, 'Protected route without token returns 401');

    // D. Protected endpoint with tampered token
    const forgedRes = await fetch(`${baseUrl}/api/admin/analytics`, {
      headers: { Authorization: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.forged.signature' }
    });
    assert.strictEqual(forgedRes.status, 401, 'Tampered token returns 401');
  });

  await t.test('4. Visitor Check-in Input Validation & PII Sanitization', async () => {
    // A. Missing required fields
    const missingRes = await fetch(`${baseUrl}/api/visitors/checkin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ visitorName: '', address: '' })
    });
    assert.strictEqual(missingRes.status, 400, 'Missing fields returns 400');

    // B. Invalid email format
    const badEmailRes = await fetch(`${baseUrl}/api/visitors/checkin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        visitorName: 'Test Visitor',
        address: 'Sagay City',
        sex: 'Female',
        email: 'invalid-email-address-no-at'
      })
    });
    assert.strictEqual(badEmailRes.status, 400, 'Invalid email returns 400');
    const badEmailData = await badEmailRes.json();
    assert.ok(badEmailData.error.includes('valid email'), 'Error specifies email validation');

    // C. Invalid contact number
    const badPhoneRes = await fetch(`${baseUrl}/api/visitors/checkin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        visitorName: 'Test Visitor',
        address: 'Sagay City',
        sex: 'Male',
        contactNumber: 'abc-not-a-number'
      })
    });
    assert.strictEqual(badPhoneRes.status, 400, 'Invalid phone returns 400');

    // D. Valid check-in passes
    const validRes = await fetch(`${baseUrl}/api/visitors/checkin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        visitorName: 'Security Audit Visitor',
        address: 'Old Sagay, Sagay City',
        sex: 'Female',
        age: 24,
        email: 'audit@example.com',
        contactNumber: '+63 912 345 6789'
      })
    });
    assert.strictEqual(validRes.status, 201, 'Valid check-in returns 201');
    const validData = await validRes.json();
    assert.ok(validData.visitor && validData.visitor.id, 'Visitor created successfully');
  });

  await t.test('5. File Upload Extension Restrictions (MIME / Extension Guard)', async () => {
    // First, login as admin to get a valid token
    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'museum-admin-2026' })
    });
    
    if (loginRes.status === 200) {
      const { token } = await loginRes.json();
      
      // Attempt to upload a disallowed SVG file
      const boundary = '----WebKitFormBoundarySecurityTest';
      const body = [
        `--${boundary}`,
        'Content-Disposition: form-data; name="file"; filename="malicious.svg"',
        'Content-Type: image/svg+xml',
        '',
        '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
        `--${boundary}--`
      ].join('\r\n');

      const uploadRes = await fetch(`${baseUrl}/api/exhibits/upload-media`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': `multipart/form-data; boundary=${boundary}`
        },
        body: body
      });

      // Must be rejected (either 400 or 500 with error message)
      const uploadData = await uploadRes.json();
      assert.ok(
        uploadRes.status >= 400 || uploadData.error,
        'Dangerous file extension (.svg) must be rejected'
      );
    }
  });
});
