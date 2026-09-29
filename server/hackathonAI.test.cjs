const { test } = require('node:test');
const assert = require('node:assert/strict');
const { normalizeResearch, normalizeMatches, generate, parseJson, createHackathonAIRouter } = require('./hackathonAI');
const { validateIdeas } = require('./hackathons');
const url = 'https://example.com/hack';
const evidence = { urlContextMetadata: { urlMetadata: [{ retrievedUrl: url, urlRetrievalStatus: 'URL_RETRIEVAL_STATUS_SUCCESS' }] } };

test('autofill requires retrieved evidence and exact date-time zones', () => {
  const source = value => ({ value, sourceUrls: [url] });
  const result = normalizeResearch({ facts: {
    domains: source('Health'), deadline: source('2026-10-05T18:00:00+05:30'),
    registrationDeadline: source('2026-10-01'), rules: { value: 'Made up', sourceUrls: ['https://unretrieved.example.com'] },
  } }, evidence);
  assert.equal(result.facts.domains.value, 'Health');
  assert.equal(result.facts.deadline.value, '2026-10-05T12:30:00.000Z');
  assert.equal(result.facts.registrationDeadline, undefined);
  assert.equal(result.facts.rules, undefined);
  assert.equal(result.warnings.length, 2);
  assert.throws(() => normalizeResearch({}, {}), /No accessible web sources/);
  const grounded = { groundingMetadata: { groundingChunks: [{ web: { uri: url, title: 'Official' } }], searchEntryPoint: { renderedContent: '<p>Search suggestions</p>' } } };
  assert.equal(normalizeResearch({ facts: { domains: source('AI') } }, grounded).searchSuggestions, '<p>Search suggestions</p>');
});

test('matching uses saved IDs only and removes duplicates', () => {
  const idea = { id: 'i', title: 'Health tool', description: 'My concept', domains: 'Health' };
  const match = { ideaId: 'i', reason: 'Fit', adaptation: 'Adaptation' };
  assert.deepEqual(normalizeMatches({ matches: [match, match, { ...match, ideaId: 'made-up' }] }, [idea]), [match]);
  assert.equal(validateIdeas([idea], { username: 'aadarsh' }), '');
  assert.match(validateIdeas([idea], { username: 'rithika' }), /only for Aadarsh/);
  assert.match(validateIdeas([idea, idea], { username: 'aadarsh' }), /unique/);
});

test('Gemini requests send tools and server key; missing key and quota failures are actionable', async () => {
  const previous = process.env.GEMINI_API_KEY;
  try {
    delete process.env.GEMINI_API_KEY;
    await assert.rejects(generate('Prompt'), /not configured/);
    process.env.GEMINI_API_KEY = 'test-only-key';
    const tools = [{ url_context: {} }, { google_search: {} }];
    const result = await generate('Prompt', tools, async (target, options) => {
      assert.match(target, /^https:\/\/generativelanguage.googleapis.com\//);
      assert.equal(options.headers['x-goog-api-key'], 'test-only-key');
      assert.deepEqual(JSON.parse(options.body).tools, tools);
      return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: '```json\n{"facts":{}}\n```' }] } }] }) };
    });
    assert.deepEqual(result.value, { facts: {} });
    await assert.rejects(generate('Prompt', [], async () => ({ ok: false, status: 429 })), /quota/);
    assert.throws(() => parseJson('not-json'), /unreadable/);
  } finally { if (previous === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = previous; }
});

// Invoke Express handlers with isolated requests; no database or network required.
async function callRouter(router, user, path, body) {
  return new Promise((resolve, reject) => {
    const req = { method: 'POST', url: path, headers: {}, user, body };
    const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(value) { resolve({ status: this.statusCode, value }); } };
    router.handle(req, res, error => error ? reject(error) : reject(new Error('No handler matched')));
  });
}
test('AI routes enforce Aadarsh access and return fact results without saving or registering anything', async () => {
  let calls = 0;
  const router = createHackathonAIRouter(async (prompt, tools) => {
    calls++;
    assert.match(prompt, /factual event information only/);
    assert.equal(tools.length, 2);
    return { value: { facts: { domains: { value: 'Health', sourceUrls: [url] } } }, candidate: evidence };
  });
  assert.equal((await callRouter(router, null, '/research', {})).status, 401);
  assert.equal((await callRouter(router, { username: 'rithika' }, '/research', {})).status, 403);
  assert.equal((await callRouter(router, { username: 'aadarsh' }, '/research', { name: 'Hack', url: 'javascript:alert(1)' })).status, 400);
  const response = await callRouter(router, { username: 'aadarsh' }, '/research', { name: 'Hack', url });
  assert.equal(response.status, 200);
  assert.equal(response.value.facts.domains.value, 'Health');
  assert.equal(calls, 1);
});
