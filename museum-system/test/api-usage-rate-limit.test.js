const test = require('node:test');
const assert = require('node:assert/strict');
const { getRateLimitStatus } = require('../db/api-usage');

test('rate-limit status expires based on the observed provider reset window', () => {
  const observedAt = new Date('2026-10-28T00:00:00.000Z');
  const limit = {
    observedAt,
    httpStatus: 429,
    retryAfter: '2',
    remainingRequests: 0,
    resetRequests: '1m',
    remainingTokens: 0,
    resetTokens: '10s'
  };

  const active = getRateLimitStatus(limit, observedAt.getTime() + 30000);
  assert.equal(active.isLimited, true);
  assert.equal(active.status, 'rate_limited');
  assert.equal(active.resetAt, '2026-10-28T00:01:00.000Z');
  assert.equal(active.requestsResetAt, '2026-10-28T00:01:00.000Z');
  assert.equal(active.tokensResetAt, '2026-10-28T00:00:10.000Z');

  const expired = getRateLimitStatus(limit, observedAt.getTime() + 2 * 24 * 60 * 60 * 1000);
  assert.equal(expired.isLimited, false);
  assert.equal(expired.status, 'window_ended');
  assert.equal(expired.resetAt, null);
  assert.equal(expired.requestsResetAt, '2026-10-28T00:01:00.000Z');
  assert.equal(expired.tokensResetAt, '2026-10-28T00:00:10.000Z');
});

test('normal quota snapshots are not marked as rate-limited', () => {
  const status = getRateLimitStatus({
    observedAt: new Date('2026-10-28T00:00:00.000Z'),
    httpStatus: 200,
    remainingRequests: 900,
    remainingTokens: 5000
  });

  assert.deepEqual(status, {
    isLimited: false,
    status: 'not_limited',
    resetAt: null,
    requestsResetAt: null,
    tokensResetAt: null
  });
});
