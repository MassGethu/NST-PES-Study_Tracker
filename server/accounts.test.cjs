const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { Pool } = require('pg');

test('real accounts preserve legacy ownership and isolate server state', { skip: !process.env.TEST_DATABASE_URL }, async () => {
  // Always use a fresh isolated schema; never run tests against application tables.
  const schema = `nst_test_${crypto.randomBytes(8).toString('hex')}`;
  const admin = new Pool({ connectionString: process.env.TEST_DATABASE_URL });
  await admin.query(`CREATE SCHEMA ${schema}`);
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
  process.env.PGOPTIONS = `-c search_path=${schema}`;
  process.env.NODE_ENV = 'test';
  const { getPool, initializeDatabase, closeDatabase } = require('./database');
  const { hashPassword } = require('./passwords');
  let server;
  try {
    delete process.env.AADARSH_INITIAL_PASSWORD;
    delete process.env.RITHIKA_INITIAL_PASSWORD;
    await initializeDatabase();
    const id = crypto.randomUUID();
    const original = { subjects: [{ id: 'math', name: 'Math', color: '#123456' }], topics: [{ id: 'lecture1', subjectId: 'math', understoodPct: 70, confidence: 3, notes: 'Original handwritten notes', _nextRevision: '2026-09-25' }], contestWeeks: [{ id: 'contest1', score: '5', subjectId: 'math' }], recallSessions: [{ id: 'recall1', feedback: 'Keep this' }], weeklyChecklist: [{ id: 'task1', text: 'Keep this too' }] };
    await getPool().query('INSERT INTO users(id,email,password_hash) VALUES($1,$2,$3)', [id, 'original@example.test', hashPassword('Old-Test-Password')]);
    await getPool().query('INSERT INTO user_states(user_id,state,version) VALUES($1,$2,7)', [id, original]);
    process.env.AADARSH_INITIAL_PASSWORD = 'Test-Aadarsh-Only-2026';
    process.env.RITHIKA_INITIAL_PASSWORD = 'Test-Rithika-Only-2026';
    await initializeDatabase();
    await initializeDatabase();
    assert.deepEqual((await getPool().query('SELECT state FROM user_states WHERE user_id=$1', [id])).rows[0].state, original);
    assert.equal((await getPool().query('SELECT count(*) FROM users')).rows[0].count, '2');
    const { app } = require('./server');
    server = await new Promise(resolve => { const instance = app.listen(0, '127.0.0.1', () => resolve(instance)); });
    const base = `http://127.0.0.1:${server.address().port}`;
    const call = async (path, { cookie, ...opts } = {}) => {
      const result = await fetch(base + path, { ...opts, headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) } });
      return { status: result.status, cookie: result.headers.get('set-cookie')?.split(';')[0], body: result.status === 204 ? null : await result.json() };
    };
    const login = (username, password) => call('/api/auth/login', { method: 'POST', body: JSON.stringify({ username, password, role: 'student_nst' }) });
    assert.equal((await call('/api/state')).status, 401);
    assert.equal((await call('/api/auth/register', { method: 'POST', body: '{}' })).status, 403);
    assert.equal((await login('aadarsh', 'wrong')).status, 401);
    const a = await login('Aadarsh', process.env.AADARSH_INITIAL_PASSWORD);
    const r = await login('rithika', process.env.RITHIKA_INITIAL_PASSWORD);
    assert.equal(a.body.user.id, id);
    assert.equal(a.body.user.role, 'student_nst');
    assert.equal(r.body.user.role, 'student_worksheet');
    assert.equal(r.body.user.password_hash, undefined);
    assert.deepEqual((await call('/api/state', { cookie: a.cookie })).body.state, original);
    assert.equal((await call('/api/state', { cookie: r.cookie })).body.state, null);
    const worksheet = { subjects: [], topics: [], worksheets: [{ id: 'w1', name: 'Algebra', status: 'graded', grade: 'A', wrongNote: 'Signs', dueDate: '2026-09-25' }] };
    const put = (cookie, accountId, state, baseVersion) => call('/api/state', { method: 'PUT', cookie, body: JSON.stringify({ accountId, state, baseVersion }) });
    assert.equal((await put(r.cookie, a.body.user.id, original, 0)).status, 409);
    assert.equal((await put(r.cookie, r.body.user.id, worksheet, 0)).status, 200);
    assert.equal((await put(r.cookie, r.body.user.id, {}, 0)).status, 409);
    assert.deepEqual((await call('/api/state', { cookie: a.cookie })).body.state, original);
    assert.deepEqual((await call('/api/state', { cookie: r.cookie })).body.state, worksheet);
    await call('/api/auth/logout', { method: 'POST', cookie: r.cookie });
    assert.equal((await call('/api/state', { cookie: r.cookie })).status, 401);
    const again = await login('rithika', process.env.RITHIKA_INITIAL_PASSWORD);
    assert.deepEqual((await call('/api/state', { cookie: again.cookie })).body.state, worksheet);
    process.env.AADARSH_INITIAL_PASSWORD = 'Different-Not-A-Reset';
    await initializeDatabase();
    assert.equal((await login('aadarsh', 'Test-Aadarsh-Only-2026')).status, 200);
  } finally {
    if (server) await new Promise(resolve => server.close(resolve));
    await closeDatabase();
    await admin.query(`DROP SCHEMA ${schema} CASCADE`);
    await admin.end();
  }
});
