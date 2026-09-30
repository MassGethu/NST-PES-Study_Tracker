const { test } = require('node:test');
const assert = require('node:assert/strict');
const { normalizeResearch, normalizeMatches, generate, parseJson, createHackathonAIRouter } = require('./hackathonAI');
const { validateIdeas } = require('./hackathons');
const url = 'https://example.com/hack';
const evidence = [{ url, title: 'Official', text: 'Health 2026-10-05T18:00:00+05:30 2026-10-01 event information' }];

test('autofill requires retrieved evidence and exact date-time zones', () => {
  const source = value => ({ value, evidence: [{url, excerpt: 'event information'}] });
  const result = normalizeResearch({ facts: {
    domains: source('Health'), deadline: source('2026-10-05T18:00:00+05:30'),
    registrationDeadline: source('2026-10-01'), rules: { value: 'Made up', sourceUrls: ['https://unretrieved.example.com'] },
  } }, evidence);
  assert.equal(result.facts.domains.value, 'Health');
  assert.equal(result.facts.deadline.value, '2026-10-05T12:30:00.000Z');
  assert.equal(result.facts.registrationDeadline, undefined);
  assert.equal(result.facts.rules, undefined);
  assert.equal(result.warnings.length, 2);

});

test('matching uses saved IDs only and removes duplicates', () => {
  const idea = { id: 'i', title: 'Health tool', description: 'My concept', domains: 'Health' };
  const match = { ideaId: 'i', reason: 'Fit', adaptation: 'Adaptation' };
  assert.deepEqual(normalizeMatches({ matches: [match, match, { ...match, ideaId: 'made-up' }] }, [idea]), [match]);
  assert.equal(validateIdeas([idea], { username: 'aadarsh' }), '');
  assert.match(validateIdeas([idea], { username: 'rithika' }), /only for Aadarsh/);
  assert.match(validateIdeas([idea, idea], { username: 'aadarsh' }), /unique/);
});

test('Gemini requests use structured JSON without tools and keep the server key private; missing key and quota failures are actionable', async () => {
  const previous = process.env.GEMINI_API_KEY;
  try {
    delete process.env.GEMINI_API_KEY;
    await assert.rejects(generate('Prompt'), /not configured/);
    process.env.GEMINI_API_KEY = 'test-only-key';
    const tools = {type: 'object'};
    const result = await generate('Prompt', tools, async (target, options) => {
      assert.match(target, /^https:\/\/generativelanguage.googleapis.com\//);
      assert.equal(options.headers['x-goog-api-key'], 'test-only-key');
      assert.equal(JSON.parse(options.body).tools, undefined);
      assert.deepEqual(JSON.parse(options.body).generationConfig.responseJsonSchema, tools);
      return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: '```json\n{"facts":{}}\n```' }] } }] }) };
    });
    assert.deepEqual(result.value, { facts: {} });
    await assert.rejects(generate('Prompt', null, async () => ({ ok: false, status: 429, json: async () => ({ error: { message: 'Quota exceeded' } }) })), /quota/);
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
    assert.equal(tools.type, 'object');
    return { value: { facts: { domains: { value: 'Health', evidence: [{url, excerpt: 'event information'}] } } }, candidate: {} };
  }, async () => evidence[0]);
  assert.equal((await callRouter(router, null, '/research', {})).status, 401);
  assert.equal((await callRouter(router, { username: 'rithika' }, '/research', {})).status, 403);
  assert.equal((await callRouter(router, { username: 'aadarsh' }, '/research', { name: 'Hack', url: 'javascript:alert(1)' })).status, 400);
  const response = await callRouter(router, { username: 'aadarsh' }, '/research', { name: 'Hack', url });
  assert.equal(response.status, 200);
  assert.equal(response.value.facts.domains.value, 'Health');
  assert.equal(calls, 1);
});

const { cleanHtml, publicAddress } = require('./eventPage');
test('extraction removes scripts/navigation and preserves table facts and entities', () => {
  const text = cleanHtml('<head><title>Title</title></head><nav>Ignore</nav><h1>Event &amp; Rules</h1><script>ignore()</script><table><tr><td>Team size</td><td>2–4</td></tr></table><p>Final deadline</p>');
  assert.match(text, /Event & Rules/); assert.match(text, /Team size \| 2–4/); assert.doesNotMatch(text, /Ignore|ignore|Title/);
});
test('retrieval rejects local, mapped and private network addresses', () => {
  for (const ip of ['127.0.0.1','10.1.1.1','192.168.1.1','169.254.169.254','172.16.0.1','::1','::ffff:127.0.0.1','fc00::1','2002:7f00::1']) assert.equal(publicAddress(ip), false, ip);
  assert.equal(publicAddress('8.8.8.8'), true); assert.equal(publicAddress('2606:4700::1111'), true);
});
test('literal evidence is required even when a source URL matches', () => {
  const result = normalizeResearch({ facts: {rules: {value: 'Invented rule', evidence: [{url, excerpt: 'An invented supporting quotation'}]}} }, evidence);
  assert.equal(result.facts.rules, undefined); assert.equal(result.warnings.length, 1);
});

test('pasted text bypasses web retrieval and labels evidence honestly', async () => {
  const router = createHackathonAIRouter(async () => ({value: {facts: {domains: {value: 'Health', evidence: [{url, excerpt: 'Health and education'}]}}}}), async () => {throw new Error('Must not fetch');});
  const response = await callRouter(router, {username: 'aadarsh'}, '/research', {name: 'Hack', url, sourceText: 'Domains: Health and education'});
  assert.equal(response.status, 200); assert.equal(response.value.facts.domains.sources[0].pasted, true);
});
