const { test } = require('node:test');
const assert = require('node:assert/strict');
const { geminiFailure, sdkFailure } = require('./geminiErrors');

test('Gemini quota errors distinguish zero, daily and retryable limits without leaking provider data', () => {
  const zero = geminiFailure(429, { message: 'Quota exhausted for project secret-project, limit: 0', details: [{ violations: [{ quotaId: 'RequestsPerMinute' }] }] }, 'test-model');
  assert.match(zero.message, /zero quota/);
  assert.equal(zero.status, 429);
  assert.equal(zero.message.includes('secret-project'), false);
  assert.equal(zero.diagnostics.model, 'test-model');
  const daily = geminiFailure(429, { details: [{ violations: [{ quotaId: 'RequestsPerDay' }] }] });
  assert.match(daily.message, /daily quota/);
  const retry = geminiFailure(429, { details: [{ retryDelay: '12.5s' }] });
  assert.match(retry.message, /13 seconds/);
  assert.equal(retry.diagnostics.retryAfterSeconds, 13);
});

test('SDK and REST AI errors share actionable messages and sanitized statuses', () => {
  assert.match(geminiFailure(403).message, /credentials or permissions/);
  assert.match(geminiFailure(404).message, /model is unavailable/);
  assert.match(geminiFailure(400).message, /configuration/);
  const sdk = Object.assign(new Error('Quota exceeded, limit: 0'), { status: 429, errorDetails: [] });
  assert.match(sdkFailure(sdk, 'test-model').message, /zero quota/);
});
